# Features Guide

A comprehensive reference for every feature, utility, pattern, and convention in this template. If you're building a project from this template, read this first — everything described here is already built and ready to use.

---

## Table of Contents

1. [Introduction & Quick Start](#1-introduction--quick-start)
2. [Project Structure](#2-project-structure)
3. [Server & Infrastructure](#3-server--infrastructure)
4. [Database & Prisma](#4-database--prisma)
5. [Authentication](#5-authentication)
6. [Two-Factor Authentication (2FA)](#6-two-factor-authentication-2fa)
7. [Authorization (RBAC)](#7-authorization-rbac)
8. [Multi-Tenancy](#8-multi-tenancy)
9. [User Invitation System](#9-user-invitation-system)
10. [Email Service](#10-email-service)
11. [Background Job Queue](#11-background-job-queue)
12. [REST API (v1)](#12-rest-api-v1)
13. [Webhooks](#13-webhooks)
14. [Real-Time Updates (SSE)](#14-real-time-updates-sse)
15. [Notifications](#15-notifications)
16. [Broadcasts / Messaging](#16-broadcasts--messaging)
17. [Custom Objects](#17-custom-objects)
18. [Form Designer](#18-form-designer)
19. [Saved Views](#19-saved-views)
20. [File Uploads](#20-file-uploads)
21. [Data Import/Export](#21-data-importexport)
22. [Search & Command Palette](#22-search--command-palette)
23. [Analytics Dashboard](#23-analytics-dashboard)
24. [Audit Logging](#24-audit-logging)
25. [UI Component Library](#25-ui-component-library)
26. [Forms & Validation](#26-forms--validation)
27. [Error Handling](#27-error-handling)
28. [Internationalization (i18n)](#28-internationalization-i18n)
29. [PWA & Offline](#29-pwa--offline)
30. [Keyboard Shortcuts](#30-keyboard-shortcuts)
31. [HTTP Caching](#31-http-caching)
32. [Testing](#32-testing)
- [Appendix A: Environment Variables](#appendix-a-environment-variables)
- [Appendix B: Feature Flags Reference](#appendix-b-feature-flags-reference)
- [Appendix C: Prisma Models Quick Reference](#appendix-c-prisma-models-quick-reference)
- [Appendix D: API Endpoints Quick Reference](#appendix-d-api-endpoints-quick-reference)
- [Appendix E: npm Scripts Reference](#appendix-e-npm-scripts-reference)

---

## 1. Introduction & Quick Start

This template provides a production-ready, multi-tenant web application with authentication, RBAC, background jobs, REST API, webhooks, real-time updates, and an extensible UI — all wired together so you can focus on building domain-specific features rather than plumbing.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Router 7 (SSR) |
| Server | Express 5 |
| Database | PostgreSQL via Prisma 7 |
| UI | shadcn/ui + Radix + Tailwind CSS 4 |
| Forms | Conform + Zod |
| Auth | Cookie sessions + DB backing + TOTP 2FA |
| i18n | i18next (EN, FR) |
| Testing | Vitest + Playwright |

### Getting Started

```bash
npm install
npm run docker:up          # Start PostgreSQL, test DB, Mailpit
npm run db:migrate         # Run Prisma migrations
npm run db:seed            # Seed database
npm run dev                # Start dev server (http://localhost:3000)
```

### Default Credentials

| Field | Value |
|-------|-------|
| Email | `admin@example.com` |
| Password | `password123` |
| Username | `admin` |
| Tenant | `admin` (slug) |

The seed creates one admin tenant, one admin user with a GLOBAL ADMIN role, 24 permissions, three base roles (ADMIN, TENANT_ADMIN, VIEWER), and 18 feature flags (all disabled by default).

---

## 2. Project Structure

```
app/
├── components/
│   ├── ui/              # shadcn/ui components (do not edit — use `npx shadcn add`)
│   ├── layout/          # Sidebar, navbar, breadcrumbs, theme toggle, command palette
│   ├── form-designer/   # Drag-and-drop form builder
│   ├── views/           # Saved view components (table, kanban, calendar, gallery)
│   └── analytics/       # Chart components
├── hooks/               # React hooks (use-sse, use-form-designer, autosave, toast)
├── lib/                 # Core utilities
│   ├── auth/            # Session, RBAC, API auth, 2FA
│   ├── config/          # Environment, settings, feature flags
│   ├── db/              # Prisma client, soft-delete, cache
│   ├── email/           # Email service, templates
│   ├── errors/          # ServiceError base, error handler
│   ├── events/          # Event bus, job queue, webhook emitter
│   ├── monitoring/      # Logger, Sentry
│   └── schemas/         # 18 shared Zod validation schemas
├── config/              # Navigation config with role-based visibility
├── locales/
│   ├── en/              # English translations (8 namespaces)
│   └── fr/              # French translations (8 namespaces)
├── routes/
│   ├── auth/            # Login, signup, verify, 2FA, password reset, invitations
│   ├── api/             # REST API v1 endpoints
│   └── $tenant/         # Tenant-scoped routes (dashboard, users, settings, etc.)
├── services/            # Business logic layer (server-only)
├── types/               # TypeScript type definitions
└── generated/           # Prisma-generated client

server/
├── app.ts               # Express app setup, middleware stack, SSE, job processor
├── security.ts          # Helmet, CORS, CSP, rate limiting, suspicious request blocking
├── sse.ts               # SSE connection management
└── sse-test.ts          # SSE test route (dev only)

prisma/
├── schema.prisma        # Database schema (all models)
├── migrations/          # Migration files
└── seed.ts              # Seed data

tests/
├── unit/                # All unit tests (mirrors app/ structure)
│   ├── services/        # Service layer tests (26 files)
│   ├── lib/             # Lib utility tests
│   │   ├── auth/        # Auth helper tests
│   │   ├── config/      # Feature flags, settings tests
│   │   ├── db/          # Cache, soft-delete tests
│   │   ├── email/       # Email service and template tests
│   │   ├── errors/      # Error handling tests
│   │   ├── events/      # Event bus, job queue, webhook emitter tests
│   │   └── schemas/     # Zod schema validation tests (18 schemas)
│   ├── components/      # Component logic tests
│   │   └── fields/      # Field component tests
│   └── server/          # Express middleware tests
├── e2e/                 # Playwright E2E tests
├── factories/           # Test data factories
├── mocks/               # MSW request handlers
└── setup/               # Vitest setup (unit + integration)
```

### File Naming Conventions

- **`.server.ts` suffix** — server-only code, excluded from client bundles. Use for anything that touches the database, environment variables, or Node APIs.
- **Route files** — file-based routing via `react-router-auto-routes`. File path determines URL path (e.g., `app/routes/$tenant/users/index.tsx` → `/:tenant/users`).
- **Path alias** — `~/*` maps to `./app/*`. Import as `import { prisma } from "~/lib/db/db.server"`.

---

## 3. Server & Infrastructure

### Express Server (`server/app.ts`)

The Express 5 server is the entry point. Middleware is applied in a specific order:

1. **Nonce middleware** — generates a per-request CSP nonce
2. **Helmet** — sets security headers (CSP with nonce, HSTS, X-Frame-Options)
3. **Permissions-Policy** — restricts browser features
4. **CORS** — allowlisted origins from `CORS_ORIGINS` env var
5. **Suspicious request blocker** — blocks scanners (sqlmap, nikto, nessus), path traversal, XSS, and SQL injection patterns
6. **Session user extraction** — extracts user ID for user-aware rate limiting
7. **SSE endpoint** — `/api/sse` (before rate limiter — long-lived connections)
8. **Static asset cache** — `/assets` gets `Cache-Control: public, max-age=31536000, immutable`
9. **Rate limiters** — general, mutation, and auth (see below)
10. **Job processor** — starts automatically on boot
11. **React Router handler** — serves the app with CSP nonce in load context

### Security Middleware (`server/security.ts`)

**Rate Limiting:**

| Limiter | Scope | Limit | Window |
|---------|-------|-------|--------|
| `generalLimiter` | All routes | 100 requests | 15 minutes |
| `mutationLimiter` | Non-GET on `/api` | 50 requests | 1 minute |
| `authLimiter` | `/auth` routes | 10 requests | 1 minute |

All limiters skip the `/up` health check endpoint. Rate limit keys are user-aware (authenticated users get per-user limits, anonymous users get per-IP limits).

**CSP Configuration:**
- Nonce-based script execution (no inline scripts)
- `object-src: 'none'`
- `frame-ancestors: 'none'`
- Development mode allows Vite HMR WebSocket connections

**Suspicious Request Blocking:**
- Scanner user-agent detection (sqlmap, nikto, nessus, openvas)
- Path traversal pattern blocking (`../`, `..%2f`)
- XSS and SQL injection pattern detection in URL

### Logger (`app/lib/logger.server.ts`)

Pino-based structured JSON logger with automatic sensitive field redaction.

```typescript
import { logger } from "~/lib/monitoring/logger.server";

logger.info({ userId, action }, "User performed action");
logger.error({ error, context }, "Something failed");
```

**Configuration:**
- Level controlled by `LOG_LEVEL` env var (default: `info`)
- Production: JSON output with level labels
- Development: pretty-printed with colors via `pino-pretty`
- Automatic redaction of: `password`, `passwordHash`, `token`, `authorization`, `cookie`, `sessionId`
- Base fields: `service`, `version`, `environment`

### Environment Variables (`app/lib/env.server.ts`)

All environment variables are validated at startup using Zod. If any required variable is missing or invalid, the server exits with a clear error message. See [Appendix A](#appendix-a-environment-variables) for the complete list.

```typescript
import { env } from "~/lib/config/env.server";

env.DATABASE_URL;    // string (required)
env.SESSION_SECRET;  // string, min 16 chars (required)
env.PORT;            // number (default: 3000)
```

---

## 4. Database & Prisma

### Schema Overview

The Prisma schema (`prisma/schema.prisma`) defines models organized by domain. The database uses PostgreSQL with the `@prisma/adapter-pg` driver adapter.

**Enums:**

| Enum | Values |
|------|--------|
| `UserStatus` | ACTIVE, INACTIVE, LOCKED, SUSPENDED |
| `RoleScope` | GLOBAL, TENANT, EVENT |
| `AuditAction` | CREATE, UPDATE, DELETE, LOGIN, LOGOUT, CONFIGURE, RATE_LIMIT, TWO_FACTOR_ENABLE, TWO_FACTOR_DISABLE |
| `JobStatus` | PENDING, PROCESSING, COMPLETED, FAILED |
| `InvitationStatus` | PENDING, ACCEPTED, EXPIRED, REVOKED |
| `ApiKeyStatus` | ACTIVE, ROTATED, REVOKED, EXPIRED |
| `RateLimitTier` | STANDARD, ELEVATED, PREMIUM, CUSTOM |
| `WebhookStatus` | ACTIVE, PAUSED, DISABLED, SUSPENDED |
| `DeliveryStatus` | PENDING, DELIVERED, FAILED, RETRYING, DEAD_LETTER |
| `ViewType` | TABLE, KANBAN, CALENDAR, GALLERY |
| `FieldDataType` | TEXT, LONG_TEXT, NUMBER, BOOLEAN, DATE, DATETIME, ENUM, MULTI_ENUM, EMAIL, URL, PHONE, FILE, IMAGE, REFERENCE, FORMULA, JSON |
| `MessageChannel` | EMAIL, SMS, PUSH, IN_APP |
| `BroadcastStatus` | DRAFT, SCHEDULED, SENDING, SENT, FAILED, CANCELLED |

### Soft-Delete Extension (`app/lib/db.server.ts`)

Four models support soft delete via a `deletedAt` timestamp: **User**, **Role**, **WebhookSubscription**, **CustomObjectDefinition**.

The Prisma client is extended with middleware that automatically filters out soft-deleted records on `findMany`, `findFirst`, and `count` queries.

```typescript
// Normal query — soft-deleted records are excluded
const users = await prisma.user.findMany();

// Include soft-deleted records
const allUsers = await prisma.user.findMany({ includeDeleted: true } as any);
```

### Migrations Workflow

```bash
npm run db:migrate    # Create and apply migrations (dev)
npm run db:push       # Sync schema to DB without migrations
npm run db:seed       # Seed with default data
npm run db:studio     # Open Prisma Studio GUI
```

### Seed Data (`prisma/seed.ts`)

The seed creates:
- 1 admin tenant (`admin` slug, enterprise plan)
- 1 admin user (`admin@example.com` / `password123`)
- 3 roles: ADMIN (GLOBAL), TENANT_ADMIN (TENANT), VIEWER (TENANT)
- 24 permissions across resources: user, tenant, role, permission, settings, feature-flag, api-key, webhook, saved-view, custom-field, custom-object, audit-log
- Role-permission assignments (ADMIN gets all, VIEWER gets read-only with "own" user access)
- 18 feature flags (all disabled by default)

### Models by Domain

See [Appendix C](#appendix-c-prisma-models-quick-reference) for the complete list with key fields.

**Auth:** User, Password, Session, Verification, RecoveryCode

**Tenancy:** Tenant

**RBAC:** Role, Permission, RolePermission, UserRole

**Feature Management:** FeatureFlag, SystemSetting

**Content:** CustomObjectDefinition, CustomObjectRecord, FieldDefinition, SectionTemplate, SavedView, UploadedFile

**Communication:** Notification, MessageTemplate, BroadcastMessage, MessageDelivery, Invitation

**API & Webhooks:** ApiKey, WebhookSubscription, WebhookDelivery

**System:** AuditLog, Job, AnalyticsSnapshot

**Reference Data:** Country, Title, Language, Currency, DocumentType

---

## 5. Authentication

### Cookie-Based Sessions (`app/lib/session.server.ts`)

Sessions are backed by the database. A cookie (`__session`) stores a `sessionId` that references a `Session` record in the database.

**Cookie settings:**
- `httpOnly: true`
- `sameSite: "lax"`
- `secure: true` in production
- Max age controlled by `SESSION_MAX_AGE` env var (default: 30 days)

**Session fingerprinting:** On login, an HMAC-SHA256 fingerprint is computed from the `User-Agent` and `Accept-Language` headers. On every subsequent request, the fingerprint is recomputed and compared. A mismatch destroys the session and logs a potential hijacking event.

### Session Helpers

```typescript
import {
  getUserId,
  requireUserId,
  requireUser,
  requireAnonymous,
  createUserSession,
  logout,
} from "~/lib/auth/session.server";
```

| Helper | Returns | Behavior |
|--------|---------|----------|
| `getUserId(request)` | `string \| null` | Returns user ID from session, validates fingerprint, returns `null` if invalid |
| `requireUserId(request)` | `string` | Throws redirect to `/auth/login` if not authenticated |
| `requireUser(request)` | `User` (with roles & permissions) | Throws redirect if not authenticated, throws logout if user not found. Per-request cached via WeakMap |
| `requireAnonymous(request)` | `void` | Throws redirect to dashboard if already authenticated |
| `createUserSession(request, userId, redirectTo)` | `Response` (redirect) | Creates DB session with fingerprint, sets cookie |
| `logout(request)` | `Response` (redirect) | Destroys DB session and cookie, redirects to login |

### Login Flow (`app/routes/auth/login.tsx`)

1. User submits email + password
2. Server validates credentials against bcrypt hash
3. Account lockout check: rejects LOCKED, INACTIVE, SUSPENDED accounts. Tracks failed attempts; auto-locks after `MAX_LOGIN_ATTEMPTS` (default: 5) and auto-unlocks after `LOCKOUT_DURATION_MINUTES` (default: 30)
4. If 2FA is enabled on the user → redirect to `/auth/2fa-verify`
5. If 2FA is enforced by tenant (`FF_TWO_FACTOR`) but not set up → redirect to `/auth/2fa-setup`
6. Otherwise → create session, redirect to dashboard

### Signup Flow (`app/routes/auth/signup.tsx`)

Requires the `FF_SIGNUP` feature flag to be enabled.

1. User enters email
2. Server checks for duplicate email
3. Generates 6-digit OTP, sends via email
4. Redirects to `/auth/verify?type=onboarding`
5. User enters OTP code
6. Redirects to `/auth/onboarding` for profile completion (username, name, password, terms)
7. Creates user with VIEWER role, auto-logs in

### Password Reset

1. **`/auth/forgot-password`** — User enters email. Server always returns success (email enumeration protection). If user exists, generates a 1-hour OTP and sends a reset email.
2. **`/auth/reset-password?token=...&email=...`** — User clicks link from email, enters new password. Server validates the token, hashes the new password, updates the user record, redirects to login.

### Logout (`app/routes/auth/logout.tsx`)

POST-only. Destroys the database session, destroys the cookie, creates an audit log entry, redirects to `/auth/login`.

---

## 6. Two-Factor Authentication (2FA)

### TOTP Setup (`app/routes/auth/2fa-setup.tsx`)

1. Server generates a TOTP secret and QR code using `@epic-web/totp`
2. User scans QR code with an authenticator app (or enters secret manually)
3. User submits 6-digit code to verify setup
4. On success: 2FA is activated, 10 recovery codes are generated and displayed
5. User must acknowledge saving recovery codes before login completes

### TOTP Verification (`app/routes/auth/2fa-verify.tsx`)

During login, if 2FA is already enabled:

1. User enters 6-digit code from authenticator app
2. Server validates against stored TOTP secret
3. On success → complete session creation, redirect to dashboard

### Recovery Codes (`app/services/recovery-codes.server.ts`)

- **10 codes** generated per user, 8 alphanumeric characters each
- Stored as **bcrypt hashes** (raw codes only shown once during generation)
- **Single-use** — each code is marked with `usedAt` timestamp after use
- Case-insensitive, whitespace-trimmed validation

```typescript
import {
  generateRecoveryCodes,
  validateRecoveryCode,
  getRemainingCodeCount,
} from "~/services/recovery-codes.server";

// Generate (replaces existing codes)
const codes = await generateRecoveryCodes(userId);
// codes = ["AB12CD34", "EF56GH78", ...]

// Validate (marks as used if valid)
const isValid = await validateRecoveryCode(userId, "AB12CD34");

// Check remaining
const remaining = await getRemainingCodeCount(userId);
```

### Recovery Code Login (`app/routes/auth/2fa-recovery.tsx`)

Alternative to TOTP during login. User enters one of their 10 recovery codes. The code is validated and consumed (cannot be reused).

### Profile-Based 2FA Management

Users can enable/disable 2FA and regenerate recovery codes from `/$tenant/profile/two-factor/`.

### Tenant-Level Enforcement

When the `FF_TWO_FACTOR` feature flag is enabled, users who haven't set up 2FA are forced to complete setup on their next login.

---

## 7. Authorization (RBAC)

### Models

**Role:** `name`, `description`, `scope` (GLOBAL / TENANT / EVENT), `tenantId`

**Permission:** `resource`, `action`, `description`. Permissions are `resource:action` pairs (e.g., `user:read`, `user:write`, `role:delete`).

**RolePermission:** Join table linking roles to permissions. Includes an `access` field (`"own"` or `"any"`) to control scope of access.

**UserRole:** Join table linking users to roles. Includes optional `eventId` and `stepId` for event-scoped assignments.

### Role Constants (`app/lib/auth/roles.ts`)

Predefined role arrays for route guards:

```typescript
import { ADMIN_ONLY, ADMIN_OR_TENANT_ADMIN } from "~/lib/auth/roles";

// ADMIN_ONLY = ["ADMIN"]
// ADMIN_OR_TENANT_ADMIN = ["ADMIN", "TENANT_ADMIN"]
```

Use these in `requireAnyRole` calls for consistency:

```typescript
await requireAnyRole(request, [...ADMIN_ONLY]);
await requireAnyRole(request, [...ADMIN_OR_TENANT_ADMIN]);
```

### Auth Helpers (`app/lib/auth/require-auth.server.ts`)

```typescript
import {
  requireAuth,
  requireRole,
  requireAnyRole,
  requirePermission,
  requireGlobalAdmin,
  requireFeature,
  requireRoleAndFeature,
  hasPermission,
} from "~/lib/auth/require-auth.server";
```

| Helper | Purpose |
|--------|---------|
| `requireAuth(request)` | Returns `{ user, roles, isSuperAdmin }`. Throws redirect if not authenticated |
| `requireRole(request, roleName)` | Throws 403 if user doesn't have the specific role |
| `requireAnyRole(request, roleNames[])` | Throws 403 if user doesn't have any of the specified roles |
| `requirePermission(request, resource, action, opts?)` | Checks `resource:action` permission with scope (GLOBAL always allowed, TENANT requires matching tenant, EVENT requires matching event). Supports `"own"` access check |
| `requireGlobalAdmin(request)` | Throws 403 if user doesn't have a GLOBAL-scoped role |
| `requireFeature(request, flagKey)` | Combines `requireAuth` + tenant null check + `isFeatureEnabled`. Returns `{ user, roles, isSuperAdmin, tenantId: string }` |
| `requireRoleAndFeature(request, roleNames[], flagKey)` | Combines `requireAnyRole` + `requireFeature` in one call. Use for feature-gated routes that also need role checks |
| `hasPermission(request, resource, action)` | Returns `boolean` without throwing |

### Access Control Matrix

Routes enforce role-based access control. The navigation sidebar automatically hides items the user cannot access.

**ADMIN only (structural/system-level):**

| Feature | Guard |
|---------|-------|
| Custom Objects (`settings/objects/**`) | `requireRoleAndFeature(request, ADMIN_ONLY, FF_CUSTOM_OBJECTS)` |
| Custom Fields (`settings/fields/**`) | `requireRoleAndFeature(request, ADMIN_ONLY, FF_CUSTOM_FIELDS)` |
| Form Designer (`settings/forms/**`) | `requireRoleAndFeature(request, ADMIN_ONLY, FF_FORM_DESIGNER)` |
| Reference Data (`data/references/**`) | `requireAnyRole(request, ADMIN_ONLY)` |
| Data Import/Export (`data/import`, `data/export`) | `requireAnyRole(request, ADMIN_ONLY)` |
| Feature Flags (`settings/features`) | `requireGlobalAdmin(request)` |

**ADMIN + TENANT_ADMIN (operational):**

| Feature | Guard |
|---------|-------|
| API Keys (`settings/api-keys/**`) | `requireRoleAndFeature(request, ADMIN_OR_TENANT_ADMIN, FF_REST_API)` |
| Webhooks (`settings/webhooks/**`) | `requireRoleAndFeature(request, ADMIN_OR_TENANT_ADMIN, FF_WEBHOOKS)` |
| Message Templates (`settings/templates/**`) | `requireRoleAndFeature(request, ADMIN_OR_TENANT_ADMIN, FF_BROADCASTS)` |
| Broadcasts (`settings/broadcasts/**`) | `requireRoleAndFeature(request, ADMIN_OR_TENANT_ADMIN, FF_BROADCASTS)` |
| Saved Views (`settings/views/**`) | `requireRoleAndFeature(request, ADMIN_OR_TENANT_ADMIN, FF_SAVED_VIEWS)` |
| General/Org/Security Settings | `requireAnyRole(request, ADMIN_OR_TENANT_ADMIN)` |

**Permission evaluation logic:**
- GLOBAL scope → always allowed
- TENANT scope → requires matching `tenantId` + checks `"own"` access
- EVENT scope → requires matching `eventId` + checks `"own"` access
- Results are per-request cached via WeakMap

### Key Types

```typescript
interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  photoUrl: string | null;
  tenantId: string | null;
  roles: AuthRole[];
  permissions: AuthPermission[];
}

interface AuthRole {
  id: string;
  name: string;
  scope: "GLOBAL" | "TENANT" | "EVENT";
  eventId?: string;
  stepId?: string;
}

interface AuthPermission {
  resource: string;
  action: string;
  access: "own" | "any";
  roleScope: string;
  eventId?: string;
}
```

### Adding New Permissions

1. Add the permission to the seed file (`prisma/seed.ts`)
2. Run `npm run db:seed` (or create a migration)
3. Assign the permission to the appropriate roles
4. Use `requirePermission(request, "resource", "action")` in your loaders/actions

---

## 8. Multi-Tenancy

### URL-Based Tenant Scoping

All tenant-scoped routes live under `app/routes/$tenant/`. The `$tenant` URL parameter is the tenant's slug. For example: `/acme/users`, `/acme/settings`, `/acme/analytics`.

### Tenant Model

```
Tenant {
  id, name, slug (unique), email, phone, website,
  address, city, state, zip, country,
  subscriptionPlan (default: "free"),
  logoUrl, brandTheme, featureFlags (JSON), extras (JSON),
  createdAt, updatedAt
}
```

Users belong to a tenant via `User.tenantId`. The `TenantUser` relationship allows users to be associated with multiple tenants.

### Tenant Layout (`app/routes/$tenant/_layout.tsx`)

The tenant layout provides:
- Dashboard shell (sidebar navigation, navbar)
- Feature flag loading per request
- Tenant context for child routes

### Navigation Config (`app/config/navigation.ts`)

Navigation items support both role restrictions and feature flag gating. The sidebar automatically hides items the user cannot access:

```typescript
// Each nav item can have:
{
  title: "Broadcasts",
  url: `${base}/settings/broadcasts`,
  icon: Megaphone,
  roles: ["ADMIN", "TENANT_ADMIN"],  // hidden if user lacks these roles
  featureFlag: "FF_BROADCASTS",       // hidden if flag is disabled
}
```

The `isVisibleEntry` function evaluates both `roles` (user must have at least one) and `featureFlag` (must be enabled) to determine visibility. Items without restrictions are always visible.

### Tenant Isolation (MANDATORY)

Every service function that accesses tenant-scoped data **must** include `tenantId` in the Prisma `where` clause. This prevents cross-tenant data leaks (IDOR vulnerabilities).

**Pattern — use `findFirst` with tenantId, not `findUniqueOrThrow` by ID alone:**

```typescript
// WRONG — allows cross-tenant access
const record = await prisma.myModel.findUniqueOrThrow({
  where: { id: recordId },
});

// CORRECT — scoped to tenant
const record = await prisma.myModel.findFirst({
  where: { id: recordId, tenantId },
});
if (!record) throw new MyError("Not found", 404);
```

**All services enforce this pattern:**
- `custom-objects.server.ts` — all definition and record operations require `tenantId`
- `saved-views.server.ts` — `getView`, `updateView`, `deleteView`, `duplicateView` require `tenantId`
- `analytics.server.ts` — all chart functions require non-null `tenantId`
- `users.server.ts` — `assignRoles` validates roles belong to the tenant
- `file-upload.server.ts` — `getFileMetadata` scoped to tenant directory
- `view-filters.server.ts` — `resolveActiveView` passes `tenantId` to view queries

### Shared Context Helpers

Use these helpers in routes instead of building context objects manually:

```typescript
import { buildServiceContext } from "~/lib/request-context.server";

// In a route loader/action:
const { user } = await requireAuth(request);
const ctx = buildServiceContext(request, user, tenantId);
// ctx = { userId, tenantId, ipAddress, userAgent, isSuperAdmin }

// Pass to service functions:
await createUser(input, ctx);
```

### How to Add Tenant-Scoped Features

1. Create route files under `app/routes/$tenant/your-feature/`
2. In your loader, use `requireAuth(request)` or `requireAnyRole(request, [...ADMIN_ONLY])`
3. Extract `tenantId` from the auth result (it's guaranteed non-null after `requireFeature`)
4. **Always** include `tenantId` in every Prisma query `where` clause
5. Use `buildServiceContext(request, user, tenantId)` for service calls that need audit context
6. Never trust route params alone — validate that the record belongs to the tenant

---

## 9. User Invitation System

**Feature flag:** `FF_INVITATIONS`

### How It Works

1. Admin invites a user by email (`/$tenant/users/invite.tsx`)
2. Server generates a 32-byte hex token, creates an `Invitation` record (PENDING status, 7-day expiry)
3. Invitation email is sent via the email service with a link to `/auth/accept-invite?token=...`
4. Recipient clicks the link, fills out name/username/password
5. Account is created, roles from the invitation are assigned, user is auto-logged in

### Service (`app/services/invitations.server.ts`)

```typescript
import {
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
  revokeInvitation,
  getInvitations,
} from "~/services/invitations.server";

// Create
await createInvitation({
  email: "new@example.com",
  tenantId: "...",
  roleIds: ["role-id-1", "role-id-2"],
  invitedById: "inviter-user-id",
});

// Accept (validates token, checks expiry, assigns all roles, marks as ACCEPTED)
await acceptInvitation(token, userId);

// Revoke (validates invitation belongs to tenant)
await revokeInvitation(invitationId, tenantId);

// List all invitations for a tenant (ordered by creation date, includes inviter)
const invitations = await getInvitations(tenantId);
```

### Invitation Model

```
Invitation {
  id, email, tenantId, roleIds[], token (unique),
  status (PENDING | ACCEPTED | EXPIRED | REVOKED),
  invitedById, expiresAt (7 days from creation), createdAt
}
```

---

## 10. Email Service

### Provider Abstraction (`app/lib/email.server.ts`)

The email service supports two providers with automatic selection:

1. **Resend** (preferred) — set `RESEND_API_KEY` env var
2. **SMTP/Nodemailer** (fallback) — configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

```typescript
import { sendEmail } from "~/lib/email/email.server";

await sendEmail({
  to: "user@example.com",        // string or string[]
  subject: "Hello",
  html: "<h1>Hello</h1>",
  text: "Hello",                  // optional plain text fallback
  from: "custom@example.com",    // optional, defaults to SMTP_FROM
  replyTo: "reply@example.com",  // optional
});
```

### Email Templates (`app/lib/email-templates.server.ts`)

Four built-in templates with consistent HTML layout:

| Template | Function | Purpose |
|----------|----------|---------|
| OTP Verification | `otpEmail(otp, email)` | 6-digit code for signup verification |
| Password Reset | `passwordResetEmail(token, email)` | Reset link (1-hour expiry) |
| Invitation | `invitationEmail(token, tenantName, inviterName)` | Tenant invitation (7-day expiry) |
| Welcome | `welcomeEmail(name)` | Account creation confirmation |

### Development: Mailpit

In development, Docker Compose starts Mailpit to catch all SMTP emails:
- **SMTP port:** 1025 (configure as `SMTP_HOST=localhost`, `SMTP_PORT=1025`)
- **Web UI:** http://localhost:8025

---

## 11. Background Job Queue

### DB-Backed Queue (`app/lib/job-queue.server.ts`)

The job queue uses the `Job` database model for persistence. No external services (Redis, RabbitMQ) required.

```typescript
import { enqueueJob } from "~/lib/events/job-queue.server";

// Basic
await enqueueJob("send-email", { to: "user@example.com", subject: "Hi", html: "..." });

// With options
await enqueueJob("webhook-delivery", { deliveryId: "..." }, {
  maxAttempts: 5,   // default: 3
  delay: 30000,     // ms from now (default: immediate)
});
```

### Job Model

```
Job {
  id, type, payload (JSON),
  status (PENDING | PROCESSING | COMPLETED | FAILED),
  attempts, maxAttempts (default: 3),
  nextRunAt, lastError,
  createdAt, completedAt
}
```

### Processor

- Polls every **5 seconds** (configurable)
- Processes up to **10 jobs per tick**
- **Atomic claim** via `UPDATE ... WHERE ... FOR UPDATE SKIP LOCKED RETURNING` (prevents double-processing)
- **Exponential backoff** on failure: `2^attempts * 30 seconds`
- Starts automatically on server boot (`server/app.ts`)

### Handler Registry (`app/lib/job-handlers.server.ts`)

Register handlers for job types:

```typescript
import { registerJobHandler } from "~/lib/events/job-queue.server";

registerJobHandler("my-job-type", async (payload) => {
  const data = payload as MyPayloadType;
  // ... do work
});
```

**Built-in handlers:**

| Job Type | Handler | Purpose |
|----------|---------|---------|
| `send-email` | Calls `sendEmail()` | Async email delivery |
| `webhook-delivery` | Calls `deliverWebhook()` | Webhook HTTP delivery |
| `broadcast-send` | Calls `sendBroadcast()` | Broadcast message delivery |

---

## 12. REST API (v1)

**Feature flag:** `FF_REST_API`

### Base Path

```
/api/v1/
```

### Authentication

All endpoints require an API key in the `Authorization` header:

```
Authorization: Bearer ak_abc123_secrettoken
```

API keys are created and managed via the UI or the `app/services/api-keys.server.ts` service. Each key has:
- **Permissions** — array of `resource:action` strings (or `"*"` for full access)
- **Rate limit tier** — STANDARD, ELEVATED, PREMIUM, or CUSTOM
- **Expiration** — optional expiry date
- **IP/Origin allowlists** — optional restrictions
- **Key rotation** — atomic rotation with configurable grace period

### Auth Middleware (`app/lib/api-auth.server.ts`)

```typescript
import { apiAuth, requireApiPermission } from "~/lib/auth/api-auth.server";

// In a loader/action:
const auth = await apiAuth(request);
// auth = { tenantId, apiKeyId, permissions }

requireApiPermission(auth, "user:read");
// Throws 403 if missing permission (unless permissions includes "*")
```

### Response Helpers (`app/lib/api-response.server.ts`)

```typescript
import { jsonSuccess, jsonError, jsonPaginated, parsePagination } from "~/lib/api-response.server";

// Success
return jsonSuccess({ id: "123", name: "Test" });           // 200
return jsonSuccess({ id: "123" }, 201);                     // 201

// Error
return jsonError("NOT_FOUND", "User not found", 404);
return jsonError("VALIDATION_ERROR", "Invalid input", 400, { fields: [...] });

// Paginated
return jsonPaginated(items, total, page, pageSize);
// { data: [...], pagination: { page, pageSize, total, totalPages } }

// Parse pagination from URL
const { page, pageSize, skip } = parsePagination(new URL(request.url));
// page defaults to 1, pageSize defaults to 20 (max 100)
```

### Endpoints

See [Appendix D](#appendix-d-api-endpoints-quick-reference) for the complete reference.

**Users:**
- `GET /api/v1/users` — list users (paginated)
- `POST /api/v1/users` — create user
- `GET /api/v1/users/:userId` — get user with roles
- `PUT /api/v1/users/:userId` — update user
- `DELETE /api/v1/users/:userId` — soft-delete user

**Roles:**
- `GET /api/v1/roles` — list roles (paginated)
- `POST /api/v1/roles` — create role
- `GET /api/v1/roles/:roleId` — get role with permissions
- `PUT /api/v1/roles/:roleId` — update role
- `DELETE /api/v1/roles/:roleId` — soft-delete role

**Permissions:**
- `GET /api/v1/permissions` — list all permissions (paginated)

**Tenants:**
- `GET /api/v1/tenants` — list tenants (requires `tenant:read`)

**Custom Objects:**
- `GET /api/v1/custom-objects` — list definitions (paginated)
- `POST /api/v1/custom-objects` — create definition
- `GET /api/v1/custom-objects/:objectId` — get definition
- `PUT /api/v1/custom-objects/:objectId` — update definition
- `DELETE /api/v1/custom-objects/:objectId` — soft-delete definition
- `GET /api/v1/custom-objects/:objectId/records` — list records (paginated)
- `POST /api/v1/custom-objects/:objectId/records` — create record

### Error Format

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "details": {}
  }
}
```

### ETag / Conditional Requests

GET responses include an `ETag` header (SHA-256 of response body). Clients can send `If-None-Match` to receive a `304 Not Modified` response when data hasn't changed.

### Rate Limiting

API mutations are rate-limited to 50 requests/minute. General requests are limited to 100 requests/15 minutes. Configure via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS` env vars.

---

## 13. Webhooks

**Feature flag:** `FF_WEBHOOKS`

### Webhook Subscriptions

Create subscriptions to receive HTTP callbacks when events occur in the system.

```typescript
import {
  createWebhookSubscription,
  listWebhookSubscriptions,
  updateWebhookSubscription,
  deleteWebhookSubscription,
  pauseWebhookSubscription,
  resumeWebhookSubscription,
  testWebhookEndpoint,
} from "~/services/webhooks.server";
```

### Event Types (`app/lib/webhook-events.ts`)

| Event | Description |
|-------|-------------|
| `user.created` | A new user was created |
| `user.updated` | A user was updated |
| `user.deleted` | A user was deleted |
| `role.updated` | A role was updated |
| `tenant.updated` | Tenant settings were updated |
| `settings.changed` | System settings were changed |
| `api_key.created` | A new API key was created |
| `api_key.revoked` | An API key was revoked |

```typescript
import {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_TYPES,
  validateEventTypes,
  getEventsByDomain,
} from "~/lib/events/webhook-events";
```

### Delivery (`app/services/webhook-delivery.server.ts`)

**Payload envelope:**
```json
{
  "id": "event-id",
  "event": "user.created",
  "timestamp": "2026-03-01T00:00:00.000Z",
  "version": "v1",
  "data": { ... }
}
```

**Signature:** HMAC-SHA256 of the JSON payload, sent in the `X-Webhook-Signature: sha256={hex}` header. Additional headers: `X-Webhook-Event`, `X-Webhook-Delivery`.

**Retry:** Exponential backoff per subscription's `retryBackoffMs` array (default: `[1000, 5000, 30000, 300000, 1800000]`). After `maxAttempts` (default: 5), delivery moves to `DEAD_LETTER` status.

**Circuit breaker:** After 10 consecutive failures, the circuit breaker opens for 60 minutes. After 3 circuit breaker trips, the subscription is SUSPENDED.

### Firing Webhooks from New Features

```typescript
import { fireWebhookEvent } from "~/services/webhooks.server";

await fireWebhookEvent(tenantId, "user.created", { userId: "...", email: "..." });
```

### Delivery Logging

Every delivery attempt is recorded in the `WebhookDelivery` model with: status, response code, response body, latency, error message, and timestamps.

---

## 14. Real-Time Updates (SSE)

**Feature flag:** `FF_SSE_UPDATES`

### Server Setup (`server/sse.ts`)

The SSE endpoint is at `/api/sse`. It supports:
- **Max 5 connections per user**, 1000 total connections
- **Channel-based subscriptions** via query parameter: `/api/sse?channels=notifications,dashboard`
- **Authentication** via session cookie
- **Tenant isolation** — events are filtered by `tenantId`
- **30-second heartbeat** to maintain connection
- **Graceful cleanup** on disconnect

### Channels & Events (`app/types/sse-events.ts`)

| Channel | Event Type | Purpose |
|---------|-----------|---------|
| `notifications` | `notification:new` | New in-app notification |
| `dashboard` | `dashboard:update` | Dashboard data changed |

### React Hook (`app/hooks/use-sse.ts`)

```typescript
import { useSSE } from "~/hooks/use-sse";

useSSE({
  channels: ["notifications", "dashboard"],
  onEvent: (event) => {
    console.log(event.type, event.data);
  },
  onConnectionChange: (state) => {
    // "connecting" | "connected" | "disconnected"
  },
  enabled: true, // default
});
```

Features:
- Exponential backoff reconnection (1s → 30s max)
- Memoized callback refs to prevent reconnect thrashing
- Automatic cleanup on unmount

### Adding New Channels/Events

1. Add the channel and event type to `app/types/sse-events.ts`
2. Fire events from services using `sendSSEEvent(channel, eventType, data, tenantId)`

---

## 15. Notifications

**Feature flag:** `FF_NOTIFICATIONS`

### Service (`app/services/notifications.server.ts`)

```typescript
import {
  createNotification,
  getUnreadCount,
  listNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "~/services/notifications.server";

// Create (also publishes SSE event on the "notifications" channel)
await createNotification({
  userId: "...",
  tenantId: "...",
  type: "info",
  title: "New Update",
  message: "Something happened",
  data: { key: "value" },  // optional JSON
});

// List with filters and pagination
const { notifications, total, totalPages } = await listNotifications(userId, {
  page: 1,
  perPage: 20,
  type: "info",
  read: false,
});

// Mark as read (validates ownership)
await markAsRead(notificationId, userId);
await markAllAsRead(userId);

// Delete (validates ownership)
await deleteNotification(notificationId, userId);

// Get unread count (used by navbar bell icon)
const count = await getUnreadCount(userId);
```

### Notification Model

```
Notification {
  id, userId, tenantId, type, title, message,
  data (JSON), read (boolean), readAt, createdAt
}
```

### UI

- Notification bell in the navbar shows unread count
- Route: `/$tenant/notifications` for full notification list
- Real-time delivery via SSE (`notification:new` event)

---

## 16. Broadcasts / Messaging

**Feature flag:** `FF_BROADCASTS`

### Service (`app/services/broadcasts.server.ts`)

Broadcasts send messages to multiple recipients with audience filtering.

```typescript
import {
  createBroadcast,
  listBroadcasts,
  getBroadcast,
  getBroadcastDeliveries,
  sendBroadcast,
  cancelBroadcast,
} from "~/services/broadcasts.server";
```

### Models

- **MessageTemplate** — reusable templates with variables (`tenantId`, `name`, `subject`, `body`, `channel`, `variables[]`)
- **BroadcastMessage** — a single broadcast instance (`subject`, `body`, `channel`, `status`, `filters`, recipient/sent/failed counts)
- **MessageDelivery** — per-recipient delivery record (`broadcastId`, `userId`, `channel`, `status`)

### Status Flow

`DRAFT` → `SENDING` → completed counts updated, or `CANCELLED`

### Audience Resolution

Filters support:
- **Roles** — include users with specific roles
- **Statuses** — include users with specific statuses (ACTIVE, INACTIVE, etc.)

Delivery is batched (100 per batch) with per-channel handling (EMAIL, IN_APP, SMS stub, PUSH stub).

---

## 17. Custom Objects

**Feature flag:** `FF_CUSTOM_OBJECTS`

### Overview

Custom objects provide schema-less, tenant-scoped data storage. Define a "shape" (fields), then create records conforming to that shape.

### Service (`app/services/custom-objects.server.ts`)

```typescript
import {
  createDefinition,
  updateDefinition,
  deleteDefinition,
  getDefinition,
  getDefinitionBySlug,
  listDefinitions,
  createRecord,
  updateRecord,
  deleteRecord,
  getRecord,
  listRecords,
} from "~/services/custom-objects.server";
```

### Definition

```typescript
// Create a new custom object definition
await createDefinition({
  tenantId: "...",
  name: "Contacts",
  slug: "contacts",        // lowercase, starts with letter, alphanumeric + hyphens/underscores
  description: "Customer contacts",
  icon: "users",
  fields: [
    { name: "email", label: "Email", dataType: "TEXT", required: true },
    { name: "age", label: "Age", dataType: "NUMBER" },
    { name: "active", label: "Active", dataType: "BOOLEAN", defaultValue: "true" },
  ],
  createdBy: "user-id",
});

// All read/write operations require tenantId for isolation
const def = await getDefinition("def-id", tenantId);
await updateDefinition("def-id", tenantId, { name: "Updated Name" });
await deleteDefinition("def-id", tenantId);  // soft-delete, blocked if records exist
const defs = await listDefinitions(tenantId);
```

**Slug validation:** Must start with a letter, followed by lowercase alphanumeric characters, hyphens, or underscores.

**Field types:** TEXT, NUMBER, DATE, BOOLEAN (extensible via `FieldDataType` enum which includes LONG_TEXT, DATETIME, ENUM, MULTI_ENUM, EMAIL, URL, PHONE, FILE, IMAGE, REFERENCE, FORMULA, JSON).

### Records

```typescript
// Create — validates required fields and that definition is active
await createRecord({
  definitionId: "...",
  tenantId: "...",
  data: { email: "test@example.com", age: 30, active: true },
  createdBy: "user-id",
});

// All record operations require tenantId
const record = await getRecord("rec-id", tenantId);
await updateRecord("rec-id", tenantId, { email: "new@example.com" });
await deleteRecord("rec-id", tenantId);
const records = await listRecords("def-id", tenantId);
```

Required fields are validated on create and update. Soft-delete on definitions is blocked if records exist.

### Routes

- `/$tenant/custom-objects/` — list, create, manage definitions and records

---

## 18. Form Designer

**Feature flag:** `FF_FORM_DESIGNER`

### Overview

A drag-and-drop form builder stored as JSON schemas in the `SectionTemplate` model.

### Components (`app/components/form-designer/`)

The form designer UI supports:
- Multi-page forms with sections and fields
- Drag-and-drop reordering via `@dnd-kit/core` and `@dnd-kit/sortable`
- Field types: text, textarea, number, email, select, checkbox, radio, date, file
- Conditional logic: show/hide fields based on other field values
- Editor and preview modes

### Hook (`app/hooks/use-form-designer.ts`)

```typescript
import { useFormDesigner } from "~/hooks/use-form-designer";

const designer = useFormDesigner(initialDefinition);

// State
designer.state;        // current form definition
designer.canUndo;      // boolean
designer.canRedo;      // boolean
designer.isDirty;      // has unsaved changes

// Undo/Redo (max 50 steps)
designer.undo();
designer.redo();

// Page operations
designer.addPage(page);
designer.removePage(pageId);
designer.updatePage(pageId, updates);
designer.setActivePage(pageId);
designer.reorderPages(fromIndex, toIndex);

// Section operations
designer.addSection(pageId, section);
designer.removeSection(pageId, sectionId);
designer.updateSection(pageId, sectionId, updates);
designer.reorderSections(pageId, fromIndex, toIndex);

// Field operations
designer.addField(pageId, sectionId, field);
designer.removeField(pageId, sectionId, fieldId);
designer.updateField(pageId, sectionId, fieldId, updates);
designer.moveField(fromPage, fromSection, toPage, toSection, fieldId, newOrder);

// Settings
designer.updateSettings({ displayMode, showProgressBar, submitButtonText });

// Lifecycle
designer.markSaved();            // clears isDirty
designer.setViewMode("editor");  // or "preview"
```

Uses `structuredClone` for immutable state updates and `useReducer` internally.

---

## 19. Saved Views

**Feature flag:** `FF_SAVED_VIEWS`

### Service (`app/services/saved-views.server.ts`)

```typescript
import {
  createView,
  updateView,
  deleteView,
  getView,
  listViews,
  getDefaultView,
  duplicateView,
} from "~/services/saved-views.server";
```

### View Types

| Type | Description |
|------|-------------|
| TABLE | Table with column config, filters, sorts |
| KANBAN | Board with groupBy field |
| CALENDAR | Calendar with date field mapping |
| GALLERY | Card-based gallery layout |

### SavedView Model

```
SavedView {
  id, tenantId, userId, name, entityType,
  viewType (TABLE | KANBAN | CALENDAR | GALLERY),
  filters (JSON), sorts (JSON), columns[],
  config (JSON), isShared, isDefault,
  createdAt, updatedAt
}
```

- Only the **owner** can update or delete a view (403 otherwise)
- Setting `isDefault: true` unsets the default on other views for the same entity
- Shared views are visible to all users in the tenant
- `duplicateView()` creates a copy with "(copy)" suffix, always unshared and non-default
- All operations require `tenantId` for tenant isolation

```typescript
// All view operations require tenantId
const view = await getView("view-id", tenantId);
await updateView("view-id", userId, tenantId, { name: "Renamed" });
await deleteView("view-id", userId, tenantId);
await duplicateView("view-id", userId, tenantId);
```

### View Resolution Helper (`app/services/view-filters.server.ts`)

The `resolveViewContext` helper combines feature flag checking, active view resolution, and filter/sort building for paginated index pages:

```typescript
import { resolveViewContext } from "~/services/view-filters.server";

// In a loader:
const viewCtx = await resolveViewContext(request, tenantId, userId, "User", {
  name: "user.name",      // fieldMap: view field → Prisma field
  email: "user.email",
  status: "user.status",
});
// viewCtx = { activeView, availableViews, viewWhere, viewOrderBy }

// Use in Prisma query:
const users = await prisma.user.findMany({
  where: { tenantId, ...viewCtx.viewWhere },
  orderBy: viewCtx.viewOrderBy.length ? viewCtx.viewOrderBy : [{ name: "asc" }],
});
```

### Components

View components live in `app/components/views/` and render based on view type.

---

## 20. File Uploads

**Feature flag:** `FF_FILE_UPLOADS`

### Service (`app/services/file-upload.server.ts`)

```typescript
import { processFileUpload, getFileMetadata } from "~/services/file-upload.server";

const result = await processFileUpload(file, {
  tenantId: "...",
  uploadedBy: "user-id",
  allowedTypes: ["image/jpeg", "image/png", "application/pdf"],  // optional override
  ipAddress: "...",   // for audit
  userAgent: "...",   // for audit
});

if (result.allowed) {
  // result.fileId, result.url ("/api/v1/files/{fileId}")
} else {
  // result.reason
}
```

### Validation Pipeline

1. **MIME type allowlist** — default allows JPEG, PNG, GIF, WebP, PDF, Word, Excel
2. **Magic bytes verification** — checks actual file content against expected byte signatures (prevents MIME spoofing)
3. **Size limit** — default 10MB (configurable)

### Storage

Files are stored on disk at `{FILE_UPLOAD_DIR}/{tenantId}/{YYYY}/{MM}/{fileId}{ext}` with a `.meta.json` sidecar file containing metadata.

### UploadedFile Model

```
UploadedFile {
  id, tenantId, originalName, storagePath,
  mimeType, sizeBytes, uploadedBy,
  metadata (JSON), createdAt
}
```

---

## 21. Data Import/Export

**Feature flag:** `FF_DATA_IMPORT_EXPORT`

### Export (`app/services/data-export.server.ts`)

```typescript
import { exportData } from "~/services/data-export.server";

const { content, filename, contentType } = await exportData({
  entity: "users",      // "users" | "roles" | "custom-object-records"
  tenantId: "...",
  format: "csv",        // "csv" | "json"
  objectId: "...",      // required for custom-object-records
});
```

**Exported fields by entity:**

| Entity | Fields |
|--------|--------|
| users | id, email, username, name, status, createdAt |
| roles | id, name, description, scope, createdAt |
| custom-object-records | id, data (JSON), createdBy, createdAt |

### Import (`app/services/data-import.server.ts`)

```typescript
import { importData, parseCsv, parseJson } from "~/services/data-import.server";

const result = await importData({
  entity: "users",
  tenantId: "...",
  format: "csv",
  content: csvString,
  dryRun: true,    // validate only, don't write to DB
});

// result = { totalRows, validRows, errorRows, errors[], imported }
```

**Import behavior by entity:**

| Entity | Required Fields | Defaults |
|--------|----------------|----------|
| users | email | Password: `"Changeme1!"` |
| roles | name | Scope: `"TENANT"` |
| custom-object-records | (data parsed as JSON) | — |

**Features:**
- **Batch processing** — 100 rows per batch
- **Dry-run mode** — validation without database writes
- **Row-level error tracking** — errors include line numbers
- **CSV parsing** — handles quoted fields and escaped quotes
- **Duplicate detection** — checks existing emails for users

### Routes

- `/$tenant/export` — export UI
- `/$tenant/import` — import UI with file upload and dry-run preview

---

## 22. Search & Command Palette

**Feature flag:** `FF_GLOBAL_SEARCH`

### Search Service (`app/services/search.server.ts`)

```typescript
import { globalSearch } from "~/services/search.server";

const { results, total, query } = await globalSearch("search term", tenantId, userId, {
  limit: 50,  // default 50, max 100
  page: 1,    // pagination
});
```

**Searched entities:** Users, Roles, Permissions, Custom Objects, Audit Logs

**Relevance scoring:**
- Exact match: 1.0
- Starts with query: 0.8
- Contains query: 0.5

Minimum 2-character query. Results limited to 100 per entity type. Case-insensitive substring matching.

### Command Palette (`app/components/layout/command-palette.tsx`)

**Keyboard shortcut:** `Cmd+K` (macOS) / `Ctrl+K` (Windows/Linux)

Features:
- **Search input** with 300ms debounce, minimum 2 characters
- **Quick actions** — Dashboard, Users, Settings navigation
- **Recent searches** — persisted in localStorage (max 5 entries)
- **Keyboard navigation** — arrow keys to navigate, Enter to select, Esc to close
- **Results display** — title, subtitle, icon per result
- Auto-focuses input when opened, scrolls selected item into view

```typescript
<CommandPalette
  open={isOpen}
  onOpenChange={setIsOpen}
  basePrefix={`/${tenantSlug}`}  // defaults to "/admin"
/>
```

---

## 23. Analytics Dashboard

**Feature flag:** `FF_ANALYTICS`

### Service (`app/services/analytics.server.ts`)

```typescript
import {
  getDashboardMetrics,
  getUserGrowth,
  getLoginActivity,
  getRoleDistribution,
  getSessionActivity,
  recordSnapshot,
  querySnapshots,
  metricsToCSV,
} from "~/services/analytics.server";
```

### Dashboard Metrics

`getDashboardMetrics(tenantId)` returns:

| Metric | Description |
|--------|-------------|
| `totalUsers` | Total user count |
| `activeUsers` | Users with ACTIVE status |
| `totalRoles` | Total role count |
| `recentAuditLogs` | Audit log entries in last 7 days |
| `usersByStatus` | Breakdown by status (ACTIVE, INACTIVE, LOCKED, SUSPENDED) |
| `recentActivity` | Latest audit log entries |

### Time-Series Charts

| Function | Chart Type | Data |
|----------|-----------|------|
| `getUserGrowth(tenantId, days?)` | Line chart | Daily new user count (default 30 days) |
| `getLoginActivity(tenantId, days?)` | Bar chart | Daily login count |
| `getRoleDistribution(tenantId)` | Pie chart | Top roles by user count |
| `getSessionActivity(tenantId, days?)` | Area chart | Daily active sessions |

### Snapshots

For custom metrics, use the snapshot system:

```typescript
await recordSnapshot({
  tenantId: "...",
  metric: "api-calls",
  value: 1500,
  period: "daily",
  timestamp: new Date(),
  dimensions: { endpoint: "/api/v1/users" },
});

const data = await querySnapshots({
  tenantId: "...",
  metric: "api-calls",
  period: "daily",
  from: new Date("2026-01-01"),
  to: new Date("2026-03-01"),
});
```

### Route

`/$tenant/analytics/` — full dashboard with metric cards, charts, and date range filtering. Charts use the `recharts` library.

---

## 24. Audit Logging

### AuditLog Model

```
AuditLog {
  id, tenantId, userId, action, entityType, entityId,
  description, metadata (JSON), ipAddress, userAgent, createdAt
}
```

### Actions (AuditAction enum)

`CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `CONFIGURE`, `RATE_LIMIT`, `TWO_FACTOR_ENABLE`, `TWO_FACTOR_DISABLE`

### Auto-Logged Actions

The following actions are automatically audit-logged throughout the system:

- **Auth:** login (success/failure), logout, session hijack detection
- **Users:** create, update, delete, status changes
- **Roles:** create, update, delete, permission assignments
- **2FA:** enable, disable, recovery code generation
- **Settings:** feature flag changes, system setting updates
- **API Keys:** create, revoke, rotate
- **Webhooks:** create, update, delete, pause, resume, test
- **File uploads:** success/failure
- **Broadcasts:** create, send, cancel

### Adding Audit Logging to New Features

```typescript
await prisma.auditLog.create({
  data: {
    tenantId,
    userId,
    action: "CREATE",
    entityType: "MyEntity",
    entityId: entity.id,
    description: "Created a new entity",
    metadata: { key: "value" },
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  },
});
```

### UI

`/$tenant/audit-log/` — browsable audit log with filtering by action, entity type, user, and date range.

---

## 25. UI Component Library

### shadcn/ui Components (`app/components/ui/`)

Pre-installed components from shadcn/ui. **Do not edit these files directly.** To add new components:

```bash
npx shadcn add <component-name>
```

Available components include: Button, Card, Dialog, Dropdown Menu, Input, Label, Select, Table, Tabs, Toast, Tooltip, Slot, and more.

### DataTable Component (`app/components/data-table/`)

A reusable, feature-rich table component used by every entity list page:

```typescript
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef, PaginationMeta } from "~/components/data-table/data-table-types";

type UserRow = { id: string; name: string; email: string; status: string };

const columns: ColumnDef<UserRow>[] = [
  {
    id: "name",
    header: "Name",
    sortable: true,
    cell: (row) => (
      <Link to={`${basePath}/${row.id}`} className="hover:underline">
        {row.name}
      </Link>
    ),
    cellClassName: "font-medium text-foreground",
  },
  { id: "email", header: "Email", cell: "email" },
  {
    id: "status",
    header: "Status",
    align: "center",
    cell: (row) => <Badge variant={row.status === "ACTIVE" ? "default" : "secondary"}>{row.status}</Badge>,
  },
];

<DataTable
  data={users}
  columns={columns}
  searchConfig={{ placeholder: "Search users..." }}
  filters={[
    { paramKey: "status", label: "Status", options: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ], placeholder: "All statuses" },
  ]}
  toolbarActions={[
    { label: "New User", icon: Plus, href: `${basePath}/new` },
  ]}
  rowActions={[
    { label: "Edit", icon: Pencil, href: (row) => `${basePath}/${row.id}/edit` },
    { label: "Delete", icon: Trash2, href: (row) => `${basePath}/${row.id}/delete`, variant: "destructive" },
  ]}
  pagination={pagination}
  emptyState={{
    icon: Users,
    title: "No users found",
    description: "Users will appear here once they are created.",
  }}
/>
```

**Features:**
- Server-side search via `q` query parameter
- Server-side filtering via custom `paramKey` query parameters
- Server-side pagination with page/pageSize controls
- Column sorting with `sortable` flag
- Row actions dropdown (edit, delete, custom actions)
- Toolbar actions (new, back, custom buttons)
- Responsive — columns with `hideOnMobile: true` are hidden on small screens
- Empty state with icon, title, and description

### Custom Components

| Component | Location | Purpose |
|-----------|----------|---------|
| DataTable | `app/components/data-table/` | Reusable table with search, filters, pagination, row actions |
| Command Palette | `app/components/layout/command-palette.tsx` | Global search (`Cmd+K`) |
| Route Error Boundary | `app/components/route-error-boundary.tsx` | Contextual error display with retry |
| Analytics Charts | `app/components/analytics/` | Recharts-based dashboard charts |
| Form Designer | `app/components/form-designer/` | Drag-and-drop form builder |
| View Components | `app/components/views/` | Table, kanban, calendar, gallery views |

### Layout Components (`app/components/layout/`)

- **Sidebar** — tenant navigation with collapsible sections
- **Navbar** — top bar with user menu, notification bell, theme toggle
- **Breadcrumbs** — auto-generated from route hierarchy
- **Theme Toggle** — dark/light mode switcher

### Dark Mode

Theme toggle in the navbar. CSS variables defined in `app/app.css`. Uses Tailwind's dark mode variant.

---

## 26. Forms & Validation

### Conform + Zod Pattern

Forms use the [Conform](https://conform.guide/) library for progressive enhancement with Zod schemas for validation.

**Component (client):**

```typescript
import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";

const [form, fields] = useForm({
  lastResult: actionData?.result,
  onValidate({ formData }) {
    return parseWithZod(formData, { schema: mySchema });
  },
});

return (
  <form {...getFormProps(form)}>
    <input {...getInputProps(fields.email, { type: "email" })} />
    {fields.email.errors && <p>{fields.email.errors}</p>}
    <button type="submit">Submit</button>
  </form>
);
```

**Action (server):**

```typescript
import { parseWithZod } from "@conform-to/zod";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: mySchema });
  if (submission.status !== "success") {
    return { result: submission.reply() };
  }
  // submission.value is typed and validated
}
```

### Existing Schemas (`app/lib/schemas/`)

- User schemas (create, update)
- Role schemas
- Tenant schemas
- Password schemas (with complexity rules)
- Password reset schemas
- Invitation schemas
- Import/export schemas
- Settings schemas (feature flag updates)

---

## 27. Error Handling

### ServiceError Base Class (`app/lib/errors/service-error.server.ts`)

All domain errors extend a common base class:

```typescript
import { ServiceError } from "~/lib/errors/service-error.server";

class UserError extends ServiceError {
  constructor(message: string, status = 400, code?: string) {
    super(message, status, code);
    this.name = "UserError";
  }
}

// Usage in services:
throw new UserError("User not found", 404, "NOT_FOUND");
throw new UserError("Email already taken", 409, "DUPLICATE");
throw new UserError("Cannot delete admin user", 403, "FORBIDDEN");
```

Every service module defines its own error class (e.g., `RoleError`, `PermissionError`, `BroadcastError`, `CustomObjectError`, `SavedViewError`, `FieldError`, `TemplateError`, `ReferenceDataError`, `SectionTemplateError`). All inherit `status` and optional `code` from `ServiceError`.

### handleServiceError (`app/lib/errors/handle-service-error.server.ts`)

A unified handler for route action catch blocks. Replaces repetitive 5-line `instanceof` patterns:

```typescript
import { handleServiceError } from "~/lib/errors/handle-service-error.server";

// In a route action — with Conform form:
export async function action({ request }: Route.ActionArgs) {
  const submission = parseWithZod(formData, { schema });
  if (submission.status !== "success") return { result: submission.reply() };
  try {
    await createUser(submission.value, ctx);
    return redirect(`/${tenant}/users`);
  } catch (error) {
    return handleServiceError(error, { submission });
    // Returns { result } with form errors for the UI
  }
}

// In a route action — without Conform:
try {
  await deleteUser(id, ctx);
} catch (error) {
  return handleServiceError(error);
  // Returns { error: "message" } with appropriate HTTP status
}
```

### Root Error Boundary

`app/root.tsx` exports a root-level `ErrorBoundary` that catches unhandled errors across the entire app.

### Route Error Boundary (`app/components/route-error-boundary.tsx`)

A reusable error boundary component with contextual messages and retry capability.

```typescript
import { RouteErrorBoundary } from "~/components/route-error-boundary";

// In a route module:
export function ErrorBoundary() {
  return <RouteErrorBoundary context="loading users" />;
}
```

**Features:**
- Status-specific messages: 401 (unauthorized), 403 (forbidden), 404 (not found)
- Generic fallback for other errors
- Retry button using `useRevalidator` from React Router
- Card-based UI with centered layout

**Routes with nested error boundaries:** tenant layout, users list, analytics, settings/features.

### Pattern

Export `ErrorBoundary` from any route module to catch errors within that route's boundary without affecting sibling routes.

---

## 28. Internationalization (i18n)

**Feature flag:** `FF_I18N`

### Configuration (`app/lib/i18n.ts`)

Uses i18next with `react-i18next` and browser language detection.

**Supported languages:**

| Code | Name | Direction |
|------|------|-----------|
| `en` | English | LTR |
| `fr` | Francais | LTR |

**Namespaces (8):**

| Namespace | Content |
|-----------|---------|
| `common` | Shared strings (buttons, labels, status) |
| `nav` | Navigation labels |
| `auth` | Login, signup, 2FA, password reset |
| `validation` | Form validation messages |
| `settings` | Settings page |
| `users` | User management |
| `analytics` | Analytics dashboard |
| `notifications` | Notification messages |

### Usage

```typescript
import { useTranslation } from "react-i18next";

function MyComponent() {
  const { t } = useTranslation("users");
  return <h1>{t("title")}</h1>;
}

// Plurals
t("itemCount", { count: 5 }); // uses count-based key selection

// With namespace prefix
const { t } = useTranslation("common");
t("save");    // "Save"
t("cancel");  // "Cancel"
```

### Language Detection

Detection order: cookie (`i18n_lang`) → browser navigator. Cookie persists for 1 year.

### Adding a New Language

1. Create JSON files in `app/locales/{lang}/` for all 8 namespaces
2. Import the files in `app/lib/i18n.ts`
3. Add to the `resources` object
4. Add to the `supportedLanguages` array

---

## 29. PWA & Offline

**Feature flags:** `FF_PWA`, `FF_OFFLINE_MODE`

- Service worker registration for caching
- Offline fallback page when the network is unavailable
- Controlled by two separate feature flags to allow PWA without full offline mode

---

## 30. Keyboard Shortcuts

**Feature flag:** `FF_KEYBOARD_SHORTCUTS`

| Shortcut | Action |
|----------|--------|
| `Cmd+K` / `Ctrl+K` | Open command palette |

---

## 31. HTTP Caching

### Cache Utility (`app/lib/cache.server.ts`)

```typescript
import { generateETag, handleConditionalRequest, CACHE_HEADERS } from "~/lib/db/cache.server";
```

**ETag generation:**
```typescript
const etag = generateETag(responseBody); // SHA-256, first 16 hex chars
```

**Conditional request handling (304 support):**
```typescript
return handleConditionalRequest(request, jsonBody, extraHeaders);
// If If-None-Match matches ETag → 304 Not Modified
// Otherwise → 200 with Cache-Control: private, no-cache + ETag
```

**Preset cache headers:**

| Preset | Value | Use Case |
|--------|-------|----------|
| `CACHE_HEADERS.static` | `public, max-age=31536000, immutable` | Static assets (JS, CSS, images) |
| `CACHE_HEADERS.noStore` | `no-store` | Health check, sensitive data |
| `CACHE_HEADERS.privateNoCache` | `private, no-cache` | API responses (with ETag) |

---

## 32. Testing

### Test Suite Overview

The project has comprehensive test coverage with **57 test files** and **1,664+ unit tests** covering all services, lib modules, and schemas.

| Category | Files | Tests | Covers |
|----------|-------|-------|--------|
| Services | 26 | ~900 | All 26 service modules (users, roles, permissions, tenants, broadcasts, message-templates, notifications, invitations, analytics, search, fields, section-templates, recovery-codes, 2fa-enforcement, webhook-dispatcher, webhook-delivery, data-import, data-export, reference-data, view-filters, custom-objects, saved-views, file-upload, webhooks, api-keys, optimistic-lock) |
| Lib modules | 15 | ~250 | Feature flags, settings, api-auth, api-response, cache, email, email-templates, event-bus, job-queue, webhook-emitter, service-error, handle-service-error, request-context, theme, sidebar |
| Schemas | 3 | ~510 | All 18 Zod schemas (user, role, permission, tenant, auth, profile, broadcast, message-template, field, section-template, invitation, custom-object, reference-data, api-keys, import-export, settings, password-reset, organization) |
| Components | 3 | ~50 | Field types, enum options, field utilities |
| Server | 2 | ~18 | Rate limiting, rate limit audit |

### Running Tests

```bash
npm run test             # Run all unit tests (vitest run)
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:integration # Integration tests (uses test DB on port 5433)
npm run test:e2e         # Playwright E2E tests
npm run test:e2e:ui      # Playwright UI mode
```

Run a single file:
```bash
npx vitest run tests/unit/services/users.server.test.ts
npx vitest run tests/unit/lib/schemas/schemas-batch1.test.ts
npx playwright test tests/e2e/smoke.spec.ts
```

### Test Directory Structure

All unit tests live in `tests/unit/`, mirroring the source structure:

```
tests/unit/
├── services/                    # One test file per service
│   ├── users.server.test.ts
│   ├── roles.server.test.ts
│   ├── permissions.server.test.ts
│   ├── tenants.server.test.ts
│   ├── broadcasts.server.test.ts
│   ├── message-templates.server.test.ts
│   ├── ... (26 files total)
├── lib/
│   ├── auth/                    # Auth helper tests
│   ├── config/                  # Feature flags, settings tests
│   ├── db/                      # Cache tests
│   ├── email/                   # Email service and template tests
│   ├── errors/                  # ServiceError, handleServiceError tests
│   ├── events/                  # Event bus, job queue, webhook emitter tests
│   ├── schemas/                 # 3 batch files covering all 18 Zod schemas
│   ├── api-response.server.test.ts
│   ├── request-context.server.test.ts
│   ├── theme.server.test.ts
│   ├── sidebar.server.test.ts
│   └── ... (15 files total)
├── components/fields/           # Field component logic tests
└── server/                      # Express middleware tests
```

### Writing Unit Tests

Follow the established patterns. Here's the standard service test template:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// 1. Define mock functions for each Prisma method used
const mockCreate = vi.fn();
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

// 2. Mock the Prisma module
vi.mock("~/lib/db/db.server", () => ({
  prisma: {
    myModel: {
      create: (...args: unknown[]) => mockCreate(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    auditLog: { create: vi.fn() },
  },
}));

// 3. Mock the logger
vi.mock("~/lib/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("my-service.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("createItem", () => {
    it("creates an item with valid input", async () => {
      // 4. Use dynamic imports (required for vi.mock to work)
      const { createItem } = await import("~/services/my-service.server");

      // 5. Set up mock return values
      mockCreate.mockResolvedValue({ id: "item-1", name: "Test" });

      // 6. Call the function
      const result = await createItem({ name: "Test", tenantId: "t-1" });

      // 7. Assert results
      expect(result.id).toBe("item-1");
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: "Test", tenantId: "t-1" }),
      });
    });

    it("throws when item not found", async () => {
      const { getItem, MyServiceError } = await import("~/services/my-service.server");
      mockFindFirst.mockResolvedValue(null);

      await expect(getItem("missing-id", "t-1")).rejects.toThrow(MyServiceError);
    });
  });
});
```

**Key conventions:**
- **Dynamic imports** inside each test (`await import("~/services/...")`) — required for `vi.mock` to intercept
- **`vi.resetAllMocks()`** in `beforeEach` — clears call history and mock implementations between tests
- **Mock per Prisma method** — each method gets its own `vi.fn()` for independent control
- **Test both paths** — happy path + error cases (not found, duplicate, unauthorized, invalid input)
- **Verify audit logs** — state-changing operations should assert `auditLog.create` was called
- **Verify no side effects** — when validation fails, assert that no update/delete/audit calls were made

### Writing Schema Tests

Schema tests validate Zod schemas using `safeParse`:

```typescript
import { describe, it, expect } from "vitest";
import { createUserSchema } from "~/lib/schemas/user";

describe("createUserSchema", () => {
  it("accepts valid data", () => {
    const result = createUserSchema.safeParse({
      email: "test@example.com",
      name: "Test User",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = createUserSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(false);
  });

  it("enforces email format", () => {
    const result = createUserSchema.safeParse({
      email: "not-an-email",
      name: "Test",
    });
    expect(result.success).toBe(false);
  });
});
```

### Integration Tests

Integration tests use a separate PostgreSQL database on port 5433 (started by Docker Compose). These tests hit the real database without mocks.

```bash
npm run test:integration
```

### Test Infrastructure

- **Setup:** `tests/setup/unit-setup.ts` — configured in `vitest.config.ts`
- **Factories:** `tests/factories/` — reusable data builders for test fixtures
- **Mocks:** `tests/mocks/` — MSW request handlers for HTTP mocking
- **Config:** `vitest.config.ts` — path alias (`~` → `app/`), test includes, coverage settings

---

## Appendix A: Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | — | Session encryption key (min 16 characters) |
| `NODE_ENV` | No | `development` | `development`, `production`, or `test` |
| `PORT` | No | `3000` | Server port |
| `BASE_URL` | No | `http://localhost:3000` | Base URL for the application |
| `DATABASE_POOL_MIN` | No | `2` | Minimum database connections |
| `DATABASE_POOL_MAX` | No | `10` | Maximum database connections |
| `DATABASE_QUERY_TIMEOUT` | No | `5000` | Query timeout in ms |
| `DATABASE_CONNECTION_TIMEOUT` | No | `10000` | Connection timeout in ms |
| `SESSION_MAX_AGE` | No | `2592000000` | Session max age in ms (30 days) |
| `BCRYPT_ROUNDS` | No | `10` | Bcrypt hashing rounds |
| `MAX_LOGIN_ATTEMPTS` | No | `5` | Failed attempts before account lockout |
| `LOCKOUT_DURATION_MINUTES` | No | `30` | Account lockout duration |
| `LOG_LEVEL` | No | `info` | Pino log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| `SENTRY_DSN` | No | `""` | Sentry error tracking DSN |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `0.1` | Sentry traces sample rate (0-1) |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Allowed CORS origins (comma-separated) |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window in ms (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max requests per window |
| `TRUSTED_PROXIES` | No | `1` | Number of trusted reverse proxies |
| `SMTP_HOST` | No | `""` | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_USER` | No | `""` | SMTP username |
| `SMTP_PASS` | No | `""` | SMTP password |
| `SMTP_FROM` | No | `noreply@app.local` | Default from address |
| `RESEND_API_KEY` | No | `""` | Resend API key (preferred over SMTP when set) |
| `APP_URL` | No | `http://localhost:3000` | Public app URL (used in emails) |
| `ENABLE_2FA` | No | `false` | Enable 2FA feature (boolean) |
| `ENABLE_OFFLINE_MODE` | No | `false` | Enable offline mode (boolean) |
| `ENABLE_SSE` | No | `true` | Enable SSE updates (boolean) |

---

## Appendix B: Feature Flags Reference

All flags are stored in the `FeatureFlag` database model and managed at `/$tenant/settings/features`. Flags support global enable/disable plus targeted activation per tenant, role, or user.

| Key | Description | Controls |
|-----|-------------|----------|
| `FF_SSE_UPDATES` | Server-Sent Events | Real-time updates via SSE connection at `/api/sse` |
| `FF_KEYBOARD_SHORTCUTS` | Keyboard Shortcuts | Global keyboard shortcuts (Cmd+K, etc.) |
| `FF_NOTIFICATIONS` | Notifications | In-app notification system and notification bell |
| `FF_I18N` | Internationalization | Multi-language support (EN/FR) |
| `FF_PWA` | Progressive Web App | Service worker registration and PWA features |
| `FF_OFFLINE_MODE` | Offline Mode | Offline fallback and cached content |
| `FF_ANALYTICS` | Analytics Dashboard | Analytics metrics, charts, and snapshots |
| `FF_REST_API` | REST API | API v1 endpoints at `/api/v1/` |
| `FF_WEBHOOKS` | Webhooks | Webhook subscriptions and event delivery |
| `FF_SIGNUP` | Self-Service Signup | Public user registration flow |
| `FF_SAVED_VIEWS` | Saved Views | Table/kanban/calendar/gallery saved views |
| `FF_CUSTOM_FIELDS` | Custom Fields | Custom field definitions per entity type |
| `FF_BROADCASTS` | Broadcasts | Broadcast messaging to filtered audiences |
| `FF_FILE_UPLOADS` | File Uploads | File upload with validation and storage |
| `FF_GLOBAL_SEARCH` | Global Search | Cross-entity search and command palette |
| `FF_CUSTOM_OBJECTS` | Custom Objects | Schema-less custom object definitions and records |
| `FF_FORM_DESIGNER` | Form Designer | Drag-and-drop form builder |
| `FF_TWO_FACTOR` | Two-Factor Auth | TOTP-based 2FA with recovery codes. When enabled, forces users to set up 2FA |
| `FF_INVITATIONS` | User Invitations | Invite users to tenant via email |
| `FF_DATA_IMPORT_EXPORT` | Data Import/Export | CSV/JSON import and export for users, roles, and custom objects |

### Feature Flag Evaluation

```typescript
import { isFeatureEnabled, getAllFlags, setFlag, FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";

// Check a single flag
const enabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.ANALYTICS, {
  tenantId: "...",
  roles: ["ADMIN"],
  userId: "...",
});

// Get all flags with computed status
const flags = await getAllFlags({ tenantId: "...", roles: ["ADMIN"] });

// Update a flag
await setFlag("FF_ANALYTICS", { enabled: true }, { userId: "...", tenantId: "..." });
```

**Evaluation logic:**
1. If `enabled` is `true` → flag is on for everyone
2. If `enabledForTenants` includes the context's `tenantId` → flag is on
3. If `enabledForRoles` includes any of the context's roles → flag is on
4. If `enabledForUsers` includes the context's `userId` → flag is on
5. Otherwise → flag is off

---

## Appendix C: Prisma Models Quick Reference

### Auth & Users

| Model | Key Fields |
|-------|-----------|
| **User** | id, email, username, name, photoUrl, status (ACTIVE/INACTIVE/LOCKED/SUSPENDED), tenantId, failedLoginAttempts, twoFactorEnabled, deletedAt |
| **Password** | id, hash, userId (unique) |
| **Session** | id, userId, expirationDate, fingerprint |
| **Verification** | id, userId, type, target, secret, algorithm, digits, period, charSet, expiresAt |
| **RecoveryCode** | id, userId, codeHash, usedAt |

### Tenancy

| Model | Key Fields |
|-------|-----------|
| **Tenant** | id, name, slug (unique), email, phone, website, address, city, state, zip, country, subscriptionPlan, logoUrl, brandTheme, featureFlags (JSON), extras (JSON) |

### RBAC

| Model | Key Fields |
|-------|-----------|
| **Role** | id, tenantId, name, description, scope (GLOBAL/TENANT/EVENT), deletedAt |
| **Permission** | id, resource, action, description. Unique on [resource, action] |
| **RolePermission** | id, roleId, permissionId, access ("own" or "any") |
| **UserRole** | id, userId, roleId, eventId, stepId |

### Feature Management

| Model | Key Fields |
|-------|-----------|
| **FeatureFlag** | id, key (unique), description, enabled, enabledForTenants[], enabledForRoles[], enabledForUsers[] |
| **SystemSetting** | id, tenantId, key, value, type, category, scope, scopeId |

### Content

| Model | Key Fields |
|-------|-----------|
| **CustomObjectDefinition** | id, tenantId, name, slug, description, icon, fields (JSON), isActive, deletedAt |
| **CustomObjectRecord** | id, definitionId, tenantId, data (JSON), createdBy |
| **FieldDefinition** | id, tenantId, entityType, name, label, dataType, sortOrder, isRequired, isUnique, isSearchable, isFilterable, defaultValue, config (JSON), validation (JSON) |
| **SectionTemplate** | id, tenantId, name, description, definition (JSON), isActive |
| **SavedView** | id, tenantId, userId, name, entityType, viewType, filters (JSON), sorts (JSON), columns[], config (JSON), isShared, isDefault |
| **UploadedFile** | id, tenantId, originalName, storagePath, mimeType, sizeBytes, uploadedBy, metadata (JSON) |

### Communication

| Model | Key Fields |
|-------|-----------|
| **Notification** | id, userId, tenantId, type, title, message, data (JSON), read, readAt |
| **MessageTemplate** | id, tenantId, name, subject, body, channel, isSystem, variables[] |
| **BroadcastMessage** | id, tenantId, templateId, subject, body, channel, status, filters (JSON), recipientCount, sentCount, failedCount, scheduledAt, sentAt |
| **MessageDelivery** | id, broadcastId, userId, channel, recipient, status, sentAt, error |
| **Invitation** | id, email, tenantId, roleIds[], token (unique), status (PENDING/ACCEPTED/EXPIRED/REVOKED), invitedById, expiresAt |

### API & Webhooks

| Model | Key Fields |
|-------|-----------|
| **ApiKey** | id, tenantId, name, description, keyHash (unique), keyPrefix, permissions[], scopes (JSON), rateLimitTier, status, expiresAt, lastUsedAt, usageCount, allowedIps[], allowedOrigins[] |
| **WebhookSubscription** | id, tenantId, url, events[], secret, status, version, maxRetries, retryBackoffMs[], timeoutMs, consecutiveFailures, circuitBreakerOpen, deletedAt |
| **WebhookDelivery** | id, tenantId, subscriptionId, eventType, eventId, payload (JSON), status, attempts, maxAttempts, nextRetryAt, responseCode, responseBody, latencyMs, errorMessage |

### System

| Model | Key Fields |
|-------|-----------|
| **AuditLog** | id, tenantId, userId, action, entityType, entityId, description, metadata (JSON), ipAddress, userAgent, createdAt |
| **Job** | id, type, payload (JSON), status, attempts, maxAttempts, nextRunAt, lastError, completedAt |
| **AnalyticsSnapshot** | id, tenantId, metric, value, dimensions (JSON), period, timestamp |

### Reference Data

| Model | Key Fields |
|-------|-----------|
| **Country** | id, code (ISO 3166-1 alpha-2), name, alpha3, numericCode, phoneCode, flag |
| **Title** | id, code, name, sortOrder, isActive |
| **Language** | id, code (ISO 639-1), name, nativeName |
| **Currency** | id, code (ISO 4217), name, symbol, decimalDigits |
| **DocumentType** | id, code, name, description, category |

---

## Appendix D: API Endpoints Quick Reference

All endpoints are under `/api/v1/` and require `Authorization: Bearer ak_...` header.

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/v1/users` | `user:read` | List users (paginated) |
| POST | `/api/v1/users` | `user:write` | Create user |
| GET | `/api/v1/users/:userId` | `user:read` | Get user with roles |
| PUT | `/api/v1/users/:userId` | `user:write` | Update user |
| DELETE | `/api/v1/users/:userId` | `user:delete` | Soft-delete user |
| GET | `/api/v1/roles` | `role:read` | List roles (paginated) |
| POST | `/api/v1/roles` | `role:write` | Create role |
| GET | `/api/v1/roles/:roleId` | `role:read` | Get role with permissions |
| PUT | `/api/v1/roles/:roleId` | `role:write` | Update role |
| DELETE | `/api/v1/roles/:roleId` | `role:delete` | Soft-delete role |
| GET | `/api/v1/permissions` | `role:read` | List all permissions (paginated) |
| GET | `/api/v1/tenants` | `tenant:read` | List tenants (paginated) |
| GET | `/api/v1/custom-objects` | `custom_object:read` | List custom object definitions (paginated) |
| POST | `/api/v1/custom-objects` | `custom_object:write` | Create custom object definition |
| GET | `/api/v1/custom-objects/:objectId` | `custom_object:read` | Get custom object definition |
| PUT | `/api/v1/custom-objects/:objectId` | `custom_object:write` | Update custom object definition |
| DELETE | `/api/v1/custom-objects/:objectId` | `custom_object:delete` | Soft-delete custom object definition |
| GET | `/api/v1/custom-objects/:objectId/records` | `custom_object:read` | List records (paginated) |
| POST | `/api/v1/custom-objects/:objectId/records` | `custom_object:write` | Create record |

**Pagination:** `?page=1&pageSize=20` (max page size: 100)

**Success response:** `{ "data": ... }`

**Paginated response:** `{ "data": [...], "pagination": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 } }`

**Error response:** `{ "error": { "code": "NOT_FOUND", "message": "...", "details": {} } }`

---

## Appendix E: npm Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `cross-env NODE_ENV=development node server.js` | Start dev server with Vite HMR |
| `build` | `react-router build` | Production build |
| `start` | `node server.js` | Start production server |
| `typecheck` | `react-router typegen && tsc -b` | Generate route types and type-check |
| `lint` | `tsc -b --noEmit` | Type-check without emitting |
| `format` | `prettier --write .` | Format all files with Prettier |
| `prepare` | `husky` | Install git hooks |
| `test` | `vitest run` | Run unit tests |
| `test:watch` | `vitest` | Run unit tests in watch mode |
| `test:coverage` | `vitest run --coverage` | Run unit tests with coverage report |
| `test:integration` | `vitest run --config vitest.integration.config.ts` | Run integration tests (test DB on port 5433) |
| `test:e2e` | `playwright test` | Run E2E tests |
| `test:e2e:ui` | `playwright test --ui` | Run E2E tests with Playwright UI |
| `db:migrate` | `npx prisma migrate dev` | Create and apply Prisma migrations |
| `db:push` | `npx prisma db push` | Sync Prisma schema to DB (no migration) |
| `db:seed` | `npx prisma db seed` | Seed database with default data |
| `db:studio` | `npx prisma studio` | Open Prisma Studio GUI |
| `docker:up` | `docker compose up -d` | Start Docker services (PostgreSQL, test DB, Mailpit) |
| `docker:down` | `docker compose down` | Stop Docker services |
| `docker:db:reset` | Drop and recreate DB, then push schema | Reset database completely |
