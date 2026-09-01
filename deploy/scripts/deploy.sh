#!/usr/bin/env bash
# Server-side deploy — invoked over SSH by .github/workflows/deploy.yml.
# Idempotent: pulls origin/main, installs, builds, migrates, reloads PM2, serves client.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLIENT_WEBROOT="/var/www/rtb-client"
SERVER_ENV="/var/lib/rtb/env/server.env"

cd "$REPO_DIR"
echo "▶ Deploying from $REPO_DIR"

# ── 1. Sync code ───────────────────────────────────────────────────────────
git fetch --all --prune
git reset --hard origin/main
git submodule update --init --recursive 2>/dev/null || true
COMMIT="$(git rev-parse --short HEAD)"
echo "▶ Now at $COMMIT"

# ── 2. Dependencies (per-package; no root install:all — map-viewer absent) ──
npm --prefix server  ci
npm --prefix client  ci
npm --prefix file-server install --omit=dev

# ── 3. Build server ────────────────────────────────────────────────────────
npm --prefix server run build

# ── 4. Run pending DB migrations (idempotent — only new ones apply) ────────
set -a; # shellcheck disable=SC1090
source "$SERVER_ENV"; set +a
echo "▶ Running migrations..."
( cd server && npx typeorm migration:run -d dist/db/data-source.js )

# ── 5. Build client ───────────────────────────────────────────────────────
# client/.env.production is gitignored; recreate it (same-origin paths, no secrets).
cat > client/.env.production <<'CENV'
VITE_APP_NAME="RTB GIS Schools Monitoring System"
VITE_API_URL=/api/v1
VITE_FILE_SERVER_URL=/files
VITE_GOOGLE_CLIENT_ID=913204130540-5hrfp5ridotig5ebd7ar424vhecq8bab.apps.googleusercontent.com
CENV
npm --prefix client run build
rsync -a --delete client/dist/ "$CLIENT_WEBROOT/"

# ── 6. Reload processes (zero-downtime) ───────────────────────────────────
pm2 reload rtb-api          --update-env
pm2 reload rtb-file-server  --update-env
pm2 save

# ── 7. Health gate ───────────────────────────────────────────────────────
sleep 5
echo "▶ Health checks"
curl -fsS "http://127.0.0.1:3001/api/v1/health" >/dev/null && echo "  ✓ API"
curl -fsS "http://127.0.0.1:3002/health" >/dev/null && echo "  ✓ file-server"
echo "✅ Deploy $COMMIT complete"
