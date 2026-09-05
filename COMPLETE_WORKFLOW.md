# Complete Workflow: Sales Rep → Approval → Finance → Fulfillment

## End-to-End Process

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   SALES REP PHASE                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  1. LOGIN as sales_rep                                                              │
│     └─ Dashboard shows: DRAFT, PENDING_APPROVAL, APPROVED, SENT, NEGOTIATING        │
│                                                                                     │
│  2. CREATE QUOTATION                                                                │
│     └─ POST /api/quotations                                                        │
│        └─ Returns: quote_id, status='DRAFT'                                        │
│        └─ Redirects to: /quotations/{quote_id}/edit                                │
│                                                                                     │
│  3. ADD QUOTE LINES (Products)                                                     │
│     └─ POST /api/quotations/{quote_id}/lines                                       │
│        └─ Body: { product_id, quantity, discount_percent }                         │
│        └─ Backend calculates: subtotal, discount_amount, line_subtotal             │
│        └─ Also calculates: gross_margin at quotation level                         │
│                                                                                     │
│  4. APPLY DISCOUNT                                                                 │
│     └─ PATCH /api/quotations/{quote_id}/lines/{line_id}                            │
│        └─ Update: discount_percent field                                           │
│        └─ Backend recalculates totals & margin                                     │
│                                                                                     │
│  5. EVALUATE QUOTE (Optional but Recommended)                                      │
│     └─ POST /api/approvals/quotes/{quote_id}/evaluate                              │
│        └─ Returns:                                                                 │
│           ├─ risk_score: 0-100                                                    │
│           ├─ violations: [] (discount exceeds policy)                              │
│           ├─ highest_approval_level: 'MANAGER' or 'MANAGER_FINANCE'                │
│           └─ requires_approval: boolean                                            │
│                                                                                     │
│  6. SUBMIT FOR APPROVAL                                                            │
│     └─ POST /api/approvals/quotes/{quote_id}/submit                                │
│        └─ Status changes: DRAFT → PENDING_APPROVAL                                 │
│        └─ Creates approval_chain entries:                                          │
│           ├─ Step 1: MANAGER level (approval_level='manager')                      │
│           ├─ Step 2: MANAGER_FINANCE level (if needs_finance_approval)             │
│           └─ Both initially status='PENDING'                                       │
│        └─ Returns: quote_id, status, approval_version, risk_score                  │
│                                                                                     │
│  7. QUOTE AWAITS MANAGER APPROVAL                                                  │
│     └─ Status: PENDING_APPROVAL                                                    │
│     └─ Sales Rep can view approval status in dashboard                             │
│     └─ Tab: "Pending Approval" shows quotes waiting                                │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                          ↓
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           SALES MANAGER APPROVAL PHASE                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  1. LOGIN as sales_manager                                                          │
│     └─ Dashboard shows: "Pending My Review" tab with quotes needing approval        │
│                                                                                     │
│  2. REVIEW QUOTE                                                                   │
│     └─ GET /api/quotations/{quote_id}                                              │
│        └─ Shows: lines, totals, risk_score, gross_margin                           │
│     └─ Sees approval_chain[0]: status='PENDING', approval_level='MANAGER'          │
│        └─ Also sees violations if discount exceeded policy                         │
│                                                                                     │
│  3. DECISION OPTIONS                                                               │
│     │                                                                              │
│     ├─ OPTION A: APPROVE (if no finance approval needed)                           │
│     │  └─ POST /api/approvals/{approval_id}                                        │
│     │     └─ Body: { action: 'approve', reason?: null }                            │
│     │     └─ If no MANAGER_FINANCE step needed:                                    │
│     │        ├─ Status changes: PENDING_APPROVAL → APPROVED                        │
│     │        └─ Quote ready for fulfillment                                        │
│     │     └─ If MANAGER_FINANCE step needed:                                       │
│     │        ├─ This approval marked: status='APPROVED'                            │
│     │        ├─ Moves to: approval_chain[1] (MANAGER_FINANCE pending)              │
│     │        └─ Quote status stays: PENDING_APPROVAL                               │
│     │                                                                              │
│     ├─ OPTION B: REJECT                                                            │
│     │  └─ POST /api/approvals/{approval_id}                                        │
│     │     └─ Body: { action: 'reject', reason: 'margin too low' }                  │
│     │     └─ Quote status: PENDING_APPROVAL → REJECTED                             │
│     │     └─ Sales Rep sees: "Rejected by Manager" in dashboard                    │
│     │     └─ Can create new quote or modify this one                               │
│     │                                                                              │
│     └─ OPTION C: RETURN FOR REVISION                                               │
│        └─ POST /api/approvals/{approval_id}                                        │
│           └─ Body: { action: 'return', reason: 'Please reduce discount %' }        │
│           └─ Status: PENDING_APPROVAL → REVISION_REQUIRED                          │
│           └─ Sales Rep sees: "Revision Required" in dashboard                      │
│           └─ Sales Rep can: Update lines, resubmit                                 │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                          ↓
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                      FINANCE/OPERATIONS APPROVAL PHASE                              │
│                              (If Applicable)                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  1. LOGIN as finance or operations                                                  │
│     └─ Dashboard shows: "Finance Pending" (quotes awaiting MANAGER_FINANCE approval)│
│                                                                                     │
│  2. REVIEW QUOTE FOR FINANCIAL VIABILITY                                           │
│     └─ GET /api/quotations/{quote_id}                                              │
│        └─ Reviews: total_cost, grand_total, gross_margin, risk_score               │
│     └─ Verifies: Cost calculation, margin thresholds, compliance                   │
│                                                                                     │
│  3. APPROVAL/REJECTION                                                             │
│     │                                                                              │
│     ├─ APPROVE                                                                     │
│     │  └─ POST /api/approvals/{approval_id}                                        │
│     │     └─ Body: { action: 'approve' }                                           │
│     │     └─ Quote status: PENDING_APPROVAL → APPROVED                             │
│     │     └─ Quote is now: Ready for fulfillment & invoicing                       │
│     │                                                                              │
│     ├─ REJECT                                                                      │
│     │  └─ POST /api/approvals/{approval_id}                                        │
│     │     └─ Quote status: PENDING_APPROVAL → REJECTED                             │
│     │                                                                              │
│     └─ RETURN                                                                      │
│        └─ POST /api/approvals/{approval_id}                                        │
│           └─ Quote status: PENDING_APPROVAL → REVISION_REQUIRED                    │
│           └─ Goes back to Sales Manager or Sales Rep for fixes                     │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                          ↓
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                       FULFILLMENT & BILLING PHASE                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  1. QUOTE STATUS: APPROVED                                                         │
│     └─ Quote is ready for fulfillment                                              │
│     └─ Finance/Operations sees: "Ready for Fulfillment" tab                        │
│                                                                                     │
│  2. CREATE ORDER FROM QUOTE                                                        │
│     └─ POST /api/billing/orders                                                    │
│        └─ Body: { quotation_id, ... }                                              │
│        └─ Creates order with order_number, line items, totals                      │
│                                                                                     │
│  3. HANDLE FULFILLMENT SPLITS (if needed)                                          │
│     └─ Some items in stock → ship immediately                                      │
│     └─ Some items out of stock → backorder                                         │
│     └─ Partial shipments tracked                                                   │
│                                                                                     │
│  4. GENERATE INVOICE                                                               │
│     └─ POST /api/billing/invoices                                                  │
│        └─ Body: { order_id, invoice_type: 'INVOICE' }                              │
│        └─ Invoice ready for customer                                               │
│        └─ Status: PENDING (awaiting payment)                                       │
│                                                                                     │
│  5. SET UP RECURRING BILLING (for subscription lines)                              │
│     └─ POST /api/billing/subscriptions                                             │
│        └─ Body: { order_id, product_id, billing_interval: 'MONTHLY' }              │
│        └─ Generates recurring invoices based on interval                           │
│                                                                                     │
│  6. RECORD PAYMENT                                                                 │
│     └─ POST /api/billing/invoices/{invoice_id}/payments                            │
│        └─ Body: { amount, payment_method: 'card' }                                 │
│        └─ Invoice status: PENDING → PAID                                           │
│                                                                                     │
│  7. CREDIT NOTES & REFUNDS (if applicable)                                         │
│     └─ POST /api/billing/refunds                                                   │
│        └─ Create credit note for returns/adjustments                               │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Quote Status Lifecycle

```
DRAFT
  ↓ (Sales Rep submits)
PENDING_APPROVAL
  ├─ Manager approves & no Finance needed → APPROVED
  ├─ Manager approves & Finance needed → PENDING_APPROVAL (awaits Finance)
  ├─ Manager rejects → REJECTED
  ├─ Manager returns → REVISION_REQUIRED
  │
  └─ Finance approves → APPROVED
     ├─ Finance rejects → REJECTED
     └─ Finance returns → REVISION_REQUIRED

APPROVED (Quote is now valid)
  ├─ Sales Rep sends to customer → SENT
  ├─ Customer requests changes → UNDER_NEGOTIATION
  ├─ Customer confirms → CONFIRMED
  └─ Cancelled before sending → CANCELLED

CONFIRMED → Ready for fulfillment, invoicing
  ↓
ORDER CREATED → FULFILLMENT
  ↓
INVOICE CREATED → BILLING
  ↓
PAYMENT RECORDED → COMPLETE
```

---

## Key Dashboard Views

### Sales Rep Dashboard
- Lists all quotations by status
- Shows: Quote #, Customer, Amount, Margin %, Status, Created Date
- Quick actions: New, View, Edit (for DRAFT)
- Stats: Total, Draft, Pending, Approved, Sent, Negotiating

### Sales Manager Dashboard
- Lists quotes pending manager approval
- Shows: Quote #, Rep, Customer, Total, Risk %, Status, Submitted Date
- Risk scoring: Color-coded by risk level (>50% = high risk)
- Quick actions: Review, Approve (if manager can approve)
- Stats: Pending, Approved by me, Rejected by me, At-risk

### Finance Dashboard
- Lists quotes pending finance approval
- Shows: Quote #, Customer, Total Amount, Cost, Margin %
- Cost analysis: Highlights margin concerns
- Quick actions: Review, Approve, Create Order (for fulfillment)
- Stats: Finance Pending, Finance Approved, Ready for Fulfillment

---

## Testing the Complete Flow

### Setup
```bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload

# Terminal 2: Frontend
cd Frontend
npm run dev
```

### Test Scenario

1. **Create Test Customers & Products**
   - Use backend admin or API calls to set up sample data
   - Or use existing data from database

2. **Login as Sales Rep**
   - Create a quotation
   - Add 2-3 product lines with quantities
   - Apply 10% discount to one line
   - Click "Evaluate" to see risk score
   - Click "Submit for Approval"

3. **Login as Sales Manager**
   - Go to Dashboard → "Pending Review" tab
   - Click the quote
   - See risk score and discount violations
   - Click "Approve"

4. **Verify Quote Status Changed**
   - Backend database: quotation.status = 'APPROVED' (if no Finance level)
   - Or: PENDING_APPROVAL (if Finance approval still pending)

5. **If Finance Approval Needed:**
   - Login as finance role
   - See quote in "Finance Pending" tab
   - Review costs and margin
   - Click "Approve"

6. **Fulfillment Phase**
   - Quote is now APPROVED
   - Finance creates Order from quote
   - Order generates Invoice
   - Payment recorded

---

## Common Issues & Debugging

### Issue: "401 Unauthorized" when loading dashboard
**Solution:** Check that access token is being sent correctly
```javascript
// In apiClient.js, verify:
headers: {
  ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
}
```

### Issue: Quotations list is empty
**Solution:** Check backend data and filter
```javascript
// Try loading all statuses:
listQuotations({})  // No filters

// Or list specific status:
listQuotations({ status: 'DRAFT' })
```

### Issue: "403 Forbidden" on approve action
**Solution:** Verify user role has permission
- Sales Manager must have role='sales_manager'
- Finance must have role='finance' or role='operations'

### Issue: Risk score not showing
**Solution:** Must call `evaluateQuote()` first
```javascript
// Risk score is populated by:
POST /api/approvals/quotes/{id}/evaluate
```

---

## Summary

Your system now supports the **complete sales workflow**:

✅ Sales Rep → Create & submit quotations
✅ Manager → First-level approvals
✅ Finance → Second-level approvals & cost review
✅ Fulfillment → Orders, invoices, payments
✅ Status tracking throughout

All connected to real backend APIs with proper authentication, error handling, and role-based access control.
