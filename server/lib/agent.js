// Runs one learning player container in Pi's RPC mode and turns its JSONL event
// stream into a compact transcript the dashboard can render.
import { EventEmitter } from 'node:events';
import { spawnRun, rmForce, allContainers } from './docker.js';

const MAX_ITEMS = 400;
// What the dashboard shows before the player has published anything. The
// player is the authority the moment it speaks.
const DEFAULT_AGENTS = [{ id: 'room', role: 'room', label: 'Room', title: 'The operator, the runtime, and the run itself.', status: 'open', decisions: 0 }];
const DEFAULT_LANE = 'room';
const MAX_TEXT = 20000;
const MAX_RESULT = 4000;

export class PiAgent extends EventEmitter {
  /**
   * @param {object} o
   * @param {string} o.name          container name
   * @param {string} o.image         learning player image
   * @param {Record<string,string>} o.env  environment for the container
   * @param {string[]} [o.piArgs]    extra Pi arguments
   */
  constructor({ name, image, env, piArgs = [], mounts = [] }) {
    super();
    this.name = name;
    this.image = image;
    this.env = env;
    this.piArgs = piArgs;
    this.mounts = mounts;
    this.proc = null;
    this.status = 'stopped'; // stopped | starting | idle | running | error
    this.transcript = [];
    this.pending = new Map();
    this.nextId = 1;
    // The roster the player publishes: who is on the team, what each of them is
    // for, and which encounters have opened and closed. The dashboard renders
    // this list, so it must survive a player with nothing to say yet.
    this.agents = DEFAULT_AGENTS;
    // Streaming text, per lane. Two members never speak at once today, but a
    // single `current` would silently splice one member's tokens onto another's
    // message the first time that changed.
    this.current = new Map();
    this.exitInfo = null;
    this.stderrTail = '';
    this.attention = null;
  }

  start() {
    const args = ['-i', '--rm', '--name', this.name, '--add-host', 'host.docker.internal:host-gateway'];
    for (const [k, v] of Object.entries(this.env)) {
      if (v !== undefined && v !== null && v !== '') args.push('-e', `${k}=${v}`);
    }
    for (const m of this.mounts) args.push('-v', m);
    // The player contract: with STEAMBENCH_PLAYER_MODE=rpc and no arguments the container speaks Pi's JSONL RPC.
    args.push(this.image, ...this.piArgs);
    this.status = 'starting';
    const proc = spawnRun(args);
    this.proc = proc;
    let buf = '';
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        let line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line.trim()) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { this._system(`unparseable agent output: ${line.slice(0, 200)}`); continue; }
        this._onMessage(msg);
      }
    });
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (d) => { this.stderrTail = (this.stderrTail + d).slice(-4000); });
    proc.on('error', (e) => { this.status = 'error'; this._system(`agent process error: ${e.message}`); });
    proc.on('close', (code) => {
      this.exitInfo = { code, at: Date.now() };
      if (this.status !== 'stopped') {
        this.status = code === 0 ? 'stopped' : 'error';
        this._system(`agent exited with code ${code}${this.stderrTail ? `: ${this.stderrTail.trim().slice(-500)}` : ''}`);
      }
      for (const p of this.pending.values()) p.reject(new Error('agent exited'));
      this.pending.clear();
      this.emit('status', this.status);
    });
    // Ask for state to learn when the RPC loop is up.
    this.send({ type: 'get_state' }, 60000).then(() => {
      if (this.status === 'starting') { this.status = 'idle'; this.emit('status', this.status); }
    }).catch(() => {});
    return this;
  }

  send(cmd, timeoutMs = 30000) {
    if (!this.proc || this.proc.exitCode !== null) return Promise.reject(new Error('agent is not running'));
    const id = `r${this.nextId++}`;
    const line = JSON.stringify({ ...cmd, id }) + '\n';
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`agent command ${cmd.type} timed out`)); }, timeoutMs);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      this.proc.stdin.write(line, (err) => { if (err) { this.pending.delete(id); clearTimeout(timer); reject(err); } });
    });
  }

  /** Send a user message; steers if the agent is mid-run. */
  async prompt(message, { from = 'user' } = {}) {
    const running = this.status === 'running';
    this._push({ kind: 'user', text: message, from, queued: running, agent: DEFAULT_LANE });
    const res = await this.send(running ? { type: 'steer', message } : { type: 'prompt', message });
    if (res && res.success === false) throw new Error(res.error || 'prompt rejected');
    return res;
  }

  abort() { return this.send({ type: 'abort' }); }

  async stop() {
    this.status = 'stopped';
    try { this.proc?.stdin.end(); } catch { /* ignore */ }
    await rmForce(this.name);
    const deadline = Date.now() + 15000;
    while ((await allContainers(this.name)).includes(this.name)) {
      if (Date.now() >= deadline) throw new Error(`player container ${this.name} is still being removed; refusing name reuse`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    this.emit('status', this.status);
  }

  _onMessage(msg) {
    if (msg.type === 'response') {
      const p = msg.id && this.pending.get(msg.id);
      if (p) { this.pending.delete(msg.id); p.resolve(msg); }
      if (msg.success === false && msg.command !== 'get_state') this._system(`${msg.command} failed: ${msg.error || 'unknown error'}`);
      return;
    }
    const lane = msg.agent || DEFAULT_LANE;
    switch (msg.type) {
      case 'steambench_agents':
        if (Array.isArray(msg.agents) && msg.agents.length) { this.agents = msg.agents; this.emit('agents', this.agents); }
        break;
      case 'steambench_attention':
        this.attention = msg.attention || null;
        if (this.attention) this._system(`Supervisor required [${this.attention.id}]: ${String(this.attention.error || '').slice(0, 1200)}`);
        this.emit('attention', this.attention);
        break;
      case 'agent_start':
        this.status = 'running'; this.emit('status', this.status); break;
      case 'agent_settled':
        this.status = 'idle'; this.current.clear(); this.emit('status', this.status); break;
      case 'message_start':
        this.current.delete(lane); break;
      case 'message_update': {
        const ev = msg.assistantMessageEvent;
        if (!ev) break;
        if (ev.type === 'thinking_delta') this._appendDelta('thinking', ev.delta, lane);
        else if (ev.type === 'text_delta') this._appendDelta('text', ev.delta, lane);
        else if (ev.type === 'thinking_end' || ev.type === 'text_end') {
          const k = ev.type.startsWith('thinking') ? 'thinking' : 'text';
          const open = this.current.get(lane);
          if (open?.[k]) { open[k].done = true; this.emit('item', open[k]); open[k] = null; }
        }
        else if (ev.type === 'toolcall_end' && ev.toolCall) {
          this._push({ kind: 'tool', agent: lane, toolCallId: ev.toolCall.id, toolName: ev.toolCall.name, args: ev.toolCall.arguments ?? ev.toolCall.args ?? {}, pending: true });
        }
        break;
      }
      case 'tool_execution_start': {
        const existing = this.transcript.find((it) => it.kind === 'tool' && it.toolCallId === msg.toolCallId);
        if (!existing) this._push({ kind: 'tool', agent: lane, toolCallId: msg.toolCallId, toolName: msg.toolName, args: msg.args ?? {}, pending: true });
        break;
      }
      case 'tool_execution_end': {
        const item = this.transcript.find((it) => it.kind === 'tool' && it.toolCallId === msg.toolCallId);
        const text = (msg.result?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
        if (item) {
          item.pending = false; item.isError = !!msg.isError; item.result = text.slice(0, MAX_RESULT); item.endedAt = Date.now();
          this.emit('item', item);
        }
        this.emit('tool_end', { toolName: msg.toolName, args: this.transcript.find((it) => it.toolCallId === msg.toolCallId)?.args, isError: !!msg.isError, result: text });
        break;
      }
      case 'compaction_start': this._system('compacting context'); break;
      case 'auto_retry_start': this._system(`retrying after error (attempt ${msg.attempt}/${msg.maxAttempts}): ${String(msg.errorMessage || '').slice(0, 200)}`); break;
      case 'extension_error': this._system(`extension error: ${String(msg.error || msg.message || '').slice(0, 300)}`); break;
      default: break;
    }
    this.emit('event', msg);
  }

  _appendDelta(kind, delta, lane = DEFAULT_LANE) {
    if (!delta) return;
    if (!this.current.has(lane)) this.current.set(lane, { thinking: null, text: null });
    const open = this.current.get(lane);
    let item = open[kind];
    if (!item) { item = this._push({ kind, agent: lane, text: '' }); open[kind] = item; }
    if (item.text.length < MAX_TEXT) item.text += delta;
    this.emit('delta', { id: item.id, kind, agent: lane, delta });
  }

  _system(text, agent = DEFAULT_LANE) { this._push({ kind: 'system', agent, text }); }

  _push(partial) {
    const item = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, t: Date.now(), agent: DEFAULT_LANE, ...partial };
    this.transcript.push(item);
    if (this.transcript.length > MAX_ITEMS) this.transcript.splice(0, this.transcript.length - MAX_ITEMS);
    this.emit('item', item);
    return item;
  }
}
