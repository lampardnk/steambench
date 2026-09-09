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
import { Executor, learnedFiles } from '../client/learning/executor.mjs';
import { noteProblem, validatePlan, stateId } from '../client/learning/state.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-library-'));
const cfg = { runtimeDir: path.join(root, 'runtime') };
const template = path.join(root, 'template');
fs.mkdirSync(path.join(template, 'ironclad', 'a1', 'controls'), { recursive: true });
fs.writeFileSync(path.join(template, 'SKILL.md'), '# skill\n');
fs.writeFileSync(path.join(template, 'ironclad', 'a1', 'controls', 'CONTROLS.md'), 'A selects.\n');
fs.writeFileSync(path.join(template, 'ironclad', 'a1', 'controls', 'rewards.md'), '---\ndescription: The reward screen\nkeys: rewards\n---\nY proceeds once every row is taken.\n');
fs.mkdirSync(path.join(template, 'scratchpad'), { recursive: true });
fs.writeFileSync(path.join(template, 'scratchpad', 'README.md'), 'per-run only\n');

const first = await library.ensureSkill(cfg, 'sts2', template);
assert.ok(first.seeded);
assert.ok(first.commit, 'seeding makes a commit');
assert.ok(fs.existsSync(path.join(first.dir, 'SKILL.md')));
assert.ok(!fs.existsSync(path.join(first.dir, 'scratchpad')), 'per-run state stays out of the library');

// --- a room proposes, and cannot write the library ------------------------
// The player used to commit its whole tree back, so every note it wrote became a
// fact the next room inherited - and any curation done while it ran was undone:
// five diary notes deleted at 07:43 came back byte-identical at 07:52. A room now
// contributes exactly one file, scratchpad.md, for a human to merge.
const roomOne = path.join(root, 'room-one', 'skills', 'sts2');
library.checkoutInto(cfg, 'sts2', roomOne);
assert.ok(fs.existsSync(path.join(roomOne, 'ironclad', 'a1', 'controls', 'CONTROLS.md')));
fs.mkdirSync(path.join(roomOne, 'scratchpad'), { recursive: true });
fs.writeFileSync(path.join(roomOne, 'scratchpad', 'checkpoint.json'), '{"decision":12}');
// Everything a run might try: a brand new note, an edit to an inherited one, and
// the staging file.
fs.mkdirSync(path.join(roomOne, 'ironclad', 'a1', 'act1', 'normal'), { recursive: true });
fs.writeFileSync(path.join(roomOne, 'ironclad', 'a1', 'act1', 'normal', 'wriggler.md'), 'Empower then Strategic.\n');
fs.writeFileSync(path.join(roomOne, 'ironclad', 'a1', 'controls', 'CONTROLS.md'), 'Overwritten by the player.\n');
fs.writeFileSync(path.join(roomOne, 'scratchpad.md'), '# Staged notes\n\n## ironclad/a1/act1/normal/wriggler.md\n\nEmpower then Strategic.\n');
const commit = await library.commitFromRoom(cfg, { skill: 'sts2', roomSkillDir: roomOne, roomId: 'aaaa1111', player: 'STS2-Pi-OrcaRouter', message: 'Stage what room aaaa1111 proposed' });
assert.ok(commit);

fs.rmSync(path.join(root, 'room-one'), { recursive: true, force: true });
assert.ok(fs.existsSync(path.join(first.dir, 'scratchpad.md')), 'the proposal survives the room');
assert.match(fs.readFileSync(path.join(first.dir, 'scratchpad.md'), 'utf8'), /Empower then Strategic/);
assert.ok(!fs.existsSync(path.join(first.dir, 'ironclad', 'a1', 'act1', 'normal', 'wriggler.md')), 'a player cannot add a library note');
assert.notEqual(fs.readFileSync(path.join(first.dir, 'ironclad', 'a1', 'controls', 'CONTROLS.md'), 'utf8').trim(), 'Overwritten by the player.',
  'nor overwrite one it inherited');
assert.ok(!fs.existsSync(path.join(first.dir, 'scratchpad', 'checkpoint.json')), 'run state is never committed');

// --- a deletion sticks, even across a room that inherited the file --------
// A human-curated note, not a template file: deleting one of those is undone by
// ensureSkill re-seeding it from the image, which is intended - the template is
// the baseline. This is the other path, where a running room restored it.
const curated = path.join(first.dir, 'ironclad', 'a1', 'act1', 'normal', 'weeded.md');
fs.mkdirSync(path.dirname(curated), { recursive: true });
fs.writeFileSync(curated, '---\ndescription: a note a human later judged wrong\nkeys: weeded\n---\n# Weeded\n');
const roomTwo = path.join(root, 'room-two', 'skills', 'sts2');
library.checkoutInto(cfg, 'sts2', roomTwo);
assert.ok(fs.existsSync(path.join(roomTwo, 'ironclad', 'a1', 'act1', 'normal', 'weeded.md')), 'room two inherited it');
await library.commitFromRoom(cfg, { skill: 'sts2', roomSkillDir: roomTwo, roomId: 'bbbb2222', player: 'STS2-Pi-OrcaRouter', message: 'Keep the curated note' });
fs.rmSync(curated);                                                    // curated away while room two runs
await library.commitFromRoom(cfg, { skill: 'sts2', roomSkillDir: roomTwo, roomId: 'cccc3333', player: 'STS2-Pi-OrcaRouter', message: 'Finish room cccc3333' });
assert.ok(!fs.existsSync(curated), 'a note deleted while a room ran stays deleted');

// A staged proposal is never retrieved: it is exactly the unreviewed guess the
// staging file exists to keep out of the next room.
const roomThree = path.join(root, 'room-three', 'skills', 'sts2');
library.checkoutInto(cfg, 'sts2', roomThree);
assert.ok(fs.existsSync(path.join(roomThree, 'scratchpad.md')), 'the file is there to append to');
assert.deepEqual(learnedFiles(roomThree), ['SKILL.md', 'ironclad/a1/controls/CONTROLS.md', 'ironclad/a1/controls/rewards.md']);

// --- history reads like git ----------------------------------------------
const log = await library.history(cfg, { limit: 10 });
assert.equal(log[0].author, 'STS2-Pi-OrcaRouter');
assert.equal(log[0].room, 'cccc3333');
const staging = (await library.history(cfg, { limit: 10 })).find(entry => entry.room === 'aaaa1111');
assert.equal(staging.subject, 'Stage what room aaaa1111 proposed');
assert.ok(staging.files.some((file) => file.path.endsWith('sts2/scratchpad.md')));
assert.ok(staging.files.every((file) => !file.path.includes('scratchpad/')));
const patch = await library.diff(cfg, staging.hash);
assert.match(patch.patch, /Empower then Strategic/, 'the proposal is readable in the history');
await assert.rejects(() => library.diff(cfg, '../etc'), /invalid commit/);
assert.ok(library.tree(cfg, 'sts2').some((file) => file.path === 'scratchpad.md'));
assert.ok(!library.tree(cfg, 'sts2').some((file) => file.path.endsWith('wriggler.md')), 'and only there');
assert.throws(() => library.readFile(cfg, 'sts2', '../../secret'), /outside the skill library/);
assert.throws(() => library.readFile(cfg, 'sts2', 'scratchpad/checkpoint.json'), /outside the skill library|no such file/);

// A newer image is the authority for the paths it ships. Adding only, as this
// once did, meant a library seeded once kept its first copy of every template
// file forever: months of template corrections never reached it, which is how it
// served a CONTROLS.md with no front matter. The player cannot write these
// files, so there is nothing of its to protect.
fs.writeFileSync(path.join(template, 'SKILL.md'), '# replaced by a newer image\n');
fs.writeFileSync(path.join(template, 'wiki.md'), 'new reference\n');
const again = await library.ensureSkill(cfg, 'sts2', template);
assert.equal(again.seeded, false);
assert.deepEqual(again.added, ['wiki.md'], 'a new template path is reported as added');
assert.equal(fs.readFileSync(path.join(first.dir, 'SKILL.md'), 'utf8'), '# replaced by a newer image\n', 'and an existing one is refreshed');
// A path the template does not provide is left alone.
assert.match(fs.readFileSync(path.join(first.dir, 'scratchpad.md'), 'utf8'), /Empower then Strategic/);

// ...unless the template used to provide it. Moving a note is two edits the
// sync has to see as one: `act1/unknown/tea-master.md` became
// `meta_strategy/unknown/tea-master.md`, and because nothing ever deleted, the
// library served both - the stale copy still carrying the play verdicts the
// move had stripped out. A path the template has dropped is dropped here.
fs.mkdirSync(path.join(template, 'act1', 'unknown'), { recursive: true });
fs.writeFileSync(path.join(template, 'act1', 'unknown', 'tea-master.md'), 'take the tea (editable)\n');
fs.writeFileSync(path.join(template, 'act1', 'unknown', 'floor-3.md'), 'a diary note\n');
await library.ensureSkill(cfg, 'sts2', template);
assert.ok(fs.existsSync(path.join(first.dir, 'act1', 'unknown', 'tea-master.md')), 'shipped, so present');

fs.rmSync(path.join(template, 'act1'), { recursive: true });
fs.mkdirSync(path.join(template, 'meta_strategy', 'unknown'), { recursive: true });
fs.writeFileSync(path.join(template, 'meta_strategy', 'unknown', 'tea-master.md'), 'the tea costs 40 gold\n');
const moved = await library.ensureSkill(cfg, 'sts2', template);
assert.deepEqual(moved.dropped, ['act1/unknown/tea-master.md'], 'only the dropped note, and the diary note is exempt');
assert.ok(!fs.existsSync(path.join(first.dir, 'act1', 'unknown', 'tea-master.md')), 'the pre-move copy is gone');
assert.ok(fs.existsSync(path.join(first.dir, 'meta_strategy', 'unknown', 'tea-master.md')), 'and the new path is served');
assert.ok(fs.existsSync(path.join(first.dir, 'act1', 'unknown', 'floor-3.md')), 'a diary note the template stopped shipping is not a curation decision');
// What the sync must never prune: the room's staged proposals and the marker
// files migration writes, neither of which the template ever ships.
assert.match(fs.readFileSync(path.join(first.dir, 'scratchpad.md'), 'utf8'), /Empower then Strategic/);
fs.writeFileSync(path.join(first.dir, '.strategy-version'), '3\n');
const kept = await library.ensureSkill(cfg, 'sts2', template);
assert.deepEqual(kept.dropped, [], 'a dotfile is not a template path');
assert.ok(fs.existsSync(path.join(first.dir, '.strategy-version')));

// Nothing new to say means no empty commit.
assert.equal(await library.commitFromRoom(cfg, { skill: 'sts2', roomSkillDir: roomTwo, roomId: 'bbbb2222', player: 'p', message: 'no change' }), null);

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
  { type: 'learn', path: 'ironclad/a1/act1/normal/wriggler.txt', content: 'x', message: 'wrong suffix' },
  { type: 'learn', path: 'ironclad/a1/act1/normal/wriggler.md', content: 'x', message: 'no' },
  { type: 'learn', path: 'ironclad/a1/act1/normal/wriggler.md', content: '', message: 'empty note' },
]) {
  assert.ok(noteProblem(note), 'the problem is described');
  validatePlan(plan([note]), state);
}
const body = '---\ndescription: Wriggler intent graph\nkeys: wriggler\n---\n# Wriggler\nEmpower, then Strategic.\n';
assert.equal(noteProblem({ type: 'learn', path: 'ironclad/a1/act1/normal/wriggler.md', content: body, message: 'Record it' }), null);
validatePlan(plan([{ type: 'learn', path: 'ironclad/a1/act1/normal/wriggler.md', content: body, message: 'Record the cycle' }]), state);

// Every run is a different seed, so a note is refused when it journals one run
// or when it carries no front matter for the retriever to find it by.
assert.match(noteProblem({ type: 'learn', path: 'ironclad/a1/act1/unknown/act1-floor4-card-offer.md', content: body, message: 'Record the offer' }), /names one moment of this run/);
assert.match(noteProblem({ type: 'learn', path: 'ironclad/a1/act1/normal/nibbit-round2.md', content: body, message: 'Record it' }), /names one moment of this run/);
assert.equal(noteProblem({ type: 'learn', path: 'ironclad/a1/act1/map/act1.md', content: body, message: 'Record the act 1 pools' }), null);
assert.equal(noteProblem({ type: 'learn', path: 'ironclad/a1/act1/playbook/block-shortfall.md', content: body, message: 'Record the problem' }), null);
assert.match(noteProblem({ type: 'learn', path: 'ironclad/a1/act1/normal/nibbit.md', content: '# Nibbit\nEmpower.\n', message: 'Record it' }), /front matter/);
assert.match(noteProblem({ type: 'learn', path: 'ironclad/a1/act1/normal/nibbit.md', content: '---\ndescription: d\n---\nbody\n', message: 'Record it' }), /front matter/);
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
// A note is a PROPOSAL: it lands in scratchpad.md under the path it argues for,
// and that path is never opened. Writing the library directly is what filled it
// with one run's guesses and six notes about the same reward screen.
const carvings = '---\ndescription: How to judge Wood Carvings\nkeys: wood carvings, event\n---\nJudge the options by the deck the act demands.\n';
const wrote = await executor.execute(plan([{ type: 'learn', path: 'ironclad/a1/act1/unknown/wood-carvings.md', content: carvings, message: 'Record how to judge Wood Carvings' }]), state);
assert.equal(wrote.error, undefined);
assert.equal(wrote.completed[0].commit, 'abc1234567');
assert.equal(wrote.completed[0].staged, 'scratchpad.md');
assert.equal(wrote.completed[0].proposed_path, 'ironclad/a1/act1/unknown/wood-carvings.md');
assert.ok(!fs.existsSync(path.join(roomTwo, 'ironclad', 'a1', 'act1', 'unknown', 'wood-carvings.md')), 'the argued-for path is a label, never opened');
const staged = fs.readFileSync(path.join(roomTwo, 'scratchpad.md'), 'utf8');
assert.match(staged, /## ironclad\/a1\/act1\/unknown\/wood-carvings\.md/);
assert.match(staged, /Judge the options by the deck the act demands/);
assert.deepEqual(calls.filter((c) => c.op === 'skill-commit'), [{ op: 'skill-commit', message: 'Record how to judge Wood Carvings' }]);

// A note may close a plan, recording what that plan just verified.
const withNote = plan([
  { type: 'input', buttons: ['left'], probe: true },
  { type: 'learn', path: 'ironclad/a1/controls/map.md', content: '---\ndescription: Moving between reachable map nodes\nkeys: map, focus\n---\nLeft and right move between the reachable options; read their count from state.\n', message: 'Record map focus movement' },
]);
validatePlan(withNote, state);
const both = await executor.execute(withNote, state);
assert.equal(both.error, undefined);
assert.equal(both.completed.length, 2);
assert.equal(both.completed[1].commit, 'abc1234567');
// Both proposals accumulate in the one file, newest last, and neither reached a note.
const afterTwo = fs.readFileSync(path.join(roomTwo, 'scratchpad.md'), 'utf8');
assert.match(afterTwo, /read their count from state/);
assert.ok(afterTwo.indexOf('wood-carvings') < afterTwo.indexOf('controls/map.md'), 'appended in order');
assert.ok(!fs.existsSync(path.join(roomTwo, 'ironclad', 'a1', 'controls', 'map.md')));

// The same badly formed note reaches the executor as a result, and the plan's
// other verified work survives it.
const rejected = await executor.execute(plan([
  { type: 'input', buttons: ['left'], probe: true },
  { type: 'learn', path: 'ironclad/a1/act1/unknown/../../../../../escape.md', content: 'x', message: 'escape' },
]), state);
assert.equal(rejected.error, undefined);
assert.equal(rejected.completed[0].verified, true);
assert.equal(rejected.completed[1].verified, false);
assert.match(rejected.completed[1].error, /note not kept/);
assert.ok(!fs.existsSync(path.join(root, 'room-two', 'skills', 'escape.md')));

// recall reads the library, which is now only what a human put there. A path the
// player merely proposed is not a note and cannot be read back as one.
const read = await executor.execute(plan([{ type: 'recall', path: 'ironclad/a1/controls/rewards.md' }]), state);
assert.match(read.completed[0].text, /Y proceeds once every row is taken/);
const listed = await executor.execute(plan([{ type: 'recall' }]), state);
assert.ok(listed.completed[0].learned_files.includes('ironclad/a1/controls/rewards.md'));
assert.ok(!listed.completed[0].learned_files.includes('ironclad/a1/act1/unknown/wood-carvings.md'), 'a proposal is not a note');
assert.ok(!listed.completed[0].learned_files.includes('scratchpad.md'), 'and the staging file is not one either');
const proposedOnly = await executor.execute(plan([{ type: 'recall', path: 'ironclad/a1/act1/unknown/wood-carvings.md' }]), state);
assert.match(proposedOnly.error, /no learned note/);
const missing = await executor.execute(plan([{ type: 'recall', path: 'ironclad/a1/act1/unknown/nothing.md' }]), state);
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
  'https://evil-wiki.gg/x',
  'https://slay-the-spire-2.fandom.com/x',
  'https://slaythespire2.net/monster/wriggler?v=live',
  'not a url',
]) {
  await assert.rejects(() => webGet({ url }), (error) => ['invalid_url', 'host_not_allowed', 'wrong_version'].includes(error.code));
}
assert.deepEqual(WEB_ALLOWLIST, ['slaythespire2.net', 'slaythespire.wiki.gg']);
assert.equal(htmlToText('<h1>Wriggler</h1><script>evil()</script><p>Deal 9 &amp; Empower</p>'), 'Wriggler\nDeal 9 & Empower');
// The room's own tree gained no notes at all: everything it proposed is in the
// one staging file, and only a human can turn any of it into a library note.
assert.deepEqual(learnedFiles(roomTwo), [
  'SKILL.md',
  'ironclad/a1/act1/normal/weeded.md',   // inherited before it was curated away; the room keeps its copy
  'ironclad/a1/controls/CONTROLS.md',
  'ironclad/a1/controls/rewards.md',
]);

console.log(JSON.stringify({ result: 'passed', verified: ['seed', 'inherit', 'commit-back', 'run state excluded', 'the template is authoritative for what it ships', 'a note the template has moved leaves no copy behind', 'git-style history', 'path escapes', 'a learn action only ever stages a proposal', 'the library is human-curated: a room can neither add, edit nor resurrect a note', 'recall/research', 'a note may close a plan', 'a bad note never ends a run', 'note areas', 'seed-specific notes refused', 'front matter required', 'single reference site pinned to beta'], gameInputs: 0 }));


// --- a legacy <skill>-astra library is renamed, not stranded ---------------
// The learning player used to have its own tree. Rooms now share one skill per
// game, so an existing library must carry its notes and its history across.
const legacyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-legacy-'));
const legacyCfg = { runtimeDir: path.join(legacyRoot, 'runtime') };
await library.ensureSkill(legacyCfg, 'sts2-astra', template);
const legacyRoom = path.join(legacyRoot, 'room', 'skills', 'sts2');
library.checkoutInto(legacyCfg, 'sts2-astra', legacyRoom);
// A curated note in the legacy tree. It goes in directly because a room can no
// longer write the library; what is under test here is the rename, not authoring.
const legacyNote = path.join(library.libraryDir(legacyCfg), 'sts2-astra', 'ironclad', 'a1', 'act1', 'normal', 'wriggler.md');
fs.mkdirSync(path.dirname(legacyNote), { recursive: true });
fs.writeFileSync(legacyNote, 'Empower then Strategic.\n');
await library.commitFromRoom(legacyCfg, { skill: 'sts2-astra', roomSkillDir: legacyRoom, roomId: 'dddd4444', player: 'STS2-Pi-OrcaRouter', message: 'Record the Wriggler intent cycle' });

const migrated = await library.ensureSkill(legacyCfg, 'sts2', template);
assert.ok(!fs.existsSync(path.join(library.libraryDir(legacyCfg), 'sts2-astra')), 'the legacy tree is gone');
assert.equal(fs.readFileSync(path.join(migrated.dir, 'ironclad', 'a1', 'act1', 'normal', 'wriggler.md'), 'utf8').trim(), 'Empower then Strategic.', 'the note survived the rename');
const migratedLog = await library.history(legacyCfg, { limit: 20 });
assert.ok(migratedLog.some((entry) => /Record the Wriggler intent cycle/.test(entry.subject)), 'the history that produced the note survived too');
assert.ok(migratedLog.some((entry) => /Rename sts2-astra to sts2/.test(entry.subject)), 'the rename is an ordinary commit');
fs.rmSync(legacyRoot, { recursive: true, force: true });
fs.rmSync(root, { recursive: true, force: true });

console.log('learning-library: legacy skill rename ok');
