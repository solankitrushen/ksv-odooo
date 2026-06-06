# VendorBridge

**A Procurement & Vendor Management ERP** — manage vendors, RFQs, quotations, approvals, purchase orders, and invoices, with built‑in AI assistance.

Single repository containing both apps:

| App | Stack | Path | Port |
|-----|-------|------|------|
| Backend API | Node · Express · MongoDB | `BACKEND/` | 4469 |
| Admin / Vendor web app | Next.js · React · Tailwind · shadcn/ui | `FRONTEND/master-admin/` | 3000 |

---

## Demo

<video
  src="https://github.com/solankitrushen/ksv-odooo/raw/main/assets/demo.mp4"
  controls
  muted
  playsinline
  width="100%">
  Your browser can't play this video inline.
  <a href="https://github.com/solankitrushen/ksv-odooo/raw/main/assets/demo.mp4">Download the demo</a>.
</video>



https://github.com/user-attachments/assets/2519a9a1-14ff-413f-b4ff-61827d8b7fab



---

## Features

- **Vendors** — onboard vendors with instant portal credentials, activate / deactivate, reset access.
- **RFQs** — create requests for quotation with a guided multi‑step wizard and assign vendors.
- **Quotations** — vendors reply with quotations built using an **AI co‑pilot**; live AI scoring & suggestions.
- **Comparison** — side‑by‑side quotation comparison with lowest‑price highlighting.
- **Approvals** — AI auto‑review (0–100 score + recommendation), approve / reject, or AI‑drafted **bargaining tickets**.
- **Purchase Orders & Invoices** — auto‑generated on approval, downloadable as PDF, emailed to the vendor.
- **Reports & Activity** — spend by category, top vendors, monthly trends, full activity log.
- **AI assistant** — a floating help chatbox plus **⌘K / Ctrl+K** command palette.

## Roles

- **Admin / Officer / Manager (staff)** — full procurement: vendors, RFQs, comparison, approvals, POs, invoices, reports.
- **Vendor** — sees only their own data: assigned RFQs, submit/track quotations, their POs & invoices, negotiation tickets.

---

## Prerequisites

- **Node.js 18+**
- **MongoDB** connection string (local or MongoDB Atlas)

---

## Setup

### 1. Backend

```bash
cd BACKEND
npm install
cp .env.example .env
```

Set at least these in `BACKEND/.env`:

```
MONGODB_URI=<your mongodb connection string>
JWT_SECRET=<any long random string, 32+ chars>
```

Run it:

```bash
npm run dev      # http://localhost:4469
```

> Email (invoice / credential emails) is optional — it only sends when the
> `SMTP_*` values are set. Everything else works without it.

### 2. Seed demo data

```bash
cd BACKEND
npm run seed:vb   # tenant, staff, vendors, RFQs, sample quotations — safe to re-run
```

### 3. Frontend

```bash
cd FRONTEND/master-admin
npm install
```

Create `FRONTEND/master-admin/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4469/api/v1
NEXT_PUBLIC_APP_NAME=VendorBridge Admin
NEXT_PUBLIC_LOGIN_PATH=/vb/auth/login
NEXT_PUBLIC_LOGOUT_PATH=/vb/auth/logout
NEXT_PUBLIC_ME_PATH=/vb/auth/me

# IMPORTANT: must EXACTLY match JWT_SECRET in BACKEND/.env
AUTH_FLAG_SECRET=<same value as BACKEND JWT_SECRET>
```

Run it:

```bash
npm run dev      # http://localhost:3000
```

---

## Test credentials

Tenant: **vendorbridge**

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@vendorbridge.test` | `Admin@1234` |
| Vendor (Acme) | `vendor.acme@vendorbridge.test` | `Vendor@1234` |
| Vendor (BrightTech) | `vendor.brighttech@vendorbridge.test` | `Vendor@1234` |

Sign in at **http://localhost:3000**. For the vendor view, use a vendor account
in a **separate / incognito** window (one browser holds one session at a time).
You can also create a brand‑new organization from the **Sign up** screen.

---

## End‑to‑end flow

1. **Admin** adds a vendor → gets a portal link + temporary password to share.
2. **Admin** creates an RFQ (multi‑step wizard) and assigns vendors.
3. **Vendor** (incognito) → **RFQs** → **Build quotation** → AI co‑pilot builds it → submit.
4. **Admin** → RFQ → **AI auto‑review** → **Approve** → Purchase Order + Invoice auto‑generated (and emailed).
5. Or **Admin** raises a **bargaining ticket** → **Vendor** opens it → *Revise with AI* → resubmit → approved → invoice generated.
6. Explore **Quotations comparison**, **Reports**, **Activity**, the **AI assistant** (bottom‑right), and **⌘K** search.

---

## Production build

Stop the dev server before building (they share the `.next` folder):

```bash
# backend
cd BACKEND && npm start

# frontend
cd FRONTEND/master-admin && npm run build && npm start
```
