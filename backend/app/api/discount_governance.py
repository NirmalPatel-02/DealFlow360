from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_admin, require_internal_user
from app.db.session import get_db
from app.models.enums import CustomerTier
from app.models.user import User
from app.models.approval_band import ApprovalBand
from app.schemas.discount import (
    ApprovalBandCreate,
    ApprovalBandResponse,
    ApprovalBandUpdate,
    ApprovalChainCreate,
    ApprovalChainResponse,
    ApprovalChainUpdate,
    DiscountEvaluationRequest,
    DiscountEvaluationResponse,
    DiscountRuleCreate,
    DiscountRuleResponse,
    DiscountRuleUpdate,
)
from app.services.discount_governance import (
    create_approval_band,
    create_approval_chain,
    create_discount_rule,
    deactivate_discount_rule,
    delete_approval_band,
    evaluate_discount,
    get_approval_chain,
    get_discount_rule,
    list_approval_bands,
    list_approval_chains,
    list_discount_rules,
    update_approval_band,
    update_approval_chain,
    update_discount_rule,
)


router = APIRouter(
    prefix="/api/governance",
    tags=["Discount Governance"],
)


# ---------------------------
# Approval Chains
# ---------------------------

@router.post(
    "/approval-chains",
    response_model=ApprovalChainResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_chain(
    data: ApprovalChainCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        return await create_approval_chain(db, data)
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc


@router.get(
    "/approval-chains",
    response_model=list[ApprovalChainResponse],
)
async def list_chains(
    is_active: bool | None = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    return await list_approval_chains(db, is_active)


@router.get(
    "/approval-chains/{chain_id}",
    response_model=ApprovalChainResponse,
)
async def get_chain(
    chain_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    chain = await get_approval_chain(db, chain_id)

    if not chain:
        raise HTTPException(
            status_code=404,
            detail="Approval chain not found.",
        )

    return chain


@router.patch(
    "/approval-chains/{chain_id}",
    response_model=ApprovalChainResponse,
)
async def update_chain(
    chain_id: str,
    data: ApprovalChainUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    chain = await get_approval_chain(db, chain_id)

    if not chain:
        raise HTTPException(
            status_code=404,
            detail="Approval chain not found.",
        )

    try:
        return await update_approval_chain(db, chain, data)
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc


# ---------------------------
# Approval Bands
# ---------------------------

@router.post(
    "/approval-chains/{chain_id}/bands",
    response_model=ApprovalBandResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_band(
    chain_id: str,
    data: ApprovalBandCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        return await create_approval_band(
            db,
            chain_id,
            data,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc


@router.get(
    "/approval-chains/{chain_id}/bands",
    response_model=list[ApprovalBandResponse],
)
async def list_bands(
    chain_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    chain = await get_approval_chain(db, chain_id)

    if not chain:
        raise HTTPException(
            status_code=404,
            detail="Approval chain not found.",
        )

    return await list_approval_bands(db, chain_id)


@router.patch(
    "/approval-bands/{band_id}",
    response_model=ApprovalBandResponse,
)
async def update_band(
    band_id: str,
    data: ApprovalBandUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    band = await db.get(ApprovalBand, band_id)

    if not band:
        raise HTTPException(
            status_code=404,
            detail="Approval band not found.",
        )

    try:
        return await update_approval_band(db, band, data)
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc


@router.delete(
    "/approval-bands/{band_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_band(
    band_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    band = await db.get(ApprovalBand, band_id)

    if not band:
        raise HTTPException(
            status_code=404,
            detail="Approval band not found.",
        )

    await delete_approval_band(db, band)


# ---------------------------
# Discount Rules
# ---------------------------

@router.post(
    "/discount-rules",
    response_model=DiscountRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_rule(
    data: DiscountRuleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        return await create_discount_rule(db, data)
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc


@router.get(
    "/discount-rules",
    response_model=list[DiscountRuleResponse],
)
async def list_rules(
    customer_tier: CustomerTier | None = Query(default=None),
    category_id: str | None = None,
    is_active: bool | None = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    return await list_discount_rules(
        db,
        customer_tier,
        category_id,
        is_active,
    )


@router.get(
    "/discount-rules/{rule_id}",
    response_model=DiscountRuleResponse,
)
async def get_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    rule = await get_discount_rule(db, rule_id)

    if not rule:
        raise HTTPException(
            status_code=404,
            detail="Discount rule not found.",
        )

    return rule


@router.patch(
    "/discount-rules/{rule_id}",
    response_model=DiscountRuleResponse,
)
async def update_rule(
    rule_id: str,
    data: DiscountRuleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    rule = await get_discount_rule(db, rule_id)

    if not rule:
        raise HTTPException(
            status_code=404,
            detail="Discount rule not found.",
        )

    try:
        return await update_discount_rule(db, rule, data)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.delete(
    "/discount-rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def deactivate_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    rule = await get_discount_rule(db, rule_id)

    if not rule:
        raise HTTPException(
            status_code=404,
            detail="Discount rule not found.",
        )

    await deactivate_discount_rule(db, rule)


# ---------------------------
# Discount Evaluation
# ---------------------------

@router.post(
    "/discounts/evaluate",
    response_model=DiscountEvaluationResponse,
)
async def evaluate_discount_route(
    data: DiscountEvaluationRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    try:
        result = await evaluate_discount(
            db,
            data.customer_tier,
            data.category_id,
            data.requested_discount_percent,
        )

        return result

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc