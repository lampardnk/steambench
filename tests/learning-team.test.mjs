import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { combatState, encounterOver, strategistState } from '../client/learning/context.mjs';
import { ROLES, LANE, Roster, encounterLane } from '../client/learning/agents.mjs';
import { ROLE_ACTIONS } from '../client/learning/state.mjs';

test('the runtime has strategist and encounter roles with no actuator lane', () => {
  assert.deepEqual(Object.keys(ROLES), ['room', 'strategist', 'combat', 'curriculum', 'critic']);
  assert.equal('actuator' in LANE, false);
  assert.ok(ROLE_ACTIONS.strategist.has('menu_select'));
  assert.ok(ROLE_ACTIONS.combat.has('play_card'));
});

test('role projections expose only structured information needed by that role', () => {
  const state = { state_type: 'monster', ui: { elements: [1] }, map: { nodes: [1] }, deck: [{ id: 'A' }], battle: { enemies: [] }, player: { hand: [], draw_pile: [], discard_pile: [], exhaust_pile: [] } };
  const strategist = strategistState(state);
  const combat = combatState(state);
  assert.equal(strategist.ui, undefined); assert.equal(strategist.battle, undefined); assert.equal(strategist.player.hand, undefined);
  assert.equal(combat.ui, undefined); assert.equal(combat.map, undefined); assert.equal(combat.deck, undefined);
});
test('encounters close on post-combat monster frames without battle data', () => {
  const fight = { floor: 2 };
  assert.equal(encounterOver({ state_type: 'monster', message: 'Combat ended. Waiting for rewards...', run: { floor: 2 }, player: {} }, fight), true);
  assert.equal(encounterOver({ state_type: 'monster', run: { floor: 2 }, player: { hand: [] }, battle: { enemies: [] } }, fight), false);
});

test('encounters still receive their own dashboard lane', () => {
  const emitted = [];
  const roster = new Roster({ emit: event => emitted.push(event) });
  const id = encounterLane({ run: { act: 2, floor: 22 } }, 3);
  roster.open(id, { role: 'combat', title: 'elite', parent: 'strategist' });
  assert.equal(roster.list.find(item => item.id === id)?.parent, 'strategist');
});

test('prompts describe only semantic STS2MCP actions', () => {
  const prompts = ['strategist.txt', 'combat.txt'].map(file => fs.readFileSync(new URL(`../client/learning/${file}`, import.meta.url), 'utf8')).join('\n');
  assert.match(prompts, /play_card|menu_select/);
  assert.doesNotMatch(prompts, /target_label|focus_path|ui\.elements|"type":"(?:intent|activate|navigate|input|path|elements|scout)"/);
});
