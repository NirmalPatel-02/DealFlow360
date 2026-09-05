from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import CustomerTier, ProductType


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    code: str = Field(min_length=2, max_length=30, pattern=r"^[A-Za-z0-9_-]+$")
    description: str | None = Field(default=None, max_length=500)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    code: str
    description: str | None
    is_active: bool


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    code: str = Field(min_length=2, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    category_id: str
    product_type: ProductType
    description: str | None = Field(default=None, max_length=1000)
    base_price: Decimal = Field(ge=0)
    cost_price: Decimal = Field(ge=0)
    unit: str = Field(default="unit", min_length=1, max_length=30)
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)

class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    category_id: str | None = None
    product_type: ProductType | None = None
    description: str | None = Field(default=None, max_length=1000)
    base_price: Decimal | None = Field(default=None, ge=0)
    cost_price: Decimal | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    tax_rate: Decimal | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    code: str
    category_id: str
    product_type: ProductType
    description: str | None
    base_price: Decimal
    cost_price: Decimal
    unit: str
    tax_rate: Decimal
    is_active: bool


class VariantCreate(BaseModel):
    attribute: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=100)
    sku: str | None = Field(default=None, max_length=80)
    extra_price: Decimal = Field(default=Decimal("0.00"), ge=0)


class VariantUpdate(BaseModel):
    attribute: str | None = Field(default=None, min_length=1, max_length=100)
    value: str | None = Field(default=None, min_length=1, max_length=100)
    sku: str | None = Field(default=None, max_length=80)
    extra_price: Decimal | None = Field(default=None, ge=0)


class VariantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    attribute: str
    value: str
    sku: str | None
    extra_price: Decimal


class PriceListCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    code: str = Field(min_length=2, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    customer_tier: CustomerTier
    currency: str = Field(min_length=3, max_length=3)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        value = value.upper()
        if not value.isalpha():
            raise ValueError("Currency must contain letters only.")
        return value


class PriceListUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    customer_tier: CustomerTier | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    is_active: bool | None = None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.upper()
        if not value.isalpha():
            raise ValueError("Currency must contain letters only.")
        return value


class PriceListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    code: str
    customer_tier: CustomerTier
    currency: str
    is_active: bool


class PriceListItemCreate(BaseModel):
    product_id: str
    variant_id: str | None = None
    price: Decimal = Field(ge=0)


class PriceListItemUpdate(BaseModel):
    price: Decimal = Field(ge=0)


class PriceListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    price_list_id: str
    product_id: str
    variant_id: str | None
    price: Decimal