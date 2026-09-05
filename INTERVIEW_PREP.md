# Interview Preparation: Role-Based Dashboard Deep Dive

## Pre-Interview Checklist

- [ ] Run both backend and frontend locally
- [ ] Test creating a quotation
- [ ] Test different role dashboards
- [ ] Review the mapping document (ROLE_API_MAPPING.md)
- [ ] Know the complete approval flow
- [ ] Understand error handling strategy

---

## Expected Questions & Prepared Answers

### 1. "Walk me through the complete quotation workflow"

**Answer:**

"Sure. The process flows through 3-4 roles and multiple approval stages.

**Sales Rep Phase:**
A sales rep logs in, sees their dashboard with quotations filtered by status. They click 'New Quotation', select a customer, and add product lines with quantities. The backend calculates the subtotal, discount amounts, and gross margin.

Before submitting, they can click 'Evaluate' to see if their discounts violate any approval policies. This returns a risk score and any violations. Then they click 'Submit for Approval' which changes the quote status from DRAFT to PENDING_APPROVAL and creates approval chain entries.

**Manager Approval Phase:**
The sales manager sees the quote in their dashboard's 'Pending Review' tab. They review the quote details, see the risk score (0-100%), and any discount violations. They have three options:
1. Approve - moves to APPROVED if no finance approval needed, or to finance queue if needed
2. Reject - status becomes REJECTED, quote is rejected
3. Return - status becomes REVISION_REQUIRED, sent back to rep to fix

**Finance Approval Phase (if needed):**
If the quote requires finance-level approval (higher discount % or other thresholds), the finance person sees it in their 'Finance Pending' tab. They review the total cost, margin, and compliance. They can approve, reject, or return, just like the manager.

**Fulfillment Phase:**
Once fully approved, the finance team creates an Order from the quote. This tracks fulfillment of items (some might be backordered). An Invoice is generated for billing, payment is recorded, and for recurring items, a subscription is set up.

The entire flow is tracked with real-time status updates, and each role only sees what's relevant to them."

---

### 2. "How did you implement the role-based access?"

**Answer:**

"I used component-level routing combined with backend role validation.

On the frontend:
- The DashboardPage checks the user's role from the AuthContext
- Based on role, it renders the appropriate dashboard component:
  - sales_rep → SalesRepDashboard
  - sales_manager → SalesManagerDashboard  
  - finance → FinanceDashboard
  - customer → CustomerDashboard (placeholder)

Each dashboard fetches quotations and displays role-specific views. The Sales Rep dashboard shows quotation management features, the Manager dashboard shows approval-focused data with risk scores, and the Finance dashboard focuses on cost analysis and fulfillment.

On the backend side, each API endpoint has a `require_roles()` dependency that checks the user's role from their JWT token. If they don't have permission, it returns a 403 Forbidden.

For example, `/api/approvals` endpoints check if the user is a sales_manager or finance before allowing approval actions.

The key is: frontend routes for UX, backend validates for security. Frontend routing is nice-to-have, backend validation is required."

---

### 3. "How does the approval chain work in your implementation?"

**Answer:**

"Each quotation has an approval_chain array, which is a list of approval records. Each approval has:
- approval_level: 'MANAGER' or 'MANAGER_FINANCE'
- step_order: 1, 2, 3... (the sequence)
- status: 'PENDING', 'APPROVED', 'REJECTED', or 'RETURNED'
- acted_by_user_id: who approved/rejected
- acted_at: timestamp
- reason: optional text for reject/return

When a sales rep submits a quote, I call `/api/approvals/quotes/{id}/submit`. The backend:
1. Evaluates the quote (risk score, discount violations)
2. Determines which approval levels are needed based on risk
3. Creates approval_chain entries for each level, initially PENDING
4. Sets quote status to PENDING_APPROVAL

As each role acts on their approval level, they call `/api/approvals/{approval_id}` with action 'approve', 'reject', or 'return'.

The backend processes this sequentially - approval[0] (manager) must be approved before approval[1] (finance) can act. Once all approvals are complete, the quote status changes to APPROVED.

If anyone returns it, the status goes to REVISION_REQUIRED and the sales rep can resubmit, incrementing the approval_version.

On the frontend, I display the approval chain as a timeline or checklist so the user can see exactly where in the approval process their quote is."

---

### 4. "How does authentication work across your dashboards?"

**Answer:**

"All API calls go through a centralized `apiClient.js` that handles authentication.

When the user logs in, they get an access token (short-lived, in memory) and a refresh token (longer-lived, in HTTP-only cookie).

On every authenticated API call, I attach the Bearer token:
```javascript
headers: {
  Authorization: `Bearer ${accessToken}`
}
```

If the token expires and I get a 401, the apiClient automatically:
1. Calls `/api/v1/auth/refresh` (refresh token sent in cookie automatically)
2. Stores the new access token
3. Retries the original request

This is all transparent to the component. The component just calls the API, and if there's a 401, it's handled automatically.

For invalid tokens or if refresh fails, I catch the error and redirect to login.

The key security aspect is:
- Access token in memory (can't be stolen via XSS because it's not in localStorage)
- Refresh token in HTTP-only cookie (can't be accessed by JavaScript at all)
- CSRF protection via same-origin policy
- Secure flag on cookies (HTTPS only)

Each dashboard fetches authenticated data using `useQuotations()` hook, which automatically includes auth and handles 401s."

---

### 5. "What happens if an API call fails? How do you handle errors?"

**Answer:**

"I have a multi-layer error handling strategy.

**Layer 1: API Response Layer**
In `apiClient.js`, if the response status is not ok, I throw an `ApiError` with:
- status code (401, 403, 404, 500, etc.)
- error data from response
- user-friendly message

**Layer 2: Hook Layer**
Each custom hook (useQuotations, useApprovalAction, etc.) catches these errors and:
- Extracts a user-friendly message using `getErrorMessage(error)`
- Stores error in state
- Sets loading to false
- Returns error in hook return value

**Layer 3: Component Layer**
The component checks:
```javascript
if (error) {
  return <div className="alert alert-error">{error}</div>
}
```

**Layer 4: Specific Error Types**

For 401: Automatic token refresh (handles it without showing error)

For 403: Shows 'Permission denied' message

For 404: Shows 'Resource not found' with retry button

For 500: Shows 'Server error, please try again later'

For validation errors: Extracts validation messages and shows them

The key is: every error is caught somewhere, users never see a blank screen, and they always get a helpful message and a way to retry."

---

### 6. "How do you manage state in your dashboards? Redux? Zustand?"

**Answer:**

"Neither. I used React Hooks with the existing React Context for auth.

**Why not Redux/Zustand?**
- We only have 3 dashboards, each is independent
- No complex shared state between unrelated components
- No time-travel debugging needed for this MVP
- Simpler stack = fewer dependencies = easier to maintain

**My approach:**
Each dashboard has its own local state via hooks:
```javascript
const { quotations, loading, error } = useQuotations(filters);
```

This hook:
- Fetches on mount via useEffect
- Manages loading and error states
- Provides refetch function
- Filters happen in memory in React

For more complex workflows (like adding a line, then evaluating, then submitting), I use multiple hooks:
```javascript
const { quotation } = useQuotationDetail(id);
const { addLine, loading } = useQuotationLines(id);
const { evaluate, submit } = useQuoteSubmission(id);
```

Each hook manages its own state independently. The component orchestrates the workflow.

If the app grows and we need to share quotation state between multiple pages, I can either:
1. Add React Query for server-state caching
2. Move to Redux/Zustand
3. Use a custom context provider

But for now, this is the sweet spot between simplicity and functionality."

---

### 7. "What's the architecture of your API layer?"

**Answer:**

"I built a feature-based API layer with clear separation of concerns.

**Structure:**
```
features/quotations/
├── quotations.api.js     ← Low-level API functions
├── quotations.hooks.js   ← React hooks for state management
└── pages/components/     ← Components that use the hooks
```

**quotations.api.js contains:**
- All HTTP calls to backend
- Takes parameters, returns promises
- No state management
- Reusable across components

Example:
```javascript
export function submitQuoteForApproval(quoteId) {
  return apiRequest(`/approvals/quotes/${quoteId}/submit`, {
    method: 'POST',
    auth: true,
  });
}
```

**quotations.hooks.js contains:**
- React hooks wrapping the API functions
- Manages loading, error, data state
- Handles retries and side effects
- Component-friendly interface

Example:
```javascript
export function useQuoteSubmission(quoteId) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  const submit = useCallback(async () => {
    try {
      setSubmitting(true);
      return await submitQuoteForApproval(quoteId);
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [quoteId]);
  
  return { submit, submitting, error };
}
```

**Components call hooks:**
```javascript
const { submit, submitting, error } = useQuoteSubmission(quoteId);

if (error) return <Error>{error}</Error>;
if (submitting) return <Spinner />;

return <button onClick={submit}>Submit</button>;
```

**Why this structure?**
- Testable: Can test API functions independently
- Reusable: Multiple components can use same hook
- Maintainable: Clear separation of concerns
- Scalable: Easy to add caching, retry logic, etc.

All API calls go through the existing `apiClient.js`, which handles:
- Bearer token attachment
- 401 → token refresh
- Base URL config
- Credentials/cookies
- Response parsing"

---

### 8. "How do you handle the 401 Unauthorized flow?"

**Answer:**

"The token refresh happens transparently in the existing `apiClient.js`. Here's the flow:

1. **Initial Request**
   Component calls API with auth=true
   ```javascript
   apiRequest('/quotations', { method: 'GET', auth: true })
   ```

2. **API adds Bearer token**
   ```javascript
   headers: {
     Authorization: `Bearer ${accessToken}`
   }
   ```

3. **Response is 401**
   Token expired (it's short-lived, like 15 minutes)

4. **Automatic Refresh**
   ```javascript
   if (error.status === 401 && retry) {
     await refreshAccessToken();  // POST /auth/refresh
     return rawRequest(path, {...options, auth: true});  // Retry
   }
   ```

5. **Refresh endpoint**
   - Uses the refresh token from the HTTP-only cookie
   - Returns new access_token
   - Updates our in-memory token

6. **Retry Original Request**
   Now with new token, original request succeeds

7. **Component Never Knows**
   Component code just awaits the promise
   Doesn't know a refresh happened
   Doesn't need to handle token expiry

**Key Details:**
- Only retries on 401, not other errors
- Won't retry login/refresh endpoints (prevents infinite loops)
- Uses refreshPromise lock to ensure only 1 refresh happens (even if 10 requests fail simultaneously)
- Refresh token in secure HTTP-only cookie (backend sets this)

This is why users can have long sessions without getting kicked out unexpectedly."

---

### 9. "What are the biggest challenges you faced?"

**Answer:**

"The main challenges were:

**1. Backend API Mismatch**
The backend has some APIs partially implemented or missing features. For example:
- No dedicated customer portal endpoints (had to use sales rep endpoints)
- No quote negotiation workflow (no back-and-forth endpoints)
- No line-level comment/question system
- No quote confirmation endpoint (just status change)

**Solution:** I built what I could with existing APIs and documented the gaps in ROLE_API_MAPPING.md

**2. Different API Base URLs**
Some endpoints are at `/api/v1/auth`, others at `/api/quotations`, `/api/approvals`, etc. The base URL varies.

**Solution:** Handled this in the API layer by using the correct path for each endpoint. The apiClient.js handles the base URL config.

**3. Understanding Approval Chain**
The approval workflow is complex: 
- Multiple levels (MANAGER, MANAGER_FINANCE)
- Sequential approval
- Can be rejected or returned at any step
- Quota status changes based on approval status

**Solution:** Read the backend code thoroughly, created COMPLETE_WORKFLOW.md to map it all out

**4. Role-Based Filtering**
Not all quotations are relevant to all roles. A sales rep shouldn't see their manager's approvals.

**Solution:** Backend handles this via `require_internal_user` decorator and the list endpoint respects created_by_user_id. Frontend filters by status tabs.

**5. Error Message Consistency**
Backend returns errors in different formats:
```javascript
// Sometimes:
{ detail: 'string message' }
// Sometimes:
{ detail: { message: 'string' } }
// Sometimes:
{ detail: [{ loc: [...], msg: 'string' }] }
```

**Solution:** Created getErrorMessage() utility that handles all these cases

**Overall:** The biggest challenge was understanding the complex business logic, not the technical implementation."

---

### 10. "How would you test this dashboard?"

**Answer:**

"I created comprehensive testing documentation in QUICK_TEST_GUIDE.md. Here's my approach:

**Unit Testing (Frontend Components)**
```javascript
// Test hook
const { quotations, loading } = renderHook(() => useQuotations());
expect(loading).toBe(true);
// Wait for load...
expect(quotations.length).toBeGreaterThan(0);
```

**Integration Testing (API + Component)**
```javascript
// Render dashboard
const { getByText } = render(<SalesRepDashboard />);
// Wait for data load
await waitFor(() => {
  expect(getByText('Total Quotations')).toBeInTheDocument();
});
// Verify data displayed
expect(getByText('Quote #12345')).toBeInTheDocument();
```

**Manual Testing (Full Workflow)**
1. Login as sales_rep
2. Create quotation
3. Add products and discounts
4. Submit for approval
5. Logout, login as sales_manager
6. Review and approve
7. Verify status changed

**Edge Cases**
- Login with expired token (should auto-refresh)
- Load dashboard with no data (should show empty state)
- Network error mid-request (should show error with retry)
- Permission denied (403) for unauthorized role
- Create quote but cancel before submit

**Success Criteria**
- All 3 dashboards load for their respective roles
- Data loads from backend
- Filtering works
- Error messages display
- Loading states show
- Buttons navigate correctly

**Testing Tools**
- Jest for unit tests
- React Testing Library for component tests
- Manual testing with real backend
- Browser DevTools Network tab to inspect requests"

---

### 11. "What would you do differently if you had more time?"

**Answer:**

"Several improvements I'd make:

**1. Add React Query**
Instead of manual loading/error states in hooks, use React Query for:
- Automatic caching
- Background refetching
- Pagination support
- Optimistic updates

**2. Detail Page Components**
Build out:
- QuotationDetail page (show full breakdown)
- Create/Edit Quotation form (product selection, line editor)
- Approval action modals (approve/reject/return)
- Invoice & Order pages

**3. Better Data Visualization**
- Timeline component for approval chain
- Risk score gauge/chart
- Margin breakdown pie chart
- Pipeline health dashboard

**4. Offline Support**
- Service Worker for offline access
- Sync approval actions when back online
- Cache quotation list

**5. Performance Optimization**
- Pagination (load 20 quotes, not all)
- Lazy load details
- Virtual scrolling for large tables
- Memoization of components

**6. More Comprehensive Testing**
- Unit tests for hooks
- Component integration tests
- E2E tests with Cypress/Playwright
- Load testing

**7. Analytics & Logging**
- Track approval cycle time
- Log all approval actions for audit
- Metrics on at-risk deals
- User behavior tracking

**8. Mobile App**
- React Native version
- Push notifications for approvals
- Mobile-optimized forms

But for MVP, the current implementation covers the core workflow."

---

### 12. "How does this scale as the company grows?"

**Answer:**

"The architecture is designed to scale:

**At 100 users:**
Current state management in React hooks works fine.

**At 1,000 users:**
Add React Query for caching to reduce API calls.
Implement backend pagination (load 20 quotes per page).

**At 10,000 users:**
Add a global state management layer (Redux/Zustand) if needed.
Implement server-side filtering/sorting.
Add database indexing on status, created_by_user_id.
Consider caching layer (Redis).

**For real-time updates:**
Add WebSocket support for live approval notifications.
Use Socket.io or GraphQL subscriptions.

**For analytics:**
Separate OLAP database for reporting.
Background jobs for metric calculation.

**For mobile:**
Separate React Native app sharing the same API.

**Architecture handles this because:**
- All business logic in backend (API can be versioned)
- Frontend API layer is abstracted (can swap implementations)
- Component state is localized (easy to refactor)
- Authentication is centralized (scales to enterprise)
- No hardcoded data or IDs (all from backend)

The core design principle: **Backend is the source of truth**, frontend is just a view layer.
This lets us scale backend independently from frontend."

---

## Quick Facts to Remember

- **Dashboards:** 3 implemented (Sales Rep, Manager, Finance)
- **API Functions:** 18 quotation/approval functions
- **Custom Hooks:** 6 hooks for state management
- **Backend Endpoints Used:** 13 endpoints
- **Authentication:** Bearer token + HTTP-only refresh cookie
- **Error Handling:** 4-layer approach (API, hook, component, global)
- **Role-Based:** Component routing + backend validation
- **Approval Levels:** 2 (MANAGER, MANAGER_FINANCE)
- **Quote Statuses:** 9 statuses with clear transitions
- **Data Flow:** Component → Hook → API → Backend → Response

---

## Conversation Enders (Smart Closes)

### If asked "Any questions for us?"
"Yes, a few:
1. How do you currently handle real-time notifications for approval updates?
2. What's your roadmap for mobile access to this system?
3. How do you manage audit trails for financial approvals?
4. What testing framework do you prefer (Jest, Cypress, etc.)?
5. How do you handle high-volume approval workflows?"

### If asked "What's your biggest accomplishment here?"
"Building a complete role-based workflow that bridges design, backend, and frontend. The challenge wasn't just implementing features, but understanding the complex business logic of multi-stage approvals, discount governance, and financial compliance—then translating that into clean, user-friendly interfaces for each role."

### If asked "Where do you see this going?"
"The immediate next steps are detail pages and forms to complete the quotation workflow. Then adding real-time notifications for approvals. Long-term, I see this becoming an AI-powered deal assistant that auto-flags at-risk deals, recommends discount strategies, and predicts close dates."

---

## Remember for the Interview

✅ **Be specific:** Reference actual code, file names, and line numbers
✅ **Show ownership:** "I decided...", "I solved...", not "we did..."
✅ **Explain tradeoffs:** Why this approach over alternatives
✅ **Acknowledge limitations:** "That needs...", "I'd improve..."
✅ **Show learning:** What did you learn about business logic, APIs, etc.
✅ **Be honest:** If you don't know something, say so
✅ **Ask questions:** Shows genuine interest in the role

Good luck! 🚀
