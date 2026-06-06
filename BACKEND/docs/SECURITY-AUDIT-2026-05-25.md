# InstaCafe Backend — Security Audit (2026-05-25)

> Baseline audit before `security-hardening` branch fixes.
> Scope: `BACKEND/index.js`, `src/` (Routes/Controllers/Services/Middleware/Schema), legacy `Auth/`, `Cart/`, `Orders/`, `Products/`, all `docs/specs/*`.
> Model: 1km radius local cafe — user → store → delivery.

---

## Decisions (locked in by user)

1. **Legacy IMS**: kept and hardened in place (not deleted). Admin uses single hardcoded creds (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).
2. **Tests**: update alongside fixes — break and re-green.
3. **Razorpay webhook**: wire route now; `RAZORPAY_WEBHOOK_SECRET` placeholder in `.env.example`.
4. **Atomicity**: atomic Mongo pipelines now; transactions deferred to replica-set deploy.

---

## CRITICAL

| ID  | Title                                                              | Fix branch / commit            |
| --- | ------------------------------------------------------------------ | ------------------------------ |
| C1  | Legacy IMS routes share JWT secret + bypass roleMiddleware         | `security-hardening` (planned) |
| C2  | Plaintext password compare on legacy logins                        | bcrypt hook + compare          |
| C3  | Legacy JWT `jwt.sign` has no `expiresIn`                           | add `expiresIn` everywhere     |
| C4  | `ORDER_AUTO_PAYMENT_SUCCESS=true` bypasses Razorpay in prod        | startup assert                 |
| C5  | `storeRegister` defaults missing location to Mumbai (19.076, 72.8) | location required + PATCH      |
| C6  | Razorpay `verifyWebhookSignature` exists but no webhook route      | mount `/api/v1/webhook/razorpay` raw-body |
| C7  | Legacy `Cart/AddCart` IDOR — accepts any `cartId` in body          | bind to JWT-resolved cartId    |

## HIGH

| ID  | Title                                                                              |
| --- | ---------------------------------------------------------------------------------- |
| H1  | No CSRF protection on cookie-auth mutations                                        |
| H2  | CORS reflective via `.filter(Boolean)` — confirm closed list                        |
| H3  | `POST /user/orders` returns `deliveryOtp` plaintext in response                     |
| H4  | `parameterTypeValidator` regex `/(\$\|{\|%\|\|)/` blocks legit input, easily bypassed |
| H5  | Admin/Store sessions cannot be revoked (no server session table)                   |
| H6  | JWT 7d access + 30d refresh, no rotation, refresh signed with same secret          |
| H7  | Disposable-email blocker missing on admin login                                    |
| H8  | Legacy upload: no MIME filter, no size limit, filename `Date.now()+originalname`   |
| H9  | Store `isVerified` defaults false but login does not gate on it                     |
| H10 | Order create → stock reserve → DB create not atomic across collections             |
| H11 | `paymentReference` index sparse but not unique → race double-create                |

## MEDIUM

M1 `DELIVERY_FREE_KM` hardcoded; M2 client `deliveryDistanceKm` honored for non-delivery; M3 `prepNotes` unbounded; M4 `storeMessages` unbounded; M5 `consumeOrderStock` not atomic with status update; M6 no idempotency key on `createOrder`; M7 error stack leak if `NODE_ENV !== 'production'`; M8 coarse role model (acceptable v1); M9 `loginRateLimiter` by IP only; M10 helmet no CSP / HSTS; M11 cookieParser no secret; M12 `loginHistory` PII grow; M13 `console.log` of cookies/secrets in legacy; M14 `JWT_SECRET2` separate; M15 Cloudinary upload size verify; M16 session `lastUsedAt` write on every request; M17 auth DB lookup on every request.

## LOW

L1 no `express.json({limit})`; L2 invalid `UPDATE` HTTP method in CORS list; L3 `massage` typo; L4 inconsistent order shape; L5 `roundKm` boundary; L6 disposable Set memory; L7 25 open `npm audit`; L8 PDF body unvalidated; L9 order rate-limit fallback to IP; L10 `loginHistory` cap inconsistent.

## ARCHITECTURAL GAPS

Bull queue, expiry cron (10-min pending), user cancel + fee tiers, webhook (C6 above), ItemAuditLog, refund on reject, constant-time 404, transactions, virus scan uploads, `npm audit` CI gate, legacy deprecation plan.

---

## What is GOOD (preserve)

- Order accept: `version` + `findOneAndUpdate` predicate (single-node optimistic lock)
- Stock reserve+release best-effort on `Order.create` error
- Delivery OTP hashed + timing-safe compare
- Razorpay signature HMAC + `crypto.timingSafeEqual`
- Payment amount cross-checked vs server quote
- IDOR mitigation on `/api/v1/*/orders/*` via `userId`/`storeId` filters
- Zod + `express-mongo-sanitize` + `xss` on `/api/v1`
- Admin JWT forgery test passes (Admin/Store DB lookup in `authMiddleware`)
- 113/113 tests green pre-audit

---

## Fix priority

1. C1-C7 (this branch)
2. H1-H11 (this branch)
3. M1, M3-M7, M9, M10, M13 (this branch)
4. L1, L3 (this branch)
5. Architectural gaps → future phase

## Verification

- `cd BACKEND && npm test` — all suites green
- Manual: `__tests__` parity + new tests for webhook, legacy bcrypt, store location update, IDOR
- `npm run test:security` — penetration suite still passes new fixes
