from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import (
    BackorderStatus,
    FulfillmentAllocationStatus,
    FulfillmentPlanStatus,
)


class WarehouseCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    code: str = Field(
        min_length=2,
        max_length=40,
        pattern=r"^[A-Za-z0-9_-]+$",
    )
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    shipping_fixed_cost: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
    )
    shipping_cost_per_unit: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
    )
    shipping_cost_weight: Decimal = Field(
        default=Decimal("1.00"),
        gt=0,
        le=1000,
    )


class WarehouseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    shipping_fixed_cost: Decimal | None = Field(default=None, ge=0)
    shipping_cost_per_unit: Decimal | None = Field(default=None, ge=0)
    shipping_cost_weight: Decimal | None = Field(
        default=None,
        gt=0,
        le=1000,
    )
    is_active: bool | None = None


class WarehouseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    code: str
    address: str | None
    city: str | None
    state: str | None
    shipping_fixed_cost: Decimal
    shipping_cost_per_unit: Decimal
    shipping_cost_weight: Decimal
    is_active: bool


class InventoryStockCreate(BaseModel):
    warehouse_id: str
    product_id: str
    variant_id: str | None = None
    quantity_on_hand: Decimal = Field(
        default=Decimal("0.000"),
        ge=0,
    )


class InventoryAdjustRequest(BaseModel):
    warehouse_id: str
    product_id: str
    variant_id: str | None = None
    quantity_delta: Decimal
    reason: str = Field(min_length=3, max_length=500)


class InventoryStockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    warehouse_id: str
    product_id: str
    variant_id: str | None
    quantity_on_hand: Decimal
    quantity_reserved: Decimal
    available_quantity: Decimal


class ReplenishmentRuleCreate(BaseModel):
    warehouse_id: str
    product_id: str
    variant_id: str | None = None
    reorder_point: Decimal = Field(ge=0)
    reorder_quantity: Decimal = Field(gt=0)
    max_stock: Decimal | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_stock_levels(self):
        if (
            self.max_stock is not None
            and self.max_stock < self.reorder_point
        ):
            raise ValueError(
                "max_stock must be greater than or equal to reorder_point."
            )
        return self


class ReplenishmentRuleUpdate(BaseModel):
    reorder_point: Decimal | None = Field(default=None, ge=0)
    reorder_quantity: Decimal | None = Field(default=None, gt=0)
    max_stock: Decimal | None = Field(default=None, gt=0)


class ReplenishmentRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    warehouse_id: str
    product_id: str
    variant_id: str | None
    reorder_point: Decimal
    reorder_quantity: Decimal
    max_stock: Decimal | None


class FulfillmentAllocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    fulfillment_plan_id: str
    quote_line_id: str
    warehouse_id: str
    requested_quantity: Decimal
    allocated_quantity: Decimal
    fulfilled_quantity: Decimal
    shipment_cost: Decimal
    status: FulfillmentAllocationStatus
    manual_override: bool


class BackorderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    quotation_id: str
    quote_line_id: str
    quantity_remaining: Decimal
    status: BackorderStatus
    expected_at: datetime | None


class FulfillmentPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    quotation_id: str
    status: FulfillmentPlanStatus
    estimated_shipment_count: int
    estimated_shipping_cost: Decimal
    accepted_at: datetime | None
    allocations: list[FulfillmentAllocationResponse]


class FulfillmentOverrideRequest(BaseModel):
    warehouse_id: str
    quantity: Decimal = Field(gt=0)

class FulfillmentManualOverrideRequest(BaseModel):
    quote_line_id: str
    warehouse_id: str
    quantity: Decimal = Field(gt=0)