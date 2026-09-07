import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EncounterScratchpad } from '../client/learning/encounter.mjs';
import { Act1Timer, ACT1_TARGET_MS } from '../client/learning/pacing.mjs';
import { navigationPath, targetElement } from '../client/learning/navigation.mjs';
import { indexNotes, parseNote, retrieve } from '../client/learning/retrieval.mjs';

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
console.log(JSON.stringify({ result: 'passed', verified: ['fresh exhausted piles and powers', 'encounter reset', 'pacing checkpoint and act completion', 'bounded focus paths', 'substantive README retrieval and folded descriptions'] }));
