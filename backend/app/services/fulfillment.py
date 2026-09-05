from decimal import Decimal, ROUND_HALF_UP
from itertools import combinations

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal, ROUND_HALF_UP
from itertools import combinations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory_stock import InventoryStock
from app.models.warehouse import Warehouse
from app.models.backorder import Backorder
from app.models.enums import (
    BackorderStatus,
    FulfillmentAllocationStatus,
    FulfillmentPlanStatus,
    ProductType,
    QuoteStatus,
)
from app.models.fulfillment_allocation import FulfillmentAllocation
from app.models.fulfillment_plan import FulfillmentPlan
from app.models.inventory_stock import InventoryStock
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.quote_line import QuoteLine
from app.models.quotation import Quotation
from app.models.replenishment_rule import ReplenishmentRule
from app.models.warehouse import Warehouse
from app.schemas.warehouse import (
    InventoryAdjustRequest,
    InventoryStockCreate,
    ReplenishmentRuleCreate,
    ReplenishmentRuleUpdate,
    WarehouseCreate,
    WarehouseUpdate,
)
from app.utils.time import utcnow



QTY = Decimal("0.001")
MONEY = Decimal("0.01")


def qty(value: Decimal) -> Decimal:
    return value.quantize(
        QTY,
        rounding=ROUND_HALF_UP,
    )


def money(value: Decimal) -> Decimal:
    return value.quantize(
        MONEY,
        rounding=ROUND_HALF_UP,
    )


async def create_warehouse(
    db: AsyncSession,
    data: WarehouseCreate,
) -> Warehouse:
    existing = await db.scalar(
        select(Warehouse).where(
            (Warehouse.code == data.code)
            | (Warehouse.name == data.name)
        )
    )

    if existing:
        raise ValueError(
            "Warehouse code or name already exists."
        )

    warehouse = Warehouse(**data.model_dump())

    db.add(warehouse)
    await db.commit()
    await db.refresh(warehouse)

    return warehouse


async def list_warehouses(
    db: AsyncSession,
    is_active: bool | None = True,
) -> list[Warehouse]:
    query = select(Warehouse).order_by(Warehouse.name)

    if is_active is not None:
        query = query.where(
            Warehouse.is_active == is_active
        )

    result = await db.scalars(query)

    return list(result.all())


async def get_warehouse(
    db: AsyncSession,
    warehouse_id: str,
) -> Warehouse | None:
    return await db.get(
        Warehouse,
        warehouse_id,
    )


async def update_warehouse(
    db: AsyncSession,
    warehouse: Warehouse,
    data: WarehouseUpdate,
) -> Warehouse:
    changes = data.model_dump(
        exclude_unset=True
    )

    if "name" in changes:
        existing = await db.scalar(
            select(Warehouse).where(
                Warehouse.name == changes["name"],
                Warehouse.id != warehouse.id,
            )
        )

        if existing:
            raise ValueError(
                "Warehouse name already exists."
            )

    for field, value in changes.items():
        setattr(
            warehouse,
            field,
            value,
        )

    await db.commit()
    await db.refresh(warehouse)

    return warehouse


async def create_inventory_stock(
    db: AsyncSession,
    data: InventoryStockCreate,
) -> InventoryStock:
    warehouse = await db.get(
        Warehouse,
        data.warehouse_id,
    )

    if not warehouse or not warehouse.is_active:
        raise ValueError(
            "Active warehouse not found."
        )

    product = await db.get(
        Product,
        data.product_id,
    )

    if not product or not product.is_active:
        raise ValueError(
            "Active product not found."
        )

    if data.variant_id:
        variant = await db.get(
            ProductVariant,
            data.variant_id,
        )

        if not variant:
            raise ValueError(
                "Product variant not found."
            )

        if variant.product_id != product.id:
            raise ValueError(
                "Variant does not belong to the selected product."
            )

    existing = await db.scalar(
        select(InventoryStock).where(
            InventoryStock.warehouse_id
            == data.warehouse_id,
            InventoryStock.product_id
            == data.product_id,
            InventoryStock.variant_id
            == data.variant_id,
        )
    )

    if existing:
        raise ValueError(
            "Inventory record already exists."
        )

    stock = InventoryStock(
        **data.model_dump()
    )

    db.add(stock)
    await db.commit()
    await db.refresh(stock)

    return stock


async def list_inventory(
    db: AsyncSession,
    warehouse_id: str | None = None,
    product_id: str | None = None,
) -> list[InventoryStock]:
    query = select(InventoryStock).order_by(
        InventoryStock.created_at
    )

    if warehouse_id:
        query = query.where(
            InventoryStock.warehouse_id
            == warehouse_id
        )

    if product_id:
        query = query.where(
            InventoryStock.product_id
            == product_id
        )

    result = await db.scalars(query)

    return list(result.all())


async def adjust_inventory(
    db: AsyncSession,
    data: InventoryAdjustRequest,
) -> InventoryStock:
    stock = await db.scalar(
        select(InventoryStock)
        .where(
            InventoryStock.warehouse_id
            == data.warehouse_id,
            InventoryStock.product_id
            == data.product_id,
            InventoryStock.variant_id
            == data.variant_id,
        )
        .with_for_update()
    )

    if not stock:
        raise ValueError(
            "Inventory record not found."
        )

    new_quantity = (
        stock.quantity_on_hand
        + data.quantity_delta
    )

    if new_quantity < stock.quantity_reserved:
        raise ValueError(
            "Adjustment would reduce on-hand stock "
            "below currently reserved quantity."
        )

    if new_quantity < 0:
        raise ValueError(
            "Inventory cannot become negative."
        )

    stock.quantity_on_hand = qty(
        new_quantity
    )

    await db.commit()
    await db.refresh(stock)

    return stock


async def create_replenishment_rule(
    db: AsyncSession,
    data: ReplenishmentRuleCreate,
) -> ReplenishmentRule:
    warehouse = await db.get(
        Warehouse,
        data.warehouse_id,
    )

    if not warehouse or not warehouse.is_active:
        raise ValueError(
            "Active warehouse not found."
        )

    product = await db.get(
        Product,
        data.product_id,
    )

    if not product or not product.is_active:
        raise ValueError(
            "Active product not found."
        )

    existing = await db.scalar(
        select(ReplenishmentRule).where(
            ReplenishmentRule.warehouse_id
            == data.warehouse_id,
            ReplenishmentRule.product_id
            == data.product_id,
            ReplenishmentRule.variant_id
            == data.variant_id,
        )
    )

    if existing:
        raise ValueError(
            "A replenishment rule already exists."
        )

    rule = ReplenishmentRule(
        **data.model_dump()
    )

    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return rule


async def list_replenishment_rules(
    db: AsyncSession,
    warehouse_id: str | None = None,
    product_id: str | None = None,
) -> list[ReplenishmentRule]:
    query = select(
        ReplenishmentRule
    ).order_by(
        ReplenishmentRule.created_at
    )

    if warehouse_id:
        query = query.where(
            ReplenishmentRule.warehouse_id
            == warehouse_id
        )

    if product_id:
        query = query.where(
            ReplenishmentRule.product_id
            == product_id
        )

    result = await db.scalars(query)

    return list(result.all())


async def update_replenishment_rule(
    db: AsyncSession,
    rule: ReplenishmentRule,
    data: ReplenishmentRuleUpdate,
) -> ReplenishmentRule:
    changes = data.model_dump(
        exclude_unset=True
    )

    reorder_point = changes.get(
        "reorder_point",
        rule.reorder_point,
    )

    max_stock = changes.get(
        "max_stock",
        rule.max_stock,
    )

    if (
        max_stock is not None
        and max_stock < reorder_point
    ):
        raise ValueError(
            "max_stock must be greater than or equal to reorder_point."
        )

    for field, value in changes.items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)

    return rule


async def get_available_stock(
    db: AsyncSession,
    warehouse_id: str,
    product_id: str,
    variant_id: str | None,
    lock: bool = False,
) -> InventoryStock | None:
    query = select(InventoryStock).where(
        InventoryStock.warehouse_id
        == warehouse_id,
        InventoryStock.product_id
        == product_id,
        InventoryStock.variant_id
        == variant_id,
    )

    if lock:
        query = query.with_for_update()

    return await db.scalar(query)


def _warehouse_cost(
    warehouse: Warehouse,
    quantity: Decimal,
) -> Decimal:
    if quantity <= 0:
        return Decimal("0.00")

    return money(
        warehouse.shipping_fixed_cost
        + (
            quantity
            * warehouse.shipping_cost_per_unit
            * warehouse.shipping_cost_weight
        )
    )


def _best_subset_allocation(
    candidates: list[dict],
    required: Decimal,
) -> list[dict]:
    """
    Prefer the smallest number of warehouses.
    Within that count, minimize estimated shipping cost.

    Exact subset search is used for <= 10 candidates.
    For larger sets, a cost-aware greedy fallback is used.
    """
    candidates = [
        candidate
        for candidate in candidates
        if candidate["available"] > 0
    ]

    if required <= 0 or not candidates:
        return []

    if len(candidates) > 10:
        candidates = sorted(
            candidates,
            key=lambda item: (
                item["unit_cost"],
                -item["available"],
            )
        )

        remaining = required
        allocation = []

        for candidate in candidates:
            if remaining <= 0:
                break

            take = min(
                remaining,
                candidate["available"],
            )

            allocation.append(
                {
                    **candidate,
                    "quantity": qty(take),
                }
            )

            remaining -= take

        return allocation

    best = None

    for size in range(
        1,
        len(candidates) + 1,
    ):
        for subset in combinations(
            candidates,
            size,
        ):
            total_available = sum(
                (
                    item["available"]
                    for item in subset
                ),
                Decimal("0"),
            )

            if total_available < required:
                continue

            remaining = required
            subset_allocation = []

            for candidate in sorted(
                subset,
                key=lambda item: item["unit_cost"],
            ):
                if remaining <= 0:
                    break

                take = min(
                    remaining,
                    candidate["available"],
                )

                subset_allocation.append(
                    {
                        **candidate,
                        "quantity": qty(take),
                    }
                )

                remaining -= take

            allocation_cost = sum(
                (
                    _warehouse_cost(
                        item["warehouse"],
                        item["quantity"],
                    )
                    for item in subset_allocation
                ),
                Decimal("0"),
            )

            score = (
                size,
                allocation_cost,
            )

            if (
                best is None
                or score < best["score"]
            ):
                best = {
                    "score": score,
                    "allocation": subset_allocation,
                }

        if best is not None:
            return best["allocation"]

    # Not enough total stock.
    remaining = required
    allocation = []

    for candidate in sorted(
        candidates,
        key=lambda item: item["unit_cost"],
    ):
        if remaining <= 0:
            break

        take = min(
            remaining,
            candidate["available"],
        )

        if take > 0:
            allocation.append(
                {
                    **candidate,
                    "quantity": qty(take),
                }
            )

            remaining -= take

    return allocation


async def recommend_quote_fulfillment(
    db: AsyncSession,
    quote: Quotation,
) -> dict:
    if quote.status not in {
        QuoteStatus.APPROVED,
        QuoteStatus.CONFIRMED,
    }:
        raise ValueError(
            "Fulfillment planning requires an approved or confirmed quotation."
        )

    lines = list(
        (
            await db.scalars(
                select(QuoteLine)
                .where(
                    QuoteLine.quotation_id
                    == quote.id
                )
                .order_by(
                    QuoteLine.line_number
                )
            )
        ).all()
    )

    if not lines:
        raise ValueError(
            "Quotation has no lines."
        )

    line_plans = []
    estimated_cost = Decimal("0")
    shipment_keys = set()

    for line in lines:
        product = await db.get(
            Product,
            line.product_id,
        )

        if not product:
            raise ValueError(
                f"Product for line {line.line_number} not found."
            )

        # Services and subscriptions do not consume warehouse stock.
        if product.product_type != ProductType.HARDWARE:
            continue

        warehouses = list(
            (
                await db.scalars(
                    select(Warehouse)
                    .join(
                        InventoryStock,
                        InventoryStock.warehouse_id
                        == Warehouse.id,
                    )
                    .where(
                        Warehouse.is_active.is_(True),
                        InventoryStock.product_id
                        == product.id,
                        InventoryStock.variant_id
                        == line.variant_id,
                    )
                )
            ).all()
        )

        candidates = []

        for warehouse in warehouses:
            stock = await get_available_stock(
                db,
                warehouse.id,
                product.id,
                line.variant_id,
            )

            if not stock:
                continue

            available = max(
                stock.quantity_on_hand
                - stock.quantity_reserved,
                Decimal("0"),
            )

            if available <= 0:
                continue

            unit_cost = (
                warehouse.shipping_cost_per_unit
                * warehouse.shipping_cost_weight
            )

            candidates.append(
                {
                    "warehouse": warehouse,
                    "available": available,
                    "unit_cost": unit_cost,
                }
            )

        allocation = _best_subset_allocation(
            candidates,
            line.quantity,
        )

        allocated_total = sum(
            (
                item["quantity"]
                for item in allocation
            ),
            Decimal("0"),
        )

        remaining = qty(
            line.quantity
            - allocated_total
        )

        line_plans.append(
            {
                "quote_line_id": line.id,
                "product_id": product.id,
                "requested_quantity": line.quantity,
                "allocated_quantity": allocated_total,
                "backordered_quantity": remaining,
                "allocations": [
                    {
                        "warehouse_id": item["warehouse"].id,
                        "warehouse_name": item["warehouse"].name,
                        "quantity": item["quantity"],
                        "shipment_cost": _warehouse_cost(
                            item["warehouse"],
                            item["quantity"],
                        ),
                    }
                    for item in allocation
                ],
            }
        )

        for item in allocation:
            shipment_keys.add(
                item["warehouse"].id
            )

            estimated_cost += _warehouse_cost(
                item["warehouse"],
                item["quantity"],
            )

    return {
        "shipment_count": len(shipment_keys),
        "estimated_shipping_cost": money(
            estimated_cost
        ),
        "lines": line_plans,
    }


async def create_fulfillment_plan(
    db: AsyncSession,
    quote: Quotation,
) -> FulfillmentPlan:
    existing = await db.scalar(
        select(FulfillmentPlan).where(
            FulfillmentPlan.quotation_id
            == quote.id
        )
    )

    if existing and existing.status != FulfillmentPlanStatus.CANCELLED:
        raise ValueError(
            "A fulfillment plan already exists for this quotation."
        )

    recommendation = await recommend_quote_fulfillment(
        db,
        quote,
    )

    plan = FulfillmentPlan(
        quotation_id=quote.id,
        status=FulfillmentPlanStatus.PROPOSED,
        estimated_shipment_count=recommendation[
            "shipment_count"
        ],
        estimated_shipping_cost=recommendation[
            "estimated_shipping_cost"
        ],
    )

    db.add(plan)
    await db.flush()

    for line in recommendation["lines"]:
        for allocation in line["allocations"]:
            db.add(
                FulfillmentAllocation(
                    fulfillment_plan_id=plan.id,
                    quote_line_id=line["quote_line_id"],
                    warehouse_id=allocation[
                        "warehouse_id"
                    ],
                    requested_quantity=line[
                        "requested_quantity"
                    ],
                    allocated_quantity=allocation[
                        "quantity"
                    ],
                    shipment_cost=allocation[
                        "shipment_cost"
                    ],
                    status=FulfillmentAllocationStatus.RESERVED,
                )
            )

        if line["backordered_quantity"] > 0:
            db.add(
                Backorder(
                    quotation_id=quote.id,
                    quote_line_id=line["quote_line_id"],
                    quantity_remaining=line[
                        "backordered_quantity"
                    ],
                    status=BackorderStatus.OPEN,
                )
            )

    await db.commit()
    await db.refresh(plan)

    return plan


async def accept_fulfillment_plan(
    db: AsyncSession,
    plan: FulfillmentPlan,
) -> FulfillmentPlan:
    if plan.status != FulfillmentPlanStatus.PROPOSED:
        raise ValueError(
            "Only proposed fulfillment plans can be accepted."
        )

    allocations = list(
        (
            await db.scalars(
                select(FulfillmentAllocation).where(
                    FulfillmentAllocation.fulfillment_plan_id
                    == plan.id
                )
            )
        ).all()
    )

    for allocation in allocations:
        stock = await get_available_stock(
            db,
            allocation.warehouse_id,
            (
                await db.scalar(
                    select(QuoteLine.product_id).where(
                        QuoteLine.id
                        == allocation.quote_line_id
                    )
                )
            ),
            (
                await db.scalar(
                    select(QuoteLine.variant_id).where(
                        QuoteLine.id
                        == allocation.quote_line_id
                    )
                )
            ),
            lock=True,
        )

        if not stock:
            raise ValueError(
                "Inventory disappeared before fulfillment plan acceptance."
            )

        available = (
            stock.quantity_on_hand
            - stock.quantity_reserved
        )

        if (
            allocation.allocated_quantity
            > available
        ):
            raise ValueError(
                "Insufficient available stock. "
                "Regenerate the fulfillment plan."
            )

        stock.quantity_reserved += (
            allocation.allocated_quantity
        )

    plan.status = FulfillmentPlanStatus.ACCEPTED
    plan.accepted_at = utcnow()

    await db.commit()
    await db.refresh(plan)

    return plan


async def fulfill_allocation(
    db: AsyncSession,
    allocation: FulfillmentAllocation,
    quantity: Decimal,
) -> FulfillmentAllocation:
    if quantity <= 0:
        raise ValueError(
            "Fulfillment quantity must be greater than zero."
        )

    remaining = (
        allocation.allocated_quantity
        - allocation.fulfilled_quantity
    )

    if quantity > remaining:
        raise ValueError(
            "Cannot fulfill more than the allocated quantity."
        )

    quote_line = await db.get(
        QuoteLine,
        allocation.quote_line_id,
    )

    if not quote_line:
        raise ValueError(
            "Quote line not found."
        )

    stock = await get_available_stock(
        db,
        allocation.warehouse_id,
        quote_line.product_id,
        quote_line.variant_id,
        lock=True,
    )

    if not stock:
        raise ValueError(
            "Inventory record not found."
        )

    remaining_available_reserved = (
        stock.quantity_reserved
    )

    if quantity > remaining_available_reserved:
        raise ValueError(
            "Reserved inventory is insufficient."
        )

    stock.quantity_reserved -= quantity
    stock.quantity_on_hand -= quantity

    allocation.fulfilled_quantity += quantity

    if (
        allocation.fulfilled_quantity
        >= allocation.allocated_quantity
    ):
        allocation.status = (
            FulfillmentAllocationStatus.FULFILLED
        )
    else:
        allocation.status = (
            FulfillmentAllocationStatus.PARTIALLY_FULFILLED
        )

    await _refresh_plan_status(
        db,
        allocation.fulfillment_plan_id,
    )

    await db.commit()
    await db.refresh(allocation)

    return allocation


async def _refresh_plan_status(
    db: AsyncSession,
    plan_id: str,
) -> None:
    plan = await db.get(
        FulfillmentPlan,
        plan_id,
    )

    if not plan:
        return

    allocations = list(
        (
            await db.scalars(
                select(FulfillmentAllocation).where(
                    FulfillmentAllocation.fulfillment_plan_id
                    == plan_id
                )
            )
        ).all()
    )

    backorders = list(
        (
            await db.scalars(
                select(Backorder).where(
                    Backorder.quotation_id
                    == plan.quotation_id,
                    Backorder.status
                    == BackorderStatus.OPEN,
                )
            )
        ).all()
    )

    if allocations and all(
        allocation.status
        == FulfillmentAllocationStatus.FULFILLED
        for allocation in allocations
    ):
        plan.status = (
            FulfillmentPlanStatus.FULFILLED
        )
    elif any(
        allocation.fulfilled_quantity > 0
        for allocation in allocations
    ):
        plan.status = (
            FulfillmentPlanStatus.PARTIALLY_FULFILLED
        )

    if any(
        backorder.quantity_remaining > 0
        for backorder in backorders
    ):
        plan.status = (
            FulfillmentPlanStatus.BACKORDERED
        )


async def consolidate_backorder(
    db: AsyncSession,
    backorder: Backorder,
) -> Backorder:
    if backorder.status != BackorderStatus.OPEN:
        raise ValueError(
            "Only open backorders can be consolidated."
        )

    quote_line = await db.get(
        QuoteLine,
        backorder.quote_line_id,
    )

    if not quote_line:
        raise ValueError(
            "Quote line not found."
        )

    warehouses = list(
        (
            await db.scalars(
                select(Warehouse)
                .join(
                    InventoryStock,
                    InventoryStock.warehouse_id
                    == Warehouse.id,
                )
                .where(
                    Warehouse.is_active.is_(True),
                    InventoryStock.product_id
                    == quote_line.product_id,
                    InventoryStock.variant_id
                    == quote_line.variant_id,
                )
            )
        ).all()
    )

    candidates = []

    for warehouse in warehouses:
        stock = await get_available_stock(
            db,
            warehouse.id,
            quote_line.product_id,
            quote_line.variant_id,
        )

        if not stock:
            continue

        available = (
            stock.quantity_on_hand
            - stock.quantity_reserved
        )

        if available <= 0:
            continue

        candidates.append(
            {
                "warehouse": warehouse,
                "available": available,
                "unit_cost": (
                    warehouse.shipping_cost_per_unit
                    * warehouse.shipping_cost_weight
                ),
            }
        )

    allocation = _best_subset_allocation(
        candidates,
        backorder.quantity_remaining,
    )

    if not allocation:
        return backorder

    # Locate the existing fulfillment plan.
    plan = await db.scalar(
        select(FulfillmentPlan).where(
            FulfillmentPlan.quotation_id
            == backorder.quotation_id
        )
    )

    if not plan:
        raise ValueError(
            "Fulfillment plan not found."
        )

    for item in allocation:
        stock = await get_available_stock(
            db,
            item["warehouse"].id,
            quote_line.product_id,
            quote_line.variant_id,
            lock=True,
        )

        if not stock:
            continue

        quantity_to_allocate = item["quantity"]

        stock.quantity_reserved += quantity_to_allocate

        db.add(
            FulfillmentAllocation(
                fulfillment_plan_id=plan.id,
                quote_line_id=quote_line.id,
                warehouse_id=item["warehouse"].id,
                requested_quantity=quote_line.quantity,
                allocated_quantity=quantity_to_allocate,
                shipment_cost=_warehouse_cost(
                    item["warehouse"],
                    quantity_to_allocate,
                ),
                status=FulfillmentAllocationStatus.RESERVED,
            )
        )

        backorder.quantity_remaining -= (
            quantity_to_allocate
        )

    backorder.quantity_remaining = max(
        qty(backorder.quantity_remaining),
        Decimal("0.000"),
    )

    if backorder.quantity_remaining == 0:
        backorder.status = BackorderStatus.FULFILLED
    else:
        backorder.status = BackorderStatus.ALLOCATED

    await db.commit()
    await db.refresh(backorder)

    return backorder


async def cancel_fulfillment_plan(
    db: AsyncSession,
    plan: FulfillmentPlan,
) -> None:
    if plan.status == FulfillmentPlanStatus.FULFILLED:
        raise ValueError(
            "A fulfilled plan cannot be cancelled."
        )

    allocations = list(
        (
            await db.scalars(
                select(FulfillmentAllocation).where(
                    FulfillmentAllocation.fulfillment_plan_id
                    == plan.id
                )
            )
        ).all()
    )

    for allocation in allocations:
        outstanding_reserved = (
            allocation.allocated_quantity
            - allocation.fulfilled_quantity
        )

        if outstanding_reserved <= 0:
            continue

        quote_line = await db.get(
            QuoteLine,
            allocation.quote_line_id,
        )

        if not quote_line:
            continue

        stock = await get_available_stock(
            db,
            allocation.warehouse_id,
            quote_line.product_id,
            quote_line.variant_id,
            lock=True,
        )

        if stock:
            stock.quantity_reserved = max(
                stock.quantity_reserved
                - outstanding_reserved,
                Decimal("0.000"),
            )

        allocation.status = (
            FulfillmentAllocationStatus.CANCELLED
        )

    plan.status = FulfillmentPlanStatus.CANCELLED

    await db.commit()

async def get_available_stock(
    db: AsyncSession,
    warehouse_id: str,
    product_id: str,
    variant_id: str | None,
    lock: bool = False,
) -> InventoryStock | None:
    query = select(InventoryStock).where(
        InventoryStock.warehouse_id == warehouse_id,
        InventoryStock.product_id == product_id,
        InventoryStock.variant_id == variant_id,
    )

    if lock:
        query = query.with_for_update()

    return await db.scalar(query)

def _warehouse_cost(
    warehouse: Warehouse,
    quantity: Decimal,
) -> Decimal:
    if quantity <= 0:
        return Decimal("0.00")

    return money(
        warehouse.shipping_fixed_cost
        + (
            quantity
            * warehouse.shipping_cost_per_unit
            * warehouse.shipping_cost_weight
        )
    )

async def manual_override_allocation(
    db: AsyncSession,
    plan: FulfillmentPlan,
    quote_line_id: str,
    warehouse_id: str,
    quantity: Decimal,
) -> FulfillmentAllocation:
    if plan.status != FulfillmentPlanStatus.PROPOSED:
        raise ValueError(
            "Manual override is only allowed on a proposed plan."
        )

    quote_line = await db.get(
        QuoteLine,
        quote_line_id,
    )

    if not quote_line:
        raise ValueError(
            "Quote line not found."
        )

    product = await db.get(
        Product,
        quote_line.product_id,
    )

    if not product or product.product_type != ProductType.HARDWARE:
        raise ValueError(
            "Only physical hardware lines require warehouse allocation."
        )

    existing_allocated = await db.scalar(
        select(FulfillmentAllocation).where(
            FulfillmentAllocation.fulfillment_plan_id == plan.id,
            FulfillmentAllocation.quote_line_id == quote_line_id,
        )
    )

    current_total = Decimal("0")

    if existing_allocated:
        current_total = existing_allocated.allocated_quantity

    total_after_override = (
        current_total + quantity
    )

    if total_after_override > quote_line.quantity:
        raise ValueError(
            "Manual allocation exceeds the quote line quantity."
        )

    stock = await get_available_stock(
        db,
        warehouse_id,
        product.id,
        quote_line.variant_id,
    )

    if not stock:
        raise ValueError(
            "No inventory record exists for this warehouse/product."
        )

    available = (
        stock.quantity_on_hand
        - stock.quantity_reserved
    )

    if quantity > available:
        raise ValueError(
            "Requested override quantity exceeds available stock."
        )

    warehouse = await db.get(
        Warehouse,
        warehouse_id,
    )

    if not warehouse or not warehouse.is_active:
        raise ValueError(
            "Active warehouse not found."
        )

    allocation = FulfillmentAllocation(
        fulfillment_plan_id=plan.id,
        quote_line_id=quote_line_id,
        warehouse_id=warehouse_id,
        requested_quantity=quote_line.quantity,
        allocated_quantity=quantity,
        shipment_cost=_warehouse_cost(
            warehouse,
            quantity,
        ),
        manual_override=True,
        status=FulfillmentAllocationStatus.RESERVED,
    )

    db.add(allocation)

    await db.commit()
    await db.refresh(allocation)

    return allocation

def money(value: Decimal) -> Decimal:
    return value.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )