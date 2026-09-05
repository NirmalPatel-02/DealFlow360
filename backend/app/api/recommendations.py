from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_admin, require_internal_user
from app.db.session import get_db
from app.models.product_recommendation import ProductRecommendationRule
from app.models.promotion import Promotion
from app.models.user import User
from app.schemas.recommendation import (
    PromotionCreate,
    PromotionResponse,
    PromotionUpdate,
    RecommendationAcceptRequest,
    RecommendationResponse,
    RecommendationRuleCreate,
    RecommendationRuleResponse,
    RecommendationRuleUpdate,
)
from app.services.recommendation import (
    accept_recommendation,
    create_promotion,
    create_recommendation_rule,
    deactivate_promotion,
    deactivate_recommendation_rule,
    get_promotion,
    get_recommendation_rule,
    get_recommendations,
    list_promotions,
    list_recommendation_rules,
    update_promotion,
    update_recommendation_rule,
)
from app.services.quotation import get_quotation


router = APIRouter(
    prefix="/api/recommendations",
    tags=["Upsell & Cross-sell"],
)


# ==========================================
# Recommendation Rules
# ==========================================

@router.post(
    "/rules",
    response_model=RecommendationRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_rule(
    data: RecommendationRuleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        return await create_recommendation_rule(
            db,
            data,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc


@router.get(
    "/rules",
    response_model=list[RecommendationRuleResponse],
)
async def list_rules(
    source_product_id: str | None = None,
    is_active: bool | None = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    return await list_recommendation_rules(
        db,
        source_product_id,
        is_active,
    )


@router.get(
    "/rules/{rule_id}",
    response_model=RecommendationRuleResponse,
)
async def get_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    rule = await get_recommendation_rule(
        db,
        rule_id,
    )

    if not rule:
        raise HTTPException(
            status_code=404,
            detail="Recommendation rule not found.",
        )

    return rule


@router.patch(
    "/rules/{rule_id}",
    response_model=RecommendationRuleResponse,
)
async def update_rule(
    rule_id: str,
    data: RecommendationRuleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    rule = await get_recommendation_rule(
        db,
        rule_id,
    )

    if not rule:
        raise HTTPException(
            status_code=404,
            detail="Recommendation rule not found.",
        )

    return await update_recommendation_rule(
        db,
        rule,
        data,
    )


@router.delete(
    "/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    rule = await get_recommendation_rule(
        db,
        rule_id,
    )

    if not rule:
        raise HTTPException(
            status_code=404,
            detail="Recommendation rule not found.",
        )

    await deactivate_recommendation_rule(
        db,
        rule,
    )


# ==========================================
# Promotions
# ==========================================

@router.post(
    "/promotions",
    response_model=PromotionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_promotion_route(
    data: PromotionCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        return await create_promotion(
            db,
            data,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.get(
    "/promotions",
    response_model=list[PromotionResponse],
)
async def list_promotions_route(
    product_id: str | None = None,
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    return await list_promotions(
        db,
        product_id,
        active_only,
    )


@router.get(
    "/promotions/{promotion_id}",
    response_model=PromotionResponse,
)
async def get_promotion_route(
    promotion_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    promotion = await get_promotion(
        db,
        promotion_id,
    )

    if not promotion:
        raise HTTPException(
            status_code=404,
            detail="Promotion not found.",
        )

    return promotion


@router.patch(
    "/promotions/{promotion_id}",
    response_model=PromotionResponse,
)
async def update_promotion_route(
    promotion_id: str,
    data: PromotionUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    promotion = await get_promotion(
        db,
        promotion_id,
    )

    if not promotion:
        raise HTTPException(
            status_code=404,
            detail="Promotion not found.",
        )

    try:
        return await update_promotion(
            db,
            promotion,
            data,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.delete(
    "/promotions/{promotion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_promotion(
    promotion_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    promotion = await get_promotion(
        db,
        promotion_id,
    )

    if not promotion:
        raise HTTPException(
            status_code=404,
            detail="Promotion not found.",
        )

    await deactivate_promotion(
        db,
        promotion,
    )


# ==========================================
# Quote Recommendations
# ==========================================

@router.get(
    "/quotes/{quote_id}",
    response_model=list[RecommendationResponse],
)
async def quote_recommendations(
    quote_id: str,
    source_product_id: str | None = Query(
        default=None
    ),
    limit: int = Query(
        default=5,
        ge=1,
        le=20,
    ),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    quote = await get_quotation(
        db,
        quote_id,
    )

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    try:
        return await get_recommendations(
            db,
            quote,
            source_product_id,
            limit,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.post(
    "/quotes/{quote_id}/accept",
    status_code=status.HTTP_201_CREATED,
)
async def accept_quote_recommendation(
    quote_id: str,
    data: RecommendationAcceptRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_internal_user),
):
    quote = await get_quotation(
        db,
        quote_id,
    )

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    try:
        line = await accept_recommendation(
            db,
            quote,
            user.id,
            data.source_product_id,
            data.suggested_product_id,
            data.discount_percent,
        )

        return {
            "message": "Recommendation added to quotation.",
            "quote_line_id": line.id,
            "product_id": line.product_id,
            "quantity": line.quantity,
            "line_total": line.line_total,
            "margin_amount": line.margin_amount,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc