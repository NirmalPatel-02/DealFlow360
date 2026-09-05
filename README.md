# DealFlow360
<<<<<<< Updated upstream
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
=======

**DealFlow360** is an intelligent sales-operations platform for B2B teams. It turns the quote-to-cash workflow into a governed deal engine: sales teams can build quotations, apply controlled discounts, route exceptional deals for approval, surface upsell and cross-sell opportunities, and manage one-time and subscription billing from one system.

The project was built for a hackathon brief focused on realistic B2B selling, where pricing rules, approval workflows, recurring revenue, and operational controls matter as much as creating a quote.

## What Is Implemented

### Identity and access

- User registration with email verification through one-time passwords (OTPs)
- Login, logout, JWT access tokens, refresh-token rotation, and secure HTTP-only refresh cookies
- Password reset and password-change flows
- Account lockout and OTP rate/cooldown controls configurable through environment variables
- Role-based access control for sales reps, sales managers, finance/operations, administrators, and customers

### Sales configuration

- Customer and contact management, including customer tiers
- Categories, products, variants, and price lists
- Customer-tier and category-based discount rules
- Configurable approval chains and discount bands
- Audit records for approval and billing activities

### Quotation and deal governance

- Draft quotation creation, updates, listing, and line-item management
- One-time and recurring quote lines
- Discount evaluation with blended deal-risk calculation
- Approval routing, submission, review actions, and approval history
- Support for approved, rejected, revision-required, sent, negotiation, confirmed, and cancelled quotation states

### Recommendations and billing

- Rule-based upsell and cross-sell recommendations with promotion support
- Accepting a recommendation directly into a quotation
- Orders, invoices, invoice items, payments, refunds, and credit notes
- Subscription plans, subscription creation and modification, cancellations, billing schedules, and recurring invoice generation
- Proration calculations for mid-cycle subscription changes

## Technology

| Area            | Choice                                         |
| --------------- | ---------------------------------------------- |
| API             | FastAPI                                        |
| Validation      | Pydantic v2                                    |
| Database access | SQLAlchemy 2 async ORM                         |
| Database driver | `asyncmy` (async MySQL/MariaDB)                |
| Migrations      | Alembic                                        |
| Authentication  | JWT, Argon2 password hashing, refresh sessions |
| Email           | Brevo API integration                          |
| Server          | Uvicorn                                        |
| Python          | 3.13 or newer                                  |

## Architecture

```text
Frontend
   |
   v
FastAPI routers
   |-- /api/v1/auth          Authentication and session lifecycle
   |-- /api/customers        Customers and contacts
   |-- /api/catalog          Products, variants, and price lists
   |-- /api/governance       Discount rules and approval configuration
   |-- /api/quotations       Quote and quote-line lifecycle
   |-- /api/approvals        Deal evaluation and approval actions
   |-- /api/recommendations  Upsell, cross-sell, and promotions
   `-- /api/*                Orders, invoices, payments, subscriptions
   |
   v
Service layer -> SQLAlchemy async sessions -> MySQL/MariaDB
```

The backend follows a clear separation of concerns:

- `app/api/` exposes HTTP endpoints and applies authorization.
- `app/schemas/` defines request and response contracts.
- `app/services/` contains business logic such as approval evaluation, quote calculations, recommendations, and billing proration.
- `app/models/` contains SQLAlchemy persistence models and enums.
- `alembic/` tracks schema migrations.

## User Roles

| Role                 | Main responsibilities                                                       |
| -------------------- | --------------------------------------------------------------------------- |
| Sales Rep            | Manages customers and builds quotations.                                    |
| Sales Manager        | Reviews eligible approval requests and governs sales decisions.             |
| Finance / Operations | Participates in higher-risk approvals and billing operations.               |
| Admin                | Configures catalog, pricing, governance, promotions, and platform settings. |
| Customer             | Reserved for customer-facing access and quotation workflows.                |

## Getting Started

### Prerequisites

- Python 3.13+
- MySQL or MariaDB
- A database created for DealFlow360

### 1. Configure the environment

From `backend`, create a `.env` file. Do not commit this file.

```env
APP_NAME=DealFlow360 API
ENVIRONMENT=development
DATABASE_URL=mysql+asyncmy://USER:PASSWORD@localhost:3306/dealflow360
SECRET_KEY=replace-with-a-random-secret-of-at-least-32-characters

FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
COOKIE_SECURE=false
COOKIE_SAMESITE=lax

# Optional: required when sending real emails through Brevo
BREVO_API_KEY=
BREVO_SENDER_NAME=DealFlow360
BREVO_SENDER_EMAIL=
```

The remaining settings have secure development defaults and can be overridden as needed: token lifetime, password length, OTP expiry, resend cooldown, maximum OTP attempts, and login lockout behavior.

### 2. Install dependencies

```bash
cd backend
python -m venv .venv
```

Activate the environment:

```powershell
# PowerShell
.\.venv\Scripts\Activate.ps1
```

```bash
# macOS/Linux
source .venv/bin/activate
```

Then install packages:

```bash
pip install -r requirements.txt
```

`uv` users can instead run `uv sync` from the `backend` directory.

### 3. Apply database migrations

```bash
alembic upgrade head
```

### 4. Run the API

```bash
uvicorn app.main:app --reload
```

The API is available at `http://127.0.0.1:8000`.

- Interactive API documentation: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- Health check: `GET http://127.0.0.1:8000/health`

## API Overview

All protected endpoints require an access token:

```http
Authorization: Bearer <access_token>
```

| Area            | Base path              | Capabilities                                                                                |
| --------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| Authentication  | `/api/v1/auth`         | Register, verify email, login, refresh, logout, profile, password recovery                  |
| Customers       | `/api/customers`       | Customer and contact CRUD, search, and deactivation                                         |
| Catalog         | `/api/catalog`         | Categories, products, variants, price lists, and price-list items                           |
| Governance      | `/api/governance`      | Approval chains, approval bands, discount rules, and discount evaluation                    |
| Quotations      | `/api/quotations`      | Quotations and quote-line CRUD                                                              |
| Approvals       | `/api/approvals`       | Quote evaluation, submission, current approval history, and reviewer actions                |
| Recommendations | `/api/recommendations` | Recommendation rules, promotions, quote recommendations, and acceptance                     |
| Billing         | `/api`                 | Orders, plans, invoices, payments, refunds, subscriptions, schedules, and billing summaries |

For the exact request and response schemas, use the live OpenAPI documentation at `/docs`.

## Core Deal Flow

1. An authorized sales user creates a customer and contact, then builds a quotation from catalog products.
2. The quote can contain one-time and recurring lines, with discounts applied at the appropriate level.
3. The deal engine evaluates discount and approval requirements against configured governance rules.
4. The quote is either approved automatically or submitted through the required manager and finance approval path.
5. Recommendation rules and active promotions can propose profitable related products; accepted suggestions are added to the quote.
6. Once an order is created, billing supports invoices, payment capture, refunds, recurring subscriptions, schedules, and proration.

## Database Migrations

Alembic migrations cover the platform's evolving schema, including authentication, catalog and price lists, customers and contacts, quotations, approval workflows, discount governance, recommendations, and billing.

Create a new migration after model changes:

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

## Testing

The repository includes focused billing tests, including proration behavior. Run them from `backend` after installing your test runner:

```bash
pytest
```

## Project Structure

```text
DealFlow360/
|-- Frontend/                 Frontend application
|-- backend/
|   |-- app/
|   |   |-- api/              FastAPI route modules and dependencies
|   |   |   |-- v1/           Versioned authentication API
|   |   |-- core/             Settings and security helpers
|   |   |-- db/               Async engine and session setup
|   |   |-- models/           SQLAlchemy entities and enums
|   |   |-- schemas/          Pydantic API contracts
|   |   |-- services/         Domain and business logic
|   |   `-- main.py           FastAPI application factory
|   |-- alembic/              Database migration history
|   |-- tests/                Automated tests
|   |-- requirements.txt      Pinned Python dependencies
|   `-- pyproject.toml        Project metadata and dependency constraints
`-- README.md
```

## Roadmap

The following items are part of the wider DealFlow360 product vision in the hackathon brief and are not represented as completed backend modules in this repository yet:

- Warehouse inventory, fulfillment splitting, and backorder handling
- Deal-health monitoring, anomaly detection, analytics, and report exports
- Customer portal negotiation, line-level discussion, and counter-offers
- Pipeline/Kanban views and fulfillment operations UI

## Security Notes

- Keep `SECRET_KEY`, `DATABASE_URL`, and Brevo credentials out of source control.
- Use a strong random `SECRET_KEY` in every non-development environment.
- Set `COOKIE_SECURE=true` behind HTTPS in staging and production.
- Restrict `CORS_ORIGINS` to trusted frontend domains before deployment.
- Apply Alembic migrations through your deployment process rather than manually changing production schema.

## License

No license has been specified for this project yet.
>>>>>>> Stashed changes
