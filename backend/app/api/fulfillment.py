from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.warehouse import FulfillmentManualOverrideRequest
from app.api.dependencies import (
    require_admin,
    require_finance_ops,
    require_internal_user,
)
from app.db.session import get_db
from app.models.backorder import Backorder
from app.models.enums import FulfillmentPlanStatus
from app.models.fulfillment_allocation import FulfillmentAllocation
from app.models.fulfillment_plan import FulfillmentPlan
from app.models.inventory_stock import InventoryStock
from app.models.replenishment_rule import ReplenishmentRule
from app.models.user import User
from app.models.warehouse import Warehouse
from app.schemas.warehouse import (
    BackorderResponse,
    FulfillmentAllocationResponse,
    FulfillmentPlanResponse,
    InventoryAdjustRequest,
    InventoryStockCreate,
    InventoryStockResponse,
    ReplenishmentRuleCreate,
    ReplenishmentRuleResponse,
    ReplenishmentRuleUpdate,
    WarehouseCreate,
    WarehouseResponse,
    WarehouseUpdate,
)
from app.services.fulfillment import (
    accept_fulfillment_plan,
    adjust_inventory,
    consolidate_backorder,
    create_fulfillment_plan,
    create_inventory_stock,
    create_replenishment_rule,
    create_warehouse,
    fulfill_allocation,
    get_warehouse,
    list_inventory,
    list_replenishment_rules,
    list_warehouses,
    recommend_quote_fulfillment,
    update_replenishment_rule,
    update_warehouse,
    cancel_fulfillment_plan,
)
from app.services.quotation import get_quotation
from app.services.fulfillment import manual_override_allocation
from decimal import Decimal, ROUND_HALF_UP
from itertools import combinations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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

router = APIRouter(
    prefix="/api",
    tags=["Warehouse & Fulfillment"],
)


# =========================================================
# Warehouses
# =========================================================

@router.post(
    "/warehouses",
    response_model=WarehouseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_warehouse_route(
    data: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        return await create_warehouse(db, data)
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc


@router.get(
    "/warehouses",
    response_model=list[WarehouseResponse],
)
async def list_warehouses_route(
    is_active: bool | None = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    return await list_warehouses(db, is_active)


@router.get(
    "/warehouses/{warehouse_id}",
    response_model=WarehouseResponse,
)
async def get_warehouse_route(
    warehouse_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    warehouse = await get_warehouse(
        db,
        warehouse_id,
    )

    if not warehouse:
        raise HTTPException(
            status_code=404,
            detail="Warehouse not found.",
        )

    return warehouse


@router.patch(
    "/warehouses/{warehouse_id}",
    response_model=WarehouseResponse,
)
async def update_warehouse_route(
    warehouse_id: str,
    data: WarehouseUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    warehouse = await get_warehouse(
        db,
        warehouse_id,
    )

    if not warehouse:
        raise HTTPException(
            status_code=404,
            detail="Warehouse not found.",
        )

    try:
        return await update_warehouse(
            db,
            warehouse,
            data,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc


# =========================================================
# Inventory
# =========================================================

@router.post(
    "/inventory",
    response_model=InventoryStockResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_inventory_route(
    data: InventoryStockCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_finance_ops),
):
    try:
        stock = await create_inventory_stock(
            db,
            data,
        )

        return {
            "id": stock.id,
            "warehouse_id": stock.warehouse_id,
            "product_id": stock.product_id,
            "variant_id": stock.variant_id,
            "quantity_on_hand": stock.quantity_on_hand,
            "quantity_reserved": stock.quantity_reserved,
            "available_quantity": (
                stock.quantity_on_hand
                - stock.quantity_reserved
            ),
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.get(
    "/inventory",
    response_model=list[InventoryStockResponse],
)
async def list_inventory_route(
    warehouse_id: str | None = None,
    product_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    stocks = await list_inventory(
        db,
        warehouse_id,
        product_id,
    )

    return [
        {
            "id": stock.id,
            "warehouse_id": stock.warehouse_id,
            "product_id": stock.product_id,
            "variant_id": stock.variant_id,
            "quantity_on_hand": stock.quantity_on_hand,
            "quantity_reserved": stock.quantity_reserved,
            "available_quantity": (
                stock.quantity_on_hand
                - stock.quantity_reserved
            ),
        }
        for stock in stocks
    ]


@router.post(
    "/inventory/adjust",
    response_model=InventoryStockResponse,
)
async def adjust_inventory_route(
    data: InventoryAdjustRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_finance_ops),
):
    try:
        stock = await adjust_inventory(
            db,
            data,
        )

        return {
            "id": stock.id,
            "warehouse_id": stock.warehouse_id,
            "product_id": stock.product_id,
            "variant_id": stock.variant_id,
            "quantity_on_hand": stock.quantity_on_hand,
            "quantity_reserved": stock.quantity_reserved,
            "available_quantity": (
                stock.quantity_on_hand
                - stock.quantity_reserved
            ),
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


# =========================================================
# Replenishment
# =========================================================

@router.post(
    "/replenishment-rules",
    response_model=ReplenishmentRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_replenishment_route(
    data: ReplenishmentRuleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        return await create_replenishment_rule(
            db,
            data,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc


@router.get(
    "/replenishment-rules",
    response_model=list[ReplenishmentRuleResponse],
)
async def list_replenishment_route(
    warehouse_id: str | None = None,
    product_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    return await list_replenishment_rules(
        db,
        warehouse_id,
        product_id,
    )


@router.patch(
    "/replenishment-rules/{rule_id}",
    response_model=ReplenishmentRuleResponse,
)
async def update_replenishment_route(
    rule_id: str,
    data: ReplenishmentRuleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    rule = await db.get(
        ReplenishmentRule,
        rule_id,
    )

    if not rule:
        raise HTTPException(
            status_code=404,
            detail="Replenishment rule not found.",
        )

    try:
        return await update_replenishment_rule(
            db,
            rule,
            data,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


# =========================================================
# Fulfillment
# =========================================================

@router.get(
    "/fulfillment/quotes/{quote_id}/recommendation",
)
async def fulfillment_recommendation_route(
    quote_id: str,
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
        return await recommend_quote_fulfillment(
            db,
            quote,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.post(
    "/fulfillment/quotes/{quote_id}/plan",
    response_model=FulfillmentPlanResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_fulfillment_plan_route(
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_finance_ops),
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
        return await create_fulfillment_plan(
            db,
            quote,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.post(
    "/fulfillment/plans/{plan_id}/accept",
    response_model=FulfillmentPlanResponse,
)
async def accept_fulfillment_plan_route(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_finance_ops),
):
    plan = await db.get(
        FulfillmentPlan,
        plan_id,
    )

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Fulfillment plan not found.",
        )

    try:
        return await accept_fulfillment_plan(
            db,
            plan,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc


@router.get(
    "/fulfillment/plans/{plan_id}",
    response_model=FulfillmentPlanResponse,
)
async def get_fulfillment_plan_route(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    plan = await db.get(
        FulfillmentPlan,
        plan_id,
    )

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Fulfillment plan not found.",
        )

    return plan


@router.post(
    "/fulfillment/allocations/{allocation_id}/fulfill",
    response_model=FulfillmentAllocationResponse,
)
async def fulfill_allocation_route(
    allocation_id: str,
    quantity: Decimal = Query(gt=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_finance_ops),
):
    allocation = await db.get(
        FulfillmentAllocation,
        allocation_id,
    )

    if not allocation:
        raise HTTPException(
            status_code=404,
            detail="Fulfillment allocation not found.",
        )

    try:
        return await fulfill_allocation(
            db,
            allocation,
            quantity,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc


@router.get(
    "/fulfillment/backorders",
    response_model=list[BackorderResponse],
)
async def list_backorders_route(
    status_value: str | None = Query(
        default=None,
        alias="status",
    ),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    query = select(Backorder).order_by(
        desc(Backorder.created_at)
    )

    if status_value:
        query = query.where(
            Backorder.status == status_value
        )

    result = await db.scalars(query)

    return list(result.all())


@router.post(
    "/fulfillment/backorders/{backorder_id}/consolidate",
    response_model=BackorderResponse,
)
async def consolidate_backorder_route(
    backorder_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_finance_ops),
):
    backorder = await db.get(
        Backorder,
        backorder_id,
    )

    if not backorder:
        raise HTTPException(
            status_code=404,
            detail="Backorder not found.",
        )

    try:
        return await consolidate_backorder(
            db,
            backorder,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc


@router.post(
    "/fulfillment/plans/{plan_id}/cancel",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def cancel_fulfillment_plan_route(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_finance_ops),
):
    plan = await db.get(
        FulfillmentPlan,
        plan_id,
    )

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Fulfillment plan not found.",
        )

    try:
        await cancel_fulfillment_plan(
            db,
            plan,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc
    
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