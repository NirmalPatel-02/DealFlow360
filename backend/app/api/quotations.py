from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_internal_user
from app.api.v1.auth import get_current_user
from app.db.session import get_db
from app.models.enums import QuoteStatus
from app.models.quote_line import QuoteLine
from app.models.user import User
from app.schemas.quotation import (
    QuoteLineCreate,
    QuoteLineResponse,
    QuoteLineUpdate,
    QuoteSummaryResponse,
    QuotationCreate,
    QuotationResponse,
    QuotationUpdate,
)
from app.services.quotation import (
    add_quote_line,
    create_quotation,
    delete_quote_line,
    get_quotation,
    list_quotations,
    update_quote_line,
    update_quotation,
)


router = APIRouter(
    prefix="/api/quotations",
    tags=["Quotations"],
)


@router.post(
    "",
    response_model=QuotationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create(
    data: QuotationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_internal_user),
):
    try:
        quote = await create_quotation(
            db,
            user.id,
            data,
        )
        return await get_quotation(db, quote.id)

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.get(
    "",
    response_model=list[QuoteSummaryResponse],
)
async def list_all(
    status_value: QuoteStatus | None = Query(
        default=None,
        alias="status",
    ),
    customer_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_internal_user),
):
    return await list_quotations(
        db,
        user,
        status_value,
        customer_id,
    )


@router.get(
    "/{quote_id}",
    response_model=QuotationResponse,
)
async def get_one(
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    quote = await get_quotation(db, quote_id)

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    return quote


@router.patch(
    "/{quote_id}",
    response_model=QuotationResponse,
)
async def update(
    quote_id: str,
    data: QuotationUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    quote = await get_quotation(db, quote_id)

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    try:
        return await update_quotation(
            db,
            quote,
            data,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.post(
    "/{quote_id}/lines",
    response_model=QuoteLineResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_line(
    quote_id: str,
    data: QuoteLineCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    quote = await get_quotation(db, quote_id)

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    try:
        return await add_quote_line(
            db,
            quote,
            data,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.patch(
    "/{quote_id}/lines/{line_id}",
    response_model=QuoteLineResponse,
)
async def update_line(
    quote_id: str,
    line_id: str,
    data: QuoteLineUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    quote = await get_quotation(db, quote_id)

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    line = await db.get(QuoteLine, line_id)

    if not line or line.quotation_id != quote.id:
        raise HTTPException(
            status_code=404,
            detail="Quote line not found.",
        )

    try:
        return await update_quote_line(
            db,
            quote,
            line,
            data,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{quote_id}/lines/{line_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_line(
    quote_id: str,
    line_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    quote = await get_quotation(db, quote_id)

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    line = await db.get(QuoteLine, line_id)

    if not line or line.quotation_id != quote.id:
        raise HTTPException(
            status_code=404,
            detail="Quote line not found.",
        )

    try:
        await delete_quote_line(
            db,
            quote,
            line,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc