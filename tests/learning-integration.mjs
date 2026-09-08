import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { Executor } from '../client/learning/executor.mjs';
import { stateId, VERSION } from '../client/learning/state.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-fixtures-'));
const binary = path.join(temporary, 'pi');
fs.symlinkSync(path.join(root, 'tests/fixtures/fake-pi.cjs'), binary);
fs.chmodSync(binary, 0o755);
const baseState = { state_type: 'event', run: { floor: 1, act: 1 }, player: { hp: 80 }, ui: { sensor_version: 5, game_build: 'fixture-game', mod_build: 'fixture-mod', focus_path: null } };
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const children = new Set();

async function scenario(mode) {
  // Mirror a room's layout: skills/<game>/scratchpad, so each scenario gets its
  // own learned/ tree rather than sharing one.
  const directory = path.join(temporary, mode, 'scratchpad');
  fs.mkdirSync(directory, { recursive: true });
  if (mode === 'inherited_objective') {
    // A ladder left open by a different room. The player must start cleanly and
    // retire it: that objective was opened against a seed that no longer exists.
    fs.writeFileSync(path.join(directory, 'objectives.json'), JSON.stringify({
      version: 1,
      objectives: [{ id: 'obj-old', text: 'From the floor-4 card reward, reach the next fight', done_when: 'a reward screen is visible', area: 'strategy', status: 'active', attempts: 0, critiques: [], opened: { room: 'aaaa1111', decision: 12, floor: 4 } }],
    }));
  }
  const callsFile = path.join(directory, 'calls.txt');
  const inputs = [];
  let reads = 0;
  const server = net.createServer({ allowHalfOpen: true }, socket => {
    let data = '';
    socket.on('data', chunk => {
      data += chunk;
      if (!data.includes('\n')) return;
      const request = JSON.parse(data);
      let result = {};
      if (request.op === 'sts2-get') {
        reads++;
        const state = structuredClone(baseState);
        if (mode === 'bad_sensor') state.ui.sensor_version = 0;
        // Staleness is about what a plan rests on, not about presentation that
        // moves on its own, so this has to churn the scene itself: a drifting
        // focus_path alone is deliberately no longer enough to discard a plan.
        if (mode === 'stale') { state.ui.focus_path = String(reads); state.ui.scene_id = `scene-${reads}`; }
        // Focus moves only when a press arrives, so each probe succeeds and
        // nothing is stale: only the bound stops the run.
        if (mode === 'probes_only') state.ui.focus_path = `focus-${inputs.length}`;
        result = { body: JSON.stringify(state) };
      } else if (request.op === 'screenshot') result = { data_base64: Buffer.from('fixture-image').toString('base64'), age_ms: mode === 'stale_image' ? 5000 : 0 };
      // Only pad traffic is gameplay input. Knowledge ops such as skill-commit
      // reach the gateway too but never touch the game, which is the whole point
      // of the bound being tested here.
      else if (/^pad-/.test(request.op) && request.op !== 'pad-neutral') {
        inputs.push(request);
        if (mode === 'transport_error') {
          socket.end(JSON.stringify({ ok: false, error: { code: 'fixture_input', message: 'input acknowledgement lost' } }) + '\n');
          return;
        }
      }
      socket.end(JSON.stringify({ ok: true, result }) + '\n');
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  function start() {
    const child = spawn(process.execPath, [path.join(root, 'client/learning/player.mjs')], { env: { ...process.env, PATH: `${temporary}:${process.env.PATH}`, ORCA_KEY: 'fixture-only', STEAMBENCH_PROCESS_GATEWAY: `127.0.0.1:${server.address().port}`, STEAMBENCH_PROCESS_TOKEN: '', STEAMBENCH_LEARNING_SCRATCHPAD: directory, STEAMBENCH_ROOM_ID: 'bbbb2222', FIXTURE_MODE: mode, FIXTURE_CALLS: callsFile }, stdio: ['pipe', 'pipe', 'pipe'] });
    children.add(child);
    child.events = [];
    child.errors = '';
    child.stderr.on('data', chunk => child.errors += chunk);
    readline.createInterface({ input: child.stdout }).on('line', line => child.events.push(JSON.parse(line)));
    return child;
  }
  async function waitFor(child, predicate, label) {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      const result = child.events.find(predicate);
      if (result) return result;
      if (child.exitCode !== null) throw new Error(`fixture exited: ${child.errors}`);
      await sleep(20);
    }
    throw new Error(`timeout: ${label}; ${child.errors}`);
  }
  async function command(child, payload) {
    const id = `command-${child.events.length}-${Date.now()}`;
    child.stdin.write(JSON.stringify({ ...payload, id }) + '\n');
    return waitFor(child, event => event.type === 'response' && event.id === id, payload.type);
  }
  async function stop(child) {
    if (child.exitCode !== null || child.signalCode !== null) { children.delete(child); return; }
    const closed = once(child, 'close');
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    child.stdin.end();
    try { await closed; } finally { clearTimeout(timer); children.delete(child); }
  }
  let child = start();
  try {
    assert.equal((await command(child, { type: 'prompt', message: 'Preserve this fixture run and learn controls.' })).success, true);
    await waitFor(child, event => event.type === 'agent_settled', 'first pause');
    const attention = child.events.find(event => event.type === 'steambench_attention')?.attention;
    assert.ok(attention?.id);
    const incident = JSON.parse(fs.readFileSync(path.join(directory, attention.path)));
    assert.ok(incident.before);
    assert.ok(incident.after);
    assert.ok(fs.existsSync(path.join(path.dirname(path.join(directory, attention.path)), 'after.jpg')));
    const checkpoint = JSON.parse(fs.readFileSync(path.join(directory, 'checkpoint.json')));
    assert.equal(checkpoint.version, VERSION);
    assert.equal(checkpoint.attention.id, attention.id);
    const calls = fs.existsSync(callsFile) ? fs.readFileSync(callsFile, 'utf8').trim().split('\n').length : 0;
    assert.equal(inputs.length, ['input', 'transport_error', 'inherited_objective'].includes(mode) ? 1 : mode === 'probes_only' ? 2 : 0);
    // A planner failure sends nothing, so it is refined with the reason in
    // context before the run is paused. Anything that reached the game is not.
    const refinable = ['provider_error', 'empty'].includes(mode);
    // notes_only writes two notes, is refused a third, then spends the refine budget.
    assert.equal(calls, ['bad_sensor', 'stale_image'].includes(mode) ? 0 : mode === 'stale' ? 3 : refinable ? 3 : mode === 'notes_only' ? 5 : mode === 'probes_only' ? 5 : 1);
    if (mode === 'probes_only') {
      // A probe answers where focus is. A run of them answers nothing, and the
      // player was oscillating between two positions instead of committing.
      const events = fs.readFileSync(path.join(directory, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(events.filter(event => event.type === 'decision_result').length, 2, 'two probes are allowed');
      assert.match(events.find(event => event.type === 'refine').error, /probes in a row without acting/);
    }
    if (mode === 'inherited_objective') {
      // The crash this guards against was a startup ReferenceError, so reaching
      // any pause at all already proves the player booted with the ladder.
      const ladder = JSON.parse(fs.readFileSync(path.join(directory, 'objectives.json'), 'utf8'));
      assert.equal(ladder.objectives[0].status, 'abandoned', 'an objective from another room is retired, not carried');
      assert.match(ladder.objectives[0].closed.reasoning, /new room plays a new seed/);
    }
    if (mode === 'notes_only') {
      const events = fs.readFileSync(path.join(directory, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(events.filter(event => event.type === 'decision_result').length, 2, 'two note-writing decisions are allowed');
      assert.match(events.find(event => event.type === 'refine').error, /without touching the game/, 'the third is refused, and not as being stuck');
      assert.ok(!/no gameplay progress/.test(attention.error), 'writing notes is never mistaken for a stuck player');
      assert.equal(inputs.length, 0);
    }
    if (refinable) {
      const events = fs.readFileSync(path.join(directory, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.deepEqual(events.filter(event => event.type === 'refine').map(event => event.round), [1, 2], 'two refinement rounds, then the pause');
      assert.equal(inputs.length, 0, 'and not one of them touched the game');
    }
    if (mode === 'transport_error') assert.equal(incident.recentInputs.length, 1);
    const before = fs.readFileSync(path.join(directory, attention.path), 'utf8');
    assert.equal((await command(child, { type: 'resume', issueId: 'wrong', message: 'No review' })).success, false);
    assert.equal((await command(child, { type: 'resume', issueId: attention.id, message: '   ' })).success, false);
    await sleep(250);
    assert.equal(inputs.length, ['input', 'transport_error', 'inherited_objective'].includes(mode) ? 1 : mode === 'probes_only' ? 2 : 0);
    if (mode === 'report') {
      const notes = fs.readFileSync(path.join(directory, 'learning.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(notes[0].kind, 'pre_action_hypothesis');
      await stop(child);
      child = start();
      const restored = await command(child, { type: 'get_state' });
      assert.equal(restored.data.checkpointRestored, true);
      assert.equal(restored.data.requiresResume, true);
      assert.equal(restored.data.attention.id, attention.id);
      assert.equal((await command(child, { type: 'resume', issueId: attention.id, message: 'Reviewed fixture screenshot; retain scene and ask a second scoped question.' })).success, true);
      await waitFor(child, event => event.type === 'agent_settled', 'resumed pause');
      const next = JSON.parse(fs.readFileSync(path.join(directory, 'checkpoint.json')));
      assert.equal(next.decision, checkpoint.decision + 1);
      assert.equal(next.taskText, checkpoint.taskText);
      assert.equal(next.strategy, checkpoint.strategy);
      assert.equal(next.freshRunVerified, checkpoint.freshRunVerified);
      assert.equal(next.totalInputs, checkpoint.totalInputs);
      assert.ok(next.executionMetrics.sensors > checkpoint.executionMetrics.sensors);
      assert.equal(next.usage.requests, checkpoint.usage.requests + 1);
      assert.notEqual(next.attention.id, attention.id);
      assert.equal(fs.readFileSync(path.join(directory, attention.path), 'utf8'), before);
      assert.equal(inputs.length, 0);
      assert.ok(fs.readFileSync(path.join(directory, 'incident-resolutions.jsonl'), 'utf8').includes(attention.id));

      // Ordinary chat must not acknowledge an incident or send more inputs.
      const second = next.attention;
      const secondEvidence = fs.readFileSync(path.join(directory, second.path), 'utf8');
      assert.equal((await command(child, { type: 'prompt', message: 'Y confirms that screen; the cycling preview means nothing.' })).success, false);
      const third = JSON.parse(fs.readFileSync(path.join(directory, 'checkpoint.json')));
      assert.equal(third.decision, next.decision);
      assert.equal(third.attention.id, second.id);
      assert.equal(fs.readFileSync(path.join(directory, second.path), 'utf8'), secondEvidence);
      const resolutions = fs.readFileSync(path.join(directory, 'incident-resolutions.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(resolutions.length, 1, 'rejected chat adds no resolution');
      assert.equal(inputs.length, 0);
    }
    console.log(JSON.stringify({ scenario: mode, result: 'passed', gameplayInputs: inputs.length, plannerCallsBeforeResume: calls }));
  } finally {
    await stop(child);
    await new Promise(resolve => server.close(resolve));
  }
}

try {
  for (const mode of ['report', 'input', 'transport_error', 'provider_error', 'empty', 'bad_sensor', 'stale_image', 'stale', 'notes_only', 'probes_only', 'inherited_objective']) await scenario(mode);
  const state = { state_type: 'combat', ui: { hand_mode: 'Play', focused_card: 1, in_card_play: false }, player: { hand: [{ instance_id: 1, index: 0, can_play: true, target_type: 'Self' }, { instance_id: 2, index: 1, can_play: true, target_type: 'Self' }] }, battle: { is_play_phase: true, turn: 'player', enemies: [], round: 1 } };
  const inputs = [];
  const executor = new Executor({ call: async request => { if (request.op === 'sts2-get') return { body: JSON.stringify(state) }; inputs.push(request); return {}; } });
  executor.sleep = async () => {};
  const result = await executor.execute({ observation: stateId(state), summary: 'Focus the second card.', note: 'Test no-progress guard.', actions: [{ type: 'play', card: 2 }] }, state);
  assert.match(result.error, /hand navigation did not reach intended card/);
  assert.equal(inputs.length, 1);
  console.log(JSON.stringify({ scenario: 'failed_hand_navigation', result: 'passed', gameplayInputs: inputs.length }));
  console.log(JSON.stringify({ fixtureDirectory: temporary, result: 'all passed' }));
} finally {
  for (const child of children) child.kill('SIGKILL');
}
