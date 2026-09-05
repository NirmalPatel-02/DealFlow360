from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_customer_management
from app.db.session import get_db
from app.models.customer import Customer
from app.models.customer_contact import CustomerContact
from app.models.user import User
from app.schemas.customer import (
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
)
from app.services.customer import (
    create_contact,
    create_customer,
    get_customer,
    list_contacts,
    list_customers,
    update_contact,
    update_customer,
)

router = APIRouter(prefix="/api/customers", tags=["Customers"])


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create(
    data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_customer_management),
):
    try:
        return await create_customer(db, data)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("", response_model=list[CustomerResponse])
async def list_all(
    search: str | None = Query(default=None, max_length=100),
    tier: str | None = Query(default=None),
    is_active: bool | None = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_customer_management),
):
    return await list_customers(db, search, tier, is_active)


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_one(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_customer_management),
):
    customer = await get_customer(db, customer_id)

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    return customer


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update(
    customer_id: str,
    data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_customer_management),
):
    customer = await get_customer(db, customer_id)

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    return await update_customer(db, customer, data)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_customer_management),
):
    customer = await get_customer(db, customer_id)

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    customer.is_active = False
    await db.commit()


@router.post("/{customer_id}/contacts", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def add_contact(
    customer_id: str,
    data: ContactCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_customer_management),
):
    customer = await get_customer(db, customer_id)

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    return await create_contact(db, customer_id, data)


@router.get("/{customer_id}/contacts", response_model=list[ContactResponse])
async def contacts(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_customer_management),
):
    customer = await get_customer(db, customer_id)

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    return await list_contacts(db, customer_id)


@router.patch("/{customer_id}/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact_route(
    customer_id: str,
    contact_id: str,
    data: ContactUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_customer_management),
):
    contact = await db.get(CustomerContact, contact_id)

    if not contact or contact.customer_id != customer_id:
        raise HTTPException(status_code=404, detail="Contact not found.")

    return await update_contact(db, contact, data)


@router.delete("/{customer_id}/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    customer_id: str,
    contact_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_customer_management),
):
    contact = await db.get(CustomerContact, contact_id)

    if not contact or contact.customer_id != customer_id:
        raise HTTPException(status_code=404, detail="Contact not found.")

    await db.delete(contact)
    await db.commit()