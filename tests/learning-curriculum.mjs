// The Voyager-derived parts of the player: an automatic curriculum that proposes
// objectives, a critic that is the only thing allowed to close one, and
// retrieval that puts the right learned note in front of the current screen.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Curriculum, situation } from '../client/learning/curriculum.mjs';
import { MAX_NOTE_IN_CONTEXT, indexNotes, parseNote, retrieve, situationTerms } from '../client/learning/retrieval.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-curriculum-'));
const skillDir = path.join(root, 'skills', 'sts2');
fs.mkdirSync(skillDir, { recursive: true });

const note = (relative, text) => {
  const file = path.join(skillDir, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

/** A planner that answers whatever the test queued, and records what it was asked. */
class FakePlanner {
  constructor() { this.answers = []; this.asked = []; }
  queue(answer) { this.answers.push(answer); return this; }
  async ask(request) {
    this.asked.push(request);
    if (!this.answers.length) throw new Error('no queued answer');
    const next = this.answers.shift();
    if (next instanceof Error) throw next;
    return next;
  }
}

const inRun = { state_type: 'map', run: { act: 1, floor: 3, ascension: 1, character: 'The Ironclad' }, player: { hp: 62, max_hp: 80 } };

// --- proposing -------------------------------------------------------------
const planner = new FakePlanner();
let curriculum = new Curriculum({ skillDir, planner, playerName: 'STS2-Pi-OrcaRouter', roomId: 'aaaa1111' });
assert.equal(curriculum.active, null, 'a fresh ladder has no objective');
assert.ok(curriculum.needsObjective(inRun));
assert.ok(!curriculum.needsObjective({ state_type: 'menu' }), 'no objective is proposed outside a run');

planner.queue({ objective: 'Reach floor 6 without dropping below 60% HP', why: 'the deck can take one more fight', done_when: 'the map shows floor 6 and hp/max_hp >= 0.6', area: 'strategy' });
const proposed = await curriculum.propose(inRun, { task: 'Win the run', decision: 4 });
assert.equal(proposed.status, 'active');
assert.equal(proposed.opened.room, 'aaaa1111');
assert.equal(planner.asked[0].prompt, 'curriculum.txt');
assert.equal(planner.asked[0].role, 'curriculum');
assert.ok(!('learned_notes' in planner.asked[0].context), 'the proposer is not handed the note catalogue to find gaps in');

planner.queue({ objective: 'Something vague', why: 'because' });
await assert.rejects(() => curriculum.propose(inRun, { task: 't', decision: 5 }), /completion condition/, 'an objective without an observable condition is refused');

// The active ladder is per-room scratch state and survives a player reload.
const ledgerFile = path.join(skillDir, 'scratchpad', 'objectives.json');
assert.ok(fs.existsSync(ledgerFile));
const reloaded = new Curriculum({ skillDir, planner: new FakePlanner() });
assert.equal(reloaded.active?.text, proposed.text, 'the objective survives a reload');

// --- the critic is the only thing that closes an objective -----------------
const evidence = [{ decision: 6, floor: 4, actions: ['input'], completed: [{ type: 'input', verified: true }] }];
planner.queue({ verdict: 'pending', reasoning: 'still on floor 4' });
let checked = await curriculum.verify(inRun, { decision: 8, evidence });
assert.equal(checked.verdict, 'pending');
assert.equal(curriculum.active?.text, proposed.text, 'pending leaves the objective open');
assert.equal(planner.asked.at(-1).prompt, 'critic.txt');
assert.deepEqual(planner.asked.at(-1).context.evidence, evidence, 'the critic judges the verified evidence');

planner.queue({ verdict: 'failure', reasoning: 'hp is already 55%', critique: 'Rest at the next campfire before the elite.' });
checked = await curriculum.verify(inRun, { decision: 12, evidence });
assert.equal(checked.verdict, 'failure');
assert.equal(curriculum.active?.attempts, 1);
assert.equal(curriculum.active?.critiques.at(-1), 'Rest at the next campfire before the elite.');
assert.equal(curriculum.context().objective.last_critique, 'Rest at the next campfire before the elite.', 'the critique reaches the next decision');

planner.queue({ verdict: 'failure', reasoning: 'still below', critique: 'again' });
planner.queue({ verdict: 'failure', reasoning: 'still below', critique: 'and again' });
await curriculum.verify(inRun, { decision: 16, evidence });
const abandoned = await curriculum.verify(inRun, { decision: 20, evidence });
assert.ok(abandoned.abandoned, 'three failures abandon the objective');
assert.equal(curriculum.active, null, 'so the curriculum can propose something reachable');
assert.equal(curriculum.failed.length, 1);

// An objective whose moment has passed is finished now, not failed three times:
// repeating a critique the player cannot act on wastes the decisions it rides on.
planner.queue({ objective: 'Resolve the live Trash Heap event', why: 'it is on screen', done_when: 'an events note records its options', area: 'events' });
await curriculum.propose(inRun, { task: 't', decision: 22 });
planner.queue({ verdict: 'failure', reachable: false, reasoning: 'the event was resolved and the run is on the map', critique: 'nothing to do' });
const gone = await curriculum.verify(inRun, { decision: 24, evidence });
assert.ok(gone.abandoned && gone.unreachable, 'one check settles it');
assert.equal(curriculum.active, null);
assert.equal(curriculum.failed.at(-1).attempts, 1, 'without spending the other two attempts');

planner.queue({ objective: 'Beat the act 1 boss', why: 'the deck is ready', done_when: 'act becomes 2', area: 'strategy' });
await curriculum.propose(inRun, { task: 'Win the run', decision: 21 });
planner.queue({ verdict: 'success', reasoning: 'the run is on act 2 floor 1' });
const won = await curriculum.verify({ ...inRun, run: { ...inRun.run, act: 2 } }, { decision: 30, evidence });
assert.equal(won.verdict, 'success');
assert.equal(curriculum.completed.length, 1);
assert.equal(curriculum.active, null);

// Decision context carries aggregate progress, not seed-specific old objectives.
const frontier = curriculum.context();
assert.equal(Object.values(frontier.curriculum_summary).reduce((n, x) => n + x.abandoned, 0), 2);
assert.equal(Object.values(frontier.curriculum_summary).reduce((n, x) => n + x.completed, 0), 1);

// --- checking happens at progress boundaries, not every decision -----------
planner.queue({ objective: 'Learn the Wriggler intent cycle', why: 'unknown elite', done_when: 'two full cycles observed', area: 'bestiary' });
await curriculum.propose(inRun, { task: 't', decision: 40 });
curriculum.crossedBoundary = false;
assert.equal(curriculum.dueForCheck(inRun, 41), false, 'not before the first observation');
curriculum.observe(inRun);
assert.equal(curriculum.dueForCheck(inRun, 42), false, 'not while nothing has moved');
const nextFloor = { ...inRun, run: { ...inRun.run, floor: 4 } };
curriculum.observe(nextFloor);
assert.equal(curriculum.dueForCheck(nextFloor, 41), false, 'not within the minimum gap');
assert.equal(curriculum.dueForCheck(nextFloor, 45), true, 'a floor change is a boundary');

// The crossing that combat swallows. In STS2 the floor advances exactly when a
// fight starts, and the caller refuses to run the critic while state.battle is
// set - so the decision that sees the transition is always skipped. Comparing
// against the immediately previous decision therefore lost every boundary in the
// run: the critic did not fire once in 85 decisions. The crossing has to survive
// until a check consumes it.
curriculum.lastCheckedAt = 50;
curriculum.crossedBoundary = false;
curriculum.observe(nextFloor);
const inCombat = { ...inRun, run: { ...inRun.run, floor: 5 }, battle: { round: 1, enemies: [] } };
curriculum.observe(inCombat);                       // the boundary, skipped by the caller
curriculum.observe(inCombat);                       // several more combat decisions
curriculum.observe(inCombat);
const afterCombat = { ...inRun, run: { ...inRun.run, floor: 5 }, state_type: 'rewards' };
curriculum.observe(afterCombat);
assert.equal(curriculum.dueForCheck(afterCombat, 60), true, 'a boundary crossed during combat is still due once combat ends');
curriculum.lastCheckedAt = 60;
curriculum.crossedBoundary = false;
assert.equal(curriculum.dueForCheck(afterCombat, 70), false, 'and it is consumed, not re-fired every decision after');

// --- a run that ends closes whatever was open ------------------------------
curriculum.closeRun(inRun, { decision: 50, result: 'lost' });
assert.equal(curriculum.active, null);
assert.equal(curriculum.failed.length, 3, 'an objective open when the run ended did not succeed');
assert.equal(JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).objectives.length, 4, 'the refused proposal was never stored');

// --- an objective never outlives the room that opened it -------------------
// The next room plays a different seed, so an objective opened against the last
// one describes a situation that no longer exists.
planner.queue({ objective: 'Reach the act 1 boss', why: 'the deck is ready', done_when: 'the boss fight opens', area: 'strategy' });
await curriculum.propose(inRun, { task: 't', decision: 60 });
assert.equal(curriculum.active?.opened.room, 'aaaa1111');
const nextRoom = new Curriculum({ skillDir, planner: new FakePlanner(), roomId: 'bbbb2222' });
assert.equal(nextRoom.active, null, 'the previous room left nothing open');
assert.match(nextRoom.failed.at(-1).closed.reasoning, /new room plays a new seed/);
assert.equal(Object.values(nextRoom.context().curriculum_summary).reduce((n, x) => n + x.completed, 0), 1, 'completed counts survive reload');
// Reopening the same room is not a new seed and must not retire anything.
planner.queue({ objective: 'Survive to floor 8', why: 'x', done_when: 'floor 8 reached', area: 'strategy' });
await new Curriculum({ skillDir, planner, roomId: 'bbbb2222' }).propose(inRun, { task: 't', decision: 70 });
assert.equal(new Curriculum({ skillDir, planner: new FakePlanner(), roomId: 'bbbb2222' }).active?.text, 'Survive to floor 8');

// A room with no skill library still plays; it just cannot keep a ladder.
const homeless = new Curriculum({ skillDir: null, planner: new FakePlanner() });
assert.equal(homeless.save(), false);
assert.equal(homeless.active, null);

// --- retrieval -------------------------------------------------------------
note('bestiary/wriggler.md', '---\ndescription: Wriggler intent cycle at ascension 1\nkeys: wriggler, elite\n---\n# Wriggler\n\nEmpower, then Strategic Strike.\n');
note('bestiary/soul-fysh.md', '# Soul Fysh\n\nAttacks for 7.\n');
note('strategy/elites.md', '---\ndescription: When to take an elite\nkeys: elite, hp\n---\nNever below 60% HP.\n');
note('setups/ironclad-a1/openers.md', '---\ndescription: Ironclad ascension 1 opening priorities\nkeys: ironclad-a1, ironclad\n---\nTake block early.\n');
note('events/README.md', '# events/\n\nThis guide must never be retrieved as a note.\n');

const parsed = parseNote('bestiary/wriggler.md', fs.readFileSync(path.join(skillDir, 'bestiary', 'wriggler.md'), 'utf8'));
assert.deepEqual(parsed.keys, ['wriggler', 'elite']);
assert.equal(parsed.area, 'bestiary');
assert.ok(parsed.hasFrontMatter);
const plain = parseNote('bestiary/soul-fysh.md', '# Soul Fysh\n\nAttacks for 7.\n');
assert.equal(plain.description, 'Soul Fysh', 'a note without front matter still describes itself');
assert.ok(plain.pathTerms.includes('fysh'), 'and is still findable by its path');

// A diary of one seed is never put in front of the planner, even if an older
// run left one in the library.
note('events/act1-floor4-card-offer-a1.md', '---\ndescription: The floor 4 offer\nkeys: wriggler, ironclad, card-reward\n---\nThunderclap, Anger, Second Wind.\n');

const index = indexNotes(skillDir);
assert.equal(index.length, 4, 'README guides, curriculum.json and one-run diaries are not notes');
assert.ok(!index.some((item) => /README/.test(item.path)));
assert.ok(!index.some((item) => /floor4/.test(item.path)), 'a note naming one moment of one run is never retrieved');

const fighting = { state_type: 'battle', run: { act: 1, floor: 5, ascension: 1, character: 'The Ironclad' }, battle: { enemies: [{ name: 'Wriggler', hp: 40 }] }, player: { hp: 60, max_hp: 80, hand: [] } };
const terms = situationTerms(fighting, { text: 'Learn the Wriggler intent cycle', area: 'bestiary' });
assert.equal(terms.weights.get('wriggler'), 8, 'the enemy in front of the player is the most specific term');
assert.equal(terms.weights.get('ironclad-a1'), 2, 'this exact character and ascension is a weaker retrieval key');
assert.equal(terms.weights.get('battle'), 1);

const found = retrieve(skillDir, index, fighting, { text: 'Learn the Wriggler intent cycle', area: 'bestiary' });
assert.equal(found[0].path, 'bestiary/wriggler.md', 'the enemy on screen outranks everything else');
assert.match(found[0].content, /Strategic Strike/, 'the body is read, not just the name');
assert.deepEqual(found[0].matched.includes('wriggler'), true);
assert.ok(found.some((item) => item.path === 'setups/ironclad-a1/openers.md'), 'the notes for this exact setup come along');
assert.ok(!found.some((item) => item.path === 'bestiary/soul-fysh.md'), 'an enemy that is not here is not retrieved');

const nothingKnown = retrieve(skillDir, index, { state_type: 'battle', battle: { enemies: [{ name: 'Gremlin Nob' }] }, player: {} }, null);
assert.deepEqual(nothingKnown, [], 'no match means no notes, not a random one');

const tight = retrieve(skillDir, index, fighting, { text: 'x', area: 'bestiary' }, { budget: 220 });
assert.equal(tight.length, 1, 'the budget bounds how many notes are injected');
assert.equal(tight[0].path, 'bestiary/wriggler.md', 'and spends it on the most relevant one');

// One note can never fill the whole decision context on its own.
const oversized = 'Empower then Strategic Strike. '.repeat(Math.ceil(MAX_NOTE_IN_CONTEXT / 20));
note('bestiary/wriggler.md', `---\ndescription: Wriggler\nkeys: wriggler\n---\n${oversized}`);
const long = retrieve(skillDir, indexNotes(skillDir), fighting, { text: 'x', area: 'bestiary' });
assert.ok(long[0].truncated, 'an overlong note is cut, not dropped');
assert.ok(long[0].content.length <= MAX_NOTE_IN_CONTEXT);

// --- the situation summary the reasoners share -----------------------------
const summary = situation(fighting);
assert.equal(summary.character, 'The Ironclad');
assert.deepEqual(summary.enemies, ['Wriggler']);
assert.equal(summary.hp, 60);

fs.rmSync(root, { recursive: true, force: true });
console.log(JSON.stringify({ result: 'passed', verified: ['propose', 'completion condition required', 'ladder inherited', 'critic pending/failure/success', 'critique reaches the next decision', 'three failures abandon', 'an unreachable objective is abandoned at once', 'frontier carried forward', 'progress-boundary checks', 'a boundary crossed during combat survives until the critic consumes it', 'run close', 'objective never outlives its room', 'front matter', 'retrieval ranking', 'retrieval budget'] }));
