
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
import { LANE, ROLES, Roster, encounterLane, encounterTitle } from '../client/learning/agents.mjs';
import { Actuator, commandElement, matchElement, normalizeLabel, resolveIntent } from '../client/learning/actuator.mjs';
import { actuatorContext, actuatorElements, briefing, combatState, encounterKind, splitNotes, strategistState } from '../client/learning/context.mjs';
import { ROLE_ACTIONS, planIdentity, ready, settleAnimation, stateId, unbuiltMenu, validatePlan } from '../client/learning/state.mjs';
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
