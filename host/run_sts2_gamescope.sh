#!/usr/bin/env bash
# Run Slay the Spire 2 inside a headless gamescope "room".
#
# The game gets its own embedded Xwayland display and always believes it has
# focus while the gateway captures screenshots through gamescopectl. The host
# gateway and STS2MCP communicate over the mod's loopback HTTP API.
set -euo pipefail

GAME_DIR="${STS2_GAME_DIR:-$HOME/.local/share/Steam/steamapps/common/Slay the Spire 2}"
WIDTH="${STEAMBENCH_ROOM_WIDTH:-1920}"
HEIGHT="${STEAMBENCH_ROOM_HEIGHT:-1080}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$REPO_DIR/.runtime/gamescope-sts2.log"

[[ -x "$GAME_DIR/SlayTheSpire2" ]] || { echo "game not found at $GAME_DIR" >&2; exit 1; }
command -v gamescope >/dev/null || { echo "gamescope is not installed" >&2; exit 1; }
pgrep -x SlayTheSpire2 >/dev/null && { echo "SlayTheSpire2 is already running" >&2; exit 1; }
pgrep -x steam >/dev/null || echo "warning: Steam is not running; Steamworks features will be unavailable" >&2

mkdir -p "$REPO_DIR/.runtime"
cd "$GAME_DIR"
export SteamAppId=2868840 SteamGameId=2868840
exec gamescope --backend headless -W "$WIDTH" -H "$HEIGHT" -- ./SlayTheSpire2 >"$LOG" 2>&1
