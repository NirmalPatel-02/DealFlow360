# Quick Start: Testing the Role-Based Dashboards

## Prerequisites Checklist

- [ ] Backend running on `http://localhost:8000`
- [ ] Frontend running on `http://localhost:5173` (or your dev port)
- [ ] Backend has sample data (customers, products, users)
- [ ] You can log in with different user roles

## Quick Test (5 minutes)

### Step 1: Verify Dashboards Load
```
1. Login as sales_rep
2. Go to /dashboard
3. Should see: "Sales Representative Dashboard" with stats grid
4. Should see: "New Quotation" button
5. Should see: Tabs (All, Draft, Pending Approval, etc.)
```

✅ If you see the above, basic routing is working!

---

### Step 2: Test Sales Manager Dashboard
```
1. Logout
2. Login as sales_manager
3. Go to /dashboard
4. Should see: "Sales Manager Dashboard"
5. Should see: Different stats (Pending Review, Approved by Me, etc.)
6. Should see: "Pending Review" tab (may be empty if no quotes to approve)
```

✅ If both dashboards load correctly, role-based routing works!

---

### Step 3: Test Finance Dashboard
```
1. Logout
2. Login as finance (or operations if backend has this user)
3. Go to /dashboard
4. Should see: "Finance & Operations Dashboard"
5. Should see: Finance-specific tabs and stats
```

✅ If all 3 dashboards load, frontend is correctly implemented!

---

## Full Integration Test (15 minutes)

### Setup: Create a New Quotation

1. **Login as sales_rep**
2. **Navigate to /dashboard**
3. **Click "New Quotation" button**
   - Expected: Should navigate to create form (or error if form not implemented yet)
   - If error: That's expected, forms are todo
   
4. **Alternative: Test via API**
   ```bash
   curl -X POST http://localhost:8000/api/quotations \
     -H "Authorization: Bearer {access_token}" \
     -H "Content-Type: application/json" \
     -d '{
       "customer_id": "uuid-of-customer",
       "notes": "Test quotation"
     }'
   ```
   This should return a quote with status='DRAFT'

5. **Back in dashboard, refresh**
   - Should see new quotation in the table with status "Draft"

---

### Test Quotation List Filtering

1. **In Sales Rep Dashboard, go to "Draft" tab**
   - Should show only quotes with status=DRAFT

2. **Go to "Pending Approval" tab**
   - Should show only quotes with status=PENDING_APPROVAL
   - If none exist, should show empty state

3. **Go to "All" tab**
   - Should show all your quotations across all statuses

✅ If filtering works, API calls are correct!

---

### Test Error Handling

1. **Try accessing /dashboard while logged out**
   - Should redirect to /login (ProtectedRoute guard working)

2. **Try accessing a non-existent quotation**
   - Should show error message

3. **Manually modify URL to access quota with wrong ID**
   - Should show 404 error

✅ If errors display correctly, error handling works!

---

## Browser DevTools Debugging

### Check Network Requests
1. Open DevTools → Network tab
2. Go to /dashboard
3. Look for:
   - `POST /api/v1/auth/refresh` (token refresh)
   - `POST /api/v1/auth/me` (get current user)
   - `GET /quotations` (list quotations)

All should have:
- Status: 200 (success)
- Authorization header with Bearer token

### Check Console Errors
- Should show no 401/403 errors
- Any API errors should be caught and displayed in UI

### Check Redux/State (if using)
- Or in our case, React hooks state:
  - `quotations` array should be populated
  - `loading` should be false after fetch
  - `error` should be null on success

---

## Test Results Checklist

| Test | Expected | Status |
|------|----------|--------|
| Sales Rep dashboard loads | See "Sales Representative Dashboard" | [ ] |
| Manager dashboard loads | See "Sales Manager Dashboard" | [ ] |
| Finance dashboard loads | See "Finance & Operations Dashboard" | [ ] |
| Tab filtering works | Quotations filter by status | [ ] |
| Empty state shows | When no quotes in selected status | [ ] |
| Error message shows | When API fails | [ ] |
| Stats update | Numbers match quotation count | [ ] |
| Links work | Click on quotation (goes to detail page) | [ ] |
| Logout works | Can logout and return to login | [ ] |
| Token refresh works | Long session without 401 errors | [ ] |

---

## Known Issues (Expected for MVP)

### 🚫 Not Yet Implemented
- [ ] Quotation detail page
- [ ] Create/edit quotation form
- [ ] Discount entry interface
- [ ] Approval action buttons (Approve/Reject/Return)
- [ ] Customer portal
- [ ] Invoice/order pages

### ✅ Working
- [x] Dashboard routing by role
- [x] Quotation list API integration
- [x] Status filtering
- [x] Error handling
- [x] Loading states
- [x] Authentication with token refresh

---

## Next: Implementing Detail Pages

When you're ready to build the detail view:

1. Create `/src/features/quotations/pages/QuotationDetail.jsx`
   - Fetch quote with `useQuotationDetail(quoteId)`
   - Display approval chain
   - Show line items and totals
   - Add action buttons

2. Add route to `/src/app/routes.jsx`
   ```javascript
   {
     path: '/quotations/:quoteId',
     element: <QuotationDetail />
   }
   ```

3. Update dashboard links to navigate to detail page

---

## Troubleshooting

### Quotations not showing in dashboard
1. Check backend has quotations in DB: `SELECT * FROM quotations;`
2. Check API response: Open DevTools → Network → look for GET /quotations
3. Verify filter matching quote statuses
4. Check browser console for errors

### "404 Not Found" errors
- Verify API routes match backend (should be `/quotations`, not `/api/quotations`)
- Check apiClient.js base URL config

### "403 Forbidden" errors
- Verify user role matches required role in backend
- Check `require_internal_user` dependency on backend

### Token not refreshing
- Check that refresh endpoint works: `POST /api/v1/auth/refresh`
- Verify refresh token cookie is being sent (credentials: 'include')
- Check that refresh token hasn't expired

---

## Success Criteria

✅ **Dashboard renders for each role**
- [ ] Sales Rep sees Sales Rep dashboard
- [ ] Manager sees Manager dashboard
- [ ] Finance sees Finance dashboard

✅ **Data loads from backend**
- [ ] Quotations list appears (if DB has data)
- [ ] Counts in stats match actual quotations
- [ ] Status filtering works correctly

✅ **Error handling works**
- [ ] 401 errors trigger token refresh
- [ ] API errors display as messages
- [ ] Unauthenticated access redirects to login

✅ **User experience**
- [ ] Loading spinner shows while fetching
- [ ] Empty state shown when no data
- [ ] Buttons/links navigate correctly

---

## Questions to Ask While Testing

1. **Does my dashboard match my role?**
   - Sales Rep sees quotation management focus
   - Manager sees approval management focus
   - Finance sees cost/fulfillment focus

2. **Are all the numbers correct?**
   - Count in stat cards matches data in table
   - Margin % looks reasonable (should be >0%)
   - Risk scores in 0-100 range

3. **Can I navigate easily?**
   - Tabs switch views smoothly
   - Links to quotations work
   - Can return to dashboard

4. **Are errors handled gracefully?**
   - No blank screens on error
   - Error messages are helpful
   - Can retry after failure

---

## Success! 🎉

If you see all dashboards loading with data, you've successfully implemented:

✅ Role-based routing
✅ API layer with authentication
✅ React hooks for state management
✅ Error handling & loading states
✅ Responsive UI design
✅ Real backend integration

**Next step:** Build quotation detail page and forms to complete the workflow!
