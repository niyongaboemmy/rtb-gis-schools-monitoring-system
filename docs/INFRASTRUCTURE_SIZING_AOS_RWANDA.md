# TVET 3D GIS — Production Infrastructure Sizing for AOS Rwanda

**Prepared:** 16 October 2026 · **Scope:** hosting the full platform (client, API, file service, processing, database, object storage) at AOS Ltd / the National Data Centre, Kigali
**Audience:** RTB ICT leadership, AOS solution architects, and the platform engineering team

---

## 0. Executive summary

| Target | Value |
|---|---|
| Schools | 1,000 |
| Data per school | 3 GB min · 8 GB max (KMZ, GLB 3D models, drone orthophotos) |
| Concurrent realtime users | > 100,000 |
| Concurrent uploads and processing | > 50 schools |

**Key findings**

1. **The current code base cannot handle these file sizes on any hardware.** Several stages read the whole file into memory with `fs.readFileSync`, and Node.js refuses that call for any file over 2 GiB (`ERR_FS_FILE_TOO_LARGE`; verified on Node). Every school in scope is between 3 and 8 GB. On top of that:
   - Upload limits are set at 2 GB on the API and about 6 GB on the file server.
   - Processing runs **one job at a time**, inside the API process.
   - Realtime connections are pinned to **one Node process**.

   Section 3 lists the engineering changes that must ship *before* or *with* the new hardware. Without them, bigger servers buy almost nothing.
2. **AOS's catalogue cloud VMs are too small.** The largest published size is 4 vCPU / 12 GB RAM / 300 GB. Standard colocation includes only **10 Mbps** of bandwidth. RTB therefore needs one of two things:
   - **(A)** RTB-owned servers colocated in a full rack at AOS, with a negotiated 10 Gbps port; or
   - **(B)** a custom private-cloud / IaaS quotation from AOS that matches the VM table in §6.3.
3. **Hosting in Rwanda is the right call.** Law N° 058/2021, Art. 50, requires personal data to be stored in Rwanda unless NCSA authorises otherwise. Most users are on Rwandan networks, which can be served over the local exchange (RINEX). Today's server is AWS eu-north-1 (Stockholm) and delivers about 1–2 MB/s to users.

**Recommended production environment (high availability, meets every target with headroom)**

| | |
|---|---|
| Servers | **15 at the primary site + 1 backup server at a secondary site** |
| Compute | about **480 physical CPU cores (960 threads)** and **≈ 4.5 TB RAM** in total |
| Object storage | **46 TB usable** (all-NVMe, erasure-coded, expandable) |
| Database storage | **7.7 TB usable** |
| Backup capacity | **≈ 160 TB** at the secondary site |
| Network | 2 × 25 GbE per server; **10 Gbps** internet port with **≥ 3 Gbps committed** |
| Rack | one 42U rack at **≈ 10 kW**, with A+B power feeds |

**Minimum environment (meets the targets, no high availability)**

| | |
|---|---|
| Servers | **4 + 1 off-site backup** |
| Compute | about **190 cores** and **≈ 1.2 TB RAM** |
| Object storage | **≈ 48 TB usable** (HDD RAID 6) |
| Network | **1–2 Gbps** committed |

What the minimum gives up:
- Any server failure takes the platform down until it is repaired. Expected RTO is hours to a day.
- 50 simultaneous uploads are accepted at once but processed in about 4 waves (about 1.5–2 h for the batch).

---

## 1. Workload model and assumptions

| Parameter | Value used | Basis |
|---|---|---|
| Schools | 1,000 | requirement |
| Raw upload per school | 3 / 5.5 (planning average) / 8 GB | requirement |
| Re-survey growth | about 30 % of schools re-surveyed per year, previous version kept | assumption; adjust to the RTB survey plan |
| Planning horizon | 3 years | standard hardware lifecycle |
| Concurrent connected users | 100,000 (each holds one WebSocket) | requirement |
| HTTP request rate | 1 request / 20 s per user on average → **5,000 req/s sustained, 15,000 req/s peak** (×3) | dashboard / map usage pattern (assumption) |
| Users viewing a 3D model | 2 % of users open a model every 10 min; optimised GLB about 40 MB | `docs/3d-viewer-performance.md`: 487 MB raw → 16 MB optimised (≈ 30×) |
| Users panning drone tiles | 5 % at about 50 KB/s average | assumption |
| Concurrent uploads | 50 at 8 GB = **400 GB arriving at once** | requirement |
| School uplink | 20–50 Mbps | typical Rwandan business fibre / 4G (assumption) |

> All capacity numbers below come from these assumptions. They must be confirmed with the load-test plan in §9 before hardware is ordered.

---

## 2. How the application behaves today (code analysis)

### 2.1 Today's production footprint
- One AWS EC2 **t3.large** (2 vCPU / 8 GiB RAM, 60 GiB gp3 disk, 4 GiB swap) in eu-north-1.
- PostgreSQL + PostGIS, Redis (512 MB), the API, the file server and nginx all run on that one box (`deploy/README.md`).
- Processes run under PM2 in fork mode, **1 instance each** (`deploy/ecosystem.config.js`).

### 2.2 Request and data flow

```
Browser ──HTTPS──▶ nginx ──▶ rtb-api (NestJS, :3001)  ──▶ PostgreSQL/PostGIS
                     │              │  └─ BullMQ worker (in-process, concurrency 1) ──▶ glb optimiser child process
                     │              └─ Socket.IO (in-memory adapter)
                     └──▶ rtb-file-server (Express, :3002) ──▶ local disk /var/lib/rtb/storage
```

Upload sequence (`client/src/pages/KmzUpload.tsx`):
1. The browser sends one XHR multipart POST to the file server.
2. The browser then calls `POST /schools/:id/kmz/from-url`.
3. The API **downloads the file again inside that HTTP request** (`kmz.service.ts:1710-1874`, up to 10 min).
4. The API enqueues a job.
5. The job `readFileSync`s the whole file (`kmz.service.ts:175`, `:1519`, `:1934`), unzips it in memory with JSZip, tiles large images with `sharp`, and writes **whole Buffers** to storage (`storage.service.ts:46-61, 131-152`).

### 2.3 Hard limits that block the target workload

| # | Limit in the code | Location | Effect at 3–8 GB / 50 jobs / 100k users |
|---|---|---|---|
| 1 | `fs.readFileSync` rejects files > 2 GiB | `kmz.service.ts:175, 1519, 1934` | **Every 3–8 GB GLB/KMZ job fails.** Reproduced: `ERR_FS_FILE_TOO_LARGE` |
| 2 | JSZip / `unzipper` over an in-memory Buffer | `kmz.service.ts:1318-1373, 2076` | Same 2 GiB ceiling, and RAM use of 2–3× the file size |
| 3 | Storage API takes a whole `Buffer` (local and MinIO) | `storage.service.ts` | No streaming, so each job's RAM equals the file size |
| 4 | Upload caps: API multer 2 GB; file server 6,000 MB in production; `KMZ_MAX_DOWNLOAD_MB` 6,144; zip-bomb cap 8 GB uncompressed | `kmz.module.ts:28-41`, `deploy/README.md:467`, `upload-validation.ts:185-195` | 6–8 GB schools are rejected |
| 5 | Single-request upload, no resume | `KmzUpload.tsx:100-155` | An 8 GB upload at 20 Mbps takes **about 55 min**. Any drop means starting again |
| 6 | Re-download happens inside the HTTP request; the staging copy is never deleted | `kmz.service.ts:1710-1874` | Each upload is stored about 3×; API connections are held for up to 10 min |
| 7 | BullMQ worker concurrency is 1, inside the API process | `kmz.processor.ts:29` | 50 uploads run **one after another**. Processing load competes with user traffic |
| 8 | GLB optimiser loads the whole mesh (gltf-transform) | `glb-tools/optimize.mjs:99`, `glb-optimizer.ts:146-152` | A 2 GB / 80M-triangle GLB already OOM-kills an 8 GB box. More than about 2 GB needs out-of-core tiling |
| 9 | No GDAL / COG pipeline; `sharp` skips TIFF | `kmz.service.ts:2138-2170` | Multi-GB GeoTIFF orthophotos are not tiled |
| 10 | 2D viewer downloads the **entire KMZ into the browser** and unzips it there | `docs/drone-image-progressive-loading.md` §1 | A 3–8 GB file cannot be opened in a browser tab |
| 11 | 3D viewer loads one whole GLB into a `Uint8Array`, with `cache: "no-cache"` | `School3DView.tsx:851-890` | Re-downloads every visit; browser memory limit for large models |
| 12 | Socket.IO in-memory adapter; client starts on long-polling | `events.gateway.ts`, `client/src/lib/socket.ts:14` | All 100k sockets must sit on one process (realistically 10–30k max) |
| 13 | DB lookup on every socket handshake | `events.gateway.ts:66-87` | A reconnect storm sends about 100k queries within seconds |
| 14 | Throttler: in-memory, 200 req/min **per IP** | `app.module.ts:53-56` | Schools behind one NAT IP get throttled; limits are not shared across nodes |
| 15 | `@Cron` jobs inside the API | glb-reoptimize, population, audit services | Would run N times on N replicas |
| 16 | Local-disk storage; file server lists the disk with `readdirSync` | `storage.service.ts`, `file-server/server.js:176-189` | No shared storage, so no second node possible |
| 17 | DB pool is 10, no PgBouncer | `database.config.ts:48-51` | Saturates at a few hundred req/s |
| 18 | No API caching; analytics recomputed on every request | `analytics.service.ts` | Decision dashboard × 100k users ≈ the database's whole capacity |
| 19 | JS bundle is a single 8.8 MB chunk; gzip leaves out `text/javascript` | `vite.config.ts`, nginx conf | About 0.8 Gbps just for first loads at peak |
| 20 | `/api/v1/health` does not check the DB or Redis | `app.controller.ts:14-21` | A load balancer cannot detect a sick node |
| 21 | Node.js 20 runtime | `deploy/README.md:192`, `ci.yml:76` | **Node 20 went end-of-life in April 2026.** Move to Node 22/24 LTS |

### 2.4 What happens if the current code is moved, unchanged, onto big hardware

| Subsystem | Behaviour on a 64-core / 512 GB server |
|---|---|
| Uploads of 3–8 GB | Fail at the 2 GB / 6 GB caps or at `readFileSync`. **About 0 % success** for files larger than 2 GiB |
| 50 concurrent uploads | Accepted by the file server, then processed **one at a time** (≈ hours to days for the batch). Disk fills about 3× faster than the data volume |
| Realtime users | One Node process uses about **1.5 of 64 cores**. Expect degradation from about 10–30k sockets, then event-loop stalls and API timeouts |
| Analytics / dashboards | Pool of 10 DB connections means queueing beyond about 300–800 req/s |
| Overall | **Roughly 1–3 % of the server would be used.** The fixes in §3 are the real capacity lever |

---

## 3. Required application changes (prerequisites for the new hardware)

Ordered by priority. **P0** must ship before go-live; **P1** must ship before passing about 20k users.

### P0 — large files
1. **Resumable, chunked uploads straight to object storage.** Use S3 multipart with presigned part URLs (for example Uppy + `@uppy/aws-s3`) or a tus server. Use 64–128 MB parts, retry per part, and verify a checksum. Remove the `from-url` re-download and the staging copy.
2. **Streaming I/O end to end.**
   - Replace `readFileSync`, JSZip and Buffer-based `putObject` with streams.
   - Use `yauzl` (random-access unzip from disk) to extract KMZ entries one at a time into the job's scratch directory.
   - Upload outputs with streamed multipart `putObject`.
3. **Raise limits to ≥ 10 GB** (file size, download size, uncompressed total), keeping the ratio-based zip-bomb check.
4. **Orthophoto pipeline with GDAL** (container or `gdal-bin`). Convert GeoTIFF/JPEG overlays to **COG** plus XYZ **WebP tiles** (z15–z21). The 2D viewer then requests tiles only and never downloads the KMZ (§2.3 #10). This is "Tier 2/3" in `docs/drone-image-progressive-loading.md`.
5. **3D pipeline for large models.**
   - Keep Meshopt optimisation for GLBs up to about 2 GB.
   - For larger meshes, require **Cesium 3D Tiles / tiled exports** from Metashape/ODM, or split them server-side (out-of-core). Serve them streamed rather than as one GLB.
   - Target **≤ 150 MB** per served model, which is the safe browser-memory limit on mid-range laptops.
6. **Separate processing worker service.**
   - Same codebase, `WORKER_MODE=true`, no HTTP listener.
   - BullMQ `concurrency` set per node (§6). Jobs are idempotent, with retries and stall detection.
   - Per-job scratch on local NVMe, cleaned up in `finally`.

### P0 — horizontal scale
7. **Shared object storage only.** Switch `STORAGE_BACKEND` to S3-compatible storage. Drop the disk-walking code (`readdirSync`, the re-optimize sweep). Serve files through nginx caching or presigned URLs, not through Node.
8. **Socket.IO Redis adapter** (`@socket.io/redis-adapter`, or the sharded-pub/sub adapter). Configure the client with `transports: ['websocket']`, so no sticky sessions are needed, and add randomised reconnect back-off. Cache the authenticated user in Redis for the handshake.
9. **Redis-backed throttler with per-user limits.** Key on JWT `sub` and use per-IP only for anonymous routes. Set `TRUST_PROXY` to the load-balancer addresses.
10. **Leader-only cron.** Move `@Cron` tasks to BullMQ repeatable jobs, which run exactly once across the cluster.
11. **PgBouncer** in transaction mode, with a pool of about 10–20 per Node process.
12. **Redis cache for analytics and national KPIs** (TTL 60–300 s), invalidated on `scores:updated`.
13. **Deep health and readiness endpoints** that check the DB, Redis and storage, so the load balancer and orchestrator can act on them.

### P1 — delivery efficiency
14. Route-level code splitting so Cesium, three.js and OpenLayers load only where needed. Brotli/gzip for `text/javascript`, `application/wasm` and `model/gltf-binary`. HTTP/2.
15. Content-hashed, immutable URLs for GLBs and tiles (`Cache-Control: public, max-age=31536000, immutable`). Remove `cache: "no-cache"`.
16. Build in CI and ship artefacts. Stop building on the production host.
17. Load-test the audit hash-chain insert path. A strictly sequential chain can become a single-writer bottleneck at hundreds of writes per second. If it does, batch per time window.
18. Esri / OSM basemaps are fetched directly by browsers. Confirm the licence and rate limits for about 100k users. Optionally self-host a Rwanda **PMTiles** basemap (`scripts/download-rwanda-map.sh` is a placeholder for this).
19. Upgrade to Node.js 22/24 LTS. Plan PostgreSQL 15 → 17 (PG 15 is supported until Nov 2027).

---

## 4. Capacity calculations

### 4.1 Storage

**How many copies each upload produces**

| Item | Current pipeline | Fixed pipeline (§3) |
|---|---|---|
| Original upload | 1.0× | 1.0× |
| File-server staging copy (never deleted) | 1.0× | — |
| Extracted KMZ contents | about 1.0× | about 0.2× (only what the viewer needs) |
| Image tiles / COG | about 0.3–0.6× | about 0.3× (WebP) |
| GLB optimised plus `_source` copy | about 0.05× | about 0.05× |
| **Total stored per GB uploaded** | **≈ 3.4×** | **≈ 1.5×** |

**Totals for 1,000 schools**

| Scenario | Raw | Current pipeline | Fixed, year 1 | Fixed, year 3 (re-surveys) |
|---|---|---|---|---|
| Minimum (3 GB) | 3 TB | 10 TB | 4.5 TB | 8.6 TB |
| Planning average (5.5 GB) | 5.5 TB | 19 TB | 8.3 TB | 15.7 TB |
| **Maximum (8 GB)** | **8 TB** | **27 TB** | **12 TB** | **≈ 23 TB** |

Usable storage needed: 23 TB ÷ 0.80 fill factor = **≈ 29 TB usable** in the 3-year worst case. The recommended object store provides **46 TB usable** and can be expanded by adding a second server pool.

**Other storage**

| Item | Size |
|---|---|
| Processing scratch | 50 jobs × 8 GB × about 5 (input, extraction, intermediates, outputs) = **2 TB** across workers |
| Database | School rows hold JSONB manifests/GeoJSON (MBs per school); `audit_logs` grows with 100k users. **< 1 TB in 3 years.** Provision 7.7 TB NVMe for WAL, replicas, index rebuilds and `pg_dump` staging |
| Backup | Full object copy (≈ 23–29 TB) + 30-day versioning (+30 %) + database base backups and WAL (≈ 3 TB) = **≈ 45 TB minimum**. Provision **≈ 160 TB raw HDD** for the 3-year horizon |

### 4.2 Processing (50 simultaneous schools)

**Resources per job slot (fixed pipeline)**

| Stage | CPU | RAM | Notes |
|---|---|---|---|
| Streamed unzip + validation | 1 core | < 1 GB | I/O-bound |
| GDAL COG + tiling (1–5 GB orthophoto) | 4 cores | 8–16 GB (`GDAL_CACHEMAX`) | out-of-core |
| Meshopt GLB optimisation (≤ 2 GB GLB) | 2–6 cores | **up to 24 GB** | in-memory mesh; WebP texture encoding is CPU-heavy |
| **Slot budget** | **6 vCPU** | **32 GB** | **60 GB NVMe scratch** |

| Concurrency | vCPU | RAM | Estimated wall time for 50 schools* |
|---|---|---|---|
| **50 slots (target)** | 300 | 1.6 TB | about 30–45 min after uploads land |
| 16 slots (minimum tier) | 96 | 512 GB | about 1.5–2 h |
| 8 slots | 48 | 256 GB | about 3–4 h |
| 1 slot (today) | 2 | 8 GB | about 1–2 days, if files under 2 GB at all |

\* Assumes about 20–40 min per 8 GB school. The measured figure is 20–25 s for a 487 MB GLB; GDAL tiling time grows with pixel count. **Validate in the §9 load test.**

**GPU is not required.** Meshopt, sharp/libvips and GDAL are all CPU workloads. Add NVIDIA GPU nodes (for example L40S-class) only if RTB later runs **photogrammetry** (Metashape / OpenDroneMap) server-side.

### 4.3 Application and realtime tier (100k users)

**Sockets**
- 100k WebSockets × about 30–50 KB per Socket.IO connection ≈ **3–5 GB RAM**.
- At about 8–10k sockets per Node process that is **10–12 processes**.

**HTTP**
- Peak is 15,000 req/s.
- A NestJS process doing DB-backed requests handles about 800–1,500 req/s.
- That needs **10–19 processes at peak**.

**Design:** 3 nodes × 32 cores, each running about 16 API processes + 8 socket-gateway processes (PM2 cluster or systemd instances). That is **72 processes in total**, and it survives the loss of one node at about 60 % utilisation.

**Kernel / OS settings**
- `nofile` ≥ 1,048,576.
- `net.core.somaxconn` 65535.
- `net.ipv4.ip_local_port_range` 1024–65535.
- Several backend ports per node, so the load balancer is not limited by the 64k-ports-per-destination ceiling.

### 4.4 Database

| Load | Estimate |
|---|---|
| Queries at peak | about 15k req/s × 1.5 ≈ **20–25k QPS**, mostly indexed point reads. Analytics are moved to cache and a read replica |
| Audit writes | about 5 % mutating requests ≈ **750 writes/s** |

A 32-core / 256 GB primary with NVMe RAID 10 handles this comfortably behind PgBouncer.

**Starting configuration (256 GB node)**
- `shared_buffers` 64 GB
- `effective_cache_size` 192 GB
- `work_mem` 64 MB
- `maintenance_work_mem` 4 GB
- `max_connections` 400 (PgBouncer in front)
- `random_page_cost` 1.1
- `max_wal_size` 16 GB
- `wal_compression` on

### 4.5 Network bandwidth

| Flow | Peak estimate |
|---|---|
| API JSON + sockets (100k × ~20 kbps) | about 2.0 Gbps |
| 3D model delivery (2,000 opens / 10 min × 40 MB) | about 1.1 Gbps |
| Drone tile delivery (5,000 users × 50 KB/s) | about 2.0 Gbps |
| App first loads (10k in 5 min × 3 MB compressed) | about 0.8 Gbps |
| **Egress total (peak)** | **≈ 5–6 Gbps** |
| Upload ingress (50 × 50 Mbps) | about 2.5 Gbps |
| Replication to DR site | 0.5–1 Gbps continuous |

**Recommendation**
- **10 Gbps** port.
- **≥ 3 Gbps committed** with burst to 10 Gbps.
- **RINEX peering** so traffic to Rwandan ISPs stays local and cheap.
- **Dual upstream carriers.** A third-party review lists only one visible AOS upstream (KT Rwanda, AS37228).

**Minimum tier:** 1–2 Gbps committed (about 20–40k actively-browsing users before tile and model delivery slows).

Basemap imagery (Esri / OSM) goes from users straight to those providers and is **not** counted above.

---

## 5. Target architecture

```
                    Internet / RINEX (10 Gbps, dual upstream)
                                   │
                     ┌─────────────┴─────────────┐
                     │  HA firewall pair (≥10G)  │
                     └─────────────┬─────────────┘
                 ┌─────────────────┴──────────────────┐
                 │ EDGE ×2  HAProxy + nginx cache      │  TLS, WebSocket LB, static/GLB/tile cache (NVMe)
                 │          keepalived VIP             │
                 └───────┬───────────────────┬────────┘
            ┌────────────┴───────┐     ┌─────┴──────────────┐
            │ APP ×3 (VMs)       │     │ SOCKET gateway     │  Socket.IO + Redis adapter
            │ NestJS API cluster │     │ (on APP nodes)     │
            └──┬────────┬────────┘     └─────────┬──────────┘
               │        │                        │
   ┌───────────┴──┐  ┌──┴─────────────────┐  ┌───┴──────────────┐
   │ PgBouncer ►  │  │ Redis Sentinel ×3  │  │ WORKERS ×3        │  BullMQ, GDAL, Meshopt
   │ Patroni PG×3 │  │ queue + cache/pubsub│  │ 50+ job slots     │  local NVMe scratch
   │ PostGIS      │  └────────────────────┘  └───┬──────────────┘
   └──────┬───────┘                              │
          │          ┌───────────────────────────┴───┐
          │          │ OBJECT STORAGE ×4 (S3 API)     │  erasure-coded, 46 TB usable
          │          └───────────────┬────────────────┘
          └───────── pgBackRest ─────┴── replication ──▶  BACKUP / DR site (≈160 TB)
```

### Software stack

| Layer | Choice |
|---|---|
| OS | Ubuntu Server 24.04 LTS (kernel 6.8+) |
| Virtualisation (app/edge/Redis/monitoring nodes) | Proxmox VE or VMware, or AOS private cloud |
| Workers, database, storage | Bare metal (predictable I/O) |
| Runtime | Node.js 22/24 LTS under PM2 cluster or systemd; optionally containers (Docker + Nomad/K3s) later |
| Database | PostgreSQL 15→17 + PostGIS 3.4/3.5; Patroni + etcd (3) for automatic failover; PgBouncer; pgBackRest with WAL archiving (**RPO ≈ minutes**, better than today's 24 h) |
| Redis | 7.x with Sentinel (BullMQ works best on Sentinel, not Redis Cluster). Two logical instances: `redis-queue` (AOF, `noeviction`) and `redis-cache` (`allkeys-lru`, pub/sub, throttler) |
| Object storage (S3 API; the app already uses the `minio` client) | MinIO **community edition went source-only in Oct 2025 and its repository has since been archived**, so do not deploy unpatched community binaries. Options: **(a) MinIO AIStor** (commercial subscription; supports the 4-node design as-is); **(b) Ceph RGW** (open source; plan **6 storage nodes** for EC 4+2 with host failure domain); **(c) SeaweedFS / Garage** (lighter, smaller ecosystem) |
| Processing | GDAL 3.8+, libvips/sharp, gltf-transform + Meshopt, run as BullMQ workers |
| Edge | HAProxy 2.8+ (TLS, WebSocket, health checks) + nginx (`proxy_cache` on NVMe for GLBs/tiles/static, Brotli, HTTP/2) |
| Observability | Prometheus + node/pg/redis exporters, Grafana, Loki, Alertmanager, Uptime-Kuma; BullMQ dashboard |
| Security | HA firewall, WAF rules at the edge, bastion/VPN only for admin access, Vault or sops for secrets, CIS-hardened OS, disk encryption on DB/storage |

---

## 6. Recommended production specification (high availability)

### 6.1 Physical bill of materials (primary site)

Reference platforms: Dell PowerEdge R6625/R7625, HPE ProLiant DL365/DL385 Gen11, Lenovo ThinkSystem SR645/SR665 V3, or equivalent. CPUs are AMD EPYC 9004/9005 or Intel Xeon 6 with equal core counts.

| Role | Qty | CPU (per server) | RAM (per server) | Storage (per server) | Network | Size |
|---|---|---|---|---|---|---|
| **Edge / load balancer / cache** | 2 | 1 × 16-core (e.g. EPYC 9124 / 9135), ≥ 3.0 GHz | 64 GB DDR5 ECC | 2 × 480 GB SSD (boot, RAID 1) + 2 × 3.84 TB NVMe (nginx cache) | 2 × 25 GbE | 1U |
| **Application hypervisor** (API, socket gateway, Redis ×3, monitoring, CI runner VMs) | 3 | 1 × 32-core (e.g. EPYC 9354P / 9355P) | 256 GB DDR5 ECC | 2 × 960 GB SSD (boot, RAID 1) + 2 × 3.84 TB NVMe (VM store) | 2 × 25 GbE | 1U |
| **Processing worker** | 3 | 2 × 32-core (64 cores / 128 threads, e.g. 2 × EPYC 9354) | **768 GB** DDR5 ECC (24 × 32 GB) | 2 × 480 GB SSD (boot) + 2 × 7.68 TB NVMe (scratch, RAID 0) | 2 × 25 GbE | 2U |
| **Database** (Patroni primary, sync standby, async read replica) | 3 | 1 × 32-core, high clock (e.g. EPYC 9354P / 9355P) | 256 GB DDR5 ECC | 2 × 480 GB SSD (boot) + 4 × 3.84 TB NVMe mixed-use (RAID 10 → 7.68 TB) | 2 × 25 GbE | 1U |
| **Object storage** | 4 | 1 × 16–24-core (AVX2; e.g. EPYC 9124 / 9224) | 128 GB DDR5 ECC | 2 × 480 GB SSD (boot) + 4 × 3.84 TB NVMe read-intensive (**10+ free NVMe bays** for growth) | 2 × 25 GbE (100 GbE optional) | 1U |
| **Top-of-rack switches** | 2 | — | — | — | 48 × 25 GbE + 6 × 100 GbE, MLAG | 1U each |
| **Management switch** | 1 | — | — | — | 48 × 1 GbE (iDRAC/iLO/IPMI) | 1U |
| **Firewall** | 2 (HA) | — | — | — | ≥ 10 Gbps threat-protection throughput, 10/25G ports | 1U each |

**Primary-site totals**

| | |
|---|---|
| Servers | 15 |
| Physical cores | 2×16 + 3×32 + 3×64 + 3×32 + 4×16 = **480 cores (960 threads)** |
| RAM | 2×64 + 3×256 + 3×768 + 3×256 + 4×128 = **4.5 TB** |
| NVMe | ≈ 140 TB raw |
| Rack space | about 22U of servers + 6U of network → **one 42U rack** |
| Power | about 7.5 kW typical, **≈ 10 kW provisioned** (2 × 32 A A+B feeds) |

**Secondary / DR site** (separate facility, at least another building; ideally a different Kigali data centre or AOS's DR facility)

| Role | Qty | CPU | RAM | Storage | Network |
|---|---|---|---|---|---|
| **Backup + DR target** | 1 (2 recommended) | 1 × 16-core | 128 GB | 2 × 480 GB SSD + **12 × 16 TB enterprise HDD, RAID 6 (≈ 160 TB usable)** | 2 × 10/25 GbE |

Jobs on the DR site:
- pgBackRest repository
- Object-storage replication target (bucket replication or `rclone`/`restic` incremental)
- Optional warm-standby database

### 6.2 Capacity this environment delivers

| Requirement | Delivered |
|---|---|
| 100k concurrent realtime users | ✅ About 150k sockets / 25k req/s design capacity; survives one app-node loss at 100k |
| 50+ uploads and processing at once | ✅ 3 workers × about 21 slots (6 vCPU / 32 GB) = **≈ 63 slots**; still about 42 with one worker down |
| 3–8 GB per school, 1,000 schools | ✅ 46 TB usable, versus 12 TB (year 1) and ≈ 23 TB (year 3) worst case |
| High performance | ✅ All-NVMe hot path, local NVMe edge cache, 25 GbE fabric, read replica for analytics |
| Availability | ≈ 99.9 % design (no single point of failure inside the site); the AOS facility SLA is 99.5 % |
| Recovery | RPO ≈ 5 min (WAL archiving), RTO ≈ 1 h (Patroni failover is automatic) |

### 6.3 Equivalent VM shapes (Option B: AOS private cloud / custom IaaS quotation)

| VM | Count | vCPU | RAM | Disk | Notes |
|---|---|---|---|---|---|
| edge-lb | 2 | 8 | 32 GB | 100 GB + 2 TB NVMe cache | 10 Gbps vNIC, public VIP |
| app-api | 3 | 16 | 64 GB | 100 GB | API processes |
| app-socket | 3 | 8 | 32 GB | 50 GB | Socket.IO gateway |
| worker | 6 | 48 | 384 GB | 100 GB + 4 TB **local NVMe** scratch | **CPU-dedicated (no over-commit)** |
| db | 3 | 32 | 256 GB | 8 TB NVMe-backed, ≥ 50k IOPS | dedicated host or anti-affinity |
| redis | 3 | 8 | 32 GB | 100 GB | Sentinel |
| pgbouncer / etcd | 3 | 4 | 8 GB | 50 GB | can share with Redis VMs |
| monitoring | 1 | 8 | 32 GB | 2 TB | Prometheus/Loki retention |
| ci-runner / bastion | 2 | 8 | 16 GB | 200 GB | |
| object storage | — | — | — | **≥ 46 TB usable S3-compatible service** | if AOS offers S3 object storage; otherwise 4 storage VMs with dedicated disks |
| **Total** | 26 | **≈ 520 vCPU** | **≈ 3.9 TB** | ≈ 46 TB object + ≈ 50 TB block | anti-affinity across ≥ 3 hosts |

---

## 7. Minimum specification (meets the targets, no high availability)

For a phased start or a tight budget. It handles the stated load, but **every server is a single point of failure**.

| Role | Qty | CPU | RAM | Storage | Network |
|---|---|---|---|---|---|
| **Edge + app + Redis** (nginx, 32 API/socket processes, Redis) | 1 | 2 × 32-core (64 cores) | 256 GB | 2 × 1.92 TB NVMe RAID 1 + 1 × 3.84 TB NVMe (cache) | 2 × 25 GbE |
| **Database** (PostgreSQL + PostGIS + PgBouncer) | 1 | 1 × 32-core | 256 GB | 4 × 3.84 TB NVMe RAID 10 | 2 × 25 GbE |
| **Processing worker** | 1 | 2 × 32-core (64 cores / 128 threads) | 512 GB | 2 × 7.68 TB NVMe scratch | 2 × 25 GbE |
| **Object storage** (single-node S3, e.g. SeaweedFS or MinIO AIStor single-node) | 1 | 1 × 16-core | 128 GB | 8 × 8 TB enterprise HDD RAID 6 (**≈ 48 TB usable**) + 2 × 1.92 TB NVMe (metadata/cache) | 2 × 25 GbE |
| **Off-site backup** | 1 | 1 × 8–16-core | 64 GB | 8 × 16 TB HDD RAID 6 (≈ 96 TB) | 10 GbE |

**Totals:** 4 primary servers + 1 backup server · **≈ 190 cores** · **≈ 1.2 TB RAM** · ≈ 48 TB object + 7.7 TB DB · ≈ 3.5 kW · 1–2 Gbps committed bandwidth.

| Requirement | Minimum-tier result |
|---|---|
| 100k concurrent users | ⚠️ About 100k sockets possible on 64 cores; HTTP peak of about 15k req/s is near the limit. No failover |
| 50 simultaneous uploads | ⚠️ All 50 **accepted** at once (resumable uploads); **16 processed in parallel**, about 1.5–2 h for the batch |
| Storage | ✅ 48 TB usable on HDD (slower first-byte times for cold files; the edge NVMe cache hides most of this) |
| Recovery | ❌ RPO ≈ 5 min (WAL to off-site); **RTO = hardware repair time (hours to a day)** |

### Reference: what today's server supports

The current t3.large (2 vCPU / 8 GB / 60 GB) supports roughly:
- a few hundred concurrent users;
- one processing job at a time;
- about 7–20 schools' worth of storage;
- **no files larger than 2 GiB**.

It is not a viable base for the target.

---

## 8. AOS Rwanda — procurement notes

| Topic | What is known | Action |
|---|---|---|
| Provider | AOS Ltd: Government of Rwanda / KT joint venture (2014), operator of the National Data Centre, Kigali; offers cloud, colocation, backup-as-a-service and DR | — |
| Catalogue cloud VMs | 7 sizes from 1 vCPU / 1 GB / 50 GB up to **4 vCPU / 12 GB / 300 GB**, RWF 26,275–95,388 / month, 200 GB egress each; custom sizes by quotation (third-party listing) | **Too small.** Request a custom quotation for the §6.3 shapes, with dedicated (non-over-committed) CPU for workers and DB, and NVMe-backed storage |
| Colocation | 1U from RWF 75,000 / month; 6U RWF 360,000; quarter, half and full rack by quotation; **standard bandwidth 10 Mbps** | Request a **full 42U rack, 10 kW, A+B feeds**, a 10 Gbps port with ≥ 3 Gbps committed, and RINEX peering |
| SLA | 99.5 % monthly, 3 h repair target, credits capped at 10 % | Negotiate 99.9 %+ for power/network, plus remote hands 24/7 |
| Network | One visible upstream (KT Rwanda, AS37228) | Ask for **multi-carrier** transit (e.g. Liquid, MTN, Airtel/BSC) and confirm the RINEX port |
| Object storage | No public S3 offer found | Ask whether AOS provides S3-compatible storage; otherwise self-host (§5) |
| DR | AOS lists a DR facility | Use it (or a second Kigali DC) for the backup server in §6.1 |
| Compliance | Law 058/2021 Art. 50 (data localisation, NCSA) | Hosting at AOS satisfies localisation; register as a data controller/processor with NCSA/DPO |

> Prices come from third-party listings and older press. Get a written quotation from AOS (toll-free 4747) before budgeting.

---

## 9. Validation and load-test plan (before ordering, and again before go-live)

1. **Upload soak:** 50 parallel resumable uploads of 8 GB synthetic KMZ/GLB/GeoTIFF from about 5 load generators, throttled to 20–50 Mbps each. Pass criteria: 100 % completion, resume after a forced disconnect, no API latency regression.
2. **Processing benchmark:** a single-slot run on real school data to measure CPU-minutes and peak RSS per stage. This sets the slot size in §4.2 (6 vCPU / 32 GB) and the final worker count.
3. **Realtime:** k6/Artillery, distributed (10+ generators): ramp to 120k WebSockets plus 15k req/s mixed API traffic. Pass criteria: p95 API < 300 ms, socket event fan-out < 1 s, no event-loop lag > 100 ms.
4. **Reconnect storm:** drop the edge VIP so 100k clients reconnect. The DB must stay under 70 % CPU (this verifies the handshake cache and back-off).
5. **Failover drills:** kill the DB primary (Patroni), one app node, one storage node and one worker during the soak. Pass criteria: no data loss and failed jobs auto-retried.
6. **Restore drill:** restore DB and storage from the DR site into an isolated environment and time it against RTO/RPO (see `docs/BACKUP_AND_DR.md`).

---

## 10. Phased rollout

| Phase | Weeks | Deliverables |
|---|---|---|
| 0. Quotation and procurement | 0–6 | AOS rack/bandwidth or private-cloud quotation; hardware order (EPYC servers typically ship in 4–8 weeks) |
| 1. Application changes P0 (§3 items 1–13) | 0–8, in parallel | Streaming pipeline, resumable uploads, GDAL tiling, worker service, Redis adapter, S3 storage, PgBouncer, caching |
| 2. Build the environment | 6–10 | Rack and stack, OS hardening, Patroni, Redis Sentinel, object storage, monitoring, CI/CD to artefacts |
| 3. Migration | 10–11 | Move DB and files from EC2 to AOS (≈ tens of GB today: `pg_dump` + `rclone`); DNS cut-over |
| 4. Load test and DR drill | 11–12 | §9 pass criteria met |
| 5. Go-live and onboarding | 12+ | Bulk upload of schools in waves of 50; watch processing and storage growth |

---

## 11. Main risks

| Risk | Mitigation |
|---|---|
| Application changes slip, so hardware sits idle | Treat §3 P0 as a go-live gate; ship incrementally behind feature flags |
| School uplinks are slow or unstable for 8 GB uploads | Resumable chunked uploads; optional offline hand-in (USB / regional office upload station) |
| Very large photogrammetry meshes (> 2 GB GLB) | Require tiled (3D Tiles) exports from survey contractors; server-side tiling as a fallback |
| Single upstream carrier at the data centre | Contract dual carriers and RINEX peering |
| MinIO community edition is unmaintained | Licensed AIStor, or Ceph RGW / SeaweedFS |
| Audit hash-chain write throughput | Load-test (§9); batch the chain per interval if needed |
| Basemap provider limits at 100k users | Self-hosted Rwanda PMTiles basemap |
| Node.js 20 EOL (April 2026) | Upgrade to Node 22/24 LTS during phase 1 |

---

## Sources

- AOS Ltd — <https://aos.rw/>, <https://aos.rw/cloud-hosting/>
- AOS listing (VM sizes, colocation, SLA, network) — <https://www.whtop.com/review/aos.rw>
- AOS overview — <https://btw.media/en/aos-rwanda-national-data-centre-ict-services>, <https://www.datacentermap.com/rwanda/kigali/aos/>
- AOS pricing history — <https://www.newtimes.co.rw/article/181063/News/web-email-and-cloud-hosting-costs-drop-significantly-in-rwanda>
- RINEX fee structure and traffic — <https://rinex.org.rw/?-Pricing->, <https://pulse.internetsociety.org/fr/ixp-tracker/ixp/401/>
- Rwanda data protection law — <https://www.dlapiperdataprotection.com/?c=RW&t=law>, <https://www.pwc.com/rw/en/assets/pdf/legal-alert-navigating-cross-border-data-transfer.pdf>
- MinIO / AIStor hardware requirements — <https://docs.min.io/aistor/reference/aistor-server/requirements/>, <https://docs.min.io/aistor/operations/core-concepts/erasure-coding/>
- MinIO community edition status — <https://glukhov.org/data-infrastructure/object-storage/minio-dead/>, <https://itsfoss.com/news/minio-moves-away-from-open-source/>
- Socket.IO scaling heuristics — <https://docs.weam.ai/knowledgebase/socket-scale>, <https://stackharbor.com/en/knowledge-base/nodejs-websocket-scaling-pattern/>
- PostgreSQL tuning — <https://learn.arm.com/learning-paths/servers-and-cloud-computing/postgresql_tune/tuning/>
- Internal: `deploy/README.md`, `deploy/ecosystem.config.js`, `docs/3d-viewer-performance.md`, `docs/drone-image-progressive-loading.md`, `docs/BACKUP_AND_DR.md`, and the source files cited in §2.3
