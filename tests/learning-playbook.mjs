import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EncounterScratchpad } from '../client/learning/encounter.mjs';
import { budgetNotice, parsePlanText } from '../client/learning/planner.mjs';
import { Act1Timer, ACT1_TARGET_MS } from '../client/learning/pacing.mjs';
import { indexNotes, parseNote, retrieve } from '../client/learning/retrieval.mjs';
import { energyCost, plannerGuidance, stateDiff, stateId, transientUpstream, validatePlan } from '../client/learning/state.mjs';

// Encounter memory is rebuilt from structured state and resets on the stable
// encounter identity supplied by the mod.
const scratch = new EncounterScratchpad();
const strike = { instance_id: 1, id: 'STRIKE', name: 'Strike', type: 'Attack', description: 'Deal damage.' };
const state = { state_type: 'monster', encounter_id: 'first', run: { act: 1, floor: 1 }, player: { hand: [strike], discard_pile: [], exhaust_pile: [], status: [{ name: 'Strength', amount: 2 }] }, battle: { round: 1, turn: 'player', is_play_phase: true, enemies: [{ entity_id: 'FOGMOG_0', name: 'Fogmog', hp: 50, status: [{ name: 'Intangible', amount: 1 }] }] } };
assert.equal(scratch.observe(state).player_powers[0].name, 'Strength');
scratch.hypothesize('Try a high-value draw before choosing the remainder.');
state.player.hand = [];
state.player.exhaust_pile = [strike];
state.battle.enemies[0].status = [];
let observed = scratch.observe(state, [{ action: 'play_card', card: 1 }]);
assert.equal(observed.piles.hand.count, 0);
assert.deepEqual(observed.piles.exhaust_pile.cards[0].instances, [1]);
assert.deepEqual(observed.enemies[0].powers, []);
assert.equal(observed.verified_recent_effects.length, 1);
state.encounter_id = 'second';
observed = scratch.observe(state);
assert.deepEqual(observed.verified_recent_effects, []);
assert.deepEqual(observed.unresolved_hypotheses, []);
assert.equal(scratch.observe({ state_type: 'map' }), null);

// Pacing state survives a reload and stops accumulating after Act 1.
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
timer.observe({ run: { act: 2 } });
const elapsed = timer.summary().elapsedMs;
now += 5000;
assert.equal(timer.summary().status, 'completed');
assert.equal(timer.summary().elapsedMs, elapsed);

// Replan diagnostics describe structured gameplay changes only.
const before = { state_type: 'map', run: { act: 1, floor: 2 }, player: { hp: 80, gold: 99 } };
const after = { state_type: 'event', run: { act: 1, floor: 3 }, player: { hp: 75, gold: 99 } };
assert.deepEqual(stateDiff(before, after), {
  state_type: { was: 'map', now: 'event' },
  floor: { was: 2, now: 3 },
  hp: { was: 80, now: 75 },
});
assert.deepEqual(stateDiff(before, before), {});

for (const failure of ['decision exceeded 120-second deadline', 'empty decision response: 1 assistant messages, 0 text chunks, stop reason length']) {
  const guidance = plannerGuidance(failure);
  assert.match(guidance, /ran out of budget/);
  assert.match(guidance, /SAME observation/);
}
assert.match(plannerGuidance('end_turn must be the only gameplay action in its plan'), /never include end_turn with play_card/);
const preamble = 'Use the stable card identity from the observation.\n\n'
  + '{"observation":"957a44e9adc4b2de","summary":"Play Strike.","actions":[{"type":"play_card","card":83}]}';
assert.equal(parsePlanText(preamble).actions[0].type, 'play_card');
assert.equal(parsePlanText('{"observation":"x","actions":[]}').observation, 'x');
for (const junk of ['I cannot answer that.', '{ not json }', '[1,2,3]', '']) assert.throws(() => parsePlanText(junk));
for (const [ms, seconds] of [[120000, 120], [45000, 45], [30000, 30], [60000, 60]]) {
  const notice = budgetNotice(ms);
  assert.match(notice, new RegExp(`abandoned after ${seconds} seconds`));
  assert.match(notice, /NO plan/);
}
assert.notEqual(budgetNotice(30000), budgetNotice(120000));
for (const outage of ['429: temporarily busy', 'Pi exited 1: 503 Service Unavailable', 'fetch failed: ECONNRESET']) assert.equal(transientUpstream(outage), true);
for (const modelError of ['stale or missing observation ID', 'decision exceeded 120-second deadline', 'fixture provider unavailable', undefined]) assert.equal(transientUpstream(modelError), false);

// Numeric string costs remain parseable for display and diagnostics. The
// executor uses each card's live can_play result rather than summing base costs
// across a batch, because card effects may discount later plays or grant energy.
assert.equal(energyCost('2'), 2);
assert.equal(energyCost(2), 2);
for (const unknown of ['X', '', null, undefined, '1.5', '-1']) assert.equal(energyCost(unknown), null);
const combat = {
  state_type: 'monster',
  battle: { round: 1, turn: 'player', is_play_phase: true, enemies: [{ entity_id: 'SLUG_0', name: 'Corpse Slug', hp: 14 }] },
  player: { energy: 3, hand: [
    { instance_id: 23, name: 'Defend', cost: '1', target_type: 'None', can_play: true },
    { instance_id: 25, name: 'Strike', cost: '1', target_type: 'AnyEnemy', can_play: true },
    { instance_id: 26, name: 'Bash', cost: '2', target_type: 'AnyEnemy', can_play: true },
  ] },
};
const combatPlan = cards => ({ observation: stateId(combat), summary: 'turn', actions: cards.map(card => ({ type: 'play_card', card, ...(card === 23 ? {} : { target: 'SLUG_0' }) })) });
assert.doesNotThrow(() => validatePlan(combatPlan([26, 25, 23]), combat));
assert.ok(validatePlan(combatPlan([26, 25]), combat));
const unavailable = { ...combat, player: { ...combat.player, hand: combat.player.hand.map(card => card.instance_id === 26 ? { ...card, can_play: false } : card) } };
assert.throws(() => validatePlan({ ...combatPlan([26]), observation: stateId(unavailable) }, unavailable), /not currently playable/);

// Retrieval indexes substantive strategy notes and ignores scratch state and
// bare navigation READMEs.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-contract-'));
try {
  const guide = 'ironclad/a1/meta_strategy/buffs/README.md';
  fs.mkdirSync(path.dirname(path.join(directory, guide)), { recursive: true });
  fs.writeFileSync(path.join(directory, guide), '---\ndescription: >-\n  Fogmog intent constraints\n  and damage restrictions\nkeys: [fogmog, intangible, damage restrictions]\n---\n# Buffs\nUse the current restriction before calculating damage.\n');
  fs.writeFileSync(path.join(directory, 'README.md'), '# Navigation only\n');
  fs.mkdirSync(path.join(directory, 'scratchpad'));
  fs.writeFileSync(path.join(directory, 'scratchpad', 'private.md'), '# Fogmog\n');
  const indexed = indexNotes(directory);
  assert.equal(indexed.length, 1);
  assert.equal(indexed[0].description, 'Fogmog intent constraints and damage restrictions');
  assert.ok(indexed[0].keys.includes('restrictions'));
  assert.equal(retrieve(directory, indexed, { battle: { enemies: [{ name: 'Fogmog' }] } }, null)[0].path, guide);
  assert.ok(parseNote(guide, fs.readFileSync(path.join(directory, guide), 'utf8')).hasFrontMatter);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

console.log(JSON.stringify({ result: 'passed', verified: ['structured encounter reset', 'pacing checkpoint', 'structured stale diff', 'semantic plan parsing', 'bounded planning', 'energy validation', 'strategy retrieval'] }));
