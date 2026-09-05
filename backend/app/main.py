from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.api.billing import router as billing_router
from app.core.config import settings
from app.db.session import engine
from app.api.customers import router as customers_router
from app.api.catalog import router as catalog_router
from app.api.discount_governance import router as discount_governance_router
from app.api.quotations import router as quotations_router
from app.api.approvals import router as approvals_router
from app.api.recommendations import router as recommendations_router
from app.api.fulfillment import router as fulfillment_router
from app.api.portal import router as portal_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="DealFlow360 intelligent deal operating system backend.",
    docs_url="/docs",
    redoc_url="/redoc",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(api_router)
app.include_router(customers_router)
app.include_router(catalog_router)
app.include_router(billing_router, prefix="/api")
app.include_router(discount_governance_router)
app.include_router(quotations_router)
app.include_router(approvals_router)
app.include_router(recommendations_router)
app.include_router(fulfillment_router)

app.include_router(portal_router)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "dealflow360-api",
    }