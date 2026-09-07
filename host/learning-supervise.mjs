// Bounded supervision: stop after three combats, 15 minutes, or the first incident.
// Run only when gameplay supervision and the final operator pause are authorized.
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2];
if (!/^[a-f0-9]{8}$/.test(id || '')) throw new Error('usage: node host/learning-supervise.mjs ROOM_ID');
const token = process.env.STEAMBENCH_TOKEN || parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8')).STEAMBENCH_TOKEN;
const base = process.env.STEAMBENCH_BACKEND_URL || 'http://127.0.0.1:8787';
const directory = path.join(root, '.runtime/wolf/rooms', id, 'skills/sts2/scratchpad');
const invokedAt = Date.now();
let started = invokedAt;
let deadline = started + 15 * 60 * 1000;
const completedCombats = new Set();
let finalStatus;
let previous = '';
let stopReason = '15-minute supervision limit';
let interrupted = false;
process.on('SIGINT', () => { interrupted = true; });
process.on('SIGTERM', () => { interrupted = true; });

async function api(suffix, method = 'GET') {
  const response = await fetch(`${base}/api/rooms/${id}${suffix}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`supervision API ${response.status}`);
  return response.json();
}
function events() {
  try { return fs.readFileSync(path.join(directory, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } }); } catch { return []; }
}
try {
  // Reloads/reviews must not reset the original run's supervision allowance.
  started = (await api('')).createdAt;
  deadline = started + 15 * 60 * 1000;
  while (Date.now() < deadline && !interrupted) {
    finalStatus = await api('/player/status');
    for (const event of events()) {
      if (event.type === 'action' && event.verified && event.before?.battle && event.after && !event.after.battle) completedCombats.add(`${event.before.run?.act}:${event.before.run?.floor}`);
    }
    let metrics = {};
    try { metrics = JSON.parse(fs.readFileSync(path.join(directory, 'metrics.json'))); } catch { }
    const current = { stage: finalStatus.stage, agentStatus: finalStatus.agentStatus, floor: finalStatus.lastState?.floor, hp: finalStatus.lastState?.hp, decisions: metrics.decisions, verifiedPlays: metrics.verifiedPlays, combats: completedCombats.size, attention: finalStatus.attention?.id };
    if (JSON.stringify(current) !== previous) console.log(JSON.stringify({ at: new Date().toISOString(), ...current }));
    previous = JSON.stringify(current);
    if (finalStatus.attention) { stopReason = `incident ${finalStatus.attention.id}`; break; }
    if (['finished', 'error', 'deleting'].includes(finalStatus.stage)) { stopReason = `room ${finalStatus.stage}`; break; }
    if (completedCombats.size >= 3) { stopReason = 'three combats completed'; break; }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (interrupted) stopReason = 'operator interrupted supervision';
} catch (error) {
  stopReason = error.message;
  process.exitCode = 1;
} finally {
  if (!['finished', 'deleting'].includes(finalStatus?.stage)) {
    await api('/abort', 'POST');
    for (let attempt = 0; attempt < 30; attempt++) {
      finalStatus = await api('/player/status');
      if (['idle', 'stopped', 'error'].includes(finalStatus.agentStatus)) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!['idle', 'stopped', 'error'].includes(finalStatus.agentStatus)) throw new Error('player pause not confirmed; inspect immediately');
  }
  const all = events();
  const usage = all.filter(event => event.type === 'model_usage');
  const latencies = usage.filter(event => event.stopReason !== 'error').map(event => event.latencyMs).sort((a, b) => a - b);
  const median = values => values.length ? (values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) / 2 : null;
  const batches = all.filter(event => event.type === 'decision_result');
  const combatDecisions = new Set(all.filter(event => event.type === 'observation' && event.state?.battle && Array.isArray(event.state?.player?.hand)).map(event => event.decision));
  const combatUsage = usage.filter(event => combatDecisions.has(event.decision));
  const combatBatches = batches.filter(event => combatDecisions.has(event.decision));
  const completedCombatActions = combatBatches.reduce((sum, event) => sum + event.completed.length, 0);
  const batchByDecision = new Map(batches.map(event => [event.decision, event]));
  const decisionLatencies = usage.flatMap(event => {
    const batch = batchByDecision.get(event.decision);
    return batch && !batch.error ? [event.latencyMs + batch.latencyMs] : [];
  }).sort((a, b) => a - b);
  const report = { room: id, started: new Date(started).toISOString(), ended: new Date().toISOString(), stopReason, completedCombats: [...completedCombats], finalStatus, modelRequests: usage.length, medianModelLatencyMs: median(latencies), completedActions: batches.reduce((sum, event) => sum + event.completed.length, 0), batches: batches.length, actionsPerDecision: batches.length ? batches.reduce((sum, event) => sum + event.completed.length, 0) / batches.length : 0, inputTokens: usage.reduce((sum, event) => sum + (event.usage?.input || 0) + (event.usage?.cacheRead || 0) + (event.usage?.cacheWrite || 0), 0), outputTokens: usage.reduce((sum, event) => sum + (event.usage?.output || 0), 0), modelScreenshots: all.filter(event => event.type === 'decision_context' && event.screenshot).length };
  const file = path.join(root, '.runtime/wolf/learning', `supervision-${id}-${invokedAt}.json`);
  report.medianSuccessfulDecisionLatencyMs = median(decisionLatencies);
  report.combat = { modelDecisions: combatUsage.length, medianModelLatencyMs: median(combatUsage.map(event => event.latencyMs).sort((a, b) => a - b)), completedActions: completedCombatActions, actionsPerDecision: combatUsage.length ? completedCombatActions / combatUsage.length : 0, modelScreenshots: all.filter(event => event.type === 'decision_context' && event.screenshot && combatDecisions.has(event.decision)).length };
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, evidenceFile: file }));
}
