# InstaCafe Backend — Production Readiness Checklist

> Generated alongside the `security-hardening` branch. Walk this top-to-bottom
> before pointing a real load balancer at the server.

---

## 0. Branch + tests

- [x] `security-hardening` branch off `main` exists
- [x] All audit findings (`docs/SECURITY-AUDIT-2026-05-25.md`) addressed in code
- [x] `cd BACKEND && npm test` — **135 / 135** passing (was 113 / 113)
- [x] `npm run test:security` — penetration suite green (incl. new webhook + legacy IDOR)
- [x] `npm run test:api` — endpoint matrix green
- [ ] `npm run test:coverage` — review coverage report; raise thresholds before next phase
- [ ] `npm audit` — review the 25 transitive advisories noted in SPEC-002-SEC §5.2; plan upgrades

---

## 1. Environment variables (production)

Validator: `BACKEND/config/env.js`. Server **refuses to boot** when any required variable is missing.

### Required everywhere

| Variable           | Notes                                                       |
| ------------------ | ----------------------------------------------------------- |
| `NODE_ENV`         | `development` / `test` / `production`                       |
| `MONGO_URL` or `MONGODB_URI` | At least one must be set                          |
| `JWT_SECRET`       | ≥ 16 chars dev, **≥ 32 chars prod**, distinct from legacy    |
| `LEGACY_JWT_SECRET`| **Prod-required**, must differ from `JWT_SECRET`            |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed for the single hardcoded admin account   |

### Production-required (enforced by `config/env.js`)

| Variable                  | Where used                                |
| ------------------------- | ----------------------------------------- |
| `RAZORPAY_KEY_ID`         | order create / webhook                    |
| `RAZORPAY_KEY_SECRET`     | HMAC signature                            |
| `RAZORPAY_WEBHOOK_SECRET` | `/api/v1/webhook/razorpay`                |
| `CLOUDINARY_CLOUD_NAME`   | menu image + delivery proof uploads       |
| `CLOUDINARY_API_KEY`      | "                                         |
| `CLOUDINARY_API_SECRET`   | "                                         |
| `LEGACY_JWT_SECRET`       | legacy IMS cookies                        |

### Production hard-fails

- `ORDER_AUTO_PAYMENT_SUCCESS=true` ⇒ boot refused. Always `false` in prod.
- `JWT_SECRET === LEGACY_JWT_SECRET` ⇒ boot refused.
- `CLIENT_URL_*` all empty ⇒ boot refused (CORS would be wide open).
- `JWT_SECRET` shorter than 32 chars ⇒ boot refused.

### Optional / dev defaults

| Variable                          | Default       | Purpose                                |
| --------------------------------- | ------------- | -------------------------------------- |
| `LEGACY_IMS_ENABLED`              | `true`        | flip to `false` to retire legacy       |
| `LEGACY_PASSWORD_REHASH`          | `true`        | one-time hash on first plaintext login |
| `DELIVERY_OTP_DELIVERY_CHANNEL`   | `console`     | `email` / `sms` / `console`            |
| `CSRF_ENABLED`                    | auto-on prod  | force on in dev with `true`            |
| `CSRF_DISABLED`                   | unset         | test-only escape hatch                 |
| `DEBUG_ERROR_STACK`               | `false`       | echo stacks in 5xx (NEVER prod)        |
| `BODY_LIMIT`                      | `100kb`       | Express JSON cap                       |

---

## 2. Razorpay test wiring

Test creds live in `.env`:

```
RAZORPAY_KEY_ID=rzp_test_*
RAZORPAY_KEY_SECRET=*
RAZORPAY_WEBHOOK_SECRET=*   # set this in Razorpay dashboard → Webhooks
```

### End-to-end smoke

```bash
# 1. Boot
NODE_ENV=development npm start

# 2. Create payment order (server → Razorpay)
curl -X POST http://localhost:4469/api/v1/user/orders/payment/razorpay/order \
  -H 'Content-Type: application/json' \
  --cookie 'authToken=<user-jwt>' \
  -d '{ "storeId":"…", "deliveryType":"takeaway", "items":[…] }'

# 3. Pay via Razorpay Checkout (test card 4111 1111 1111 1111)
# 4. POST /api/v1/user/orders with razorpayPaymentId/OrderId/Signature
# 5. Verify Order.paymentStatus == "success" in Mongo
# 6. Configure webhook URL in Razorpay dashboard:
#    https://<your-host>/api/v1/webhook/razorpay
#    Events: payment.captured, payment.failed, order.paid
# 7. Trigger a test event → confirm WebhookEvent collection row + Order updated
```

### Webhook verification commands

```bash
# Compute a valid signature for a fixture event
BODY='{"id":"evt_smoke","event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_test","order_id":"order_test"}}}}'
SIG=$(node -e "console.log(require('crypto').createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(process.argv[1]).digest('hex'))" "$BODY")

curl -X POST http://localhost:4469/api/v1/webhook/razorpay \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: $SIG" \
  --data-raw "$BODY"
```

Expected: `200 { success: true }` on first call, `200 { duplicate: true }` on replay.

---

## 3. Boot tests

```bash
# Refuses to boot — prod with auto-pay on
NODE_ENV=production ORDER_AUTO_PAYMENT_SUCCESS=true node index.js
# Expected: throws [env] ORDER_AUTO_PAYMENT_SUCCESS=true is forbidden in production

# Refuses to boot — prod with too-short JWT secret
NODE_ENV=production JWT_SECRET=short node index.js
# Expected: throws [env] JWT_SECRET must be at least 32 characters in production

# Refuses to boot — colliding secrets
NODE_ENV=production JWT_SECRET=$X LEGACY_JWT_SECRET=$X node index.js
# Expected: throws [env] LEGACY_JWT_SECRET must differ from JWT_SECRET

# Boots
NODE_ENV=development npm start
# Expected: ✓ InstaCafe mounted at /api/v1
#           ✓ Razorpay webhook mounted at /api/v1/webhook/razorpay
#           ✓ Legacy IMS mounted at /legacy/ims
```

---

## 4. Mongo indexes (one-time)

```js
// Order.paymentReference is now `unique: true, sparse: true`
db.instaorders.createIndex({ paymentReference: 1 }, { unique: true, sparse: true });
db.instaorders.createIndex({ razorpayOrderId: 1 }, { unique: true, sparse: true });

// WebhookEvent.eventId is the idempotency key
db.instawebhookevents.createIndex({ eventId: 1 }, { unique: true });
```

Run once against the prod cluster, then restart the API.

---

## 5. Operational rotation

- [ ] Rotate `JWT_SECRET` quarterly (this invalidates all user sessions — schedule a window)
- [ ] Rotate `LEGACY_JWT_SECRET` quarterly (kicks legacy users)
- [ ] Rotate `RAZORPAY_WEBHOOK_SECRET` whenever a teammate leaves who had dashboard access
- [ ] Rotate `BCRYPT_ROUNDS` upward (10 → 12) when host CPU allows
- [ ] Audit `Admin.loginHistory` quarterly (capped at 50; PII-ish)

---

## 6. Pre-launch attack walk (manual)

Walk `docs/specs/reports/THIRD-PARTY-ATTACK-CHECKLIST.md` plus these new rows:

| ID  | Manual command                                                  | Expected |
| --- | --------------------------------------------------------------- | -------- |
| L1  | `POST /legacy/ims/employeeLogin` with `email: {"$gt":""}`        | 400      |
| L2  | `POST /legacy/ims/CreateCart` with mismatched body `cartId`     | cartId silently overridden by JWT |
| L3  | `POST /legacy/ims/upload-product-img` with `app.exe`             | 400      |
| L4  | Cookie `Authtoken` of employee A → `GET /legacy/ims/GetOrders`   | only A's cart |
| W1  | `POST /api/v1/webhook/razorpay` w/o `X-Razorpay-Signature`       | 400      |
| W2  | `POST /api/v1/webhook/razorpay` with tampered signature          | 401      |
| W3  | Replay same event id                                             | 200 `duplicate: true` |
| S1  | `POST /api/v1/auth/store/register` without `location`            | 400      |
| S2  | `POST /api/v1/auth/store/login` for unverified store             | 403      |
| S3  | `PATCH /api/v1/admin/stores/:id/verify` (admin) → store login    | 200      |

---

## 7. Backlog (deferred — not blocking launch)

- Bull / BullMQ for refund + notification jobs
- Order expiry cron (10-min pending → auto-cancel + release stock)
- User-initiated cancel + fee tiers
- ItemAuditLog (SPEC-004)
- Mongo transactions when Atlas / replica-set deploy is ready
- Virus scan on uploads
- `npm audit` CI gate

---

## 8. Final sign-off

- [ ] `npm test` green on CI
- [ ] All env validation hard-fails tested
- [ ] Razorpay end-to-end smoke run in test mode
- [ ] Webhook idempotency confirmed against staging
- [ ] Admin seed swapped from `ChangeMe@Secure123` to a real password
- [ ] Mongo indexes applied
- [ ] CORS origins locked to real domains
