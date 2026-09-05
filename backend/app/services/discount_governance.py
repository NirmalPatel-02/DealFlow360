from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.approval_band import ApprovalBand
from app.models.approval_chain import ApprovalChain
from app.models.category import Category
from app.models.discount_rule import DiscountRule
from app.models.enums import ApprovalLevel, CustomerTier
from app.schemas.discount import (
    ApprovalBandCreate,
    ApprovalBandUpdate,
    ApprovalChainCreate,
    ApprovalChainUpdate,
    DiscountRuleCreate,
    DiscountRuleUpdate,
)


async def create_approval_chain(
    db: AsyncSession,
    data: ApprovalChainCreate,
) -> ApprovalChain:
    existing = await db.scalar(
        select(ApprovalChain).where(ApprovalChain.name == data.name)
    )

    if existing:
        raise ValueError("Approval chain name already exists.")

    chain = ApprovalChain(**data.model_dump())
    db.add(chain)

    await db.commit()
    await db.refresh(chain)

    return chain


async def list_approval_chains(
    db: AsyncSession,
    is_active: bool | None = True,
) -> list[ApprovalChain]:
    query = select(ApprovalChain).order_by(ApprovalChain.name)

    if is_active is not None:
        query = query.where(ApprovalChain.is_active == is_active)

    result = await db.scalars(query)
    return list(result.all())


async def get_approval_chain(
    db: AsyncSession,
    chain_id: str,
) -> ApprovalChain | None:
    return await db.get(ApprovalChain, chain_id)


async def update_approval_chain(
    db: AsyncSession,
    chain: ApprovalChain,
    data: ApprovalChainUpdate,
) -> ApprovalChain:
    changes = data.model_dump(exclude_unset=True)

    if "name" in changes:
        existing = await db.scalar(
            select(ApprovalChain).where(
                ApprovalChain.name == changes["name"],
                ApprovalChain.id != chain.id,
            )
        )

        if existing:
            raise ValueError("Approval chain name already exists.")

    for field, value in changes.items():
        setattr(chain, field, value)

    await db.commit()
    await db.refresh(chain)

    return chain


async def create_approval_band(
    db: AsyncSession,
    chain_id: str,
    data: ApprovalBandCreate,
) -> ApprovalBand:
    chain = await db.get(ApprovalChain, chain_id)

    if not chain:
        raise ValueError("Approval chain not found.")

    if not chain.is_active:
        raise ValueError("Cannot modify an inactive approval chain.")

    await _validate_band_range(
        db,
        chain_id,
        data.min_excess_percent,
        data.max_excess_percent,
    )

    band = ApprovalBand(
        approval_chain_id=chain_id,
        **data.model_dump(),
    )

    db.add(band)
    await db.commit()
    await db.refresh(band)

    return band


async def list_approval_bands(
    db: AsyncSession,
    chain_id: str,
) -> list[ApprovalBand]:
    result = await db.scalars(
        select(ApprovalBand)
        .where(ApprovalBand.approval_chain_id == chain_id)
        .order_by(ApprovalBand.min_excess_percent)
    )

    return list(result.all())


async def update_approval_band(
    db: AsyncSession,
    band: ApprovalBand,
    data: ApprovalBandUpdate,
) -> ApprovalBand:
    changes = data.model_dump(exclude_unset=True)

    min_value = changes.get(
        "min_excess_percent",
        band.min_excess_percent,
    )

    max_value = changes.get(
        "max_excess_percent",
        band.max_excess_percent,
    )

    if max_value is not None and max_value <= min_value:
        raise ValueError(
            "max_excess_percent must be greater than min_excess_percent."
        )

    await _validate_band_range(
        db,
        band.approval_chain_id,
        min_value,
        max_value,
        exclude_id=band.id,
    )

    for field, value in changes.items():
        setattr(band, field, value)

    await db.commit()
    await db.refresh(band)

    return band


async def delete_approval_band(
    db: AsyncSession,
    band: ApprovalBand,
) -> None:
    await db.delete(band)
    await db.commit()


async def _validate_band_range(
    db: AsyncSession,
    chain_id: str,
    min_value: Decimal,
    max_value: Decimal | None,
    exclude_id: str | None = None,
) -> None:
    result = await db.scalars(
        select(ApprovalBand)
        .where(ApprovalBand.approval_chain_id == chain_id)
    )

    for existing in result.all():
        if exclude_id and existing.id == exclude_id:
            continue

        existing_max = existing.max_excess_percent

        new_overlaps_existing = (
            existing_max is None
            or max_value is None
            or min_value < existing_max
        )

        existing_overlaps_new = (
            max_value is None
            or existing.min_excess_percent < max_value
        )

        if (
            new_overlaps_existing
            and existing_overlaps_new
        ):
            if existing.min_excess_percent < (
                max_value if max_value is not None else Decimal("101")
            ) and min_value < (
                existing_max
                if existing_max is not None
                else Decimal("101")
            ):
                raise ValueError(
                    "Approval bands cannot overlap."
                )

    # Only one unbounded band is allowed.
    if max_value is None:
        for existing in result.all():
            if exclude_id and existing.id == exclude_id:
                continue

            if existing.max_excess_percent is None:
                raise ValueError(
                    "Only one unbounded approval band is allowed."
                )


async def create_discount_rule(
    db: AsyncSession,
    data: DiscountRuleCreate,
) -> DiscountRule:
    if data.category_id:
        category = await db.get(Category, data.category_id)

        if not category or not category.is_active:
            raise ValueError("Active category not found.")

    chain = await db.get(ApprovalChain, data.approval_chain_id)

    if not chain:
        raise ValueError("Approval chain not found.")

    if not chain.is_active:
        raise ValueError("Approval chain is inactive.")

    await _ensure_required_rule_not_exists(
        db,
        data.customer_tier,
        data.category_id,
    )

    rule = DiscountRule(**data.model_dump())

    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return rule


async def list_discount_rules(
    db: AsyncSession,
    customer_tier: CustomerTier | None = None,
    category_id: str | None = None,
    is_active: bool | None = True,
) -> list[DiscountRule]:
    query = select(DiscountRule).order_by(
        DiscountRule.customer_tier,
        DiscountRule.category_id,
    )

    if customer_tier:
        query = query.where(
            DiscountRule.customer_tier == customer_tier
        )

    if category_id:
        query = query.where(
            DiscountRule.category_id == category_id
        )

    if is_active is not None:
        query = query.where(
            DiscountRule.is_active == is_active
        )

    result = await db.scalars(query)
    return list(result.all())


async def get_discount_rule(
    db: AsyncSession,
    rule_id: str,
) -> DiscountRule | None:
    return await db.get(DiscountRule, rule_id)


async def update_discount_rule(
    db: AsyncSession,
    rule: DiscountRule,
    data: DiscountRuleUpdate,
) -> DiscountRule:
    changes = data.model_dump(exclude_unset=True)

    if "approval_chain_id" in changes:
        chain = await db.get(
            ApprovalChain,
            changes["approval_chain_id"],
        )

        if not chain or not chain.is_active:
            raise ValueError(
                "Active approval chain not found."
            )

    for field, value in changes.items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)

    return rule


async def deactivate_discount_rule(
    db: AsyncSession,
    rule: DiscountRule,
) -> None:
    rule.is_active = False
    await db.commit()


async def _ensure_required_rule_not_exists(
    db: AsyncSession,
    customer_tier: CustomerTier,
    category_id: str | None,
) -> None:
    query = select(DiscountRule).where(
        DiscountRule.customer_tier == customer_tier,
        DiscountRule.is_active.is_(True),
    )

    if category_id is None:
        query = query.where(
            DiscountRule.category_id.is_(None)
        )
    else:
        query = query.where(
            DiscountRule.category_id == category_id
        )

    existing = await db.scalar(query)

    if existing:
        raise ValueError(
            "An active discount rule already exists for this scope."
        )


async def evaluate_discount(
    db: AsyncSession,
    customer_tier: CustomerTier,
    category_id: str,
    requested_discount_percent: Decimal,
) -> dict:
    category_rule = await db.scalar(
        select(DiscountRule).where(
            DiscountRule.customer_tier == customer_tier,
            DiscountRule.category_id == category_id,
            DiscountRule.is_active.is_(True),
        )
    )

    rule = category_rule

    if not rule:
        rule = await db.scalar(
            select(DiscountRule).where(
                DiscountRule.customer_tier == customer_tier,
                DiscountRule.category_id.is_(None),
                DiscountRule.is_active.is_(True),
            )
        )

    if not rule:
        raise ValueError(
            "No active discount policy is configured "
            "for this customer tier and category."
        )

    chain = await db.get(
        ApprovalChain,
        rule.approval_chain_id,
    )

    if not chain or not chain.is_active:
        raise ValueError(
            "The approval chain configured for this rule is inactive."
        )

    excess = max(
        requested_discount_percent
        - rule.max_discount_percent,
        Decimal("0"),
    )

    if excess <= 0:
        return {
            "allowed_discount_percent": rule.max_discount_percent,
            "requested_discount_percent": requested_discount_percent,
            "excess_percent": Decimal("0"),
            "requires_approval": False,
            "approval_level": None,
            "rule_id": rule.id,
            "rule_scope": (
                "category"
                if rule.category_id
                else "customer_tier"
            ),
        }

    bands = await list_approval_bands(db, chain.id)

    matching_band = next(
        (
            band
            for band in bands
            if excess >= band.min_excess_percent
            and (
                band.max_excess_percent is None
                or excess < band.max_excess_percent
            )
        ),
        None,
    )

    if not matching_band:
        raise ValueError(
            "Discount exceeds the configured approval limits."
        )

    return {
        "allowed_discount_percent": rule.max_discount_percent,
        "requested_discount_percent": requested_discount_percent,
        "excess_percent": excess,
        "requires_approval": True,
        "approval_level": matching_band.approval_level,
        "rule_id": rule.id,
        "rule_scope": (
            "category"
            if rule.category_id
            else "customer_tier"
        ),
    }