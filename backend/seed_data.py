import asyncio
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import engine, async_session_maker, Base
from app.models import Vendor, Product, User
from app.models.user import UserRole


VENDORS = [
    {
        "name": "TechParts India",
        "contact_email": "sales@techparts.in",
        "contact_phone": "+91-9876543210",
        "address": "Plot 12, Industrial Area, Kundli, Sonipat",
        "rating": Decimal("4.5"),
    },
    {
        "name": "Global Electronics",
        "contact_email": "info@globalelec.com",
        "contact_phone": "+91-9812345678",
        "address": "Sector 8, IMT Manesar, Gurugram",
        "rating": Decimal("4.0"),
    },
    {
        "name": "MetalWorks Ltd",
        "contact_email": "orders@metalworks.co.in",
        "contact_phone": "+91-9988776655",
        "address": "RIICO Industrial Area, Bhiwadi",
        "rating": Decimal("3.5"),
    },
    {
        "name": "PackRight Solutions",
        "contact_email": "contact@packright.in",
        "contact_phone": "+91-9090909090",
        "address": "Sector 5, Noida, UP",
        "rating": Decimal("4.2"),
    },
    {
        "name": "SafeGuard Supplies",
        "contact_email": "hello@safeguard.in",
        "contact_phone": "+91-8877665544",
        "address": "Panipat Industrial Park, Haryana",
        "rating": Decimal("3.8"),
    },
]

PRODUCTS = [
    {
        "name": "Steel Bolt M10x50",
        "sku": "SB-M10X50",
        "category": "Fasteners",
        "unit_price": Decimal("12.50"),
        "stock_level": 5000,
    },
    {
        "name": "Copper Wire 2.5mm",
        "sku": "CW-2.5MM",
        "category": "Electrical",
        "unit_price": Decimal("85.00"),
        "stock_level": 800,
    },
    {
        "name": "LED Panel Light 40W",
        "sku": "LED-PL-40W",
        "category": "Lighting",
        "unit_price": Decimal("450.00"),
        "stock_level": 200,
    },
    {
        "name": "Hydraulic Cylinder 100mm",
        "sku": "HC-100MM",
        "category": "Machinery",
        "unit_price": Decimal("12500.00"),
        "stock_level": 25,
    },
    {
        "name": "Safety Helmet ISI",
        "sku": "SH-ISI-01",
        "category": "Safety",
        "unit_price": Decimal("350.00"),
        "stock_level": 500,
    },
    {
        "name": "PVC Pipe 4 inch",
        "sku": "PVC-4IN",
        "category": "Plumbing",
        "unit_price": Decimal("220.00"),
        "stock_level": 300,
    },
    {
        "name": "Welding Rod E6013",
        "sku": "WR-E6013",
        "category": "Welding",
        "unit_price": Decimal("180.00"),
        "stock_level": 1000,
    },
    {
        "name": "Ball Bearing 6205",
        "sku": "BB-6205",
        "category": "Bearings",
        "unit_price": Decimal("275.00"),
        "stock_level": 400,
    },
    {
        "name": "Industrial Adhesive 500ml",
        "sku": "IA-500ML",
        "category": "Chemicals",
        "unit_price": Decimal("320.00"),
        "stock_level": 150,
    },
    {
        "name": "Circuit Breaker 32A",
        "sku": "CB-32A",
        "category": "Electrical",
        "unit_price": Decimal("680.00"),
        "stock_level": 100,
    },
]

DEMO_USER = {
    "email": "demo@ivinnov.com",
    "name": "Demo User",
    "google_id": "demo-google-id-12345",
    "role": UserRole.ADMIN,
}


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        existing = await session.execute(select(Vendor).limit(1))
        if existing.scalar_one_or_none():
            print("Database already seeded. Skipping.")
            return

        for v in VENDORS:
            session.add(Vendor(**v))

        for p in PRODUCTS:
            session.add(Product(**p))

        session.add(User(**DEMO_USER))

        await session.commit()
        print(f"Seeded {len(VENDORS)} vendors, {len(PRODUCTS)} products, 1 demo user.")


if __name__ == "__main__":
    asyncio.run(seed())
