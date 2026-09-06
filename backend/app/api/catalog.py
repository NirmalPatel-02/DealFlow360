from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_admin, require_internal_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.product import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    PriceListCreate,
    PriceListItemCreate,
    PriceListItemResponse,
    PriceListItemUpdate,
    PriceListResponse,
    PriceListUpdate,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    VariantCreate,
    VariantResponse,
    VariantUpdate,
)
from app.services.catalog import (
    add_price_list_item,
    create_category,
    create_price_list,
    create_product,
    create_variant,
    get_category,
    get_price_list,
    get_product,
    list_categories,
    list_price_list_items,
    list_price_lists,
    list_products,
    list_variants,
    update_category,
    update_price_list,
    update_price_list_item,
    update_product,
    update_variant,
)


router = APIRouter(prefix="/api/catalog", tags=["Catalog"])

@router.post(
    "/categories",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_category_route(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        return await create_category(db, data)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get(
    "/categories",
    response_model=list[CategoryResponse],
)
async def list_categories_route(
    search: str | None = Query(default=None, max_length=100),
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    return await list_categories(db, search, is_active)


@router.get(
    "/categories/{category_id}",
    response_model=CategoryResponse,
)
async def get_category_route(
    category_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    category = await get_category(db, category_id)

    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")

    return category


@router.patch(
    "/categories/{category_id}",
    response_model=CategoryResponse,
)
async def update_category_route(
    category_id: str,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    category = await get_category(db, category_id)

    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")

    return await update_category(db, category, data)


# ---------------------------
# Products
# ---------------------------

@router.post(
    "/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_product_route(
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        return await create_product(db, data)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get(
    "/products",
    response_model=list[ProductResponse],
)
async def list_products_route(
    search: str | None = Query(default=None, max_length=100),
    category_id: str | None = None,
    product_type: str | None = None,
    is_active: bool | None = True,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    return await list_products(
        db,
        search,
        category_id,
        product_type,
        is_active,
        skip,
        limit,
    )


@router.get(
    "/products/{product_id}",
    response_model=ProductResponse,
)
async def get_product_route(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    product = await get_product(db, product_id)

    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    return product


@router.patch(
    "/products/{product_id}",
    response_model=ProductResponse,
)
async def update_product_route(
    product_id: str,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    product = await get_product(db, product_id)

    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    try:
        return await update_product(db, product, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete(
    "/products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def deactivate_product_route(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    product = await get_product(db, product_id)

    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    product.is_active = False
    await db.commit()


# ---------------------------
# Variants
# ---------------------------

@router.post(
    "/products/{product_id}/variants",
    response_model=VariantResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_variant_route(
    product_id: str,
    data: VariantCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        return await create_variant(db, product_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get(
    "/products/{product_id}/variants",
    response_model=list[VariantResponse],
)
async def list_variants_route(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    product = await get_product(db, product_id)

    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    return await list_variants(db, product_id)


@router.patch(
    "/variants/{variant_id}",
    response_model=VariantResponse,
)
async def update_variant_route(
    variant_id: str,
    data: VariantUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.models.product_variant import ProductVariant

    variant = await db.get(ProductVariant, variant_id)

    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found.")

    return await update_variant(db, variant, data)


# ---------------------------
# Price Lists
# ---------------------------

@router.post(
    "/price-lists",
    response_model=PriceListResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_price_list_route(
    data: PriceListCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        return await create_price_list(db, data)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get(
    "/price-lists",
    response_model=list[PriceListResponse],
)
async def list_price_lists_route(
    customer_tier: str | None = Query(default=None),
    currency: str | None = Query(default=None, min_length=3, max_length=3),
    is_active: bool | None = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    return await list_price_lists(
        db,
        customer_tier,
        currency,
        is_active,
    )


@router.get(
    "/price-lists/{price_list_id}",
    response_model=PriceListResponse,
)
async def get_price_list_route(
    price_list_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    price_list = await get_price_list(db, price_list_id)

    if not price_list:
        raise HTTPException(status_code=404, detail="Price list not found.")

    return price_list


@router.patch(
    "/price-lists/{price_list_id}",
    response_model=PriceListResponse,
)
async def update_price_list_route(
    price_list_id: str,
    data: PriceListUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    price_list = await get_price_list(db, price_list_id)

    if not price_list:
        raise HTTPException(status_code=404, detail="Price list not found.")

    return await update_price_list(db, price_list, data)


@router.post(
    "/price-lists/{price_list_id}/items",
    response_model=PriceListItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_price_list_item_route(
    price_list_id: str,
    data: PriceListItemCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        return await add_price_list_item(db, price_list_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/price-lists/{price_list_id}/items",
    response_model=list[PriceListItemResponse],
)
async def list_price_list_items_route(
    price_list_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    price_list = await get_price_list(db, price_list_id)

    if not price_list:
        raise HTTPException(status_code=404, detail="Price list not found.")

    return await list_price_list_items(db, price_list_id)


@router.patch(
    "/price-list-items/{item_id}",
    response_model=PriceListItemResponse,
)
async def update_price_list_item_route(
    item_id: str,
    data: PriceListItemUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.models.price_list_item import PriceListItem

    item = await db.get(PriceListItem, item_id)

    if not item:
        raise HTTPException(status_code=404, detail="Price list item not found.")

    return await update_price_list_item(db, item, data)