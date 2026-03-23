const API_BASE = 'http://localhost:8000';

const Auth = {
    getToken() {
        return localStorage.getItem('token');
    },
    getUser() {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : null;
    },
    setSession(token, user) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    },
    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    },
    isLoggedIn() {
        return !!this.getToken();
    },
    requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }
};

async function api(endpoint, options = {}) {
    const token = Auth.getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

    if (response.status === 401) {
        Auth.logout();
        return;
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(err.detail || `HTTP ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.json();
}

function showAlert(message, type = 'danger') {
    const container = document.getElementById('alert-container');
    if (!container) return;
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    container.prepend(alert);
    setTimeout(() => alert.remove(), 5000);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function getStatusBadgeClass(status) {
    const classes = {
        draft: 'bg-secondary',
        submitted: 'bg-primary',
        approved: 'bg-success',
        received: 'bg-info',
        cancelled: 'bg-danger'
    };
    return classes[status] || 'bg-secondary';
}

function setupNavbar() {
    const user = Auth.getUser();
    const navbar = document.getElementById('navbar-user');
    if (navbar && user) {
        navbar.innerHTML = `
            <span class="navbar-text me-3">${user.name || user.email}</span>
            <button class="btn btn-outline-light btn-sm" onclick="Auth.logout()">Logout</button>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const urlUser = urlParams.get('user');
    
    if (urlToken && urlUser) {
        try {
            Auth.setSession(urlToken, JSON.parse(decodeURIComponent(urlUser)));
            window.history.replaceState({}, document.title, '/');
        } catch (e) {
            console.error("Failed to parse URL user data", e);
        }
    }

    const path = window.location.pathname;
    if (path !== '/login.html' && !Auth.isLoggedIn()) {
        window.location.href = '/login.html';
        return;
    }
    setupNavbar();

    window.addEventListener('message', (event) => {
        if (event.data && event.data.token) {
            Auth.setSession(event.data.token, event.data.user);
            window.location.href = '/';
        }
    });
});
