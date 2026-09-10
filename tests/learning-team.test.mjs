
// When the wiring does not describe the screen, look at it and walk.
//
// The potion strip, the combat rows and an auto-named reward list are drawn as
// rows but wired in ways navigationPath cannot cross, so it reported no route
// and the run stopped where three presses in the obvious direction would have
// arrived. This is the combat cycle: from the potion bar, `down` reaches the
// hand through relics and the creatures.
{
  const box = (id, x, y, w = 60, h = 60) => ({ id, label: id, focus_mode: 'all', selectable: true, enabled: true, visible: true, bounds: [x, y, w, h] });
  // No `neighbors` anywhere, so navigationPath can find nothing at all.
  const rows = [box('potion', 503, 9), box('relic', 12, 82), box('creature', 359, 462, 242, 278), box('card', 655, 650, 607, 760)];
  const order = ['potion', 'relic', 'creature', 'card'];
  const walked = [];
  let at = 0;
  const screen = () => ({ state_type: 'monster', run: { act: 1, floor: 7, ascension: 1 }, player: { hp: 50, max_hp: 80, hand: [] },
    ui: { scene_id: 'combat-1', focused_element: order[at], elements: rows } });

  const executor = Object.create(Executor.prototype);
  executor.button = async (direction) => { walked.push(direction); if (direction === 'down') at = Math.min(at + 1, order.length - 1); };
  executor.observe = async () => screen();
  executor.record = () => {};
  executor.sleep = async () => {};

  const landed = await executor.navigateElement({ type: 'activate', target: 'card', scene: 'combat-1' }, screen());
  assert.equal(landed.ui.focused_element, 'card', 'it walks from the potion bar to the hand with no wiring at all');
  assert.deepEqual(walked, ['down', 'down', 'down'], `and presses down each time: ${walked.join(',')}`);
}

// A caption is not a control, and the node it names is.
//
// The map legend is a column of captions - "Unknown", "Merchant", "Rest" -
// with no activation, while each reachable node is labelled "Unknown at column
// 6, row 2", matching its next_options entry exactly. Matching over everything
// let the caption win on an exact match while the node only matched as a
// substring, so a run walked the map for six presses trying to reach a caption
// while already standing on the node it wanted.
{
  const map = { state_type: 'map', run: { act: 1, floor: 2, ascension: 1 }, player: {}, ui: {
    scene_id: 'map-1', focused_element: 'point-a', elements: [
      { id: 'legend-unknown', label: 'Unknown', focus_mode: 'all', selectable: true, enabled: true, visible: true, bounds: [1582, 390, 280, 48] },
      { id: 'node-unknown', label: 'Unknown at column 6, row 2', activation: 'a', focus_mode: 'all', selectable: true, enabled: true, visible: true, bounds: [1345, 367, 56, 56] },
      { id: 'point-a', label: 'Monster at column 4, row 2', activation: 'a', focus_mode: 'all', selectable: true, enabled: true, visible: true, bounds: [1060, 381, 56, 56] },
    ] } };
  const resolved = resolveIntent(map, { goal: 'Route to the Unknown room', target_label: 'Unknown' });
  assert.ok(resolved, 'it resolves rather than giving up');
  assert.equal(resolved.actions[0].target, 'node-unknown',
    'the caption is not a candidate, so the node it names wins even on a weaker match');

  // With no node to find, a screen of captions resolves to nothing at all.
  const captionsOnly = structuredClone(map);
  captionsOnly.ui.elements = captionsOnly.ui.elements.filter(item => item.id !== 'node-unknown');
  assert.equal(resolveIntent(captionsOnly, { goal: 'Route to the Unknown room', target_label: 'Unknown' }), null);
}

// A selection screen hands back what the press actually did.
//
// `a` toggles the highlighted card and the screen reports no selected list, so
// a run pressed it ten times, toggled its own choice off, and then kept
// activating a Confirm that had gone dark. can_confirm is the only readout, so
// it travels back with the action.
{
  const screen = (canConfirm) => ({
    state_type: 'hand_select',
    hand_select: { mode: 'upgrade_select', prompt: 'Confirm Card to Upgrade', can_confirm: canConfirm,
      cards: [{ index: 0, name: 'Defend' }, { index: 1, name: 'Strike' }, { index: 2, name: 'Uppercut' }] },
    ui: { scene_id: 's', focused_element: 'card', elements: [
      { id: 'confirm', label: 'SelectModeConfirmButton', press: 'y', activation: 'a', enabled: canConfirm, visible: true, focus_mode: 'none' },
      { id: 'endturn', label: 'End Turn 3', press: 'y', activation: 'a', enabled: false, visible: true, focus_mode: 'none' },
    ] },
  });

  const held = selectionGate(screen(true));
  assert.equal(held.can_confirm, true);
  assert.equal(held.confirm_control, 'confirm', 'it names the ENABLED confirm, not End Turn which shares y');
  assert.deepEqual(held.candidates, ['Defend', 'Strike', 'Uppercut']);
  assert.equal(held.mode, 'upgrade_select');

  const empty = selectionGate(screen(false));
  assert.equal(empty.can_confirm, false);
  assert.equal(empty.confirm_control, null, 'a dark confirm is not offered as the way out');

  assert.equal(selectionGate({ state_type: 'map', ui: { elements: [] } }), null, 'and it says nothing off a selection screen');
}

// Half the library was unreadable by name.
//
// `learn` insists on lowercase so proposals arrive in one naming style, and
// recall borrowed the same rule - but 29 of the 59 notes shipped as
// UNDERDOCKS_BOSSES.md and the like. The real name was refused by the
// validator and the lowercase name did not exist, so a run at decision 8
// deadlocked between the two and spent its whole refine budget.
{
  const state = { state_type: 'map', run: { act: 1, floor: 3, ascension: 1 }, player: { hp: 60, max_hp: 80 }, ui: {} };
  const plan = (path) => ({ observation: stateId(state), summary: 'Read the boss roster.', note: 'Routing towards the act boss.', actions: [{ type: 'recall', path }] });

  assert.doesNotThrow(() => validatePlan(plan('ironclad/a1/act1/boss/UNDERDOCKS_BOSSES.md'), state, { role: 'strategist' }),
    'a note is readable by the name it actually has');
  assert.doesNotThrow(() => validatePlan(plan('ironclad/a1/meta_strategy/map/README.md'), state, { role: 'strategist' }));
  for (const bad of ['ironclad/a1/../secret.md', 'ironclad//a1/x.md', '/etc/passwd.md', 'ironclad/a1/notes.txt']) {
    assert.throws(() => validatePlan(plan(bad), state, { role: 'strategist' }), /recall\.path/, `path safety still holds: ${bad}`);
  }
}

// A bobbing sprite is not a new situation.
//
// Live, in combat: two elements' bounds drifted 400 -> 398 between reads, one
// second apart, with the same scene, the same focus and nothing happening.
// stateId digested that geometry, so the observation id changed on its own and
// validatePlan rejected every plan written against the screen as stale before
// any input was sent. The run could not act at all.
{
  const at = (y) => ({ state_type: 'monster', run: { act: 1, floor: 7, ascension: 1 }, player: { hp: 50, max_hp: 80, hand: [] },
    ui: { scene_id: 'combat-1', focused_element: 'slot2', elements: [
      { id: 'slot2', label: null, focus_mode: 'all', selectable: true, enabled: true, visible: true, bounds: [627, 9, 60, 60] },
      { id: 'bobber', label: 'Enemy', focus_mode: 'all', selectable: true, enabled: true, visible: true, bounds: [800, y, 120, 160] },
    ] } });

  assert.equal(stateId(at(400)), stateId(at(398)), 'a two-pixel drift is the same observation');
  assert.notEqual(stateId(at(400)), stateId({ ...at(400), ui: { ...at(400).ui, focused_element: 'bobber' } }),
    'but a real focus change still is not');

  // The gate that was rejecting them: a plan written against the earlier read
  // must still validate against the later one.
  const plan = { observation: stateId(at(400)), summary: 'Move to the next potion slot.', note: 'One right reaches the next occupied holder.', actions: [{ type: 'input', buttons: ['right'] }] };
  assert.doesNotThrow(() => validatePlan(plan, at(398), { role: 'actuator' }), 'and the plan survives the drift');
}

// Getting back to the hand means backing out of what is trapping focus.
//
// Live: focus sat inside the potion popup on its Discard button, and four
// `down` presses moved nothing, because `down` cannot leave something modal.
// The run was told a full pass had failed while one `b` was the whole answer.
{
  const script = [
    { path: '/TopBar/PotionHolders/PotionHolder/PotionPopup/Container/DiscardButton', card: null },
    { path: '/TopBar/PotionHolders/PotionHolder/PotionPopup/Container/DiscardButton', card: null },
    { path: '/CombatRoom/AllyContainer/Creature/Hitbox', card: null },
    { path: '/CombatRoom/Hand/Card', card: 63 },
  ];
  const pressed = [];
  let at = 0;
  const executor = Object.create(Executor.prototype);
  // `down` is inert inside the popup; `b` closes it; then `down` walks.
  executor.button = async (button) => {
    pressed.push(button);
    if (at === 0 && button === 'b') at = 2;
    else if (at >= 2 && button === 'down') at = Math.min(at + 1, script.length - 1);
  };
  executor.observe = async () => ({ state_type: 'monster', run: { act: 1, floor: 7, ascension: 1 },
    player: { hp: 50, max_hp: 80, focused_card: script[at].card },
    ui: { scene_id: 'combat-1', focus_path: script[at].path, focused_card: script[at].card, elements: [] } });
  executor.record = () => {};
  executor.sleep = async () => {};

  const landed = await executor.focusHand({ ui: { focus_path: script[0].path } });
  assert.ok(landed, 'it gets back to the hand');
  assert.equal(landed.ui.focused_card, 63);
  assert.ok(pressed.includes('b'), `it backs out of the popup: ${pressed.join(',')}`);
}

// A screen that redraws under the cursor does not spend the recovery budget.
//
// Live, on the potion strip: every `right` moves focus to the next holder,
// which draws its popup, which changes scene_id. Two presses used the whole
// budget and the run was paused for "navigation recovery budget exhausted"
// while walking correctly towards the potion it wanted.
{
  const holder = (id, x, neighbors) => ({ id, label: null, focus_mode: 'all', selectable: true, enabled: true, visible: true, bounds: [x, 9, 60, 60], neighbors });
  const strip = [
    holder('empty', 503, { right: 'slot1' }),
    holder('slot1', 565, { right: 'slot2', left: 'empty' }),
    holder('slot2', 627, { right: 'slot3', left: 'slot1' }),
    holder('slot3', 689, { left: 'slot2' }),
  ];
  // Each press lands correctly AND changes the scene, as the real strip does.
  const order = ['empty', 'slot1', 'slot2', 'slot3'];
  const walked = [];
  let at = 0;
  const executor = Object.create(Executor.prototype);
  executor.button = async () => { walked.push('right'); at = Math.min(at + 1, order.length - 1); };
  executor.observe = async () => ({ state_type: 'monster', run: { act: 1, floor: 7, ascension: 1 }, player: { hp: 50, max_hp: 80 },
    ui: { scene_id: `strip-${at}`, focused_element: order[at], elements: strip } });
  executor.record = () => {};
  executor.sleep = async () => {};

  const start = { state_type: 'monster', run: { act: 1, floor: 7, ascension: 1 }, player: { hp: 50, max_hp: 80 },
    ui: { scene_id: 'strip-0', focused_element: 'empty', elements: strip } };
  const landed = await executor.navigateElement({ type: 'activate', target: 'slot3', scene: 'strip-0' }, start);
  assert.equal(landed.ui.focused_element, 'slot3', 'three presses along a redrawing strip still arrive');
  assert.equal(walked.length, 3, `and it takes exactly three: ${walked.join(',')}`);
}

// An activation that changes nothing names the way out.
//
// Live, on a combat card-select: the screen already reported can_confirm, so
// pressing `a` on the card did nothing at all, and "unknown activation
// outcome; explicit resume required" told the run nothing it could act on. The
// screen was one `y` from finished.
{
  const screen = {
    state_type: 'card_select',
    card_select: { prompt: 'Choose up to 2 cards to put into your Hand.', cards: [{ name: 'Bash' }], can_confirm: true, can_cancel: false },
    ui: { scene_id: 'select-1', focused_element: 'bash', elements: [
      { id: 'bash', label: 'Bash', focus_mode: 'all', selectable: true, enabled: true, visible: true, bounds: [0, 0, 10, 10] },
      { id: 'confirm', label: 'Confirm', press: 'y', activation: 'a', focus_mode: 'none', enabled: true, visible: true, bounds: [0, 0, 10, 10] },
      { id: 'endturn', label: 'End Turn 1', press: 'y', activation: 'a', focus_mode: 'none', enabled: false, visible: true, bounds: [0, 0, 10, 10] },
    ] },
  };
  const said = reachable(screen);
  assert.match(said, /Confirm \(y\)/, 'it names the control that finishes the screen');
  assert.match(said, /card_select\.can_confirm/, 'and that the screen says it is ready');
  assert.doesNotMatch(said, /End Turn/, 'a disabled control is not offered as a way out');
  assert.equal(reachable({ ui: { elements: [] } }), '', 'and it stays silent when there is genuinely nothing');
}

// A route ends where it was aimed, whatever the graph predicted on the way.
//
// Live, on a reward screen at act 1 floor 6. The screen was still dealing its
// rows in, so two recovery passes went on re-scening. On the third and last
// pass the route walked, and `down` landed on exactly the element the plan
// asked for - but the rows are named with auto-generated siblings
// (@Control@1848), so it did not equal the id the graph had predicted. That
// marked the walk failed, the loop ran out, and it threw "navigation recovery
// budget exhausted" with focus already sitting on the target.
{
  const row = (id, y, neighbors) => ({ id, label: id, focus_mode: 'all', selectable: true, enabled: true, visible: true, bounds: [758, y, 402, 86], neighbors });
  const rows = [
    row('gold', 374, { down: 'potion' }),
    row('potion', 470, { down: 'phantom', up: 'gold' }),
    row('phantom', 520, { down: 'card', up: 'potion' }),
    row('card', 566, { up: 'phantom' }),
  ];
  const screen = (focused, scene) => ({ state_type: 'rewards', run: { act: 1, floor: 6, ascension: 1 }, player: { hp: 58, max_hp: 80 },
    ui: { scene_id: scene, focused_element: focused, elements: rows } });

  // The screen settles under the first press, then the walk lands on the card.
  const reads = [screen('gold', 'rewards-2'), screen('potion', 'rewards-2'), screen('card', 'rewards-2'), screen('card', 'rewards-2')];
  const walked = [];
  let at = 0;
  const executor = Object.create(Executor.prototype);
  executor.button = async (direction) => { walked.push(direction); };
  executor.observe = async () => reads[Math.min(at++, reads.length - 1)];
  executor.record = () => {};
  executor.sleep = async () => {};

  const landed = await executor.navigateElement({ type: 'activate', target: 'card', scene: 'rewards-1' }, screen('gold', 'rewards-1'));
  assert.equal(landed.ui.focused_element, 'card', 'standing on the target is arrival, whatever the graph predicted');
}

// The team: who reads what, who is allowed to ask for what, and who owns the pad.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LANE, ROLES, Roster, encounterLane, encounterTitle } from '../client/learning/agents.mjs';
import { Actuator, commandElement, matchElement, normalizeLabel, resolveIntent } from '../client/learning/actuator.mjs';
import { controlManual, indexNotes, retrieve } from '../client/learning/retrieval.mjs';
import { EncounterScratchpad } from '../client/learning/encounter.mjs';
import { actuatorContext, actuatorElements, briefing, combatState, encounterKind, encounterOver, strategistContext, strategistState } from '../client/learning/context.mjs';
import { ROLE_ACTIONS, focusIdentity, planIdentity, ready, settleAnimation, situationId, stallReason, stateId, unbuiltMenu, validatePlan } from '../client/learning/state.mjs';
import { Executor, reachable, selectionGate } from '../client/learning/executor.mjs';
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

test('a control note never reaches a play agent, so it cannot spend their budget', () => {
  // retrieve() decides a note's destination by leaving control notes out
  // entirely: controlManual() delivers them to the actuator, and a play agent
  // cannot press anything anyway. This replaced splitNotes(), which filtered
  // them back out only after retrieval had already paid for them.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-controls-'));
  fs.mkdirSync(path.join(dir, 'ironclad/a1/controls'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'ironclad/a1/act1/normal'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'ironclad/a1/controls/rewards.md'), '---\ndescription: Working the reward screen\nkeys: [rewards, proceeds]\n---\nY proceeds.\n');
  fs.writeFileSync(path.join(dir, 'ironclad/a1/act1/normal/fogmog.md'), '---\ndescription: Fogmog intent constraints\nkeys: [fogmog, rewards]\n---\nFogmog alternates.\n');
  const index = indexNotes(dir);
  const screen = { state_type: 'rewards', run: { character: 'The Ironclad', ascension: 1 }, battle: { enemies: [{ name: 'Fogmog' }] } };
  assert.deepEqual(retrieve(dir, index, screen, null).map(note => note.path), ['ironclad/a1/act1/normal/fogmog.md'],
    'the screen note is retrieved and the control note is not');
  assert.deepEqual(controlManual(dir, index).map(note => note.path), ['ironclad/a1/controls/rewards.md'],
    'the manual is where the actuator gets it');
  fs.rmSync(dir, { recursive: true, force: true });
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
  const empty = { state_type: 'menu', menu_screen: 'main', ui: { sensor_version: 6, focus_path: null, focused_element: null, elements: [] } };
  const loaded = { state_type: 'menu', menu_screen: 'main', ui: { sensor_version: 6, scene_id: 'menu', focus_path: '/root/Game/RootSceneContainer/MainMenu/MainMenuTextButtons/SingleplayerButton', focused_element: 'element-1', elements: [{ id: 'element-1', label: 'SingleplayerButton', visible: true, enabled: true, selectable: true, focus_mode: 'all', activation: 'a', neighbors: {} }] } };
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

test('a rebuilt control is the same control, and only a real change discards a plan', () => {
  // Verbatim shape from the live sensor. Godot mints a fresh instance id for a
  // node whenever it is rebuilt, and the sensor builds both scene_id and
  // focused_element out of those ids: a tooltip showing, a pile count updating
  // and a targeting cursor passing back over a holder all produced a new id for
  // an unchanged screen. Measured over 512 idle windows in the archived runs,
  // the old identity declared 17.5% of them stale, and each one threw away a
  // finished model turn and made it plan the same screen again.
  const screen = (ids, focused, extra = []) => ({ state_type: 'monster', run: { floor: 6, act: 1 },
    player: { hp: 88, energy: 3, hand: [{ instance_id: 7, name: 'Strike' }] },
    battle: { round: 1, enemies: [{ combat_id: 'WRIGGLER_0', hp: 19 }] },
    ui: { sensor_version: 6, scene_id: ids.scene,
      elements: [
        { id: ids.strike, label: 'Strike', type: 'NHandCardHolder', reference: { kind: 'card', card: { id: 'STRIKE' } }, visible: true, enabled: true, focus_mode: 'all', selectable: true, activation: 'a', bounds: [350, 80, 300, 420] },
        { id: ids.defend, label: 'Defend', type: 'NHandCardHolder', reference: { kind: 'card', card: { id: 'DEFEND' } }, visible: true, enabled: true, focus_mode: 'all', selectable: true, activation: 'a', bounds: [630, 80, 300, 420] },
        // Presentation: a tooltip with no way for the pad to land on it.
        { id: ids.tip, label: 'Until next turn, prevents damage.', type: 'MegaRichTextLabel', reference: {}, visible: true, enabled: true, focus_mode: 'accessibility', selectable: false, activation: null, bounds: [1200, 700, 300, 54] },
        ...extra,
      ], focused_element: focused } });

  const before = screen({ scene: 'scene-a', strike: 'element-1', defend: 'element-2', tip: 'element-3' }, 'element-1');
  // Same two cards, same meaning, new instance ids and new scene id, focus on
  // the same card. Nothing a plan rests on moved.
  const after = screen({ scene: 'scene-b', strike: 'element-91', defend: 'element-92', tip: 'element-93' }, 'element-91');
  assert.notEqual(before.ui.scene_id, after.ui.scene_id, 'the raw scene id churns as nodes are rebuilt');
  assert.notEqual(before.ui.focused_element, after.ui.focused_element, 'so does the raw focus id');
  assert.equal(planIdentity(before), planIdentity(after), 'and the plan is still good');
  assert.equal(focusIdentity(before), focusIdentity(after), 'focus is on the same control, so a press stays safe');

  // A card actually replaced in the hand is a real change to what a plan can
  // name, even though the same number of controls are on screen.
  const swapped = screen({ scene: 'scene-c', strike: 'element-1', defend: 'element-2', tip: 'element-3' }, 'element-1');
  swapped.ui.elements[0].reference = { kind: 'card', card: { id: 'BASH' } };
  swapped.ui.elements[0].label = 'Bash';
  assert.notEqual(planIdentity(before), planIdentity(swapped), 'a different card is a different screen');

  // A control appearing (a popup opening) or leaving (the hand emptying) is a
  // real change: this is what the identity still has to catch.
  const opened = screen({ scene: 'scene-a', strike: 'element-1', defend: 'element-2', tip: 'element-3' }, 'element-1', [
    { id: 'element-99', label: 'End Turn', type: 'NEndTurnButton', reference: {}, visible: true, enabled: true, focus_mode: 'none', selectable: false, press: 'y', hotkeys: ['end_turn'], bounds: [1700, 900, 200, 60] },
  ]);
  assert.notEqual(planIdentity(before), planIdentity(opened), 'a control that appeared is a new screen');
  assert.equal(planIdentity(opened), planIdentity(screen({ scene: 'scene-z', strike: 'element-71', defend: 'element-72', tip: 'element-73' }, 'element-71', [
    { id: 'element-199', label: 'End Turn', type: 'NEndTurnButton', reference: {}, visible: true, enabled: true, focus_mode: 'none', selectable: false, press: 'y', hotkeys: ['end_turn'], bounds: [1700, 900, 200, 60] },
  ])), 'including when that control was rebuilt too');

  // Presentation is not part of the identity at all: a tooltip appearing does
  // not change what a plan can do.
  const tipped = screen({ scene: 'scene-a', strike: 'element-1', defend: 'element-2', tip: 'element-3' }, 'element-1');
  tipped.ui.elements.push({ id: 'element-98', label: 'Vulnerable creatures take 50% more damage from Attacks.', type: 'MegaRichTextLabel', reference: {}, visible: true, enabled: true, focus_mode: 'accessibility', selectable: false, activation: null, bounds: [891, 703, 300, 80] });
  assert.equal(planIdentity(before), planIdentity(tipped), 'a combat log line is not a new screen');

  // Focus moving to a DIFFERENT control is what a bare activation press cares
  // about, and that is exactly what focusIdentity reports.
  const refocused = screen({ scene: 'scene-a', strike: 'element-1', defend: 'element-2', tip: 'element-3' }, 'element-2');
  assert.equal(planIdentity(before), planIdentity(refocused), 'a moved cursor does not by itself make the plan stale');
  assert.notEqual(focusIdentity(before), focusIdentity(refocused), 'but an untargeted press must not fire from there');
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
  const simple = { state_type: 'card_select', ui: { sensor_version: 6, scene_id: 'sc', focused_element: 'card', elements: [
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

test('a label match the game refused is not offered a second time', async () => {
  // Three decisions in a row died to this. The strategist asked to reach the
  // elite node and rephrased its goal every time - "move to the reachable Elite
  // node", "...at row 7, then begin the elite encounter", "...on the centre
  // path" - but the label collapsed all three onto the same element, which had
  // no route from focus. The runtime then saw one identical plan three times
  // and told the STRATEGIST it was repeating itself, which it was not.
  const asked = [];
  const planner = { ask: async ({ context }) => { asked.push(context.goal); return { observation: stateId(reward), summary: 'press the bound button', note: 'Skip is on B.', actions: [{ type: 'activate', target: 'element-1206550283364', scene: reward.ui.scene_id }] }; } };
  const executor = { execute: async () => ({ completed: [], state: reward }) };
  const actuator = new Actuator({ planner, executor, roster: new Roster({ emit: () => {} }) });

  const goals = ['take Glacier from this reward', 'take the Glacier card offered here', 'take Glacier, the block card'];
  const first = await actuator.plan({ goal: goals[0], target_label: 'Glacier' }, reward, {});
  assert.equal(first.resolution, 'label');
  assert.equal(actuator.modelCalls, 0);

  // The game refuses it - no route to that element.
  actuator.noteFailure(reward, first.plan);

  // Every later phrasing of the same goal now reaches the model, which can see
  // the element list and the failure and choose differently.
  for (const goal of goals.slice(1)) {
    const again = await actuator.plan({ goal, target_label: 'Glacier' }, reward, {});
    assert.equal(again.resolution, 'model', `"${goal}" must not resolve to the refused element again`);
  }
  assert.equal(actuator.modelCalls, 2);
  assert.deepEqual(asked, goals.slice(1), 'and the model is told what was actually asked for');

  // The memory is per screen and per control: a different control still resolves.
  assert.equal((await actuator.plan({ goal: 'skip it', target_label: 'Skip' }, reward, {})).resolution, 'label');
});

test('a plan the runtime rejects is recorded and blamed on whoever wrote it', async () => {
  // A validation failure leaves no planner diagnostics behind, so one of these
  // paused a live run with `plan: null` in the incident and nothing to read.
  // It was also reported against the strategist, which had not built it.
  const mixed = { observation: stateId(reward), summary: 'move then press', note: 'n', actions: [
    { type: 'input', buttons: ['right'] },
    { type: 'activate', target: 'element-1206550283364', scene: reward.ui.scene_id },
  ] };
  assert.throws(() => validatePlan(mixed, reward, { role: 'actuator' }), /cannot mix/, 'raw buttons and semantic navigation are separate plans');

  const planner = { ask: async () => mixed };
  const actuator = new Actuator({ planner, executor: { execute: async () => ({ completed: [] }) }, roster: new Roster({ emit: () => {} }) });
  // Its own lane, or every event it emits is filed under the room and every
  // failure is blamed on somebody else. This was undefined for a while.
  assert.equal(actuator.lane, 'actuator');
  const source = { observation: stateId(reward), summary: 'go', note: 'n', actions: [{ type: 'intent', goal: 'reach the elite node' }] };
  const error = await actuator.resolve(source, reward, {}).then(() => null, failure => failure);
  assert.ok(error, 'the bad plan is refused');
  assert.match(error.message, /cannot mix/);
  assert.equal(error.lane, 'actuator', 'blamed on the member that wrote it, not the one that stated the goal');
  assert.deepEqual(error.plan.actions, mixed.actions, 'and carried on the error so the incident can be read');

  // The prompt has to state the rule, because nothing else tells the actuator.
  const prompt = fs.readFileSync(new URL('../client/learning/actuator.txt', import.meta.url), 'utf8');
  assert.match(prompt, /ONE KIND OF ACTION PER PLAN/);
  assert.match(prompt, /no verified focus path/i);
});

// A row the d-pad does not reach is entered with its panel shortcut.
//
// Live, at decision 68 of room ba94db7f: combat focus sat on the ally hitbox
// and the plan wanted the occupied potion holder three rows above. `up` moved
// nothing and `right` only toggled between the two creatures, so the walk
// ping-ponged for twelve presses and the run paused. The holder carries no
// bound button of its own - the shortcut sitting beside it does, and one `x`
// lands on the strip. Bounds and ids are the ones the mod reported there.
{
  const el = (id, label, bounds, extra = {}) => ({ id, label, focus_mode: 'all', selectable: true, enabled: true, visible: true, bounds, neighbors: {}, ...extra });
  const ally = el('element-1680355639913', 'Hitbox', [359, 462, 242, 278], { neighbors: { right: 'element-1683291653444', left: 'element-1683291653444' } });
  const foe = el('element-1683291653444', 'Hitbox', [1185, 574, 212, 166], { neighbors: { right: 'element-1680355639913', left: 'element-1680355639913' } });
  const screen = [
    ally,
    foe,
    // Decoys on the same top row, both further from the holder than `x` is.
    el('element-633843234674', 'Map', [1664, 0, 80, 80], { press: 'back' }),
    el('element-634162001797', '13', [1744, 0, 80, 80], { press: 'lb' }),
    el('element-634514323354', 'PauseButton', [1824, 0, 80, 80], { press: 'start' }),
    el('element-632819824440', 'PotionShortcutButton', [435, 15, 96, 48], { press: 'x' }),
    el('leftmost', null, [443, 9, 60, 60], { neighbors: { right: 'element-681658302785' } }),
    el('element-681658302785', 'PotionHolder', [503, 9, 60, 60], { neighbors: { left: 'leftmost' } }),
  ];
  const pressed = [];
  let focus = ally.id;
  const executor = Object.create(Executor.prototype);
  executor.button = async (button) => {
    pressed.push(button);
    if (button === 'x') focus = 'leftmost';
    else if (button === 'left' || button === 'right') {
      // The creature row is a closed pair; the potion strip walks properly.
      if (focus === ally.id) focus = foe.id;
      else if (focus === foe.id) focus = ally.id;
      else if (button === 'right' && focus === 'leftmost') focus = 'element-681658302785';
      else if (button === 'left' && focus === 'element-681658302785') focus = 'leftmost';
    }
    // up and down move nothing at all from either row.
  };
  const read = () => ({ state_type: 'monster', run: { act: 1, floor: 5, ascension: 1 }, player: { hp: 43, max_hp: 80 },
    ui: { scene_id: 'b1106cc448d9bef4', focused_element: focus, elements: screen } });
  executor.observe = async () => read();
  executor.record = () => {};
  executor.sleep = async () => {};

  const landed = await executor.navigateElement({ type: 'activate', target: 'element-681658302785', scene: 'b1106cc448d9bef4' }, read());
  assert.equal(landed.ui.focused_element, 'element-681658302785', `it reaches the holder: pressed ${pressed.join(',')}`);
  assert.ok(pressed.includes('x'), `via the potion shortcut, not the map: ${pressed.join(',')}`);
  assert.ok(!pressed.includes('back') && !pressed.includes('start'), `and it presses neither the map nor pause: ${pressed.join(',')}`);
  assert.equal(pressed.filter(button => button === 'x').length, 1, 'the shortcut is spent after one press');
}

// A potion holder is identified by the mod, not by a label it never has.
//
// Live, at the act 1 boss on floor 17 of room 70f25b98: the run reached the
// right holder with `x`, and the activation guard refused it for having no
// label - which potion holders never do - and for being `ambiguous`, which is
// what a null label shared with its neighbours reports. It paused twice on the
// same decision. The mod does name them: reference.kind is "potion". Ids and
// bounds are the ones the mod reported there.
{
  const holder = (id, x, extra = {}) => ({ id, label: null, reference: { kind: 'potion', model_id: null }, type: 'NPotionHolder',
    focus_mode: 'all', selectable: true, enabled: true, visible: true, activation: 'a', ambiguous: true, bounds: [x, 9, 60, 60], neighbors: {}, ...extra });
  const screen = [holder('element-715279843665', 565), holder('element-715648942439', 627)];
  const pressed = [];
  let opened = false;
  const executor = Object.create(Executor.prototype);
  executor.button = async (button) => { pressed.push(button); if (button === 'a') opened = true; };
  const read = () => ({ state_type: 'monster', run: { act: 1, floor: 17, ascension: 1 }, player: { hp: 31, max_hp: 80 },
    ui: { scene_id: opened ? 'popup' : '4b98c512c2ee7e68', focused_element: 'element-715648942439', elements: screen } });
  executor.observe = async () => read();
  executor.settled = async () => read();
  executor.record = () => {};
  executor.sleep = async () => {};
  executor.inputs = 0;

  const start = read();
  const result = await executor.execute({ observation: stateId(start), summary: 'open the potion', note: 'n',
    actions: [{ type: 'activate', target: 'element-715648942439', scene: '4b98c512c2ee7e68' }] }, start);
  assert.equal(result.error, undefined, `an unlabelled holder the mod typed is activatable: ${result.error}`);
  assert.deepEqual(pressed, ['a'], `and it takes one press: ${pressed.join(',')}`);
}

// A press that does nothing says why, when the screen already knows.
//
// Live, twice in one boss turn of room 70f25b98: `x` lands on the leftmost
// potion holder whether or not it holds a potion, and that one was empty. The
// run pressed `a`, was told only "no observed change", and pressed it again.
// The holder reports activation null - the screen knew all along.
{
  const empty = { id: 'element-714910744891', label: 'PotionHolder', reference: { kind: 'potion' }, focus_mode: 'all',
    selectable: true, enabled: true, visible: true, activation: null, bounds: [503, 9, 60, 60], neighbors: {} };
  const full = { ...empty, id: 'element-715279843665', label: null, activation: 'a', ambiguous: true, bounds: [565, 9, 60, 60] };
  const executor = Object.create(Executor.prototype);
  executor.button = async () => {};
  const read = () => ({ state_type: 'monster', run: { act: 1, floor: 17, ascension: 1 }, player: { hp: 31, max_hp: 80 },
    ui: { scene_id: 'boss', focused_element: empty.id, elements: [empty, full] } });
  executor.observe = async () => read();
  executor.settled = async () => read();
  executor.record = () => {};
  executor.sleep = async () => {};
  executor.inputs = 0;

  const start = read();
  const result = await executor.execute({ observation: stateId(start), summary: 'open the potion', note: 'n',
    actions: [{ type: 'input', buttons: ['a'] }] }, start);
  assert.match(result.error, /activation null/, `it names the reason: ${result.error}`);
  assert.match(result.error, /PotionHolder/, `and which element: ${result.error}`);
}

// The hand is walked in the order it is drawn, not in hand[] index order.
//
// Live, on floor 19 of room 70f25b98: player.hand read Defend(274), Crimson
// Mantle+(275), Defend(276), Howl(264), Strike(257), while the screen read left
// to right 274, 276, 264, 257, 275 - index 1 was the RIGHTMOST of five.
// Counting desired-focused in index space pressed `right` once for a card four
// places away, and the run refused the selection rather than play the wrong
// card. Every holder carries reference.instance_id, which ties the two
// together. Ids, bounds and instance ids are the ones the mod reported there.
{
  const holder = (id, x, instance, label) => ({ id, label, reference: { kind: 'card', instance_id: instance },
    type: 'NHandCardHolder', focus_mode: 'all', selectable: true, enabled: true, visible: true,
    activation: 'a', ambiguous: false, bounds: [x, 671, 607, 760], neighbors: {} });
  const screen = [
    holder('element-10541946900067', 239, 274, 'Defend'),
    holder('element-10627359712782', 534, 276, 'Defend'),
    holder('element-10709081535686', 705, 264, 'Howl from Beyond'),
    holder('element-10565569230034', 877, 257, 'Strike'),
    holder('element-10726026527618', 1051, 275, 'Crimson Mantle+'),
  ];
  // hand[] order deliberately disagrees with the screen, exactly as it did live.
  const hand = [
    { index: 0, instance_id: 274, name: 'Defend' },
    { index: 1, instance_id: 275, name: 'Crimson Mantle+' },
    { index: 2, instance_id: 276, name: 'Defend' },
    { index: 3, instance_id: 264, name: 'Howl from Beyond' },
    { index: 4, instance_id: 257, name: 'Strike' },
  ];
  const order = [274, 276, 264, 257, 275];
  const pressed = [];
  let at = 0;
  const executor = Object.create(Executor.prototype);
  executor.button = async (button) => {
    pressed.push(button);
    // The row wraps, which is what makes one `left` the short way round.
    if (button === 'right') at = (at + 1) % order.length;
    if (button === 'left') at = (at - 1 + order.length) % order.length;
  };
  executor.observe = async () => ({ state_type: 'monster', run: { act: 2, floor: 19, ascension: 1 },
    player: { hp: 67, max_hp: 80, hand }, ui: { scene_id: 'fight', focused_card: order[at], elements: screen } });
  executor.record = () => {};
  executor.sleep = async () => {};

  const before = { state_type: 'monster', run: { act: 2, floor: 19, ascension: 1 },
    player: { hp: 67, max_hp: 80, hand }, ui: { scene_id: 'fight', focused_card: 274, elements: screen } };
  const landed = await executor.navigateHand(275, before);
  assert.equal(landed.ui.focused_card, 275, `it reaches the card it asked for: pressed ${pressed.join(',')}`);
  assert.deepEqual(pressed, ['left'], `and takes the short way round a wrapping row: ${pressed.join(',')}`);
}

// A shop draws the relic's artwork over the thing you buy.
//
// Live, on floor 22 of room 70f25b98 with 465 gold: the strategist asked for
// "Venerable Tea Set" and the matcher resolved it to NRelic-RELIC_VENERABLE_-
// TEA_SET, the artwork. Both it and the price tag are enabled and take `a`,
// but no element lists the artwork as a neighbour, so no route to it exists
// and none ever will - the run spent its recovery budget walking towards a
// picture, twice, on two different relics. Shop relics are labelled by price
// alone; only shop.items carries the name. Ids and bounds are the mod's.
{
  const entry = { id: 'element-12027787485067', label: '182', reference: { kind: 'entry' }, type: 'NMerchantRelic',
    focus_mode: 'all', selectable: true, enabled: true, visible: true, activation: 'a', ambiguous: false,
    bounds: [1139, 674, 79, 79], neighbors: { left: 'element-12027586157697', up: 'element-12026646634070' } };
  const art = { id: 'element-12039598641145', label: 'NRelic-RELIC_VENERABLE_TEA_SET', reference: { kind: 'model' },
    type: 'NRelic', focus_mode: 'all', selectable: true, enabled: true, visible: true, activation: 'a',
    ambiguous: false, bounds: [1097, 622, 88, 88],
    // It names neighbours of its own; nothing names it.
    neighbors: { left: 'element-12026428525817', right: 'element-12027787485067' } };
  const here = { id: 'element-12026646634070', label: '48 | 1 | Skill | Armaments | Upgrade a card.', reference: { kind: 'entry' },
    focus_mode: 'all', selectable: true, enabled: true, visible: true, activation: 'a', ambiguous: false,
    bounds: [961, 382, 240, 337], neighbors: { down: 'element-12027787485067', left: 'element-12027586157697' } };
  const other = { id: 'element-12027586157697', label: '200', reference: { kind: 'entry' },
    focus_mode: 'all', selectable: true, enabled: true, visible: true, activation: 'a', ambiguous: false,
    bounds: [989, 674, 79, 79], neighbors: { right: 'element-12027787485067' } };
  const shop = { state_type: 'shop', run: { act: 2, floor: 22, ascension: 1 }, player: { gold: 465 },
    ui: { scene_id: 'shop-1', focused_element: here.id, elements: [entry, art, here, other] } };

  assert.equal(matchElement(shop, 'NRelic-RELIC_VENERABLE_TEA_SET'), null, 'the artwork is never offered as a target');
  assert.equal(matchElement(shop, '182')?.id, entry.id, 'the price tag is, because neighbours point at it');
}

// A card that discounts a later card makes the energy sum unknowable.
//
// Live, on floor 24 of room 70f25b98: Unrelenting reads "Deal 15 damage. The
// next Attack you play costs 0", so Unrelenting, Strike, Strike costs 2+0+1=3
// against 3 energy. The budget added the printed costs to 4 and refused the
// turn three times, spending the whole refinement budget on arithmetic the
// model had got right.
{
  const hand = [
    { index: 0, instance_id: 335, name: 'Unrelenting', cost: '2', can_play: true,
      description: 'Deal 15 damage. The next Attack you play costs 0.' },
    { index: 1, instance_id: 331, name: 'Strike', cost: '1', can_play: true, description: 'Deal 7 damage.' },
    { index: 2, instance_id: 332, name: 'Strike', cost: '1', can_play: true, description: 'Deal 7 damage.' },
  ];
  const fight = { state_type: 'monster', run: { act: 2, floor: 24, ascension: 1 },
    player: { hp: 23, max_hp: 80, energy: 3, hand },
    battle: { round: 4, turn: 'player', is_play_phase: true, enemies: [{ entity_id: 'E0', combat_id: 1, name: 'Chomper', hp: 19 }] },
    ui: { scene_id: 'fight', focused_card: 335, elements: [] } };
  const plan = (cards) => ({ observation: stateId(fight), summary: 'spend the turn', note: 'n',
    actions: cards.map(card => ({ type: 'play', card, target: 'E0' })) });

  assert.ok(validatePlan(plan([335, 331, 332]), fight, { role: 'combat' }), 'the discounted batch is allowed through');
  // Three plain Strikes really do cost more than the turn has, and still stop.
  const plain = { ...fight, player: { ...fight.player, hand: hand.map(card => ({ ...card, name: 'Strike', cost: '2', description: 'Deal 7 damage.' })) } };
  const plainPlan = { ...plan([335, 331, 332]), observation: stateId(plain) };
  assert.throws(() => validatePlan(plainPlan, plain, { role: 'combat' }), /spends 6 energy and the turn has 3/);
}

// The runtime throws the potion; the model only says which and at what.
//
// Live, on floor 29 of room 70f25b98: about fifty presses in one combat turn
// cycling x, a, a. `x, a, a` finishes a DRINK potion, whose only target is the
// player, so it gets learned as "how to use a potion" and then repeated on a
// thrown one forever. A thrown potion is only ARMED by that second `a`; the
// aim lands on some creature and has to be steered. The state proved the run
// got as far as ui.targeting true with focused_creature 10 and then pressed
// `x`, which cancels. Cards have had `play` doing all of this for them.
{
  const holder = (id, x, slot) => ({ id, label: slot === 0 ? 'PotionHolder' : null, reference: { kind: 'potion' },
    type: 'NPotionHolder', focus_mode: 'all', selectable: true, enabled: true, visible: true,
    activation: 'a', bounds: [503 + slot * 62, 9, 60, 60], neighbors: {} });
  const holders = [holder('h0', 503, 0), holder('h1', 565, 1)];
  const enemies = [
    { entity_id: 'TOUGH_EGG_0', combat_id: 10, name: 'Tough Egg', hp: 16, max_hp: 16 },
    { entity_id: 'OVICOPTER_0', combat_id: 1, name: 'Ovicopter', hp: 5, max_hp: 129 },
  ];
  const potions = [
    { slot: 0, id: 'POTION_SHAPED_ROCK', name: 'Potion-Shaped Rock', target_type: 'AnyEnemy', can_use_in_combat: true },
    { slot: 1, id: 'POTION_SHAPED_ROCK', name: 'Potion-Shaped Rock', target_type: 'AnyEnemy', can_use_in_combat: true },
  ];
  // The screen walks: hand -> strip -> popup -> targeting -> thrown.
  let where = 'hand', focus = null, aim = null, left = [...potions];
  const pressed = [];
  const executor = Object.create(Executor.prototype);
  executor.button = async (button) => {
    pressed.push(button);
    if (button === 'x') { where = 'strip'; focus = 'h0'; aim = null; return; }   // and it CANCELS a throw
    if (where === 'strip' && ['left', 'right'].includes(button)) {
      const at = holders.findIndex(item => item.id === focus);
      focus = holders[Math.max(0, Math.min(holders.length - 1, at + (button === 'right' ? 1 : -1)))].id;
    } else if (where === 'strip' && button === 'a') where = 'popup';
    else if (where === 'popup' && button === 'a') { where = 'targeting'; aim = 10; }
    else if (where === 'targeting' && ['left', 'right'].includes(button)) {
      const at = enemies.findIndex(enemy => enemy.combat_id === aim);
      aim = enemies[Math.max(0, Math.min(enemies.length - 1, at + (button === 'right' ? 1 : -1)))].combat_id;
    } else if (where === 'targeting' && button === 'a') { left = left.filter(item => item.slot !== 1); where = 'hand'; aim = null; }
  };
  const read = () => ({ state_type: 'monster', run: { act: 2, floor: 29, ascension: 1 },
    player: { hp: 38, max_hp: 80, energy: 0, hand: [], potions: left },
    battle: { round: 8, turn: 'player', is_play_phase: true, enemies },
    ui: { scene_id: 'fight', elements: holders, targeting: where === 'targeting', focused_creature: aim,
      focused_element: where === 'strip' ? focus : null,
      focus_path: where === 'strip' ? `/PotionHolders/PotionHolder` : where === 'popup' ? '/PotionHolders/PotionHolder/PotionPopup/Container/UseButton' : where === 'targeting' ? '/CombatSceneContainer/Creature/Hitbox' : '/CombatUi/Hand/CardHolderContainer' } });
  executor.observe = async () => read();
  executor.settled = async () => read();
  executor.record = () => {};
  executor.sleep = async () => {};

  const after = await executor.usePotion({ type: 'use_potion', slot: 1, target: 1 }, read());
  assert.equal(after.player.potions.length, 1, `the potion is spent: pressed ${pressed.join(',')}`);
  assert.ok(!pressed.slice(pressed.indexOf('a')).includes('x'), `and x is never pressed after the popup opens: ${pressed.join(',')}`);
  // It steered the aim off the Tough Egg the game picked and onto the Ovicopter.
  assert.deepEqual(pressed, ['x', 'right', 'a', 'a', 'right', 'a'], `exact sequence: ${pressed.join(',')}`);
}

// A selection screen is resolved by the runtime, including the card it
// pre-picked for you.
//
// These screens report NO selected list, so `a` that worked and `a` that undid
// the last one look identical - runs have pressed it ten times and then
// hammered a Confirm gone dark. can_confirm is the only readout. An upgrade or
// exhaust prompt usually opens with a card ALREADY chosen and can_confirm
// already true, and an `a` there deselects it; that is not knowable up front,
// so it is caught by watching can_confirm fall and pressing again.
{
  const card = (index, name, x) => ({ id: `sel-${index}`, label: name, reference: { kind: 'card', instance_id: 500 + index },
    focus_mode: 'all', selectable: true, enabled: true, visible: true, activation: 'a',
    bounds: [x, 400, 180, 260], neighbors: {} });
  const elements = [card(0, 'Strike', 400), card(1, 'Strike', 600), card(2, 'Pommel Strike', 800)];
  const cards = [{ index: 0, name: 'Strike' }, { index: 1, name: 'Strike' }, { index: 2, name: 'Pommel Strike' }];

  // The screen opens with index 0 pre-picked, so can_confirm starts true.
  let picked = new Set([0]);
  let open = true;
  const pressed = [];
  const executor = Object.create(Executor.prototype);
  executor.button = async (button) => {
    pressed.push(button);
    if (button === 'a') { const at = 2; picked.has(at) ? picked.delete(at) : picked.add(at); }
    if (button === 'y' && picked.size) open = false;
  };
  const read = () => ({ state_type: 'monster', run: { act: 1, floor: 5, ascension: 1 },
    player: { hp: 50, max_hp: 80, hand: [] },
    battle: { round: 2, turn: 'player', is_play_phase: true, enemies: [] },
    ...(open ? { hand_select: { mode: 'simple_select', prompt: 'Choose a card to Exhaust.', cards, can_confirm: picked.size > 0 } } : {}),
    ui: { scene_id: 'select', focused_element: 'sel-2', elements } });
  executor.observe = async () => read();
  executor.settled = async () => read();
  executor.navigateElement = async () => read();
  executor.record = () => {};
  executor.sleep = async () => {};

  // Ask for index 2. The first `a` toggles it ON (can_confirm stays true), then y.
  const after = await executor.chooseCards({ type: 'choose', cards: [2] }, read());
  assert.equal(after.hand_select, undefined, `the screen closes: pressed ${pressed.join(',')}`);
  assert.equal(pressed.at(-1), 'y', `and it is confirmed with y: ${pressed.join(',')}`);
  assert.ok(pressed.filter(button => button === 'a').length <= 2, `without hammering a: ${pressed.join(',')}`);
}

// A screen that restyles the highlighted item does not spend the route budget.
//
// Live, on floor 21 of room 5976c38f with 417 gold: the walk to a relic's price
// tag was tracking its route exactly - card, card, card, relic row - and every
// single press changed scene_id, because a shop redraws whatever is
// highlighted. Each correct press was counted as the screen changing under the
// route, and the run paused ONE press from the Bag of Preparation it wanted.
// Ids, bounds and the neighbour chain are the ones the mod reported there.
{
  const cell = (id, x, y, label, neighbors) => ({ id, label, reference: { kind: 'entry' },
    focus_mode: 'all', selectable: true, enabled: true, visible: true, activation: 'a',
    bounds: [x, y, 195, 274], neighbors });
  // Long enough that counting each correct press as a re-scene exhausts the
  // budget, which is what happened live across one decision's attempts.
  const ids = Array.from({ length: 16 }, (_, i) => `element-shop-${i}`);
  const chain = ids.map((id, i) => cell(id, 400 + i * 60, 674, `${100 + i}`,
    { ...(ids[i + 1] ? { right: ids[i + 1] } : {}), ...(ids[i - 1] ? { left: ids[i - 1] } : {}) }));
  const wanted = ids.at(-1);
  let at = 0, scene = 0;
  const pressed = [];
  const executor = Object.create(Executor.prototype);
  executor.button = async (button) => {
    pressed.push(button);
    if (button === 'right') at = Math.min(at + 1, chain.length - 1);
    scene++; // every press restyles the highlight and changes scene_id
  };
  const read = () => ({ state_type: 'shop', run: { act: 1, floor: 21, ascension: 1 }, player: { hp: 75, gold: 417 },
    ui: { scene_id: `shop-${scene}`, focused_element: chain[at].id, elements: chain } });
  executor.observe = async () => read();
  executor.settled = async () => read();
  executor.record = () => {};
  executor.sleep = async () => {};

  const start = read();
  const landed = await executor.navigateElement({ type: 'activate', target: wanted, scene: start.ui.scene_id }, start);
  assert.equal(landed.ui.focused_element, wanted, `it reaches the price tag: ${pressed.length} presses`);
  assert.equal(pressed.length, chain.length - 1, `one press per step, none wasted: ${pressed.length}`);
  assert.ok(pressed.every(button => button === 'right'), `all in the same direction: ${[...new Set(pressed)].join(',')}`);
}

// A reloaded player must not read its kickoff as "start over".
//
// Live, at decision 296 of room 5976c38f: a mid-run player reload handed the
// agent its original task - "Start a fresh run... Abandon any pre-existing run
// first" - against Act 2 floor 21 with seven relics. It refused to act and
// asked for an operator, which is the right call and also a pause on every
// single reload. The runtime already knows better: freshRunVerified survives in
// the checkpoint.
{
  const state = { state_type: 'shop', run: { act: 2, floor: 21, ascension: 1 },
    player: { hp: 75, max_hp: 88, gold: 417, relics: [], potions: [] },
    ui: { scene_id: 'shop', focused_element: null, elements: [] } };
  const task = 'Start a fresh Slay the Spire 2 singleplayer run as Ironclad, Ascension 1. Abandon any pre-existing run first; never Continue.';
  const base = { state, task, ladder: {}, objectiveCheck: null, retrieved: [], lastResult: null,
    lastEncounter: null, instructions: [], strategy: null, accepted: [], notes: [], act1: null, counters: {} };

  const mid = strategistContext({ ...base, freshRunVerified: true });
  assert.match(mid.task_startup_note, /already verified/, 'a verified run is told the startup half is done');
  assert.match(mid.task_startup_note, /never be repeated/, 'and never to repeat it');
  const startup = strategistContext({ ...base, freshRunVerified: false });
  assert.equal(startup.task_startup_note, undefined, 'but a run that has not started still gets the plain kickoff');
}

// A slot number is not a position in the potion row.
//
// Live, at the act 2 boss of room 5976c38f: slots 1 and 2 were held, the
// elements list carried exactly TWO potion holders, and `x` put focus on a
// third one the list never mentioned. Indexing the row by slot number fell
// straight through and pressed `a` on the empty holder, which opens nothing.
// Occupied holders do appear in slot order, and that mapping survives whether
// or not the empty one is reported.
{
  const holder = (id, x) => ({ id, label: null, reference: { kind: 'potion' }, type: 'NPotionHolder',
    focus_mode: 'all', selectable: true, enabled: true, visible: true, activation: 'a',
    bounds: [x, 9, 60, 60], neighbors: {} });
  const listed = [holder('element-678151864657', 565), holder('element-678520963431', 627)];
  const potions = [
    { slot: 1, name: 'Flex Potion', target_type: 'AnyPlayer', can_use_in_combat: true },
    { slot: 2, name: 'Blood Potion', target_type: 'AnyPlayer', can_use_in_combat: true },
  ];
  // `x` lands on a holder that is NOT in the elements list, exactly as it did live.
  const GHOST = 'element-677782765883';
  let focus = null, where = 'hand', left = [...potions];
  const pressed = [];
  const executor = Object.create(Executor.prototype);
  executor.button = async (button) => {
    pressed.push(button);
    if (button === 'x') { focus = GHOST; where = 'strip'; return; }
    if (where === 'strip' && button === 'right') focus = focus === GHOST ? listed[0].id : listed[1].id;
    else if (where === 'strip' && button === 'left') focus = focus === listed[1].id ? listed[0].id : GHOST;
    else if (where === 'strip' && button === 'a') where = 'popup';
    else if (where === 'popup' && button === 'a') { left = left.filter(item => item.slot !== 1); where = 'hand'; }
  };
  const read = () => ({ state_type: 'boss', run: { act: 2, floor: 33, ascension: 1 },
    player: { hp: 47, max_hp: 90, energy: 3, hand: [], potions: left },
    battle: { round: 5, turn: 'player', is_play_phase: true, enemies: [{ entity_id: 'KAISER_CRAB_0', combat_id: 1, name: 'Kaiser Crab', hp: 200 }] },
    ui: { scene_id: 'boss', elements: listed, focused_element: where === 'strip' ? focus : null, targeting: false, focused_creature: null,
      focus_path: where === 'strip' ? '/PotionHolders/PotionHolder' : where === 'popup' ? '/PotionHolders/PotionHolder/PotionPopup/Container/UseButton' : '/CombatUi/Hand' } });
  executor.observe = async () => read();
  executor.settled = async () => read();
  executor.record = () => {};
  executor.sleep = async () => {};

  const after = await executor.usePotion({ type: 'use_potion', slot: 1 }, read());
  assert.equal(after.player.potions.length, 1, `the Flex Potion is drunk: pressed ${pressed.join(',')}`);
  // One right off the unlisted holder onto the FIRST occupied one, which is slot 1.
  assert.deepEqual(pressed, ['x', 'right', 'a', 'a'], `by identity, not by counting to slot 1: ${pressed.join(',')}`);
}

// The runtime buys; the model only says which item.
//
// Shops were the worst screen in the run log - one operator pause every six
// observations against one in sixty-four for combat - and always the same three
// traps. The purchasable control is the PRICE TAG, and the relic artwork drawn
// over it is reference.kind "model" that no neighbour names, so no route to it
// exists. Relics and potions are labelled by price ALONE, so only shop.items
// knows what a tag is for. And prices collide: this shop, captured live on
// floor 21 of room 5976c38f, sells two different 51-gold potions. Ids, labels,
// bounds and the item list are all as the mod reported them.
{
  const entry = (id, label, x, y, w = 79) => ({ id, label, reference: { kind: 'entry' },
    focus_mode: 'all', selectable: true, enabled: true, visible: true, activation: 'a',
    bounds: [x, y, w, w], neighbors: {} });
  const art = { id: 'art-vajra', label: 'NRelic-RELIC_VAJRA', reference: { kind: 'model' },
    focus_mode: 'all', selectable: true, enabled: true, visible: true, activation: 'a',
    bounds: [947, 622, 88, 88], neighbors: {} };
  const elements = [
    entry('card-thunderclap', '25 | 1 | Attack | Thunderclap | Deal 4 damage.', 437, 382, 195),
    entry('relic-vajra', '155', 989, 674, 97),
    entry('relic-bag', '149', 1139, 674),
    entry('potion-flex', '51', 989, 818),
    entry('potion-vuln', '52', 1139, 818),
    entry('potion-dex', '51', 1289, 818),
    art,
  ];
  const items = [
    { index: 0, category: 'card', price: 25, card_name: 'Thunderclap', is_stocked: true, can_afford: true },
    { index: 7, category: 'relic', price: 155, relic_name: 'Vajra', is_stocked: true, can_afford: true },
    { index: 8, category: 'relic', price: 149, relic_name: 'Bag of Preparation', is_stocked: true, can_afford: true },
    { index: 10, category: 'potion', price: 51, potion_name: 'Flex Potion', is_stocked: true, can_afford: true },
    { index: 11, category: 'potion', price: 52, potion_name: 'Vulnerable Potion', is_stocked: true, can_afford: true },
    { index: 12, category: 'potion', price: 51, potion_name: 'Dexterity Potion', is_stocked: true, can_afford: true },
  ];

  const bought = [];
  const shop = (gold, sold) => ({ state_type: 'shop', run: { act: 2, floor: 21, ascension: 1 },
    player: { hp: 75, max_hp: 90, gold },
    shop: { items: items.map(i => ({ ...i, is_stocked: !sold.has(i.index) })), can_proceed: false },
    ui: { scene_id: 'shop-1', focused_element: 'card-thunderclap', elements } });

  for (const [index, expected, cost] of [[12, 'potion-dex', 51], [8, 'relic-bag', 149], [0, 'card-thunderclap', 25]]) {
    const sold = new Set();
    let gold = 417;
    const executor = Object.create(Executor.prototype);
    let landed = null;
    executor.navigateElement = async (act) => { landed = act.target; return shop(gold, sold); };
    executor.button = async () => { bought.push(landed); sold.add(index); gold -= cost; };
    executor.observe = async () => shop(gold, sold);
    executor.settled = async () => shop(gold, sold);
    executor.record = () => {};
    executor.sleep = async () => {};
    const after = await executor.buyItem({ type: 'buy', item: index }, shop(417, new Set()));
    assert.equal(landed, expected, `item ${index} routes to ${expected}, not ${landed}`);
    assert.equal(after.player.gold, 417 - cost, `and the gold moves by ${cost}`);
  }
  // The artwork is never the thing bought, for any item.
  assert.ok(!bought.includes('art-vajra'), `never the relic artwork: ${bought.join(',')}`);
}

// Leaving is not one button, and a shop is the exception that cost the most.
//
// Live, on floor 27 of room 5976c38f: five `b` presses over five minutes never
// left a shop, while a single `back` did - the room's own BackButton reports
// enabled true and press "b" the whole time and does nothing. A resolved rest
// site is left by its Proceed control instead, and an overlay by `b`.
{
  const make = (state_type, extra, elements) => ({ state_type, run: { act: 2, floor: 27, ascension: 1 },
    player: { hp: 44, max_hp: 90, gold: 5 }, ...extra,
    ui: { scene_id: 'screen', focused_element: null, elements } });
  const backButton = { id: 'back', label: 'BackButton', enabled: true, activation: 'a', press: 'b',
    focus_mode: 'all', selectable: true, visible: true, bounds: [-40, 726, 200, 110], neighbors: {} };
  const proceed = { id: 'proceed', label: 'Proceed', enabled: true, activation: 'a', press: 'y',
    focus_mode: 'all', selectable: true, visible: true, bounds: [1983, 764, 269, 108], neighbors: {} };

  for (const [label, before, expected] of [
    // A shop: BackButton is enabled and bound to b, and b is still not the answer.
    ['shop', make('shop', { shop: { items: [], can_proceed: false } }, [backButton]), 'back'],
    ['resolved rest site', make('rest_site', { rest_site: { options: [], can_proceed: true } }, [proceed]), 'y'],
    ['an overlay', make('card_select', { card_select: { cards: [], can_confirm: false } }, []), 'b'],
  ]) {
    const pressed = [];
    let moved = false;
    const executor = Object.create(Executor.prototype);
    executor.button = async (b) => { pressed.push(b); moved = true; };
    executor.settled = async () => (moved ? { ...before, state_type: 'map' } : before);
    executor.observe = async () => (moved ? { ...before, state_type: 'map' } : before);
    executor.record = () => {};
    executor.sleep = async () => {};
    const after = await executor.leaveScreen(before);
    assert.equal(pressed[0], expected, `${label} leaves with ${expected}, not ${pressed[0]}`);
    assert.equal(after.state_type, 'map', `${label} actually left`);
  }
}

// The whole fight is handed over every turn, from the fields the mod actually
// uses.
//
// Two things were silently missing. The mod publishes buffs and debuffs as
// `status`, and the encounter scratchpad read `powers || buffs` - neither of
// which the sensor has ever set - so player_powers and every enemy's powers
// came out [] on every turn of every fight while the state carried Thorns 3,
// Strength 1 and Surrounded 1. An empty list reads as "no powers", which is a
// lie rather than a gap. And `ui` was stripped wholesale for combat, taking
// with it the only published record of where the enemies are and what order
// the hand is drawn in - a human reads both off the screen; this agent cannot.
{
  const state = {
    state_type: 'boss', run: { act: 2, floor: 33, ascension: 1 },
    player: {
      hp: 61, max_hp: 90, block: 0, energy: 3, max_energy: 3, gold: 250, max_potion_slots: 3,
      status: [{ id: 'THORNS_POWER', name: 'Thorns', amount: 3, type: 'Buff' },
               { id: 'SURROUNDED_POWER', name: 'Surrounded', amount: 1, type: 'Debuff' }],
      relics: [{ id: 'INK_BOTTLE', name: 'Ink Bottle', description: 'Every 10 cards, draw 1.', counter: 7 }],
      potions: [{ slot: 1, name: 'Fire Potion', target_type: 'AnyEnemy', can_use_in_combat: true }],
      hand: [{ instance_id: 274, index: 0, name: 'Defend', cost: '1', can_play: true },
             { instance_id: 275, index: 1, name: 'Crimson Mantle', cost: '1', can_play: true }],
      draw_pile: [{ instance_id: 300, id: 'STRIKE', name: 'Strike', type: 'Attack' }],
      discard_pile: [], exhaust_pile: [],
      draw_pile_count: 1, discard_pile_count: 0, exhaust_pile_count: 0,
    },
    battle: { round: 5, turn: 'player', is_play_phase: true, enemies: [
      { entity_id: 'CRUSHER_0', combat_id: 1, name: 'Crusher', hp: 209, max_hp: 209, block: 4,
        intents: [{ type: 'Attack', label: '18' }],
        status: [{ id: 'BACK_ATTACK_LEFT_POWER', name: 'Back Attack', amount: 1, type: 'Buff' }] }] },
    ui: { scene_id: 'boss', focused_card: 274, in_card_play: false, targeting: false,
      targets: [{ combat_id: 2, hittable: true, x: 1632, y: 704 }, { combat_id: 1, hittable: true, x: 342, y: 722 }],
      elements: [
        // Drawn right-to-left of hand[] order, which is the trap.
        { id: 'h1', label: 'Crimson Mantle', reference: { kind: 'card', instance_id: 275 }, bounds: [400, 700, 200, 300] },
        { id: 'h0', label: 'Defend', reference: { kind: 'card', instance_id: 274 }, bounds: [700, 700, 200, 300] },
      ] } };

  const view = combatState(state);
  // Buffs and debuffs survive, on both sides.
  assert.deepEqual(view.player.status.map(p => p.name), ['Thorns', 'Surrounded']);
  assert.deepEqual(view.battle.enemies[0].status.map(p => p.name), ['Back Attack']);
  // Enemy order is screen order, not the order battle.enemies happens to list.
  assert.deepEqual(view.layout.enemy_positions.map(t => t.combat_id), [1, 2], 'leftmost enemy first');
  // Hand order is screen order, which disagrees with hand[].index here.
  assert.deepEqual(view.layout.hand_left_to_right.map(c => c.instance_id), [275, 274],
    'the hand is reported as drawn, not as indexed');
  assert.notDeepEqual(view.layout.hand_left_to_right.map(c => c.instance_id),
    state.player.hand.map(c => c.instance_id), 'and those two genuinely differ');

  const pad = new EncounterScratchpad().observe(state);
  assert.deepEqual(pad.player_powers.map(p => `${p.name} ${p.amount}`), ['Thorns 3', 'Surrounded 1']);
  assert.deepEqual(pad.enemies[0].powers.map(p => p.name), ['Back Attack']);
  assert.equal(pad.enemies[0].max_hp, 209);
  assert.equal(pad.enemies[0].block, 4);
  assert.equal(pad.relics[0].counter, 7, 'a relic counter advances with no log line, so its value is the record');
  assert.equal(pad.potions[0].slot, 1);
  assert.deepEqual(Object.keys(pad.piles).sort(), ['discard_pile', 'draw_pile', 'exhaust_pile', 'hand']);
  assert.equal(pad.resources.energy, 3);
}

// Captured from a live Act 2 merchant: 7 cards, 3 relics, 3 potions and card
// removal. The shop labels almost nothing usefully - a relic holder reads
// "NRelicContainerHolder-RELIC_VAJRA" and a potion holder reads "PotionHolder"
// - so the only thing identifying a non-card is its price tag, and two of the
// three potions cost the same 51. `buy` shipped without ever running against a
// live shop; this is the screen it has to survive.
test('every item on a real shelf resolves to its own control', async () => {
  const shelf = JSON.parse(fs.readFileSync(new URL('./fixtures/shop-purchase.json', import.meta.url), 'utf8'));
  const picked = {};
  for (const item of shelf.shop.items) {
    const ex = new Executor({ call: async () => ({}) });
    ex.navigateElement = async (action) => { picked[item.index] = action.target; return shelf; };
    ex.button = async () => {};
    ex.settled = async () => ({ ...shelf, player: { gold: 0 } });
    await ex.buyItem({ type: 'buy', item: item.index }, shelf);
  }
  const ids = shelf.shop.items.map(item => picked[item.index]);
  assert.equal(ids.filter(Boolean).length, 14, 'every item on the shelf resolves');
  assert.equal(new Set(ids).size, 14, 'and no two items resolve to the same control');

  const labelOf = (index) => shelf.ui.elements.find(el => el.id === picked[index])?.label ?? '';
  assert.match(labelOf(0), /\| Thunderclap \|/, 'a card is found by name, not by the price it shares');
  assert.equal(labelOf(7).trim(), '155', 'a relic is found by its price tag');
  assert.equal(labelOf(13).trim(), '75', 'and so is card removal');

  // The two 51g potions must not collapse onto one tag, and the rank among
  // same-priced items of a category has to follow screen order.
  const xOf = (index) => shelf.ui.elements.find(el => el.id === picked[index]).bounds[0];
  assert.notEqual(picked[10], picked[12], 'the two 51g potions are different controls');
  assert.ok(xOf(10) < xOf(11) && xOf(11) < xOf(12), 'and they resolve left to right in shelf order');

  // What the shelf refuses is refused before a press, with the reason.
  const sold = { ...shelf, shop: { ...shelf.shop, items: shelf.shop.items.map(item => item.index === 4 ? { ...item, is_stocked: false } : item) } };
  assert.throws(() => validatePlan({ observation: stateId(sold), summary: 's', note: 'n', actions: [{ type: 'buy', item: 4 }] }, sold, { role: 'strategist' }), /already been bought/);
  const broke = { ...shelf, player: { gold: 10 }, shop: { ...shelf.shop, items: shelf.shop.items.map(item => ({ ...item, can_afford: item.price <= 10 })) } };
  assert.throws(() => validatePlan({ observation: stateId(broke), summary: 's', note: 'n', actions: [{ type: 'buy', item: 1 }] }, broke, { role: 'strategist' }), /costs 154 and you have 10/);
});

// Captured from a live Act 1 rest site. The element list gives Smith before
// Rest while `rest_site.options` gives Rest before Smith, so anything that
// resolved an option by its position in either list would take the wrong one
// half the time. The name is the only thing both agree on.
test('a rest option is taken by name, not by the order either list happens to use', async () => {
  const site = JSON.parse(fs.readFileSync(new URL('./fixtures/rest-site.json', import.meta.url), 'utf8'));
  assert.deepEqual(site.ui.elements.filter(el => el.reference?.kind === 'option').map(el => el.label), ['Smith', 'Rest'], 'the fixture still disagrees with the state, which is the point of it');

  for (const option of site.rest_site.options) {
    const ex = new Executor({ call: async () => ({}) });
    let picked = null;
    ex.navigateElement = async (action) => { picked = action.target; return site; };
    ex.button = async () => {};
    ex.settled = async () => ({ ...site, state_type: 'map', rest_site: null, ui: { ...site.ui, focused_element: 'elsewhere' } });
    await ex.restOption({ type: 'rest', option: option.index }, site);
    assert.equal(site.ui.elements.find(el => el.id === picked)?.label.trim(), option.name, `${option.name} reaches its own control`);
  }

  // A site that offers nothing is already resolved, and is left rather than rested at.
  const spent = { ...site, rest_site: { options: [], can_proceed: true } };
  assert.throws(() => validatePlan({ observation: stateId(spent), summary: 's', note: 'n', actions: [{ type: 'rest', option: 0 }] }, spent, { role: 'strategist' }), /already resolved and is left with leave/);
  const closed = { ...site, rest_site: { ...site.rest_site, options: site.rest_site.options.map(o => o.index === 1 ? { ...o, is_enabled: false } : o) } };
  assert.throws(() => validatePlan({ observation: stateId(closed), summary: 's', note: 'n', actions: [{ type: 'rest', option: 1 }] }, closed, { role: 'strategist' }), /Smith is not available/);
});

// The validator no longer forces a potion to the end of the plan, because doing
// so made the model delete the potion instead of moving it. What keeps a plan
// from acting on stale state is the executor stopping the batch after the
// potion - so that stop is now load-bearing and has to be asserted.
test('a potion is drunk where the turn asked for it, and stops the batch there', async () => {
  const hand = [
    { instance_id: 41, name: 'Strike', type: 'Attack', cost: '1', description: 'Deal 6 damage.', can_play: true, target_type: 'AnyEnemy' },
    { instance_id: 42, name: 'Defend', type: 'Skill', cost: '1', description: 'Gain 5 Block.', can_play: true, target_type: 'Self' },
  ];
  let drunk = false;
  const read = () => ({ state_type: 'monster', run: { act: 1, floor: 7, ascension: 1 },
    player: { hp: 57, max_hp: 80, energy: 3, max_energy: 3, block: 0, hand,
      potions: drunk ? [] : [{ slot: 0, name: 'Strength Potion', target_type: 'AnyPlayer', can_use_in_combat: true }] },
    battle: { round: 2, turn: 'player', is_play_phase: true, enemies: [{ entity_id: 'BYGONE_EFFIGY_0', combat_id: 1, name: 'Bygone Effigy', hp: 70, max_hp: 90 }] },
    ui: { scene_id: 'combat', elements: [], focused_element: null } });

  const executor = Object.create(Executor.prototype);
  executor.inputs = 0;
  executor.observe = async () => read();
  executor.settled = async () => read();
  executor.record = () => {};
  executor.sleep = async () => {};
  const played = [];
  executor.play = async (action) => { played.push(action.card); return { state: read(), barrier: null, card: 'Strike' }; };
  executor.usePotion = async () => { drunk = true; return read(); };

  // Exactly the shape the elite turn wanted: drink, then act on the result.
  const plan = { observation: stateId(read()), summary: 'Drink Strength Potion, then Strike twice.', note: 'n',
    actions: [{ type: 'use_potion', slot: 0 }, { type: 'play', card: 41, target: 'BYGONE_EFFIGY_0' }, { type: 'play', card: 42 }] };
  assert.doesNotThrow(() => validatePlan(plan, read(), { role: 'combat' }), 'the ordering itself is legal');

  const result = await executor.execute(plan, read());
  assert.equal(drunk, true, 'the potion is actually drunk');
  assert.equal(result.completed.length, 1, 'and the batch stops there');
  assert.equal(result.completed[0].action.type, 'use_potion');
  assert.ok(result.completed[0].barrier, 'with a barrier telling the model to replan');
  assert.deepEqual(played, [], 'nothing after it is played against state the potion has changed');
});

// An elite was declared won while the enemy was alive, because a potion opened
// a card-choice screen. That screen carries no hand, so isCombat went false,
// encounterKind returned null, and the fight closed on the "not at 0 HP, so
// won" fallback: Bygone Effigy at 33 HP, the player at 46/80, the report
// reading "won, 11 HP" and the potion spent for nothing. A fight ends when the
// game leaves it, not when something is drawn on top of it.
test('an overlay over a fight is still the fight', () => {
  const fight = { floor: 7, kind: 'elite' };
  const at = (state_type, extra = {}) => ({ state_type, run: { act: 1, floor: 7 }, player: { hp: 46, max_hp: 80 }, ...extra });

  // Exactly the screen that closed the elite: a card choice with no hand, so
  // isCombat is false, and on the same floor.
  const colorless = at('card_select', { card_select: { cards: [{ index: 0, name: 'Bandage Up' }] }, player: { hp: 46, max_hp: 80 } });
  assert.equal(encounterKind(colorless), null, 'it does not look like combat, which is what misled the old check');
  assert.equal(encounterOver(colorless, fight), false, 'and it is still the fight');

  assert.equal(encounterOver(at('hand_select'), fight), false, 'so is a hand-select an exhaust card opened');
  assert.equal(encounterOver(at('elite'), fight), false);

  // What actually ends it.
  assert.equal(encounterOver(at('rewards'), fight), true, 'the reward screen is after the fight');
  assert.equal(encounterOver(at('game_over'), fight), true);
  assert.equal(encounterOver({ ...at('elite'), run: { act: 1, floor: 8 } }, fight), true, 'and so is being on another floor');
  assert.equal(encounterOver(at('elite'), null), false, 'with no fight open there is nothing to close');
});

// Stomp costs 1 less for each Attack played this turn, and the hand reports
// only what it costs right now - so the agent could see the current cost but
// not what three Strikes would make it. The game keeps the tally; the mod does
// not publish it; the runtime counts it from the piles.
test('the turn tallies its own attacks, and says so only when it can', () => {
  const pad = new EncounterScratchpad();
  const attack = (id, name) => ({ instance_id: id, name, type: 'Attack', cost: '1', description: 'Deal 6 damage.' });
  const at = (round, discard, exhaust = []) => ({
    state_type: 'elite', run: { act: 1, floor: 7 },
    player: { hp: 46, max_hp: 80, energy: 4, hand: [attack(90, 'Stomp')], discard_pile: discard, exhaust_pile: exhaust, potions: [], relics: [] },
    battle: { round, turn: 'player', enemies: [{ combat_id: 1, name: 'Bygone Effigy', hp: 33, intents: [] }] },
  });

  assert.equal(pad.observe(at(4, [])).attacks_played_this_turn, 0, 'a turn opens having played nothing');
  assert.equal(pad.observe(at(4, [attack(91, 'Strike'), attack(92, 'Strike')])).attacks_played_this_turn, 2);
  const three = pad.observe(at(4, [attack(91, 'Strike'), attack(92, 'Strike'), attack(93, 'Strike')]));
  assert.equal(three.attacks_played_this_turn, 3, 'which is what makes Stomp free');
  assert.equal(three.cards_played_this_turn, 3);

  // A skill played this turn counts as a card but not as an Attack.
  assert.equal(pad.observe(at(4, [attack(91, 'Strike'), { instance_id: 94, name: 'Defend', type: 'Skill' }])).attacks_played_this_turn, 1);

  // The next round starts over.
  assert.equal(pad.observe(at(5, [attack(91, 'Strike')])).attacks_played_this_turn, 0);

  // A reshuffle empties the discard back into the draw pile, so the delta stops
  // meaning anything. Report that, rather than a smaller number.
  pad.observe(at(6, [attack(95, 'Strike'), attack(96, 'Strike')]));
  const reshuffled = pad.observe(at(6, []));
  assert.equal(reshuffled.attacks_played_this_turn, null, 'unknowable is not zero');
  assert.equal(reshuffled.cards_played_this_turn, null);
  assert.match(reshuffled.authority, /null means a reshuffle/);
});
// The stall guard is the one thing in the runtime that stops a healthy run, so
// its boundary is pinned here against the measured corpus. Sixteen inputs of
// history, and a run that collapsed to fewer than three distinct situations.
test('the stall guard fires on a collapsed run and never on one that is moving', () => {
  const input = (id) => id;

  // A reward list and the card screen behind it, cycled forever: two situations
  // reached over and over, which is exactly the live room's 363-input loop.
  const loop = [];
  for (let i = 0; i < 40; i++) loop.push(i % 2 ? 'card_reward' : 'rewards');
  assert.equal(stallReason(loop, 16, 3), 2, 'two situations across the window is a stall, and it says which');
  assert.equal(stallReason(loop, 16, 2), null, 'and raising the floor to two would let the loop run on');

  // Under the window there is no verdict yet: the guard must not fire early on
  // a short run, and a fresh run is always short.
  assert.equal(stallReason(loop.slice(0, 15), 16, 3), null, 'fifteen inputs is not yet a window');
  assert.equal(stallReason([], 16, 3), null, 'an empty history is not a stall');

  // A fight genuinely moves - hand, enemy health, round - so a window that
  // merely repeats a screen type is not enough to stop it.
  const fight = [];
  for (let i = 0; i < 16; i++) fight.push(`turn-${i % 3}-hp-${100 - i}`);
  assert.equal(stallReason(fight, 16, 3), null, 'a fight that keeps changing is never a stall');

  // Three distinct situations is the floor: at the boundary the run is still
  // reaching somewhere new, so it is left alone.
  const three = ['a', 'b', 'c', ...Array(13).fill('a')];
  assert.equal(stallReason(three, 16, 3), null, 'three situations clears the guard');
  const two = ['a', 'b', ...Array(14).fill('a')];
  assert.equal(stallReason(two, 16, 3), 2, 'dropping to two does not');
});

// What the guard counts is the situation, not the screen. The live stall
// alternated a reward list and the card screen behind it, which are two
// situations - and that is why the floor is three and not two. A two-screen
// loop only trips the guard because a THIRD situation never arrives, so the
// key has to keep counting them apart rather than merging them.
test('a situation is the moment, not just the screen name', () => {
  const base = {
    state_type: 'rewards', run: { act: 2, floor: 19 },
    player: { hp: 76, max_hp: 86, gold: 436, relics: [], potions: [] },
    deck: [{ id: 'STRIKE', is_upgraded: false }],
    rewards: { items: [{ index: 0, type: 'card', description: 'Add a card to your deck.' }] },
  };
  const cardScreen = { ...base, state_type: 'card_reward', rewards: undefined, card_reward: { cards: [{ id: 'ANGER', is_upgraded: false }] } };

  // A list offering a card and the screen behind that card are different
  // situations. If the key merged them, the two-screen loop would look like one
  // repeated situation and the guard's floor of three would stop real runs.
  assert.notEqual(situationId(base), situationId(cardScreen), 'a different offer is a different situation');
  assert.notEqual(situationId(base), situationId({ ...base, rewards: { items: [] } }), 'an emptied list is a different situation');

  // Those two, cycled, are the two distinct values the guard counts.
  const loop = [situationId(base), situationId(cardScreen)];
  assert.equal(stallReason([...loop, ...loop, ...loop, ...loop, ...loop, ...loop, ...loop, ...loop], 16, 3), 2,
    'the real loop presents as two situations, which is below the floor of three');

  // Taking the card changes the deck and clears the offer, which is progress.
  const taken = { ...base, deck: [...base.deck, { id: 'ANGER', is_upgraded: false }], rewards: { items: [] } };
  assert.notEqual(situationId(base), situationId(taken), 'a taken card is a new situation');

  // So does anything that moves the run forward.
  assert.notEqual(situationId(base), situationId({ ...base, run: { act: 2, floor: 20 } }), 'a floor is progress');
  assert.notEqual(situationId(base), situationId({ ...base, player: { ...base.player, gold: 455 } }), 'gold is progress');

  // Focus and element ids churn on their own and must not read as movement.
  const jittered = { ...base, ui: { focused_element: 'element-99', elements: [{ id: 'element-99', bounds: [1, 2, 3, 4] }] } };
  assert.equal(situationId(base), situationId(jittered), 'focus and geometry are not the situation');
});

test('rejected ordinary chat is not recorded as delivered speech', async () => {
  const agent = new PiAgent({ name: 'test', image: 'test', env: {} });
  agent.send = async () => ({ success: false, command: 'prompt', error: 'player is paused; use explicit resume' });
  await assert.rejects(agent.prompt('continue'), /player is paused/);
  assert.equal(agent.transcript.some((item) => item.kind === 'user' && item.text === 'continue'), false);
  assert.match(agent.transcript.at(-1).text, /rejected\/not delivered/);
});

test('PiAgent tracks requiresResume from state and attention events', () => {
  const agent = new PiAgent({ name: 'test', image: 'test', env: {} });
  agent._onMessage({ type: 'response', command: 'get_state', success: true, data: { requiresResume: true } });
  assert.equal(agent.requiresResume, true);
  agent._onMessage({ type: 'steambench_attention', attention: { id: 'incident-1', error: 'review', decision: 4 } });
  assert.equal(agent.requiresResume, true);
  agent._onMessage({ type: 'steambench_attention', attention: null });
  assert.equal(agent.requiresResume, true, 'clearing the incident does not clear a checkpoint resume requirement');
  agent._onMessage({ type: 'response', command: 'resume', success: true });
  assert.equal(agent.requiresResume, false, 'an accepted explicit resume clears the requirement');
});
