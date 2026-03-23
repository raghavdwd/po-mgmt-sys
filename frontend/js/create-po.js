let products = [];
let rowCounter = 0;

async function initCreatePO() {
    if (!Auth.requireAuth()) return;
    setupSidebarUser();

    try {
        const [vendors, prods] = await Promise.all([
            api('/api/vendors'),
            api('/api/products')
        ]);
        products = prods;
        populateVendorDropdown(vendors);
    } catch (e) {
        showAlert('Failed to load data: ' + e.message);
    }
}

function setupSidebarUser() {
    const user = Auth.getUser();
    const el = document.getElementById('sidebar-user');
    if (el && user) {
        const initials = (user.name || user.email).split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        el.innerHTML = `
            <div class="user-avatar">${initials}</div>
            <div class="user-info">
                <div class="user-name">${user.name || user.email}</div>
                <div class="user-email">${user.email}</div>
            </div>
            <button class="btn btn-sm ms-auto" style="color:#94a3b8;" onclick="Auth.logout()" title="Logout">
                <i class="bi bi-box-arrow-right"></i>
            </button>
        `;
    }
}

function populateVendorDropdown(vendors) {
    const select = document.getElementById('vendor-select');
    vendors.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.name} (Rating: ${v.rating})`;
        select.appendChild(opt);
    });
}

function addProductRow() {
    const emptyRow = document.getElementById('empty-row');
    if (emptyRow) emptyRow.remove();

    rowCounter++;
    const rowId = `item-row-${rowCounter}`;
    const usedProductIds = getUsedProductIds();

    const productOptions = products
        .filter(p => !usedProductIds.includes(p.id))
        .map(p => `<option value="${p.id}" data-price="${p.unit_price}" data-stock="${p.stock_level}">${p.name} (${p.sku}) — Stock: ${p.stock_level}</option>`)
        .join('');

    if (productOptions.length === 0) {
        showAlert('All products have been added to this order.', 'warning');
        return;
    }

    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.innerHTML = `
        <td>
            <select class="form-select form-select-sm product-select" data-row="${rowId}" required>
                <option value="">Select product...</option>
                ${productOptions}
            </select>
        </td>
        <td>
            <input type="number" class="form-control form-control-sm qty-input" data-row="${rowId}" min="1" value="1" required>
        </td>
        <td class="text-end align-middle unit-price" data-row="${rowId}">—</td>
        <td class="text-end align-middle line-total" data-row="${rowId}">—</td>
        <td class="text-center align-middle">
            <button type="button" class="remove-row" data-row="${rowId}" title="Remove">
                <i class="bi bi-x-circle"></i>
            </button>
        </td>
    `;

    document.getElementById('items-tbody').appendChild(tr);
    bindRowEvents(rowId);
    updateSubmitButton();
}

function getUsedProductIds() {
    const ids = [];
    document.querySelectorAll('.product-select').forEach(sel => {
        if (sel.value) ids.push(parseInt(sel.value));
    });
    return ids;
}

function bindRowEvents(rowId) {
    const row = document.getElementById(rowId);
    const productSelect = row.querySelector('.product-select');
    const qtyInput = row.querySelector('.qty-input');
    const removeBtn = row.querySelector('.remove-row');

    productSelect.addEventListener('change', () => {
        const selected = productSelect.selectedOptions[0];
        if (selected && selected.value) {
            const price = parseFloat(selected.dataset.price);
            row.querySelector('.unit-price').textContent = formatCurrency(price);
            qtyInput.max = parseInt(selected.dataset.stock);
            updateLineTotal(rowId);
        } else {
            row.querySelector('.unit-price').textContent = '—';
            row.querySelector('.line-total').textContent = '—';
        }
        refreshProductOptions();
        recalculateTotals();
        updateSubmitButton();
    });

    qtyInput.addEventListener('input', () => {
        updateLineTotal(rowId);
        recalculateTotals();
    });

    removeBtn.addEventListener('click', () => {
        row.remove();
        refreshProductOptions();
        recalculateTotals();
        updateSubmitButton();

        if (document.querySelectorAll('#items-tbody tr').length === 0) {
            document.getElementById('items-tbody').innerHTML = `
                <tr id="empty-row">
                    <td colspan="5" class="text-center py-4 text-muted">
                        Click "Add Product" to add items to this order
                    </td>
                </tr>
            `;
        }
    });
}

function updateLineTotal(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const productSelect = row.querySelector('.product-select');
    const qtyInput = row.querySelector('.qty-input');
    const selected = productSelect.selectedOptions[0];

    if (selected && selected.value) {
        const price = parseFloat(selected.dataset.price);
        const qty = parseInt(qtyInput.value) || 0;
        const total = price * qty;
        row.querySelector('.line-total').textContent = formatCurrency(total);
    }
}

function refreshProductOptions() {
    const usedIds = getUsedProductIds();
    document.querySelectorAll('.product-select').forEach(sel => {
        const currentVal = sel.value;
        const options = sel.querySelectorAll('option');
        options.forEach(opt => {
            if (!opt.value) return;
            const id = parseInt(opt.value);
            opt.hidden = usedIds.includes(id) && id !== parseInt(currentVal);
        });
    });
}

function recalculateTotals() {
    let subtotal = 0;
    document.querySelectorAll('#items-tbody tr').forEach(row => {
        if (row.id === 'empty-row') return;
        const select = row.querySelector('.product-select');
        const qty = row.querySelector('.qty-input');
        if (select && select.value && qty) {
            const price = parseFloat(select.selectedOptions[0].dataset.price);
            subtotal += price * (parseInt(qty.value) || 0);
        }
    });

    const tax = subtotal * 0.05;
    const total = subtotal + tax;

    document.getElementById('display-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('display-tax').textContent = formatCurrency(tax);
    document.getElementById('display-total').textContent = formatCurrency(total);
}

function updateSubmitButton() {
    const hasVendor = !!document.getElementById('vendor-select').value;
    const rows = document.querySelectorAll('.product-select');
    const hasValidItems = rows.length > 0 && Array.from(rows).every(s => s.value);
    document.getElementById('submit-btn').disabled = !(hasVendor && hasValidItems);
}

async function submitPO(e) {
    e.preventDefault();
    const vendorId = parseInt(document.getElementById('vendor-select').value);
    const notes = document.getElementById('po-notes').value || null;

    const items = [];
    document.querySelectorAll('#items-tbody tr').forEach(row => {
        if (row.id === 'empty-row') return;
        const productId = parseInt(row.querySelector('.product-select').value);
        const quantity = parseInt(row.querySelector('.qty-input').value);
        if (productId && quantity > 0) {
            items.push({ product_id: productId, quantity });
        }
    });

    if (!vendorId || items.length === 0) {
        showAlert('Please select a vendor and add at least one product.');
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-sm me-1"></span> Creating...';

    try {
        const po = await api('/api/purchase-orders', {
            method: 'POST',
            body: JSON.stringify({ vendor_id: vendorId, notes, items })
        });
        window.location.href = '/?created=' + po.reference_no;
    } catch (e) {
        showAlert('Failed to create PO: ' + e.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Submit Purchase Order';
    }
}

document.getElementById('add-row-btn').addEventListener('click', addProductRow);
document.getElementById('po-form').addEventListener('submit', submitPO);
document.getElementById('vendor-select').addEventListener('change', updateSubmitButton);
document.addEventListener('DOMContentLoaded', initCreatePO);
