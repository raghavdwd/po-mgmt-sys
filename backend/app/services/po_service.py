from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from sqlalchemy.orm import selectinload

from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, POStatus
from app.models.product import Product
from app.models.vendor import Vendor
from app.schemas.purchase_order import POCreate, POStatusUpdate, POResponse, POItemResponse

TAX_RATE = Decimal("0.05")


async def _generate_reference_no(db: AsyncSession) -> str:
    today = date.today().strftime("%Y%m%d")
    prefix = f"PO-{today}-"
    result = await db.execute(
        select(func.count(PurchaseOrder.id)).where(
            PurchaseOrder.reference_no.like(f"{prefix}%")
        )
    )
    count = result.scalar_one() + 1
    return f"{prefix}{count:04d}"


def calculate_totals(
    items: list[PurchaseOrderItem],
) -> tuple[Decimal, Decimal, Decimal]:
    subtotal = sum((item.line_total for item in items), Decimal("0.00"))
    tax_amount = (subtotal * TAX_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total_amount = subtotal + tax_amount
    return subtotal, tax_amount, total_amount


async def create_purchase_order(
    db: AsyncSession, po_data: POCreate, user_id: int
) -> POResponse:
    product_ids = [item.product_id for item in po_data.items]
    result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    products = {p.id: p for p in result.scalars().all()}

    for item in po_data.items:
        if item.product_id not in products:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {item.product_id} not found",
            )

    reference_no = await _generate_reference_no(db)

    po = PurchaseOrder(
        reference_no=reference_no,
        vendor_id=po_data.vendor_id,
        status=POStatus.DRAFT,
        notes=po_data.notes,
        created_by=user_id,
    )
    db.add(po)
    await db.flush()

    po_items = []
    for item_data in po_data.items:
        product = products[item_data.product_id]
        unit_price = product.unit_price
        line_total = (unit_price * item_data.quantity).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        po_item = PurchaseOrderItem(
            po_id=po.id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            unit_price_snapshot=unit_price,
            line_total=line_total,
        )
        db.add(po_item)
        po_items.append(po_item)

    subtotal, tax_amount, total_amount = calculate_totals(po_items)
    po.subtotal = subtotal
    po.tax_amount = tax_amount
    po.total_amount = total_amount
    await db.flush()

    # Manual response map to avoid async identity map issues
    vendor = await db.get(Vendor, po.vendor_id)
    from app.models.user import User
    creator = await db.get(User, po.created_by)

    items_resp = []
    for item in po_items:
        prod = products[item.product_id]
        items_resp.append(POItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=prod.name,
            product_sku=prod.sku,
            quantity=item.quantity,
            unit_price_snapshot=item.unit_price_snapshot,
            line_total=item.line_total,
        ))

    return POResponse(
        id=po.id,
        reference_no=po.reference_no,
        vendor_id=po.vendor_id,
        vendor_name=vendor.name if vendor else "",
        subtotal=po.subtotal,
        tax_amount=po.tax_amount,
        total_amount=po.total_amount,
        status=po.status.value,
        notes=po.notes,
        created_by=po.created_by,
        creator_name=creator.name if creator else "",
        created_at=po.created_at,
        items=items_resp,
    )


VALID_TRANSITIONS: dict[POStatus, set[POStatus]] = {
    POStatus.DRAFT: {POStatus.SUBMITTED, POStatus.CANCELLED},
    POStatus.SUBMITTED: {POStatus.APPROVED, POStatus.CANCELLED},
    POStatus.APPROVED: {POStatus.RECEIVED, POStatus.CANCELLED},
    POStatus.RECEIVED: set(),
    POStatus.CANCELLED: set(),
}


async def update_po_status(
    db: AsyncSession, po: PurchaseOrder, new_status_str: str
) -> PurchaseOrder:
    new_status = POStatus(new_status_str)
    current = po.status

    if new_status not in VALID_TRANSITIONS.get(current, set()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition from '{current.value}' to '{new_status.value}'",
        )

    if new_status == POStatus.APPROVED:
        await _check_and_decrement_stock(db, po)

    if current == POStatus.APPROVED and new_status == POStatus.CANCELLED:
        await _restore_stock(db, po)

    po.status = new_status
    await db.flush()
    
    # We must properly expunge and requery to avoid async missing greenlet errors on return
    db.expunge(po)
    
    stmt = (
        select(PurchaseOrder)
        .where(PurchaseOrder.id == po.id)
        .options(
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.creator),
            selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product)
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one()


async def _check_and_decrement_stock(db: AsyncSession, po: PurchaseOrder) -> None:
    for item in po.items:
        product = await db.get(Product, item.product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {item.product_id} not found",
            )
        if product.stock_level < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient stock for '{product.name}': "
                    f"available {product.stock_level}, requested {item.quantity}"
                ),
            )
        product.stock_level -= item.quantity


async def _restore_stock(db: AsyncSession, po: PurchaseOrder) -> None:
    for item in po.items:
        product = await db.get(Product, item.product_id)
        if product:
            product.stock_level += item.quantity
