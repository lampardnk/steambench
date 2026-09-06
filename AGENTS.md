# Repository Guidelines

steambench lets a containerized agent ("player") play a Steam game inside an isolated "room" and shows everything on a web dashboard. Today the only supported game is Slay the Spire 2 and the reference player is `steambench-pi` (Pi coding agent + OpenRouter Nemotron); the room, player and dashboard layers are meant to be extended to other games and agents.

## Project Structure & Module Organization

- `app/`, `components/`, `lib/` — the Next.js dashboard deployed on Vercel (steambench.dev). It is static: it talks to a steambench server through a URL and token saved in the browser.
- `server/` — the steambench server (Node, runs on the game machine as a container): `lib/rooms.js` (room lifecycle), `lib/wolf.js` (Wolf API client, Moonlight input packets, GStreamer pipelines), `lib/agent.js` (player container in Pi RPC mode → transcript), `lib/gateway.js` (JSON-line gateway for players), `lib/seed.js` (copies the host's game files into a room), `lib/steam.js` (VDF parser, login/library/install detection), `lib/mjpeg.js` / `lib/audio.js` (stream relays), `skills/sts2/` (the skill folder mounted into players), `bin/server.mjs` (HTTP/WS API), `bin/wolf-probe.mjs` (manual Wolf probe).
- `Dockerfile` + `client/` — the reference player image `steambench-pi`: `client/extensions/sts2.ts` (Pi extension with game sensors, pad tools and `run_over`), `client/gateway_client.js`, `client/process_connect.js` (`steambench-host` CLI), `client/steambench-pi` (entrypoint implementing the player contract).
- `host/` — the earlier desktop mode (host gateway with uinput pad, gamescope launcher, STS2MCP install script). Still works for running the game on the desktop without Wolf.
- `docker-compose.yml` — Wolf, the server, and an optional Cloudflare quick tunnel. `.runtime/` holds all state (Wolf config, room homes, history archives, mod build); it is gitignored.

## Architecture

```
browser (steambench.dev) ──HTTPS/WS (tunnel)──▶ steambench-server (host network, docker.sock, wolf.sock)
                                                   ├─ Wolf API: lobby per room = GOW steam container + virtual display/audio/pad
                                                   ├─ observer session per room: MJPEG (video) + MP3 (audio) consumers, pad input packets
                                                   ├─ player container per room (Pi RPC over stdin/stdout, skills mounted at /workspace/skills)
                                                   └─ JSON-line gateway :28771 for players (sts2-get, screenshot, pad-*, room-finish)
```

Room stages: `creating` → `login` → `setup` (game, player, task) → `installing` (game verify/install, mod, player image build) → `launching` → `playing` → `finished` (archived, auto-closes) or `deleting`.

Media: each room's Wolf session produces fragmented MP4 (H.264 from x264 on the CPU, AAC audio) plus a slow JPEG branch. The browser plays the two MP4 tracks in one `<video>` through Media Source Extensions (`components/game-view.tsx`), so there is no seek bar and audio needs only an unmute click; the JPEG branch serves `frame.jpg`/`stream.mjpg` for the player's screenshot tool and as a fallback view. Two constraints shape this: NVENC will not take frames from Wolf's producer (it refuses to negotiate), and `mp4mux` publishes no stream header, so each track is written to a FIFO under `.runtime/wolf/media` that the server opens before the pipeline starts.

Caching: `.runtime/cache/game-<appid>` and `.runtime/cache/steam-home` hold the game and a settled Steam directory; rooms hardlink from them, which takes a cold room from about fifteen minutes to about a minute. The snapshots refresh in the background once a room is playing, at most every twelve hours.

Steam sign-in happens once, ever. The server decodes the sign-in QR out of the room's own video frame (`lib/login.js`), publishes the URL so the dashboard can render a sharp code and a tappable `s.team` link, and clicks the reload button with a virtual mouse when Steam lets the code expire. The desktop client encrypts its stored refresh token per machine, so a token from a browser login cannot be injected; instead every room is created with the same pinned hostname and `/etc/machine-id`, the first successful login is snapshotted to `.runtime/wolf/steam-login`, and later rooms replay it and reach `setup` without a QR. Steam's data root inside the room is `~/.steam/steam` (not `~/.steam`); everything goes through `steamRoot()` in `lib/steam.js`.

## Build, Test, and Development Commands

Use the **native docker engine** (`DOCKER_CONTEXT=default`); the default Docker Desktop context is a VM without GPU or input devices.

- One-time: build the Nvidia driver volume (`curl .../gow/master/images/nvidia-driver/Dockerfile | docker build -t gow/nvidia-driver:latest --build-arg NV_VERSION=$(cat /sys/module/nvidia/version) -f - .` then `docker create --rm --mount source=nvidia-driver-vol,destination=/usr/nvidia gow/nvidia-driver:latest sh`), build the mod (`bash host/install_sts2mcp.sh build`), and write `.env` with `STEAMBENCH_TOKEN` and `OPENROUTER_API_KEY`.
- `docker build -t steambench-pi .` — build the reference player.
- `docker compose up -d` — start Wolf and the server (`docker compose build server` after server changes). The server provisions observer clients in Wolf's config on first start and restarts Wolf once.
- `docker compose --profile tunnel up -d tunnel && docker logs steambench-tunnel | grep trycloudflare` — public URL for the dashboard (changes on every restart; paste it into the dashboard settings with the token).
- `curl -H "Authorization: Bearer $STEAMBENCH_TOKEN" localhost:8787/api/rooms` — API check; `POST /api/rooms {name}` creates a room, `POST /api/rooms/:id/setup {game, player, task}` configures it, `DELETE /api/rooms/:id` archives and removes it, `GET /api/history` lists archives, `GET/DELETE /api/login` shows or forgets the saved Steam login, `POST /api/rooms/:id/click {x,y}` clicks in the room (room pixels).
- `node server/bin/wolf-probe.mjs list|lobby|observe|frame|press|stop` — poke Wolf directly (socket `.runtime/wolf/wolf.sock`, chmod 666 by the server).
- Dashboard: `npx -y pnpm@10 install && npx -y pnpm@10 build`; Vercel deploys `main` automatically.
- Player contract test: `printf '{"type":"get_state","id":"1"}\n' | docker run -i --rm -e STEAMBENCH_PLAYER_MODE=rpc -e OPENROUTER_API_KEY steambench-pi`.

## Coding Style & Naming Conventions

Server and client code is plain ESM/CommonJS JavaScript with no build step (Node 24), two-space indentation, single quotes, one module per concern. Dashboard code is TypeScript + Tailwind, client components only. Uppercase Dockerfile instructions, `&&`-chained cleanup steps. Container names: `steambench-wolf`, `steambench-server`, `steambench-room-<id>_<lobby>`, `steambench-player-<id>`.

## Testing Guidelines

No test framework yet. Before pushing: `node --check` on changed server files, `pnpm build` for the dashboard, `docker build` for changed images, then a manual room: create → login stage reached with frames (`GET /api/rooms/:id/frame.jpg`) and audio (`audio.mp3`), setup → `playing`, chat round trip, `DELETE` leaves no `steambench-room-*`/`steambench-player-*` containers and writes an archive under `.runtime/history/`.

## Security & Configuration

Never commit `.env`, `.runtime/`, or API keys. The server has the docker socket and Wolf socket: keep its port behind the token and a tunnel you control. Players only get the JSON-line gateway (GET-only mod proxy, bounded pad presses, the room's video frame) and a skills mount; they have no host access. Steam credentials are never copied out of a room; each room signs in via QR code and its home is deleted with the room. Wolf's virtual pads are ignored by the room's Steam (`SDL_GAMECONTROLLER_IGNORE_DEVICES`) so the game reads them directly.

## Commit & Pull Request Guidelines

Concise imperative subjects (`Add room history archive`). Describe image, runtime, or API changes; include the commands you ran; never include keys or archives.
