import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { Executor } from '../client/astra/executor.mjs';
import { stateId, VERSION } from '../client/astra/state.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-fixtures-'));
const binary = path.join(temporary, 'pi');
fs.symlinkSync(path.join(root, 'tests/fixtures/fake-pi.cjs'), binary);
fs.chmodSync(binary, 0o755);
const baseState = { state_type: 'event', run: { floor: 1, act: 1 }, player: { hp: 80 }, ui: { sensor_version: 2, game_build: 'fixture-game', mod_build: 'fixture-mod', focus_path: null } };
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const children = new Set();

async function scenario(mode) {
  const directory = path.join(temporary, mode);
  fs.mkdirSync(directory);
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
        if (mode === 'stale') state.ui.focus_path = String(reads);
        result = { body: JSON.stringify(state) };
      } else if (request.op === 'screenshot') result = { data_base64: Buffer.from('fixture-image').toString('base64'), age_ms: mode === 'stale_image' ? 5000 : 0 };
      else if (request.op !== 'pad-neutral') {
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
    const child = spawn(process.execPath, [path.join(root, 'client/astra/player.mjs')], { env: { ...process.env, PATH: `${temporary}:${process.env.PATH}`, OPENROUTER_API_KEY: 'fixture-only', STEAMBENCH_PROCESS_GATEWAY: `127.0.0.1:${server.address().port}`, STEAMBENCH_PROCESS_TOKEN: '', STEAMBENCH_ASTRA_SCRATCHPAD: directory, FIXTURE_MODE: mode, FIXTURE_CALLS: callsFile }, stdio: ['pipe', 'pipe', 'pipe'] });
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
    const closed = once(child, 'close');
    child.stdin.end();
    await closed;
    children.delete(child);
    assert.equal(child.exitCode, 0, child.errors);
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
    assert.equal(inputs.length, ['input', 'transport_error'].includes(mode) ? 1 : 0);
    assert.equal(calls, ['bad_sensor', 'stale_image'].includes(mode) ? 0 : mode === 'stale' ? 3 : 1);
    if (mode === 'transport_error') assert.equal(incident.recentInputs.length, 1);
    const before = fs.readFileSync(path.join(directory, attention.path), 'utf8');
    assert.equal((await command(child, { type: 'resume', issueId: 'wrong', message: 'No review' })).success, false);
    assert.equal((await command(child, { type: 'resume', issueId: attention.id, message: '   ' })).success, false);
    await sleep(250);
    assert.equal(inputs.length, ['input', 'transport_error'].includes(mode) ? 1 : 0);
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

      // An ordinary chat reply answers the player's question and resumes the same run.
      const second = next.attention;
      const secondEvidence = fs.readFileSync(path.join(directory, second.path), 'utf8');
      const settled = () => child.events.filter(event => event.type === 'agent_settled').length;
      const settledBefore = settled();
      assert.equal((await command(child, { type: 'prompt', message: 'Y confirms that screen; the cycling preview means nothing.' })).success, true);
      const deadline = Date.now() + 12000;
      while (settled() === settledBefore && Date.now() < deadline) await sleep(20);
      assert.ok(settled() > settledBefore, 'chat-resumed pause');
      const third = JSON.parse(fs.readFileSync(path.join(directory, 'checkpoint.json')));
      assert.equal(third.decision, next.decision + 1);
      assert.equal(third.taskText, checkpoint.taskText);
      assert.equal(third.freshRunVerified, checkpoint.freshRunVerified);
      assert.notEqual(third.attention.id, second.id);
      assert.equal(fs.readFileSync(path.join(directory, second.path), 'utf8'), secondEvidence);
      const resolutions = fs.readFileSync(path.join(directory, 'incident-resolutions.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      const chatResolution = resolutions.at(-1);
      assert.equal(chatResolution.via, 'chat');
      assert.equal(chatResolution.issueId, second.id);
      assert.equal(chatResolution.acknowledgedIssueId, null);
      assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'attention.json'), 'utf8')).id, third.attention.id);
      assert.ok(third.instructions.some(item => item.from === 'operator chat reply' && item.at_decision === next.decision));
      assert.equal(inputs.length, 0);
    }
    console.log(JSON.stringify({ scenario: mode, result: 'passed', gameplayInputs: inputs.length, plannerCallsBeforeResume: calls }));
  } finally {
    await stop(child);
    await new Promise(resolve => server.close(resolve));
  }
}

try {
  for (const mode of ['report', 'input', 'transport_error', 'provider_error', 'empty', 'bad_sensor', 'stale_image', 'stale']) await scenario(mode);
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
