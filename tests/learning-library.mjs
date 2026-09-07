// The skill library must outlive rooms: a room inherits earlier knowledge,
// commits its own under the player's message, and never loses a note when the
// room home is deleted. Per-run scratchpad state must stay out of it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import * as library from '../server/lib/library.js';
import { htmlToText, webGet, WEB_ALLOWLIST, REFERENCE_VERSION } from '../server/lib/web.js';
import { Executor, learnedFiles } from '../client/astra/executor.mjs';
import { noteProblem, validatePlan, stateId } from '../client/astra/state.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-library-'));
const cfg = { runtimeDir: path.join(root, 'runtime') };
const template = path.join(root, 'template');
fs.mkdirSync(path.join(template, 'controls'), { recursive: true });
fs.writeFileSync(path.join(template, 'SKILL.md'), '# skill\n');
fs.writeFileSync(path.join(template, 'controls', 'CONTROLS.md'), 'A selects.\n');
fs.mkdirSync(path.join(template, 'scratchpad'), { recursive: true });
fs.writeFileSync(path.join(template, 'scratchpad', 'README.md'), 'per-run only\n');

const first = await library.ensureSkill(cfg, 'sts2-astra', template);
assert.ok(first.seeded);
assert.ok(first.commit, 'seeding makes a commit');
assert.ok(fs.existsSync(path.join(first.dir, 'SKILL.md')));
assert.ok(fs.existsSync(path.join(first.dir, 'learned', 'README.md')));
assert.ok(!fs.existsSync(path.join(first.dir, 'scratchpad')), 'per-run state stays out of the library');

// --- room one learns something -------------------------------------------
const roomOne = path.join(root, 'room-one', 'skills', 'sts2');
library.checkoutInto(cfg, 'sts2-astra', roomOne);
assert.ok(fs.existsSync(path.join(roomOne, 'controls', 'CONTROLS.md')));
fs.mkdirSync(path.join(roomOne, 'scratchpad'), { recursive: true });
fs.writeFileSync(path.join(roomOne, 'scratchpad', 'checkpoint.json'), '{"decision":12}');
fs.mkdirSync(path.join(roomOne, 'learned', 'bestiary'), { recursive: true });
fs.writeFileSync(path.join(roomOne, 'learned', 'bestiary', 'wriggler.md'), 'Empower then Strategic.\n');
const commit = await library.commitFromRoom(cfg, { skill: 'sts2-astra', roomSkillDir: roomOne, roomId: 'aaaa1111', player: 'STS2-Pi-Luna-v0.1', message: 'Record the Wriggler intent cycle' });
assert.ok(commit);

// Deleting the room home must not take the knowledge with it.
fs.rmSync(path.join(root, 'room-one'), { recursive: true, force: true });
assert.equal(fs.readFileSync(path.join(first.dir, 'learned', 'bestiary', 'wriggler.md'), 'utf8').trim(), 'Empower then Strategic.');
assert.ok(!fs.existsSync(path.join(first.dir, 'scratchpad', 'checkpoint.json')), 'run state is never committed');

// --- room two inherits it -------------------------------------------------
const roomTwo = path.join(root, 'room-two', 'skills', 'sts2');
library.checkoutInto(cfg, 'sts2-astra', roomTwo);
assert.equal(fs.readFileSync(path.join(roomTwo, 'learned', 'bestiary', 'wriggler.md'), 'utf8').trim(), 'Empower then Strategic.');
// The seeded areas keep note subjects apart, and the room's own note came with it.
assert.deepEqual(learnedFiles(roomTwo), [
  'README.md', 'bestiary/README.md', 'bestiary/wriggler.md', 'controls/README.md',
  'events/README.md', 'setups/README.md', 'strategy/README.md',
]);

// --- history reads like git ----------------------------------------------
const log = await library.history(cfg, { limit: 10 });
assert.equal(log[0].subject, 'Record the Wriggler intent cycle');
assert.equal(log[0].author, 'STS2-Pi-Luna-v0.1');
assert.equal(log[0].room, 'aaaa1111');
assert.ok(log[0].files.some((file) => file.path.endsWith('learned/bestiary/wriggler.md')));
assert.ok(log[0].files.every((file) => !file.path.includes('scratchpad')));
const patch = await library.diff(cfg, log[0].hash);
assert.match(patch.patch, /Empower then Strategic/);
await assert.rejects(() => library.diff(cfg, '../etc'), /invalid commit/);
assert.ok(library.tree(cfg, 'sts2-astra').some((file) => file.path.endsWith('wriggler.md')));
assert.throws(() => library.readFile(cfg, 'sts2-astra', '../../secret'), /outside the skill library/);
assert.throws(() => library.readFile(cfg, 'sts2-astra', 'scratchpad/checkpoint.json'), /outside the skill library|no such file/);

// A newer image adds files but must never clobber what the player wrote.
fs.writeFileSync(path.join(template, 'SKILL.md'), '# replaced by a newer image\n');
fs.writeFileSync(path.join(template, 'wiki.md'), 'new reference\n');
const again = await library.ensureSkill(cfg, 'sts2-astra', template);
assert.equal(again.seeded, false);
assert.deepEqual(again.added, ['wiki.md']);
assert.equal(fs.readFileSync(path.join(first.dir, 'SKILL.md'), 'utf8'), '# skill\n');

// Nothing new to say means no empty commit.
assert.equal(await library.commitFromRoom(cfg, { skill: 'sts2-astra', roomSkillDir: roomTwo, roomId: 'bbbb2222', player: 'p', message: 'no change' }), null);

// --- the player's learn/recall/research actions ---------------------------
const state = { state_type: 'map', player: { hp: 80 }, ui: { focus_path: '/map' }, map: { nodes: [], next_options: [] } };
const plan = (actions) => ({ observation: stateId(state), summary: 'fixture', note: 'fixture', actions });
for (const bad of [
  [{ type: 'research', url: 'http://slaythespire2.net/x' }],
  [{ type: 'recall', path: 'a/../../b.md' }],
  [{ type: 'learn', path: 'a.md', content: 'x', message: 'note must be last' }, { type: 'wait' }],
  [{ type: 'learn', path: 'a.md', content: 'x', message: 'only one note' }, { type: 'learn', path: 'b.md', content: 'x', message: 'second note' }],
]) assert.throws(() => validatePlan(plan(bad), state), /learn|recall|research|standalone|final action|at most one/);

// A badly formed note is a reported result, never a thrown plan rejection: it
// must not be able to end a run over optional bookkeeping.
for (const note of [
  { type: 'learn', path: '../escape.md', content: 'x', message: 'escape' },
  { type: 'learn', path: 'bestiary/wriggler.txt', content: 'x', message: 'wrong suffix' },
  { type: 'learn', path: 'bestiary/wriggler.md', content: 'x', message: 'no' },
  { type: 'learn', path: 'bestiary/wriggler.md', content: '', message: 'empty note' },
]) {
  assert.ok(noteProblem(note), 'the problem is described');
  validatePlan(plan([note]), state);
}
assert.equal(noteProblem({ type: 'learn', path: 'bestiary/wriggler.md', content: 'seen', message: 'Record it' }), null);
validatePlan(plan([{ type: 'learn', path: 'bestiary/wriggler.md', content: 'Observed', message: 'Record the cycle' }]), state);
validatePlan(plan([{ type: 'recall' }]), state);

const calls = [];
const executor = new Executor({
  skillDir: roomTwo,
  call: async (request) => {
    calls.push(request);
    if (request.op === 'sts2-get') return { body: JSON.stringify(state) };
    if (request.op === 'skill-commit') return { committed: true, commit: 'abc1234567' };
    if (request.op === 'web-get') return { url: `${request.url}&v=${REFERENCE_VERSION}`, retrieved: '2026-09-07', provenance: 'slaythespire2.net ?v=beta', truncated: false, text: 'Wriggler: Empower, then Strategic.' };
    return {};
  },
});
executor.sleep = async () => {};
const wrote = await executor.execute(plan([{ type: 'learn', path: 'events/wood-carvings.md', content: 'Bird, Snake, Torus.', message: 'Record Wood Carvings options' }]), state);
assert.equal(wrote.error, undefined);
assert.equal(wrote.completed[0].commit, 'abc1234567');
assert.equal(fs.readFileSync(path.join(roomTwo, 'learned', 'events', 'wood-carvings.md'), 'utf8'), 'Bird, Snake, Torus.\n');
assert.deepEqual(calls.filter((c) => c.op === 'skill-commit'), [{ op: 'skill-commit', message: 'Record Wood Carvings options' }]);

// A note may close a plan, recording what that plan just verified.
const withNote = plan([
  { type: 'input', buttons: ['left'], probe: true },
  { type: 'learn', path: 'controls/map.md', content: 'Left/right move between reachable nodes.', message: 'Record map focus movement' },
]);
validatePlan(withNote, state);
const both = await executor.execute(withNote, state);
assert.equal(both.error, undefined);
assert.equal(both.completed.length, 2);
assert.equal(both.completed[1].commit, 'abc1234567');
assert.equal(fs.readFileSync(path.join(roomTwo, 'learned', 'controls', 'map.md'), 'utf8').trim(), 'Left/right move between reachable nodes.');

// The same badly formed note reaches the executor as a result, and the plan's
// other verified work survives it.
const rejected = await executor.execute(plan([
  { type: 'input', buttons: ['left'], probe: true },
  { type: 'learn', path: 'events/../../escape.md', content: 'x', message: 'escape' },
]), state);
assert.equal(rejected.error, undefined);
assert.equal(rejected.completed[0].verified, true);
assert.equal(rejected.completed[1].verified, false);
assert.match(rejected.completed[1].error, /note not kept/);
assert.ok(!fs.existsSync(path.join(root, 'room-two', 'skills', 'escape.md')));

const read = await executor.execute(plan([{ type: 'recall', path: 'events/wood-carvings.md' }]), state);
assert.match(read.completed[0].text, /Bird, Snake, Torus/);
const listed = await executor.execute(plan([{ type: 'recall' }]), state);
assert.ok(listed.completed[0].learned_files.includes('events/wood-carvings.md'));
const missing = await executor.execute(plan([{ type: 'recall', path: 'events/nothing.md' }]), state);
assert.match(missing.error, /no learned note/);
const fetched = await executor.execute(plan([{ type: 'research', url: 'https://slaythespire2.net/monster/wriggler?v=beta' }]), state);
assert.match(fetched.completed[0].text, /Empower/);
assert.ok(fetched.completed[0].provenance);
// Keeping, recalling and researching notes send no gameplay input; the only
// presses above are the two deliberate probes.
assert.deepEqual(calls.filter((c) => String(c.op || '').startsWith('pad-')), [
  { op: 'pad-dpad', direction: 'left', presses: 1 },
  { op: 'pad-dpad', direction: 'left', presses: 1 },
]);

// --- web fetching stays on the allowlist ---------------------------------
for (const url of [
  'http://slaythespire2.net/x',
  'https://example.com/x',
  'https://slaythespire2.net.evil.com/x',
  'https://slaythespire2.wiki.gg/x',
  'https://slay-the-spire-2.fandom.com/x',
  'https://slaythespire2.net/monster/wriggler?v=live',
  'not a url',
]) {
  await assert.rejects(() => webGet({ url }), (error) => ['invalid_url', 'host_not_allowed', 'wrong_version'].includes(error.code));
}
assert.deepEqual(WEB_ALLOWLIST, ['slaythespire2.net', 'www.slaythespire2.net']);
assert.equal(htmlToText('<h1>Wriggler</h1><script>evil()</script><p>Deal 9 &amp; Empower</p>'), 'Wriggler\nDeal 9 & Empower');
// A note written into one of the seeded areas keeps its folder.
assert.ok(learnedFiles(roomTwo).includes('events/wood-carvings.md'));

fs.rmSync(root, { recursive: true, force: true });
console.log(JSON.stringify({ result: 'passed', verified: ['seed', 'inherit', 'commit-back', 'run state excluded', 'template never clobbers notes', 'git-style history', 'path escapes', 'learn/recall/research', 'a note may close a plan', 'a bad note never ends a run', 'note areas', 'single reference site pinned to beta'], gameInputs: 0 }));
