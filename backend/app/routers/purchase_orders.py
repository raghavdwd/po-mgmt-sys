from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.vendor import Vendor
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, POStatus
from app.schemas.purchase_order import (
    POCreate,
    POResponse,
    POStatusUpdate,
    POItemResponse,
)
from app.services.po_service import create_purchase_order, update_po_status

router = APIRouter(prefix="/api/purchase-orders", tags=["purchase-orders"])


def _po_to_response(po: PurchaseOrder) -> POResponse:
    items = []
    for item in po.items:
        items.append(
            POItemResponse(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name if item.product else "",
                product_sku=item.product.sku if item.product else "",
                quantity=item.quantity,
                unit_price_snapshot=item.unit_price_snapshot,
                line_total=item.line_total,
            )
        )
    return POResponse(
        id=po.id,
        reference_no=po.reference_no,
        vendor_id=po.vendor_id,
        vendor_name=po.vendor.name if po.vendor else "",
        subtotal=po.subtotal,
        tax_amount=po.tax_amount,
        total_amount=po.total_amount,
        status=po.status.value,
        notes=po.notes,
        created_by=po.created_by,
        creator_name=po.creator.name if po.creator else "",
        created_at=po.created_at,
        items=items,
    )


@router.get("", response_model=list[POResponse])
async def list_purchase_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = (
        select(PurchaseOrder)
        .options(
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.creator),
            selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product),
        )
        .order_by(PurchaseOrder.created_at.desc())
    )
    if status_filter:
        try:
            po_status = POStatus(status_filter)
            query = query.where(PurchaseOrder.status == po_status)
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"Invalid status: {status_filter}"
            )
    result = await db.execute(query)
    return [_po_to_response(po) for po in result.scalars().all()]


@router.post("", response_model=POResponse, status_code=status.HTTP_201_CREATED)
async def create_po(
    data: POCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = await db.get(Vendor, data.vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    po = await create_purchase_order(db, data, current_user.id)
    return po


@router.get("/{po_id}", response_model=POResponse)
async def get_purchase_order(
    po_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(PurchaseOrder).where(PurchaseOrder.id == po_id).options(selectinload(PurchaseOrder.vendor), selectinload(PurchaseOrder.creator), selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product))
    result = await db.execute(query)
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return _po_to_response(po)


@router.patch("/{po_id}/status", response_model=POResponse)
async def change_po_status(
    po_id: int,
    data: POStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(PurchaseOrder).where(PurchaseOrder.id == po_id).options(selectinload(PurchaseOrder.vendor), selectinload(PurchaseOrder.creator), selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product))
    result = await db.execute(query)
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    po = await update_po_status(db, po, data.status)
    return _po_to_response(po)
