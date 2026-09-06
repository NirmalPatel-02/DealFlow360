from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.price_list import PriceList
from app.models.price_list_item import PriceListItem
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.schemas.product import (
    CategoryCreate,
    CategoryUpdate,
    PriceListCreate,
    PriceListItemCreate,
    PriceListItemUpdate,
    PriceListUpdate,
    ProductCreate,
    ProductUpdate,
    VariantCreate,
    VariantUpdate,
)


async def create_category(db: AsyncSession, data: CategoryCreate) -> Category:
    existing = await db.scalar(
        select(Category).where(
            or_(Category.code == data.code, Category.name == data.name)
        )
    )
    if existing:
        raise ValueError("Category code or name already exists.")

    category = Category(**data.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def list_categories(
    db: AsyncSession,
    search: str | None = None,
    is_active: bool | None = None,
) -> list[Category]:
    query = select(Category).order_by(Category.name)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Category.name.ilike(pattern),
                Category.code.ilike(pattern),
            )
        )

    if is_active is not None:
        query = query.where(Category.is_active == is_active)

    result = await db.scalars(query)
    return list(result.all())


async def get_category(db: AsyncSession, category_id: str) -> Category | None:
    return await db.get(Category, category_id)


async def update_category(
    db: AsyncSession,
    category: Category,
    data: CategoryUpdate,
) -> Category:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)
    return category


async def create_product(db: AsyncSession, data: ProductCreate) -> Product:
    category = await db.get(Category, data.category_id)
    if not category or not category.is_active:
        raise ValueError("Active category not found.")

    existing = await db.scalar(
        select(Product).where(Product.code == data.code)
    )
    if existing:
        raise ValueError("Product code already exists.")

    product = Product(**data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def list_products(
    db: AsyncSession,
    search: str | None = None,
    category_id: str | None = None,
    product_type: str | None = None,
    is_active: bool | None = True,
    skip: int = 0,
    limit: int = 50,
) -> list[Product]:
    query = select(Product).order_by(Product.name).offset(skip).limit(limit)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Product.name.ilike(pattern),
                Product.code.ilike(pattern),
            )
        )

    if category_id:
        query = query.where(Product.category_id == category_id)

    if product_type:
        query = query.where(Product.product_type == product_type)

    if is_active is not None:
        query = query.where(Product.is_active == is_active)

    result = await db.scalars(query)
    return list(result.all())


async def get_product(db: AsyncSession, product_id: str) -> Product | None:
    return await db.get(Product, product_id)


async def update_product(
    db: AsyncSession,
    product: Product,
    data: ProductUpdate,
) -> Product:
    changes = data.model_dump(exclude_unset=True)

    if "category_id" in changes:
        category = await db.get(Category, changes["category_id"])
        if not category or not category.is_active:
            raise ValueError("Active category not found.")

    for field, value in changes.items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)
    return product


async def create_variant(
    db: AsyncSession,
    product_id: str,
    data: VariantCreate,
) -> ProductVariant:
    product = await db.get(Product, product_id)
    if not product:
        raise ValueError("Product not found.")

    existing = await db.scalar(
        select(ProductVariant).where(
            ProductVariant.product_id == product_id,
            ProductVariant.attribute == data.attribute,
            ProductVariant.value == data.value,
        )
    )

    if existing:
        raise ValueError("This product variant already exists.")

    variant = ProductVariant(
        product_id=product_id,
        **data.model_dump(),
    )

    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return variant


async def list_variants(
    db: AsyncSession,
    product_id: str,
) -> list[ProductVariant]:
    result = await db.scalars(
        select(ProductVariant)
        .where(ProductVariant.product_id == product_id)
        .order_by(ProductVariant.attribute, ProductVariant.value)
    )
    return list(result.all())


async def update_variant(
    db: AsyncSession,
    variant: ProductVariant,
    data: VariantUpdate,
) -> ProductVariant:
    changes = data.model_dump(exclude_unset=True)

    for field, value in changes.items():
        setattr(variant, field, value)

    await db.commit()
    await db.refresh(variant)
    return variant


async def create_price_list(
    db: AsyncSession,
    data: PriceListCreate,
) -> PriceList:
    existing = await db.scalar(
        select(PriceList).where(PriceList.code == data.code)
    )
    if existing:
        raise ValueError("Price list code already exists.")

    price_list = PriceList(**data.model_dump())
    db.add(price_list)
    await db.commit()
    await db.refresh(price_list)
    return price_list


async def list_price_lists(
    db: AsyncSession,
    customer_tier: str | None = None,
    currency: str | None = None,
    is_active: bool | None = True,
) -> list[PriceList]:
    query = select(PriceList).order_by(PriceList.name)

    if customer_tier:
        query = query.where(PriceList.customer_tier == customer_tier)

    if currency:
        query = query.where(PriceList.currency == currency.upper())

    if is_active is not None:
        query = query.where(PriceList.is_active == is_active)

    result = await db.scalars(query)
    return list(result.all())


async def get_price_list(
    db: AsyncSession,
    price_list_id: str,
) -> PriceList | None:
    return await db.get(PriceList, price_list_id)


async def update_price_list(
    db: AsyncSession,
    price_list: PriceList,
    data: PriceListUpdate,
) -> PriceList:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(price_list, field, value)

    await db.commit()
    await db.refresh(price_list)
    return price_list


async def add_price_list_item(
    db: AsyncSession,
    price_list_id: str,
    data: PriceListItemCreate,
) -> PriceListItem:
    price_list = await db.get(PriceList, price_list_id)
    if not price_list:
        raise ValueError("Price list not found.")

    product = await db.get(Product, data.product_id)
    if not product or not product.is_active:
        raise ValueError("Active product not found.")

    if data.variant_id:
        variant = await db.get(ProductVariant, data.variant_id)
        if not variant or variant.product_id != data.product_id:
            raise ValueError("Variant does not belong to the selected product.")

    existing = await db.scalar(
        select(PriceListItem).where(
            PriceListItem.price_list_id == price_list_id,
            PriceListItem.product_id == data.product_id,
            PriceListItem.variant_id == data.variant_id,
        )
    )

    if existing:
        raise ValueError("This product is already configured in the price list.")

    item = PriceListItem(
        price_list_id=price_list_id,
        **data.model_dump(),
    )

    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def list_price_list_items(
    db: AsyncSession,
    price_list_id: str,
) -> list[PriceListItem]:
    result = await db.scalars(
        select(PriceListItem)
        .where(PriceListItem.price_list_id == price_list_id)
        .order_by(PriceListItem.created_at)
    )
    return list(result.all())


async def update_price_list_item(
    db: AsyncSession,
    item: PriceListItem,
    data: PriceListItemUpdate,
) -> PriceListItem:
    item.price = data.price
    await db.commit()
    await db.refresh(item)
    return item