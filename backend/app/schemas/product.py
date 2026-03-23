from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sku: str = Field(min_length=1, max_length=100)
    category: str | None = Field(default=None, max_length=100)
    unit_price: Decimal = Field(gt=0, decimal_places=2)
    stock_level: int = Field(default=0, ge=0)
    description: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    sku: str | None = Field(default=None, min_length=1, max_length=100)
    category: str | None = Field(default=None, max_length=100)
    unit_price: Decimal | None = Field(default=None, gt=0)
    stock_level: int | None = Field(default=None, ge=0)
    description: str | None = None


class ProductResponse(BaseModel):
    id: int
    name: str
    sku: str
    category: str | None
    unit_price: Decimal
    stock_level: int
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
