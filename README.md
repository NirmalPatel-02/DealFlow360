# DealFlow360

**DealFlow360** is an intelligent B2B deal-operations platform that connects the complete quote-to-cash lifecycle in one governed workspace. Sales teams can prepare quotes, apply controlled discounts, route exceptions through approvals, fulfil orders across warehouses, manage invoices and subscriptions, and give customers a focused self-service portal.

## Highlights

- Role-based workspaces for sales, sales management, finance/operations, administrators, and customers
- Secure account lifecycle: registration, email OTP verification, login, refresh sessions, password recovery, password changes, rate limiting, and account lockout controls
- Customer, contact, product, variant, price-list, category, and customer-tier management
- One-time and recurring quotation lines with discounts, margin/risk evaluation, approval routing, review history, and audit records
- Rule-based upsell and cross-sell recommendations, promotion boosts, and one-click addition to a quote
- Order, invoice, payment, refund, credit-note, subscription, recurring billing, and proration support
- Warehouse inventory, allocation planning, split fulfilment, manual overrides, replenishment rules, and backorders
- Customer quote sharing, acceptance, and negotiation workflows
- Deal-health monitoring, dashboards, and sales, approval, and billing reports

## Technology

| Area | Stack |
| --- | --- |
| Frontend | React 19, React Router, Vite, Tailwind CSS |
| API | FastAPI, Uvicorn, Pydantic v2 |
| Data | SQLAlchemy 2 async ORM, MySQL/MariaDB, Alembic |
| Security | JWT access tokens, HTTP-only refresh cookies, Argon2 password hashing |
| Email | Brevo API integration |
| Testing | Pytest |

## Project Structure

```text
DealFlow360/
|-- Frontend/                    React + Vite application
|   |-- src/app/                 Application setup, routes, and providers
|   |-- src/features/            Domain-focused UI and API modules
|   |-- src/guards/              Authentication and role guards
|   `-- src/services/            API client and browser storage helpers
|-- backend/
|   |-- app/api/                 FastAPI route modules
|   |-- app/core/                Configuration and security
|   |-- app/db/                  Async database engine and sessions
|   |-- app/models/              SQLAlchemy models and enums
|   |-- app/schemas/             Pydantic request and response contracts
|   |-- app/services/            Business rules and domain logic
|   |-- alembic/                 Database migrations
|   |-- scripts/                 Development/demo-data utilities
|   `-- tests/                   Backend test suite
`-- README.md
```

## Getting Started

### Prerequisites

- Python 3.13 or newer
- Node.js 20 or newer
- MySQL 8+ or MariaDB

### 1. Configure the backend

Create a MySQL/MariaDB database, then create `backend/.env` with the following values:

```env
APP_NAME=DealFlow360 API
ENVIRONMENT=development
DATABASE_URL=mysql+asyncmy://USER:PASSWORD@localhost:3306/dealflow360
SECRET_KEY=replace-with-a-random-secret-of-at-least-32-characters

FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
COOKIE_SECURE=false
COOKIE_SAMESITE=lax

# Optional: required only when sending email through Brevo
BREVO_API_KEY=
BREVO_SENDER_NAME=DealFlow360
BREVO_SENDER_EMAIL=
```

### 2. Install backend dependencies and migrate the database

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
```

On macOS/Linux, activate the environment with `source .venv/bin/activate`.

### 3. Start the API

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`.

- OpenAPI documentation: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- Health check: `http://127.0.0.1:8000/health`

### 4. Install and start the frontend

In a second terminal:

```powershell
cd Frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Vite proxies `/api` requests to the local FastAPI server during development.

## Demo Data

After applying migrations, create active users for a sales rep, sales manager, and finance/operations role. You can then populate an otherwise empty development database with connected demo data:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python scripts/seed_hackathon_demo.py
```

The script intentionally refuses to run when customer, product, quote, or order data already exists. It is for empty development databases only.

## Core Workflow

1. A sales user creates a customer and quotation with one-time or recurring items.
2. The platform applies pricing and discount rules, then evaluates deal risk and required approvals.
3. Managers and finance/operations users review exceptions and record decisions in the approval history.
4. Approved quotes can be shared with customers, negotiated, accepted, converted to orders, and fulfilled from warehouses.
5. Finance tracks invoices, payments, refunds, subscriptions, billing schedules, and proration changes.

## API Areas

All protected endpoints require an `Authorization: Bearer <access_token>` header. Explore exact request and response contracts through the live OpenAPI documentation.

| Area | Base path | Scope |
| --- | --- | --- |
| Authentication | `/api/v1/auth` | Registration, OTP verification, login, refresh, profile, and password flows |
| Customers | `/api/customers` | Customers and contacts |
| Catalog | `/api/catalog` | Categories, products, variants, and price lists |
| Governance | `/api/governance` | Discount rules, approval chains, and approval bands |
| Quotations | `/api/quotations` | Quotes and quote lines |
| Approvals | `/api/approvals` | Deal evaluation, submissions, history, and actions |
| Recommendations | `/api/recommendations` | Recommendations and promotions |
| Fulfilment | `/api/fulfillment` | Warehouses, inventory, allocation, and backorders |
| Customer portal | `/api/portal` | Quote access, negotiations, and confirmation |
| Billing | `/api` | Orders, invoices, payments, subscriptions, and schedules |
| Operations | `/api/admin`, `/api/reports`, `/api/deal-health` | Administration, reporting, and deal monitoring |

## Useful Commands

```powershell
# Backend tests
cd backend
pytest

# Frontend quality checks
cd Frontend
npm run lint
npm run build
```

## Security and Deployment Notes

- Never commit `backend/.env`, credentials, or production connection strings.
- Set a unique, securely generated `SECRET_KEY` in every environment.
- Set `COOKIE_SECURE=true` behind HTTPS.
- Restrict `CORS_ORIGINS` and `FRONTEND_URL` to your deployed frontend domains.
- Apply Alembic migrations as part of deployment; do not alter production tables manually.
- Build the frontend with `npm run build` and serve the `Frontend/dist` output through your preferred static host or web server.

## License

No license has been specified for this project.
