from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.models.product_recommendation import ProductRecommendationRule
from app.models.promotion import Promotion
from app.models.quote_line import QuoteLine
from app.models.quotation import Quotation
from app.models.recommendation_event import RecommendationEvent
from app.schemas.recommendation import (
    PromotionCreate,
    PromotionUpdate,
    RecommendationRuleCreate,
    RecommendationRuleUpdate,
)
from app.services.quotation import add_quote_line
from app.utils.time import utcnow


MONEY = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(
        MONEY,
        rounding=ROUND_HALF_UP,
    )


async def create_recommendation_rule(
    db: AsyncSession,
    data: RecommendationRuleCreate,
) -> ProductRecommendationRule:
    source = await db.get(
        Product,
        data.source_product_id,
    )

    suggested = await db.get(
        Product,
        data.suggested_product_id,
    )

    if not source or not source.is_active:
        raise ValueError(
            "Active source product not found."
        )

    if not suggested or not suggested.is_active:
        raise ValueError(
            "Active suggested product not found."
        )

    existing = await db.scalar(
        select(ProductRecommendationRule).where(
            ProductRecommendationRule.source_product_id
            == data.source_product_id,
            ProductRecommendationRule.suggested_product_id
            == data.suggested_product_id,
        )
    )

    if existing:
        raise ValueError(
            "A recommendation rule already exists "
            "for this product pair."
        )

    rule = ProductRecommendationRule(
        **data.model_dump()
    )

    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return rule


async def list_recommendation_rules(
    db: AsyncSession,
    source_product_id: str | None = None,
    is_active: bool | None = True,
) -> list[ProductRecommendationRule]:
    query = select(
        ProductRecommendationRule
    ).order_by(
        ProductRecommendationRule.co_purchase_count.desc()
    )

    if source_product_id:
        query = query.where(
            ProductRecommendationRule.source_product_id
            == source_product_id
        )

    if is_active is not None:
        query = query.where(
            ProductRecommendationRule.is_active
            == is_active
        )

    result = await db.scalars(query)
    return list(result.all())


async def get_recommendation_rule(
    db: AsyncSession,
    rule_id: str,
) -> ProductRecommendationRule | None:
    return await db.get(
        ProductRecommendationRule,
        rule_id,
    )


async def update_recommendation_rule(
    db: AsyncSession,
    rule: ProductRecommendationRule,
    data: RecommendationRuleUpdate,
) -> ProductRecommendationRule:
    for field, value in data.model_dump(
        exclude_unset=True
    ).items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)

    return rule


async def deactivate_recommendation_rule(
    db: AsyncSession,
    rule: ProductRecommendationRule,
) -> None:
    rule.is_active = False
    await db.commit()


async def create_promotion(
    db: AsyncSession,
    data: PromotionCreate,
) -> Promotion:
    product = await db.get(
        Product,
        data.product_id,
    )

    if not product or not product.is_active:
        raise ValueError(
            "Active product not found."
        )

    promotion = Promotion(
        **data.model_dump()
    )

    db.add(promotion)
    await db.commit()
    await db.refresh(promotion)

    return promotion


async def list_promotions(
    db: AsyncSession,
    product_id: str | None = None,
    active_only: bool = False,
) -> list[Promotion]:
    query = select(Promotion).order_by(
        Promotion.starts_at.desc()
    )

    if product_id:
        query = query.where(
            Promotion.product_id == product_id
        )

    if active_only:
        now = utcnow()
        query = query.where(
            Promotion.is_active.is_(True),
            Promotion.starts_at <= now,
            Promotion.ends_at > now,
        )

    result = await db.scalars(query)
    return list(result.all())


async def get_promotion(
    db: AsyncSession,
    promotion_id: str,
) -> Promotion | None:
    return await db.get(
        Promotion,
        promotion_id,
    )


async def update_promotion(
    db: AsyncSession,
    promotion: Promotion,
    data: PromotionUpdate,
) -> Promotion:
    changes = data.model_dump(
        exclude_unset=True
    )

    starts_at = changes.get(
        "starts_at",
        promotion.starts_at,
    )

    ends_at = changes.get(
        "ends_at",
        promotion.ends_at,
    )

    if ends_at <= starts_at:
        raise ValueError(
            "ends_at must be later than starts_at."
        )

    for field, value in changes.items():
        setattr(promotion, field, value)

    await db.commit()
    await db.refresh(promotion)

    return promotion


async def deactivate_promotion(
    db: AsyncSession,
    promotion: Promotion,
) -> None:
    promotion.is_active = False
    await db.commit()


async def _quote_product_ids(
    db: AsyncSession,
    quote_id: str,
) -> set[str]:
    result = await db.scalars(
        select(QuoteLine.product_id).where(
            QuoteLine.quotation_id == quote_id
        )
    )

    return set(result.all())


async def _active_promotion_for_product(
    db: AsyncSession,
    product_id: str,
) -> Promotion | None:
    now = utcnow()

    return await db.scalar(
        select(Promotion)
        .where(
            Promotion.product_id == product_id,
            Promotion.is_active.is_(True),
            Promotion.starts_at <= now,
            Promotion.ends_at > now,
        )
        .order_by(
            Promotion.ranking_boost.desc()
        )
        .limit(1)
    )


async def _resolve_price_for_quote(
    db: AsyncSession,
    quote: Quotation,
    product_id: str,
) -> tuple[Decimal, Decimal]:
    product = await db.get(
        Product,
        product_id,
    )

    if not product:
        raise ValueError(
            "Product not found."
        )

    # Select the active price list applicable to
    # the quote's customer tier and currency.
    from app.models.price_list import PriceList
    from app.models.price_list_item import PriceListItem

    price_list = await db.scalar(
        select(PriceList)
        .where(
            PriceList.customer_tier
            == quote.customer_tier_snapshot,
            PriceList.currency
            == quote.currency,
            PriceList.is_active.is_(True),
        )
        .order_by(
            PriceList.created_at.desc()
        )
        .limit(1)
    )

    if not price_list:
        raise ValueError(
            "No active price list exists for this "
            "customer tier and currency."
        )

    item = await db.scalar(
        select(PriceListItem)
        .where(
            PriceListItem.price_list_id
            == price_list.id,
            PriceListItem.product_id
            == product_id,
            PriceListItem.variant_id.is_(None),
        )
    )

    if not item:
        raise ValueError(
            f"No price configured for product "
            f"'{product.code}' in the quote's price list."
        )

    return item.price, product.cost_price


async def get_recommendations(
    db: AsyncSession,
    quote: Quotation,
    source_product_id: str | None = None,
    limit: int = 5,
) -> list[dict]:
    quote_product_ids = await _quote_product_ids(
        db,
        quote.id,
    )

    if not source_product_id:
        source_product_id = next(
            iter(quote_product_ids),
            None,
        )

    if not source_product_id:
        raise ValueError(
            "Add at least one product to the quotation "
            "before requesting recommendations."
        )

    source_product = await db.get(
        Product,
        source_product_id,
    )

    if not source_product or not source_product.is_active:
        raise ValueError(
            "Source product not found."
        )

    rules = list(
        (
            await db.scalars(
                select(ProductRecommendationRule)
                .where(
                    ProductRecommendationRule.source_product_id
                    == source_product_id,
                    ProductRecommendationRule.is_active.is_(True),
                )
                .order_by(
                    ProductRecommendationRule
                    .co_purchase_count.desc()
                )
            )
        ).all()
    )

    recommendations = []

    # Use a broader candidate set if needed by future rule expansion.
    for rule in rules:
        product = rule.suggested_product

        if not product or not product.is_active:
            continue

        if product.id in quote_product_ids:
            continue

        try:
            price, cost = await _resolve_price_for_quote(
                db,
                quote,
                product.id,
            )
        except ValueError:
            # A recommendation with no valid customer price
            # should never be shown to the sales rep.
            continue

        promotion = await _active_promotion_for_product(
            db,
            product.id,
        )

        current_margin = money(
            price - cost
        )

        if price <= 0:
            continue

        margin_percent = (
            current_margin / price * Decimal("100")
        ).quantize(
            Decimal("0.01")
        )

        if (
            margin_percent
            < rule.minimum_margin_percent
        ):
            continue

        co_purchase_score = Decimal(
            rule.co_purchase_count
        )

        weighted_score = (
            co_purchase_score
            * rule.recommendation_weight
        )

        promotion_boost = (
            promotion.ranking_boost
            if promotion
            else Decimal("0")
        )

        score = (
            weighted_score
            + promotion_boost
            + margin_percent
        ).quantize(
            Decimal("0.01")
        )

        # Current quote net revenue before tax.
        current_net = money(
            quote.grand_total
            - quote.tax_total
        )

        current_cost = quote.total_cost

        added_revenue = price
        added_margin = current_margin

        new_revenue = money(
            current_net + added_revenue
        )

        new_margin = money(
            quote.gross_margin
            + added_margin
        )

        current_margin_percent = (
            quote.gross_margin / current_net
            * Decimal("100")
            if current_net > 0
            else Decimal("0")
        )

        new_margin_percent = (
            new_margin / new_revenue
            * Decimal("100")
            if new_revenue > 0
            else Decimal("0")
        )

        margin_delta_amount = money(
            added_margin
        )

        reason_parts = [
            f"{rule.co_purchase_count} historical "
            "co-purchases"
        ]

        if promotion:
            reason_parts.append(
                f"active promotion: {promotion.name}"
            )

        reason_parts.append(
            f"{margin_percent}% product margin"
        )

        recommendations.append(
            {
                "product_id": product.id,
                "product_name": product.name,
                "product_code": product.code,
                "product_type": product.product_type.value,
                "recommended_unit_price": price,
                "recommended_unit_cost": cost,
                "margin_amount": current_margin,
                "margin_percent": margin_percent,
                "margin_delta_amount": margin_delta_amount,
                "new_quote_margin_percent": new_margin_percent,
                "co_purchase_count": rule.co_purchase_count,
                "promotion_name": (
                    promotion.name
                    if promotion
                    else None
                ),
                "promotion_boost": promotion_boost,
                "recommendation_score": score,
                "reason": " + ".join(reason_parts),
            }
        )

    recommendations.sort(
        key=lambda item: (
            item["recommendation_score"],
            item["margin_percent"],
            item["co_purchase_count"],
        ),
        reverse=True,
    )

    return recommendations[:limit]


async def record_recommendation_event(
    db: AsyncSession,
    quote_id: str,
    source_product_id: str,
    suggested_product_id: str,
    user_id: str,
    action: str,
) -> None:
    if action not in {
        "shown",
        "accepted",
        "dismissed",
    }:
        raise ValueError(
            "Invalid recommendation event."
        )

    event = RecommendationEvent(
        quotation_id=quote_id,
        source_product_id=source_product_id,
        suggested_product_id=suggested_product_id,
        user_id=user_id,
        action=action,
        occurred_at=utcnow(),
    )

    db.add(event)


async def accept_recommendation(
    db: AsyncSession,
    quote: Quotation,
    user_id: str,
    source_product_id: str,
    suggested_product_id: str,
    discount_percent: Decimal,
):
    if quote.status.value != "draft":
        raise ValueError(
            "Recommendations can only be accepted "
            "while the quotation is in draft."
        )

    product = await db.get(
        Product,
        suggested_product_id,
    )

    if not product or not product.is_active:
        raise ValueError(
            "Suggested product is no longer active."
        )

    quote_product_ids = await _quote_product_ids(
        db,
        quote.id,
    )

    if suggested_product_id in quote_product_ids:
        raise ValueError(
            "Suggested product is already in the quotation."
        )

    rule = await db.scalar(
        select(ProductRecommendationRule).where(
            ProductRecommendationRule.source_product_id
            == source_product_id,
            ProductRecommendationRule.suggested_product_id
            == suggested_product_id,
            ProductRecommendationRule.is_active.is_(True),
        )
    )

    if not rule:
        raise ValueError(
            "This product is not an active recommendation "
            "for the selected source product."
        )

    recommendations = await get_recommendations(
        db,
        quote,
        source_product_id,
        limit=100,
    )

    recommendation = next(
        (
            item
            for item in recommendations
            if item["product_id"]
            == suggested_product_id
        ),
        None,
    )

    if not recommendation:
        raise ValueError(
            "Suggested product no longer satisfies "
            "recommendation criteria."
        )

    # Reuse the existing quotation pipeline.
    # This is important: price resolution, discount governance,
    # tax, cost and margin are all calculated in one place.
    from app.schemas.quotation import QuoteLineCreate
    from app.models.enums import QuoteLineType

    line_type = (
        QuoteLineType.RECURRING
        if product.product_type.value == "subscription"
        else QuoteLineType.ONE_TIME
    )

    line = await add_quote_line(
        db,
        quote,
        QuoteLineCreate(
            product_id=suggested_product_id,
            quantity=Decimal("1"),
            discount_percent=discount_percent,
            line_type=line_type,
        ),
    )

    await record_recommendation_event(
        db,
        quote.id,
        source_product_id,
        suggested_product_id,
        user_id,
        "accepted",
    )

    await db.commit()

    return line