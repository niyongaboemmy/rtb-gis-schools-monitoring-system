# RTB GIS — AWS Deployment Runbook (`rtb.aerovyntech.com`)

Single **EC2** instance, **no Docker**. One box runs everything:

| Component | How it runs | Listens on |
|---|---|---|
| PostgreSQL 15 + PostGIS 3.4 | apt (PGDG) / systemd | `127.0.0.1:5432` |
| Redis 7 | apt / systemd | `127.0.0.1:6379` |
| NestJS API (`server/`) | PM2 → `dist/main.js` | `127.0.0.1:3001` |
| File-server (`file-server/`) | PM2 → `server.js` | `127.0.0.1:3002` |
| React SPA (`client/`) | static build in `/var/www/rtb-client`, served by Nginx | — |
| Nginx + Let's Encrypt TLS | apt / systemd | `0.0.0.0:80`, `0.0.0.0:443` |

Uploads live on the root EBS volume at `/var/lib/rtb/storage`.

**CI/CD:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (lint/test/build on every PR + push) →
on success on `main`, [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) SSHes in
and runs [`deploy/scripts/deploy.sh`](scripts/deploy.sh).

---

# PART 1 — MANUAL SETUP (one-time)

Everything in this part is done by a human, once. After it's finished, all further
deploys are automatic on merge to `main`.

> Notation: `[local]$` = run on your laptop · `[ec2]$` = run on the server as the
> `ubuntu` login user · `[deploy]$` = run on the server as the `deploy` user.

---

## Step 0 — Prerequisites

**Accounts / access**
- AWS account with permission for **EC2**, **VPC/Security Groups**, **Elastic IP**, **Route 53**.
- The `aerovyntech.com` **hosted zone already exists in Route 53** in this account (confirmed from your console screenshot).
- GitHub repo admin rights (to add Actions secrets + branch protection).

**Local tools**
- An SSH client (`ssh`, `scp`).
- `git`.

**Decisions already made** (don't re-litigate):
- Region: use the same region your team already works in. The Route 53 zone is global, so any region is fine; **`eu-north-1`** appears in your screenshot URL — use that unless you have a reason not to. This runbook assumes `eu-north-1`.
- Instance size: **t3.large** (2 vCPU / 8 GiB). The Cesium client build alone peaks ~2–3 GiB; Postgres + Redis + Node need the rest. `t3.medium` (4 GiB) will OOM during `vite build` — do not use it.
- No Docker, no RDS, no S3, no ElastiCache — all per your instruction.

---

## Step 1 — Launch the EC2 instance (AWS Console)

1. **EC2 → Instances → Launch an instance.**
2. **Name:** `rtb-gis-prod`.
3. **Application and OS Image:** *Ubuntu Server 24.04 LTS (HVM), SSD Volume Type*, architecture **64-bit (x86)**.
4. **Instance type:** `t3.large`.
5. **Key pair (login):**
   - Click **Create new key pair**.
   - Name `rtb-gis-prod`, type **ED25519** (or RSA if your SSH client is old), format **.pem**.
   - Download `rtb-gis-prod.pem`. On your laptop:
     ```
     [local]$ mkdir -p ~/.ssh && mv ~/Downloads/rtb-gis-prod.pem ~/.ssh/
     [local]$ chmod 400 ~/.ssh/rtb-gis-prod.pem
     ```
   - **This key is your break-glass admin access. Keep it safe; it is not the key GitHub uses.**
6. **Network settings → Edit:**
   - VPC: default is fine.
   - Subnet: any **public** subnet (one that auto-assigns public IPv4, or where the route table points `0.0.0.0/0` at an internet gateway).
   - **Auto-assign public IP:** Enable (temporary; replaced by the Elastic IP in Step 2).
   - **Firewall (security groups) → Create security group.** Name `rtb-gis-prod-sg`. Rules:

     | Type | Protocol | Port range | Source | Description |
     |---|---|---|---|---|
     | SSH | TCP | 22 | **My IP** | admin SSH — your current public IP only |
     | HTTP | TCP | 80 | `0.0.0.0/0` **and** `::/0` | Let's Encrypt HTTP-01 + redirect to HTTPS |
     | HTTPS | TCP | 443 | `0.0.0.0/0` **and** `::/0` | public app traffic |

     **Do NOT open 5432, 6379, 3001, 3002.** They must never be reachable from outside.
     GitHub Actions reaches the box over **SSH (22)** — see Step 12 about the source range.
7. **Configure storage:** 1 volume, **60 GiB**, **gp3**, 3000 IOPS / 125 MB/s (defaults). Delete on termination: yes.
   - Rationale: OS + Node + npm caches + `node_modules` across 3 packages ≈ 8–10 GiB; the rest is headroom for uploaded KMZ/KML/GeoJSON assets under `/var/lib/rtb/storage`. You can grow a gp3 volume online later without downtime.
8. **Advanced details:** leave defaults. (No IAM instance profile needed — we don't touch S3.)
9. **Launch instance.** Wait until **Instance state = Running** and **Status checks = 2/2 passed** (~2 min).

---

## Step 2 — Allocate and attach an Elastic IP

A plain public IP changes if the instance stops. DNS must point at a stable address.

1. **EC2 → Network & Security → Elastic IPs → Allocate Elastic IP address.**
   - Network border group: your region. **Allocate.**
2. Select the new address → **Actions → Associate Elastic IP address.**
   - Resource type: **Instance** → choose `rtb-gis-prod` → **Associate.**
3. **Write down this address.** Everywhere below it is written as **`EIP`** (e.g. `13.51.x.x`).
4. From now on, SSH to `EIP`:
   ```
   [local]$ ssh -i ~/.ssh/rtb-gis-prod.pem ubuntu@EIP
   ```
   First connection asks to trust the host key — type `yes`.

> Cost note: an Elastic IP is free **while associated with a running instance**, and billed (~$3.60/mo) only if left unassociated or the instance is stopped.

---

## Step 3 — Route 53 DNS record

1. **Route 53 → Hosted zones → `aerovyntech.com` → Create record.**
2. Fill in:
   - **Record name:** `rtb`  (this produces `rtb.aerovyntech.com`)
   - **Record type:** `A – Routes traffic to an IPv4 address…`
   - **Alias:** OFF
   - **Value:** `EIP`
   - **TTL:** `300`
   - **Routing policy:** Simple routing
3. **Create records.**
4. Verify propagation from your laptop (may take 1–5 min):
   ```
   [local]$ dig +short rtb.aerovyntech.com
   EIP            # <-- must return exactly your Elastic IP
   ```
   Do not proceed to Step 11 (TLS) until this resolves — Let's Encrypt validation will fail otherwise.

---

## Step 4 — Base system packages

SSH in as `ubuntu` and run these blocks in order. Read the notes.

### 4.1 OS update + swap + basics

```
[ec2]$ sudo apt update && sudo apt -y upgrade
[ec2]$ sudo apt -y install git curl ca-certificates gnupg rsync ufw build-essential
```

Add **4 GiB swap** — protects against transient OOM during `npm ci` / `vite build`
even on 8 GiB:

```
[ec2]$ sudo fallocate -l 4G /swapfile
[ec2]$ sudo chmod 600 /swapfile
[ec2]$ sudo mkswap /swapfile
[ec2]$ sudo swapon /swapfile
[ec2]$ echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
[ec2]$ free -h        # confirm "Swap: 4.0Gi"
```

Enable automatic security updates (unattended-upgrades ships enabled on Ubuntu
Server; confirm):

```
[ec2]$ sudo systemctl status unattended-upgrades --no-pager
```

### 4.2 Node.js 20 (matches CI)

```
[ec2]$ curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
[ec2]$ sudo apt -y install nodejs
[ec2]$ node -v      # v20.x
[ec2]$ npm -v       # 10.x
```

### 4.3 PM2 (process manager) — global

```
[ec2]$ sudo npm install -g pm2
[ec2]$ pm2 -v
```

### 4.4 Nginx + Certbot

```
[ec2]$ sudo apt -y install nginx python3-certbot-nginx
[ec2]$ sudo systemctl enable --now nginx
[ec2]$ curl -I http://localhost      # "HTTP/1.1 200 OK" from the default page
```

### 4.5 Redis 7

```
[ec2]$ sudo apt -y install redis-server
```

Harden the config — bind to loopback, add a memory cap so a runaway queue can't
evict the OS:

```
[ec2]$ sudo sed -i 's/^# *maxmemory .*/maxmemory 512mb/' /etc/redis/redis.conf
[ec2]$ sudo sed -i 's/^# *maxmemory-policy .*/maxmemory-policy noeviction/' /etc/redis/redis.conf
[ec2]$ grep -E '^bind|^protected-mode' /etc/redis/redis.conf
        # expect: bind 127.0.0.1 -::1   and   protected-mode yes   (defaults — leave them)
[ec2]$ sudo systemctl enable --now redis-server
[ec2]$ redis-cli ping      # PONG
```

`maxmemory-policy noeviction` is correct for BullMQ (jobs must not be silently
dropped); if Redis fills up you want writes to error loudly, not lose jobs.

### 4.6 PostgreSQL 15 + PostGIS 3 (via PGDG repo)

Ubuntu 24.04's default Postgres is **16**. The project targets **15**, so add the
official PostgreSQL APT repository:

```
[ec2]$ sudo install -d /usr/share/postgresql-common/pgdg
[ec2]$ sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
        --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
[ec2]$ echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        | sudo tee /etc/apt/sources.list.d/pgdg.list
[ec2]$ sudo apt update
[ec2]$ sudo apt -y install postgresql-15 postgresql-15-postgis-3 postgresql-client-15
[ec2]$ sudo systemctl enable --now postgresql
[ec2]$ sudo -u postgres psql -c "SELECT version();"     # PostgreSQL 15.x
```

> If you genuinely don't care about the major version, `sudo apt install postgresql
> postgresql-postgis` (v16) also works — TypeORM/PostGIS behave identically for this
> app. Staying on 15 just matches local dev and `docker-compose.yml`.

---

## Step 5 — Create the database, role, and PostGIS extension

```
[ec2]$ sudo -u postgres psql
```

At the `postgres=#` prompt, paste (replace the password with a strong one — generate
with `openssl rand -base64 24`):

```sql
CREATE ROLE rtb WITH LOGIN PASSWORD 'PASTE_STRONG_DB_PASSWORD';
CREATE DATABASE rtb_gis_db OWNER rtb;
\c rtb_gis_db
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- lock down: only the owner touches this DB
REVOKE ALL ON DATABASE rtb_gis_db FROM PUBLIC;
GRANT ALL PRIVILEGES ON DATABASE rtb_gis_db TO rtb;
GRANT ALL ON SCHEMA public TO rtb;
\q
```

**Save the password now** — you'll paste it into the env file in Step 8, and it is
not recoverable.

### 5.1 Confirm the connection the app will actually use

The app connects as `rtb` over **TCP to 127.0.0.1** with a password. Test that
exact path:

```
[ec2]$ PGPASSWORD='PASTE_STRONG_DB_PASSWORD' psql -h 127.0.0.1 -U rtb -d rtb_gis_db -c "SELECT postgis_version();"
```

- **Success:** you see the PostGIS version string. Done.
- **`FATAL: password authentication failed`** or `no pg_hba.conf entry`: open
  `/etc/postgresql/15/main/pg_hba.conf`, confirm these lines exist (they are the
  PG15 default) and reload:
  ```
  host    all             all             127.0.0.1/32            scram-sha-256
  host    all             all             ::1/128                 scram-sha-256
  ```
  ```
  [ec2]$ sudo systemctl reload postgresql
  ```
- Leave `listen_addresses = 'localhost'` in `postgresql.conf` **unchanged** — the DB
  must not listen on the public interface. (The security group also blocks 5432, so
  this is defence in depth.)

---

## Step 6 — Deploy user, directory layout, and the CI SSH key

The GitHub Action logs in as an unprivileged `deploy` user that owns the app files
and can drive PM2 — but is **not** in `sudo`.

### 6.1 Create the user and directories

```
[ec2]$ sudo adduser --disabled-password --gecos "" deploy

[ec2]$ sudo mkdir -p /opt/rtb \
                     /var/www/rtb-client \
                     /var/lib/rtb/storage \
                     /var/lib/rtb/env \
                     /var/lib/rtb/backups

[ec2]$ sudo chown -R deploy:deploy /opt/rtb /var/www/rtb-client /var/lib/rtb
[ec2]$ sudo chmod 750 /var/lib/rtb/env         # secrets dir — not world-readable
```

| Path | Purpose | Owner |
|---|---|---|
| `/opt/rtb` | git checkout of this repo (the deploy target) | `deploy` |
| `/var/www/rtb-client` | built SPA that Nginx serves | `deploy` (Nginx reads as `www-data`) |
| `/var/lib/rtb/storage` | uploaded spatial assets (file-server + API) | `deploy` |
| `/var/lib/rtb/env` | `server.env`, `file-server.env` — secrets, never in git | `deploy`, mode 750 |
| `/var/lib/rtb/backups` | nightly `pg_dump` output | `deploy` |

### 6.2 Give PM2 a systemd unit for the `deploy` user

```
[ec2]$ sudo env PATH=$PATH pm2 startup systemd -u deploy --hp /home/deploy
        # prints one `sudo env ... pm2 ...` line — it is already run for you by this command
[ec2]$ sudo systemctl enable pm2-deploy
```

(We run `pm2 save` in Step 10 once the apps are up; the unit then restores them on reboot.)

### 6.3 Generate the SSH key GitHub Actions will use

Do this **as `deploy`**:

```
[ec2]$ sudo -iu deploy

[deploy]$ mkdir -p ~/.ssh && chmod 700 ~/.ssh
[deploy]$ ssh-keygen -t ed25519 -N "" -C "github-actions-deploy" -f ~/.ssh/gha_deploy
[deploy]$ cat ~/.ssh/gha_deploy.pub >> ~/.ssh/authorized_keys
[deploy]$ chmod 600 ~/.ssh/authorized_keys
[deploy]$ cat ~/.ssh/gha_deploy        # <<< COPY THIS ENTIRE PRIVATE KEY
```

- The **private** key (`gha_deploy`, the block from `-----BEGIN` to `END-----`) goes
  into the GitHub secret **`EC2_SSH_KEY`** in Step 12.
- The **public** key stays only in `~deploy/.ssh/authorized_keys` on the server.
- Delete the private key from the server after copying it if you want
  (`shred -u ~/.ssh/gha_deploy`) — GitHub is then the only holder. Keep the
  `.pub` line in `authorized_keys`.

### 6.4 (Optional but recommended) restrict what the CI key can do

Prepend a `command=` restriction so a leaked key can only run the deploy script.
Edit `~deploy/.ssh/authorized_keys` and change the `gha_deploy` line to:

```
command="/opt/rtb/deploy/scripts/deploy.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding ssh-ed25519 AAAA...github-actions-deploy
```

If you do this, the `script:` block in `deploy.yml` still "runs" but SSH ignores it
and runs `deploy.sh` instead — same result. Skip this on the first pass if it
complicates debugging; add it once the pipeline is green.

---

## Step 7 — Clone the repository into `/opt/rtb`

### 7.1 If the GitHub repo is **public**

```
[deploy]$ git clone https://github.com/niyongaboemmy/<REPO>.git /opt/rtb
[deploy]$ cd /opt/rtb && git checkout main
```

### 7.2 If the repo is **private** — add a read-only Deploy Key

```
[deploy]$ ssh-keygen -t ed25519 -N "" -C "rtb-ec2-checkout" -f ~/.ssh/repo_key
[deploy]$ cat ~/.ssh/repo_key.pub
```
- GitHub → repo → **Settings → Deploy keys → Add deploy key** → paste the `.pub`,
  title `rtb-ec2`, **do not** grant write access.
- Tell SSH to use that key for GitHub:
  ```
  [deploy]$ cat >> ~/.ssh/config <<'EOF'
  Host github.com
    IdentityFile ~/.ssh/repo_key
    IdentitiesOnly yes
  EOF
  [deploy]$ chmod 600 ~/.ssh/config
  [deploy]$ git clone git@github.com:niyongaboemmy/<REPO>.git /opt/rtb
  [deploy]$ cd /opt/rtb && git checkout main
  ```

---

## Step 8 — Environment files (secrets)

Templates are committed; the filled-in files live **only** under `/var/lib/rtb/env`.

```
[deploy]$ cp /opt/rtb/server/.env.production.example       /var/lib/rtb/env/server.env
[deploy]$ cp /opt/rtb/file-server/.env.production.example  /var/lib/rtb/env/file-server.env
[deploy]$ chmod 640 /var/lib/rtb/env/*.env
[deploy]$ nano /var/lib/rtb/env/server.env
```

### 8.1 `server.env` — every variable

| Variable | Set to | Notes |
|---|---|---|
| `NODE_ENV` | `production` | forces `synchronize:false`, disables query logging |
| `PORT` | `3001` | must match Nginx `proxy_pass` and `ecosystem.config.js` |
| `APP_NAME` | keep default | cosmetic |
| `APP_CORS_ORIGINS` | `https://rtb.aerovyntech.com` | exact scheme+host, no trailing slash, no `localhost` |
| `DATABASE_URL` | **leave empty** | empty → app uses the `DB_*` vars below |
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `5432` | |
| `DB_USERNAME` | `rtb` | from Step 5 |
| `DB_PASSWORD` | *the password from Step 5* | |
| `DB_NAME` | `rtb_gis_db` | |
| `DB_SYNC` | `false` | **only** flipped to `true` for the one bootstrap boot in Step 9, then back |
| `SEED_ON_STARTUP` | `false` | seeding is a manual command in prod (Step 9.3) |
| `JWT_SECRET` | `openssl rand -hex 32` output | ≥32 chars |
| `JWT_REFRESH_SECRET` | a **different** `openssl rand -hex 32` output | ≥32 chars |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | |
| `REDIS_URL` | **leave empty** | empty → uses `REDIS_HOST`/`REDIS_PORT` |
| `REDIS_HOST` | `localhost` | |
| `REDIS_PORT` | `6379` | |
| `STORAGE_BACKEND` | `local` | files go to disk on this box (no MinIO/S3) |
| `SWAGGER_ENABLED` | `false` | set `true` if you want `/api/docs` public |
| `ARCGIS_POPULATION_URL` | your ArcGIS feature-service URL, or leave the placeholder | population module is mocked today |
| `CESIUM_ION_TOKEN` | your Cesium ion token | server-side token if used; the client token is separate (in `client/.env.production`) |

Generate both JWT secrets in one go:
```
[deploy]$ echo "JWT_SECRET=$(openssl rand -hex 32)"; echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
```

### 8.2 `file-server.env` — every variable

| Variable | Set to | Notes |
|---|---|---|
| `FILE_SERVER_PORT` | `3002` | must match Nginx + `ecosystem.config.js` |
| `FILE_SERVER_STORAGE_DIR` | `/var/lib/rtb/storage` | **absolute** path; must be writable by `deploy` |
| `FILE_SERVER_MAX_FILE_SIZE_MB` | `6000` | 6 GiB ceiling per file — raise if your KMZ are bigger |
| `FILE_SERVER_MAX_FILES_PER_REQUEST` | `20` | |
| `FILE_SERVER_CORS_ORIGINS` | `https://rtb.aerovyntech.com` | reference only (code allows all origins) |

### 8.3 Client build config

`client/.env.production` is **committed** (no secrets — only same-origin paths and
the public Cesium client token). Nothing to do on the server. If your Cesium client
token differs from the one in the file, edit it in the repo and commit.

---

## Step 9 — First build, schema bootstrap, and seed

Still as `deploy`, in `/opt/rtb`.

### 9.1 Install dependencies + build

```
[deploy]$ cd /opt/rtb
[deploy]$ npm --prefix server  ci
[deploy]$ npm --prefix client  ci
[deploy]$ npm --prefix file-server install --omit=dev
[deploy]$ npm --prefix server run build          # produces server/dist
```

If `vite build` (next step) is ever killed with `Killed` / signal 9, that's OOM —
re-run with `NODE_OPTIONS=--max-old-space-size=3072 npm --prefix client run build`.

### 9.2 Create the schema on the empty database (ONE TIME)

The migration files in `server/src/migrations/` are *incremental* — they assume the
base tables already exist (historically created by TypeORM `synchronize`). A brand
new database has nothing, so we materialise the full current schema once with
`synchronize`, then record the existing migrations as already-applied.

```
[deploy]$ set -a; source /var/lib/rtb/env/server.env; set +a
[deploy]$ DB_SYNC=true NODE_ENV=production node server/dist/main.js
```
Watch the log. When you see:
```
🚀 RTB GIS Server running at: http://localhost:3001
```
the schema has been created. Press **Ctrl-C**.

Now mark the 4 shipped migrations as applied:
```
[deploy]$ PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U rtb -d rtb_gis_db \
            -f /opt/rtb/deploy/sql/mark-baseline.sql
```
Expected output ends with a 4-row table listing `UpdateBuildingMediaSchema…`,
`ClearPlaintextRefreshTokens…`, `AddResolvedAtToIssueReport…`,
`RecreateAuditLogsSnakeCase…`.

> `DB_SYNC` in `server.env` stays `false`. We only overrode it inline for that one
> boot. Every schema change from here on ships as a new migration file and is
> applied automatically by the deploy pipeline.

### 9.3 Seed reference data

```
[deploy]$ npm --prefix server run seed:prod
```
Idempotent — creates roles, access levels, the admin user
(`admin@rtb.gov.rw` / `Admin@123`), 21 facility categories, and 8 sample schools.
Safe to re-run any time. **Change the admin password after first login.**

### 9.4 Publish the client build

```
[deploy]$ npm --prefix client run build
[deploy]$ rsync -a --delete /opt/rtb/client/dist/ /var/www/rtb-client/
```

---

## Step 10 — Start the processes under PM2

```
[deploy]$ pm2 start /opt/rtb/deploy/ecosystem.config.js
[deploy]$ pm2 status            # rtb-api + rtb-file-server should be "online"
[deploy]$ pm2 save              # freezes this process list for reboot restore
```

Local health checks (still no public traffic):
```
[deploy]$ curl -fsS http://127.0.0.1:3001/api/v1      # -> hello string
[deploy]$ curl -fsS http://127.0.0.1:3002/health      # -> {"status":"ok",...}
```
If a process is `errored`, read `pm2 logs rtb-api --lines 100`.

---

## Step 11 — Nginx virtual host + HTTPS

### 11.1 Install the site config

```
[ec2]$ sudo cp /opt/rtb/deploy/nginx/rtb.aerovyntech.com.conf /etc/nginx/sites-available/
[ec2]$ sudo ln -s /etc/nginx/sites-available/rtb.aerovyntech.com.conf /etc/nginx/sites-enabled/
[ec2]$ sudo rm -f /etc/nginx/sites-enabled/default
[ec2]$ sudo nginx -t            # "syntax is ok" / "test is successful"
[ec2]$ sudo systemctl reload nginx
```

Check plain HTTP works (serves the SPA):
```
[local]$ curl -I http://rtb.aerovyntech.com          # HTTP/1.1 200 OK
```

### 11.2 Obtain the Let's Encrypt certificate

```
[ec2]$ sudo certbot --nginx \
         -d rtb.aerovyntech.com \
         --redirect \
         --agree-tos \
         -m emmanuelniyongabo44@gmail.com \
         --no-eff-email
```
Certbot edits the vhost to add the `:443` server block, the cert paths, and an
HTTP→HTTPS redirect, then reloads Nginx. It also installs a systemd timer for
auto-renewal.

Verify:
```
[ec2]$ sudo certbot renew --dry-run       # "Congratulations, all simulated renewals succeeded"
[local]$ curl -I https://rtb.aerovyntech.com     # HTTP/2 200, valid cert
```

Open **https://rtb.aerovyntech.com** in a browser — the SPA loads, padlock is valid,
you can log in with `admin@rtb.gov.rw` / `Admin@123`.

---

## Step 12 — GitHub repository configuration

### 12.1 Actions secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**.
Create each:

| Secret name | Value |
|---|---|
| `EC2_HOST` | your Elastic IP (`EIP`) |
| `EC2_USER` | `deploy` |
| `EC2_SSH_KEY` | the **entire** private key from Step 6.3 (`-----BEGIN OPENSSH PRIVATE KEY-----` … `-----END…-----`, including both lines and the trailing newline) |
| `EC2_APP_DIR` | `/opt/rtb` |
| `EC2_SSH_PORT` | `22` *(optional — the workflow defaults to 22)* |

### 12.2 Security group — let GitHub's runners reach SSH

Your SG currently allows SSH only from *your* IP. GitHub-hosted runners use a large,
changing set of IPs. Pick one:

- **Simplest (acceptable here):** add an inbound rule **SSH / TCP / 22 / `0.0.0.0/0`**.
  Risk is low because: key-only auth (passwords disabled on Ubuntu AMIs), the
  `deploy` user is non-sudo, and optionally the `command=` restriction from Step 6.4.
  Also run Step 14.3 (fail2ban).
- **Tighter:** a scheduled Lambda/script that syncs GitHub's published
  [meta API](https://api.github.com/meta) `actions` CIDR ranges into the SG. More
  moving parts; only worth it if org policy forbids `0.0.0.0/0` on 22.
- **Tightest:** switch the deploy transport to AWS **SSM Session Manager** (no
  inbound 22 at all). Requires an IAM instance profile + swapping the workflow's
  `appleboy/ssh-action` for `aws-actions/configure-aws-credentials` +
  `aws ssm send-command`. Out of scope for the first cut; note it as a hardening
  follow-up.

### 12.3 Branch protection on `main`

Repo → **Settings → Branches → Add branch ruleset** (or "Add rule"):
- Branch name pattern: `main`
- ✅ **Require a pull request before merging** (1 approval optional for a solo repo)
- ✅ **Require status checks to pass before merging** → search and select
  **`Lint · Test · Build`** (the job name from `ci.yml`)
- ✅ **Require branches to be up to date before merging**
- ✅ **Do not allow bypassing the above settings** (optional but recommended)

This is the mechanism that makes "**deploy only when merged to main**" true: code
can only land on `main` through a green PR, and `deploy.yml` triggers on
`workflow_run` of *CI completed successfully on main*.

### 12.4 First automated deploy

```
[local]$ git checkout -b chore/aws-pipeline
[local]$ git add server/ client/.env.production file-server/.env.production.example deploy/ .github/workflows/deploy.yml
[local]$ git commit -m "Add AWS EC2 deployment pipeline"
[local]$ git push -u origin chore/aws-pipeline
```
Open a PR → CI runs → merge → watch **Actions → Deploy to EC2**. It should SSH in,
run `deploy.sh` (pull, install, build, migrate, reload PM2, rsync client), and the
final "Public smoke test" step should print `-> 200`.

---

## Step 13 — Full verification checklist

Run after Step 11, and again after the first automated deploy (Step 12.4).

| # | Check | Command / action | Pass criteria |
|---|---|---|---|
| 1 | DNS | `dig +short rtb.aerovyntech.com` | returns `EIP` |
| 2 | TLS | `curl -I https://rtb.aerovyntech.com` | `200`, no cert warning; `curl -I http://…` → `301` to https |
| 3 | SPA | open `https://rtb.aerovyntech.com`, then hard-reload `…/analytics` | app loads; deep link does **not** 404 (SPA fallback) |
| 4 | API | `curl https://rtb.aerovyntech.com/api/v1` | hello string |
| 5 | Swagger | `curl -o /dev/null -w '%{http_code}' https://rtb.aerovyntech.com/api/docs` | `404` (disabled) — or `200` if you set `SWAGGER_ENABLED=true` |
| 6 | Auth | `curl -X POST https://rtb.aerovyntech.com/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@rtb.gov.rw","password":"Admin@123"}'` | JSON with `accessToken` + `refreshToken` |
| 7 | DB / PostGIS | `PGPASSWORD=… psql -h 127.0.0.1 -U rtb -d rtb_gis_db -c "SELECT postgis_version();"` | version string |
| 8 | Migrations table | `… -c "SELECT name FROM migrations ORDER BY timestamp;"` | the 4 baseline rows (+ any later ones) |
| 9 | Seed data | `… -c "SELECT count(*) FROM schools;"` and `… "SELECT count(*) FROM facilities;"` | `8` and `21` |
| 10 | WebSockets | open a page using live updates; browser DevTools → Network → WS | `101 Switching Protocols`, stays open |
| 11 | Redis/queues | upload a KMZ, then `redis-cli KEYS 'bull:*'` | queue keys appear; job completes; `kmzStatus` → processed |
| 12 | File upload | `/schools/:id/kmz` in the UI, upload a real KMZ | file appears under `/var/lib/rtb/storage/…`; buildings render in 2D/3D viewer |
| 13 | Migration-on-change | branch: tweak an entity + `npm run migration:generate`, PR, merge | deploy log shows the migration ran; `\d+ <table>` shows the change |
| 14 | Seed command idempotency | `npm --prefix server run seed:prod` twice | second run logs "Synced…"/"already" — no duplicate rows |
| 15 | Reboot resilience | `sudo reboot`, wait ~90s | Postgres, Redis, Nginx, and both PM2 apps come back automatically; site loads |
| 16 | CI gate | open a PR that breaks lint | CI red → merge blocked → no deploy |

---

## Step 14 — Post-launch hardening & operations

### 14.1 Nightly database backup

```
[deploy]$ crontab -e
```
Add:
```
0 2 * * * PGPASSWORD='THE_DB_PASSWORD' pg_dump -h 127.0.0.1 -U rtb rtb_gis_db | gzip > /var/lib/rtb/backups/rtb_$(date +\%F).sql.gz && find /var/lib/rtb/backups -name '*.sql.gz' -mtime +14 -delete
```
Restore test (do this once, into a scratch DB):
```
[deploy]$ createdb -h 127.0.0.1 -U rtb rtb_restore_test
[deploy]$ gunzip -c /var/lib/rtb/backups/rtb_YYYY-MM-DD.sql.gz | psql -h 127.0.0.1 -U rtb -d rtb_restore_test
[deploy]$ dropdb -h 127.0.0.1 -U rtb rtb_restore_test
```
Off-box copies: attach an IAM instance profile with `s3:PutObject` to one bucket and
append `&& aws s3 cp <file> s3://<bucket>/db/` to the cron line. (Optional — you
chose "all on one EC2"; this is the one exception worth considering for disaster
recovery.)

### 14.2 EBS snapshots
AWS Console → EC2 → the instance's volume → **Create snapshot lifecycle policy**
(Data Lifecycle Manager): daily, retain 7. Covers the whole box (OS + DB + uploads)
if the instance is lost.

### 14.3 fail2ban (brute-force protection on SSH)
```
[ec2]$ sudo apt -y install fail2ban
[ec2]$ sudo systemctl enable --now fail2ban
```
Default jail bans an IP after 5 failed SSH auths.

### 14.4 UFW (optional local firewall)
The security group already restricts inbound. If you also want host-level rules:
```
[ec2]$ sudo ufw allow OpenSSH
[ec2]$ sudo ufw allow 'Nginx Full'
[ec2]$ sudo ufw --force enable
```
Keep the SG and UFW rules consistent, or you'll lock yourself out.

### 14.5 Log rotation for PM2
```
[deploy]$ pm2 install pm2-logrotate
[deploy]$ pm2 set pm2-logrotate:max_size 50M
[deploy]$ pm2 set pm2-logrotate:retain 14
```

### 14.6 Monitoring (minimal)
- CloudWatch alarms on the instance: **CPUUtilization > 85% for 15 min**,
  **StatusCheckFailed**. Console → EC2 → instance → Monitoring → Manage alarms.
- Disk: `df -h /` should stay < 80%. Add a cron that emails/logs when it crosses.

---

## Everyday operations reference

### Deploy
Merge a PR to `main`. CI → on success `deploy.yml` runs `deploy.sh` on the box
(pull → `npm ci` → build → `typeorm migration:run` → `pm2 reload` → rsync client →
health check). Manual re-run: **Actions → Deploy to EC2 → Run workflow**.

### Migrations (automatic when schema changes)
```
[local]$ cd server
[local]$ npm run build
[local]$ npm run migration:generate -- src/migrations/DescribeYourChange
[local]$ git add src/migrations && git commit && open a PR
```
On merge, the deploy step's `npx typeorm migration:run` applies only the new file.
Revert the last one on the server: `cd /opt/rtb/server && set -a; source
/var/lib/rtb/env/server.env; set +a; npx typeorm migration:revert -d dist/db/data-source.js`.

### Seeding
- Standalone: `sudo -iu deploy bash -c 'cd /opt/rtb && npm --prefix server run seed:prod'`
- On boot (not recommended): set `SEED_ON_STARTUP=true` in `server.env`,
  `pm2 reload rtb-api --update-env`.

### Logs / status
```
[deploy]$ pm2 status
[deploy]$ pm2 logs rtb-api --lines 200
[deploy]$ pm2 logs rtb-file-server --lines 200
[ec2]$   sudo tail -f /var/log/nginx/error.log
[ec2]$   sudo journalctl -u postgresql -f
```

### Restart one service
```
[deploy]$ pm2 reload rtb-api            # zero-downtime
[ec2]$   sudo systemctl reload nginx
[ec2]$   sudo systemctl restart postgresql
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `certbot` fails: "challenge failed" / "NXDOMAIN" | DNS not propagated, or SG blocks 80 | `dig +short rtb.aerovyntech.com` must return `EIP`; SG must allow 80 from `0.0.0.0/0` |
| `502 Bad Gateway` on `/api` | `rtb-api` not listening on 3001 | `pm2 status`; `pm2 logs rtb-api`; check `PORT=3001` in `server.env` |
| `rtb-api` boots then exits | DB auth / connection | run the Step 5.1 `psql` test with the exact creds from `server.env` |
| `vite build` killed (signal 9) | OOM | ensure swap is on (Step 4.1); `NODE_OPTIONS=--max-old-space-size=3072` |
| Deploy Action: `Permission denied (publickey)` | wrong `EC2_SSH_KEY` / user | secret must be the full private key incl. header/footer; `EC2_USER=deploy`; `.pub` in `~deploy/.ssh/authorized_keys` |
| Deploy Action hangs then times out | SG blocks 22 from GitHub runners | Step 12.2 |
| `migration:run` fails "relation already exists" on first deploy | `mark-baseline.sql` not run | run Step 9.2's `psql -f mark-baseline.sql` |
| SPA loads but API calls are CORS-blocked | `APP_CORS_ORIGINS` wrong | must be exactly `https://rtb.aerovyntech.com`, then `pm2 reload rtb-api --update-env` |
| Uploaded files 404 on reload | `FILE_SERVER_STORAGE_DIR` mismatch or perms | must be `/var/lib/rtb/storage`, owned by `deploy` |
| Site down after `sudo reboot` | PM2 unit not enabled / not saved | `sudo systemctl enable pm2-deploy`; as deploy `pm2 save` |

---

# PART 2 — What's automated (no manual action)

Once Part 1 is done:

1. Push a branch → open PR → **CI** runs (`ci.yml`): `npm run install:all`, lint,
   `test:cov` (70% coverage gate), client `tsc -b && vite build`.
2. Merge to `main` (branch protection requires CI green).
3. **Deploy** (`deploy.yml`) fires on CI success for `main`:
   - SSH to EC2 as `deploy`, run `deploy/scripts/deploy.sh`:
     `git reset --hard origin/main` → `npm ci` (server + client) →
     `npm --prefix file-server install` → `nest build` →
     **`typeorm migration:run`** (only pending migrations) →
     `vite build` → `rsync client/dist → /var/www/rtb-client` →
     `pm2 reload rtb-api rtb-file-server` → local health checks.
   - Public smoke test: `GET https://rtb.aerovyntech.com/api/v1` must return `200`.
4. Rollback: re-run a previous successful deploy, or on the box
   `cd /opt/rtb && git reset --hard <good-sha> && bash deploy/scripts/deploy.sh`.
