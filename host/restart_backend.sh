#!/usr/bin/env bash
# Restart only steambench-server. Wolf and the Cloudflare tunnel stay up.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORCE=false
BUILD=false

usage() {
  cat <<'EOF'
Usage: host/restart_backend.sh [--build] [--force]

  --build  Rebuild the server image before recreating the backend container.
  --force  Restart even when a live room/container is detected. This destroys
           active in-memory rooms and terminates their Wolf sessions.

Without --build, the existing server container is restarted in place.
Wolf and steambench-tunnel are not restarted.
EOF
}

die() {
  echo "restart_backend: $*" >&2
  exit 1
}

for option in "$@"; do
  case "$option" in
    --build) BUILD=true ;;
    --force) FORCE=true ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $option (use --help)" ;;
  esac
done

command -v docker >/dev/null || die 'docker is required'
command -v curl >/dev/null || die 'curl is required'
cd "$ROOT"

# Server startup is destructive: RoomManager discards in-memory rooms and
# reconnecting to Wolf terminates its previous sessions. Check both the API and
# Docker so an unavailable API cannot accidentally turn into permission to
# erase a still-running room.
health="$(curl -fsS --max-time 3 http://127.0.0.1:8787/api/health 2>/dev/null || true)"
api_rooms="$(printf '%s' "$health" | sed -n 's/.*"rooms":[[:space:]]*\([0-9][0-9]*\).*/\1/p')"
running_rooms="$(DOCKER_CONTEXT=default docker ps \
  --filter 'name=steambench-player-' \
  --filter 'name=steambench-room-' \
  --format '{{.Names}}')"

if [[ "$FORCE" != true ]] && { [[ "${api_rooms:-0}" -gt 0 ]] || [[ -n "$running_rooms" ]]; }; then
  [[ -n "$running_rooms" ]] && printf 'Detected running room containers:\n%s\n' "$running_rooms" >&2
  die "a room may be active (API rooms: ${api_rooms:-unknown}); inspect it first, then rerun with --force only if losing it is intended"
fi

if [[ "$FORCE" == true ]] && { [[ "${api_rooms:-0}" -gt 0 ]] || [[ -n "$running_rooms" ]]; }; then
  echo 'WARNING: --force will terminate the active room state.' >&2
fi

if [[ "$BUILD" == true ]]; then
  if [[ -z "${EXPLABS_API_KEY:-}" ]] && ! grep -q '^EXPLABS_API_KEY=.' .env 2>/dev/null; then
    die 'EXPLABS_API_KEY must be present in the environment or .env before recreating the server'
  fi
  echo 'Building and recreating steambench-server (Wolf and tunnel remain up)...'
  DOCKER_CONTEXT=default docker compose build server
  DOCKER_CONTEXT=default docker compose up -d --no-deps --force-recreate server
elif DOCKER_CONTEXT=default docker container inspect steambench-server >/dev/null 2>&1; then
  echo 'Restarting steambench-server (Wolf and tunnel remain up)...'
  DOCKER_CONTEXT=default docker compose restart server
else
  if [[ -z "${EXPLABS_API_KEY:-}" ]] && ! grep -q '^EXPLABS_API_KEY=.' .env 2>/dev/null; then
    die 'EXPLABS_API_KEY must be present in the environment or .env before creating the server'
  fi
  echo 'Creating steambench-server (Wolf and tunnel remain up)...'
  DOCKER_CONTEXT=default docker compose up -d --no-deps server
fi

# The HTTP listener comes up before the Wolf observer pool. Wait for both so a
# successful script exit means the dashboard can create a room immediately.
for _ in $(seq 1 45); do
  health="$(curl -fsS --max-time 2 http://127.0.0.1:8787/api/health 2>/dev/null || true)"
  slots="$(printf '%s' "$health" | sed -n 's/.*"observerSlots":[[:space:]]*\([0-9][0-9]*\).*/\1/p')"
  if [[ -n "$slots" && "$slots" -gt 0 ]]; then
    echo "Backend ready: $health"
    tunnel="$(DOCKER_CONTEXT=default docker logs steambench-tunnel 2>&1 \
      | grep -oE 'https://[^ ]+\.trycloudflare\.com' \
      | tail -n 1 || true)"
    [[ -n "$tunnel" ]] && echo "Tunnel: $tunnel"
    exit 0
  fi
  sleep 2
done

DOCKER_CONTEXT=default docker logs --tail 80 steambench-server >&2 || true
die 'backend did not reconnect to Wolf within 90 seconds'
