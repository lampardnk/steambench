# steambench

steambench runs containerized autonomous players inside isolated Steam game containers ("rooms") observed live via web dashboard. The primary supported game is **Slay the Spire 2 (STS2)** (Steam App ID `2868840`).

---

## Architecture Overview

```text
Browser (Dashboard) <--- HTTPS / WSS ---> steambench-server (:8787)
                                              |
     +----------------------------------------+------------------------------------+
     |                                                                             |
     v                                                                             v
Wolf Session (GOW Container)                                          Player Container (steambench-learning)
  - Virtual Display & Audio (X11 / PulseAudio / GStreamer)              - OrcaRouter LLM Planner (`z-ai/glm-5.3-flash-free`)
  - Virtual Xbox Controller (uinput / evdev via Wolf)                  - Deterministic Action Executor & Sensor Adapter
  - Slay the Spire 2 (Godot 4 Engine + STS2_MCP Mod)                   - Gateway Client (:28771) -> Mod State & Virtual Pad
  - Forwarder Proxy (:28772 -> :12345)                                 - Git-backed Persistent Skill Library Mount
```

### Core Components

1. **Dashboard (`app/`, `components/`, `lib/backend.ts`)**: Next.js web application for real-time video/audio (fMP4/MSE), chat, skill library visualization, and room diagnostics.
2. **Server (`server/bin/server.mjs`, `server/lib/`)**: Node.js backend managing room lifecycles, Wolf Moonlight/GStreamer streaming pipelines, Steam authentication snapshots, and game installations.
3. **Player Runtime (`client/learning/`)**: Containerized autonomous player driven by **OrcaRouter** (`z-ai/glm-5.3-flash-free`) with deterministic execution, incident capture, and curriculum learning.
4. **Game Integration & Mod (`host/learning/McpMod.Steambench.cs`)**: C# Harmony patch for STS2 providing high-fidelity structured state, scene graph queries, and focus graph inspection.

---

## Quick Start & Operations

### Prerequisites
- Docker Engine with NVIDIA Container Toolkit (Context: `DOCKER_CONTEXT=default`).
- Steam account owning Slay the Spire 2.
- Environment configuration: `ORCA_KEY` (system environment variable for OrcaRouter LLM calls) and `STEAMBENCH_TOKEN` in `.env`.

### Building Services

```sh
# Build backend server
DOCKER_CONTEXT=default docker compose build server

# Build learning player image (must pass repository root as build context for COPY paths)
DOCKER_CONTEXT=default docker build -f client/Dockerfile -t steambench-learning:latest .

# Build dashboard (Next.js)
pnpm install && pnpm build
```

### Runtime Triage Commands

```sh
# Container status
DOCKER_CONTEXT=default docker ps -a --filter name=steambench

# Health probes
curl -fsS http://127.0.0.1:8787/api/health
curl -fsS -H "Authorization: Bearer $STEAMBENCH_TOKEN" http://127.0.0.1:8787/api/rooms

# Player supervisor status
node host/learning-player.mjs status <ROOM_ID>
```

For operational safety rules, runtime paths, and troubleshooting procedures, see [AGENTS.md](AGENTS.md).
