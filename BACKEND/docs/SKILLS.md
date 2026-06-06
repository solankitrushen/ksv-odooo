# Backend Agent Skills — When to Use

**Spec first (global):** `spec-driven-development` — FR + NFR in `docs/specs/` before any scoped build; Figma section only if user gives design refs.

Skills extend the agent for **design**, **orchestration**, **database**, **testing**, and **security audit** on this IMS / Insta-Cafe backend.

**Always read first:** [`../../docs/specs/README.md`](../../docs/specs/README.md), [`../../structure.md`](../../structure.md), [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Quick picker

| You are doing… | Use this skill | Install |
|----------------|----------------|---------|
| New route, controller split, Express layout | `nodejs-express-server` | `npx skills add aj-geddes/useful-ai-prompts@nodejs-express-server -g -y` |
| REST naming, status codes, resource URLs | `rest-api-design` | `npx skills add aj-geddes/useful-ai-prompts@rest-api-design -g -y` |
| Router/modules/services folder structure | `express-rest-api` | `npx skills add pluginagentmarketplace/custom-plugin-nodejs@express-rest-api -g -y` |
| Align monolith with Express+Mongo patterns | `nodejs-express-mongodb-backend-pattern` | `npx skills add laskar-ksatria/building-observable-nodejs-api@nodejs-express-mongodb-backend-pattern -g -y` |
| Schema design, indexes, Mongoose queries | `mongodb` (if available) or local `insta-cafe-db` | see § Database |
| Multi-step flow (order → stock → cart) | `insta-cafe-backend-orchestration` | project-local (below) |
| Supertest / API contract tests | `api-testing` | `npx skills add secondsky/claude-skills@api-testing -g -y` |
| Unit tests for handlers/utils | `jest-testing` | `npx skills add pluginagentmarketplace/custom-plugin-nodejs@jest-testing -g -y` |
| Pre-deploy security review | `security-auditor` | `npx skills add charon-fan/agent-playbook@security-auditor -g -y` |
| Full backend task on this repo | `insta-cafe-backend` | project-local (below) |

---

## 1. Backend design (service + API)

### `rest-api-design` (aj-geddes, ~1.2K installs)

**When:** Designing or renaming endpoints; choosing GET vs POST; pagination; error response shape; versioning.

**Triggers:** "design API", "REST", "endpoint naming", "status codes", new resource CRUD.

**Do not use for:** Mongoose schema internals only (use DB skill).

### `express-rest-api` (pluginagentmarketplace, ~600 installs)

**When:** Refactoring `index.js` into `routes/` + `controllers/` + `services/` per `structure.md` §3.

**Triggers:** "split routes", "layered architecture", "controller", "service layer".

### `nodejs-express-server` (aj-geddes, ~2.5K installs)

**When:** Middleware order, CORS/cookies, error handlers, env config, server bootstrap.

**Triggers:** "Express setup", "middleware", "CORS", "cookie auth".

### `nodejs-express-mongodb-backend-pattern` (laskar-ksatria, stack-specific)

**When:** Patterns that match **this repo**: Express + Mongoose + feature folders.

**Triggers:** "MERN backend", "mongoose pattern", "folder structure like ours".

### Local: `insta-cafe-backend-design`

**When:** Any API/service change **in this project** — agent must read `structure.md` §2–4 first.

**Path:** `.agents/skills/insta-cafe-backend-design/SKILL.md`

---

## 2. Orchestration & service management

### Local: `insta-cafe-backend-orchestration`

**When:**

- Workflow spans **multiple** modules (e.g. `Orders` + `Products` + `Cart`)
- Transaction-like behavior (all succeed or fail)
- Moving logic out of route handlers into `services/`
- DB connection lifecycle, graceful shutdown, health checks beyond `/health`

**Triggers:** "orchestrate", "workflow", "service layer", "multi-step", "saga", "manage services".

**Pair with:** `express-rest-api` when creating new `services/` files.

---

## 3. Database service

### `mongodb` (bobmatnyc — install may vary by CLI version)

**When:** Indexes, aggregation, schema migration, query perf, ObjectId conventions.

**Triggers:** "mongoose", "schema", "index", "aggregation", "slow query".

**Fallback:** Local `insta-cafe-db` + Supabase Postgres skill only if migrating off Mongo.

### Local: `insta-cafe-db`

**When:** Changes under `BACKEND/Schema/` or `db.js` for **this** app's models (Product, Order, Cart, etc.).

**Path:** `.agents/skills/insta-cafe-db/SKILL.md`

---

## 4. Testing

### `api-testing` (secondsky, ~400+ installs)

**When:** Supertest integration tests, contract tests for routes in `ARCHITECTURE.md`, auth cookie flows.

**Triggers:** "API test", "supertest", "integration test", "test endpoint".

### `jest-testing` (pluginagentmarketplace)

**When:** Unit tests for pure functions, mocked Mongoose, middleware unit tests.

**Triggers:** "jest", "unit test", "mock model".

**Project rule:** Add `__tests__/` next to domain or under `BACKEND/__tests__/`; wire `npm test` to jest.

### Local: `insta-cafe-testing-audit`

**When:** Test plan + audit checklist before release (combines testing + security smoke).

**Path:** `.agents/skills/insta-cafe-testing-audit/SKILL.md`

---

## 5. Security & audit

### `security-auditor` (charon-fan, ~700+ installs)

**When:**

- Auth/cookie/JWT review
- Input validation gaps
- Secret leakage (env, mail, repo history)
- OWASP-style pass before deploy

**Triggers:** "security audit", "vulnerability", "auth review", "pen test", "safe for production".

**Always:** Manual rotate of exposed SMTP/password if found in source.

---

## 6. Master local skill

### `insta-cafe-backend`

**When:** Any backend task where scope is unclear — loads map, picks subsection skills above.

**Path:** `.agents/skills/insta-cafe-backend/SKILL.md`

---

## Install all (copy-paste)

```bash
npx skills add aj-geddes/useful-ai-prompts@nodejs-express-server -g -y
npx skills add aj-geddes/useful-ai-prompts@rest-api-design -g -y
npx skills add pluginagentmarketplace/custom-plugin-nodejs@express-rest-api -g -y
npx skills add laskar-ksatria/building-observable-nodejs-api@nodejs-express-mongodb-backend-pattern -g -y
npx skills add secondsky/claude-skills@api-testing -g -y
npx skills add pluginagentmarketplace/custom-plugin-nodejs@jest-testing -g -y
npx skills add charon-fan/agent-playbook@security-auditor -g -y
# Optional if package resolves:
npx skills add bobmatnyc/claude-mpm-skills@mongodb -g -y
```

**Links:** https://skills.sh/

---

## Suggested workflow

1. Open `structure.md` → confirm layer (§2–3).
2. Pick skill from **Quick picker** table.
3. Implement in `BACKEND/` following target layout in `structure.md` §3.
4. Run `insta-cafe-testing-audit` before PR.
5. Update `ARCHITECTURE.md` if routes or models changed.
