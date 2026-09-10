#!/usr/bin/env node
// steambench server: HTTP + WebSocket API for the dashboard, JSON-line
// gateway for player containers, orchestration of Wolf rooms.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { RoomManager } from '../lib/rooms.js';
import { startGateway } from '../lib/gateway.js';
import { NVIDIA_BUFFER_CAPS } from '../lib/wolf.js';
import { SUPPORTED_GAMES } from '../lib/steam.js';
import { PROFILE as learningProfile } from '../lib/learning-profile.mjs';
import * as library from '../lib/library.js';
import { WEB_ALLOWLIST } from '../lib/web.js';

const env = process.env;
const log = (...a) => console.log(new Date().toISOString(), ...a);
const TOKEN = env.STEAMBENCH_TOKEN;
if (!TOKEN) { console.error('STEAMBENCH_TOKEN is required'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
import { learningReadiness } from '../lib/readiness.mjs';
const learningKey = env[learningProfile.apiKeyEnv] || '';

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
  cacheDir: env.STEAMBENCH_CACHE_DIR || '/etc/wolf/cache',
  mediaDir: env.STEAMBENCH_MEDIA_DIR || '/etc/wolf/media',
  hostMediaDir: env.STEAMBENCH_HOST_MEDIA_DIR || path.join(env.STEAMBENCH_HOST_RUNTIME_DIR || '/etc/wolf', 'media'),
  skillsDir: env.STEAMBENCH_SKILLS_SRC || path.join(here, '..', 'skills'),
  modDir: env.STEAMBENCH_MOD_DIR || '/opt/sts2mcp',
  hostSteam: env.STEAMBENCH_HOST_STEAM || '/host/steam',
  hostSteamOriginalPath: env.STEAMBENCH_HOST_STEAM_PATH || '',
  hostSts2: env.STEAMBENCH_HOST_STS2 || '/host/sts2',
  roomImage: env.STEAMBENCH_ROOM_IMAGE || 'ghcr.io/games-on-whales/steam:edge',
  roomExtraEnv: (env.STEAMBENCH_ROOM_ENV || '').split(';').map((s) => s.trim()).filter(Boolean),
  learningImage: learningProfile.image,
  learningProfile,
  learningKey,
  gatewayForAgents: env.STEAMBENCH_GATEWAY_FOR_AGENTS || 'host.docker.internal:28771',
  renderNode: env.WOLF_RENDER_NODE || '/dev/dri/renderD128',
  bufferCaps: env.WOLF_VIDEO_BUFFER_CAPS || NVIDIA_BUFFER_CAPS,
  roomWidth: Number(env.STEAMBENCH_ROOM_WIDTH || 1280), roomHeight: Number(env.STEAMBENCH_ROOM_HEIGHT || 720), roomFps: Number(env.STEAMBENCH_ROOM_FPS || 60),
  streamWidth: Number(env.STEAMBENCH_STREAM_WIDTH || 1280), streamHeight: Number(env.STEAMBENCH_STREAM_HEIGHT || 720), streamFps: Number(env.STEAMBENCH_STREAM_FPS || 30), streamQuality: Number(env.STEAMBENCH_STREAM_QUALITY || 80),
  streamBitrateKbps: Number(env.STEAMBENCH_STREAM_BITRATE || 4000),
  stillsFps: Number(env.STEAMBENCH_STILLS_FPS || 2),
  fragmentMs: Number(env.STEAMBENCH_FRAGMENT_MS || 500),
  audioBitrate: Number(env.STEAMBENCH_AUDIO_BITRATE || 128),
  portBase: Number(env.STEAMBENCH_PORT_BASE || 39000),
  maxRooms: Number(env.STEAMBENCH_MAX_ROOMS || 4),
  finishGraceS: Number(env.STEAMBENCH_FINISH_GRACE_S || 90),
};
const PORT = Number(env.PORT || 8787);
const GATEWAY_PORT = Number(env.STEAMBENCH_GATEWAY_PORT || 28771);
if (!cfg.learningKey) log(`${learningProfile.apiKeyEnv} is absent; the built-in player is unready`);

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

// What both the listing and the skill routes agree is a skill name.
const SKILL_NAME = /^[a-z0-9_-]+$/;

/**
 * Skill directories the library currently holds. Only names the skill routes
 * below actually accept: the library also holds bookkeeping directories, and
 * .objectives sorts ahead of every real skill, so listing it made the notes
 * browser open it by default and get "invalid skill" back instead of the notes.
 */
function librarySkills(cfg) {
  try {
    return fs.readdirSync(library.libraryDir(cfg), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && SKILL_NAME.test(entry.name))
      .map((entry) => entry.name).sort();
  } catch { return []; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
    if (url.pathname === '/api/health') return json(res, 200, { ok: true, rooms: manager.rooms.size, observerSlots: manager.observerClients.length });
    if (parts[0] !== 'api') return json(res, 404, { error: 'not found' });
    if (!authorized(req, url)) return json(res, 401, { error: 'unauthorized' });

    if (parts[1] === 'cache' && parts.length === 2) {
      if (req.method === 'GET') return json(res, 200, manager.cacheInfo());
      if (req.method === 'DELETE') { manager.clearCache(); return json(res, 200, { ok: true }); }
    }
    if (parts[1] === 'login' && parts.length === 2) {
      if (req.method === 'GET') return json(res, 200, { login: manager.loginInfo() });
      if (req.method === 'DELETE') { manager.forgetLogin(); return json(res, 200, { ok: true }); }
    }
    if (parts[1] === 'meta' && req.method === 'GET') {
      return json(res, 200, { savedLogin: manager.loginInfo(), cache: manager.cacheInfo(), games: Object.entries(SUPPORTED_GAMES).map(([key, g]) => ({ key, appid: g.appid, name: g.name })), characters: ['Ironclad', 'Silent', 'Defect', 'Necrobinder', 'Regent'], builtinPlayer: { name: cfg.learningProfile.name, model: cfg.learningProfile.model, reasoning: cfg.learningProfile.reasoning, configured: Boolean(cfg.learningKey), ready: learningReadiness(cfg).ready, reason: learningReadiness(cfg).reason }, maxRooms: cfg.maxRooms, observerSlots: manager.observerClients.length, referenceHosts: WEB_ALLOWLIST, librarySkills: librarySkills(cfg) });
    }
    // The persistent skill library: what the players have learned, as commits.
    if (parts[1] === 'library') {
      const skill = url.searchParams.get('skill') || undefined;
      if (skill && !SKILL_NAME.test(skill)) return json(res, 400, { error: 'invalid skill' });
      if (parts.length === 2 && req.method === 'GET') {
        return json(res, 200, { skills: librarySkills(cfg), ...await library.historyPage(cfg, { ...Object.fromEntries(url.searchParams), skill }) });
      }
      if (parts[2] === 'commits' && parts[3] && req.method === 'GET') {
        try { return json(res, 200, await library.diff(cfg, parts[3])); }
        catch (e) { return json(res, 404, { error: e.message }); }
      }
      if (parts[2] === 'files' && req.method === 'GET') {
        const name = url.searchParams.get('skill') || librarySkills(cfg)[0];
        if (!name) return json(res, 404, { error: 'the skill library is empty' });
        const file = url.searchParams.get('path');
        if (!file) return json(res, 200, { skill: name, files: library.tree(cfg, name) });
        try { return json(res, 200, { skill: name, path: file, text: library.readFile(cfg, name, file) }); }
        catch (e) { return json(res, 404, { error: e.message }); }
      }
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
      if (!sub && req.method === 'GET') return json(res, 200, { ...room.summary(), transcript: room.agent?.transcript || [], agents: room.agent?.agents || [], padHistory: room.padHistory, log: room.log });
      if (!sub && req.method === 'DELETE') { await manager.remove(room.id, { keepHome: url.searchParams.get('keepHome') === '1', reason: 'deleted by user' }); return json(res, 200, { ok: true, archive: room.archiveDir ? path.basename(room.archiveDir) : null }); }
      if (sub === 'setup' && req.method === 'POST') { const body = await readJson(req); return json(res, 200, await room.applySetup(body)); }
      if (sub === 'objectives' && req.method === 'GET') return json(res, 200, library.objectivePage(path.join(room.home, 'skills', room.setup?.game || 'sts2', 'scratchpad', 'objectives.json'), Object.fromEntries(url.searchParams)));
      if (sub === 'incidents' && req.method === 'GET') return json(res, 200, library.incidentPage(path.join(room.home, 'skills', room.setup?.game || 'sts2', 'scratchpad'), Object.fromEntries(url.searchParams)));
      if (sub === 'library' && req.method === 'GET') return json(res, 200, { games: room.library(), login: room.login });
      if (sub === 'chat' && req.method === 'POST') { const body = await readJson(req); if (!body.message) return json(res, 400, { error: 'message required' }); await room.chat(String(body.message)); return json(res, 200, { ok: true }); }
      if (sub === 'abort' && req.method === 'POST') { await room.agent?.abort(); return json(res, 200, { ok: true }); }
      if (sub === 'player' && parts[4] === 'status' && req.method === 'GET') { return json(res, 200, { id: room.id, stage: room.stage, agentStatus: room.agent?.status || 'stopped', requiresResume: Boolean(room.agent?.requiresResume), attention: room.agent?.attention || null, lastState: room.lastState, padCount: room.padHistory.length }); }
      if (sub === 'player' && parts[4] === 'restart' && req.method === 'POST') { return json(res, 200, await room.restartPlayer()); }
      if (sub === 'player' && parts[4] === 'resume' && req.method === 'POST') { const body = await readJson(req); return json(res, 200, await room.resumePlayer(body)); }
      if (sub === 'health' && req.method === 'GET') return json(res, 200, await room.health());
      if (sub === 'retry' && req.method === 'POST') { await room.retryLaunch(); return json(res, 200, { ok: true }); }
      if (sub === 'click' && req.method === 'POST') { const body = await readJson(req); await room.click(Number(body.x), Number(body.y)); return json(res, 200, { ok: true }); }
      if (sub === 'finish' && req.method === 'POST') { const body = await readJson(req); return json(res, 200, await room.finishRun({ result: body.result || 'aborted', summary: body.summary || 'finished from the dashboard', by: 'user' })); }
      if (sub === 'frame.jpg' && req.method === 'GET') {
        const frame = room.reader?.latest;
        if (!frame) return json(res, 503, { error: 'no frame yet' });
        cors(res); res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store', 'content-length': frame.length }); return res.end(frame);
      }
      if (sub === 'stream.mjpg' && req.method === 'GET') return streamMjpeg(room, req, res);
      if (sub === 'sts2' && req.method === 'GET') {
        const query = {};
        for (const key of ['format', 'query', 'item_type']) if (url.searchParams.has(key)) query[key] = url.searchParams.get(key);
        if (url.searchParams.has('limit')) query.limit = Number(url.searchParams.get('limit'));
        const result = await room.gatewayOp('sts2-get', { path: url.searchParams.get('path') || '/', query });
        return json(res, 200, result);
      }
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
  if (parts[0] === 'api' && parts[1] === 'rooms' && parts[3] === 'media') {
    const room = manager.get(parts[2]);
    if (!room) { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); return socket.destroy(); }
    return wss.handleUpgrade(req, socket, head, (ws) => attachMediaSocket(ws, room));
  }
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

/** Live video+audio for one viewer: the cached init segment, then fragments. */
// Binary framing: one leading byte says which track a message belongs to, so a
// viewer can feed video and audio into their own MSE source buffers.
const TRACK = { videoInit: 0, audioInit: 1, videoFragment: 2, audioFragment: 3 };
const tagged = (tag, buf) => Buffer.concat([Buffer.from([tag]), buf]);

function attachMediaSocket(ws, room) {
  if (!room.media) { ws.close(1011, 'no media stream'); return; }
  const send = (tag, buf) => { if (ws.readyState === ws.OPEN) ws.send(tagged(tag, buf)); };
  let videoReady = false;
  let audioReady = false;

  const announce = () => {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify({
      type: 'hello',
      video: room.media?.codecs || '',
      audio: room.mediaAudio?.codecs || '',
      width: room.cfg.streamWidth, height: room.cfg.streamHeight, fps: room.cfg.streamFps,
    }));
  };
  const startVideo = (init) => { if (!videoReady) { videoReady = true; announce(); send(TRACK.videoInit, init); } };
  const startAudio = (init) => { if (!audioReady) { audioReady = true; send(TRACK.audioInit, init); } };

  const onVideoInit = (init) => startVideo(init);
  const onAudioInit = (init) => startAudio(init);
  const onFragment = ({ kind, data }) => {
    if (kind === 'video' && videoReady) send(TRACK.videoFragment, data);
    if (kind === 'audio' && audioReady) send(TRACK.audioFragment, data);
  };

  if (room.media.init) startVideo(room.media.init);
  if (room.mediaAudio?.init) startAudio(room.mediaAudio.init);
  room.media.on('init', onVideoInit);
  room.mediaAudio?.on('init', onAudioInit);
  room.on('media', onFragment);
  const cleanup = () => {
    room.media.off('init', onVideoInit);
    room.mediaAudio?.off('init', onAudioInit);
    room.off('media', onFragment);
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
}

function attachRoomSocket(ws, room) {
  const send = (obj) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); };
  send({ type: 'snapshot', room: room.summary(), transcript: room.agent?.transcript || [], agents: room.agent?.agents || [], padHistory: room.padHistory, log: room.log });
  const handlers = {
    'agent:item': (item) => send({ type: 'item', item }),
    'agent:agents': (agents) => send({ type: 'agents', agents }),
    'agent:delta': (d) => send({ type: 'delta', ...d }),
    'agent:status': (s) => send({ type: 'agent_status', status: s, requiresResume: Boolean(room.agent?.requiresResume), attention: room.agent?.attention || null }),
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
server.listen(PORT, '0.0.0.0', () => log(`steambench server listening on :${PORT} (rooms ${cfg.roomsDir}, host rooms ${cfg.hostRoomsDir}, player image ${cfg.learningImage})`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    log(`${sig}: closing rooms`);
    await Promise.allSettled([...manager.rooms.keys()].map((id) => manager.remove(id, { keepHome: true, reason: 'server shutdown' })));
    process.exit(0);
  });
}
