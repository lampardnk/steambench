// The team: who reads what, who is allowed to ask for what, and who owns the pad.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LANE, ROLES, Roster, encounterLane, encounterTitle } from '../client/learning/agents.mjs';
import { Actuator, commandElement, matchElement, normalizeLabel, resolveIntent } from '../client/learning/actuator.mjs';
import { actuatorContext, actuatorElements, briefing, combatState, encounterKind, splitNotes, strategistState } from '../client/learning/context.mjs';
import { ROLE_ACTIONS, planIdentity, ready, settleAnimation, stateId, unbuiltMenu, validatePlan } from '../client/learning/state.mjs';
import { Executor } from '../client/learning/executor.mjs';
import { PiAgent } from '../server/lib/agent.js';
import { API_KEY_ENVS, DEFAULT_MODEL, MODEL_PROFILES, PROFILE } from '../server/lib/learning-profile.mjs';

const reward = JSON.parse(fs.readFileSync(new URL('./fixtures/card-reward-skip.json', import.meta.url), 'utf8'));
const combat = () => ({
  state_type: 'monster',
  run: { act: 1, floor: 7, ascension: 1 },
  player: { character: 'The Ironclad', hp: 54, max_hp: 80, energy: 3, gold: 120, relics: [{ id: 'BURNING_BLOOD', name: 'Burning Blood' }], potions: [], hand: [{ instance_id: 11, name: 'Strike', type: 'Attack', cost: '1', target_type: 'AnyEnemy', description: 'Deal 6 damage.' }], draw_pile: [{ instance_id: 12, name: 'Defend' }] },
  battle: { round: 2, turn: 'player', is_play_phase: true, enemies: [{ entity_id: 'ENEMY_0', combat_id: 'c0', name: 'Fogmog', hp: 30, intents: [{ name: 'Attack', damage: 9 }] }] },
  map: reward.map,
  deck: reward.deck,
  ui: reward.ui,
});

test('each member reads only what its own job rests on', () => {
  // ui is 63% of the sensor payload on this screen and no strategic decision
  // rests on any of it. It reached every agent on every decision, and with it
  // went every element id a plan could invent a route through.
  const full = JSON.stringify(reward).length;
  const strategist = strategistState(reward);
  assert.equal(strategist.ui, undefined);
  assert.equal(strategist.battle, undefined);
  assert.deepEqual(strategist.card_reward, reward.card_reward, 'the screen it must decide on is untouched');
  assert.ok(JSON.stringify(strategist).length < full * 0.4, 'the strategist reads well under half the payload');

  const fight = combat();
  const fighter = combatState(fight);
  assert.equal(fighter.ui, undefined);
  assert.equal(fighter.map, undefined, 'routing is not this agent\'s decision');
  assert.equal(fighter.deck, undefined, 'piles reach it through the scratchpad; two sources double-count a card');
  assert.deepEqual(fighter.battle, fight.battle);
  assert.deepEqual(fighter.player.hand, fight.player.hand);
  assert.equal(fighter.player.draw_pile, undefined, 'draw order is not knowable and listing it invites a plan that assumes it');

  // The actuator gets the interface and nothing else - no deck, no map, no objective.
  const pad = actuatorContext(reward, { goal: 'skip this reward', target_label: 'Skip' });
  assert.equal(pad.deck, undefined);
  assert.equal(pad.map, undefined);
  assert.equal(pad.goal, 'skip this reward');
  assert.ok(JSON.stringify(pad).length < 4000, 'the whole pad context fits in a few thousand characters');
});

test('controls the pad can never land on are not offered to the actuator', () => {
  const sent = actuatorElements(reward);
  const ids = new Set(sent.map(item => item.id));
  assert.ok(sent.length < reward.ui.elements.length, 'decoration is dropped');
  // A mouse-only label - a tooltip, a keyword blurb - arrives looking addressable.
  const decoration = reward.ui.elements.find(item => item.focus_mode === 'click' && !item.press && item.id !== reward.ui.focused_element);
  assert.ok(decoration, 'the fixture has click-only decoration');
  assert.equal(ids.has(decoration.id), false);
  // Whatever holds focus is addressable by definition, however it is configured.
  assert.equal(ids.has(reward.ui.focused_element), true);
  assert.ok(sent.every(item => item.neighbors === undefined && item.bounds === undefined));
});

test('a goal with a name is answered without a model call, and an unclear one is not', () => {
  assert.equal(normalizeLabel('NRewards_Proceed_Button'), 'nrewards proceed');
  const skip = resolveIntent(reward, { goal: 'skip the card reward', target_label: 'Skip' });
  assert.equal(skip.actions.length, 1);
  assert.equal(skip.actions[0].type, 'activate');
  assert.equal(skip.actions[0].scene, reward.ui.scene_id);
  // Exactly the Skip button, not the row label that also contains the word.
  assert.equal(reward.ui.elements.find(item => item.id === skip.actions[0].target).label, 'Skip');
  // A card the strategist named by its own name resolves the same way.
  assert.equal(matchElement(reward, 'Glacier').label, 'Glacier');
  // Nothing is inferred from the goal text: guessing a target out of a sentence
  // is the hallucination the whole split exists to remove.
  assert.equal(resolveIntent(reward, { goal: 'take the strongest card' }), null);
  assert.equal(matchElement(reward, 'the strongest card'), null);
  assert.equal(matchElement(reward, 'Proceed'), null);
});

test('an unresolved intent can never reach the pad', () => {
  const plan = { observation: stateId(reward), summary: 'skip', note: 'n', actions: [{ type: 'intent', goal: 'skip this reward', target_label: 'Skip' }] };
  assert.ok(validatePlan(plan, reward, { role: 'strategist' }));
  // The executor is the strictest reader of all: it accepts every concrete
  // action and refuses an intent, so a goal nobody resolved cannot be pressed.
  assert.throws(() => validatePlan(plan, reward), /must be resolved into concrete input/);
  assert.throws(() => validatePlan({ ...plan, actions: [{ type: 'activate', target: 'element-1206550283364', scene: reward.ui.scene_id }] }, reward, { role: 'strategist' }), /strategist cannot use activate/);
  assert.throws(() => validatePlan({ ...plan, actions: [{ type: 'input', buttons: ['a'] }] }, reward, { role: 'combat' }), /combat cannot use input/);
  assert.throws(() => validatePlan({ ...plan, actions: [{ type: 'intent', goal: 'x' }, { type: 'intent', goal: 'y' }] }, reward, { role: 'strategist' }), /one intent per plan/);
  assert.throws(() => validatePlan({ ...plan, actions: [{ type: 'intent', goal: '' }] }, reward, { role: 'strategist' }), /intent.goal/);
  // Every role's set is a subset of what the runtime can actually run.
  for (const [role, allowed] of Object.entries(ROLE_ACTIONS)) {
    assert.ok(allowed.size > 0, `${role} can do something`);
    assert.equal(allowed.has('intent') || role === 'actuator', true, `${role} either states intents or resolves them`);
  }
});

test('the actuator resolves a goal, carries the note along, and is the only path to the controller', async () => {
  const sent = [];
  const executor = { execute: async (plan) => { sent.push(plan); return { completed: plan.actions.map(action => ({ action, verified: true })), state: reward }; } };
  const planner = { ask: async () => { throw new Error('the model must not be called for a goal the label already answers'); } };
  const roster = new Roster({ emit: () => {} });
  const actuator = new Actuator({ planner, executor, roster });

  const note = { type: 'learn', path: 'ironclad/a1/meta_strategy/rewards/skipping.md', content: '---\ndescription: d\nkeys: k\n---\nSkipping is a real option.\n', message: 'Record when skipping wins' };
  const source = { observation: stateId(reward), summary: 'Skip it', note: 'The deck is already diluted.', actions: [{ type: 'intent', goal: 'skip this reward', target_label: 'Skip' }, note] };
  const { plan, resolution } = await actuator.resolve(source, reward, {});
  assert.equal(resolution, 'label');
  assert.equal(actuator.modelCalls, 0);
  assert.equal(actuator.resolved, 1);
  assert.equal(plan.actions[0].type, 'activate');
  assert.deepEqual(plan.actions.at(-1), note, 'the agent that verified something still gets to propose it');

  // Resolving sends nothing: the caller still gets to refuse the plan while the
  // scene is untouched.
  assert.equal(sent.length, 0);
  await actuator.execute(plan, reward);
  assert.equal(sent.length, 1);

  // A concrete plan - card play, ending a turn - passes through untouched.
  const fight = combat();
  const direct = { observation: stateId(fight), summary: 'Strike', note: 'n', actions: [{ type: 'play', card: 11, target: 'ENEMY_0' }] };
  const through = await actuator.resolve(direct, fight, {});
  assert.equal(through.resolution, 'direct');
  assert.equal(through.plan, direct);
});

test('an encounter opens its own lane and closes with one report', () => {
  const published = [];
  const roster = new Roster({ emit: event => published.push(event) });
  // The persistent lanes exist before anyone speaks, so the dashboard has a team
  // to render on an idle player.
  assert.deepEqual(roster.list.map(member => member.id), Object.values(LANE));
  assert.ok(roster.list.every(member => ROLES[member.role]));

  const fight = combat();
  assert.equal(encounterKind(fight), 'normal');
  assert.equal(encounterKind({ ...fight, state_type: 'elite' }), 'elite');
  assert.equal(encounterKind(reward), null, 'a reward screen during a run is not a fight');

  const lane = encounterLane(fight, 3);
  assert.match(lane, /^combat-003-a1f7$/);
  assert.notEqual(lane, encounterLane(fight, 4), 'a replayed floor gets its own lane rather than writing over the earlier fight');
  roster.open(lane, { role: 'combat', title: encounterTitle(fight, 'normal'), parent: LANE.strategist });
  assert.match(roster.list.at(-1).title, /Fogmog/);
  assert.equal(roster.list.at(-1).status, 'open');
  roster.count(lane);
  roster.close(lane, { outcome: 'won', summary: 'Vulnerable first nearly doubled the damage.' });
  const closed = roster.list.at(-1);
  assert.equal(closed.status, 'closed');
  assert.equal(closed.outcome, 'won');
  assert.equal(closed.decisions, 1);
  // Every change is published, so the client never has to infer the roster from
  // message traffic.
  assert.ok(published.filter(event => event.type === 'steambench_agents').length >= 3);
  assert.deepEqual(roster.as(lane, { type: 'message_start' }), undefined);
  assert.equal(published.at(-1).agent, lane);
});

test('the briefing is built from live state, so opening a fight costs no model call', () => {
  const fight = combat();
  const brief = briefing({ state: fight, kind: 'elite', strategy: 'Route towards the elite for the relic.', objective: { text: 'Establish the Fogmog intent graph', done_when: 'the cycle is seen twice' }, task: 'Play Ironclad A1.' });
  assert.equal(brief.encounter, 'elite');
  assert.equal(brief.entered_at_hp, 54);
  assert.equal(brief.floor, 7);
  assert.equal(brief.standing_plan, 'Route towards the elite for the relic.');
  assert.equal(brief.objective.done_when, 'the cycle is seen twice');
  assert.deepEqual(brief.relics, [{ id: 'BURNING_BLOOD', name: 'Burning Blood', description: undefined, counter: undefined }]);
});

test('control notes go to the actuator and play notes go to whoever is playing', () => {
  const notes = [
    { path: 'ironclad/a1/controls/rewards.md', content: 'Y proceeds.' },
    { path: 'ironclad/a1/act1/normal/fogmog.md', content: 'Fogmog alternates.' },
  ];
  const { control, play } = splitNotes(notes);
  assert.deepEqual(control.map(note => note.path), ['ironclad/a1/controls/rewards.md']);
  assert.deepEqual(play.map(note => note.path), ['ironclad/a1/act1/normal/fogmog.md']);
});

test('the dashboard files each member\'s words under that member', () => {
  const agent = new PiAgent({ name: 'test', image: 'test', env: {} });
  // Before the player says anything there is still a team to render.
  assert.deepEqual(agent.agents.map(member => member.id), ['room']);

  agent._onMessage({ type: 'steambench_agents', agents: [{ id: 'room', role: 'room', label: 'Room', status: 'open' }, { id: 'strategist', role: 'strategist', label: 'Strategist', status: 'open' }, { id: 'combat-001-a1f7', role: 'combat', label: 'Combat', status: 'open' }] });
  assert.equal(agent.agents.length, 3);

  agent._onMessage({ type: 'message_start', agent: 'strategist' });
  agent._onMessage({ type: 'message_update', agent: 'strategist', assistantMessageEvent: { type: 'text_delta', delta: 'Route left.' } });
  agent._onMessage({ type: 'message_start', agent: 'combat-001-a1f7' });
  agent._onMessage({ type: 'message_update', agent: 'combat-001-a1f7', assistantMessageEvent: { type: 'text_delta', delta: 'Strike twice.' } });
  agent._onMessage({ type: 'message_update', agent: 'strategist', assistantMessageEvent: { type: 'text_delta', delta: ' Then rest.' } });

  const byLane = Object.fromEntries(agent.transcript.filter(item => item.kind === 'text').map(item => [item.agent, item.text]));
  assert.deepEqual(byLane, { strategist: 'Route left. Then rest.', 'combat-001-a1f7': 'Strike twice.' });
  // Two speakers must never be spliced into one message.
  assert.equal(agent.transcript.filter(item => item.kind === 'text').length, 2);

  agent._onMessage({ type: 'tool_execution_start', agent: 'combat-001-a1f7', toolCallId: 'x', toolName: 'sts2_execute', args: {} });
  assert.equal(agent.transcript.at(-1).agent, 'combat-001-a1f7');
  // Anything the runtime says without naming a lane belongs to the room.
  agent._system('the sensor is missing');
  assert.equal(agent.transcript.at(-1).agent, 'room');
});

test('switching model or provider is one word, and nothing else names one', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../client/learning/models.json', import.meta.url), 'utf8'));
  for (const [key, profile] of Object.entries(MODEL_PROFILES)) {
    assert.equal(profile.key, key, `${key} knows its own name`);
    const provider = config.providers[profile.provider];
    assert.ok(provider, `models.json carries ${profile.provider}, so a switch needs no edit to the Pi configuration`);
    assert.equal(provider.baseUrl, profile.baseUrl);
    assert.equal(provider.apiKey, `$${profile.apiKeyEnv}`);
    const model = provider.models.find(entry => entry.id === profile.model);
    assert.ok(model, `${profile.model} is declared under ${profile.provider}`);
    assert.equal(model.maxTokens, profile.maxTokens, 'one budget, stated once');
    assert.equal(model.contextWindow, profile.contextWindow);
    assert.ok(model.input.includes('image'), 'the actuator sends screenshots');
    assert.ok(API_KEY_ENVS.includes(profile.apiKeyEnv));
  }
  assert.ok(MODEL_PROFILES[DEFAULT_MODEL]);
  assert.equal(PROFILE.model, MODEL_PROFILES[process.env.STEAMBENCH_MODEL || DEFAULT_MODEL].model);

  // Every runtime and host file reads the key name off the profile. A hardcoded
  // one is a switch that silently keeps calling the old provider.
  const sources = ['../client/learning/player.mjs', '../client/learning/planner.mjs', '../client/learning/decision-probe.mjs', '../server/bin/server.mjs', '../server/lib/rooms.js', '../server/lib/readiness.mjs', '../host/learning-decision-probe.mjs'];
  for (const file of sources) {
    const text = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const name of API_KEY_ENVS) {
      assert.equal(text.includes(name), false, `${file} names ${name} instead of reading PROFILE.apiKeyEnv`);
    }
  }
});

test('a menu that lists no controls has not loaded, and is not planned against', async () => {
  // The first observation of a real room: the mod answers before the main menu
  // scene exists, so an empty payload arrived that was identical to the next
  // empty payload and quiescing declared it settled at once.
  const empty = { state_type: 'menu', menu_screen: 'main', ui: { sensor_version: 5, focus_path: null, focused_element: null, elements: [] } };
  const loaded = { state_type: 'menu', menu_screen: 'main', ui: { sensor_version: 5, scene_id: 'menu', focus_path: '/root/Game/RootSceneContainer/MainMenu/MainMenuTextButtons/SingleplayerButton', focused_element: 'element-1', elements: [{ id: 'element-1', label: 'SingleplayerButton', visible: true, enabled: true, selectable: true, focus_mode: 'all', activation: 'a', neighbors: {} }] } };
  assert.equal(unbuiltMenu(empty), true);
  assert.equal(ready(empty), false, 'an empty menu must never be handed to an agent');
  assert.equal(unbuiltMenu(loaded), false);
  assert.equal(ready(loaded), true);
  // A menu is only unbuilt when it has nothing at all: a screen that reports
  // focus, or any control, is a real screen however sparse.
  assert.equal(unbuiltMenu({ ...empty, ui: { ...empty.ui, focused_element: 'element-1' } }), false);
  assert.equal(unbuiltMenu({ state_type: 'map', ui: { elements: [] } }), false, 'only menus are built this late');

  // The executor waits it out rather than acting on it.
  let reads = 0;
  const executor = new Executor({ call: async () => { reads++; return { body: JSON.stringify(reads < 4 ? empty : loaded) }; } });
  executor.sleep = async () => {};
  const settled = await executor.quiesced();
  assert.equal(settled.ui.focused_element, 'element-1');
  assert.ok(reads >= 4, 'it kept reading until the menu arrived');
});

test('a screen that re-rolls on its own is one screen, not a new one every second', async () => {
  // Two reads of a live transform preview a second apart. Only the card right
  // of the chosen one changed - but the mod rebuilds ui.scene_id when that
  // node is replaced, and scene_id is part of what a plan rests on. A real run
  // reached Neow, chose a Strike to transform, and then had three plans in a
  // row thrown away as stale before the room paused, having sent nothing.
  const { reads: [first, second] } = JSON.parse(fs.readFileSync(new URL('./fixtures/transform-preview-roll.json', import.meta.url), 'utf8'));
  assert.notEqual(first.ui.scene_id, second.ui.scene_id, 'the raw scene id churns with the roll');
  assert.notEqual(first.card_select.preview_cards[1].id, second.card_select.preview_cards[1].id);

  // Identity settles the screen itself rather than trusting the caller to have
  // done it: reading ui.scene_id raw, as it used to, is what let a plan
  // validate and then be declared stale by the next read of the same screen.
  assert.equal(planIdentity(first), planIdentity(second), 'it is one screen, however many times the card re-rolls');
  assert.equal(stateId(first), stateId(second));
  const [a, b] = [settleAnimation(first), settleAnimation(second)];
  assert.equal(planIdentity(a), planIdentity(b), 'and settling first changes nothing');
  assert.equal(stateId(a), stateId(b));
  assert.equal(stateId(settleAnimation(a)), stateId(a), 'settling twice changes nothing');

  // The chosen card survives; only the roll is taken out.
  assert.equal(a.card_select.preview_cards.length, 1);
  assert.equal(a.card_select.preview_cards[0].name, first.card_select.preview_cards[0].name);
  assert.equal(a.card_select.preview_cards[0].role, 'chosen_card');
  assert.match(a.ui.scene_id, /^transform-preview:/);
  const rolled = a.ui.elements.find(item => item.reference?.model_id === 'CARD.<re-rolling>');
  assert.ok(rolled, 'the rolling card element is neutralised, not deleted');
  assert.equal(rolled.label, null);
  // Every other screen is passed through untouched.
  assert.equal(settleAnimation(reward), reward);

  // It is applied where the sensor is read, so nothing downstream has to know.
  let read = 0;
  const executor = new Executor({ call: async () => ({ body: JSON.stringify(read++ % 2 ? second : first) }) });
  executor.sleep = async () => {};
  const settled = await executor.quiesced();
  assert.match(settled.ui.scene_id, /^transform-preview:/);
});

test('the label match declines whenever it is not certain, and the model is asked instead', () => {
  // Verbatim from the run this came out of: the strategist asked to confirm the
  // transform and named the card in the sentence, and the resolver picked the
  // card - which the screen could not even activate - instead of Confirm.
  const { reads: [screen] } = JSON.parse(fs.readFileSync(new URL('./fixtures/transform-preview-roll.json', import.meta.url), 'utf8'));
  assert.equal(screen.ui.focused_element, null, 'this overlay adopts no focus at all');
  const strike = screen.ui.elements.find(item => item.label === 'Strike' && item.focus_mode === 'all');
  assert.ok(strike && strike.press === undefined, 'and the card carries no bound button, so it is unreachable');
  assert.ok(screen.ui.elements.some(item => item.label === 'Confirm' && item.press === 'y'));

  assert.equal(matchElement(screen, 'Strike').id, strike.id, 'the label still matches');
  assert.equal(resolveIntent(screen, { goal: 'Confirm the transformation of the currently selected Strike', target_label: 'Strike' }), null,
    'nothing with no bound button and no focus to route from can be actuated, so it is not resolved');
  assert.equal(resolveIntent(screen, { goal: 'pick that card', target_label: 'Strike' }), null);
  // Focus existing is enough to make routing worth attempting.
  const focused = { ...screen, ui: { ...screen.ui, focused_element: strike.id } };
  assert.equal(resolveIntent(focused, { goal: 'pick that card', target_label: 'Strike' }).actions[0].target, strike.id);

  // The same sentence on a screen where the card IS reachable: two readings of
  // one goal is a judgement, and it is not made here.
  const simple = { state_type: 'card_select', ui: { sensor_version: 5, scene_id: 'sc', focused_element: 'card', elements: [
    { id: 'card', label: 'Strike', visible: true, enabled: true, selectable: true, focus_mode: 'all', activation: 'a', neighbors: {} },
    { id: 'ok', label: 'Confirm', visible: true, enabled: true, selectable: false, focus_mode: 'none', press: 'y', neighbors: {} },
  ] } };
  assert.equal(commandElement(simple, 'Confirm the transformation of the currently selected Strike').id, 'ok');
  assert.equal(resolveIntent(simple, { goal: 'Confirm the transformation of the currently selected Strike', target_label: 'Strike' }), null);
  assert.equal(resolveIntent(simple, { goal: 'confirm it', target_label: 'Confirm' }).actions[0].target, 'ok');
  assert.equal(resolveIntent(simple, { goal: 'take that card', target_label: 'Strike' }).actions[0].target, 'card');

  // The ordinary case is untouched: one named control, no competing command.
  assert.equal(resolveIntent(reward, { goal: 'skip this reward', target_label: 'Skip' }).actions[0].type, 'activate');
});
