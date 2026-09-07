# Repository Guidelines

steambench lets a containerized agent ("player") play a Steam game inside an isolated "room", observed on steambench.dev. Supported game: Slay the Spire 2 (STS2, appid `2868840`). Players: `steambench-pi` (Pi + OpenRouter Nemotron) and experimental `STS2-Pi-Luna-v0.1` (Pi + OpenRouter `openai/gpt-5.6-luna`, max reasoning). The learning player supersedes the earlier Astra/medium configuration; internal `astra` paths remain compatibility identifiers. Keep room, player, and dashboard interfaces extensible.

## Operational Safety First

- Inspect before acting. Do not restart/recreate the server or Wolf, delete rooms, or inject input into an active game without explicit approval. Even startup is destructive: `RoomManager.init()` removes leftover players and room homes; `connectWolf()` stops old sessions/lobbies. Rooms live in memory and do not survive server restart. This is not a harmless reconnect.
- Use the **native Docker engine**: prefix Docker commands with `DOCKER_CONTEXT=default`. Docker Desktop is a VM without the required host GPU/input devices. Do not change the user's global Docker context.
- Minimize host changes. Personal Steam/game directories are mounted read-only into the server. Do not modify their files, Steam settings, Workshop subscriptions, or host services to debug a room.
- Treat historical conversation claims as leads, not current state. Recheck code, image versions, and read-only status. Do not reuse old room IDs or tunnel URLs.
- Never commit `.env`, `.runtime/`, keys, credentials, or raw conversation dumps. `previous_work.txt` contains a plaintext backend token; do not copy it into documentation.

## Code Map and Runtime Paths

- `app/`, `components/`, `lib/backend.ts`: Next.js dashboard; connects directly to the backend URL/token saved in the browser. `components/game-view.tsx` owns MSE playback; `components/steam-login.tsx` renders the QR; `components/learning.tsx` renders the skill library's commits and files. The room page is a single column of three: video, chat (with a learning tab), and one collapsed **Debug** section holding room data, log, controller and health.
- `server/lib/library.js`: the git-backed skill library that outlives rooms. `server/lib/web.js`: allowlisted reference fetching for the player.
- `server/lib/rooms.js`: lifecycle, readiness, HTTP mod forwarder, player kickoff, state mapping, health, archives, pad operations. `server/bin/server.mjs`: HTTP/WS API and configuration defaults.
- `server/lib/wolf.js`: Wolf socket API, Moonlight packet encoding, GStreamer pipelines. `server/lib/fmp4.js`: FIFO-to-fMP4 relay; `server/lib/mjpeg.js`: JPEG reader. There is no current `server/lib/audio.js`.
- `server/lib/seed.js`, `server/lib/cache.js`, `server/lib/steam.js`, `server/lib/login.js`: seeding/login snapshots, hardlink caches, Steam path/VDF parsing, QR decoding respectively.
- `server/lib/agent.js`: player container and Pi JSONL RPC → transcript. `server/lib/gateway.js`: per-room-token JSON-line gateway. `client/extensions/sts2.ts`: player sensors, pad tools, `run_over`.
- `Dockerfile`, `client/steambench-pi`: reference player image/entrypoint. `server/Dockerfile`: backend image, including `server/skills/sts2/`. `host/`: older desktop mode; do not transplant its input settings into Wolf rooms.

Default Compose paths (environment overrides exist; Docker bind mounts resolve on the **host**, not inside the server):

| Purpose | Host path | Server-container path |
|---|---|---|
| Wolf socket/config | `.runtime/wolf/wolf.sock`, `.runtime/wolf/cfg/config.toml` | `/etc/wolf/wolf.sock`, `/etc/wolf/cfg/config.toml` |
| Room homes | `.runtime/wolf/rooms/<id>` | `/etc/wolf/rooms/<id>` |
| Shared machine identity | `.runtime/wolf/machine-id` | `/etc/wolf/machine-id` |
| Saved room login | `.runtime/wolf/steam-login` | `/etc/wolf/steam-login` |
| Game/Steam caches | `.runtime/wolf/cache/game-2868840`, `.runtime/wolf/cache/steam-home` | `/etc/wolf/cache/...` |
| Media FIFOs | `.runtime/wolf/media` | `/etc/wolf/media` |
| History / mod artifacts | `.runtime/history`, `.runtime/sts2mcp` | `/etc/steambench/history`, `/opt/sts2mcp` |

A room home mounts at `/home/retro`; its Steam **data root** is `/home/retro/.steam/steam`. Use `steamRoot(home)` from `server/lib/steam.js`, not hand-built `.steam` paths. Player skills mount at `/workspace/skills`.

## Architecture and Read-Only Triage

```text
browser (steambench.dev) -- HTTPS/WS tunnel --> server :8787 (host network, Docker/Wolf sockets)
  server --> Wolf lobby: GOW Steam container + virtual display/audio/pad
         --> observer session: H.264/AAC fMP4 via FIFOs + JPEG branch + pad input
         --> player container: Pi RPC stdin/stdout, skills mount
  player --> JSON-line gateway :28771 --> allowlisted mod GETs, screenshot, bounded pad actions, room-finish
```

Stages: `creating` → `login` → `setup` → `installing` → `launching` → `playing` → `finished` → `deleting`. Errors retain the room for inspection. Default finish grace is 90 seconds before archive/removal.

Start with these read-only checks; authenticated examples assume `STEAMBENCH_TOKEN` and an existing `ROOM_ID` are set locally. Do not print the token or dump container environments.

```sh
DOCKER_CONTEXT=default docker ps -a --filter name=steambench
curl -fsS --max-time 5 http://127.0.0.1:8787/api/health
curl -fsS --max-time 5 -H "Authorization: Bearer $STEAMBENCH_TOKEN" http://127.0.0.1:8787/api/rooms
curl -fsS --max-time 60 -H "Authorization: Bearer $STEAMBENCH_TOKEN" "http://127.0.0.1:8787/api/rooms/$ROOM_ID/health"
DOCKER_CONTEXT=default docker logs --tail 100 steambench-server
DOCKER_CONTEXT=default docker logs --tail 100 steambench-wolf
DOCKER_CONTEXT=default docker logs steambench-tunnel 2>&1 | rg 'https://[^ ]+\.trycloudflare\.com'
```

`GET /api/health` is unauthenticated and reports `ok: true` even with zero observer slots; it is not an end-to-end health guarantee. Per-room health checks container, fresh JPEG/fMP4 video, pad readers, login, install, mod, and player. Also inspect room `stage`, `agentStatus`, `lastState.at`, and `media.audioReady`/fragment progress: green checks do not prove gameplay response or browser sound. Health's player check does not distinguish every stopped state, and it has no dedicated AAC freshness check.

Other read-only routes: `GET /api/meta`, `/api/login`, `/api/cache`, `/api/history`, `/api/rooms/:id`, `/api/rooms/:id/frame.jpg`, and `/api/rooms/:id/sts2?path=/api/v1/singleplayer&format=json`. The last wraps the mod response; parse its `body` as JSON. Logs/state may contain private data; redact before sharing.

## Troubleshooting Quick Lookup

Learning-player design/operations: [ASTRA.md](ASTRA.md). Runtime checkpoint: [ASTRA_HANDOFF.md](ASTRA_HANDOFF.md). Latest source uses OpenRouter GPT-5.6 Luna/max with unrestricted provider routing; see the latest handoff for deployed state. On 2026-09-06 the user approved archiving the older Astra room and deploying the supervisor backend; a new learning room was created. Recheck current rooms/checkpoint before acting; historical smoke runs do not establish full-run reliability.

| Symptom / search terms | Jump to |
|---|---|
| Backend unavailable after reboot; zero observer slots; stale tunnel | [Backend startup and tunnel](#backend-startup-and-tunnel) |
| QR expires/blurs; login succeeds but stage never advances; clicks miss | [Steam login and coordinates](#steam-login-and-coordinates) |
| Game visible, mod not ready; HTTP 404; `ReflectionTypeLoadException` / `LobbyPlayer` | [Mod readiness and wrong DLL](#mod-readiness-and-wrong-dll) |
| Launch waits hundreds of seconds; Steam Input tutorial; duplicate launch dialog | [Launch waits and blocking dialogs](#launch-waits-and-blocking-dialogs) |
| Pad history grows but game ignores buttons; nobody reads evdev | [Controller plumbing](#controller-plumbing) |
| `gateway closed without a response`; only instant tools succeed | [Gateway half-close](#gateway-half-close) |
| No audio until seeking; NVENC negotiation; missing `ftyp`/`moov`; FIFO `EAGAIN` | [Video and audio](#video-and-audio) |
| Slow creation/Steam update; player idle after playing; stale cache/login | [Caching and kickoff latency](#caching-and-kickoff-latency) |
| Old run resumed; player crash called a loss; archive has empty summary | [Run starts and completion](#run-starts-and-completion) |
| Null/stale floor, HP, gold | [STS2 stats](#sts2-stats) |
| Astra setup/model smoke; missing Pi SDK package; self-target confirmation; enemy IDs renumber; memory compatibility | [Astra controls and memory](ASTRA.md) |
| Skills lost when a room is deleted; learning does not carry over; seeing what the agent wrote | [Persistent skill library](#persistent-skill-library) |
| Old Astra idle; HTTP 429; `free_limit_reached` | [Historical Astra quota checkpoint](ASTRA_HANDOFF.md) |
| GLM/OpenRouter 404; incident pause; explicit resume; player-only reload; learning notes | [Learning player supervision](#learning-player-supervision) |

### Backend startup and tunnel

- **Reboot failure:** `/dev/nvidia-caps/*` appeared after Wolf's initial Docker start attempt. Docker did not retry that create failure, leaving Wolf down and the server with no observers. `RoomManager.connectWolf()` now starts Wolf and retries at 15-second intervals during initialization; room creation rejects an unready Wolf. Inspect device existence and logs before intervention. This is not a general live-room recovery guarantee.
- **Dashboard offline while containers are up:** a Cloudflare quick tunnel gets a new URL on restart. Read the current URL from tunnel logs and update browser settings; restarting healthy services only disrupts rooms. A stable named tunnel is not configured by default.
- **Ports:** host Sunshine already owns standard Moonlight ports. Wolf uses HTTP `57989`, HTTPS `57984`, control `57999`, RTSP `58010`, video ping `58100`, audio ping `58200`; preserve Compose overrides.
- **Disk leak:** old startup cleanup removed containers but left multi-GB homes. `init()` now removes orphan homes too. Do not restart just to reclaim space: active room homes are also lost. Inspect first and arrange cleanup separately.

Sources: `server/lib/rooms.js` (`init`, `connectWolf`, `_ensureObserverClients`), `docker-compose.yml`. Historical fixes: `dee9a54`, `8511c96`.

### Steam login and coordinates

- **Wrong path:** reading `~/.steam` instead of `~/.steam/steam` hid successful login and preseeded installs, and left QR reload clicks running on the library. All Steam lookups must use `steamRoot()`.
- **Expired QR:** `decodeLoginQr()` decodes the room's JPEG; the UI renders a sharp QR and tappable `s.team` link. `_watchQr()` reloads a code that stops decoding. It gates clicks to the login stage, a recent-code window, and a cooldown, with only three fallback attempts after a three-minute first-code grace. Preserve these guards to avoid clicking Steam boot/library screens.
- **Mouse at half scale:** Wolf maps absolute input using the observer session's display mode. Earlier 640×360 sessions against a 1280×720 room caused misses. Sessions now use room dimensions; decoded JPEG coordinates are scaled to room pixels. Keep `addSession()`, `click()`, and `encodeMouseMoveAbs()` coordinate spaces consistent; absolute mouse fields are big-endian.
- **Login reuse:** a browser refresh token or personal host Steam login is not an injectable desktop login. Room-to-room reuse works by pinning hostname `steambench-room` and `/etc/machine-id`, then copying the room's own encrypted client state (`local.vdf`/ConnectCache, config/userdata, machine-auth files). Snapshots live in the login template and Steam-home cache. Tokens can expire/be revoked; do not promise "once, ever".
- **Current caveat:** `forgetLogin()` deletes only the login template. `seedSteamHome()` takes precedence over that template, so cached Steam credentials can still be reused. Do not claim `DELETE /api/login` fully signs out or revokes a session; inspect both stores. Clearing credentials/cache is a separate, explicitly authorized operation.

Sources: `server/lib/steam.js`, `server/lib/seed.js`, `server/lib/login.js`, `server/lib/rooms.js` (`_watchQr`, `_watchLogin`, `click`). Historical fixes: `3e72580`, `65479c5`.

### Mod readiness and wrong DLL

Distinguish three layers: visible game process, mod answering **inside** the room, and mod answering through the forwarder. Visible gameplay does not prove the mod loaded.

- **404 only from outside:** the mod binds loopback and its .NET HTTP listener requires `Host: 127.0.0.1:<modPort>`. A raw TCP proxy forwarded the container-IP Host and got 404; substituting `localhost` was not reliable either. `FORWARDER_PY` is an HTTP proxy that rewrites Host and forces `Connection: close`. Preserve both, not just the socket destination. The ready probe is `/` (hello), state is `/api/v1/singleplayer?format=json`.
- **Dead forwarder:** `_repairForwarder()` first checks `http://127.0.0.1:<modPort>/` inside the room; only if that works does it restart the tagged forwarder, with a 45-second cooldown. Do not restart the game to fix a failed proxy.
- **Mod-load error / `ReflectionTypeLoadException` mentioning `LobbyPlayer`:** published STS2MCP 0.4.0 failed on game v0.111. The known compatible PR #132 fork is pinned in `host/install_sts2mcp.sh` and built against the installed game assemblies. This is a historical version pairing, not a promise of compatibility with later game updates.
- **Correct build, wrong artifact installed:** `.runtime/sts2mcp/STS2_MCP.dll` could still be the broken release while the good DLL was under `.runtime/sts2mcp/src/out/`. Cache seeding removes `mods/`, exposing the stale fallback rather than inheriting the host's good DLL. `_install()` now prefers `src/out/` over the mod-directory root. Compare actual room DLL hashes with both sources; check the manifest too (its fallback is selected separately).
- **Evidence:** inspect the room's `.local/share/SlayTheSpire2/logs/godot.log`; `modLoadError()` surfaces `Exception thrown while loading mod` as a room error rather than silently waiting. BaseLib loading does not prove STS2MCP loaded. Workshop content is copied from the host; STS2MCP is installed directly, not managed by Workshop.
- **Build vs install:** `DOCKER_CONTEXT=default bash host/install_sts2mcp.sh build` builds in a .NET 9 SDK container with the game mounted read-only. Running the script with no argument or `install` modifies the **personal host game**, and is not required to populate Wolf rooms. `--check` targets the desktop mod port/log, not an arbitrary room. Do not run these as interchangeable health probes.

Sources: `server/lib/rooms.js` (`FORWARDER_PY`, `_install`, `_repairForwarder`, `modLoadError`), `host/install_sts2mcp.sh`. Historical fixes: `f1b51c8`, `44526be`.

### Launch waits and blocking dialogs

- A fresh Steam client can download roughly 500 MB before game launch. The old six-minute readiness deadline made this a permanent error. `_watchLaunch()` now keeps waiting and nudges `steam://rungameid/...` every three minutes **only when `_gameRunning()` is false**. Reissuing it while the game runs produces a blocking Steam error dialog.
- Steam's first-run "Steam Input Games" explainer can block launch even with a working pad. After 45 seconds, launch logic sends at most 12 `a` presses, spaced at least 15 seconds apart, **only while the game process is absent**. Never turn this into unconditional menu clicking.
- Once playing, login/Steam snapshots retain settled settings to reduce repeated tutorials. `POST /api/rooms/:id/retry` retries launch after errors but is mutating, may send inputs, and does not reinstall a replaced mod. Use only after diagnosing the failing layer and obtaining approval for an active room.

Source: `server/lib/rooms.js` (`_watchLaunch`, `_gameRunning`, `retryLaunch`). Historical fixes: `f1b51c8`, `e19c0a6`.

### Controller plumbing

- **Root cause of ignored presses:** desktop mode used `SDL_GAMECONTROLLER_IGNORE_DEVICES` so Godot could read evdev directly. In Wolf rooms Steam Input must own the virtual pad; the ignore list propagated to the game and left nobody reading it. Do **not** set that variable for room pads (the observed Wolf Xbox ID was `0x045e/0x02ea`). Check extra room environment overrides as well.
- **Verify each layer:** pad history/API success → correct observer session joined to lobby → evdev events in host and room → Steam holds an input fd → game responds. Per-room health inspects `/proc/*/fd` for input readers; `read by: steam` is expected. Gateway `pad-status` alone is not this real reader check.
- **False debugging leads:** on this 64-bit host, evdev reads need complete 24-byte `input_event` records; `dd bs=1` produced invalid "no events" results. Wolf's suspected hex reversal canceled itself out; packet encoding was not the fault. Recreating a pad changes its event-device number, so rediscover the device before inspecting it.
- **Legacy probe trap:** `server/bin/wolf-probe.mjs lobby` still includes the old ignore variable, and `observe` creates a 640×360 session. It is not the production room setup; use `Room.start()` as the reference. `list` is read-only; lobby/observe/press/stop commands alter running state.

Sources: `server/lib/rooms.js` (`start`, `health`), `server/lib/wolf.js` (packet encoders). Historical fix: `e19c0a6`.

### Gateway half-close

Symptom: `pad_status` works, but asynchronous state reads or pad presses fail with `gateway closed without a response`. The client writes one JSON line and half-closes its write side. Default Node TCP behavior closed the response side before awaited operations finished. Keep `net.createServer({ allowHalfOpen: true })`; reply with one newline-terminated JSON object and then `socket.end()`. Do not replace it with a default server or treat client EOF as cancellation.

Sources: `server/lib/gateway.js`, `client/gateway_client.js`. Historical fix: `f1b51c8`.

### Video and audio

- **Old audio/seek-bar problem:** separate MJPEG video and MP3 playback had unreliable live-edge/audio behavior. Current path: H.264 + AAC in separate fragmented-MP4 tracks, one browser `<video>` using MSE, no seek bar, muted autoplay with an unmute button. Defaults: 1280×720 at 30 fps, 4 Mbps video, 128 kbps AAC, 500 ms fragments; JPEG branch at 2 fps. `frame.jpg`/`stream.mjpg` remain; there is no current `audio.mp3` route. Stills fallback has no sound.
- **NVENC works alone, fails in Wolf:** `nvh264enc` refused negotiation with Wolf's producer. Standalone encoder success did not establish compatibility with that CUDA context. Keep the proven `cudaconvertscale` → `cudadownload` → `videorate` → `x264enc` path unless testing an actual replacement inside Wolf. Do not force a changed framerate on a scaler; rate conversion follows download.
- **Interpipe tests:** interpipe is process-local; standalone `gst-launch` cannot attach to Wolf's in-process producer. Keep `interpipesrc_{session_id}_video/audio` listening to the session producer. Wolf repoints these when the observer joins a lobby; directly targeting a lobby failed negotiation.
- **Bytes arrive but no init/codecs:** late TCP readers missed `ftyp`/`moov`; `mp4mux` did not publish a replayable stream header. Create/open both FIFOs **before** starting the pipeline. `Fmp4Relay` caches each init segment for new viewers. Do not attach extra readers to live FIFOs: they consume bytes needed by the server.
- **FIFO silent failure / `EAGAIN`:** `fs.createReadStream` failed on a nonblocking FIFO. Use the existing `O_RDWR | O_NONBLOCK` open plus `net.Socket({ fd, readable: true, writable: false })`. Read/write open prevents premature EOF before the producer starts; relay warnings go into the room log.
- **Wrong bytes / address in use:** orphan GStreamer pipelines kept old JPEG/MP3 ports bound, misleading new-pipeline checks. `allocPorts()` probes three consecutive ports instead of blindly reusing them. Do not kill unrelated pipelines or restart Wolf during active rooms.
- **Browser protocol:** `/api/rooms/:id/media` is a WebSocket: JSON `hello` announces codecs; each binary message starts with tag 0 video-init, 1 audio-init, 2 video-fragment, or 3 audio-fragment. Codec examples are `avc1.64001f` and `mp4a.40.2`. Relay bytes/codecs alone do not prove browser decoding, sync, or audible playback.
- **Reconnect:** `GameView` used to display "reconnecting" on socket close and schedule nothing. It now rebuilds the MediaSource and socket with a 1–5 s backoff, falls back to still frames after five consecutive drops, and clears the failure count on the next init segment; "switch to live video" resets it. Browser playback, late joining and audio were still not verified end to end in a browser, so do not treat this as a blanket reliability claim.

Sources: `server/lib/wolf.js` (`roomVideoPipeline`, `roomAudioPipeline`), `server/lib/fmp4.js`, `server/bin/server.mjs` (`attachMediaSocket`), `components/game-view.tsx`. Historical implementation: `44526be`.

### Caching and kickoff latency

- **Slow room creation:** `ensureGameCache()` copies the host game once; `seedGame()` uses `cp -al` hardlinks (real-copy fallback across filesystems). `seedSteamHome()` reuses an already-updated room Steam client. Historical warm-cache creation reached about 60 seconds versus 190–900+ seconds; this is a measurement, not an SLA. Actual default path is `.runtime/wolf/cache`, not `.runtime/cache`.
- **Isolation nuance:** game `mods/` is recreated per room; mutable Steam config, userdata, logs, etc. are privatized before use. Other files remain hardlinked. The implementation assumes Steam replaces shared binaries instead of modifying them in place; do not extend hardlinking to saves/config or assume it is copy-on-write isolation.
- **Player idle for 98 seconds after playing:** a Steam snapshot was awaited before kickoff. `_startPlayer()` now dispatches the prompt and starts state polling before calling background `_refreshCaches()`. Keep expensive copying off the kickoff path. The snapshot still copies a large tree before deleting excluded game/workshop content; background work is not free.
- **Refresh semantics:** Steam-home snapshots have a 12-hour age gate; login templates refresh when playing. The game cache is only filled when missing, **not** refreshed every 12 hours. After a host game update, an existing game cache may remain stale. Compare versions/cache age before arranging a rebuild or explicit `DELETE /api/cache`; do not clear caches as routine inspection.
- **Player image reuse:** builtin rooms use the existing `steambench-pi` image, not a per-room build. Rebuild it after `client/` changes. Custom pasted Dockerfiles are built from stdin without a filesystem context and use per-room image names. Skill source is baked into the server image and copied into each room, so editing it does not update existing room skills automatically.

Sources: `server/lib/cache.js`, `server/lib/seed.js`, `server/lib/rooms.js` (`_install`, `_startPlayer`, `_refreshCaches`). Historical fix: `44526be`.

### Run starts and completion

- **Resuming someone else's run:** seeding copies host game userdata, including possible old saves. The kickoff and `controls/CONTROLS.md` require abandon → confirm → Singleplayer → requested character/ascension → verify floor 1. The previous blanket "never abandon" rule conflicted with this; abandonment is allowed for fresh-start setup, not during ordinary play. This is a player instruction, not a server-enforced save reset.
- **Player process dies, game still alive:** agent `error`/`stopped` during play sets room `error` with "the player stopped", not `finished`. Inspect `PiAgent.exitInfo`/stderr and game state separately; a container exit is not evidence of an in-game loss.
- **Archive recorded `aborted` with empty summary:** the Pi tool callback was mistakenly `execute(params)`; its first argument is the tool-call ID. Keep `run_over.execute(_id, params)`. The gateway now validates `lost`/`won`/`aborted` and a nonblank summary rather than defaulting silently.
- **Reported loss while game still active:** skills require game-over evidence (or main menu with no run), and `finishRun()` records `gameState` beside the player's claim. `disputed` flags a player-reported loss with `inRun && !gameOver`. It uses the last polled state and still finishes the room; it is not a fresh authoritative check or a rejection of false results.
- **Missing final tool call in archive:** archive/removal is delayed until the finish grace expires so the tool response is captured. Archives include room metadata, transcript, pad history, scratchpad, game log, last frame. They are not unlimited history: transcript is capped at 400 items, pad history at 300, with text/result truncation. Old incorrectly recorded outcomes are not automatically repaired.

Sources: `client/extensions/sts2.ts`, `server/lib/agent.js`, `server/lib/rooms.js` (`_startPlayer`, `finishRun`, `archive`, `gatewayOp`), `server/skills/sts2/controls/CONTROLS.md`. Historical fixes: `47223ed`, `44526be`.

### STS2 stats

The original field mapping was guessed. `pickState()` now maps the mod's actual shape: `state_type`, `menu_screen`, `run.act/floor/ascension`, and `player.character/hp/max_hp/gold/energy`. `_watchPlaying()` fetches `/api/v1/singleplayer?format=json` every 15 seconds. Null run stats at the main menu are expected; check `state_type` and `lastState.at` before declaring a polling failure. Polling only runs while playing and retains the last value on errors, so stale stats alone are not current game state. If a new mod version changes shape, inspect its StateBuilder/raw JSON before changing the mapper.

Source: `server/lib/rooms.js` (`pickState`, `_watchPlaying`). Historical fix: `44526be`.

### Persistent skill library

- Room skill folders used to be a throwaway copy of `server/skills/<name>` and were deleted with the room home. `server/lib/library.js` keeps one git repository at `.runtime/wolf/learning/library/` instead: `_install()` checks the room's copy out of it, and the room commits its knowledge edits back while playing and again during `archive()`. `scratchpad/` is deliberately excluded — that is per-run state and belongs to the room's archive.
- The image template is a **seed**, not the source of truth. `ensureSkill()` adds files the library does not have and never overwrites one the player wrote, so rebuilding the server image cannot erase accumulated notes.
- The player writes notes with the `learn` action and reads them with `recall`; the gateway op `skill-commit {message}` records the agent's own commit message and author. Uncommitted edits are committed with a generated message once they have been still for 45 seconds, so nothing is lost if the player never commits.
- Read it back through `GET /api/library`, `/api/library/commits/:hash` and `/api/library/files`; the dashboard shows the same data. The server image needs `git` (added to `server/Dockerfile`); without it the room falls back to the image template and logs why.
- `web-get` fetches one allowlisted reference page (`server/lib/web.js`) for the player's `research` action. Only https, four community hosts, 12k characters, six-hour cache. This is not general internet access for players, and fetched pages are data whose claims can lag the installed build.

### Learning player supervision

- **Luna migration (latest instruction):** the user authorized replacing live rooms after an exact-model dry decision and verified archival. Active source is `STS2-Pi-Luna-v0.1`, `openai/gpt-5.6-luna`, fixed max effort, image `sts2-pi-luna:0.1`, `Dockerfile.luna`. Shared identity/handshake configuration is `server/lib/learning-profile.mjs`. No provider allowlist, exclusions or ordering; keep required-parameter routing and the protected existing key. Older GLM routing/identity entries below are historical.
- **Batching:** up to eight semantic actions; ordinary Attack/Skill plays wait for discard/exhaust publication before the next action (hand removal can precede the pile animation); hand-navigation segments and up to 12 UI directional presses checked at sequence boundaries. Subsequent UI actions need exact screen/focus preconditions. Known startup transitions are verified locally; purchases, event choices, abandonment and unknown transitions end the plan. Draw/random/generated cards, selection prompts, changed/dead targets and combat completion stop the remainder for fresh planning. Actual execution errors pause with no remaining inputs.
- **Missing UI focus:** `map.current_position` is the last visited run location, not highlighted controller focus. Sensor v2 lacks map-node coordinates and semantic labels for generic reward buttons; retain images for those gaps. Ordinary combat and identified menu controls can omit model images.
- **Validation/operator tools:** `npm run test:learning`; `node host/learning-decision-probe.mjs ROOM_ID` audits an actual screenshot request with no game gateway; `node host/learning-supervise.mjs ROOM_ID` observes for at most 15 minutes/three combats and pauses on exit. Only run the latter within authorized gameplay supervision. Model latency and costs must be reported from evidence; zero Pi cost metadata is not free usage.

- **Identity:** `STS2-Pi-GLM-5.3-Flash-v0.1`, OpenRouter `z-ai/glm-5.3-flash`, fixed **max** reasoning; image `sts2-pi-glm-5.3-flash:0.1`, build file `Dockerfile.glm`. Internal setup kind `astra`, metadata field `astraPlayer`, `client/astra/` and skill template `server/skills/sts2-astra/` remain compatibility paths, not the model choice. Checkpoint schema version remains `STS2-Pi-Learn-v0.1`; original Nemotron player/key is unchanged.
- **Stale Astra image/log labels:** the earlier GLM build reused the Astra Docker tag, and setup logs printed the internal kind. New source uses the GLM image/display name and logs exact model/max effort at player startup. Historical logs/archives are not rewritten. An active room's image/name is held in backend memory: source edits or retagging alone do not update its dashboard labels. Schedule an approved room archive/backend recreation; never relabel an old image as if it had changed models.
- **Dedicated key:** local `.runtime/wolf/learning/openrouter.key` (700 parent/600 file), mounted under `/etc/wolf/learning/`; optional `STEAMBENCH_LEARNING_OPENROUTER_API_KEY` overrides it at backend startup. Never print it or include it in images/archives. The new source no longer needs Experiential Labs credentials.
- **Backend startup `ReferenceError: fs is not defined`:** file-backed key loading needs `import fs from 'node:fs'` in `server/bin/server.mjs`. Syntax checks and image builds do not detect missing runtime bindings. This was fixed before creating the GLM room; do not restart a live server just to repeat that test.
- **Direct API succeeds, Pi gets 404 `Filter by Parameters`:** Pi defaults `store`/`max_completion_tokens` conflicted with strict OpenRouter routing. Set `compat.supportsStore: false`, `maxTokensField: "max_tokens"`; preserve `provider.require_parameters: true` and `reasoning.effort: "max"`. Actual Pi streaming/image request was audited successfully. Omitting unsupported `store` does not establish provider data-retention guarantees.
- **Empty reply / `Unexpected end of JSON input`:** the live GLM run received empty assistant content, zero usage and `stop`, not a gameplay failure. Planner now records bounded response metadata/text and provider response ID in the incident; final assistant text is used if deltas were missing. Empty output still pauses with no automatic retry. Inspect the provider stream separately while the game stays paused; do not substitute another model or claim this proves a control fault.
- **First failure stops:** the parent runtime pauses on the first planner/API/executor failure. `report_issue` is standalone and sends zero inputs. Failed focus movement/raw navigation is not repeated. Up to two stale-plan rebuilds are allowed only before any input. Pad neutral releases on pause do not freeze game animations.
- **Evidence before recovery:** `scratchpad/incidents/<timestamp>-<decision>/` contains plan, full before/after states, available JPEGs, recent input attempts/sensors, policy/build identity and event-log offset. `attention.json` points at the issue. Record input attempts before transport acknowledgement: timeout does not prove the game received nothing. No back/end-turn/other-card experiments around an unexplained failure.
- **Operator lookup:** `node host/learning-player.mjs status|watch|inspect ROOM_ID`; `watch --timeout 600` is read-only and exits 2 on an incident. `pause` requests cancellation; wait for idle. After a player rebuild, `reload` replaces only its container, then `resume ROOM_ID --issue INCIDENT_ID --message 'review/fix'` explicitly acknowledges the issue. These routes require the updated backend and cannot migrate the older Astra process without a compatible learning checkpoint.
- **Reload safeguards:** task, startup verification, strategy, counters, incident and transcript survive. Backend checks model/max/checkpoint handshake; no automatic kickoff, game launch or cache refresh. Normal chat cannot resume an incident or operator-paused/reloaded player. Old-agent callbacks and polling generations are guarded. Sensor/backend changes are not player-only hot fixes.
- **Reload Docker name conflict:** closing stdin can trigger `--rm` concurrently with `rm -f`; `rmForce()` swallows the "removal in progress" error, so immediate recreation races name release. `PiAgent.stop()` waits for the exact container name to disappear, bounded to 15 seconds; deployed with the approved GLM-labelled recreation around 13:20 UTC on 2026-09-06. For an older backend, inspect exact-name disappearance before one reviewed reload retry; never restart the server/game. A live retry preserved scene, checkpoint, incident and transcript.
- **Provider routing / 529 overload:** earlier StreamLake-only routing overloaded. Latest user instruction restricts `models.json` to `provider.only: ["baseten", "makora", "modal"]`; fallback stays within this allowlist and account preferences. Keep exact GLM/max, `require_parameters` and compatibility settings. Rebuild/reload only the player after changing the file; source edits do not affect a running container. Isolated Pi/image request auditing verifies both parameters and actual routed provider without game input. Cost metadata remains an estimate, not route-specific billing.
- **429 `upstream_provider_shared_pool`:** a BaseTen smoke succeeded but the first live request exhausted Makora, Modal and BaseTen with upstream pool rate limits. This is not a pad bug or proof of account credit exhaustion. Inspect `metadata.previous_errors`; preserve zero-input incident evidence. A supervised cooldown/retry is permissible, not automatic repeated retries or routing outside the user's allowlist. Provider-native BYOK via OpenRouter is a separate account setup, not something an OpenRouter key alone supplies.
- **Minutes spent on each UI button:** three right-focus moves took about 6.4 minutes/14.5k reasoning tokens, repeatedly tracing the same map. Policy now calls for brief, low-risk UI hypotheses tested promptly; noncombat d-pad batches allow 1–4 locally checked moves, with separate activation and a scene/gameplay barrier. Keep the first-error gate. Use structured mod state, compact persistent route strategy, and omit unchanged full map graphs. Ordinary combat/identified menu controls omit model images; screenshots still provide incident evidence.
- **Map scouting / unchanged JSON:** `scout` is map-only, left/right stick, up/down, 100–600 ms, automatically released by the existing gateway. y=-1 is up, +1 down. Camera movement may not alter mod JSON: mark visual verification pending, not successful gameplay or an automatic input failure. Repeated/no-progress guards remain. Sensor v2 lacks focused map-node coordinates; Godot numeric suffixes are not columns. Do not restart the current game to hot-install a sensor fix.
- **Wiki context:** standalone `lookup` uses STS2MCP `/api/v1/wiki` for cards/relics only, bounded to five results/6000 characters. `client/astra/references.json` contains partial beta-site encounter extracts, selected by observed name/ID, with source/date/version uncertainty. Live intents/options and modified hand text outrank references. Do not inject the entire website or confuse unknown map nodes with known events.
- **Wiki 400 through operator HTTP route:** `/api/rooms/:id/sts2` currently forwards only `path` and `format`, dropping search query/item_type/limit. A wiki search through that route can therefore fail despite a healthy mod. The player's `sts2-get` gateway forwards the complete allowlisted query; a read-only Bash lookup returned 200 with base/upgraded text. Wiki searches are fuzzy and scoped to the active profile's discovered cards/relics, not a complete catalog. Do not restart the backend/game to diagnose this route mismatch.
- **Supervision limit:** the watcher surfaces issues but does not wake a coding LLM after the interactive coding session ends. An unattended issue stays paused; this is not autonomous on-call repair.
- **Learning without context bloat:** every decision requires an evidence/hypothesis note; `learning.jsonl` records it before actions and stores outcomes separately. Only fresh facts, short strategy, latest result, bounded feedback and reviewed compatible lessons enter the next fresh Pi context. Candidates never auto-promote. Game/mod/policy fingerprints reject stale accepted memory; catalog entries retain their provenance across reloads.
- **Control fixes to preserve:** all cards, including Defend, require verified selection/confirmation; null focus can mean `in_card_play`. Enemy display IDs renumber after death: bind `combat_id` and stop at roster changes. Random/draw/return-to-hand effects are barriers. Internal target coordinates are not room pixels. Bundled `pi --mode rpc` works; Pi 0.85.0 SDK imports fail on missing `@earendil-works/pi-server`.
- **Validation boundary:** GLM request smoke and offline failure/reload assertions are not a live GLM run. Historical Astra smoke reached floor 3 with 18 verified plays and zero executor failures; full-run performance/automatic victory remain unverified. Check the handoff before claiming deployment or gameplay success.

Sources: `client/astra/`, `host/learning-player.mjs`, `server/lib/rooms.js`, `server/lib/agent.js`, `server/bin/server.mjs`, [ASTRA.md](ASTRA.md).

## Build, Validation, and Change Boundaries

Run builds/deployment and mutating checks only when appropriate for the requested task; do not disrupt active rooms to validate a documentation change.

- Dashboard: `npx -y pnpm@10 install && npx -y pnpm@10 build`. Vercel deploys `main`; pushing dashboard changes is a production action.
- Player: `DOCKER_CONTEXT=default docker build -t steambench-pi .`. Contract smoke check: `printf '{"type":"get_state","id":"1"}\n' | DOCKER_CONTEXT=default docker run -i --rm -e STEAMBENCH_PLAYER_MODE=rpc -e OPENROUTER_API_KEY steambench-pi`.
- Server: `DOCKER_CONTEXT=default docker compose build server`. Applying it with `docker compose up -d` can recreate the server and lose rooms; schedule separately. There is no source bind mount/hot reload. Changing player code requires a player build; changing server code or skill templates requires a server build.
- Initial runtime setup needs host Nvidia/input devices, an `nvidia-driver-vol` matching the loaded host driver, the mod build described above, and `.env` with `STEAMBENCH_TOKEN`/`OPENROUTER_API_KEY`. Do not rebuild driver volumes during ordinary debugging.
- Optional tunnel startup: `DOCKER_CONTEXT=default docker compose --profile tunnel up -d tunnel`; read its resulting URL from logs. This is not necessary just to discover an already-running tunnel.
- No test framework yet. Use `node --check` for changed server JS/MJS, dashboard build for UI changes, image builds for image changes, and `git diff --check` for docs. Runtime images use Node 24; the host Node version may differ.
- An approved disposable-room smoke test covers create → login/setup → install → playing, fresh state and actual input response, browser fMP4 video **and unmuted audio**, chat round trip, valid `run_over`, archive contents, and deletion leaving no matching room/player containers. Do not treat server-side fragment counts as browser validation.

Mutating API reference: `POST /api/rooms {name}`, `POST /api/rooms/:id/setup {game, player, task}`, `POST /api/rooms/:id/chat {message}`, `POST /api/rooms/:id/retry`, `POST /api/rooms/:id/click {x,y}` (room pixels), `POST /api/rooms/:id/finish {result,summary}`, `DELETE /api/rooms/:id`, `DELETE /api/login`, `DELETE /api/cache`. Room deletion normally archives a room with a player/input history; do not assume an untouched setup room has an archive.

## Coding, Security, and Commits

- Server JS is plain ESM without a build step; client helpers use ESM/CommonJS and the Pi extension is TypeScript. Follow adjacent style: generally two spaces/single quotes in server JS. Dashboard is TypeScript + Tailwind with client-side interaction. Uppercase Dockerfile instructions and `&&`-chained cleanup.
- Container names: `steambench-wolf`, `steambench-server`, `steambench-room-<id>_<lobby>`, `steambench-player-<id>`. Use precise names; never broad cleanup commands against the user's Docker engine.
- The server holds Docker/Wolf sockets and can build supplied Dockerfiles: treat backend access as privileged, keep it behind its token and a tunnel you control. Players are not given Docker/Wolf sockets, host display/input devices, or personal host directories; preserve the per-room gateway allowlist and bounded inputs. The skills mount is writable; "controls/wiki read-only" is a player instruction, not a filesystem-enforced boundary.
- Room-derived Steam credentials **are persisted** in both runtime login snapshots and the Steam cache; personal host Steam credentials are not deliberately seeded. Protect these stores and do not include them in archives, commits, or shared diagnostics. Do not call login-template deletion credential revocation.
- Keep changes focused. Do not commit or push unless requested. Use concise imperative commit subjects (e.g. `Add room history archive`), describe image/runtime/API changes, and list validation commands without secrets.
