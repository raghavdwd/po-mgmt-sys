async function loadProducts() {
    if (!Auth.requireAuth()) return;
    setupSidebarUser();

    try {
        const products = await api('/api/products');
        renderProducts(products);
    } catch (e) {
        showAlert('Failed to load products: ' + e.message);
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

function renderProducts(products) {
    const tbody = document.getElementById('products-tbody');
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="bi bi-box"></i><p>No products yet</p></div></td></tr>';
        return;
    }
    tbody.innerHTML = products.map(p => `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td><code>${p.sku}</code></td>
            <td>${p.category || '—'}</td>
            <td>${formatCurrency(p.unit_price)}</td>
            <td>
                <span class="badge ${p.stock_level > 50 ? 'bg-success' : p.stock_level > 0 ? 'bg-warning text-dark' : 'bg-danger'}">
                    ${p.stock_level}
                </span>
            </td>
            <td style="max-width:200px;">
                <span class="text-truncate d-inline-block" style="max-width:180px;" title="${p.description || ''}">${p.description || '<em class="text-muted">No description</em>'}</span>
                <button class="btn ai-btn btn-sm ms-1" onclick="generateDescription(${p.id})" title="AI Auto-Description">
                    <i class="bi bi-stars"></i>
                </button>
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editProduct(${p.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger" onclick="deleteProduct(${p.id}, '${p.name}')"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function resetProductForm() {
    document.getElementById('product-modal-title').textContent = 'Add Product';
    document.getElementById('product-id').value = '';
    document.getElementById('product-form').reset();
}

async function editProduct(id) {
    try {
        const product = await api(`/api/products/${id}`);
        document.getElementById('product-modal-title').textContent = 'Edit Product';
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-sku').value = product.sku;
        document.getElementById('product-category').value = product.category || '';
        document.getElementById('product-price').value = product.unit_price;
        document.getElementById('product-stock').value = product.stock_level;
        document.getElementById('product-description').value = product.description || '';
        new bootstrap.Modal(document.getElementById('productModal')).show();
    } catch (e) {
        showAlert('Failed to load product: ' + e.message);
    }
}

async function deleteProduct(id, name) {
    if (!confirm(`Delete product "${name}"? This cannot be undone.`)) return;
    try {
        await api(`/api/products/${id}`, { method: 'DELETE' });
        showAlert('Product deleted.', 'success');
        loadProducts();
    } catch (e) {
        showAlert('Delete failed: ' + e.message);
    }
}

async function generateDescription(productId) {
    const btn = event.target.closest('.ai-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-sm"></span>';
    btn.disabled = true;

    try {
        const result = await api(`/api/products/${productId}/ai-description`, { method: 'POST' });
        showAlert('AI description generated!', 'success');
        loadProducts();
    } catch (e) {
        showAlert('AI generation failed: ' + e.message);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const data = {
        name: document.getElementById('product-name').value,
        sku: document.getElementById('product-sku').value,
        category: document.getElementById('product-category').value || null,
        unit_price: parseFloat(document.getElementById('product-price').value),
        stock_level: parseInt(document.getElementById('product-stock').value) || 0,
        description: document.getElementById('product-description').value || null,
    };

    try {
        if (id) {
            await api(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            showAlert('Product updated.', 'success');
        } else {
            await api('/api/products', { method: 'POST', body: JSON.stringify(data) });
            showAlert('Product created.', 'success');
        }
        bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
        loadProducts();
    } catch (e) {
        showAlert('Save failed: ' + e.message);
    }
});

document.addEventListener('DOMContentLoaded', loadProducts);
