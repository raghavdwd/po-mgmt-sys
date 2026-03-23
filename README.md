# Purchase Order (PO) Management System

A full-stack Purchase Order Management System built as a microservice-ready application with modern technologies.

## 🌟 Key Features

- **Robust Backend**: FastAPI with async SQLAlchemy 2.0 (asyncpg)
- **Database**: PostgreSQL 18.1 with proper relations and constraints
- **Authentication**: Google OAuth2 + JWT (using `authlib` & `joserfc`)
- **Smart Product Descriptions**: AI-powered auto-generation using Google Gemini 2.0
- **Data Integrity**: Price snapshots at PO creation, real-time total recalculation, strict state transitions
- **Responsive UI**: Bootstrap 5 + Vanilla JS with dynamic "Add Row" functionality

---

## 🏗 Architecture & DB Design Decisions

### Schema Design (4 Tables)
1. **`users`**: Manages OAuth login identities.
2. **`vendors`**: Vendors supplying products. Soft-deleted conceptually (FK constraints prevent hard delete if active POs exist).
3. **`products`**: Product catalog. Unique SKUs enforced at DB level.
4. **`purchase_orders`**: The core PO table. Auto-generated Reference Nos (`PO-YYYYMMDD-XXXX`).
5. **`purchase_order_items`**: The crucial junction table.

### Key Implementation Choices
- **Price Snapshotting**: The `purchase_order_items` table records a `unit_price_snapshot`. If a product's price changes *after* a PO is created, the existing PO's total does not maliciously recalculate. This guarantees financial integrity.
- **Server-Side Math**: The client UI displays subtotals, but the API recalculates all math (`(qty * snapshot) * 1.05 tax`) purely server-side.
- **Strict State Machine**: POs flow strictly: `Draft -> Submitted -> Approved -> Received`. Stock is only decremented on `Approved`. Cancellation from Approved restores stock safely.
- **Async First**: Used `asyncpg` over `psycopg3` for 2-3x better async performance, combined with FastAPI and `async_sessionmaker`.

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.14+
- PostgreSQL 18.1
- MongoDB (Optional, for AI Description logging)
- Google Cloud Console Project (for OAuth Client ID/Secret)
- Google AI Studio API Key (for Gemini)

### 1. Database Setup
Ensure PostgreSQL is running, then create the database:
```bash
createdb po_mgmt
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Copy the environment file and fill it out:
```bash
cp .env.example .env
```
*Note: Update `DATABASE_URL` if your Postgres user/port differs.*

### 3. Migrations & Seeding
Run migrations to create the schema, then seed demo data:
```bash
alembic upgrade head
python seed_data.py
```
*(Seeding creates 5 vendors, 10 products, and a demo user identity)*

### 4. Running the Servers
**Start Backend API (Port 8000):**
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Start Frontend UI (Port 3000):**
```bash
cd frontend
python -m http.server 3000
```

### 5. Access the App
Open `http://localhost:3000` in your browser.
Click **Demo Login** if you haven't configured Google OAuth credentials.

---

## 🤖 AI Auto-Description Integration

To use the AI feature:
1. Get a free API key from Google AI Studio.
2. Add it to backend `.env` as `GEMINI_API_KEY=your_key_here`.
3. (Bonus) Start a local MongoDB server (`mongodb://localhost:27017`) and the backend will automatically log all generated descriptions to the `po_mgmt_ai_logs` database.
4. In the UI, go to Products -> click the ✨ button next to any product without a description.