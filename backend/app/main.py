from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import engine


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


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "dealflow360-api",
    }