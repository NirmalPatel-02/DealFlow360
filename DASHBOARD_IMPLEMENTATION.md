# Role-Based Dashboard Implementation Guide

## Overview

You now have a **complete role-based dashboard system** that connects directly to your backend APIs. Each role sees a customized dashboard with relevant quotation management features.

---

## What Was Implemented

### 1. **API Layer** (`/src/features/quotations/quotations.api.js`)

Core functions for all quotation operations:

```javascript
// Quotation CRUD
createQuotation()      // POST /api/quotations
listQuotations()       // GET /api/quotations?status=...
getQuotation()         // GET /api/quotations/{id}
updateQuotation()      // PATCH /api/quotations/{id}

// Quote Lines
addQuoteLine()         // POST /api/quotations/{id}/lines
updateQuoteLine()      // PATCH /api/quotations/{id}/lines/{line_id}
deleteQuoteLine()      // DELETE /api/quotations/{id}/lines/{line_id}

// Approvals
evaluateQuote()        // POST /api/approvals/quotes/{id}/evaluate
submitQuoteForApproval() // POST /api/approvals/quotes/{id}/submit
actOnApproval()        // POST /api/approvals/{id}
```

**Key Feature:** All requests use the existing authentication layer with Bearer token attachment.

---

### 2. **Custom Hooks** (`/src/features/quotations/quotations.hooks.js`)

React hooks for managing quotation state and API interactions:

```javascript
useQuotations(filters)       // Fetch & filter quotations
useQuotationDetail(id)       // Fetch single quote with details
useCreateQuotation()         // Create new quote
useQuotationLines(quoteId)   // Manage quote lines (add/update/delete)
useQuoteSubmission(quoteId)  // Evaluate & submit quotes
useApprovalAction()          // Approve/reject/return (manager/finance)
```

**Benefits:**
- Automatic loading/error states
- Built-in refetch capabilities
- Error handling using your existing `getErrorMessage()` utility
- Async state management without external libraries

---

### 3. **Role-Based Dashboards**

#### **Sales Rep Dashboard** (`SalesRepDashboard.jsx`)
- **Purpose:** Create and manage quotations
- **Statuses Shown:** DRAFT, PENDING_APPROVAL, APPROVED, SENT, UNDER_NEGOTIATION, CONFIRMED
- **Key Actions:**
  - Create new quotation
  - Add/edit quote lines
  - Apply discounts
  - Submit for approval
  - Track approval status
- **Stats:** Total, In Draft, Pending, Approved, Sent, Negotiating
- **Navigation:** Tabs to filter by status

---

#### **Sales Manager Dashboard** (`SalesManagerDashboard.jsx`)
- **Purpose:** Review and approve quotations at MANAGER level
- **Key Actions:**
  - Review pending approvals
  - Approve/reject/return quotes
  - View risk scores
  - Monitor at-risk deals (risk_score > 50%)
- **Stats:** Pending Review, Approved by Me, Rejected by Me, At-Risk Count
- **Risk Indicators:** Visual highlighting for high-risk quotes (>50% risk score)
- **Navigation:** Tabs for pending, approved, rejected, at-risk

---

#### **Finance/Operations Dashboard** (`FinanceDashboard.jsx`)
- **Purpose:** Second-level approvals, fulfillment, and billing
- **Key Actions:**
  - Approve at MANAGER_FINANCE level
  - Review margins and costs
  - Create orders for fulfillment
  - Invoice management
  - Subscription billing setup
- **Stats:** Finance Pending, Finance Approved, Ready for Fulfillment
- **Focus:** Cost analysis, margin reviews, fulfillment workflow

---

#### **Customer Portal** (`CustomerDashboard.jsx` - Placeholder)
- **Status:** Coming soon (needs customer-specific backend APIs)
- **Planned Features:**
  - View quotations sent by sales rep
  - Request modifications
  - Negotiate terms
  - Confirm final quotation

---

### 4. **Supporting APIs**

#### Customers (`/src/features/customers/customers.api.js`)
```javascript
listCustomers()       // GET /api/customers
getCustomer()         // GET /api/customers/{id}
createCustomer()      // POST /api/customers
updateCustomer()      // PATCH /api/customers/{id}
```

#### Products/Catalog (`/src/features/products/products.api.js`)
```javascript
listProducts()        // GET /api/catalog/products
getProduct()          // GET /api/catalog/products/{id}
listCategories()      // GET /api/catalog/categories
listPriceLists()      // GET /api/catalog/price-lists
```

---

## Router Configuration

The main dashboard automatically routes to the correct dashboard based on user role:

```javascript
// DashboardPage.jsx
switch (user?.role) {
  case 'sales_rep':        → SalesRepDashboard
  case 'sales_manager':    → SalesManagerDashboard
  case 'finance':          → FinanceDashboard
  case 'operations':       → FinanceDashboard
  case 'admin':            → SalesManagerDashboard
  case 'customer':         → CustomerDashboard (placeholder)
}
```

---

## Data Flow Example: Sales Rep Creating a Quotation

```
1. User clicks "New Quotation"
   ↓
2. Form component calls: useCreateQuotation()
   ↓
3. Component calls: create({ customer_id, notes })
   ↓
4. API calls: POST /api/quotations with auth token
   ↓
5. Response: Quotation object with id, status='DRAFT'
   ↓
6. Redirect to: /quotations/{quote_id}/edit
   ↓
7. Edit page fetches: useQuotationDetail(quote_id)
   ↓
8. User adds lines: useQuotationLines(quote_id).addLine({product_id, quantity, discount_percent})
   ↓
9. User submits: useQuoteSubmission(quote_id).evaluate() → .submit()
   ↓
10. Status changes to: PENDING_APPROVAL
    ↓
11. Manager sees it in their dashboard
```

---

## Approval Chain Workflow

```
Sales Rep
  ↓
  Submit Quote → status = PENDING_APPROVAL
  ↓
Sales Manager (MANAGER level approval)
  ├─ Approve → Check Finance needed?
  │  ├─ If no → status = APPROVED
  │  └─ If yes → Goes to Finance
  │
  ├─ Reject → status = REJECTED
  │
  └─ Return → status = REVISION_REQUIRED
     ↓
     Sales Rep fixes → Resubmit
  
Finance/Operations (MANAGER_FINANCE level approval)
  ├─ Approve → status = APPROVED (ready for fulfillment)
  ├─ Reject → status = REJECTED
  └─ Return → status = REVISION_REQUIRED
```

---

## Testing the Implementation

### Prerequisites
1. Backend running: `uvicorn app.main:app --reload`
2. Frontend running: `npm run dev`
3. Logged in with different user roles

### Test Scenario 1: Sales Rep Workflow
```
1. Login as sales_rep
2. Click "New Quotation"
3. Select a customer
4. Add quote lines (products with quantities)
5. Apply discount to a line
6. Evaluate (check risk score & violations)
7. Submit for approval
8. Check status → should be PENDING_APPROVAL
9. Logout, login as sales_manager
```

### Test Scenario 2: Manager Approval
```
1. Login as sales_manager
2. Go to Dashboard
3. See "Pending Review" count
4. Click on a quote
5. Review risk score & discount violations
6. Click "Approve" or "Reject"
7. If Finance approval needed, quote goes to finance role
8. If not needed, status → APPROVED immediately
```

### Test Scenario 3: Finance Workflow
```
1. Login as finance role
2. Go to Dashboard
3. See "Finance Pending" approvals
4. Review quote costs, margins
5. Approve → quote goes to fulfillment
6. Create order from approved quote
7. Generate invoice
8. Record payment
```

---

## Known Limitations & TODO

### ✅ Implemented
- Sales Rep dashboard with quotation management
- Sales Manager dashboard with approvals
- Finance/Operations dashboard with second-level approvals
- Automatic authentication & token refresh
- Error handling & user feedback
- Status tracking & filtering
- Risk score visualization

### ❌ Not Yet Implemented (Blocked by Backend)

1. **Customer Portal**
   - Needs: Backend endpoints for customer to view/negotiate quotes
   - Status: Backend has no customer-specific endpoints

2. **Negotiation Workflow**
   - Needs: API endpoints for counter-offers & line-level discussions
   - Status: Backend has no negotiation endpoints

3. **Quote Confirmation**
   - Needs: Endpoint to move APPROVED → CONFIRMED
   - Status: Backend has no confirmation endpoint

4. **Fulfillment Tracking**
   - Needs: Order/fulfillment status endpoints
   - Status: Partial (invoice/order endpoints exist, but no status tracking)

5. **Line-Level Questions**
   - Needs: Comment/question API on quote lines
   - Status: Not implemented in backend

### 🔧 To Build Next

1. **Quotation Detail View** (`/quotations/{id}`)
   - Show full quote details
   - Display approval chain
   - Show line items with costs/margins
   - Display risk scores & violations

2. **Create/Edit Quotation Pages**
   - Form to select customer
   - Add/remove quote lines
   - Inline discount entry
   - Price calculation display

3. **Approval Actions Modal**
   - Approve/Reject/Return actions
   - Reason text field
   - Risk score & violation display

4. **Billing Integration**
   - Invoice creation from approved quotes
   - Payment recording
   - Subscription setup for recurring lines

---

## API Endpoint Reference

### Quotations
- `POST /api/quotations` - Create
- `GET /api/quotations` - List (with status filter)
- `GET /api/quotations/{id}` - Get detail
- `PATCH /api/quotations/{id}` - Update
- `POST /api/quotations/{id}/lines` - Add line
- `PATCH /api/quotations/{id}/lines/{line_id}` - Update line
- `DELETE /api/quotations/{id}/lines/{line_id}` - Delete line

### Approvals
- `POST /api/approvals/quotes/{id}/evaluate` - Get risk score & violations
- `POST /api/approvals/quotes/{id}/submit` - Submit for approval
- `POST /api/approvals/{id}` - Act on approval (approve/reject/return)

### Customers
- `GET /api/customers` - List
- `GET /api/customers/{id}` - Get detail
- `POST /api/customers` - Create
- `PATCH /api/customers/{id}` - Update

### Catalog
- `GET /api/catalog/products` - List products
- `GET /api/catalog/categories` - List categories
- `GET /api/catalog/price-lists` - List price lists

### Billing
- `POST /api/billing/orders` - Create order
- `POST /api/billing/invoices` - Create invoice
- `POST /api/billing/invoices/{id}/payments` - Record payment
- `POST /api/billing/subscriptions` - Create subscription

---

## Error Handling

All API errors are caught and displayed using your existing error utilities:

```javascript
// In components:
if (error) {
  return <div className="alert alert-error">{error}</div>
}

// The error message is extracted from backend response:
// - error.data.detail (string or object with message)
// - error.data.detail[].msg (validation errors)
// - Falls back to error.message or generic message
```

**401 Errors:** Automatically handled by apiClient.js with token refresh
**403 Errors:** User sees "Permission denied" message
**404 Errors:** "Resource not found" message

---

## Next Steps to Complete the System

1. **Create Quotation Detail Page**
   - Show complete quote breakdown
   - Display approval chain with timestamps
   - Show line-item costs & margins

2. **Create/Edit Quotation Forms**
   - Customer selection dropdown
   - Product selection & line item form
   - Discount percentage input
   - Real-time total calculation

3. **Approval Action Modal**
   - Approve button with confirmation
   - Reject with required reason
   - Return for revision with feedback

4. **Invoice & Order Pages**
   - Create order from approved quote
   - Invoice list/detail view
   - Payment recording form
   - Subscription management

5. **Customer Portal** (requires backend APIs)
   - View quotations assigned to customer
   - Line modification requests
   - Discount negotiation (if backend supports)
   - Confirmation workflow

6. **Reports & Analytics**
   - Pipeline health
   - At-risk deals report
   - Approval cycle time metrics
   - Revenue forecasting

---

## File Structure

```
Frontend/src/
├── features/
│   ├── quotations/
│   │   ├── quotations.api.js        ✅ Implemented
│   │   ├── quotations.hooks.js      ✅ Implemented
│   │   ├── pages/
│   │   │   ├── QuotationList.jsx    ⏳ TODO
│   │   │   ├── QuotationDetail.jsx  ⏳ TODO
│   │   │   └── CreateQuotation.jsx  ⏳ TODO
│   │   └── components/
│   │       ├── QuoteLineForm.jsx    ⏳ TODO
│   │       ├── ApprovalChain.jsx    ⏳ TODO
│   │       └── RiskScore.jsx        ⏳ TODO
│   │
│   ├── dashboard/
│   │   ├── pages/
│   │   │   └── DashboardPage.jsx    ✅ Implemented
│   │   └── components/
│   │       ├── SalesRepDashboard.jsx           ✅ Implemented
│   │       ├── SalesManagerDashboard.jsx      ✅ Implemented
│   │       ├── FinanceDashboard.jsx           ✅ Implemented
│   │       ├── DashboardStyles.css            ✅ Implemented
│   │       ├── SalesRepDashboard.css          ✅ Implemented
│   │       ├── SalesManagerDashboard.css      ✅ Implemented
│   │       └── FinanceDashboard.css           ✅ Implemented
│   │
│   ├── customers/
│   │   └── customers.api.js         ✅ Implemented
│   │
│   ├── products/
│   │   └── products.api.js          ✅ Implemented
│   │
│   └── approvals/
│       └── approvals.api.js         ✅ (in quotations.api.js)
│
└── services/api/
    ├── apiClient.js     (existing - handles auth & refresh)
    ├── apiError.js      (existing - error handling)
    └── apiConfig.js     (existing - base URL config)
```

---

## Summary

Your role-based dashboard system is now **ready for core testing**. Each role sees their relevant dashboard, connected to real backend APIs with proper authentication. The system follows your existing patterns for state management, error handling, and API integration.

**Next priority:** Create the detail views and forms to complete the quotation workflow end-to-end.
