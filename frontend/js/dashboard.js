let allPOs = [];

async function loadDashboard() {
    if (!Auth.requireAuth()) return;
    setupSidebarUser();

    try {
        allPOs = await api('/api/purchase-orders');
        renderStats(allPOs);
        renderPOTable(allPOs);
    } catch (e) {
        showAlert('Failed to load purchase orders: ' + e.message);
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

function renderStats(pos) {
    document.getElementById('stat-total').textContent = pos.length;
    document.getElementById('stat-pending').textContent = pos.filter(p => p.status === 'draft' || p.status === 'submitted').length;
    document.getElementById('stat-approved').textContent = pos.filter(p => p.status === 'approved').length;
    const totalValue = pos.reduce((sum, p) => sum + parseFloat(p.total_amount), 0);
    document.getElementById('stat-value').textContent = formatCurrency(totalValue);
}

function renderPOTable(pos) {
    const tbody = document.getElementById('po-table-body');
    if (pos.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7">
                <div class="empty-state">
                    <i class="bi bi-inbox"></i>
                    <p>No purchase orders found</p>
                    <a href="/create-po.html" class="btn btn-primary btn-sm">Create First PO</a>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = pos.map(po => `
        <tr>
            <td><strong>${po.reference_no}</strong></td>
            <td>${po.vendor_name}</td>
            <td>${po.items.length} item${po.items.length !== 1 ? 's' : ''}</td>
            <td>${formatCurrency(po.total_amount)}</td>
            <td><span class="badge ${getStatusBadgeClass(po.status)}">${po.status}</span></td>
            <td>${formatDate(po.created_at)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewPO(${po.id})">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function viewPO(poId) {
    try {
        const po = await api(`/api/purchase-orders/${poId}`);
        document.getElementById('modal-po-ref').textContent = po.reference_no;

        const itemsHtml = po.items.map(item => `
            <tr>
                <td>${item.product_name} <small class="text-muted">(${item.product_sku})</small></td>
                <td class="text-end">${item.quantity}</td>
                <td class="text-end">${formatCurrency(item.unit_price_snapshot)}</td>
                <td class="text-end">${formatCurrency(item.line_total)}</td>
            </tr>
        `).join('');

        document.getElementById('modal-po-body').innerHTML = `
            <div class="row mb-3">
                <div class="col-sm-6"><strong>Vendor:</strong> ${po.vendor_name}</div>
                <div class="col-sm-6"><strong>Status:</strong> <span class="badge ${getStatusBadgeClass(po.status)}">${po.status}</span></div>
                <div class="col-sm-6"><strong>Created by:</strong> ${po.creator_name}</div>
                <div class="col-sm-6"><strong>Date:</strong> ${formatDate(po.created_at)}</div>
            </div>
            ${po.notes ? `<div class="mb-3"><strong>Notes:</strong> ${po.notes}</div>` : ''}
            <table class="table table-sm">
                <thead><tr><th>Product</th><th class="text-end">Qty</th><th class="text-end">Unit Price</th><th class="text-end">Total</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div class="totals-box">
                <div class="row"><div class="col-8 text-end">Subtotal:</div><div class="col-4 text-end">${formatCurrency(po.subtotal)}</div></div>
                <div class="row"><div class="col-8 text-end">Tax (5%):</div><div class="col-4 text-end">${formatCurrency(po.tax_amount)}</div></div>
                <div class="row total-row"><div class="col-8 text-end">Total:</div><div class="col-4 text-end">${formatCurrency(po.total_amount)}</div></div>
            </div>
        `;

        const transitions = getAvailableTransitions(po.status);
        const footerEl = document.getElementById('modal-po-footer');
        let buttonsHtml = transitions.map(t =>
            `<button class="btn btn-${t.btnClass} btn-sm" onclick="changePOStatus(${po.id}, '${t.status}')">${t.label}</button>`
        ).join('');
        
        buttonsHtml += `<button class="btn btn-outline-dark btn-sm ms-auto" onclick="printReceipt(${po.id})"><i class="bi bi-printer"></i> Print Receipt</button>`;
        
        footerEl.innerHTML = buttonsHtml;
        footerEl.style.display = 'flex';
        footerEl.style.flexWrap = 'wrap';

        new bootstrap.Modal(document.getElementById('poDetailModal')).show();
    } catch (e) {
        showAlert('Failed to load PO: ' + e.message);
    }
}

function getAvailableTransitions(currentStatus) {
    const map = {
        draft: [
            { status: 'submitted', label: 'Submit', btnClass: 'primary' },
            { status: 'cancelled', label: 'Cancel', btnClass: 'outline-danger' }
        ],
        submitted: [
            { status: 'approved', label: 'Approve', btnClass: 'success' },
            { status: 'cancelled', label: 'Cancel', btnClass: 'outline-danger' }
        ],
        approved: [
            { status: 'received', label: 'Mark Received', btnClass: 'info' },
            { status: 'cancelled', label: 'Cancel', btnClass: 'outline-danger' }
        ],
        received: [],
        cancelled: []
    };
    return map[currentStatus] || [];
}

async function changePOStatus(poId, newStatus) {
    try {
        await api(`/api/purchase-orders/${poId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
        bootstrap.Modal.getInstance(document.getElementById('poDetailModal')).hide();
        showAlert(`PO status updated to "${newStatus}"`, 'success');
        loadDashboard();
    } catch (e) {
        showAlert('Status update failed: ' + e.message);
    }
}

document.getElementById('status-filter').addEventListener('change', (e) => {
    const status = e.target.value;
    const filtered = status ? allPOs.filter(p => p.status === status) : allPOs;
    renderPOTable(filtered);
});

document.addEventListener('DOMContentLoaded', loadDashboard);

async function printReceipt(poId) {
    try {
        const po = await api(`/api/purchase-orders/${poId}`);
        const printWindow = window.open('', '_blank', 'height=800,width=800');
        
        const itemsHtml = po.items.map(item => `
            <tr>
                <td>${item.product_name}<br><small>${item.product_sku}</small></td>
                <td style="text-align:right;">${item.quantity}</td>
                <td style="text-align:right;">${formatCurrency(item.unit_price_snapshot)}</td>
                <td style="text-align:right;">${formatCurrency(item.line_total)}</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>PO Receipt - ${po.reference_no}</title>
                    <style>
                        body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
                        h1 { color: #1e293b; margin-top: 0; font-size: 24px; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; }
                        .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
                        .info-block { margin-bottom: 10px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                        th, td { padding: 12px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
                        th { background-color: #f8fafc; font-weight: 600; text-transform: uppercase; font-size: 12px; color: #64748b; }
                        .totals { width: 300px; float: right; }
                        .totals .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
                        .totals .row.grand-total { font-weight: bold; font-size: 18px; border-top: 2px solid #cbd5e1; border-bottom: none; }
                        .status { font-weight: bold; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc; display: inline-block; }
                        .badge-approved { background-color: #d1fae5; color: #059669; border-color: #059669; }
                        .badge-draft { background-color: #f1f5f9; color: #64748b; border-color: #64748b; }
                        .badge-submitted { background-color: #dbeafe; color: #2563eb; border-color: #2563eb; }
                        .badge-received { background-color: #e0f2fe; color: #0369a1; border-color: #0369a1; }
                        .badge-cancelled { background-color: #fee2e2; color: #dc2626; border-color: #dc2626; }
                        .notes { clear: both; padding-top: 40px; font-size: 14px; color: #64748b; }
                        @media print {
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <h1>Purchase Order Receipt</h1>
                    <div class="header">
                        <div>
                            <div class="info-block"><strong>Vendor:</strong> ${po.vendor_name}</div>
                            <div class="info-block"><strong>Created By:</strong> ${po.creator_name}</div>
                        </div>
                        <div style="text-align:right;">
                            <div class="info-block"><strong>Reference No:</strong> ${po.reference_no}</div>
                            <div class="info-block"><strong>Date:</strong> ${formatDate(po.created_at)}</div>
                            <div class="info-block" style="margin-top: 10px;">
                                <span class="status badge-${po.status}">${po.status}</span>
                            </div>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Product Details</th>
                                <th style="text-align:right;">Quantity</th>
                                <th style="text-align:right;">Unit Price</th>
                                <th style="text-align:right;">Line Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>

                    <div class="totals">
                        <div class="row">
                            <span>Subtotal:</span>
                            <span>${formatCurrency(po.subtotal)}</span>
                        </div>
                        <div class="row">
                            <span>Tax (5%):</span>
                            <span>${formatCurrency(po.tax_amount)}</span>
                        </div>
                        <div class="row grand-total">
                            <span>Total:</span>
                            <span>${formatCurrency(po.total_amount)}</span>
                        </div>
                    </div>

                    ${po.notes ? `<div class="notes"><strong>Notes:</strong><br>${po.notes}</div>` : ''}

                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                                window.close();
                            }, 250);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    } catch (e) {
        showAlert('Failed to print PO: ' + e.message);
    }
}
