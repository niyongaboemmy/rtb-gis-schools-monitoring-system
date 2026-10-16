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
# After syncing, restart this script from the freshly pulled copy. Without
# this, each deploy would finish running the *previous* deploy.sh (bash keeps
# reading the file it started with), so script changes only took effect one
# deploy late.
if [ "${RTB_DEPLOY_SYNCED:-0}" != "1" ]; then
  git fetch --all --prune
  git reset --hard origin/main
  git submodule update --init --recursive 2>/dev/null || true
  export RTB_DEPLOY_SYNCED=1
  exec bash "$REPO_DIR/deploy/scripts/deploy.sh" "$@"
fi
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

# Pre-flight: validate the env with the code we're about to run, BEFORE the
# migrations and the PM2 reload. A missing/invalid secret then fails the deploy
# while the old API keeps serving, instead of crash-looping the new one.
echo "▶ Checking environment..."
( cd server && node -e '
  try { require("./dist/config/env.validation").validateEnv(process.env); }
  catch (e) { console.error(e.message); process.exit(1); }
' ) || { echo "✗ $SERVER_ENV is missing required settings — nothing was changed."; exit 1; }
echo "  ✓ environment"

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
# Retry for up to 60 s (the API takes a few seconds to boot), and fail the
# deploy for real if a process never comes up.
wait_healthy() {
  local name="$1" url="$2" app="$3"
  for _ in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null 2>&1; then echo "  ✓ $name"; return 0; fi
    sleep 2
  done
  echo "  ✗ $name not healthy after 60 s — last log lines:"
  pm2 logs "$app" --nostream --lines 40 2>&1 | tail -40 || true
  return 1
}
echo "▶ Health checks"
wait_healthy "API" "http://127.0.0.1:3001/api/v1/health" rtb-api
wait_healthy "file-server" "http://127.0.0.1:3002/health" rtb-file-server
echo "✅ Deploy $COMMIT complete"
