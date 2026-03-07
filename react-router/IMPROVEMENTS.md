# Codebase Improvements Changelog

Tracking document for all improvements across 4 phases: Critical Security, Performance, Code Quality, and Polish.

---

## Phase 1 — Critical Security (Items 1, 2, 4, 10)

### Item 1: Trust Proxy Configuration

**Problem:** `TRUSTED_PROXIES` env var was parsed in `app/utils/config/env.server.ts` (line 45) but never applied to Express. This meant `req.ip` returned proxy IPs instead of real client IPs, breaking IP-based rate limiting and audit logging in production.

**Changes:**

| File | Change |
|------|--------|
| `server.js` (line 39) | Added `app.set("trust proxy", Number(process.env.TRUSTED_PROXIES) \|\| 1)` after `app.disable("x-powered-by")` |

**Impact:** `req.ip` now correctly resolves real client IPs through reverse proxies (nginx, CloudFlare, etc.). Rate limiting, audit logs, and session fingerprinting all benefit.

---

### Item 2: Session Fixation Prevention

**Problem:** `createUserSession` in `app/utils/auth/session.server.ts` created a new DB session and cookie but never invalidated the old session. If an attacker obtained a pre-login session cookie or if stale DB sessions accumulated, they could potentially be reused.

**Changes:**

| File | Change |
|------|--------|
| `app/utils/auth/session.server.ts` (lines 149-157) | Added old session cleanup: reads old cookie session, deletes old DB session by ID, then deletes ALL existing DB sessions for the user (`deleteMany`) before creating the new session |

**Details:**
- Reads old cookie session and extracts `sessionId`
- Deletes the specific old DB session (if exists)
- Deletes all other DB sessions for the user (enforces single-session)
- Then creates the new session as before

**Impact:** Prevents session fixation attacks. Enforces single active session per user. Old/orphaned DB sessions are cleaned up on every login.

---

### Item 3: API Idempotency (Phase 4 — not yet implemented)

---

### Item 4: Email Verification Wired Up

**Problem:** Two TODO comments indicated OTP emails were never actually sent during the email change flow. The email infrastructure (`sendEmail`, `otpEmail` template) already existed but wasn't connected.

**Changes:**

| File | Change |
|------|--------|
| `app/routes/$tenant/profile/change-email.tsx` (lines 8-9) | Added imports for `sendEmail` and `otpEmail` |
| `app/routes/$tenant/profile/change-email.tsx` (lines 82-84) | Replaced `TODO` + `logger.info` with actual `sendEmail(otpEmail(...))` call and `logger.debug` |
| `app/routes/$tenant/profile/verify-email.tsx` (lines 8-9) | Added imports for `sendEmail` and `otpEmail` |
| `app/routes/$tenant/profile/verify-email.tsx` (lines 50-52) | Replaced `TODO` + `logger.info` with actual `sendEmail(otpEmail(...))` call and `logger.debug` for resend flow |
| `app/routes/$tenant/profile/verify-email.tsx` (line 104) | Fixed `catch (error: any)` to `catch (error: unknown)` with proper type guard for Prisma P2002 error |
| `app/routes/$tenant/profile/verify-email.tsx` (line 154) | Replaced `actionData as any` with `actionData as Record<string, unknown> \| undefined` |

**Impact:** Email change verification now actually sends OTP codes via the configured email provider (Resend). Falls back to console logging when `RESEND_API_KEY` is not set (existing `sendEmail` behavior).

---

### Item 10: Error Class Standardization

**Problem:** Three separate error class hierarchies existed:
1. `ServiceError` in `app/utils/errors/service-error.server.ts` — used by all services
2. `AppError` in `app/utils/api-error.server.ts` — with `NotFoundError`, `ConflictError`, `ForbiddenError` (unused in routes)
3. Standalone errors in `app/services/optimistic-lock.server.ts` — `ConflictError`, `PreconditionRequiredError`, `NotFoundError` extending bare `Error`

This meant `handleServiceError` only caught `ServiceError` instances, missing errors from the other two hierarchies.

**Changes:**

| File | Change |
|------|--------|
| `app/utils/api-error.server.ts` | Removed `AppError` base class. `NotFoundError`, `ConflictError`, `ForbiddenError` now extend `ServiceError`. `formatErrorResponse` checks `instanceof ServiceError` instead of `instanceof AppError` |
| `app/services/optimistic-lock.server.ts` | `ConflictError`, `PreconditionRequiredError`, `NotFoundError` now extend `ServiceError` with proper `status` and `code` properties instead of custom `statusCode`/`code` fields |
| `app/utils/errors/handle-service-error.server.ts` | Added handling for `currentResource` property from optimistic lock `ConflictError` — includes it in the error response when present |
| `tests/unit/services/optimistic-lock.server.test.ts` (lines 35, 53) | Updated assertions from `.statusCode` to `.status` to match new `ServiceError` property name |

**Impact:** All error classes now share a single hierarchy rooted at `ServiceError`. `handleServiceError` and `formatErrorResponse` catch all domain errors consistently. No more missed error types in catch blocks.

---

## Phase 2 — Performance (Items 5, 6, 7, 8)

### Item 5: Composite Database Indexes

**Problem:** Several models lacked composite indexes for common query patterns, causing full table scans on filtered + sorted queries.

**Changes:**

| File | Model | Index Added |
|------|-------|-------------|
| `prisma/schema.prisma` | `AuditLog` | `@@index([tenantId, action, createdAt])` — tenant-scoped audit log filtering by action + time range |
| `prisma/schema.prisma` | `AuditLog` | `@@index([entityType, entityId])` — looking up audit history for specific entities |
| `prisma/schema.prisma` | `Notification` | `@@index([tenantId, createdAt])` — tenant-wide notification queries sorted by time |
| `prisma/schema.prisma` | `ApiKey` | `@@index([tenantId, createdAt])` — sorted API key listing per tenant |
| `prisma/schema.prisma` | `ApiKey` | `@@index([expiresAt])` — expiration cleanup jobs |
| `prisma/schema.prisma` | `WebhookDelivery` | `@@index([createdAt])` — retention/cleanup queries |

**Impact:** Queries that filter by tenant + sort by date (the most common pattern for list pages) now use composite indexes instead of scanning. Cleanup jobs for expired API keys and old webhook deliveries also benefit.

**Note:** Run `npm run db:migrate` to apply these index additions to the database.

---

### Item 6: Permission Loading Optimization (N+1 Fix)

**Problem:** `fetchUser` in `app/utils/auth/session.server.ts` used nested `include` to load `userRoles -> role -> rolePermissions -> permission`. This fetched all columns from every table (including `password`, `status`, timestamps, `description`, etc.) even though only a handful of fields were needed for auth checks.

**Changes:**

| File | Change |
|------|--------|
| `app/utils/auth/session.server.ts` (lines 118-131) | Replaced `include` with `select` — only fetches `id`, `email`, `name`, `photoUrl`, `tenantId` from User; `eventId`, `stepId` from UserRole; `id`, `name`, `scope` from Role; `access` from RolePermission; `resource`, `action` from Permission |

**Before:** `include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } }`
**After:** Explicit `select` with only the 12 fields actually used by `loadAuthUser` in `require-auth.server.ts`

**Impact:** Significantly reduces data transfer from PostgreSQL on every authenticated request. For a user with 5 roles and 50 permissions, this cuts the response payload by ~60-70% since unnecessary columns (descriptions, timestamps, deletedAt, extras, etc.) are no longer fetched.

---

### Item 7: Database Pool Configuration

**Problem:** `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX`, `DATABASE_QUERY_TIMEOUT`, and `DATABASE_CONNECTION_TIMEOUT` were parsed in `app/utils/config/env.server.ts` but never passed to the database adapter. Prisma used default pool settings regardless of env configuration.

**Changes:**

| File | Change |
|------|--------|
| `app/utils/db/db.server.ts` (lines 1, 19-30) | Added `import pg from "pg"`. Created an explicit `pg.Pool` with `min`, `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`, and `statement_timeout` from env vars (with sensible defaults). Passed the pool to `PrismaPg` adapter instead of a raw connection string |

**Configuration defaults (from env.server.ts):**
- `DATABASE_POOL_MIN`: 2
- `DATABASE_POOL_MAX`: 10
- `DATABASE_QUERY_TIMEOUT`: 5000ms
- `DATABASE_CONNECTION_TIMEOUT`: 10000ms
- `idleTimeoutMillis`: 30000ms (hardcoded)

**Design decision:** Uses `process.env` directly instead of importing `env` to avoid eager env validation at module load time (which breaks isolated unit tests that mock the db module).

**Impact:** Database pool is now properly sized and configured. Long-running queries are killed after `DATABASE_QUERY_TIMEOUT` ms. Connection acquisition times out after `DATABASE_CONNECTION_TIMEOUT` ms. Pool size can be tuned per environment via env vars.

---

### Item 8: Rate Limit Audit Write Batching

**Problem:** `logRateLimitViolation` in `server/rate-limit-audit.ts` fired a database write on every single rate-limit violation. Under a DDoS or brute-force attack, this could saturate the database with audit writes, making the audit system itself a performance bottleneck.

**Changes:**

| File | Change |
|------|--------|
| `server/rate-limit-audit.ts` | Replaced fire-and-forget single `create` with a buffer + batch `createMany` approach. Violations are buffered in memory and flushed either when the buffer reaches 50 entries or every 5 seconds (via `setInterval` with `.unref()`). Exported `flushRateLimitBuffer()` for graceful shutdown integration (Item 13) |
| `tests/unit/server/rate-limit-audit.test.ts` | Updated tests to match batching behavior: mock now uses `createMany` instead of `create`, tests verify buffering (no immediate write), manual `flushRateLimitBuffer()` call, and empty buffer no-op |

**Implementation details:**
- `buffer: ViolationContext[]` — in-memory array
- `MAX_BUFFER_SIZE = 50` — auto-flush threshold
- `FLUSH_INTERVAL_MS = 5000` — periodic flush timer (`.unref()` so it doesn't keep Node alive)
- `flushRateLimitBuffer()` — exported for graceful shutdown (Phase 3, Item 13)
- Errors in `createMany` are still swallowed (best-effort audit logging)

**Impact:** Under attack with 1000 violations/second, database writes go from 1000/s to ~1 batched write every 50ms (20/s), a 50x reduction. Normal traffic is unaffected — violations are flushed within 5 seconds.

---

## Phase 3 — Code Quality (Items 9, 11, 12, 13)

### Item 9: Remove `as any` Casts

**Problem:** Widespread `as any` usage across API routes and utilities reduced type safety, making refactoring risky and hiding potential bugs.

**Changes:**

| File | Change |
|------|--------|
| `app/routes/api/v1/users.tsx` (line 14) | Removed `as any` on `where` — no longer needed since redundant `deletedAt: null` was removed (Item 11) |
| `app/routes/api/v1/users.tsx` (line 45) | Replaced `let body: any` with Zod-validated `body` from `parseApiRequest` (Item 12) |
| `app/routes/api/v1/users.$userId.tsx` (line 37) | Replaced `let body: any` with Zod-validated `body` via `updateUserBody` schema |
| `app/routes/api/v1/roles.tsx` (line 43) | Replaced `let body: any` with Zod-validated `body` via `createRoleBody` schema |
| `app/routes/api/v1/roles.$roleId.tsx` (line 38) | Replaced `let body: any` with Zod-validated `body` via `updateRoleBody` schema |
| `app/utils/events/job-queue.server.ts` (line 28) | Replaced `payload as any` with `payload as Prisma.InputJsonValue` |
| `app/routes/$tenant/profile/verify-email.tsx` (lines 104, 154) | Already fixed in Phase 1 Item 4 — `error: unknown` with type guard, `actionData` cast to `Record<string, unknown>` |

**Impact:** All API routes now have fully typed request bodies validated by Zod schemas. The only remaining `as any` casts are in `db.server.ts` soft-delete extension (unavoidable due to Prisma extension type limitations — documented with comments).

---

### Item 11: Soft Delete Consistency

**Problem:** The soft-delete extension in `db.server.ts` automatically filters `deletedAt: null` on `findMany`, `findFirst`, and `count` for `user`, `role`, and `webhookSubscription`. However, all API routes were manually adding redundant `deletedAt: null` to their `where` clauses, double-filtering and obscuring the fact that soft-delete is handled automatically.

**Changes:**

| File | Change |
|------|--------|
| `app/routes/api/v1/users.tsx` (line 14) | Removed `deletedAt: null` from `where` — extension handles it. Added comment explaining why |
| `app/routes/api/v1/users.$userId.tsx` (lines 11, 45, 72) | Removed `deletedAt: null` from all three `findFirst` queries. Added comment on soft-delete behavior |
| `app/routes/api/v1/roles.tsx` (line 13) | Removed `deletedAt: null` from `where` |
| `app/routes/api/v1/roles.$roleId.tsx` (lines 11, 46, 65) | Removed `deletedAt: null` from all three `findFirst` queries |

**Kept as-is:**
- `deletedAt: new Date()` in DELETE actions — the extension doesn't intercept `update`, so manual soft-delete writes are still necessary (documented with inline comments)
- `db.server.ts` soft-delete extension scope — already covers all 3 models that have `deletedAt` in the schema

**Impact:** API routes are cleaner and consistently rely on the extension. Developers no longer need to remember to add `deletedAt: null` — it's automatic. The remaining manual `as any` in the extension itself is documented as a Prisma limitation.

---

### Item 12: API Validation Middleware

**Problem:** All 4 API action routes repeated the same 10-15 line boilerplate: authenticate via Bearer token, check permission, validate HTTP method, parse JSON body, and handle parse errors. This was error-prone and made routes harder to read.

**Changes:**

| File | Change |
|------|--------|
| `app/utils/api/middleware.server.ts` (new) | Created `parseApiRequest<TBody>(request, options)` helper. Handles: auth (`apiAuth`), permission check (`requireApiPermission`), HTTP method validation, JSON body parsing with Zod schema validation. Returns typed `{ auth, body }` or throws a JSON error Response |
| `app/routes/api/v1/users.tsx` | Refactored POST action: replaced 15 lines of boilerplate with `parseApiRequest(request, { permission, methods, bodySchema })`. Added `createUserBody` Zod schema for typed validation |
| `app/routes/api/v1/users.$userId.tsx` | Refactored PUT action to use `parseApiRequest` with `updateUserBody` schema |
| `app/routes/api/v1/roles.tsx` | Refactored POST action to use `parseApiRequest` with `createRoleBody` schema |
| `app/routes/api/v1/roles.$roleId.tsx` | Refactored PUT action to use `parseApiRequest` with `updateRoleBody` schema |

**API schemas defined per-route:**
- `createUserBody`: `{ email: string (email), password: string (min 8), name?: string, username?: string }`
- `updateUserBody`: `{ name?: string, username?: string, status?: enum }`
- `createRoleBody`: `{ name: string (min 1), description?: string, scope?: enum (default TENANT) }`
- `updateRoleBody`: `{ name?: string (min 1), description?: string }`

**Impact:** Each API action is now ~5-10 lines shorter. Body types are fully inferred from Zod schemas (no `any`). Validation errors return structured `{ error: { code, message, details } }` responses with Zod issue details. New API routes can be added with minimal boilerplate.

---

### Item 13: Graceful Shutdown

**Problem:** `server.js` called `process.exit(0)` immediately on SIGTERM/SIGINT without draining in-flight requests, stopping the job processor, or flushing the rate-limit audit buffer.

**Changes:**

| File | Change |
|------|--------|
| `server/shutdown.ts` (new) | Created shared shutdown hook registry with `onShutdown(hook)` and `runShutdownHooks()`. Hooks run synchronously in registration order with best-effort error swallowing |
| `server.js` | Imported `runShutdownHooks`. Replaced simple `process.exit(0)` with proper shutdown sequence: (1) `server.close()` to stop accepting connections and drain in-flight requests, (2) `runShutdownHooks()` to run cleanup, (3) 10s force-exit timeout (`.unref()`) as safety net |
| `server/app.ts` (lines 105-113) | After starting the job processor, registers `stopJobProcessor` and `flushRateLimitBuffer` as shutdown hooks via `onShutdown()` |
| `tsconfig.node.json` | Added `server/shutdown.ts` to the `include` list |

**Shutdown sequence:**
1. `server.close()` — stops accepting new connections, waits for in-flight requests
2. `stopJobProcessor()` — clears the job processing interval
3. `flushRateLimitBuffer()` — writes any buffered audit log entries to the database
4. After 10s, `process.exit(1)` forces shutdown if draining takes too long

**Impact:** Clean shutdowns in production — no lost audit data, no orphaned job processing, no dropped connections during deployment.

---

## Phase 4 — Polish (Items 3, 14, 15, 16, 17, 18)

### Item 3: API Idempotency

**Problem:** POST endpoints in `app/routes/api/v1/` had no idempotency protection. Retried requests (network timeouts, client retries) could create duplicate resources.

**Changes:**

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `IdempotencyKey` model with `key`, `tenantId`, `method`, `path`, `statusCode`, `responseBody`, `expiresAt`. Unique constraint on `[key, tenantId]`, index on `expiresAt` for cleanup |
| `app/utils/api/idempotency.server.ts` (new) | Created `checkIdempotencyKey(request, tenantId)` — looks up cached response by `Idempotency-Key` header + tenantId, returns cached `Response` or `null`. Created `storeIdempotencyKey(request, tenantId, response)` — stores response for 24h TTL |
| `app/routes/api/v1/users.tsx` | Added idempotency check before user creation, stores response after success |
| `app/routes/api/v1/roles.tsx` | Added idempotency check before role creation, stores response after success |
| `server/security.ts` (line 59) | Added `Idempotency-Key` to CORS `allowedHeaders` |

**How it works:**
1. Client sends `POST /api/v1/users` with `Idempotency-Key: <uuid>` header
2. First request: executes normally, stores response in DB with 24h TTL
3. Retry with same key: returns cached response without re-executing
4. Expired keys are cleaned up on next lookup

**Impact:** Clients can safely retry POST requests without creating duplicate resources. Idempotency is opt-in — requests without the header proceed normally.

---

### Item 14: DataTable Accessibility

**Problem:** The `DataTable` component lacked several WCAG 2.1 accessibility features: no `aria-sort` on sortable columns, no `aria-selected` on selectable rows, visible "Actions" text in header instead of screen-reader-only, and no `aria-live` for dynamic content updates.

**Changes:**

| File | Change |
|------|--------|
| `app/components/data-table/data-table.tsx` | Added `aria-sort` (`ascending`/`descending`/`none`) to sortable `<TableHead>` elements based on current sort state |
| `app/components/data-table/data-table.tsx` | Changed "Actions" column header text to `<span className="sr-only">Actions</span>` — visible to screen readers only |
| `app/components/data-table/data-table.tsx` | Added `aria-live="polite"` to `<TableBody>` so screen readers announce data changes |
| `app/components/data-table/data-table.tsx` | Added `aria-selected={isSelected}` to selectable `<TableRow>` elements |
| `app/components/data-table/data-table-pagination.tsx` | Added `aria-label="Rows per page"` to the page size `<NativeSelect>` |

**Already good:**
- Checkboxes already had `aria-label="Select all"` and `aria-label="Select row {key}"`
- Pagination buttons already had `<span className="sr-only">Previous/Next page</span>`
- Dropdown menu trigger already had `<span className="sr-only">Open menu</span>`
- Inline action buttons already had `<span className="sr-only">{action.label}</span>`

**Impact:** Screen readers now announce sort state, row selection state, and data updates. The Actions column header is properly hidden visually while remaining accessible.

---

### Item 15: OpenAPI Documentation

**Problem:** No API documentation existed for the 6 REST endpoints, making it difficult for developers to integrate with the API.

**Changes:**

| File | Change |
|------|--------|
| `docs/openapi.yaml` (new) | Hand-written OpenAPI 3.1 spec documenting all endpoints: `GET/POST /users`, `GET/PUT/DELETE /users/{userId}`, `GET/POST /roles`, `GET/PUT/DELETE /roles/{roleId}`, `GET /tenants`, `GET /permissions` |

**Spec includes:**
- Bearer token authentication scheme
- Reusable `Pagination`, `Error`, `User`, `Role`, `Tenant`, `Permission` schemas
- Reusable `page`, `pageSize`, `Idempotency-Key` parameters
- Request body schemas for create/update operations
- Response status codes and descriptions per endpoint
- Tags for grouping (Users, Roles, Tenants, Permissions)

**Impact:** Developers can import `docs/openapi.yaml` into Swagger UI, Postman, or any OpenAPI-compatible tool to explore and test the API.

---

### Item 16: Job Queue Exponential Backoff with Jitter

**Problem:** `app/utils/events/job-queue.server.ts` used plain exponential backoff (`2^attempts * 30s`) without jitter. When multiple jobs fail simultaneously, they all retry at the exact same time, causing a thundering herd effect.

**Changes:**

| File | Change |
|------|--------|
| `app/utils/events/job-queue.server.ts` (lines 86-88) | Added up to 30% random jitter on top of the base backoff, capped at 1 hour maximum |
| `tests/unit/utils/events/job-queue.server.test.ts` (lines 278-280) | Updated backoff assertion to account for jitter range |

**Before:** `backoffMs = 2^attempts * 30_000`
**After:** `backoffMs = min(2^attempts * 30_000 + random(0, base * 0.3), 3_600_000)`

**Impact:** Failed jobs retry at slightly different times, preventing thundering herd. Maximum backoff capped at 1 hour to prevent indefinite delays.

---

### Item 17: Memory Cache for Hot Paths

**Problem:** Feature flag lookups hit the database on every request (via `requireFeature` in route loaders/actions). With 6 feature flags checked across multiple routes, this added unnecessary DB queries per page load.

**Changes:**

| File | Change |
|------|--------|
| `app/utils/db/memory-cache.server.ts` (new) | Created `MemoryCache<T>` class with TTL-based expiration. Methods: `get(key)`, `set(key, value)`, `invalidate(key)`, `clear()` |
| `app/utils/config/feature-flags.server.ts` | Added `flagCache` with 60s TTL. `isFeatureEnabled` now checks cache before querying DB. `setFlag` invalidates the cache on update. Exported `clearFlagCache()` for testing |
| `tests/unit/utils/config/feature-flags.server.test.ts` | Added mock for `MemoryCache` that disables caching during tests (always returns `undefined` from `get`) |

**Cache behavior:**
- First lookup for a flag key: queries DB, stores result in cache for 60s
- Subsequent lookups within 60s: returns cached result, no DB query
- When a flag is updated via `setFlag`: cache entry is invalidated immediately
- `clearFlagCache()` exported for manual invalidation if needed

**Impact:** Reduces DB queries for feature flags from N per request (where N = number of flags checked) to at most N per 60 seconds. For a typical page that checks 2-3 flags, this eliminates 2-3 DB queries per request after the first.

---

### Item 18: Meta Tags on Routes

**Problem:** No route files exported a `meta` function. Pages had no `<title>` tags, descriptions, or social meta tags — bad for SEO and browser tab identification.

**Changes:**

| File | Change |
|------|--------|
| `app/utils/meta.ts` (new) | Created `buildMeta(title, description?)` helper that returns `[{ title: "Title \| App" }, { name: "description", content: "..." }]` |
| `app/routes/auth/login.tsx` | Added `meta` export: "Log In" |
| `app/routes/auth/signup.tsx` | Added `meta` export: "Sign Up" |
| `app/routes/auth/forgot-password.tsx` | Added `meta` export: "Forgot Password" |
| `app/routes/auth/reset-password.tsx` | Added `meta` export: "Reset Password" |
| `app/routes/auth/verify.tsx` | Added `meta` export: "Verify Email" |
| `app/routes/auth/onboarding.tsx` | Added `meta` export: "Onboarding" |
| `app/routes/auth/2fa-verify.tsx` | Added `meta` export: "Two-Factor Verification" |
| `app/routes/auth/2fa-setup.tsx` | Added `meta` export: "Set Up 2FA" |
| `app/routes/auth/2fa-recovery.tsx` | Added `meta` export: "Recovery Code" |
| `app/routes/auth/accept-invite.tsx` | Added `meta` export: "Accept Invitation" |
| `app/routes/$tenant/index.tsx` | Added `meta` export: "Dashboard" |

**Impact:** All public-facing auth pages and the dashboard now have proper `<title>` and description meta tags. Browser tabs show meaningful titles. The `buildMeta` helper makes it easy to add meta to remaining tenant routes.

---

## Test Results

| Phase | Tests Passed | Tests Failed | Typecheck |
|-------|-------------|-------------|-----------|
| Phase 1 | 1142/1142 | 0 | Clean |
| Phase 2 | 1143/1143 | 0 | Clean |
| Phase 3 | 1143/1143 | 0 | Clean |
| Phase 4 | 1143/1143 | 0 | Clean |
