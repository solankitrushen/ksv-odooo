# BACKEND — Live Architecture Snapshot

> Parent map: [`../../structure.md`](../../structure.md)  
> Skills guide: [`SKILLS.md`](SKILLS.md)

## Summary

Single **Express monolith** on port **4469**, **MongoDB** via Mongoose.

| Auth system | Roles | Prefix |
|-------------|-------|--------|
| **InstaCafe** | admin, store, user | `/api/v1/auth/*` |
| **Legacy IMS** (own JWT secret, gated by `LEGACY_IMS_ENABLED`) | branch manager, employee, shop keeper | `/legacy/ims/*` |
| **Razorpay webhook** (raw body) | provider | `/api/v1/webhook/razorpay` |

Production-required env is enforced by `config/env.js` at boot — see [`PROD-READINESS.md`](PROD-READINESS.md).

Spec: [`../../docs/specs/phase-1-auth-foundation.md`](../../docs/specs/phase-1-auth-foundation.md)

## Directory map

```
BACKEND/
├── index.js              # App entry, all route wiring
├── db.js                 # mongoose.connect(MONGO_URL)
├── package.json
├── Schema/               # Mongoose models (8 files)
├── Auth/
│   ├── branchManagerAuth/
│   ├── employeeAuth/
│   └── shopKeeperAuth/
├── Middleware/           # auth, uploads, role login
├── Products/
├── Category/
├── Cart/
├── Orders/
├── Employee/
├── BranchManagers/
├── SurveyForm/
├── SubCategory/          # CreateSubCategory (route not mounted)
├── mailService/          # nodemailer + ejs views
├── PDF Generation/
├── GetProductImg.js / GetCategoryImg.js
└── DeleteProductImg.js / DeleteBanner.js
```

## Data models (`Schema/`)

| File | Collection purpose |
|------|-------------------|
| `product.js` | Inventory items, stock, images |
| `Category.js` | Product categories |
| `Cart.js` | Shopping carts |
| `Order.js` | Material orders |
| `register.js` | Employee registration |
| `branchmanagerschema.js` | Branch managers + cartId |
| `shopKeeper.js` | Shop keeper accounts |
| `SurveyForm.js` | Surveys |
| `SubCategory.js` | Sub-categories |

## Middleware chain

1. `dotenv` + `connectToMongo()`
2. `cookieParser`, `express.json`, `cors` (multi `CLIENT_URL_*`)
3. Public auth + verify routes
4. **`authMiddleware`** — requires `Authtoken` OR `branchAuthtoken`
5. Protected handlers

Other middleware (used on specific routes):

- `employeeloginmiddleware.js` — `POST /employeeLoginMiddleware`
- `UploadBanner.js` / `UploadCategoryImg.js` — multer single file
- `islogin.js`, `isRegister.js`, `branchLoginMiddleware.js` — legacy / partial use

## External dependencies per request type

| Feature | Dependency |
|---------|------------|
| Persistence | MongoDB |
| Session | `jsonwebtoken` + cookies |
| Images | Local filesystem + multer |
| Registration emails | nodemailer + ejs |
| Reports | pdfkit |

## Disposable email blocklist

- Package: `disposable-email-domains` (~60k domains), loaded in `src/Utils/disposableEmail.js` as `Set` lookup.
- Enforced: Zod on `userRegisterSchema`, `loginOTPSchema`, `storeRegisterSchema`; controller guard on register/OAuth/login-otp.
- Env: `DISABLE_DISPOSABLE_EMAIL_CHECK=true` (dev only); `DISPOSABLE_EMAIL_EXTRA=domain.com` for custom domains.

## Security notes (audit backlog)

- Rotate any credentials that were ever committed; use env-only SMTP auth.
- Prefer `bcrypt` for all password paths (package already listed).
- Add input validation (e.g. zod/joi) on POST bodies.
- Add rate limiting on auth routes.
- Run `security-auditor` skill before production deploy.

## InstaCafe module (`src/`)

```
src/
├── Schema/       User, Store, Admin, MenuItem, Combo, Discount (+ Order/Payment/Delivery stubs)
├── Routes/       /api/v1/auth, /admin, /user
├── Controllers/  auth, menuItem, combo, discount, userMenu
├── Services/     discountService, comboService
├── Middleware/   JWT, role, Zod, sanitize, uploadMenuImage
└── Validators/   authValidator, inventoryValidator
```

### SPEC-002 inventory routes

| Prefix | Role | Examples |
|--------|------|----------|
| `/api/v1/admin` | admin | `GET /dashboard`, `GET /reports/sales`, inventory CRUD |
| `/api/v1/user` | user | `GET /menu`, `GET /combos` |
| `/api/v1/user/orders` | user | `POST /`, `GET /`, `GET /:id` |
| `/api/v1/store/orders` | store | `GET /`, `PATCH /:id/accept`, `PATCH /:id/reject`, `PATCH /:id/status`, `POST /:id/message`, `GET /report` |
| `/api/v1/public/menu` | public | Static menu images |

Spec: [`../../docs/specs/phase-2-inventory-management.md`](../../docs/specs/phase-2-inventory-management.md)  
Orders: [`../../docs/specs/phase-3-orders-store-cycle.md`](../../docs/specs/phase-3-orders-store-cycle.md)

## Testing status

```bash
cd BACKEND && npm install && npm test
npm run test:api        # endpoint matrix
npm run test:security   # OWASP-style penetration tests
```

Requires local MongoDB (`127.0.0.1:27017`) or `MONGODB_TEST_URI`. No in-memory Mongo download.

**Report:** [`../../docs/specs/reports/INSTACAFE-API-SECURITY-REPORT.md`](../../docs/specs/reports/INSTACAFE-API-SECURITY-REPORT.md) (SPEC-003).
