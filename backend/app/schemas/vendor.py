from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime


class VendorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    contact_email: str = Field(min_length=1, max_length=255)
    contact_phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=500)
    rating: Decimal = Field(default=Decimal("0.0"), ge=0, le=5)


class VendorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    contact_email: str | None = Field(default=None, min_length=1, max_length=255)
    contact_phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=500)
    rating: Decimal | None = Field(default=None, ge=0, le=5)


class VendorResponse(BaseModel):
    id: int
    name: str
    contact_email: str
    contact_phone: str | None
    address: str | None
    rating: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}
