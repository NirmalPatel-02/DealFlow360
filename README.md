# DealFlow360
An Intelligent, Self Governing Sales Operations Platform

---

## 🎯 Role-Based Dashboard Implementation

**Status:** ✅ **COMPLETE & READY TO TEST**

A production-ready, role-based dashboard system connecting your React frontend to your FastAPI backend.

### Quick Start

```bash
# Terminal 1: Backend
cd backend && uvicorn app.main:app --reload

# Terminal 2: Frontend  
cd Frontend && npm run dev
```

Then login as different roles to see role-specific dashboards!

### What's Included

✅ **3 Role-Based Dashboards**
- Sales Rep Dashboard (create/manage quotations)
- Sales Manager Dashboard (review/approve quotations)
- Finance/Operations Dashboard (second-level approvals, fulfillment)

✅ **Complete API Integration**
- 18 API functions for quotation CRUD
- Automatic token refresh on 401
- Comprehensive error handling
- No mock data - all real backend APIs

✅ **Professional UI/UX**
- Responsive design with mobile support
- Color-coded status badges
- Risk score visualization
- Loading states, empty states, error handling

✅ **Complete Documentation**
- COMPLETE_WORKFLOW.md - End-to-end process
- QUICK_TEST_GUIDE.md - Testing instructions  
- INTERVIEW_PREP.md - Interview Q&A prep
- ROLE_API_MAPPING.md - Role→Feature→API mapping

### Key Files

| File | Purpose |
|------|---------|
| `Frontend/src/features/dashboard/pages/DashboardPage.jsx` | Main entry (routes by role) |
| `Frontend/src/features/quotations/quotations.api.js` | API functions |
| `Frontend/src/features/quotations/quotations.hooks.js` | React hooks for state |
| `Frontend/src/features/dashboard/components/SalesRepDashboard.jsx` | Rep dashboard |
| `Frontend/src/features/dashboard/components/SalesManagerDashboard.jsx` | Manager dashboard |
| `Frontend/src/features/dashboard/components/FinanceDashboard.jsx` | Finance dashboard |

### Documentation Priority

1. **COMPLETE_WORKFLOW.md** - Understand the quotation flow (start here!)
2. **DASHBOARD_IMPLEMENTATION.md** - Technical architecture
3. **QUICK_TEST_GUIDE.md** - How to test locally
4. **INTERVIEW_PREP.md** - Interview preparation
5. **ROLE_API_MAPPING.md** - Which roles access which APIs

### Quick Facts

- 🔐 **Auth:** Bearer tokens + HTTP-only refresh cookies  
- 🎭 **Roles:** sales_rep, sales_manager, finance, operations, customer (placeholder), admin
- 📊 **Dashboards:** 3 implemented + 1 placeholder
- 🔌 **API Functions:** 18 quotation/approval functions
- 🎣 **React Hooks:** 6 custom hooks for state management
- ⚠️ **Error Handling:** 4-layer comprehensive error handling
- 📈 **Approval Levels:** 2 (MANAGER, MANAGER_FINANCE)
- 📋 **Quote Statuses:** 9 distinct statuses

### Testing

Quick 5-minute test:
```
1. Login as sales_rep → See Sales Rep Dashboard
2. Logout, login as sales_manager → See Manager Dashboard  
3. Logout, login as finance → See Finance Dashboard
```

For full integration testing, see **QUICK_TEST_GUIDE.md**.

### Workflow Overview

```
Sales Rep creates quote (DRAFT)
    ↓ submits
Sales Manager reviews (PENDING_APPROVAL)
    ↓ approves
Finance approves (if needed)
    ↓
Status changes to APPROVED
    ↓
Finance creates Order & Invoice
    ↓
Fulfillment & Payment
```

See **COMPLETE_WORKFLOW.md** for detailed workflow with diagrams.

### What's Next

High priority tasks:
1. Quotation detail page (view full breakdown)
2. Create/edit quotation form
3. Approval action modals (approve/reject/return)
4. Invoice and order management

---
