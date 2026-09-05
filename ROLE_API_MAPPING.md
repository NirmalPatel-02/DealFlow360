# Role → Feature → Backend API Mapping

## Backend Roles (from `app/models/user.py`)
- `sales_rep`
- `sales_manager`
- `finance` (used in billing, also `finance_ops` in enums)
- `operations`
- `customer`
- `admin`

## API Endpoints & Route Prefixes
- Auth: `/api/v1/auth/`
- Quotations: `/api/quotations/`
- Approvals: `/api/approvals/`
- Customers: `/api/customers/`
- Billing: `/api/billing/`
- Catalog: `/api/catalog/`
- Governance: `/api/governance/`

---

## Role-Based Feature Matrix

### 1. **SALES_REP** 
Role dependency: `require_internal_user` (sales_rep, sales_manager, finance, operations, admin)

#### Features:
| Feature | Endpoint | Method | Purpose |
|---------|----------|--------|---------|
| **Create Quotation** | `/api/quotations` | POST | Draft new quote |
| **List Quotations** | `/api/quotations?status=DRAFT,PENDING_APPROVAL,SENT` | GET | View own/team quotes |
| **Get Quotation Detail** | `/api/quotations/{quote_id}` | GET | View quote details & lines |
| **Add Quote Lines** | `/api/quotations/{quote_id}/lines` | POST | Add products to quote |
| **Update Quote Line** | `/api/quotations/{quote_id}/lines/{line_id}` | PATCH | Change discount, qty, etc. |
| **Delete Quote Line** | `/api/quotations/{quote_id}/lines/{line_id}` | DELETE | Remove line |
| **Evaluate Quote** | `/api/approvals/quotes/{quote_id}/evaluate` | POST | Check approval requirements |
| **Submit for Approval** | `/api/approvals/quotes/{quote_id}/submit` | POST | Change status to PENDING_APPROVAL |
| **List Customers** | `/api/customers` | GET | Find customer for quote |
| **Get Catalog/Products** | `/api/catalog/products` | GET | Browse products |
| **Apply Discount** | `via /api/quotations/{quote_id}/lines` (discount_percent field) | PATCH | Set discount on line |

**Dashboard Sections:**
- My Drafts (status = DRAFT)
- Pending Approval (status = PENDING_APPROVAL)
- Sent to Customer (status = SENT)
- Under Negotiation (status = UNDER_NEGOTIATION)
- Approved/Ready (status = APPROVED)
- Rejected (status = REJECTED)

---

### 2. **SALES_MANAGER** (+ Sales Manager/Approver)
Role dependency: `require_manager` (sales_manager, admin)

#### Features (all from Sales Rep +):
| Feature | Endpoint | Method | Purpose |
|---------|----------|--------|---------|
| **Approve Quote** | `/api/approvals/{approval_id}` | POST | Approve at MANAGER level |
| **Reject Quote** | `/api/approvals/{approval_id}` | POST | Reject quote |
| **Return Quote** | `/api/approvals/{approval_id}` | POST | Request changes (returns to REVISION_REQUIRED) |
| **List Pending Approvals** | `/api/approvals/quotes/{quote_id}/pending` (inferred) | GET | View approval chain status |
| **Evaluate At-Risk Deals** | TBD - deal_engine service | GET | Risk scores from evaluation |

**Approval Workflow:**
- Handles approval_level = MANAGER
- Can view risk scores, violations
- If Finance-level approval needed, passes to Finance

**Dashboard Sections:**
- My Team's Quotes (DRAFT, SENT, UNDER_NEGOTIATION)
- Pending My Approval (approval_level = MANAGER, status = PENDING)
- Approved by Me (status = APPROVED for my approvals)
- Rejected by Me (status = REJECTED for my approvals)
- At-Risk Deals (risk_score > threshold)

---

### 3. **FINANCE** / **OPERATIONS**
Role dependency: `require_internal_user` (can see finance roles in enums as finance_ops)

#### Features:
| Feature | Endpoint | Method | Purpose |
|---------|----------|--------|---------|
| **Second-Level Approvals** | `/api/approvals/{approval_id}` | POST | Approve at MANAGER_FINANCE level |
| **View Invoices** | `/api/billing/invoices` | GET | List invoices |
| **Create Invoice** | `/api/billing/invoices` | POST | From approved quote |
| **Record Payment** | `/api/billing/invoices/{invoice_id}/payments` | POST | Payment entry |
| **Create Order** | `/api/billing/orders` | POST | Fulfillment order from quote |
| **Create Subscription** | `/api/billing/subscriptions` | POST | For recurring line items |
| **Handle Refunds** | `/api/billing/refunds` (inferred) | POST | Credit notes / refunds |

**Approval Workflow:**
- Handles approval_level = MANAGER_FINANCE
- Reviews quotes from Sales Manager
- May set back to REVISION_REQUIRED if issues

**Dashboard Sections:**
- Pending My Finance Approval (approval_level = MANAGER_FINANCE, status = PENDING)
- Approved Quotes Ready for Fulfillment (status = APPROVED)
- Active Orders (status = active)
- Invoices (overdue, pending, paid)
- Subscriptions (active, upcoming renewal)

---

### 4. **CUSTOMER**
Role dependency: Customer Portal (separate frontend routes/layout)

#### Features (Backend TBD - No explicit customer endpoints found):
| Feature | Endpoint | Method | Purpose |
|---------|----------|--------|---------|
| **View Quotations** | `/api/quotations?customer_id={id}` | GET | List quotes sent to customer |
| **Get Quotation** | `/api/quotations/{quote_id}` | GET | View quote details |
| **Request Line Changes** | (NOT IMPLEMENTED) | PATCH | Ask for modifications |
| **Submit Counter-Offer** | (NOT IMPLEMENTED) | POST | Negotiate discount/terms |
| **Confirm Final Terms** | (NOT IMPLEMENTED - workflow state change) | PATCH | Accept quote → CONFIRMED |

**Dashboard Sections:**
- Quotes Under Review (status = SENT or UNDER_NEGOTIATION)
- Approved & Ready to Confirm (status = APPROVED)
- Confirmed Orders (status = CONFIRMED)
- Historical Quotes (status = CANCELLED, other)

---

## Missing Backend APIs (Not Yet Implemented)

The following features are **requested but NOT in backend**:
1. **Customer Portal Routes**: No dedicated customer endpoints for viewing/negotiating quotes
2. **Line-Level Questions**: No API for customer to ask questions on specific quote lines
3. **Negotiation Workflow**: No back-and-forth negotiation endpoints
4. **Counter-Offer API**: No discount negotiation from customer side
5. **Quote Confirmation**: No endpoint to move APPROVED → CONFIRMED
6. **Fulfillment Status Tracking**: No fulfillment status/tracking endpoints
7. **Deal Health/At-Risk Detection**: Scoring exists but no public endpoint

---

## Authentication Flow (Both Roles)
- All endpoints require `Authorization: Bearer {access_token}`
- Refresh token is in HTTP-only cookie `df_refresh`
- 401 → refresh token → retry (automatic in frontend)
- 403 → role not allowed (permission denied)

---

## Summary: Implementation Strategy

### Phase 1: Implement with Existing APIs
1. **Sales Rep Dashboard**
   - List/create/manage quotations
   - Add quote lines with products
   - Apply discounts
   - Submit for approval
   - Track approval status

2. **Sales Manager Dashboard**
   - List team quotations
   - Approve/reject/return quotes
   - View approval chain & risk scores
   - Monitor at-risk deals

3. **Finance Dashboard** (if finance role exists and visible to system)
   - Second-level approvals
   - Invoice management
   - Payment recording
   - Order/subscription creation

### Phase 2: Note Missing Features (Mark as "Coming Soon")
- Customer Portal (needs frontend routes + backend endpoints)
- Negotiation workflow (needs backend support)
- Line-level questions (needs new API)
- Quote confirmation (needs status workflow endpoint)

### Phase 3: Current Frontmost Need
- **Get quotations API working** for all internal users
- **Approval chain visualization** 
- **Risk score display**
- **Discount validation feedback**
