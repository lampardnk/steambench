import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EncounterScratchpad } from '../client/learning/encounter.mjs';
import { budgetNotice, parsePlanText } from '../client/learning/planner.mjs';
import { Act1Timer, ACT1_TARGET_MS } from '../client/learning/pacing.mjs';
import { focusTargets, navigationPath, pressableElement, targetElement } from '../client/learning/navigation.mjs';
import { indexNotes, parseNote, retrieve } from '../client/learning/retrieval.mjs';
import { stateId } from '../client/learning/state.mjs';
import { energyCost, plannerGuidance, stateDiff, transientUpstream, validatePlan } from '../client/learning/state.mjs';

const scratch = new EncounterScratchpad();
const strike = { instance_id: 1, id: 'strike', name: 'Strike', description: 'Deal damage.' };
const state = { run: { act: 1, floor: 1 }, ui: { encounter_id: 'first' }, player: { hand: [strike], exhaust_pile: [], buffs: [{ name: 'Strength', amount: 2 }] }, battle: { round: 1, enemies: [{ combat_id: 'enemy', name: 'Fogmog', hp: 50, powers: [{ name: 'Intangible', amount: 1 }] }] } };
assert.equal(scratch.observe(state).player_powers[0].name, 'Strength');
scratch.hypothesize('Try a high-value draw before choosing the remainder.');
state.player.hand = [];
state.player.exhaust_pile = [strike];
state.battle.enemies[0].powers = [];
let observed = scratch.observe(state, [{ type: 'play', card: 1 }]);
assert.equal(observed.piles.hand.count, 0);
assert.deepEqual(observed.piles.exhaust_pile.cards[0].instances, [1]);
assert.deepEqual(observed.enemies[0].powers, []);
assert.equal(observed.verified_recent_effects.length, 1);
state.ui.encounter_id = 'second';
observed = scratch.observe(state);
assert.deepEqual(observed.verified_recent_effects, []);
assert.deepEqual(observed.unresolved_hypotheses, []);
assert.equal(scratch.observe({ state_type: 'map' }), null);
assert.equal(scratch.context(), null);

let now = 1000;
let timer = new Act1Timer(null, () => now);
const neow = { run: { act: 1, floor: 1 }, event: { name: 'Neow' } };
timer.start(neow, false);
assert.equal(timer.summary().status, 'not_started');
timer.start(neow, true);
now += 1000;
timer.add('model', 1000);
assert.equal(timer.summary().elapsedMs, 1000);
timer = new Act1Timer(timer.data, () => now);
assert.equal(timer.summary().modelMs, 1000);
now += ACT1_TARGET_MS;
assert.equal(timer.summary().overrun, true);
timer.observe({ run: { act: 1 }, state_type: 'rewards' });
assert.equal(timer.summary().status, 'running');
timer.observe({ run: { act: 2 } });
const elapsed = timer.summary().elapsedMs;
now += 5000;
assert.equal(timer.summary().status, 'completed');
assert.equal(timer.summary().elapsedMs, elapsed);

const node = (id, neighbors = {}) => ({ id, visible: true, enabled: true, selectable: true, neighbors });
const graph = { ui: { elements: [node('a', { right: 'b' }), node('b', { left: 'a', down: 'c' }), node('c')] } };
assert.deepEqual(navigationPath(graph, 'a', 'c').map(step => step.direction), ['right', 'down']);
assert.throws(() => navigationPath(graph, 'a', 'c', 1), /no verified focus path/);
graph.ui.elements[1].enabled = false;
assert.throws(() => navigationPath(graph, 'a', 'c'), /no verified focus path/);
assert.throws(() => targetElement(graph, 'b'), /disabled/);
assert.throws(() => targetElement(graph, 'missing'), /missing/);

// A real card reward screen, captured from the run that halted on it. The agent
// could see the Skip button and could not reach it - and the decompiled game
// says it never could: NCardGrid.UpdateGridNavigation and
// NCardRewardSelectionScreen wire each card's up and down neighbours back to
// the card itself and wrap left and right within the row, so the row is a
// closed loop and Skip is bound to ui_cancel instead.
const reward = JSON.parse(fs.readFileSync(new URL('./fixtures/card-reward-skip.json', import.meta.url), 'utf8'));
const AFTERLIFE = 'element-108380819979';
const GLACIER = 'element-108447928847';
const ACCELERANT = 'element-108313711111';
const SKIP = 'element-1206550283364';
const SCREEN = 'element-1098488234998';
const byId = id => reward.ui.elements.find(item => item.id === id);

// There is no route, and reporting one would be a lie that costs real presses.
assert.throws(() => navigationPath(reward, AFTERLIFE, SKIP), /no verified focus path/);
assert.deepEqual(byId(AFTERLIFE).neighbors.down, AFTERLIFE);
// The row wraps instead, so left and right stay inside it forever.
assert.deepEqual(navigationPath(reward, AFTERLIFE, GLACIER).map(step => step.direction), ['left']);
assert.deepEqual(navigationPath(reward, ACCELERANT, GLACIER).map(step => step.direction), ['right']);
// Skip is addressable by its bound button, which needs no focus and no route.
assert.equal(pressableElement(reward, SKIP).press, 'b');
assert.deepEqual(byId(SKIP).hotkeys, ['ui_cancel', 'mega_pause_and_back']);
// Tooltips and the screen behind the cards are content, not focus targets.
const targets = focusTargets(reward).map(item => item.id);
assert.ok(targets.includes(SKIP) && targets.includes(AFTERLIFE));
assert.ok(!targets.includes(SCREEN));
assert.ok(reward.ui.elements.some(item => item.type === 'MegaRichTextLabel' && !targets.includes(item.id)));
assert.throws(() => targetElement(reward, SCREEN), /not selectable/);
// A missing ID names itself rather than blaming the target of the route.
assert.throws(() => targetElement(reward, 'element-nope'), /no element with ID element-nope/);
// A retry routes around the edge that just failed instead of pressing it again,
// which on a wrapping row means going the long way rather than giving up.
assert.deepEqual(navigationPath(reward, ACCELERANT, GLACIER, 12, new Set([`${ACCELERANT}|right`])).map(step => step.direction), ['left', 'left']);

// A replan is told what moved, not just that something did.
const before = { state_type: 'menu', run: { floor: 1 }, player: { hp: 80 }, ui: { scene_id: 'a', focused_element: 'element-1', elements: [{ label: 'Singleplayer' }] } };
const after = { state_type: 'menu', run: { floor: 1 }, player: { hp: 80 }, ui: { scene_id: 'b', focused_element: 'element-1', elements: [{ label: 'Standard' }] } };
const moved = stateDiff(before, after);
assert.deepEqual(moved.scene_id, { was: 'a', now: 'b' });
assert.deepEqual(moved.controls_added, ['Standard']);
assert.deepEqual(moved.controls_gone, ['Singleplayer']);
assert.equal(moved.hp, undefined);
assert.deepEqual(stateDiff(before, before), {});

// A planner that overran its deadline sent no plan at all, so "fix exactly what
// this message names" points at nothing and walks the model back through the
// same over-long reasoning that just cost it the turn. Three of those end a room.
// Both budgets fail the same way and take the same remedy. The truncation case
// is the one that actually ended a room: three `stop reason length` responses in
// a row on one floor-3 combat decision, each answered with "fix what this message
// names", which names nothing and reads as a demand to think harder.
for (const failure of ['decision exceeded 120-second deadline',
  'empty decision response: 1 assistant messages, 0 text chunks, stop reason length']) {
  const guidance = plannerGuidance(failure);
  assert.match(guidance, /ran out of budget/);
  assert.match(guidance, /SAME observation/);
  assert.doesNotMatch(guidance, /Fix exactly what this message names/);
}
// A complete, correct plan arrived wrapped in a sentence of prose and was thrown
// away three times, which ends a room. This is the real response, verbatim.
const preamble = 'Fighting the elite at 30 HP: block first, then attack. Pommel last since its draw pauses execution.\n\n'
  + '{"observation":"957a44e9adc4b2de","summary":"Play Strike, Defend, then Pommel Strike.","actions":[{"type":"play","card":83}],"note":"n"}';
assert.equal(parsePlanText(preamble).observation, '957a44e9adc4b2de');
assert.equal(parsePlanText(preamble).actions.length, 1);
// Plain JSON is untouched, and prose with no plan in it is still an error.
assert.equal(parsePlanText('{"observation":"x","actions":[]}').observation, 'x');
for (const junk of ['I cannot answer that.', '{ not json }', '[1,2,3]', '']) assert.throws(() => parsePlanText(junk));

// The deadline was always enforced and never disclosed: the model only learned
// its budget by losing a turn to it, and a call that runs out produces no plan
// at all. Every role is now told, from its own deadline, before it decides.
for (const [ms, seconds] of [[120000, 120], [45000, 45], [30000, 30], [60000, 60]]) {
  const notice = budgetNotice(ms);
  assert.match(notice, new RegExp(`abandoned after ${seconds} seconds`), `the budget states ${seconds}s`);
  assert.match(notice, /NO plan/);
}
// It is derived, not hardcoded: a notice that always said 120 would misreport
// the actuator's 30-second call by a factor of four.
assert.notEqual(budgetNotice(30000), budgetNotice(120000));

// A busy provider is not a bad plan. Three 429s in a row spent the refinement
// budget and ended a room, so these back off and retry instead of asking the
// model to fix someone else's outage.
for (const outage of [
  '429: {"message":"The upstream provider is temporarily busy. Please try again shortly.","code":"rate_limit_exceeded"}',
  'Pi exited 1: 503 Service Unavailable',
  'fetch failed: ECONNRESET',
]) assert.equal(transientUpstream(outage), true, outage);
// Anything the model itself got wrong must still be refined, never retried blindly.
for (const modelError of ['stale or missing observation ID', 'decision exceeded 120-second deadline',
  'empty decision response: 1 assistant messages, 0 text chunks, stop reason length',
  'fixture provider unavailable', undefined]) assert.equal(transientUpstream(modelError), false, String(modelError));

assert.match(plannerGuidance('stale or missing observation ID'), /Fix exactly what this message names/);
assert.match(plannerGuidance(undefined), /Fix exactly what this message names/);

// The sensor reports cost as a string, which turned the batch energy budget into
// a no-op for every card in the game: Number.isInteger("2") is false, so the
// check skipped itself and a 4-energy plan reached a 3-energy turn, failing at
// the game with Bash and Strike already sent. These are the real reported values.
assert.equal(energyCost('2'), 2);
assert.equal(energyCost(2), 2);
assert.equal(energyCost('0'), 0);
// X-cost and unplayable cards are genuinely unknowable and must skip the check,
// never count as free.
for (const unknown of ['X', '', null, undefined, '1.5', '-1']) assert.equal(energyCost(unknown), null);

const combat = {
  state_type: 'monster',
  battle: { round: 1, enemies: [{ combat_id: 'CORPSE_SLUG_0', name: 'Corpse Slug', hp: 14 }] },
  player: {
    energy: 3,
    hand: [
      { instance_id: 23, name: 'Defend', cost: '1', description: 'Gain 5 Block.', can_play: true },
      { instance_id: 25, name: 'Strike', cost: '1', description: 'Deal 6 damage.', can_play: true },
      { instance_id: 26, name: 'Bash', cost: '2', description: 'Deal 8 damage. Apply 2 Vulnerable.', can_play: true },
    ],
  },
};
const spend = cards => ({ observation: stateId(combat), summary: 'turn', note: 'n', actions: [...cards.map(card => ({ type: 'play', card })), { type: 'end_turn' }] });
assert.throws(() => validatePlan(spend([26, 25, 23]), combat), /spends 4 energy and the turn has 3/);
assert.ok(validatePlan(spend([26, 25]), combat), 'a plan the turn can pay for still passes');
// An X-cost card in the batch makes the total unknowable, so the check stands down.
combat.player.hand.push({ instance_id: 28, name: 'Whirlwind', cost: 'X', description: 'Deal 5 damage to ALL enemies X times.', can_play: true });
assert.ok(validatePlan(spend([26, 25, 28]), combat), 'an unknowable cost skips the budget rather than guessing');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-contract-'));
try {
  const guide = 'ironclad/a1/meta_strategy/buffs/README.md';
  fs.mkdirSync(path.dirname(path.join(directory, guide)), { recursive: true });
  fs.writeFileSync(path.join(directory, guide), '---\ndescription: >-\n  Fogmog intent constraints\n  and damage restrictions\nkeys: [fogmog, intangible, damage restrictions]\n---\n# Buffs\nUse the current restriction before calculating damage.\n');
  fs.writeFileSync(path.join(directory, 'README.md'), '# Navigation only\n');
  fs.mkdirSync(path.join(directory, 'scratchpad'));
  fs.writeFileSync(path.join(directory, 'scratchpad', 'private.md'), '# Fogmog\n');
  // A control note outranks a strategy note that scores higher on relevance:
  // how to work the screen is what stops every room re-deriving the same UI.
  const control = 'ironclad/a1/controls/fogmog-overlay.md';
  fs.mkdirSync(path.dirname(path.join(directory, control)), { recursive: true });
  fs.writeFileSync(path.join(directory, control), '---\ndescription: Closing the Fogmog inspect overlay\nkeys: [fogmog, overlay, controls]\n---\n# Overlay\nB closes it.\n');
  // On a screen, how to work the UI comes first - ahead of a strategy note that
  // scores higher on relevance, because re-deriving the screen is what costs runs.
  const screenNote = 'ironclad/a1/controls/rewards.md';
  fs.writeFileSync(path.join(directory, screenNote), '---\ndescription: Working the reward screen\nkeys: [rewards, fogmog, controls]\n---\n# Rewards\nY proceeds.\n');
  const onScreen = retrieve(directory, indexNotes(directory), { state_type: 'rewards', run: { character: 'The Ironclad', ascension: 1 }, battle: { enemies: [{ name: 'Fogmog' }] } }, null);
  assert.equal(onScreen[0].path, screenNote);
  fs.rmSync(path.join(directory, screenNote));

  // In a FIGHT it does not. Promoting control notes unconditionally handed every
  // slot to the UI, because a control note carries the character and ascension in
  // its keys and those match any decision at all: during a floor 7 elite fight the
  // five notes retrieved were about Neow bundles, the reward screen and the main
  // menu, and the note for the elite being fought never appeared.
  // Faithful to the real corpus: every note in a one-character library carries
  // the character and ascension in its keys, which is exactly what made them
  // worthless as a signal.
  const menu = 'ironclad/a1/controls/startup.md';
  fs.writeFileSync(path.join(directory, menu), '---\ndescription: Starting a run on Ironclad ascension 1\nkeys: [ironclad, ascension-1, startup, main menu]\n---\n# Startup\nA opens Singleplayer.\n');
  const neow = 'ironclad/a1/controls/neow-bundle-select.md';
  fs.writeFileSync(path.join(directory, neow), '---\ndescription: Selecting a Neow bundle on Ironclad ascension 1\nkeys: [ironclad, ascension-1, neow, bundle]\n---\n# Neow\nA opens the preview.\n');
  fs.writeFileSync(path.join(directory, guide), fs.readFileSync(path.join(directory, guide), 'utf8').replace('keys: [fogmog,', 'keys: [ironclad, ascension-1, fogmog,'));
  const inFight = retrieve(directory, indexNotes(directory), {
    state_type: 'monster',
    run: { character: 'The Ironclad', ascension: 1 },
    player: { hand: [{ name: 'Strike' }] },
    battle: { enemies: [{ name: 'Fogmog' }] },
  }, null);
  assert.ok(!inFight.some(note => note.path === menu), 'the main menu is not part of a fight');
  assert.ok(!inFight.some(note => note.path === neow), 'nor is the Neow bundle screen');
  assert.ok(inFight.some(note => note.path === guide), 'and what the fight is about is retrieved');
  // A control note still competes on merit: this one is about the enemy on screen.
  assert.ok(inFight.some(note => note.path === control));
  fs.rmSync(path.join(directory, menu));
  fs.rmSync(path.join(directory, neow));
  fs.rmSync(path.join(directory, control));

  const indexed = indexNotes(directory);
  assert.equal(indexed.length, 1);
  assert.equal(indexed[0].description, 'Fogmog intent constraints and damage restrictions');
  assert.ok(indexed[0].keys.includes('restrictions'));
  assert.equal(retrieve(directory, indexed, { battle: { enemies: [{ name: 'Fogmog' }] } }, null)[0].path, guide);
  assert.ok(parseNote(guide, fs.readFileSync(path.join(directory, guide), 'utf8')).hasFrontMatter);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
console.log(JSON.stringify({ result: 'passed', verified: ['fresh exhausted piles and powers', 'encounter reset', 'pacing checkpoint and act completion', 'bounded focus paths', 'a captured reward screen has no route to Skip and a bound button instead', 'control notes lead on a screen and never inside a fight', 'a replan is told exactly what moved', 'a string card cost is still budgeted against the turn', 'a busy provider is retried, not refined', 'a plan wrapped in prose is still a plan', 'an exhausted deadline or output budget is told to answer, not to fix', 'substantive README retrieval and folded descriptions'] }));
