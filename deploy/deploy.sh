#!/usr/bin/env bash
# Deploy orderloom to the server. Run from your laptop, from the repo root.
#
#   HOST=1.2.3.4 KEY=~/Desktop/private.key bash deploy/deploy.sh
#
# No image build, no registry, no downtime beyond a service restart.
set -euo pipefail

HOST="${HOST:?set HOST=<server ip>}"
KEY="${KEY:-$HOME/Desktop/private.key}"
USER_="${SSH_USER:-ubuntu}"
PROJECT=orderloom
SERVICES=(http_server ws price_poller)

SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new)
SSH=(ssh "${SSH_OPTS[@]}" "${USER_}@${HOST}")

echo "==> syncing source"
for s in "${SERVICES[@]}"; do
  rsync -az --delete \
    --exclude node_modules --exclude .env \
    -e "ssh ${SSH_OPTS[*]}" \
    "./${s}/" "${USER_}@${HOST}:/srv/${PROJECT}/${s}/"
done

# Units and the Caddy site used to be copied by hand, so the repo and the box
# drifted silently. Sync them too, and only reload what actually changed.
echo "==> syncing deploy config"
rsync -az -e "ssh ${SSH_OPTS[*]}" ./deploy/ "${USER_}@${HOST}:/srv/${PROJECT}/deploy/"
"${SSH[@]}" bash -euo pipefail <<EOF
  cd /srv/${PROJECT}/deploy
  chmod +x *.sh
  changed=0
  for f in apps/${PROJECT}/*.service apps/${PROJECT}/*.timer; do
    [ -e "\$f" ] || continue
    if ! sudo cmp -s "\$f" "/etc/systemd/system/\$(basename "\$f")"; then
      sudo cp "\$f" /etc/systemd/system/; changed=1
    fi
  done
  [ \$changed -eq 1 ] && { sudo systemctl daemon-reload; echo "  systemd units updated"; } || echo "  units unchanged"

  if ! sudo cmp -s apps/${PROJECT}/${PROJECT}.caddy /etc/caddy/sites/${PROJECT}.caddy; then
    sudo cp apps/${PROJECT}/${PROJECT}.caddy /etc/caddy/sites/
    sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 \
      && sudo systemctl reload caddy && echo "  caddy reloaded" \
      || { echo "  CADDY CONFIG INVALID - not reloaded" >&2; exit 1; }
  else
    echo "  caddy unchanged"
  fi
EOF

echo "==> installing deps + migrating"
"${SSH[@]}" bash -euo pipefail <<EOF
  set -a; . /etc/${PROJECT}/${PROJECT}.env; set +a
  # Not --production: price_poller needs the prisma CLI, which is a devDependency.
  for s in ${SERVICES[*]}; do
    cd /srv/${PROJECT}/\$s && bun install --frozen-lockfile
  done
  # accounts on Neon
  cd /srv/${PROJECT}/http_server
  bunx prisma migrate deploy
  # trades on the local TimescaleDB
  cd /srv/${PROJECT}/price_poller
  bunx prisma migrate deploy
  bun seed.ts
EOF

echo "==> restarting services"
"${SSH[@]}" "sudo systemctl restart ${PROJECT}-http ${PROJECT}-ws ${PROJECT}-poller"
sleep 3
"${SSH[@]}" "systemctl is-active ${PROJECT}-http ${PROJECT}-ws ${PROJECT}-poller"

echo "==> done. logs: ssh ... 'journalctl -u ${PROJECT}-http -f'"
