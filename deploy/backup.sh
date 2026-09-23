#!/usr/bin/env bash
# Nightly logical dump of both databases, 7 days of history.
#
#   local TimescaleDB : trades + candles. Regenerable from Binance, but a
#                       restore beats re-accumulating 90 days of history.
#   Neon              : accounts, balances, positions. Not regenerable at all.
#
# Installed by bootstrap.sh as a systemd timer. Run by hand any time.
set -euo pipefail

PROJECT="${1:-orderloom}"
DEST="/var/backups/${PROJECT}"
KEEP_DAYS=7
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

# Neon runs a newer major (18.x) than the local server (17.x), and pg_dump
# refuses a server newer than itself. A newer pg_dump reads older servers fine,
# so one client-18 binary covers both. Fall back to PATH if it isn't installed.
PG_DUMP=$(ls -d /usr/lib/postgresql/*/bin/pg_dump 2>/dev/null | sort -V | tail -1)
PG_DUMP=${PG_DUMP:-$(command -v pg_dump)}

set -a; . "/etc/${PROJECT}/${PROJECT}.env"; set +a
install -d -m 0700 "$DEST"

dump() { # name  url
  local out="${DEST}/$1-${STAMP}.sql.gz"
  # --no-owner/--no-acl so a restore doesn't need the same role names to exist.
  "$PG_DUMP" --no-owner --no-acl "$2" | gzip -9 > "$out"
  local size; size=$(du -h "$out" | cut -f1)
  # A dump that fails midway still leaves a valid gzip, so check it decompresses
  # AND contains SQL. Silent truncation is the failure mode that matters.
  gzip -t "$out"
  # `zcat | head -40` under `set -o pipefail` fails a PERFECTLY GOOD dump: head
  # exits at line 40, zcat takes SIGPIPE and returns 141. The `|| true` inside
  # the group swallows that so only a real read error propagates.
  local head_lines
  head_lines=$( { zcat "$out" 2>/dev/null || true; } | head -40 )
  grep -q "PostgreSQL database dump" <<<"$head_lines" \
    || { echo "$1: dump looks truncated, removing" >&2; rm -f "$out"; return 1; }
  echo "$1: $size"
}

dump trades "$DATABASE_URL"
dump accounts "$NEON_DIRECT_URL"

find "$DEST" -name '*.sql.gz' -mtime "+${KEEP_DAYS}" -delete
echo "kept: $(find "$DEST" -name '*.sql.gz' | wc -l | tr -d ' ') dumps in $DEST"
