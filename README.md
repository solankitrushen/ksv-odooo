# VendorBridge

A Procurement & Vendor Management ERP — manage vendors, RFQs, quotations, approvals, purchase orders, and invoices, with built-in AI assistance.

This repo holds both apps:

- `BACKEND/` — Node + Express + MongoDB API
- `FRONTEND/master-admin/` — Next.js admin dashboard

---

## Prerequisites

- **Node.js 18+**
- **MongoDB** — a connection string (local or MongoDB Atlas)

---

## 1. Backend setup

```bash
cd BACKEND
npm install
cp .env.example .env
```

Open `.env` and set at least:

```
MONGODB_URI=<your mongodb connection string>
JWT_SECRET=<any long random string, 32+ chars>
```

Start it:

```bash
npm run dev
```

API runs at **http://localhost:4469**.

> Email sending (invoice/credential emails) is optional — it only works if you also set the `SMTP_*` values in `.env`. Everything else works without it.

---

## 2. Seed test data

With the backend `.env` configured, load demo vendors, RFQs, and quotations:

```bash
cd BACKEND
npm run seed:vb
```

This is safe to re-run anytime.

---

## 3. Frontend setup

```bash
cd FRONTEND/master-admin
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4469/api/v1
NEXT_PUBLIC_APP_NAME=VendorBridge Admin
NEXT_PUBLIC_LOGIN_PATH=/vb/auth/login
NEXT_PUBLIC_LOGOUT_PATH=/vb/auth/logout
NEXT_PUBLIC_ME_PATH=/vb/auth/me

# IMPORTANT: must be the SAME value as JWT_SECRET in BACKEND/.env
AUTH_FLAG_SECRET=<same long random string you used for JWT_SECRET>
```

Start it:

```bash
npm run dev
```

App runs at **http://localhost:3000**.

---

## Test credentials

Tenant: **vendorbridge**

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@vendorbridge.test` | `Admin@1234` |
| Vendor (Acme) | `vendor.acme@vendorbridge.test` | `Vendor@1234` |
| Vendor (BrightTech) | `vendor.brighttech@vendorbridge.test` | `Vendor@1234` |

Log in at **http://localhost:3000** with the admin account to manage everything.
For the vendor view, log in with a vendor account in a **separate / incognito**
window (one browser holds one session at a time).

---

## Quick test flow

1. **Admin** logs in → Dashboard.
2. **Vendors** → add a vendor (you get a portal link + temporary password to share).
3. **RFQs** → create an RFQ and assign vendors.
4. **Vendor** logs in (incognito) → opens their assigned RFQ → submits a quotation (AI co-pilot can help).
5. **Admin** → RFQ → **AI auto-review** → **Approve** (auto-creates the Purchase Order + Invoice) → download / email the invoice.
6. Explore **Quotations comparison**, **Reports**, **Activity**, and the **AI assistant** (bottom-right) or press **⌘K / Ctrl+K** to search.
