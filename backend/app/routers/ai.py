from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.product import Product
from app.services.ai_service import (
    generate_product_description,
    log_ai_description_to_mongo,
)

router = APIRouter(prefix="/api/products", tags=["ai"])


@router.post("/{product_id}/ai-description")
async def ai_generate_description(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    description = await generate_product_description(product.name, product.category)

    product.description = description
    await db.flush()
    await db.refresh(product)

    await log_ai_description_to_mongo(
        product_id=product.id,
        product_name=product.name,
        category=product.category,
        description=description,
    )

    return {"product_id": product.id, "description": description}
