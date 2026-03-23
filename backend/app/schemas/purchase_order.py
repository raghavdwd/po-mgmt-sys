from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime


class POItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class POItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str = ""
    product_sku: str = ""
    quantity: int
    unit_price_snapshot: Decimal
    line_total: Decimal

    model_config = {"from_attributes": True}


class POCreate(BaseModel):
    vendor_id: int
    notes: str | None = None
    items: list[POItemCreate] = Field(min_length=1)


class POStatusUpdate(BaseModel):
    status: str = Field(pattern="^(draft|submitted|approved|received|cancelled)$")


class POResponse(BaseModel):
    id: int
    reference_no: str
    vendor_id: int
    vendor_name: str = ""
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    status: str
    notes: str | None
    created_by: int
    creator_name: str = ""
    created_at: datetime
    items: list[POItemResponse] = []

    model_config = {"from_attributes": True}
