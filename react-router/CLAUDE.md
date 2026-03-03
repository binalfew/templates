# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev              # Start dev server (Express + Vite HMR)
npm run build            # Production build
npm run start            # Production server
npm run typecheck        # react-router typegen && tsc -b
npm run lint             # tsc -b --noEmit
npm run format           # Prettier format all files
```

### Database

```bash
npm run docker:up        # Start PostgreSQL, test DB, Mailpit via Docker Compose
npm run db:migrate       # Run Prisma migrations
npm run db:push          # Sync Prisma schema to DB
npm run db:seed          # Seed database
npm run db:studio        # Prisma Studio GUI
```

### Testing

```bash
npm run test             # Unit tests (vitest run)
npm run test:watch       # Unit tests in watch mode
npm run test:coverage    # Unit tests with coverage
npm run test:integration # Integration tests (uses test DB on port 5433)
npm run test:e2e         # Playwright E2E tests
npm run test:e2e:ui      # Playwright with UI
```

Run a single unit test file: `npx vitest run app/path/to/file.test.ts`
Run a single E2E test: `npx playwright test tests/e2e/file.spec.ts`

## Architecture

### Stack

- **Framework**: React Router 7 with SSR enabled, Express server, Vite bundler
- **Database**: PostgreSQL via Prisma ORM (with soft-delete extensions)
- **UI**: shadcn/ui + Radix primitives + Tailwind CSS 4 + lucide-react icons
- **Forms**: Conform (`@conform-to/react` + `@conform-to/zod`) with Zod validation
- **Auth**: Cookie-based sessions with DB backing, RBAC, optional TOTP 2FA
- **i18n**: i18next with `en` and `fr` locales in `app/locales/`

### Project Layout

- `app/routes/` — File-based routing via `react-router-auto-routes`. Routes auto-generated from file paths.
- `app/components/ui/` — shadcn/ui components (do not edit directly; use `npx shadcn add`)
- `app/components/` — Custom components (layout, fields, form-designer, analytics, views)
- `app/lib/` — Core utilities, organized into subdirectories. Files ending in `.server.ts` are server-only.
  - `app/lib/auth/` — Authentication & authorization (session, RBAC, 2FA, API auth)
  - `app/lib/db/` — Database client, soft-delete extensions, cache
  - `app/lib/errors/` — ServiceError base class and error handler
  - `app/lib/email/` — Email sending, templates, messaging constants
  - `app/lib/events/` — Event bus, job queue, webhook emitter
  - `app/lib/config/` — Environment variables, settings, feature flags
  - `app/lib/monitoring/` — Logger, Sentry (server + client)
  - `app/lib/offline/` — Offline store, fetch queue, sync manager
  - `app/lib/schemas/` — Shared Zod schemas for validation
- `app/services/` — Business logic layer (server-only). Each service handles a domain (users, tenants, roles, permissions, etc.)
- `app/hooks/` — React hooks (autosave, SSE, toast, form-designer)
- `server/` — Express app setup, security middleware (CSP, CORS, rate limiting, helmet), SSE
- `prisma/schema.prisma` — Database schema (multi-tenant, RBAC models)
- `tests/` — E2E tests, MSW mocks, test setup, factories

### Multi-Tenant Architecture

Routes under `app/routes/$tenant/` are tenant-scoped. The `$tenant` URL parameter is the tenant slug. The tenant layout (`$tenant/_layout.tsx`) loads feature flags and provides the dashboard shell (sidebar, navbar).

### Authentication & Authorization

- Session helpers in `app/lib/auth/session.server.ts`: `getUserId()`, `requireUserId()`, `requireUser()`, `requireAnonymous()`
- RBAC checks in `app/lib/auth/require-auth.server.ts`: `requireAuth()`, `requireRole()`, `requireAnyRole()`, `requirePermission()`, `requireGlobalAdmin()`, `requireFeature()`
- Roles have scopes: `GLOBAL`, `TENANT`, `EVENT`
- Permissions are resource:action pairs (e.g., `user:read`, `user:write`)

### Feature Flags

DB-backed feature flags evaluated per-request with tenant/role/user scoping. Defined in `app/lib/config/feature-flags.server.ts`. Keys prefixed with `FF_` (e.g., `FF_TWO_FACTOR`, `FF_ANALYTICS`, `FF_PWA`). Admin UI at `/$tenant/settings/features`.

### Data Patterns

- **Loaders** fetch data server-side; components consume via `useLoaderData()`
- **Actions** handle form submissions with Conform + Zod validation
- **Services** (`app/services/*.server.ts`) encapsulate DB operations
- **Soft delete** is handled by Prisma extensions — `deletedAt` is filtered automatically
- Path alias: `~/*` maps to `./app/*`

### Shared Types & Helpers (DO NOT duplicate)

- **`app/lib/types.server.ts`** — `ServiceContext` (optional tenantId), `TenantServiceContext` (required tenantId), `PaginatedQueryOptions`. All services import these; never define local variants.
- **`app/lib/request-context.server.ts`** — `buildServiceContext(request, user)` returns `ServiceContext`; `buildServiceContext(request, user, tenantId)` returns `TenantServiceContext`. Use in route actions instead of inline `{ userId, tenantId, ipAddress, userAgent }` objects.
- **`requireFeature(request, flagKey)`** in `app/lib/auth/require-auth.server.ts` — combines `requireAuth` + tenant null check + `isFeatureEnabled` in one call. Returns `{ user, roles, isSuperAdmin, tenantId: string }`. Use in feature-gated route loaders/actions instead of manual 8-line guard blocks.
- **`resolveViewContext(request, tenantId, userId, entityType, fieldMap)`** in `app/services/view-filters.server.ts` — checks the SAVED_VIEWS feature flag, resolves active view, and builds `viewWhere`/`viewOrderBy`. Use in paginated index page loaders instead of ~25 lines of inline view resolution.
- **`app/lib/errors/service-error.server.ts`** — `ServiceError` base class. All domain error classes (UserError, RoleError, etc.) extend this. Normalizes `status` and optional `code` properties.
- **`app/lib/errors/handle-service-error.server.ts`** — `handleServiceError(error, options?)` for route action catch blocks. Pass `{ submission }` for Conform form errors (returns `{ result }`), omit for simple errors (returns `{ error }`). Replaces 5-line instanceof catch blocks with a single call.

### Entity Route Structure (MANDATORY)

Every entity (users, roles, permissions, templates, broadcasts, etc.) MUST use separate route files for CRUD operations. Never put create/edit/delete forms inline in the index page. The standard pattern is:

```
app/routes/$tenant/<entity>/
  index.tsx          — List page with DataTable, search, pagination, views
  new.tsx            — Create form (Conform + Zod validation, Card layout)
  $<entityId>/
    edit.tsx         — Edit form (loads entity in loader, pre-fills form)
    delete.tsx       — Delete confirmation page (shows entity details, guards)
```

- **Index** uses `DataTable` with `toolbarActions` linking to `/new` and `rowActions` linking to `/$id/edit`, `/$id/delete`
- **New/Edit** use Conform `useForm` + `parseWithZod` with the entity's Zod schema, `redirectTo` query param support, and Cancel link back to the list
- **Delete** shows entity details in a read-only Card, includes validation guards (e.g. "cannot delete while sending"), and a destructive submit button
- Domain-specific status transitions (send, cancel, approve) stay as fetcher-based row actions on the index page

## Code Conventions

- **Formatting**: Prettier — double quotes, semicolons, trailing commas, 100 char width, 2-space indent
- **Commits**: Conventional commits enforced by commitlint. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`. Max subject 100 chars.
- **Pre-commit hooks**: Husky + lint-staged runs Prettier on staged files and formats Prisma schema
- **Server-only code**: Use `.server.ts` suffix — these files are excluded from client bundles
- **Node version**: 22 (see `.node-version`)

### Responsive Design (MANDATORY)

All UI components and pages MUST be responsive. Every interactive element (buttons, selects, inputs, links) must be full-width block elements on mobile and auto-width inline on desktop. The standard pattern is:

- **Buttons**: `className="w-full sm:w-auto"`
- **Selects (NativeSelect)**: `className="w-full sm:w-auto sm:min-w-[160px]"`
- **Inputs**: `className="w-full sm:flex-1 sm:min-w-0"`
- **Flex containers / toolbars**: `className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2"`
- **Wrapper divs for toolbar items**: `className="w-full sm:w-auto"`

On small screens, every toolbar item should stack vertically and take full width. On `sm` and above, they sit in a single row. Never hardcode fixed widths without a `w-full` mobile fallback. This applies everywhere: DataTable toolbars, ViewSwitcher, form layouts, action button groups, etc.
