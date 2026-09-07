# Repository Guidelines & Operational Manual

`steambench` operates containerized autonomous players inside isolated Steam gaming rooms observed on steambench.dev. The primary supported game is **Slay the Spire 2 (STS2)** (Steam App ID `2868840`).

The sole builtin player is **`STS2-Pi-OrcaRouter`** (running `z-ai/glm-5.3-flash-free` via `ORCA_KEY` on `https://api.orcarouter.ai/v1`, image `steambench-learning:latest`).

---

## 1. Operational Safety First

- **Inspect before acting:** Do not restart/recreate the backend server or Wolf, delete active rooms, or inject inputs into a live game without explicit human approval.
- **Startup is destructive:** `RoomManager.init()` deletes leftover player containers and room homes; `connectWolf()` terminates previous sessions. Active rooms live in memory and do not survive a server restart.
- **Native Docker Engine Required:** Always execute Docker commands with `DOCKER_CONTEXT=default`. Docker Desktop VM lacks direct GPU/evdev device passthrough. Never change the user's global Docker context.
- **Protect Personal Steam/Host Data:** Host game installations and Steam data are mounted read-only. Never modify host Steam settings, workshop items, or configuration files.
- **Credentials & Secrets:** Never commit `.env`, `.runtime/`, keys (`ORCA_KEY`, `STEAMBENCH_TOKEN`), or conversation dumps. Protect Steam authentication snapshots in `.runtime/wolf/steam-login`.

---

## 2. Architecture & Runtime Paths

```text
Browser (steambench.dev) -- HTTPS/WS tunnel --> Server :8787 (host network, Docker/Wolf sockets)
  Server --> Wolf lobby: GOW Steam container + virtual display/audio/pad
         --> Observer session: H.264/AAC fMP4 via media FIFOs + JPEG stream + pad input
         --> Player container: OrcaRouter agent (Pi RPC stdin/stdout), skills library mount
  Player --> JSON-line gateway :28771 --> Allowlisted mod state GETs, screenshot, bounded pad actions, room-finish
```

### Room Lifecycle Stages
`creating` -> `login` -> `setup` -> `installing` -> `launching` -> `playing` -> `finished` -> `deleting`.

### Runtime Mount Paths

| Purpose | Host Path | Server-Container Path |
|---|---|---|
| Wolf Socket / Config | `.runtime/wolf/wolf.sock`, `.runtime/wolf/cfg/config.toml` | `/etc/wolf/wolf.sock`, `/etc/wolf/cfg/config.toml` |
| Room Homes | `.runtime/wolf/rooms/<id>` | `/etc/wolf/rooms/<id>` |
| Shared Machine Identity | `.runtime/wolf/machine-id` | `/etc/wolf/machine-id` |
| Saved Room Login | `.runtime/wolf/steam-login` | `/etc/wolf/steam-login` |
| Game & Steam Caches | `.runtime/wolf/cache/game-2868840`, `.runtime/wolf/cache/steam-home` | `/etc/wolf/cache/...` |
| Media FIFOs | `.runtime/wolf/media` | `/etc/wolf/media` |
| History / Mod Artifacts | `.runtime/history`, `.runtime/sts2mcp` | `/etc/steambench/history`, `/opt/sts2mcp` |
| Skill Library (Git) | `.runtime/wolf/learning/library` | `/etc/wolf/learning/library` |

---

## 3. Read-Only Triage & Health Diagnostics

Execute non-destructive inspection commands first:

```sh
# 1. Container status
DOCKER_CONTEXT=default docker ps -a --filter name=steambench

# 2. Server health probe
curl -fsS --max-time 5 http://127.0.0.1:8787/api/health

# 3. Room status (requires STEAMBENCH_TOKEN)
curl -fsS --max-time 5 -H "Authorization: Bearer $STEAMBENCH_TOKEN" http://127.0.0.1:8787/api/rooms
curl -fsS --max-time 60 -H "Authorization: Bearer $STEAMBENCH_TOKEN" "http://127.0.0.1:8787/api/rooms/$ROOM_ID/health"

# 4. Container logs
DOCKER_CONTEXT=default docker logs --tail 100 steambench-server
DOCKER_CONTEXT=default docker logs --tail 100 steambench-wolf
DOCKER_CONTEXT=default docker logs steambench-tunnel 2>&1 | grep -o 'https://[^ ]*\.trycloudflare\.com'

# 5. Player supervisor status
node host/learning-player.mjs status $ROOM_ID
node host/learning-player.mjs inspect $ROOM_ID
```

---

## 4. Player Runtime & Supervisor Contract

The player runtime (`client/learning/`) is configured as follows:
- **Model Identity:** `STS2-Pi-OrcaRouter` using `z-ai/glm-5.3-flash-free` via OrcaRouter (`https://api.orcarouter.ai/v1`, key from system environment variable `ORCA_KEY`).
- **Pi Configuration & Probe Verification:** Provider configuration in `models.json` resolves the key from the environment via `"apiKey": "$ORCA_KEY"`. The capability probe (`node host/learning-decision-probe.mjs`) verifies both text streaming JSON and multimodal image recognition (e.g. color identification) with two HTTP 200 requests to `z-ai/glm-5.3-flash-free` sending zero game inputs.
- **Singleton Execution:** Only one player container (`steambench-player-<id>`) per room.
- **First Failure Pause:** On the first planner, provider, or executor failure, input immediately stops, the virtual pad returns to neutral, incident evidence (before/after states, sensor rings, screenshots) is saved under `scratchpad/incidents/<id>/`, and the player pauses for review.
- **Unresponsive Supervisor Invariant:** If a supervisor or operator is unresponsive, the player MUST remain safely paused. It MUST NOT retry inputs blindly, hammer game controls, or guess recovery actions.
- **Explicit Resume Protocol:** When an incident pauses the player, line-by-line runtime verification in `client/learning/player.mjs` enforces that normal chat RPC (`prompt`/`steer`) throws when `attention || requiresResume` is set. Paused incidents MUST be acknowledged and resumed via explicit supervisor resume RPC:
  ```sh
  node host/learning-player.mjs resume <ROOM_ID> --issue <INCIDENT_ID> --message "reviewed fix description"
  ```
- **Player Reload:** `node host/learning-player.mjs reload <ROOM_ID>` restarts only the player container, restoring state from `scratchpad/checkpoint.json` without resetting the game or room.

---

## 5. Skills & Persistent Learning Library

- **Skill Template & Library:** Shared template at `server/skills/sts2/`. Persistent knowledge is committed to the Git repository at `.runtime/wolf/learning/library/sts2/`.
- **Scratchpad:** Ephemeral single-run state stored at `scratchpad/` (e.g. `facts.json`, `run.md`, `incidents/`). Archived upon room completion and never inherited across seeds.
- **Seed Invariance:** Durable notes under `learned/` must be seed-invariant (mechanics, bestiary intent graphs, card synergies, UI navigation rules) rather than transcripts of specific floor rolls.
- **Retrieval:** Frontmatter `description` and `keys` are indexed by `client/learning/retrieval.mjs` to inject relevant notes into fresh model decisions.

---

## 6. Build Boundaries

- **Player Image:** `DOCKER_CONTEXT=default docker build -f client/Dockerfile -t steambench-learning:latest .`
- **Server Image:** `DOCKER_CONTEXT=default docker compose build server`
- **Dashboard:** `pnpm install && pnpm build`
