import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Room } from '../server/lib/rooms.js';
import { PiAgent } from '../server/lib/agent.js';

import { PROFILE } from '../server/lib/learning-profile.mjs';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-backend-'));
const manager = new EventEmitter();
manager.cfg = { mediaDir: directory, roomsDir: directory, hostRoomsDir: directory, learningKey: 'fixture-only', learningProfile: PROFILE, gatewayForAgents: 'fixture:1' };
const room = new Room(manager, { id: '1234abcd', name: 'Fixture' });
room.stage = 'playing';
room.setup = { game: 'sts2', player: { kind: 'builtin' }, task: { character: 'Ironclad', ascension: 1 } };
room.lobbyId = 'preserve-lobby';
room.roomContainer = 'preserve-game';
room.sessionId = 'preserve-observer';
room.lastState = { floor: 8, hp: 52 };
room.padHistory = [{ button: 'a' }];
room.playerImage = 'fixture-image';
room._loop = () => {};
room._refreshCaches = () => { throw new Error('reload must not copy caches'); };
room._launch = () => { throw new Error('reload must not launch game'); };
let stopped = 0;
let prompts = 0;
const transcript = [{ kind: 'text', text: 'preserved evidence' }];
room.agent = { status: 'idle', transcript, stop: async () => { stopped++; } };
const checkpoint = path.join(room.home, 'skills/sts2/scratchpad/checkpoint.json');
fs.mkdirSync(path.dirname(checkpoint), { recursive: true });
await assert.rejects(() => room.restartPlayer(), /compatible learning checkpoint/);
assert.equal(stopped, 0);
fs.writeFileSync(checkpoint, JSON.stringify({ version: PROFILE.checkpointVersion }));
const original = Object.fromEntries(['start', 'send', 'prompt', 'stop'].map(key => [key, PiAgent.prototype[key]]));
let compatible = true;
let handshakeModel = PROFILE.model;
PiAgent.prototype.start = function () { this.status = 'idle'; this.attention = { id: 'fixture-issue' }; return this; };
PiAgent.prototype.send = async function (command) {
  if (command.type === 'resume') return command.issueId === 'fixture-issue' ? { success: true } : { success: false, error: 'wrong issue' };
  return { success: true, data: { player: PROFILE.checkpointVersion, model: handshakeModel, thinkingLevel: PROFILE.reasoning, checkpointRestored: compatible } };
};
PiAgent.prototype.prompt = async () => { prompts++; };
PiAgent.prototype.stop = async function () { stopped++; this.status = 'stopped'; };
const preserved = () => JSON.stringify([room.home, room.lobbyId, room.roomContainer, room.sessionId, room.lastState, room.padHistory, room.token]);
const before = preserved();
try {
  room.agent.status = 'running';
  await assert.rejects(() => room.restartPlayer(), /pause the player/);
  room.agent.status = 'idle';
  const pending = room.restartPlayer();
  await assert.rejects(() => room.restartPlayer(), /restart already/);
  const result = await pending;
  assert.equal(result.requiresResume, true);
  assert.equal(result.attention.id, 'fixture-issue');
  assert.equal(stopped, 1);
  assert.equal(prompts, 0);
  assert.equal(preserved(), before);
  assert.deepEqual(room.agent.transcript, transcript);
  for (const operation of ['pad-press', 'pad-dpad', 'pad-stick', 'room-finish']) await assert.rejects(() => room.gatewayOp(operation, {}), error => error.code === 'supervisor_required');
  await assert.rejects(() => room.resumePlayer({ issueId: 'wrong', message: 'review' }), /wrong issue/);
  assert.deepEqual(await room.resumePlayer({ issueId: 'fixture-issue', message: 'review' }), { ok: true });
  compatible = false;
  await assert.rejects(() => room.restartPlayer(), /did not restore/);
  assert.equal(room.stage, 'error');
  assert.equal(preserved(), before);
  compatible = true;
  handshakeModel = 'wrong-model';
  await assert.rejects(() => room.restartPlayer(), /model.configur/);
  assert.equal(preserved(), before);
  // A death lands between two 15-second polls, so finishing re-reads the game instead of
  // disputing a real loss against a stale snapshot.
  const finishing = new Room(manager, { id: '5678beef', name: 'Finish' });
  finishing.stage = 'playing';
  finishing.setup = room.setup;
  finishing._loop = () => {};
  finishing.lastState = { state_type: 'elite', floor: 8, hp: 3, inRun: true, gameOver: false };
  finishing.archive = async () => {};
  manager.remove = async () => {};
  finishing._sts2Fetch = async () => ({ body: JSON.stringify({ state_type: 'game_over', run: { act: 1, floor: 8 }, player: { character: 'The Ironclad', hp: 0, max_hp: 80 } }) });
  const died = await finishing.finishRun({ result: 'lost', summary: 'died to the elite' });
  assert.equal(died.disputed, false);
  assert.equal(died.gameState.gameOver, true);
  assert.equal(died.gameState.hp, 0);

  // A player claiming a loss while the re-read still shows a live run is still disputed,
  // and an unreachable mod falls back to the last poll rather than failing the finish.
  for (const [fetcher, disputed] of [
    [async () => ({ body: JSON.stringify({ state_type: 'elite', run: { act: 1, floor: 8 }, player: { character: 'The Ironclad', hp: 3, max_hp: 80 } }) }), true],
    [async () => { throw new Error('mod unreachable'); }, true],
  ]) {
    const live = new Room(manager, { id: '9012cafe', name: 'Live' });
    live.stage = 'playing';
    live.setup = room.setup;
    live._loop = () => {};
    live.lastState = { state_type: 'elite', floor: 8, hp: 3, inRun: true, gameOver: false };
    live.archive = async () => {};
    live._sts2Fetch = fetcher;
    assert.equal((await live.finishRun({ result: 'lost', summary: 'claimed' })).disputed, disputed);
  }

  console.log(JSON.stringify({ result: 'passed', preserved: ['game', 'lobby', 'observer', 'home', 'pad history', 'last state', 'transcript'], verified: ['idle gate', 'checkpoint gate', 'restart lock', 'explicit resume', 'failed restore gate', 'fresh game re-read before disputing a loss'], gameInputs: 0 }));
} finally {
  for (const [key, value] of Object.entries(original)) PiAgent.prototype[key] = value;
}
