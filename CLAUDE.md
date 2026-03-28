# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RTB GIS Schools Monitoring & Intelligence System — a geospatial platform for Rwanda's TVET Board to monitor and manage technical/vocational training schools. Core capabilities: school data management, KMZ/KML geospatial processing, 3D visualization (CesiumJS), facility surveys, population analytics, and decision-support scoring.

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
npm run test:e2e              # End-to-end tests
npm run start:prod            # Run built dist/main.js
```

### Client (`/client`):
```bash
npm run build                 # TypeScript check + Vite build
npm run lint                  # ESLint
npm run preview               # Preview production build
```

## Architecture

### Infrastructure
- **PostgreSQL 15 + PostGIS 3.4** — primary database with geospatial extensions
- **Redis 7** — caching (BullMQ queue setup included)
- **MinIO** — S3-compatible object storage for files
- All three run via Docker Compose (`docker-compose.yml`)

### Backend (`/server`) — NestJS modular monolith
- API prefix: `/api/v1`, Swagger docs at `/api/docs`
- Body size limit: 1024MB (for large KMZ/KML files)
- JWT auth: 15-min access tokens + 7-day refresh tokens
- TypeORM with `synchronize: true` in dev, `false` in prod
- DB auto-seeds on startup (admin@rtb.gov.rw / Admin@123)

**Key modules:**
- `AuthModule` — JWT + Passport strategy, login/refresh
- `UsersModule` + `RolesModule` — RBAC with permission arrays on roles
- `SchoolsModule` — core domain; `School` entity has ~50+ fields covering location, classification, facilities, utilities, staff, GIS data, and program data
- `KmzModule` — KMZ/KML file processing (~37KB service); extracts building geometries and boundary polygons, stores as GeoJSON on the School entity
- `AnalyticsModule` — `DecisionAssessment` scoring: infrastructure (40%), building age (30%), accessibility (15%), population pressure (15%)
- `PopulationModule` — ArcGIS integration (currently mocked) for population density data
- `StorageModule` — abstraction over local filesystem + MinIO
- `SeedModule` — runs `OnModuleInit`, creates default roles, admin user, and sample schools

### Frontend (`/client`) — React 19 + TypeScript + Vite
- Client dev proxy: `/api` → `localhost:3001`, `/minio` → `localhost:9000`
- Auth state in Zustand (`/src/store/authStore.ts`) persisted to localStorage
- Axios instance (`/src/lib/api.ts`) handles JWT attachment and token refresh
- Permission checks via `/src/lib/permissions.ts`

**Key routes and their heavy components:**
- `/map` — Leaflet-based national map (`NationalMap`)
- `/schools/:id/3dview` — CesiumJS 3D viewer (`School3DView.tsx`, 44KB)
- `/schools/:id/kmz` — KMZ upload flow (requires `UPLOAD_KMZ` permission)
- `/analytics` — Decision dashboard (requires `VIEW_ANALYTICS` permission)

### Permissions
Defined in `/server/src/common/constants/permissions.constant.ts`:
`MANAGE_USERS`, `VIEW_USERS`, `MANAGE_SCHOOLS`, `UPLOAD_KMZ`, `VIEW_ANALYTICS`, `MANAGE_DECISIONS`, `EXPORT_REPORTS`

Default roles: `super_admin` (all), `admin` (all except MANAGE_USERS), `gis_analyst` (MANAGE_SCHOOLS + UPLOAD_KMZ + VIEW_ANALYTICS), `viewer` (VIEW_ANALYTICS only)

## Key File Locations

| Concern | Path |
|---|---|
| Server entry | `server/src/main.ts` |
| Root NestJS module | `server/src/app.module.ts` |
| DB config | `server/src/config/database.config.ts` |
| School entity (core domain model) | `server/src/modules/schools/entities/school.entity.ts` |
| KMZ processing (most complex) | `server/src/modules/kmz/kmz.service.ts` |
| Decision scoring | `server/src/modules/analytics/analytics.service.ts` |
| Seed data | `server/src/modules/seed/seed.service.ts` |
| Client router | `client/src/App.tsx` |
| Axios + JWT interceptors | `client/src/lib/api.ts` |
| Auth store (Zustand) | `client/src/store/authStore.ts` |
| School form (23KB) | `client/src/components/SchoolForm.tsx` |
| 3D viewer (CesiumJS, 44KB) | `client/src/components/School3DView.tsx` |
| Vite config + proxies | `client/vite.config.ts` |
| Environment template | `server/.env.example` |
