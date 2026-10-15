# Backup and disaster-recovery policy (WS8.8)

**Status:** draft for RTB review · **Prepared:** 2026-10-14
**Applies to:** production at `rtb.aerovyntech.com` — one EC2 instance laid out as in `deploy/README.md`:

| What | Where on the server |
|---|---|
| PostgreSQL 15 + PostGIS, DB `rtb_gis_db`, role `rtb`, localhost only | `/var/lib/postgresql` |
| Uploaded files (KMZ/KML/GLB, GeoTIFF, report photos, avatars) | `/var/lib/rtb/storage` |
| Secrets (`server.env`, `file-server.env`) | `/var/lib/rtb/env` (0640) |
| Local backups | `/var/lib/rtb/backups` |
| App checkout / built client | `/opt/rtb`, `/var/www/rtb-client` (rebuildable from git — not backed up) |

## 1. Policy

| Item | Target |
|---|---|
| **Database** | Daily full dump at 02:00 Africa/Kigali, encrypted |
| **Uploaded files** | Daily incremental sync, encrypted archive weekly |
| **Secrets** | Copied to the RTB password vault on every change (not in the nightly job) |
| **Encryption** | GPG symmetric AES-256; the passphrase is held by RTB ICT in the vault, **not** on the server in plain text beyond a 0400 key file readable by `deploy` |
| **Location** | **In Rwanda** (Law 058/2021): primary copy on the server, secondary copy on an RTB-controlled host in-country (government data centre or RTB office NAS). No copy outside Rwanda unless decision D1 authorises it |
| **Retention** | 14 daily + 8 weekly + 12 monthly |
| **RPO** (max data loss) | 24 hours |
| **RTO** (max downtime) | 8 hours for a full rebuild on a new host |
| **Restore test** | **Quarterly**, recorded in §6 |
| **Monitoring** | Job writes a status line; a missing or failed backup alerts RTB ICT by email |

> Today `deploy/README.md` §14 runs an **unencrypted** nightly `pg_dump` kept 14 days on the same disk, plus optional EBS snapshots in eu-north-1. That protects against mistakes, not against losing the server or the region, and it is not in-country. This policy replaces it.

## 2. One-time setup (on the EC2 host, as `deploy`)

```bash
# 2.1 Backup passphrase (generate once, store the same value in RTB's vault)
umask 077
openssl rand -base64 48 > /var/lib/rtb/env/backup.key
chmod 400 /var/lib/rtb/env/backup.key

# 2.2 DB password for non-interactive pg_dump
echo "127.0.0.1:5432:rtb_gis_db:rtb:THE_DB_PASSWORD" > ~/.pgpass
chmod 600 ~/.pgpass

# 2.3 Folders
mkdir -p /var/lib/rtb/backups/{daily,weekly,monthly,files} /var/lib/rtb/backups/log

# 2.4 SSH key to the in-country backup host (ask RTB ICT for host + account)
ssh-keygen -t ed25519 -N '' -f ~/.ssh/rtb_backup -C "rtb-gis backup"
# give ~/.ssh/rtb_backup.pub to RTB ICT; they add it to backup@<IN_COUNTRY_HOST>
# with a forced command / restricted rsync if possible.
```

## 3. Nightly job

Save as `/home/deploy/bin/rtb-backup.sh` (`chmod 700`):

```bash
#!/usr/bin/env bash
set -euo pipefail
B=/var/lib/rtb/backups
KEY=/var/lib/rtb/env/backup.key
REMOTE="backup@IN_COUNTRY_HOST:/srv/backups/rtb-gis"   # RTB ICT provides
STAMP=$(date +%F)
LOG=$B/log/backup-$STAMP.log
exec >>"$LOG" 2>&1
echo "== $(date -Is) start"

# 1) Database: custom format (parallel restore, per-table selection), then encrypt
pg_dump -h 127.0.0.1 -U rtb -Fc rtb_gis_db \
  | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-file "$KEY" \
        -o "$B/daily/db-$STAMP.dump.gpg"
(cd "$B/daily" && sha256sum "db-$STAMP.dump.gpg" > "db-$STAMP.dump.gpg.sha256")

# 2) Uploaded files: local mirror (fast restore) …
rsync -a --delete /var/lib/rtb/storage/ "$B/files/current/"
# … and an encrypted weekly archive on Sundays
if [ "$(date +%u)" = 7 ]; then
  tar -C /var/lib/rtb -czf - storage \
    | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-file "$KEY" \
          -o "$B/weekly/storage-$STAMP.tgz.gpg"
  cp "$B/daily/db-$STAMP.dump.gpg" "$B/weekly/"
fi
# Monthly copy on the 1st
if [ "$(date +%d)" = 01 ]; then cp "$B/daily/db-$STAMP.dump.gpg" "$B/monthly/"; fi

# 3) Retention
find "$B/daily"   -name '*.gpg*' -mtime +14  -delete
find "$B/weekly"  -name '*.gpg'  -mtime +56  -delete
find "$B/monthly" -name '*.gpg'  -mtime +365 -delete

# 4) Off-box, in-country copy (encrypted files only)
rsync -a -e "ssh -i ~/.ssh/rtb_backup" \
  "$B/daily" "$B/weekly" "$B/monthly" "$REMOTE/"

echo "== $(date -Is) ok"
```

Cron (`crontab -e` as `deploy`), replacing the old line from `deploy/README.md` §14.1:

```
0 2 * * * /home/deploy/bin/rtb-backup.sh || echo "RTB GIS backup FAILED on $(hostname)" | mail -s "Backup failed" ict@rtb.gov.rw
```

(Install `mailutils` or use the SMTP settings already in `server.env`; RTB ICT to confirm the alert address.)

**Snapshots:** keep the EBS Data Lifecycle Manager policy (daily, retain 7) as a fast whole-box rollback — but remember it is stored in eu-north-1 and is **not** the in-country copy.

## 4. Restore procedures

### 4.1 Restore the database (same server or a new one)

```bash
cd /var/lib/rtb/backups/daily
sha256sum -c db-YYYY-MM-DD.dump.gpg.sha256          # integrity check first
gpg --batch --decrypt --passphrase-file /var/lib/rtb/env/backup.key \
    db-YYYY-MM-DD.dump.gpg > /tmp/db.dump

sudo -u deploy bash -lc 'cd /opt/rtb && pm2 stop rtb-api rtb-file-server'
dropdb   -h 127.0.0.1 -U rtb rtb_gis_db
createdb -h 127.0.0.1 -U rtb rtb_gis_db
psql -h 127.0.0.1 -U rtb -d rtb_gis_db -c 'CREATE EXTENSION IF NOT EXISTS postgis'
pg_restore -h 127.0.0.1 -U rtb -d rtb_gis_db --no-owner -j 4 /tmp/db.dump
shred -u /tmp/db.dump
sudo -u deploy bash -lc 'cd /opt/rtb && pm2 start rtb-api rtb-file-server'
curl -fsS https://rtb.aerovyntech.com/api/v1/health
```

### 4.2 Restore uploaded files

```bash
rsync -a /var/lib/rtb/backups/files/current/ /var/lib/rtb/storage/
# or from the weekly archive:
gpg --batch --decrypt --passphrase-file /var/lib/rtb/env/backup.key \
    storage-YYYY-MM-DD.tgz.gpg | tar -C /var/lib/rtb -xzf -
chown -R deploy:deploy /var/lib/rtb/storage
```

### 4.3 Full rebuild on a new host (server lost)

1. Provision the host following `deploy/README.md` steps 1–9 (OS, Node, PostgreSQL 15 + PostGIS, nginx, PM2, folders).
2. Restore `/var/lib/rtb/env/*.env` and `backup.key` from the RTB vault.
3. Pull the latest encrypted DB and storage archives from the in-country backup host.
4. Restore DB (§4.1) and files (§4.2); `git clone` + `deploy/scripts/deploy.sh` to build the app.
5. Point DNS to the new host; re-issue TLS (`certbot --nginx`).
6. Run the smoke tests in `deploy/README.md` Step 13.

## 5. Quarterly restore test (into a scratch DB — production untouched)

```bash
LATEST=$(ls -1t /var/lib/rtb/backups/daily/db-*.dump.gpg | head -1)
gpg --batch --decrypt --passphrase-file /var/lib/rtb/env/backup.key "$LATEST" > /tmp/t.dump
createdb -h 127.0.0.1 -U rtb rtb_restore_test
psql -h 127.0.0.1 -U rtb -d rtb_restore_test -c 'CREATE EXTENSION IF NOT EXISTS postgis'
pg_restore -h 127.0.0.1 -U rtb -d rtb_restore_test --no-owner /tmp/t.dump
psql -h 127.0.0.1 -U rtb -d rtb_restore_test -Atc \
  "SELECT 'schools', count(*) FROM schools UNION ALL
   SELECT 'users', count(*) FROM users UNION ALL
   SELECT 'reports', count(*) FROM issue_reports UNION ALL
   SELECT 'audit', count(*) FROM audit_logs"
dropdb -h 127.0.0.1 -U rtb rtb_restore_test; shred -u /tmp/t.dump
```

Pass criteria: decrypt succeeds, restore has no errors, row counts are within one day of production, 3 random uploaded files from the storage archive open correctly. Also test pulling the files **from the in-country host**, not only the local copy.

## 6. Restore-test log

| Date | Backup tested | Who | Duration | Result / issues |
|---|---|---|---|---|
| | | | | |

## 7. Open decisions

- **D1** decides where the in-country secondary copy lives (and whether the primary server itself moves to Rwanda).
- RTB ICT to provide the in-country backup host, account and alert email.
- Confirm whether RISA requires a specific encryption standard or an off-line (air-gapped) monthly copy.
