import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { combatState, encounterOver, strategistState } from '../client/learning/context.mjs';
import { ROLES, LANE, Roster, encounterLane } from '../client/learning/agents.mjs';
import { ROLE_ACTIONS } from '../client/learning/state.mjs';
import { UsageLedger, contextUsed } from '../server/lib/usage.js';

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

test('every model call is billed to the member that made it', () => {
  const ledger = new UsageLedger();
  ledger.add({ agent: 'combat-002-a1f2', role: 'combat', usage: { input: 9000, output: 1200, cacheRead: 500, reasoning: 1100, totalTokens: 10200 }, latencyMs: 12000, contextWindow: 1050000 });
  ledger.add({ agent: 'strategist', role: 'strategist', usage: { input: 8000, output: 400, reasoning: 300, totalTokens: 8400 }, latencyMs: 6000, contextWindow: 1050000 });
  ledger.add({ agent: 'combat-002-a1f2', role: 'combat', usage: { input: 11000, output: 900, cacheRead: 0, reasoning: 800, totalTokens: 11900 }, latencyMs: 9000, contextWindow: 1050000 });

  const snapshot = ledger.snapshot;
  assert.equal(Object.keys(snapshot).sort().join(','), 'combat-002-a1f2,strategist');
  const fight = snapshot['combat-002-a1f2'];
  assert.equal(fight.totals.turns, 2);
  assert.equal(fight.totals.input, 20000);
  assert.equal(fight.totals.reasoning, 1900);
  assert.equal(fight.totals.latencyMs, 21000);
  // The window has to hold the largest single turn, not the sum of them:
  // every call is its own session.
  assert.equal(fight.totals.peakContextUsed, 11900);
  assert.equal(snapshot.strategist.totals.turns, 1);
});

test('a turn that rolls off does not un-spend what it cost', () => {
  const ledger = new UsageLedger({ maxTurns: 2 });
  for (const input of [100, 200, 300]) ledger.add({ agent: 'strategist', usage: { input, output: 10 }, latencyMs: 1000 });
  const lane = ledger.snapshot.strategist;
  assert.equal(lane.turns.length, 2);
  assert.equal(lane.turns[0].input, 200);
  assert.equal(lane.totals.turns, 3);
  assert.equal(lane.totals.input, 600);
});

test('a provider reporting no total is not one that spent nothing', () => {
  const ledger = new UsageLedger();
  ledger.add({ agent: 'critic', usage: { input: 3000, output: 250 }, latencyMs: 4000, contextWindow: 1050000 });
  const [turn] = ledger.snapshot.critic.turns;
  assert.equal(turn.totalTokens, 3250);
  assert.equal(turn.contextUsed, 3250);
  assert.equal(contextUsed({ input: 10, cacheRead: 5, output: 2 }), 17);
});

test('a reloaded player keeps what the run already spent', () => {
  const first = new UsageLedger();
  first.add({ agent: 'strategist', usage: { input: 500, output: 40 }, latencyMs: 2000, contextWindow: 1050000 });
  const resumed = new UsageLedger().restore(first.snapshot);
  resumed.add({ agent: 'strategist', usage: { input: 700, output: 60 }, latencyMs: 3000, contextWindow: 1050000 });
  const lane = resumed.snapshot.strategist;
  assert.equal(lane.totals.turns, 2);
  assert.equal(lane.totals.input, 1200);
  assert.equal(lane.totals.latencyMs, 5000);
  assert.equal(lane.contextWindow, 1050000);
});
