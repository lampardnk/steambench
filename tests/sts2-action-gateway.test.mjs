import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Room, RoomManager } from '../server/lib/rooms.js';
import { STS2_ACTION_SCHEMAS, validateSts2Action } from '../server/lib/sts2-actions.js';

const valid = rule => rule.type === 'integer' ? rule.min : rule.type === 'enum' ? rule.values[0] : 'fixture';

test('every STS2MCP action has an exact accepted parameter contract', () => {
  assert.equal(Object.keys(STS2_ACTION_SCHEMAS).length, 28);
  for (const [action, schema] of Object.entries(STS2_ACTION_SCHEMAS)) {
    const params = Object.fromEntries(Object.entries(schema).filter(([, rule]) => !rule.optional).map(([key, rule]) => [key, valid(rule)]));
    assert.deepEqual(validateSts2Action(action, params), params, action);
    assert.throws(() => validateSts2Action(action, { ...params, injected: true }), /not allowed/);
    for (const [key, rule] of Object.entries(schema)) if (!rule.optional) assert.throws(() => validateSts2Action(action, Object.fromEntries(Object.entries(params).filter(([name]) => name !== key))), /required/);
  }
  assert.throws(() => validateSts2Action('unknown', {}), /allowlisted/);
  assert.throws(() => validateSts2Action('play_card', { card_index: -1 }), /integer/);
  assert.throws(() => validateSts2Action('crystal_sphere_set_tool', { tool: 'medium' }), /one of/);
});

function room() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sts2-actions-'));
  const manager = new EventEmitter();
  manager.cfg = { mediaDir: directory, roomsDir: directory, hostRoomsDir: directory };
  const instance = new Room(manager, { id: '1234abcd', name: 'Fixture' });
  instance.roomIp = '127.0.0.1'; instance.fwdPort = 15526;
  instance.stage = 'playing'; instance.setup = { player: { kind: 'builtin' } };
  return instance;
}

test('one action produces one POST, parses the acknowledgement, and writes a sanitized audit', async () => {
  const instance = room();
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, text: async () => '{"status":"ok","message":"done"}' };
  };
  try {
    const result = await instance.gatewayOp('sts2-action', { action: 'play_card', params: { card_index: 2, target: 'JAW_WORM_0' }, token: 'not-audit-data' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].options.body), { action: 'play_card', card_index: 2, target: 'JAW_WORM_0' });
    assert.equal(result.acknowledgement.status, 'ok');
    assert.deepEqual(instance.actionHistory[0].params, { card_index: 2, target: 'JAW_WORM_0' });
    assert.equal(instance.actionHistory[0].verification, 'awaiting_verification');
    assert.equal('token' in instance.actionHistory[0].params, false);
    assert.deepEqual(await instance.gatewayOp('sts2-action-verify', { id: result.auditId, verification: 'verified' }), { id: result.auditId, verification: 'verified' });
    assert.equal(instance.actionHistory[0].verification, 'verified');
  } finally { globalThis.fetch = realFetch; }
});

test('POST failures are never retried and transport loss is an unknown outcome', async () => {
  const instance = room();
  const realFetch = globalThis.fetch;
  for (const [answer, code] of [
    [async () => ({ ok: false, status: 500, text: async () => '{"status":"error","error":"no"}' }), 'sts2_http_error'],
    [async () => ({ ok: true, status: 200, text: async () => 'not json' }), 'sts2_malformed_response'],
    [async () => ({ ok: true, status: 200, text: async () => '{"status":"error","error":"refused"}' }), 'sts2_action_failed'],
    [async () => { throw new Error('socket lost'); }, 'sts2_action_outcome_unknown'],
  ]) {
    let calls = 0;
    globalThis.fetch = async (...args) => { calls++; return answer(...args); };
    await assert.rejects(() => instance.gatewayOp('sts2-action', { action: 'end_turn', params: {} }), error => error.code === code);
    assert.equal(calls, 1, code);
  }
  globalThis.fetch = realFetch;
});

test('action POSTs use the bounded timeout and reject oversized acknowledgements without retry', async () => {
  const instance = room();
  const realFetch = globalThis.fetch;
  const realTimeout = AbortSignal.timeout;
  const sentinel = new AbortController().signal;
  let timeout = null;
  let calls = 0;
  AbortSignal.timeout = milliseconds => { timeout = milliseconds; return sentinel; };
  globalThis.fetch = async (_url, options) => {
    calls++;
    assert.equal(options.signal, sentinel);
    return { ok: true, status: 200, text: async () => 'x'.repeat(1024 * 1024 + 1) };
  };
  try {
    await assert.rejects(() => instance.gatewayOp('sts2-action', { action: 'end_turn', params: {} }), error => error.code === 'sts2_too_large');
    assert.equal(timeout, 10000);
    assert.equal(calls, 1);
    assert.equal(instance.actionHistory[0].verification, 'failed');
  } finally {
    globalThis.fetch = realFetch;
    AbortSignal.timeout = realTimeout;
  }
});

test('pending supervisor attention gates mutations and hello has no raw input operations', async () => {
  const instance = room();
  instance.agent = { attention: { id: 'incident' } };
  await assert.rejects(() => instance.gatewayOp('sts2-action', { action: 'end_turn', params: {} }), error => error.code === 'supervisor_required');
  instance.agent = { requiresResume: true };
  await assert.rejects(() => instance.gatewayOp('sts2-action', { action: 'end_turn', params: {} }), error => error.code === 'supervisor_required');
  const hello = await instance.gatewayOp('hello', {});
  assert.ok(hello.ops.includes('sts2-action'));
  assert.equal(hello.ops.some(op => op.startsWith('pad-')), false);
});

test('legacy input archives remain readable through the generic action history', () => {
  const historyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sts2-history-'));
  const archive = path.join(historyDir, 'old-room');
  fs.mkdirSync(archive);
  fs.writeFileSync(path.join(archive, 'room.json'), JSON.stringify({ id: 'old-room' }));
  fs.writeFileSync(path.join(archive, 'pad-history.json'), JSON.stringify([{ t: 123, button: 'a' }]));
  const manager = new RoomManager({ historyDir, wolfSocket: '/does/not/connect', portBase: 1 });
  const [event] = manager.historyEntry('old-room').actionHistory;
  assert.equal(event.action, 'historical-input');
  assert.equal(event.t, 123);
  assert.equal(event.params.button, 'a');
  assert.equal(event.verification, 'unknown');
});
