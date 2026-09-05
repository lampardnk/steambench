#!/usr/bin/env node
// steambench server: HTTP + WebSocket API for the dashboard, JSON-line
// gateway for player containers, orchestration of Wolf rooms.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { RoomManager } from '../lib/rooms.js';
import { startGateway } from '../lib/gateway.js';
import { NVIDIA_BUFFER_CAPS } from '../lib/wolf.js';
import { SUPPORTED_GAMES } from '../lib/steam.js';

const env = process.env;
const log = (...a) => console.log(new Date().toISOString(), ...a);
const TOKEN = env.STEAMBENCH_TOKEN;
if (!TOKEN) { console.error('STEAMBENCH_TOKEN is required'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));

const cfg = {
  log,
  wolfSocket: env.WOLF_SOCKET_PATH || '/etc/wolf/wolf.sock',
  wolfConfigFile: env.WOLF_CFG_FILE || '/etc/wolf/cfg/config.toml',
  wolfContainer: env.WOLF_CONTAINER || 'steambench-wolf',
  runtimeDir: env.STEAMBENCH_RUNTIME_DIR || '/etc/wolf',
  hostRuntimeDir: env.STEAMBENCH_HOST_RUNTIME_DIR || '/etc/wolf',
  roomsDir: env.STEAMBENCH_ROOMS_DIR || '/etc/wolf/rooms',
  roomsRel: env.STEAMBENCH_ROOMS_REL || 'rooms',
  // The docker daemon resolves bind mounts on the host, so player containers need the host path of the rooms dir.
  hostRoomsDir: env.STEAMBENCH_HOST_ROOMS_DIR || path.join(env.STEAMBENCH_HOST_RUNTIME_DIR || '/etc/wolf', 'rooms'),
  historyDir: env.STEAMBENCH_HISTORY_DIR || '/etc/steambench/history',
  loginTemplateDir: env.STEAMBENCH_LOGIN_TEMPLATE || '/etc/wolf/steam-login',
  skillsDir: env.STEAMBENCH_SKILLS_SRC || path.join(here, '..', 'skills'),
  modDir: env.STEAMBENCH_MOD_DIR || '/opt/sts2mcp',
  hostSteam: env.STEAMBENCH_HOST_STEAM || '/host/steam',
  hostSteamOriginalPath: env.STEAMBENCH_HOST_STEAM_PATH || '',
  hostSts2: env.STEAMBENCH_HOST_STS2 || '/host/sts2',
  roomImage: env.STEAMBENCH_ROOM_IMAGE || 'ghcr.io/games-on-whales/steam:edge',
  roomExtraEnv: (env.STEAMBENCH_ROOM_ENV || '').split(';').map((s) => s.trim()).filter(Boolean),
  agentImage: env.STEAMBENCH_AGENT_IMAGE || 'steambench-pi',
  gatewayForAgents: env.STEAMBENCH_GATEWAY_FOR_AGENTS || 'host.docker.internal:28771',
  openrouterKey: env.OPENROUTER_API_KEY || '',
  model: env.STEAMBENCH_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
  visionModel: env.STEAMBENCH_VISION_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  renderNode: env.WOLF_RENDER_NODE || '/dev/dri/renderD128',
  bufferCaps: env.WOLF_VIDEO_BUFFER_CAPS || NVIDIA_BUFFER_CAPS,
  roomWidth: Number(env.STEAMBENCH_ROOM_WIDTH || 1280), roomHeight: Number(env.STEAMBENCH_ROOM_HEIGHT || 720), roomFps: Number(env.STEAMBENCH_ROOM_FPS || 60),
  streamWidth: Number(env.STEAMBENCH_STREAM_WIDTH || 960), streamHeight: Number(env.STEAMBENCH_STREAM_HEIGHT || 540), streamFps: Number(env.STEAMBENCH_STREAM_FPS || 5), streamQuality: Number(env.STEAMBENCH_STREAM_QUALITY || 80),
  audioBitrate: Number(env.STEAMBENCH_AUDIO_BITRATE || 128),
  portBase: Number(env.STEAMBENCH_PORT_BASE || 39000),
  maxRooms: Number(env.STEAMBENCH_MAX_ROOMS || 4),
  finishGraceS: Number(env.STEAMBENCH_FINISH_GRACE_S || 90),
};
const PORT = Number(env.PORT || 8787);
const GATEWAY_PORT = Number(env.STEAMBENCH_GATEWAY_PORT || 28771);
if (!cfg.openrouterKey) log('warning: OPENROUTER_API_KEY is empty; the built-in player cannot call its model');

const manager = new RoomManager(cfg);
startGateway({ port: GATEWAY_PORT, resolveInstance: (t) => manager.resolveToken(t), log });

// ---- HTTP helpers ----
function cors(res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'authorization, content-type');
  res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
}
function json(res, status, body) { cors(res); res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); }
function tokenOf(req, url) { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? h.slice(7).trim() : url.searchParams.get('token') || ''; }
function authorized(req, url) { return tokenOf(req, url) === TOKEN; }
async function readJson(req) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 2e6) throw new Error('body too large'); }
  return body ? JSON.parse(body) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
    if (url.pathname === '/api/health') return json(res, 200, { ok: true, rooms: manager.rooms.size, observerSlots: manager.observerClients.length });
    if (parts[0] !== 'api') return json(res, 404, { error: 'not found' });
    if (!authorized(req, url)) return json(res, 401, { error: 'unauthorized' });

    if (parts[1] === 'login' && parts.length === 2) {
      if (req.method === 'GET') return json(res, 200, { login: manager.loginInfo() });
      if (req.method === 'DELETE') { manager.forgetLogin(); return json(res, 200, { ok: true }); }
    }
    if (parts[1] === 'meta' && req.method === 'GET') {
      return json(res, 200, { savedLogin: manager.loginInfo(), games: Object.entries(SUPPORTED_GAMES).map(([key, g]) => ({ key, appid: g.appid, name: g.name })), characters: ['Ironclad', 'Silent', 'Defect', 'Necrobinder', 'Regent'], builtinPlayer: { name: 'steambench-pi (Pi + Nemotron)', model: cfg.model, visionModel: cfg.visionModel }, maxRooms: cfg.maxRooms, observerSlots: manager.observerClients.length });
    }
    if (parts[1] === 'history') {
      if (parts.length === 2) return json(res, 200, { history: manager.history() });
      const entry = manager.historyEntry(parts[2]);
      return entry ? json(res, 200, entry) : json(res, 404, { error: 'no such archive' });
    }
    if (parts[1] === 'rooms' && parts.length === 2) {
      if (req.method === 'GET') return json(res, 200, { rooms: manager.list() });
      if (req.method === 'POST') { const body = await readJson(req); const room = await manager.create(body); return json(res, 201, room.summary()); }
    }
    if (parts[1] === 'rooms' && parts.length >= 3) {
      const room = manager.get(parts[2]);
      if (!room) return json(res, 404, { error: 'no such room' });
      const sub = parts[3];
      if (!sub && req.method === 'GET') return json(res, 200, { ...room.summary(), transcript: room.agent?.transcript || [], padHistory: room.padHistory, log: room.log });
      if (!sub && req.method === 'DELETE') { await manager.remove(room.id, { keepHome: url.searchParams.get('keepHome') === '1', reason: 'deleted by user' }); return json(res, 200, { ok: true, archive: room.archiveDir ? path.basename(room.archiveDir) : null }); }
      if (sub === 'setup' && req.method === 'POST') { const body = await readJson(req); return json(res, 200, await room.applySetup(body)); }
      if (sub === 'library' && req.method === 'GET') return json(res, 200, { games: room.library(), login: room.login });
      if (sub === 'chat' && req.method === 'POST') { const body = await readJson(req); if (!body.message) return json(res, 400, { error: 'message required' }); await room.chat(String(body.message)); return json(res, 200, { ok: true }); }
      if (sub === 'abort' && req.method === 'POST') { await room.agent?.abort(); return json(res, 200, { ok: true }); }
      if (sub === 'click' && req.method === 'POST') { const body = await readJson(req); await room.click(Number(body.x), Number(body.y)); return json(res, 200, { ok: true }); }
      if (sub === 'finish' && req.method === 'POST') { const body = await readJson(req); return json(res, 200, await room.finishRun({ result: body.result || 'aborted', summary: body.summary || 'finished from the dashboard', by: 'user' })); }
      if (sub === 'frame.jpg' && req.method === 'GET') {
        const frame = room.reader?.latest;
        if (!frame) return json(res, 503, { error: 'no frame yet' });
        cors(res); res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store', 'content-length': frame.length }); return res.end(frame);
      }
      if (sub === 'stream.mjpg' && req.method === 'GET') return streamMjpeg(room, req, res);
      if (sub === 'audio.mp3' && req.method === 'GET') {
        if (!room.audio) return json(res, 503, { error: 'no audio yet' });
        cors(res); res.writeHead(200, { 'content-type': 'audio/mpeg', 'cache-control': 'no-store', connection: 'close' }); room.audio.attach(res); return;
      }
      if (sub === 'sts2' && req.method === 'GET') { const result = await room.gatewayOp('sts2-get', { path: url.searchParams.get('path') || '/', query: url.searchParams.get('format') ? { format: url.searchParams.get('format') } : {} }); return json(res, 200, result); }
    }
    return json(res, 404, { error: 'not found' });
  } catch (e) {
    log('http error', req.method, url.pathname, e.message);
    return json(res, e.status || 500, { error: e.message, code: e.code });
  }
});

function streamMjpeg(room, req, res) {
  cors(res);
  res.writeHead(200, { 'content-type': 'multipart/x-mixed-replace; boundary=steambench', 'cache-control': 'no-store', connection: 'close' });
  let last = 0;
  const send = (frame) => {
    const now = Date.now();
    if (now - last < 1000 / cfg.streamFps - 5) return;
    last = now;
    res.write(`--steambench\r\ncontent-type: image/jpeg\r\ncontent-length: ${frame.length}\r\n\r\n`);
    res.write(frame);
    res.write('\r\n');
  };
  if (room.reader?.latest) send(room.reader.latest);
  room.on('frame', send);
  const cleanup = () => room.off('frame', send);
  req.on('close', cleanup);
  res.on('close', cleanup);
}

// ---- WebSocket ----
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  if (!authorized(req, url)) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return socket.destroy(); }
  if (parts[0] === 'api' && parts[1] === 'rooms' && parts[3] === 'ws') {
    const room = manager.get(parts[2]);
    if (!room) { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); return socket.destroy(); }
    return wss.handleUpgrade(req, socket, head, (ws) => attachRoomSocket(ws, room));
  }
  if (parts[0] === 'api' && parts[1] === 'events') {
    return wss.handleUpgrade(req, socket, head, (ws) => {
      const push = () => ws.readyState === ws.OPEN && ws.send(JSON.stringify({ type: 'rooms', rooms: manager.list() }));
      push(); manager.on('rooms', push); ws.on('close', () => manager.off('rooms', push));
    });
  }
  socket.destroy();
});

function attachRoomSocket(ws, room) {
  const send = (obj) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); };
  send({ type: 'snapshot', room: room.summary(), transcript: room.agent?.transcript || [], padHistory: room.padHistory, log: room.log });
  const handlers = {
    'agent:item': (item) => send({ type: 'item', item }),
    'agent:delta': (d) => send({ type: 'delta', ...d }),
    'agent:status': (s) => send({ type: 'agent_status', status: s }),
    pad: (e) => send({ type: 'pad', event: e }),
    room: (s) => send({ type: 'room', room: s }),
    log: (line) => send({ type: 'log', line }),
  };
  for (const [ev, fn] of Object.entries(handlers)) room.on(ev, fn);
  const timer = setInterval(() => send({ type: 'room', room: room.summary() }), 5000);
  ws.on('message', async (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
    try {
      if (msg.type === 'chat' && msg.message) await room.chat(String(msg.message));
      else if (msg.type === 'abort') await room.agent?.abort();
    } catch (e) { send({ type: 'error', message: e.message }); }
  });
  ws.on('close', () => { clearInterval(timer); for (const [ev, fn] of Object.entries(handlers)) room.off(ev, fn); });
}

await manager.init(log);
server.listen(PORT, '0.0.0.0', () => log(`steambench server listening on :${PORT} (rooms ${cfg.roomsDir}, host rooms ${cfg.hostRoomsDir}, player image ${cfg.agentImage})`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    log(`${sig}: closing rooms`);
    await Promise.allSettled([...manager.rooms.keys()].map((id) => manager.remove(id, { keepHome: true, reason: 'server shutdown' })));
    process.exit(0);
  });
}
