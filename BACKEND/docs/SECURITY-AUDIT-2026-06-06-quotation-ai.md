# Security Audit — VendorBridge Quotation Core + AI (SPEC-VB-003 / SPEC-VB-003-AI)

**Date:** 2026-06-06
**Scope:** New surface — `/api/v1/vb/vendor/*`, `/api/v1/vb/quotations/*` (incl. `ai/*`), and staff `/api/v1/vb/rfq/:id/quotations[/:id/download]`.
**Method:** OWASP Top-10 style review + automated Supertest assertions (`__tests__/vb/quotationFlow.test.js`) + unit suites (totals, AI provider, PDF).
**Result:** No high/critical findings. All Must-level checks pass. Residual items are explicitly deferred to later specs.

---

## OWASP Top-10 review

| ID | Risk | Status | Evidence / control |
|----|------|--------|--------------------|
| A01 | Broken access control / IDOR | **Pass** | All routes behind `authMiddleware → tenantContext → roleMiddleware`. Vendor reads/writes scoped via `loadOwnQuotation({tenantId, vendorId, id})`; staff scoped by `tenantId`. Cross-vendor + cross-tenant access returns 404 (tested). Staff cannot read/download drafts (tested). |
| A02 | Cryptographic failures | **Pass** | No secrets rendered into PDFs (vendor identity limited; peer data aggregate-only). Idempotency keys hashed (sha256) for fingerprinting, not stored raw as comparison material beyond the dedup key. |
| A03 | Injection (NoSQL) | **Pass** | Mongoose typed queries only; global `mongoSanitizeMiddleware` + `xssProtection` + `parameterTypeValidator`; all ids validated with a 24-hex `objectId` regex before query; Zod validates every body. |
| A04 | Insecure design | **Pass** | Money is **server-computed only** (`quotationTotalsService`); client/AI totals dropped pre-validate (zod strips unknown keys) and never read. Deadline-aware state machine; submit is an atomic conditional `findOneAndUpdate`. AI output treated as untrusted input through the same write path. |
| A05 | Security misconfiguration | **Pass** | Rate limits on AI (20/min) + download (30/min). New env keys documented in `.env.example`. Heuristic AI default needs no secret. |
| A06 | Vulnerable components | **Pass** | No new dependencies added; reuses installed `pdfkit`, `axios`, `zod`, `express-rate-limit`. |
| A07 | Auth / identity failures | **Pass** | VB realm session validation in `authMiddleware` (active user, active membership, session not revoked) applies to all new routes. |
| A08 | Software & data integrity | **Pass** | Idempotency replay returns stored response; **different body + same key → 422 `fingerprint_mismatch`** (tested). Coverage gate (`coverage>0`) blocks empty submits (422, tested). Price immutability after submit (409, tested). |
| A09 | Logging & monitoring | **Partial** | Reuses `sensitiveRouteLogger`; structured audit hooks (FR-13/16) are stubbed for SPEC-VB-008 to consume. |
| A10 | SSRF | **Pass (heuristic) / Contained (llm)** | Default heuristic provider makes no network calls. The optional `llm` provider calls only an operator-configured base URL (env-gated); RFQ/answer text is sent as data, never as instructions, and a failure/timeout degrades to heuristic / `ai_unavailable`. |

---

## Money & AI integrity (design-critical)

| Attack | Control | Test |
|--------|---------|------|
| `subtotal`/`grandTotal` forged in create/patch body | Not in schema → zod strips; server recomputes | `vendor full flow` asserts stored subtotal/grandTotal ignore the forged values |
| Float unit price | `paise = z.number().int()` rejects | `rejects float price (4xx)` |
| AI proposes a total / float / negative | Provider emits inputs only; `draftFromAnswers` coerces to int paise or null; same Zod + recompute on write | `AI generate flow` (server totals); provider unit tests |
| `status='submitted'` via AI apply / body | Status only via dedicated routes + state machine | apply path never sets status; `applySuggestions` only patches pricing/terms |
| Idempotency key reuse, different body | sha256 fingerprint mismatch → 422 | `idempotent create replay … mismatch body → 422` |
| Deadline race (parallel submit) | Atomic `findOneAndUpdate({status:'draft', deadline:{$gte:now}})` | `concurrent double-submit … exactly one success` |

---

## Privacy — peer stats (SPEC-VB-003-AI NFR-5)

- `quotationPeerStatsService` returns **only** aggregates (count, median, min, max), computed across **other** vendors' `submitted` quotes, and only when `>= AI_PEER_MIN_SAMPLES` (default 3). Below threshold → item omitted → `peerStatsAvailable:false`. No vendor identity or raw individual quote is ever exposed. Suggestion rationale references only the aggregate median (verified in provider unit tests).

---

## Residual / deferred (accepted)

| Item | Severity | Disposition |
|------|----------|-------------|
| Full LLM prompt-injection hardening | Low (heuristic default immune) | SPEC-VB-003-AI partial; revisit if `llm` provider is enabled in prod |
| Collusion / shill-bid detection | Medium (business) | SPEC-VB-009 analytics |
| Structured audit sink for quotation events | Low | SPEC-VB-008 |
| Per-vendor (not per-IP) rate-limit keying | Low | Limiter currently IP-keyed; tighten in SPEC-VB-011 hardening |
| Multi-currency peer normalization (FX) | Low | SPEC-VB-009 |

---

## Verification commands

```
cd BACKEND
npx eslint .                       # 0 errors
npm test                           # 30 suites / 196 tests pass
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand __tests__/vb/quotationFlow.test.js
```
