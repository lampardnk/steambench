// Room lifecycle. One room = one Wolf lobby (Steam + game in a container with
// its own virtual display, audio sink and virtual Xbox pad) + one observer
// stream session (MJPEG video, MP3 audio, pad input) + one player container.
//
// Stages: creating -> login -> setup -> installing -> launching -> playing -> finished -> deleting
// (error can happen anywhere; the room stays listed until deleted).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { WolfClient, mjpegPipeline, mp3Pipeline, encodeControllerArrival, encodeControllerState, encodeMouseMoveAbs, encodeMouseButton, BUTTON_FLAGS } from './wolf.js';
import { seedRoomHome, saveLoginTemplate, loginTemplateInfo } from './seed.js';
import { decodeLoginQr, RELOAD_FALLBACK } from './login.js';
import { SUPPORTED_GAMES, loggedInUser, libraryView, installState, steamRoot } from './steam.js';
import { MjpegReader } from './mjpeg.js';
import { AudioRelay } from './audio.js';
import { PiAgent } from './agent.js';
import { GatewayError } from './gateway.js';
import { docker, runningContainers, allContainers, containerIp, rmForce, execDetached, execIn, restart as dockerRestart } from './docker.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const STS2_GET_ALLOWLIST = {
  '/': [],
  '/api/v1/singleplayer': ['format'],
  '/api/v1/multiplayer': ['format'],
  '/api/v1/profile': ['format'],
  '/api/v1/compendium': ['format'],
  '/api/v1/wiki': ['query', 'item_type', 'limit', 'format'],
  '/api/v1/profiles': ['format'],
};
const STS2_QUERY_CHOICES = { format: ['json', 'markdown'], item_type: ['all', 'card', 'relic'] };
const MIN_HOLD = 30, MAX_HOLD = 2000, DEFAULT_HOLD = 80, MAX_PRESSES = 20, MIN_INTERVAL = 40, MAX_INTERVAL = 500, DEFAULT_INTERVAL = 120;
const PAD_HISTORY_MAX = 300;
const OBSERVER_CLIENTS = 8;
const CHARACTERS = ['Ironclad', 'Silent', 'Defect', 'Necrobinder', 'Regent'];
// Steam's login QR expires after about a minute and hides behind a reload
// button; we notice because it stops decoding, and click reload ourselves.
const QR_POLL_MS = 2000;
const QR_STALE_MS = 8000;
const QR_RELOAD_COOLDOWN_MS = 12000;
// Steam spends a while on boot/update screens before the sign-in page appears.
const QR_FIRST_CODE_GRACE_MS = 180000;
// Stop clicking once the sign-in screen is gone (a login succeeded, or Steam
// moved on): a stray click on the library could launch something.
const QR_CLICK_WINDOW_MS = 120000;
// A fresh room may have to download a Steam client update before the game runs.
const LAUNCH_NUDGE_MS = 180000;

// The mod's HTTP server binds loopback only and its .NET listener answers 404
// unless the request's Host header is the loopback address, so this is a small
// HTTP proxy rather than a raw pipe: it rewrites Host (and forces
// Connection: close so keep-alive cannot smuggle the original header through).
const FORWARDER_PY = `import socket,threading,sys
lp,tp=int(sys.argv[1]),int(sys.argv[2])
HOST=('Host: 127.0.0.1:%d' % tp).encode()

def pump(a,b):
    try:
        while True:
            d=a.recv(65536)
            if not d: break
            b.sendall(d)
    except Exception: pass
    finally:
        for s in (a,b):
            try: s.close()
            except Exception: pass

def handle(c):
    u=None
    try:
        c.settimeout(20)
        buf=b''
        while b'\\r\\n\\r\\n' not in buf:
            d=c.recv(65536)
            if not d: return
            buf+=d
            if len(buf)>65536: return
        head,sep,rest=buf.partition(b'\\r\\n\\r\\n')
        parts=head.split(b'\\r\\n')
        hdrs=[l for l in parts[1:] if not l.lower().startswith((b'host:',b'connection:'))]
        req=b'\\r\\n'.join([parts[0]]+hdrs+[HOST,b'Connection: close',b'',b''])+rest
        u=socket.create_connection(('127.0.0.1',tp),timeout=20)
        c.settimeout(None); u.settimeout(None)
        u.sendall(req)
        t=threading.Thread(target=pump,args=(u,c),daemon=True); t.start()
        pump(c,u)
        t.join(timeout=30)
    except Exception:
        pass
    finally:
        for s in (c,u):
            if s is not None:
                try: s.close()
                except Exception: pass

s=socket.socket(); s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1); s.bind(('0.0.0.0',lp)); s.listen(32)
while True:
    try: c,_=s.accept()
    except Exception: continue
    threading.Thread(target=handle,args=(c,),daemon=True).start()`;

export class RoomManager extends EventEmitter {
  constructor(cfg) {
    super();
    this.cfg = cfg;
    this.wolf = new WolfClient(cfg.wolfSocket);
    this.rooms = new Map();
    this.byToken = new Map();
    this.observerClients = [];
    this.nextPort = cfg.portBase;
    fs.mkdirSync(cfg.historyDir, { recursive: true });
  }

  list() { return [...this.rooms.values()].map((r) => r.summary()); }
  loginInfo() { return loginTemplateInfo(this.cfg.loginTemplateDir); }
  forgetLogin() { fs.rmSync(this.cfg.loginTemplateDir, { recursive: true, force: true }); this.emit('rooms'); return true; }
  get(id) { return this.rooms.get(id) || null; }
  resolveToken(token) { return (token && this.byToken.get(token)) || null; }

  async init(log) {
    await this._ensureObserverClients(log);
    for (const name of await allContainers('steambench-player-')) { log(`cleanup: removing leftover player container ${name}`); await rmForce(name); }
    // Room homes hold a full copy of the game (gigabytes). Rooms do not survive
    // a restart, so anything still on disk here is an orphan.
    try {
      for (const d of fs.readdirSync(this.cfg.roomsDir, { withFileTypes: true })) {
        if (!d.isDirectory() || this.rooms.has(d.name)) continue;
        log(`cleanup: removing orphaned room home ${d.name}`);
        try { await docker(['run', '--rm', '-v', `${this.cfg.hostRoomsDir}:/rooms`, 'alpine', 'rm', '-rf', `/rooms/${d.name}`]); }
        catch (e) { log(`cleanup: could not remove ${d.name}: ${e.message}`); }
      }
    } catch { /* rooms dir may not exist yet */ }
    try {
      for (const s of await this.wolf.listSessions()) { try { await this.wolf.stopSession(s.client_id || s.session_id); } catch { /* ignore */ } }
      for (const l of await this.wolf.listLobbies()) { log(`cleanup: stopping leftover lobby ${l.name}`); try { await this.wolf.stopLobby(l.id); } catch { /* ignore */ } }
    } catch (e) { log(`cleanup: wolf not reachable (${e.message})`); }
  }

  async _ensureObserverClients(log) {
    const cfgFile = this.cfg.wolfConfigFile;
    const pick = (clients) => (clients.clients || []).filter((c) => String(c.app_state_folder || '').startsWith('steambench-observer-')).map((c) => ({ clientId: c.client_id, busy: false }));
    try {
      const mine = pick(await this.wolf.request('GET', '/clients'));
      if (mine.length) { this.observerClients = mine; log(`observer clients: ${mine.length} available`); return; }
    } catch (e) { log(`observer clients: cannot list wolf clients (${e.message})`); }
    if (!cfgFile || !fs.existsSync(cfgFile)) { log('observer clients: no wolf config file; only one room at a time'); return; }
    let toml = fs.readFileSync(cfgFile, 'utf8');
    if (!toml.includes('steambench-observer-')) {
      const blocks = [];
      for (let n = 1; n <= OBSERVER_CLIENTS; n++) {
        blocks.push(`\n[[paired_clients]]\nclient_cert = "steambench-observer-${n}"\napp_state_folder = "steambench-observer-${n}"\n\n[paired_clients.settings]\nrun_uid = 1000\nrun_gid = 1000\ncontrollers_override = ["XBOX"]\nmouse_acceleration = 1.0\nv_scroll_acceleration = 1.0\nh_scroll_acceleration = 1.0\nmotion_controller_override = "AUTO"\n`);
      }
      toml = toml.replace(/^paired_clients\s*=\s*\[\]\s*$/m, '') + blocks.join('');
      fs.copyFileSync(cfgFile, cfgFile + '.bak');
      fs.writeFileSync(cfgFile, toml);
      log('observer clients: added to wolf config');
    }
    log('observer clients: restarting wolf to load them');
    try {
      await dockerRestart(this.cfg.wolfContainer);
      for (let i = 0; i < 60; i++) { await sleep(1000); try { await this.wolf.listLobbies(); break; } catch { /* not up yet */ } }
      try { await docker(['exec', this.cfg.wolfContainer, 'chmod', '666', this.cfg.wolfSocket]); } catch { /* best effort */ }
      this.observerClients = pick(await this.wolf.request('GET', '/clients'));
      log(`observer clients: ${this.observerClients.length} available after restart`);
    } catch (e) { log(`observer clients: wolf restart failed (${e.message}); only one room at a time`); }
  }

  _takeObserverClient() {
    const free = this.observerClients.find((c) => !c.busy);
    if (free) { free.busy = true; return free.clientId; }
    if (this.observerClients.length) throw new Error(`all ${this.observerClients.length} observer slots are in use`);
    if ([...this.rooms.values()].some((r) => r.sessionId)) throw new Error('only one room is possible without provisioned observer clients');
    return null;
  }
  _releaseObserverClient(clientId) { const c = this.observerClients.find((x) => x.clientId === clientId); if (c) c.busy = false; }
  allocPort() { const p = this.nextPort; this.nextPort += 2; if (this.nextPort > this.cfg.portBase + 900) this.nextPort = this.cfg.portBase; return p; }

  async create({ name, setup } = {}) {
    if (this.rooms.size >= this.cfg.maxRooms) throw new Error(`room limit reached (${this.cfg.maxRooms})`);
    const id = crypto.randomBytes(4).toString('hex');
    const room = new Room(this, { id, name: name || `room-${id}` });
    if (setup) room.validateSetup(setup); // fail fast before creating anything
    this.rooms.set(id, room);
    this.byToken.set(room.token, room);
    this.emit('rooms');
    room.start().then(() => { if (setup) return room.applySetup(setup); }).catch((e) => room.setStage('error', e.message));
    return room;
  }

  async remove(id, { keepHome = false, reason = 'deleted by user' } = {}) {
    const room = this.rooms.get(id);
    if (!room) return false;
    await room.destroy({ keepHome, reason });
    this.rooms.delete(id);
    this.byToken.delete(room.token);
    this.emit('rooms');
    return true;
  }

  history() {
    const out = [];
    for (const d of fs.readdirSync(this.cfg.historyDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      try { const r = JSON.parse(fs.readFileSync(path.join(this.cfg.historyDir, d.name, 'room.json'), 'utf8')); out.push({ dir: d.name, ...r }); } catch { /* skip */ }
    }
    return out.sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
  }
  historyEntry(dir) {
    const base = path.join(this.cfg.historyDir, path.basename(dir));
    if (!fs.existsSync(path.join(base, 'room.json'))) return null;
    const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(base, f), 'utf8')); } catch { return null; } };
    const text = (f) => { try { return fs.readFileSync(path.join(base, f), 'utf8'); } catch { return null; } };
    return { room: read('room.json'), transcript: read('transcript.json') || [], padHistory: read('pad-history.json') || [], scratchpad: listFiles(path.join(base, 'scratchpad')).map((f) => ({ name: f, text: text(path.join('scratchpad', f)) })), gameLog: text('godot.log') };
  }
}

function listFiles(dir) { try { return fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile()); } catch { return []; } }

export class Room extends EventEmitter {
  constructor(manager, { id, name }) {
    super();
    this.m = manager; this.cfg = manager.cfg;
    this.id = id; this.name = name;
    this.token = crypto.randomBytes(24).toString('hex');
    this.stage = 'creating'; this.detail = '';
    this.createdAt = Date.now();
    this.log = [];
    this.setup = null; this.login = null; this.finish = null;
    this.lobbyId = null; this.sessionId = null; this.clientId = null; this.roomContainer = null; this.roomIp = null;
    this.videoPort = manager.allocPort(); this.audioPort = this.videoPort + 1;
    this.fwdPort = 25526; this.modPort = 15526;
    this.home = path.join(this.cfg.roomsDir, id);
    this.hostHome = path.join(this.cfg.hostRoomsDir, id);
    this.reader = null; this.audio = null; this.agent = null; this.playerImage = null;
    this.padHistory = []; this.padBusy = Promise.resolve();
    this.loginQr = null; this.qrPoint = null; this.qrSeenAt = 0; this.qrReloads = 0; this.qrReloadedAt = 0; this.loginSince = Date.now(); this.loginReused = false;
    this.gameReady = false; this.destroyed = false; this.loops = new Set();
    this.lastState = null;
  }

  summary() {
    const g = this.setup ? SUPPORTED_GAMES[this.setup.game] : null;
    return {
      id: this.id, name: this.name, stage: this.stage, detail: this.detail, createdAt: this.createdAt,
      setup: this.setup ? { game: this.setup.game, gameName: g?.name, player: { kind: this.setup.player.kind, name: this.setup.player.name }, task: this.setup.task } : null,
      login: this.login ? { personaName: this.login.personaName, steamId: this.login.steamId } : null,
      loginQr: this.loginQr || null, loginReused: this.loginReused,
      sessionId: this.sessionId,
      finish: this.finish, gameReady: this.gameReady,
      lobbyId: this.lobbyId, roomContainer: this.roomContainer, roomIp: this.roomIp, playerImage: this.playerImage,
      agentStatus: this.agent?.status || 'stopped', frames: this.reader?.frames || 0, lastFrameAt: this.reader?.latestAt || 0, audioBytes: this.audio?.bytes || 0,
      lastPad: this.padHistory[this.padHistory.length - 1] || null, padCount: this.padHistory.length,
      lastState: this.lastState, log: this.log.slice(-40),
    };
  }

  setStage(stage, detail = '') { this.stage = stage; this.detail = detail; this._log(`[${stage}] ${detail}`); this.emit('room', this.summary()); this.m.emit('rooms'); }
  setDetail(detail) { this.detail = detail; this._log(detail); this.emit('room', this.summary()); }
  _log(text) { const line = `${new Date().toISOString()} ${text}`; this.log.push(line); if (this.log.length > 500) this.log.shift(); this.emit('log', line); this.cfg.log?.(`[${this.id}] ${text}`); }

  // ---- stage: creating ----------------------------------------------------
  async start() {
    fs.mkdirSync(this.home, { recursive: true });
    // Pre-warm: copy the game from the host library so the room does not need to download it.
    if (fs.existsSync(path.join(this.cfg.hostSteam, 'steamapps', `appmanifest_${SUPPORTED_GAMES.sts2.appid}.acf`))) {
      this.setDetail('copying game files from the host library into the room');
      this.loginReused = Boolean(loginTemplateInfo(this.cfg.loginTemplateDir));
      await seedRoomHome({ home: this.home, hostSteam: this.cfg.hostSteam, hostSteamOriginalPath: this.cfg.hostSteamOriginalPath, hostSts2: this.cfg.hostSts2, loginTemplate: this.cfg.loginTemplateDir, sts2Port: this.modPort, log: (t) => this._log(t) });
    }
    if (this.destroyed) return;
    this.setDetail('creating Wolf lobby (Steam)');
    const runnerName = `steambench-room-${this.id}`;
    // Steam encrypts its stored login per machine, so every room presents the
    // same hostname and machine-id; that is what lets one login be reused.
    const machineIdFile = path.join(this.cfg.runtimeDir, 'machine-id');
    if (!fs.existsSync(machineIdFile)) fs.writeFileSync(machineIdFile, crypto.randomBytes(16).toString('hex') + '\n');
    const mounts = [`${path.join(this.cfg.hostRuntimeDir, 'machine-id')}:/etc/machine-id:ro`];
    this.lobbyId = await this.m.wolf.createLobby({
      name: this.name, width: this.cfg.roomWidth, height: this.cfg.roomHeight, fps: this.cfg.roomFps,
      renderNode: this.cfg.renderNode, bufferCaps: this.cfg.bufferCaps, runnerStateFolder: `${this.cfg.roomsRel}/${this.id}`,
      runner: {
        type: 'docker', name: runnerName, image: this.cfg.roomImage, mounts, devices: [], ports: [],
        env: ['RUN_GAMESCOPE=1', 'GOW_REQUIRED_DEVICES=/dev/input/* /dev/dri/* /dev/nvidia*', 'SDL_GAMECONTROLLER_IGNORE_DEVICES=0x045e/0x02ea', ...this.cfg.roomExtraEnv],
        base_create_json: JSON.stringify({ Hostname: 'steambench-room', HostConfig: {
          IpcMode: 'host', CapAdd: ['SYS_ADMIN', 'SYS_NICE', 'SYS_PTRACE', 'NET_RAW', 'MKNOD', 'NET_ADMIN'],
          SecurityOpt: ['seccomp=unconfined', 'apparmor=unconfined'], Ulimits: [{ Name: 'nofile', Hard: 10240, Soft: 10240 }],
          Privileged: false, DeviceCgroupRules: ['c 13:* rmw', 'c 244:* rmw'] } }),
      },
    });
    this._log(`lobby ${this.lobbyId}`);
    const containerName = `${runnerName}_${this.lobbyId}`;
    for (let i = 0; i < 60 && !this.roomIp && !this.destroyed; i++) {
      await sleep(1000);
      if ((await runningContainers(containerName)).length) { this.roomContainer = containerName; this.roomIp = await containerIp(containerName); }
    }
    if (this.destroyed) return;
    if (!this.roomIp) throw new Error('room container did not start');
    this._log(`room container ${containerName} at ${this.roomIp}`);
    await execDetached(containerName, ['python3', '-c', FORWARDER_PY, String(this.fwdPort), String(this.modPort)]);

    this.setDetail('attaching video, audio and controller');
    this.clientId = this.m._takeObserverClient();
    this.sessionId = await this.m.wolf.addSession({ width: this.cfg.roomWidth, height: this.cfg.roomHeight, fps: this.cfg.roomFps, clientId: this.clientId });
    await sleep(1500);
    await this.m.wolf.startSession(this.sessionId, {
      width: this.cfg.roomWidth, height: this.cfg.roomHeight, fps: this.cfg.roomFps, pingPort: this.videoPort, audioPingPort: this.audioPort,
      gstPipeline: mjpegPipeline({ port: this.videoPort, outWidth: this.cfg.streamWidth, outHeight: this.cfg.streamHeight, fps: this.cfg.streamFps, quality: this.cfg.streamQuality }),
      audioPipeline: mp3Pipeline({ port: this.audioPort, bitrate: this.cfg.audioBitrate }),
    });
    await this.m.wolf.sendVideoPing(this.videoPort);
    await this.m.wolf.sendAudioPing(this.audioPort);
    await sleep(2500);
    await this.m.wolf.joinLobby(this.lobbyId, this.sessionId);
    await this.m.wolf.sendInput(this.sessionId, encodeControllerArrival(0));
    await this.m.wolf.sendInput(this.sessionId, encodeControllerState({}));
    this.reader = new MjpegReader({ port: this.videoPort }).start();
    this.reader.on('frame', (f) => this.emit('frame', f));
    this.audio = new AudioRelay({ port: this.audioPort }).start();

    this.loginSince = Date.now();
    this.setStage('login', 'waiting for the Steam sign-in QR code');
    this._loop(() => this._watchLogin(), 3000);
    this._loop(() => this._watchQr(), QR_POLL_MS);
  }

  /**
   * While the sign-in screen is up, decode the QR from the video frame so the
   * dashboard can render it sharply, and click the reload button when Steam
   * lets the code expire (it stops decoding once it is blurred out).
   */
  async _watchQr() {
    if (this.stage !== 'login') { this.loginQr = null; return false; }
    const frame = this.reader?.latest;
    if (!frame) return true;
    const found = decodeLoginQr(frame);
    if (found) {
      this.qrPoint = { x: (found.center.x / found.width) * this.cfg.roomWidth, y: (found.center.y / found.height) * this.cfg.roomHeight };
      this.qrSeenAt = Date.now();
      if (this.loginQr?.url !== found.url) {
        this.loginQr = { url: found.url, at: Date.now(), reloads: this.qrReloads };
        this._log(`sign-in QR ready (${found.url})`);
        this.emit('room', this.summary());
      }
      return true;
    }
    // Only click reload once a real code has been seen: before that the room is
    // still on Steam's boot/update screens, where clicking would be noise.
    const lastSeen = this.qrSeenAt || 0;
    const seenRecently = lastSeen > 0 && Date.now() - lastSeen < QR_CLICK_WINDOW_MS;
    const desperate = !lastSeen && Date.now() - this.loginSince > QR_FIRST_CODE_GRACE_MS && this.qrReloads < 3;
    if (!seenRecently && !desperate) return true;
    const staleFor = Date.now() - (this.loginQr?.at || this.loginSince);
    const sinceReload = Date.now() - (this.qrReloadedAt || 0);
    if (staleFor > QR_STALE_MS && sinceReload > QR_RELOAD_COOLDOWN_MS) {
      this.qrReloadedAt = Date.now();
      this.qrReloads = (this.qrReloads || 0) + 1;
      const p = this.qrPoint || RELOAD_FALLBACK;
      this._log(`sign-in QR expired; clicking reload at ${Math.round(p.x)},${Math.round(p.y)}`);
      try { await this.click(p.x, p.y); } catch (e) { this._log(`reload click failed: ${e.message}`); }
      if (this.loginQr) { this.loginQr = null; this.emit('room', this.summary()); }
    }
    return true;
  }

  /** Move the room's virtual mouse to a room pixel and click. */
  async click(x, y, button = 'left') {
    if (!this.sessionId) throw new Error('observer session not attached');
    await this.m.wolf.sendInput(this.sessionId, encodeMouseMoveAbs({ x: Math.round(x), y: Math.round(y), width: this.cfg.roomWidth, height: this.cfg.roomHeight }));
    await sleep(250);
    await this.m.wolf.sendInput(this.sessionId, encodeMouseButton(button, true));
    await sleep(90);
    await this.m.wolf.sendInput(this.sessionId, encodeMouseButton(button, false));
  }

  async _watchLogin() {
    if (this.stage !== 'login') return false;
    const user = loggedInUser(this.home);
    if (!user) return true;
    this.login = user;
    this.loginQr = null;
    this._log(`steam login: ${user.personaName || user.accountName || user.steamId}`);
    // Reuse this login for every future room: the client's token is bound to
    // the machine identity, which we pin to the same values in all rooms.
    try { await saveLoginTemplate({ home: this.home, templateDir: this.cfg.loginTemplateDir, log: (t) => this._log(t) }); }
    catch (e) { this._log(`could not save the login for future rooms: ${e.message}`); }
    if (this.setup) { this.setStage('installing', 'signed in'); this._install().catch((e) => this.setStage('error', e.message)); }
    else this.setStage('setup', 'signed in; choose a game, a player and a task');
    return false;
  }

  library() { return libraryView(this.home); }

  // ---- stage: setup ---------------------------------------------------------
  validateSetup(setup) {
    if (!setup || typeof setup !== 'object') throw new Error('setup must be an object');
    const game = String(setup.game || 'sts2');
    if (!SUPPORTED_GAMES[game]) throw new Error(`unsupported game: ${game} (supported: ${Object.keys(SUPPORTED_GAMES).join(', ')})`);
    const player = setup.player || { kind: 'builtin' };
    if (player.kind === 'dockerfile') {
      if (typeof player.dockerfile !== 'string' || !/^\s*(#.*\n\s*)*(ARG|FROM)\b/im.test(player.dockerfile)) throw new Error('player.dockerfile must be a Dockerfile starting with FROM');
      if (player.dockerfile.length > 200000) throw new Error('player.dockerfile is too large');
    } else if (player.kind !== 'builtin') throw new Error('player.kind must be builtin or dockerfile');
    const task = setup.task || {};
    const ascension = Number(task.ascension ?? 1);
    if (!Number.isInteger(ascension) || ascension < 0 || ascension > 20) throw new Error('task.ascension must be 0..20');
    const character = String(task.character || 'Ironclad');
    if (!CHARACTERS.includes(character)) throw new Error(`task.character must be one of ${CHARACTERS.join(', ')}`);
    const prompt = task.prompt ? String(task.prompt).slice(0, 4000) : '';
    return { game, player: { kind: player.kind, name: player.name ? String(player.name).slice(0, 60) : (player.kind === 'builtin' ? 'steambench-pi (Pi + Nemotron)' : 'custom Dockerfile'), dockerfile: player.dockerfile }, task: { ascension, character, prompt } };
  }

  async applySetup(setup) {
    const valid = this.validateSetup(setup);
    if (!['login', 'setup', 'error'].includes(this.stage) && !(this.stage === 'creating')) throw new Error(`room is ${this.stage}; setup can only be changed before installation`);
    this.setup = valid;
    this._log(`setup: game=${valid.game} player=${valid.player.kind} task=${valid.task.character} A${valid.task.ascension}`);
    if (this.stage === 'setup') { this.setStage('installing', 'preparing game and player'); this._install().catch((e) => this.setStage('error', e.message)); }
    else this.emit('room', this.summary());
    return valid;
  }

  // ---- stage: installing ----------------------------------------------------
  async _install() {
    const game = SUPPORTED_GAMES[this.setup.game];
    // Player image
    if (this.setup.player.kind === 'builtin') this.playerImage = this.cfg.agentImage;
    else {
      this.playerImage = `steambench-player-${this.id}`;
      this.setDetail('building player image from Dockerfile');
      await docker(['build', '-t', this.playerImage, '-'], { input: this.setup.player.dockerfile, timeoutMs: 20 * 60 * 1000 });
      this._log(`player image ${this.playerImage} built`);
    }
    if (this.destroyed) return;
    // Game install
    let st = installState(this.home, game.appid);
    if (!st.installed) {
      this.setDetail(`installing ${game.name} through Steam in the room`);
      await this._steamUrl(`steam://install/${game.appid}`);
      const deadline = Date.now() + 40 * 60 * 1000;
      while (!this.destroyed && Date.now() < deadline) {
        await sleep(5000);
        st = installState(this.home, game.appid);
        if (st.installed) break;
        if (st.present && st.bytesToDownload) this.setDetail(`downloading ${game.name}: ${Math.round((100 * st.bytesDownloaded) / st.bytesToDownload)}%`);
      }
      if (!st.installed) throw new Error(`${game.name} did not finish installing (Steam may be waiting for a confirmation in the room)`);
    }
    this._log(`${game.name} installed`);
    // Mod + skills
    const gameDir = path.join(steamRoot(this.home), 'steamapps', 'common', game.installdir);
    const mods = path.join(gameDir, 'mods');
    fs.mkdirSync(mods, { recursive: true });
    for (const f of ['STS2_MCP.dll', 'STS2_MCP.json']) {
      const src = path.join(this.cfg.modDir, f);
      if (fs.existsSync(src) && !fs.existsSync(path.join(mods, f))) fs.copyFileSync(src, path.join(mods, f));
    }
    fs.writeFileSync(path.join(mods, 'STS2_MCP.conf'), JSON.stringify({ port: this.modPort }, null, 2) + '\n');
    const skills = path.join(this.home, 'skills');
    fs.rmSync(skills, { recursive: true, force: true });
    fs.cpSync(path.join(this.cfg.skillsDir, game.skill), path.join(skills, game.skill), { recursive: true });
    const modsInRoom = path.join(steamRoot('/room'), 'steamapps', 'common', game.installdir, 'mods');
    try { await docker(['run', '--rm', '-v', `${this.hostHome}:/room`, 'alpine', 'chown', '-R', '1000:1000', '/room/skills', modsInRoom]); } catch (e) { this._log(`chown: ${e.message}`); }
    if (this.destroyed) return;
    this.setStage('launching', `starting ${game.name}`);
    await this._launch();
  }

  async _steamUrl(url) {
    return execIn(this.roomContainer, ['/usr/games/steam', url], { user: '1000', env: { HOME: '/home/retro', DISPLAY: ':0', XDG_RUNTIME_DIR: '/run/user/wolf' } });
  }

  // ---- stage: launching -----------------------------------------------------
  /**
   * Ask Steam to run the game and wait for the mod to answer. This can take a
   * long time on a fresh room (Steam downloads a client update first), so it
   * keeps waiting and re-issues the launch instead of failing the room.
   */
  async _launch() {
    this.launchedAt = Date.now();
    this.launchAttempts = 0;
    await this._nudgeLaunch();
    this._loop(() => this._watchLaunch(), 5000);
  }

  async _gameRunning() {
    if (!this.roomContainer) return false;
    try {
      const out = await execIn(this.roomContainer, ['sh', '-c', 'ps -eo comm | grep -c SlayTheSpire2 || true'], { timeoutMs: 15000 });
      return Number(out.trim()) > 0;
    } catch { return false; }
  }

  async _nudgeLaunch() {
    const game = SUPPORTED_GAMES[this.setup.game];
    this.launchAttempts += 1;
    this.lastNudgeAt = Date.now();
    try { await this._steamUrl(`steam://rungameid/${game.appid}`); }
    catch (e) { this._log(`launch command failed: ${e.message}`); }
  }

  async _watchLaunch() {
    if (this.destroyed || this.stage !== 'launching') return false;
    try {
      const r = await this._sts2Fetch('/', {});
      if (r.status >= 200 && r.status < 300) {
        this.gameReady = true;
        await this._startPlayer();
        return false;
      }
    } catch { /* not up yet */ }
    const waited = Math.round((Date.now() - this.launchedAt) / 1000);
    // Steam often has to update itself before it will start anything, so nudge
    // the launch again now and then rather than giving up on the room. Never
    // nudge while the game is already up: Steam answers that with an error
    // dialog that blocks the game.
    if (Date.now() - this.lastNudgeAt > LAUNCH_NUDGE_MS && !(await this._gameRunning())) {
      this._log(`still waiting for the game after ${waited}s; asking Steam to launch it again`);
      await this._nudgeLaunch();
    }
    this.setDetail(`waiting for the game and its mod (${waited}s; Steam may be updating itself first)`);
    return true;
  }

  async _startPlayer() {
    const game = SUPPORTED_GAMES[this.setup.game];
    this._log('game and mod reachable');
    this.setDetail('starting the player');
    this.agent = new PiAgent({
      name: `steambench-player-${this.id}`, image: this.playerImage,
      env: { OPENROUTER_API_KEY: this.cfg.openrouterKey, STEAMBENCH_PROCESS_GATEWAY: this.cfg.gatewayForAgents, STEAMBENCH_PROCESS_TOKEN: this.token, STEAMBENCH_MODEL: this.cfg.model, STEAMBENCH_VISION_MODEL: this.cfg.visionModel, STEAMBENCH_PLAYER_MODE: 'rpc' },
      mounts: [`${this.hostHome}/skills:/workspace/skills`],
    });
    for (const ev of ['item', 'delta', 'status']) this.agent.on(ev, (p) => this.emit(`agent:${ev}`, p));
    this.agent.on('status', () => this.m.emit('rooms'));
    this.agent.start();
    await sleep(4000);
    const t = this.setup.task;
    const kickoff = `You are connected to ${game.name} through steambench. First read /workspace/skills/${game.skill}/SKILL.md and /workspace/skills/${game.skill}/controls/CONTROLS.md. ` +
      `Goal: beat Ascension ${t.ascension} as ${t.character}. Start a new run with that character and ascension (use sts2_look to check the menus), play until the run ends, keep notes in scratchpad/, and call run_over when it is over.` +
      (t.prompt ? `\n\nAdditional instructions: ${t.prompt}` : '');
    this.setStage('playing', `${t.character} · Ascension ${t.ascension}`);
    this.agent.prompt(kickoff, { from: 'steambench' }).catch((e) => this._log(`kickoff failed: ${e.message}`));
    this._loop(() => this._watchPlaying(), 15000);
  }

  async _watchPlaying() {
    if (this.stage !== 'playing') return false;
    try {
      const r = await this._sts2Fetch('/api/v1/singleplayer', { format: 'json' });
      try { const s = JSON.parse(r.body); this.lastState = pickState(s); } catch { /* keep last */ }
      if (!this.gameReady) { this.gameReady = true; this.setDetail('game reachable again'); }
    } catch {
      if (this.gameReady) { this.gameReady = false; this.setDetail('game/mod not reachable'); }
    }
    return true;
  }

  // ---- stage: finished --------------------------------------------------------
  async finishRun({ result, summary, by = 'player' }) {
    if (this.finish) return this.finish;
    this.finish = { result, summary: String(summary || '').slice(0, 2000), by, at: Date.now() };
    this.setStage('finished', `${result}: room closes in ${this.cfg.finishGraceS}s`);
    try { await this.archive('run finished'); } catch (e) { this._log(`archive failed: ${e.message}`); }
    setTimeout(() => { this.m.remove(this.id, { reason: 'run finished' }).catch(() => {}); }, this.cfg.finishGraceS * 1000);
    return this.finish;
  }

  async archive(reason) {
    const dir = path.join(this.cfg.historyDir, `${new Date(this.createdAt).toISOString().replace(/[:.]/g, '-')}-${this.id}`);
    fs.mkdirSync(dir, { recursive: true });
    const meta = { ...this.summary(), log: this.log, reason, archivedAt: Date.now(), transcriptItems: this.agent?.transcript.length || 0 };
    fs.writeFileSync(path.join(dir, 'room.json'), JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(dir, 'transcript.json'), JSON.stringify(this.agent?.transcript || [], null, 2));
    fs.writeFileSync(path.join(dir, 'pad-history.json'), JSON.stringify(this.padHistory, null, 2));
    if (this.reader?.latest) fs.writeFileSync(path.join(dir, 'last-frame.jpg'), this.reader.latest);
    const scratch = path.join(this.home, 'skills', this.setup?.game || 'sts2', 'scratchpad');
    if (fs.existsSync(scratch)) fs.cpSync(scratch, path.join(dir, 'scratchpad'), { recursive: true });
    const gameLog = path.join(this.home, '.local', 'share', 'SlayTheSpire2', 'logs', 'godot.log');
    if (fs.existsSync(gameLog)) fs.copyFileSync(gameLog, path.join(dir, 'godot.log'));
    this.archiveDir = dir;
    this._log(`archived to ${path.basename(dir)}`);
    return dir;
  }

  /** Layer-by-layer status, for the dashboard and for debugging a stuck room. */
  async health() {
    const now = Date.now();
    const checks = [];
    const add = (name, ok, detail) => checks.push({ name, ok, detail });
    add('wolf lobby', Boolean(this.lobbyId), this.lobbyId || 'not created');
    const containers = this.roomContainer ? await runningContainers(this.roomContainer).catch(() => []) : [];
    add('room container', containers.length > 0, this.roomContainer ? `${this.roomContainer}${containers.length ? '' : ' (not running)'}` : 'none');
    add('video', Boolean(this.reader?.latest) && now - this.reader.latestAt < 15000, this.reader?.latest ? `${this.reader.frames} frames, last ${Math.round((now - this.reader.latestAt) / 1000)}s ago` : 'no frames');
    add('audio', (this.audio?.bytes || 0) > 0, `${Math.round((this.audio?.bytes || 0) / 1024)} KB`);
    add('controller', Boolean(this.sessionId), this.sessionId ? `session ${this.sessionId}, ${this.padHistory.length} inputs` : 'no observer session');
    add('steam login', Boolean(this.login), this.login ? (this.login.personaName || this.login.steamId) : 'not signed in');
    if (this.setup) {
      const st = installState(this.home, SUPPORTED_GAMES[this.setup.game].appid);
      add('game installed', st.installed, st.installed ? st.installdir : `state flags ${st.stateFlags ?? 'none'}`);
    }
    let mod = { ok: false, detail: 'not reachable' };
    try { const r = await this._sts2Fetch('/', {}); mod = { ok: r.status < 300, detail: `HTTP ${r.status} ${String(r.body).slice(0, 60).replace(/\s+/g, ' ')}` }; }
    catch (e) { mod = { ok: false, detail: e.message.slice(0, 120) }; }
    add('game mod api', mod.ok, mod.detail);
    add('player', this.agent ? this.agent.status !== 'error' : false, this.agent ? `${this.agent.status} (${this.agent.transcript.length} transcript items)` : 'not started');
    return { room: this.id, stage: this.stage, detail: this.detail, ok: checks.every((c) => c.ok), checks };
  }

  /** Re-run the launch stage; useful after an error or a slow Steam update. */
  async retryLaunch() {
    if (!this.setup) throw new Error('the room has no setup yet');
    if (['playing', 'finished'].includes(this.stage)) throw new Error(`room is already ${this.stage}`);
    if (this.agent) { try { await this.agent.stop(); } catch { /* ignore */ } this.agent = null; }
    this.setStage('launching', 'retrying the launch');
    await this._launch();
    return true;
  }

  async chat(message) { if (!this.agent) throw new Error('the player has not started yet'); return this.agent.prompt(message); }

  async destroy({ keepHome = false, reason = '' } = {}) {
    this.destroyed = true;
    for (const t of this.loops) clearTimeout(t);
    if (!this.archiveDir && (this.agent || this.padHistory.length)) { try { await this.archive(reason || 'deleted'); } catch (e) { this._log(`archive failed: ${e.message}`); } }
    this.setStage('deleting', reason);
    try { await this.agent?.stop(); } catch (e) { this._log(`player stop: ${e.message}`); }
    this.reader?.stop(); this.audio?.stop();
    if (this.sessionId) { try { await this.m.wolf.stopSession(this.sessionId); } catch (e) { this._log(`session stop: ${e.message}`); } }
    if (this.clientId) this.m._releaseObserverClient(this.clientId);
    if (this.lobbyId) { try { await this.m.wolf.stopLobby(this.lobbyId); } catch (e) { this._log(`lobby stop: ${e.message}`); } }
    if (this.roomContainer) { await sleep(2000); await rmForce(this.roomContainer); }
    if (this.playerImage && this.playerImage !== this.cfg.agentImage) { try { await docker(['rmi', '-f', this.playerImage]); } catch { /* ignore */ } }
    if (!keepHome) { try { await docker(['run', '--rm', '-v', `${path.dirname(this.hostHome)}:/rooms`, 'alpine', 'rm', '-rf', `/rooms/${this.id}`]); } catch (e) { this._log(`home cleanup: ${e.message}`); } }
    this.setStage('deleted', reason);
  }

  _loop(fn, everyMs) {
    const tick = async () => {
      if (this.destroyed) return;
      let again = true;
      try { again = await fn(); } catch (e) { this._log(`loop error: ${e.message}`); }
      if (again && !this.destroyed) { const t = setTimeout(tick, everyMs); this.loops.add(t); }
    };
    const t = setTimeout(tick, everyMs); this.loops.add(t);
  }

  // ---- gateway ops (called by the player through the JSON-line gateway) ----
  async gatewayOp(op, request) {
    switch (op) {
      case 'hello': return { room: this.id, stage: this.stage, ops: ['sts2-get', 'screenshot', 'pad-status', 'pad-press', 'pad-stick', 'pad-dpad', 'pad-neutral', 'room-finish'] };
      case 'sts2-get': return this._sts2Get(request);
      case 'screenshot': return this._screenshot();
      case 'pad-status': return { device: 'wolf-virtual-xbox', session: this.sessionId, held: [], grabbed_by_other: false, readers: this.roomContainer ? [this.roomContainer] : [], history: this.padHistory.slice(-5) };
      case 'pad-press': return this._padSerial(() => this._padPress(request));
      case 'pad-dpad': return this._padSerial(() => this._padDpad(request));
      case 'pad-stick': return this._padSerial(() => this._padStick(request));
      case 'pad-neutral': return this._padSerial(async () => { await this._padState({}); return { held: [] }; });
      case 'room-finish': {
        const result = ['lost', 'won', 'aborted'].includes(request.result) ? request.result : 'aborted';
        return this.finishRun({ result, summary: request.summary, by: 'player' });
      }
      default: throw new GatewayError('unknown_operation', `unknown operation: ${op}`);
    }
  }

  async _sts2Get(request) {
    const p = request.path;
    if (typeof p !== 'string' || !(p in STS2_GET_ALLOWLIST)) throw new GatewayError('invalid_path', 'path is not an allowlisted STS2MCP GET endpoint', { allowed: Object.keys(STS2_GET_ALLOWLIST) });
    const query = request.query || {};
    if (typeof query !== 'object' || Array.isArray(query)) throw new GatewayError('invalid_query', 'query must be an object');
    const allowed = STS2_GET_ALLOWLIST[p];
    const params = {};
    for (const [k, v] of Object.entries(query)) {
      if (!allowed.includes(k)) throw new GatewayError('invalid_query', `query parameter not allowed for ${p}: ${k}`, { allowed });
      if (k in STS2_QUERY_CHOICES) { if (!STS2_QUERY_CHOICES[k].includes(v)) throw new GatewayError('invalid_query', `${k} must be one of ${STS2_QUERY_CHOICES[k].join(', ')}`); params[k] = String(v); }
      else if (k === 'limit') { if (!Number.isInteger(v) || v < 1 || v > 50) throw new GatewayError('invalid_query', 'limit must be an integer between 1 and 50'); params[k] = String(v); }
      else if (k === 'query') { if (typeof v !== 'string' || !v.trim() || v.length > 200) throw new GatewayError('invalid_query', 'query must be a non-empty string of at most 200 characters'); params[k] = v; }
    }
    return this._sts2Fetch(p, params);
  }

  async _sts2Fetch(p, params) {
    if (!this.roomIp) throw new GatewayError('sts2_unavailable', 'room is not running yet');
    const qs = new URLSearchParams(params).toString();
    let res;
    try { res = await fetch(`http://${this.roomIp}:${this.fwdPort}${p}${qs ? `?${qs}` : ''}`, { signal: AbortSignal.timeout(10000) }); }
    catch (e) { throw new GatewayError('sts2_unavailable', `STS2MCP mod not reachable in the room (${e.cause?.code || e.name}); is the game running with the mod enabled?`); }
    const body = await res.text();
    if (body.length > 1024 * 1024) throw new GatewayError('sts2_too_large', 'response exceeds 1 MiB');
    if (res.status >= 400) throw new GatewayError('sts2_http_error', `STS2MCP returned ${res.status}`, { status: res.status, body: body.slice(0, 500) });
    return { status: res.status, content_type: res.headers.get('content-type') || '', body, bytes: body.length };
  }

  _screenshot() {
    const frame = this.reader?.latest;
    if (!frame) throw new GatewayError('no_frame', 'no video frame received from the room yet');
    return { window: 'room', width: this.cfg.streamWidth, height: this.cfg.streamHeight, format: 'jpeg', bytes: frame.length, data_base64: frame.toString('base64'), age_ms: Date.now() - this.reader.latestAt };
  }

  _padSerial(fn) { const run = this.padBusy.then(fn, fn); this.padBusy = run.catch(() => {}); return run; }
  async _padState(state) {
    if (!this.sessionId) throw new GatewayError('pad_unavailable', 'observer session not attached');
    await this.m.wolf.sendInput(this.sessionId, encodeControllerState(state));
  }
  _record(entry) { const e = { t: Date.now(), ...entry }; this.padHistory.push(e); if (this.padHistory.length > PAD_HISTORY_MAX) this.padHistory.shift(); this.emit('pad', e); return e; }

  async _padPress(request) {
    const button = String(request.button || '');
    const hold = boundedInt(request.hold_ms, MIN_HOLD, MAX_HOLD, DEFAULT_HOLD, 'invalid_hold', 'hold_ms');
    let state;
    if (button in BUTTON_FLAGS) state = { buttons: BUTTON_FLAGS[button] };
    else if (button === 'lt') state = { lt: 255 };
    else if (button === 'rt') state = { rt: 255 };
    else throw new GatewayError('invalid_button', `unknown button: ${button}`, { allowed: [...Object.keys(BUTTON_FLAGS), 'lt', 'rt'] });
    this._record({ kind: 'press', button, hold_ms: hold });
    await this._padState(state);
    try { await sleep(hold); } finally { await this._padState({}); }
    return { button, hold_ms: hold, held: [] };
  }

  async _padDpad(request) {
    const direction = String(request.direction || '');
    if (!['up', 'down', 'left', 'right'].includes(direction)) throw new GatewayError('invalid_direction', 'direction must be up, down, left or right');
    const presses = boundedInt(request.presses, 1, MAX_PRESSES, 1, 'invalid_presses', 'presses');
    const interval = boundedInt(request.interval_ms, MIN_INTERVAL, MAX_INTERVAL, DEFAULT_INTERVAL, 'invalid_interval', 'interval_ms');
    this._record({ kind: 'dpad', button: direction, presses, interval_ms: interval });
    try {
      for (let i = 0; i < presses; i++) {
        await this._padState({ buttons: BUTTON_FLAGS[direction] });
        await sleep(60);
        await this._padState({});
        if (i < presses - 1) await sleep(interval);
      }
    } finally { await this._padState({}); }
    return { direction, presses, interval_ms: interval, held: [] };
  }

  async _padStick(request) {
    const stick = String(request.stick || '');
    if (!['left', 'right'].includes(stick)) throw new GatewayError('invalid_stick', 'stick must be left or right');
    const x = clampFloat(request.x), y = clampFloat(request.y);
    const hold = boundedInt(request.hold_ms, MIN_HOLD, MAX_HOLD, DEFAULT_HOLD, 'invalid_hold', 'hold_ms');
    const sx = Math.round(x * 32767), sy = Math.round(-y * 32767); // tools: y=-1 up; Moonlight: positive y = up
    const state = stick === 'left' ? { lx: sx, ly: sy } : { rx: sx, ry: sy };
    this._record({ kind: 'stick', button: stick, x, y, hold_ms: hold });
    await this._padState(state);
    try { await sleep(hold); } finally { await this._padState({}); }
    return { stick, x, y, hold_ms: hold, held: [] };
  }
}

/** Small, dashboard-friendly view of the mod's JSON state (fields are best effort). */
function pickState(s) {
  if (!s || typeof s !== 'object') return null;
  const run = s.run || s;
  const pl = run.player || run.character || {};
  return {
    state_type: s.state_type ?? s.screen ?? null,
    floor: run.floor ?? run.current_floor ?? null,
    act: run.act ?? null,
    hp: pl.hp ?? pl.current_hp ?? null,
    max_hp: pl.max_hp ?? null,
    gold: run.gold ?? pl.gold ?? null,
    character: pl.name ?? run.character_name ?? null,
    at: Date.now(),
  };
}

function boundedInt(value, min, max, dflt, code, name) {
  if (value === undefined || value === null) return dflt;
  if (!Number.isInteger(value) || value < min || value > max) throw new GatewayError(code, `${name} must be an integer between ${min} and ${max}`);
  return value;
}
function clampFloat(v) { const n = Number(v); if (!Number.isFinite(n)) throw new GatewayError('invalid_axis', 'x and y must be numbers between -1 and 1'); return Math.max(-1, Math.min(1, n)); }
