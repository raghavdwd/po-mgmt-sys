async function loadVendors() {
    if (!Auth.requireAuth()) return;
    setupSidebarUser();

    try {
        const vendors = await api('/api/vendors');
        renderVendors(vendors);
    } catch (e) {
        showAlert('Failed to load vendors: ' + e.message);
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

function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '<span class="star-rating">' +
        '<i class="bi bi-star-fill"></i>'.repeat(full) +
        (half ? '<i class="bi bi-star-half"></i>' : '') +
        '<i class="bi bi-star"></i>'.repeat(empty) +
        '</span> <small class="text-muted">(' + rating + ')</small>';
}

function renderVendors(vendors) {
    const tbody = document.getElementById('vendors-tbody');
    if (vendors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="bi bi-building"></i><p>No vendors yet</p></div></td></tr>';
        return;
    }
    tbody.innerHTML = vendors.map(v => `
        <tr>
            <td><strong>${v.name}</strong>${v.address ? '<br><small class="text-muted">' + v.address + '</small>' : ''}</td>
            <td>${v.contact_email}</td>
            <td>${v.contact_phone || '—'}</td>
            <td>${renderStars(v.rating)}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editVendor(${v.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger" onclick="deleteVendor(${v.id}, '${v.name}')"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function resetVendorForm() {
    document.getElementById('vendor-modal-title').textContent = 'Add Vendor';
    document.getElementById('vendor-id').value = '';
    document.getElementById('vendor-form').reset();
}

async function editVendor(id) {
    try {
        const vendor = await api(`/api/vendors/${id}`);
        document.getElementById('vendor-modal-title').textContent = 'Edit Vendor';
        document.getElementById('vendor-id').value = vendor.id;
        document.getElementById('vendor-name').value = vendor.name;
        document.getElementById('vendor-email').value = vendor.contact_email;
        document.getElementById('vendor-phone').value = vendor.contact_phone || '';
        document.getElementById('vendor-address').value = vendor.address || '';
        document.getElementById('vendor-rating').value = vendor.rating;
        new bootstrap.Modal(document.getElementById('vendorModal')).show();
    } catch (e) {
        showAlert('Failed to load vendor: ' + e.message);
    }
}

async function deleteVendor(id, name) {
    if (!confirm(`Delete vendor "${name}"? This cannot be undone.`)) return;
    try {
        await api(`/api/vendors/${id}`, { method: 'DELETE' });
        showAlert('Vendor deleted.', 'success');
        loadVendors();
    } catch (e) {
        showAlert('Delete failed: ' + e.message);
    }
}

document.getElementById('vendor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('vendor-id').value;
    const data = {
        name: document.getElementById('vendor-name').value,
        contact_email: document.getElementById('vendor-email').value,
        contact_phone: document.getElementById('vendor-phone').value || null,
        address: document.getElementById('vendor-address').value || null,
        rating: parseFloat(document.getElementById('vendor-rating').value) || 0,
    };

    try {
        if (id) {
            await api(`/api/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            showAlert('Vendor updated.', 'success');
        } else {
            await api('/api/vendors', { method: 'POST', body: JSON.stringify(data) });
            showAlert('Vendor created.', 'success');
        }
        bootstrap.Modal.getInstance(document.getElementById('vendorModal')).hide();
        loadVendors();
    } catch (e) {
        showAlert('Save failed: ' + e.message);
    }
});

document.addEventListener('DOMContentLoaded', loadVendors);
