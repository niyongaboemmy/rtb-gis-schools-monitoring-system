# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TVET 3D GIS — a geospatial platform for Rwanda's TVET Board to monitor and manage technical/vocational training schools. Core capabilities: school data management, KMZ/KML geospatial processing, 3D visualization (three.js), facility surveys, population analytics, and decision-support scoring.

## Development Commands

### Starting the full stack (from root):
```bash
docker-compose up -d          # Start PostgreSQL+PostGIS, Redis, MinIO
npm run install:all           # Install all dependencies
npm run dev                   # Start both server (port 3001) and client (port 5173) concurrently
```

### Individual services:
```bash
npm run dev:server            # Server only (watch mode)
npm run dev:client            # Client only (Vite dev server)
npm run seed                  # Re-seed the database
```

### Server (`/server`):
```bash
npm run build                 # Build NestJS app
npm run lint                  # ESLint with auto-fix
npm run test                  # Jest unit tests
npm run test:watch            # Jest watch mode
npm run test:cov              # Jest with coverage
npm run test:e2e              # End-to-end tests (needs a throwaway DB, see below)
npm run start:prod            # Run built dist/main.js
npx ts-node --transpile-only scripts/verify-dashboards.ts   # national KPIs vs raw SQL (read-only)
```

E2E suites (`server/test/`) boot the real `AppModule` through the shared
`configureApp()` (`src/app.setup.ts`) — the same middleware, body limits and
pipes as `main.ts`. Run them against a throwaway database, never the dev one:
`DB_NAME=rtb_gis_test SEED_ON_STARTUP=true SCOPE_ENFORCEMENT=true npm run test:e2e`.
The suites share that one database, so `test:e2e` runs them serially
(`--runInBand`); in parallel they race (one deletes schools/users while the
permission matrix is probing them) and fail intermittently.
`permission-matrix.e2e-spec.ts` discovers every permission-protected route and
asserts 200/403 for each seeded role, plus geographic scope. Throttling is
skipped only when `NODE_ENV=test` (Jest sets it).

### Client (`/client`):
```bash
npm run build                 # TypeScript check + Vite build
npm run lint                  # ESLint
npm run test                  # Vitest + Testing Library (jsdom), config in vitest.config.ts
npm run preview               # Preview production build
```

### File server (`/file-server`):
```bash
npm test                      # node --test (JWT upload auth, content-type checks)
```

## Architecture

### Infrastructure
- **PostgreSQL 15 + PostGIS 3.4** — primary database with geospatial extensions
- **Redis 7** — caching (BullMQ queue setup included)
- **MinIO** — S3-compatible object storage for files
- All three run via Docker Compose (`docker-compose.yml`)

### Backend (`/server`) — NestJS modular monolith
- API prefix: `/api/v1`, Swagger docs at `/api/docs`
- Body size limit: 1 MB JSON by default; a few geometry/bulk routes get `LARGE_JSON_BODY_LIMIT` (`common/security/http-hardening.ts`). File uploads are multipart (multer) with content-type and zip-bomb checks (`common/security/upload-validation.ts`)
- Boot refuses to start without `JWT_SECRET` / `JWT_REFRESH_SECRET` (and, in production, ≥32 chars, distinct, plus `TOTP_ENCRYPTION_KEY`) — `config/env.validation.ts`
- Auth: 15-min access token (memory only on the client) + rotating refresh token per device in an httpOnly `rtb_rt` cookie (`user_sessions` table); refresh/logout need `X-Requested-With: XMLHttpRequest`. TOTP 2FA (mandatory for privileged roles when `MFA_ENFORCE_PRIVILEGED`, default on in production), email-code fallback, lockout after 5 failures, shared password policy, forced change for admin-created accounts
- WebSocket (`events.gateway.ts`) authenticates the handshake JWT in Socket.IO middleware; rooms `user:<own id>` and in-scope `school:<id>` only
- TypeORM with `synchronize: true` in dev, `false` in prod — every schema change ships as a migration in `src/migrations/`
- Seeding is opt-in (`SEED_ON_STARTUP=true` or `npm run seed`; admin@rtb.gov.rw / Admin@123 in dev). Re-seeding only *adds* new code permissions to built-in roles (`roles.seededPermissions`) and never overwrites admin edits

**Key modules:**
- `AuthModule` — JWT + Passport, sessions, MFA (`mfa.service.ts`), Google sign-in (`GOOGLE_ALLOWED_DOMAINS`, `GOOGLE_ALLOW_SELF_REGISTER`), privacy-notice acceptance
- `UsersModule` + `RolesModule` — RBAC with permission arrays on roles
- `SchoolsModule` — core domain; `School` entity has ~50+ fields covering location, classification, facilities, utilities, staff, GIS data, and program data
- `KmzModule` — KMZ/KML file processing (~37KB service); extracts building geometries and boundary polygons, stores as GeoJSON on the School entity
- `AnalyticsModule` — School Condition Score (0–100, higher = better), one six-factor model in `server/src/modules/analytics/scoring.constants.ts`: infrastructure 35%, building age 25%, facility compliance 15%, accessibility 10%, population pressure 10%, issue resolution 5%. Intervention Priority bands: Critical < 35, High < 55, Medium < 75, Low ≥ 75. Missing component data → neutral 50, flagged via `dataGaps`. Aggregates count active schools only and respect the access scope. Derived figures (ratios, capacity, risk, report trends) are computed server-side only; the client gets weights/bands as `scoringModel` and never hard-codes them (`client/src/lib/scoring.ts`). The score is computed by the pure `scoring-engine.ts`, stored once per school in `decision_assessments` (bump `SCORING_VERSION` when a rule changes → rescored on boot) and recalculated on every scoring-input write (`school.updated` event), nightly — never by a dashboard GET. Formulas: `docs/METRIC_DICTIONARY.md` (entries generated from `client/src/components/metric-help/metrics.ts`); terms: `docs/GLOSSARY.md`; golden-dataset tests in `analytics/golden/`
- `AuditModule` + `common/audit/` — every mutating request (and sensitive reads) gets one `audit_logs` row: action, outcome, actor + role + IP, target + label, subject user, field diffs (TypeORM subscriber; `repository.update()` bypasses it — prefer `save()`). Names come from `common/audit/action-registry.ts` (add new handlers there) or `@Audit()`. Rows are hash-chained and protected by a DB trigger; `GET /audit-logs/verify` checks the chain. UI: Settings ▸ Audit Trail
- `SiteFeaturesModule` — 2D/3D measurements, notes and pins (`site_features`, WGS84 GeoJSON + model coords) and the per-school 3D viewer state (camera home, building pins). Live updates via `site-feature:changed`
- `PopulationModule` — ArcGIS integration (currently mocked) for population density data
- `StorageModule` — abstraction over local filesystem + MinIO
- `SeedModule` — creates access levels, built-in roles, `district_officer` / `school_leader` presets (only if missing), admin user and sample schools

### Frontend (`/client`) — React 19 + TypeScript + Vite
- Client dev proxy: `/api` → `localhost:3001`, `/minio` → `localhost:9000`
- Auth state in Zustand (`/src/store/authStore.ts`); only the user profile is persisted — the access token stays in memory and is restored from the refresh cookie on load (`AuthGate` shows a splash meanwhile)
- Axios instance (`/src/lib/api.ts`) attaches the JWT and de-duplicates refreshes; `fileApi` sends the same token to the file-server
- Sockets: always `connectSocket()` from `/src/lib/socket.ts` (sends the token)
- Permission checks via `/src/lib/permissions.ts` / `useAuthorization()`; home route per role via `homePathFor()` (`hooks/useScope.ts`)
- Display text: enum labels via `lib/labels.ts`, numbers/units/dates (Kigali time) via `lib/format.ts` — never render raw enum values or ad-hoc `toFixed`
- Metric help: `components/metric-help/` (`<MetricInfo id=…/>` next to every KPI)
- Viewer tools: one vocabulary in `lib/viewer-tools.ts`; measurement maths in `lib/measure/`; model ↔ WGS84 conversion in `lib/geo-bridge.ts`

**Key routes and their heavy components:**
- `/map` — national map (`NationalMap`)
- `/schools/:id/3d-explorer` — three.js 3D viewer (`School3DView.tsx`); `/schools/:id/glb-viewer` redirects here
- `/schools/:id/kmz` — KMZ upload flow (requires `UPLOAD_KMZ` permission)
- `/analytics` — Decision dashboard (requires `VIEW_ANALYTICS` permission)

### Permissions
~37 permissions in `/server/src/common/constants/permissions.constant.ts` (with a descriptive catalogue), mirrored in `client/src/lib/permissions.ts` — keep both in sync. Viewer tools: `USE_MEASURE_TOOLS`, `SAVE_SITE_FEATURES`, `EXPORT_VIEWER_DATA`.

Built-in roles (`DefaultRolePermissions`, National level): `super_admin`, `admin`, `gis_analyst`, `viewer`. Scoped presets (`ScopedRolePresets`): `district_officer` (District), `school_leader` (School). `PATCH /schools/:id` enforces field-level permissions (`schools/school-field-permissions.ts`); users who can't edit a field use "Request a change", which files a `data_change_request` report for the GIS team.

## Key File Locations

| Concern | Path |
|---|---|
| Server entry | `server/src/main.ts` |
| Root NestJS module | `server/src/app.module.ts` |
| DB config | `server/src/config/database.config.ts` |
| School entity (core domain model) | `server/src/modules/schools/entities/school.entity.ts` |
| KMZ processing (most complex) | `server/src/modules/kmz/kmz.service.ts` |
| Decision scoring | `server/src/modules/analytics/scoring-engine.ts` (pure), `scoring.constants.ts`, `analytics.service.ts` (load/persist/overview), `report-stats.ts` (Issue Report figures) |
| Shared HTTP setup (main + e2e) | `server/src/app.setup.ts` |
| Env validation | `server/src/config/env.validation.ts` |
| Audit action registry | `server/src/common/audit/action-registry.ts` |
| Plan / compliance docs | `docs/RTB_MEETING_IMPLEMENTATION_PLAN.md`, `docs/COMPLIANCE_CHECKLIST.md`, `docs/UX_REVIEW.md` |
| Seed data | `server/src/modules/seed/seed.service.ts` |
| Client router | `client/src/App.tsx` |
| Axios + JWT interceptors | `client/src/lib/api.ts` |
| Auth store (Zustand) | `client/src/store/authStore.ts` |
| School form (23KB) | `client/src/components/SchoolForm.tsx` |
| 3D viewer (three.js) | `client/src/components/School3DView.tsx` |
| Vite config + proxies | `client/vite.config.ts` |
| Environment template | `server/.env.example` |
