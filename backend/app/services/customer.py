from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.customer_contact import CustomerContact
from app.schemas.customer import CustomerCreate, CustomerUpdate, ContactCreate, ContactUpdate


async def create_customer(db: AsyncSession, data: CustomerCreate) -> Customer:
    existing = await db.scalar(select(Customer).where(Customer.code == data.code))
    if existing:
        raise ValueError("Customer code already exists.")

    customer = Customer(**data.model_dump())
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


async def list_customers(
    db: AsyncSession,
    search: str | None = None,
    tier: str | None = None,
    is_active: bool | None = True,
) -> list[Customer]:
    query = select(Customer).order_by(Customer.created_at.desc())

    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Customer.name.ilike(pattern),
                Customer.code.ilike(pattern),
                Customer.email.ilike(pattern),
            )
        )

    if tier:
        query = query.where(Customer.tier == tier)

    if is_active is not None:
        query = query.where(Customer.is_active == is_active)

    result = await db.scalars(query)
    return list(result.all())


async def get_customer(db: AsyncSession, customer_id: str) -> Customer | None:
    return await db.get(Customer, customer_id)


async def update_customer(
    db: AsyncSession,
    customer: Customer,
    data: CustomerUpdate,
) -> Customer:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)

    await db.commit()
    await db.refresh(customer)
    return customer


async def create_contact(
    db: AsyncSession,
    customer_id: str,
    data: ContactCreate,
) -> CustomerContact:
    contact = CustomerContact(customer_id=customer_id, **data.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


async def list_contacts(
    db: AsyncSession,
    customer_id: str,
) -> list[CustomerContact]:
    result = await db.scalars(
        select(CustomerContact)
        .where(CustomerContact.customer_id == customer_id)
        .order_by(CustomerContact.is_primary.desc(), CustomerContact.created_at)
    )
    return list(result.all())


async def update_contact(
    db: AsyncSession,
    contact: CustomerContact,
    data: ContactUpdate,
) -> CustomerContact:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)

    await db.commit()
    await db.refresh(contact)
    return contact