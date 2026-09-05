import asyncio

from sqlalchemy import text

from app.db.session import AsyncSessionLocal


async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("SELECT 1"))
        print(result.scalar())


asyncio.run(main())