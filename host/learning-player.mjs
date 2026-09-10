import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { compactState } from '../client/learning/state.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { positionals, values } = parseArgs({ allowPositionals: true, options: { issue: { type: 'string' }, message: { type: 'string' }, timeout: { type: 'string', default: '600' }, stall: { type: 'string', default: '900' } } });
const [command, roomId] = positionals;
const token = process.env.STEAMBENCH_TOKEN || parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8')).STEAMBENCH_TOKEN;
const base = process.env.STEAMBENCH_BACKEND_URL || 'http://127.0.0.1:8787';

function inspectionState(state) {
  if (!state) return null;
  const result = compactState(state);
  if (result.map) {
    const { nodes, ...map } = result.map;
    result.map = { ...map, nodeCount: nodes?.length };
  }
  if (result.deck) result.deck = result.deck.map(card => ({ id: card.id, name: card.name, count: card.count }));
  return result;
}

/**
 * Newest timestamp in the room's event log, read from the tail so a multi-
 * megabyte log costs nothing. A quiet log means no decisions are landing: the
 * planner can legitimately spend a long time on one turn, but past `stall`
 * seconds nobody is driving the pad and the run needs an operator.
 */
function lastEventAt(room) {
  const file = path.join(root, '.runtime', 'wolf', 'rooms', room, 'skills', 'sts2', 'scratchpad', 'events.jsonl');
  try {
    const { size } = fs.statSync(file);
    const span = Math.min(size, 65536);
    const fd = fs.openSync(file, 'r');
    const buffer = Buffer.alloc(span);
    fs.readSync(fd, buffer, 0, span, size - span);
    fs.closeSync(fd);
    const lines = buffer.toString('utf8').trim().split('\n');
    for (let index = lines.length - 1; index >= 0; index--) {
      try { const at = JSON.parse(lines[index]).at; if (at) return at; } catch { /* a partial first line is expected */ }
    }
  } catch { /* the room may not have written one yet */ }
  return null;
}

async function api(suffix, body) {
  const response = await fetch(`${base}/api/rooms/${roomId}${suffix}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

try {
  if (!/^[a-f0-9]{8}$/.test(roomId || '')) throw new Error('Usage: node host/learning-player.mjs status|watch|inspect|pause|reload|resume ROOM_ID [--issue ID --message REVIEW] [--timeout SECONDS] [--stall SECONDS]');
  if (command === 'status') console.log(JSON.stringify(await api('/player/status'), null, 2));
  else if (command === 'watch') {
    const timeout = Number(values.timeout);
    const stall = Number(values.stall);
    if (!Number.isFinite(timeout) || timeout < 1 || timeout > 43200) throw new Error('timeout must be 1–43200 seconds');
    if (!Number.isFinite(stall) || stall < 30) throw new Error('stall must be at least 30 seconds');
    const deadline = Date.now() + timeout * 1000;
    let previous = '';
    while (Date.now() < deadline) {
      const status = await api('/player/status');
      const key = JSON.stringify([status.stage, status.agentStatus, status.lastState?.floor, status.attention?.id]);
      if (key !== previous) console.log(JSON.stringify(status));
      previous = key;
      // An operator-visible state outranks a quiet log: an incident pauses the
      // run deliberately, and a finished room is done. Only otherwise does a
      // silent event log mean nobody is driving the pad.
      if (status.attention) { process.exitCode = 2; break; }
      if (['finished', 'error', 'deleting'].includes(status.stage)) break;
      const at = lastEventAt(roomId);
      if (at != null && Date.now() - at > stall * 1000) {
        console.log(JSON.stringify({ stall: { seconds: Math.round((Date.now() - at) / 1000), bar: stall, lastState: status.lastState, agentStatus: status.agentStatus } }));
        process.exitCode = 3;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } else if (command === 'inspect') {
    const status = await api('/player/status');
    const relative = status.attention?.path;
    if (!/^incidents\/\d+-\d+\/incident\.json$/.test(relative || '')) throw new Error('no valid pending incident');
    const file = path.join(root, '.runtime', 'wolf', 'rooms', roomId, 'skills', 'sts2', 'scratchpad', relative);
    const incident = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log(JSON.stringify({ file, id: incident.id, error: incident.error, compatibility: incident.compatibility, plan: incident.plan, planner: incident.planner, lastResult: incident.lastResult, before: inspectionState(incident.before), after: inspectionState(incident.after), recentInputs: incident.recentInputs, sensorSnapshots: incident.recentSensors?.length, screenshots: ['before.jpg', 'after.jpg'].map(name => path.join(path.dirname(file), name)) }, null, 2));
  } else if (command === 'pause') console.log(JSON.stringify(await api('/abort', {})));
  else if (command === 'reload') console.log(JSON.stringify(await api('/player/restart', {})));
  else if (command === 'resume') {
    if (!values.message?.trim()) throw new Error('resume requires --message with the supervisor review/fix description');
    console.log(JSON.stringify(await api('/player/resume', { issueId: values.issue, message: values.message })));
  } else throw new Error('unknown command');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
