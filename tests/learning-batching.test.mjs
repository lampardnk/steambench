import assert from 'node:assert/strict';
import test from 'node:test';
import { Executor } from '../client/learning/executor.mjs';
import { navigationPath } from '../client/learning/navigation.mjs';
import { compactState, stateId, validatePlan, needsScreenshot, plannerResult, mapId, stateDiff } from '../client/learning/state.mjs';
import { actuatorContext, actuatorElements, combatState, encounterKind, strategistState } from '../client/learning/context.mjs';
import { matchElement, normalizeLabel, resolveIntent } from '../client/learning/actuator.mjs';
import { Roster, encounterLane } from '../client/learning/agents.mjs';

const planFor = (state, actions) => ({ observation: stateId(state), summary: 'fixture batch', note: 'Test verified local execution.', actions });
const initialCombat = () => ({
  state_type: 'combat', run: { floor: 2, act: 1 },
  player: { energy: 8, hand: Array.from({ length: 8 }, (_, i) => ({ instance_id: i + 1, index: i, name: `Card ${i + 1}`, description: 'Deal 1 damage.', can_play: true, target_type: 'AnyEnemy' })) },
  battle: { is_play_phase: true, turn: 'player', round: 1, enemies: [{ entity_id: 'FOE_0', combat_id: 50, hp: 100 }] },
  ui: { hand_mode: 'Play', in_card_play: false, selected_card: null, focused_card: 1, focused_creature: null, targeting: false },
});

function fixture(initial, { onInput, onObserve, afterPlay, failAt, ignoreDirections = false } = {}) {
  let state = structuredClone(initial);
  let sensors = 0;
  const inputs = [];
  const records = [];
  const executor = new Executor({ record: event => records.push(event), call: async request => {
    if (request.op === 'sts2-get') { sensors++; if (onObserve) state = onObserve(state, sensors); return { body: JSON.stringify(state) }; }
    inputs.push(request);
    if (inputs.length === failAt) throw new Error('transport acknowledgement lost');
    const button = request.direction || request.button;
    if (onInput) { state = onInput(state, button, inputs.length); return {}; }
    if (['left', 'right', 'down'].includes(button) && !ignoreDirections) {
      const index = state.player.hand.findIndex(card => card.instance_id === state.ui.focused_card);
      state.ui.focused_card = state.player.hand[Math.max(0, Math.min(state.player.hand.length - 1, index + (button === 'left' ? -1 : 1)))]?.instance_id;
    } else if (button === 'a') {
      if (!state.ui.in_card_play) {
        state.ui.in_card_play = true;
        state.ui.selected_card = state.ui.focused_card;
        state.ui.focused_creature = 50;
        state.ui.targeting = true;
      } else {
        const played = state.ui.selected_card;
        state.player.hand = state.player.hand.filter(card => card.instance_id !== played).map((card, index) => ({ ...card, index }));
        state.player.energy--;
        state.battle.enemies[0].hp--;
        state.ui.in_card_play = false;
        state.ui.targeting = false;
        state.ui.selected_card = null;
        state.ui.focused_card = state.player.hand[0]?.instance_id;
        afterPlay?.(state, played);
      }
    } else if (button === 'y') { state.battle.round++; state.player.energy = 3; }
    return {};
  } });
  executor.sleep = async () => { executor.signal?.throwIfAborted(); };
  return { executor, inputs, records, sensors: () => sensors, run: actions => executor.execute(planFor(initial, actions), initial) };
}
const play = card => ({ type: 'play', card, target: 'FOE_0' });

test('no-input stale replans are distinguishable from actual execution failures', () => {
  const stale = plannerResult({ code: 'stale_observation', error: 'state changed while planning', completed: [] });
  assert.equal(stale.error, undefined);
  assert.equal(stale.no_input_sent, true);
  assert.ok(stale.replan);
  const failed = plannerResult({ error: 'transport failed', completed: [] });
  assert.equal(failed.error, 'transport failed');
  assert.equal(failed.no_input_sent, undefined);
});

test('one plan executes deterministic cards and end turn, checking navigation segments once', async () => {
  const fixtureRun = fixture(initialCombat());
  const result = await fixtureRun.run([play(6), play(3), play(2), { type: 'end_turn' }]);
  assert.equal(result.error, undefined);
  assert.equal(result.completed.length, 4);
  assert.equal(result.state.battle.round, 2);
  assert.equal(fixtureRun.records.filter(event => event.type === 'action' && event.action.type === 'play').length, 3);
  assert.equal(fixtureRun.inputs.length, 15); // 8 directional + 6 select/confirm + end turn
  assert.equal(fixtureRun.sensors(), 11); // fresh guard + 3*(navigation, select, play) + turn
  assert.ok(fixtureRun.sensors() < fixtureRun.inputs.length);
});

test('a Power settles before the next card is navigated to', async () => {
  // Inflame killed a real batch: a Power goes to the power area rather than to a
  // pile, so the wait for a played card's destination had nothing to count and
  // skipped it. Its buff was still landing when the next card's hand navigation
  // started, progressId moved underneath it, and a correct three-card turn died
  // as "gameplay changed during hand navigation".
  const initial = initialCombat();
  initial.player.discard_pile_count = 0;
  initial.player.exhaust_pile_count = 0;
  initial.player.hand = initial.player.hand.map(card => ({ ...card, type: card.instance_id === 6 ? 'Power' : 'Attack' }));
  let settling = 0;
  const fixtureRun = fixture(initial, {
    afterPlay: (state, played) => {
      if (played === 6) settling = 2;
      else state.player.discard_pile_count++;
    },
    // The buff and the energy it spent arrive a couple of reads after the card
    // leaves the hand, which is exactly the window the old code navigated in.
    onObserve: (state) => {
      if (settling > 0) { settling--; state.player.buffs = [{ name: 'Strength', amount: settling }]; }
      return state;
    },
  });
  const result = await fixtureRun.run([play(6), play(3), { type: 'end_turn' }]);
  assert.equal(result.error, undefined);
  assert.equal(result.completed.length, 3, 'the Power does not end the batch it starts');
  assert.equal(fixtureRun.records.filter(event => event.type === 'action' && event.action.type === 'play').length, 2);
});

test('eight semantic actions are supported and a ninth is rejected before input', async () => {
  const state = initialCombat();
  const actions = state.player.hand.map(card => play(card.instance_id));
  const f = fixture(state);
  assert.equal((await f.run(actions)).completed.length, 8);
  assert.throws(() => validatePlan(planFor(state, [...actions, { type: 'end_turn' }]), state), /1–8/);
});

test('delayed discard publication settles before navigating to the next deterministic card', async () => {
  const state = initialCombat();
  state.player.discard_pile_count = 0;
  state.player.exhaust_pile_count = 0;
  for (const card of state.player.hand) card.type = 'Attack';
  let delay = 0;
  const f = fixture(state, {
    afterPlay: () => { delay = 2; },
    onObserve: s => { if (delay && --delay === 0) s.player.discard_pile_count++; return s; },
  });
  const result = await f.run([play(1), play(5)]);
  assert.equal(result.error, undefined);
  assert.equal(result.completed.length, 2);
  assert.equal(result.state.player.discard_pile_count, 2);
});

test('missing card destination publication stops before the next card or navigation', async () => {
  const state = initialCombat();
  state.player.discard_pile_count = 0;
  state.player.exhaust_pile_count = 0;
  state.player.hand[0].type = 'Attack';
  const f = fixture(state);
  const result = await f.run([play(1), play(5)]);
  assert.match(result.error, /destination did not settle/);
  assert.equal(f.inputs.length, 2);
});

for (const description of ['Draw 2 cards.', 'Deal random damage.', 'Generate a card.', 'Choose a card.', 'Put a card from your Discard Pile into your Hand.']) {
  test(`uncertainty barrier: ${description}`, async () => {
    const state = initialCombat();
    state.player.hand[0].description = description;
    const f = fixture(state);
    const result = await f.run([play(1), play(2), { type: 'end_turn' }]);
    assert.equal(result.error, undefined);
    assert.equal(result.completed.length, 1);
    assert.match(result.completed[0].barrier, /fresh planning/);
    assert.equal(f.inputs.length, 2);
  });
}

for (const [name, mutate] of [
  ['unexpected generated hand', s => s.player.hand.push({ instance_id: 99, index: 7 })],
  ['target death retained in roster', s => { s.battle.enemies[0].hp = 0; }],
  ['target identity renumbering', s => { s.battle.enemies[0].entity_id = 'OTHER_0'; }],
  ['selection prompt', s => { s.state_type = 'card_select'; s.ui.hand_mode = 'Select'; }],
  ['combat completion', s => { s.state_type = 'rewards'; delete s.battle; }],
]) {
  test(`${name} stops the remaining actions for fresh planning`, async () => {
    const f = fixture(initialCombat(), { afterPlay: mutate });
    const result = await f.run([play(1), play(2), { type: 'end_turn' }]);
    assert.equal(result.error, undefined);
    assert.equal(result.completed.length, 1);
    assert.ok(result.completed[0].barrier);
    assert.equal(f.inputs.length, 2);
  });
}

test('ignored navigation is detected at segment boundary; no selection or next card follows', async () => {
  const f = fixture(initialCombat(), { ignoreDirections: true });
  const result = await f.run([play(6), play(2)]);
  assert.match(result.error, /did not reach intended card/);
  assert.equal(f.inputs.length, 5);
  assert.ok(f.inputs.every(input => input.direction === 'right'));
  assert.equal(result.completed.length, 0);
});

test('real gameplay changes during hand navigation still stop before selection', async () => {
  const state = initialCombat();
  state.player.hp = 80;
  const f = fixture(state, { onInput: s => ({ ...s, player: { ...s.player, hp: 70 }, ui: { ...s.ui, focused_card: 2 } }) });
  const result = await f.run([play(2), play(3)]);
  assert.match(result.error, /gameplay changed during hand navigation/);
  assert.equal(f.inputs.length, 1);
  assert.equal(result.completed.length, 0);
});

test('transport failure mid-segment sends no remaining navigation, confirmation or next action', async () => {
  const f = fixture(initialCombat(), { failAt: 2 });
  const result = await f.run([play(6), play(2)]);
  assert.match(result.error, /acknowledgement lost/);
  assert.equal(f.inputs.length, 2);
  assert.equal(result.completed.length, 0);
});

test('abort mid-segment sends no more input', async () => {
  const controller = new AbortController();
  const f = fixture(initialCombat(), { onInput: state => { controller.abort(); return state; } });
  f.executor.signal = controller.signal;
  const result = await f.run([play(6), play(2)]);
  assert.ok(result.error);
  assert.equal(f.inputs.length, 1);
});

const initialMap = () => ({ state_type: 'map', player: { hp: 80 }, ui: { focus_path: '/map/node0' }, map: { nodes: [], next_options: [{ col: 3 }] } });
test('map activation waits through intermediate focus changes for the destination scene', async () => {
  const f = fixture(initialMap(), {
    onInput: s => ({ ...s, ui: { focus_path: null } }),
    onObserve: (s, reads) => reads >= 4 ? { ...s, state_type: 'event' } : s,
  });
  const result = await f.run([{ type: 'input', buttons: ['a'] }]);
  assert.equal(result.error, undefined);
  assert.equal(result.state.state_type, 'event');
  assert.equal(f.inputs.length, 1);
  assert.equal(f.sensors(), 4);
});

test('an uncompleted map transition stops without repeating activation', async () => {
  const f = fixture(initialMap(), { onInput: s => ({ ...s, ui: { focus_path: null } }) });
  const result = await f.run([{ type: 'input', buttons: ['a'] }]);
  assert.match(result.error, /map travel did not leave/);
  assert.equal(result.completed.length, 0);
  assert.equal(f.inputs.length, 1);
});
test('12 navigation presses use one boundary read; verified activation uses the same decision', async () => {
  const state = initialMap();
  const destination = { state_type: 'map', focus_path: '/map/node12' };
  const f = fixture(state, { onInput: (s, button, count) => button === 'a' ? { ...s, state_type: 'event' } : { ...s, ui: { focus_path: `/map/node${count}` } } });
  const result = await f.run([{ type: 'input', buttons: Array(12).fill('right'), expect: destination }, { type: 'input', buttons: ['a'], from: destination }]);
  assert.equal(result.error, undefined);
  assert.equal(result.completed.length, 2);
  assert.equal(f.inputs.length, 13);
  assert.equal(f.sensors(), 3); // initial guard, navigation boundary, activation boundary
});

test('failed UI sequence cannot activate or send a later sequence', async () => {
  const state = initialMap();
  const destination = { state_type: 'map', focus_path: '/map/node4' };
  const f = fixture(state, { onInput: s => s });
  const result = await f.run([{ type: 'input', buttons: Array(4).fill('right'), expect: destination }, { type: 'input', buttons: ['a'], from: destination }]);
  assert.match(result.error, /no observed change/);
  assert.equal(f.inputs.length, 4);
});

test('known startup transitions execute in one plan with verified intermediate screens', async () => {
  const state = { state_type: 'menu', menu_screen: 'main', ui: { focus_path: '/menu/SingleplayerButton' } };
  const standard = { state_type: 'menu', menu_screen: 'singleplayer', focus_path: '/menu/StandardButton' };
  const f = fixture(state, { onInput: (_s, _b, count) => count === 1
    ? { state_type: 'menu', menu_screen: 'singleplayer', ui: { focus_path: standard.focus_path } }
    : { state_type: 'menu', menu_screen: 'character_select', ui: { focus_path: '/menu/EmbarkButton' } } });
  const result = await f.run([
    { type: 'input', buttons: ['a'], expect: standard },
    { type: 'input', buttons: ['a'], from: standard, expect: { state_type: 'menu', menu_screen: 'character_select' } },
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.completed.length, 2);
  assert.equal(f.sensors(), 3);
});

test('unknown transitions and irreversible activations cannot have a remainder', () => {
  for (const state of [initialMap(), { state_type: 'event' }, { state_type: 'shop' }, { state_type: 'menu', ui: { focus_path: '/menu/AbandonButton' } }]) {
    assert.throws(() => validatePlan(planFor(state, [
      { type: 'input', buttons: ['a'], expect: { state_type: 'menu' } },
      { type: 'input', buttons: ['a'], from: { state_type: 'menu', focus_path: '/menu/ConfirmButton' } },
    ]), state), /final semantic boundary/);
  }
});

test('a labelled focus needs no screenshot, and an unchanged map is not resent', () => {
  assert.equal(needsScreenshot(initialCombat()), false);
  assert.equal(needsScreenshot({ state_type: 'rewards', ui: { focus_path: '/RewardsContainer/RewardButton' } }), true);
  const state = initialMap();
  const compact = strategistState(state, { mapUnchanged: true });
  assert.equal(compact.map.nodes, undefined);
  assert.equal(compact.map.node_count, state.map.nodes.length);
  assert.deepEqual(compact.map.next_options, state.map.next_options);
});

const transformScreen = result => ({
  state_type: 'card_select',
  player: { hp: 80 },
  ui: { focus_path: null, focused_card: null },
  card_select: {
    screen_type: 'transform',
    prompt: 'Choose a card to Transform.',
    cards: [{ id: 'STRIKE_IRONCLAD', name: 'Strike', index: 0 }],
    preview_showing: true,
    preview_cards: [
      { id: 'STRIKE_IRONCLAD', name: 'Strike', index: 0 },
      { id: result, name: result, index: 1 },
    ],
    can_cancel: true,
    can_confirm: true,
  },
});

test('the transform preview re-roll leaves the observation identity so a confirm plan can execute', async () => {
  const first = transformScreen('HEADBUTT');
  assert.equal(stateId(first), stateId(transformScreen('EXPECT_A_FIGHT')));
  const compact = compactState(first);
  assert.deepEqual(compact.card_select.preview_cards.map(card => card.id), ['STRIKE_IRONCLAD']);
  assert.match(compact.card_select.random_result_preview, /does not determine the result/);

  // Choosing a different card is a real change and must still invalidate a plan.
  const other = transformScreen('HEADBUTT');
  other.card_select.preview_cards[0] = { id: 'DEFEND_IRONCLAD', name: 'Defend', index: 0 };
  assert.notEqual(stateId(first), stateId(other));

  // The plan is built against one read and still executes while the preview keeps re-rolling.
  const rolls = ['STAMPEDE', 'TAUNT', 'CRUELTY', 'DARK_EMBRACE'];
  let confirmed = false;
  const f = fixture(first, {
    onInput: (state, button) => { if (button === 'y') confirmed = true; return state; },
    onObserve: (state, sensors) => (confirmed ? { state_type: 'map', player: { hp: 80 }, ui: { focus_path: '/map/node0' }, map: { nodes: [], next_options: [] } } : transformScreen(rolls[sensors % rolls.length])),
  });
  const result = await f.executor.execute(planFor(first, [{ type: 'input', buttons: ['y'] }]), first);
  assert.equal(result.error, undefined);
  assert.equal(result.completed.length, 1);
  assert.deepEqual(f.inputs.map(input => input.button), ['y']);
});

test('a directional move cannot claim the focus it starts from, and no input is sent', () => {
  const options = '/root/Game/Run/RoomContainer/EventRoom/EventContainer/VBoxContainer/OptionsContainer/EventOptionButton';
  const event = { state_type: 'event', player: { hp: 75 }, ui: { focus_path: options }, event: { event_id: 'WOOD_CARVINGS', options: [{ index: 0 }, { index: 1 }, { index: 2 }] } };
  assert.throws(() => validatePlan(planFor(event, [
    { type: 'input', buttons: ['down', 'down'], from: { state_type: 'event', focus_path: options }, expect: { state_type: 'event', focus_path: options } },
    { type: 'input', buttons: ['a'], from: { state_type: 'event', focus_path: options } },
  ]), event), /cannot expect the focus it starts from/);

  // The same rule applies to a later action's declared origin.
  assert.throws(() => validatePlan(planFor(event, [
    { type: 'input', buttons: ['down'], expect: { state_type: 'event', focus_path: '/other' } },
    { type: 'input', buttons: ['down'], from: { state_type: 'event', focus_path: '/other' }, expect: { state_type: 'event', focus_path: '/other' } },
    { type: 'input', buttons: ['a'], from: { state_type: 'event', focus_path: '/other' } },
  ]), event), /cannot expect the focus it starts from/);

  // Navigating standalone, with the destination left unnamed, stays valid.
  validatePlan(planFor(event, [{ type: 'input', buttons: ['down', 'down'] }]), event);
});

test('a standalone probe reports an unmoved edge instead of failing, and stays bounded', async () => {
  const map = () => ({ state_type: 'map', player: { hp: 67 }, ui: { focus_path: '/map/Points/@Control@359' }, map: { nodes: [], next_options: [{ col: 3 }, { col: 4 }] } });

  // Nothing moves: the probe answers the question rather than pausing the run.
  const edge = fixture(map(), { onInput: state => state });
  const stuck = await edge.executor.execute(planFor(map(), [{ type: 'input', buttons: ['left'], probe: true }]), map());
  assert.equal(stuck.error, undefined);
  assert.equal(stuck.completed[0].moved, false);
  assert.equal(edge.inputs.length, 1);

  // Focus moves: the probe reports the new focus like any verified navigation.
  const moving = fixture(map(), { onInput: state => ({ ...state, ui: { focus_path: '/map/Points/@Control@372' } }) });
  const moved = await moving.executor.execute(planFor(map(), [{ type: 'input', buttons: ['left'], probe: true }]), map());
  assert.equal(moved.error, undefined);
  assert.equal(moved.completed[0].moved, true);

  // A single standalone directional press probes even without the flag.
  const implicit = fixture(map(), { onInput: state => state });
  const plain = await implicit.executor.execute(planFor(map(), [{ type: 'input', buttons: ['left'] }]), map());
  assert.equal(plain.error, undefined);
  assert.equal(plain.completed[0].moved, false);

  // A trailing note sends nothing, so the press before it is still one
  // standalone probe. Counting the note as a second action turned a harmless
  // "already at that edge" answer into a paused run.
  const withNote = fixture(map(), { onInput: state => state });
  const noted = await withNote.executor.execute(planFor(map(), [
    { type: 'input', buttons: ['down'] },
    { type: 'learn', path: 'controls/rewards.md', content: '---\ndescription: Reward rows\nkeys: rewards\n---\nRead the row count from state.\n', message: 'Record the reward row rule' },
  ]), map());
  assert.equal(noted.error, undefined);
  assert.equal(noted.completed[0].moved, false);
  assert.equal(noted.completed[1].action.type, 'learn');

  // A batched sequence, an activation and a predicted destination still pause when nothing moves.
  const batched = fixture(map(), { onInput: state => state });
  assert.match((await batched.executor.execute(planFor(map(), [{ type: 'input', buttons: ['left', 'left'] }]), map())).error, /produced no observed change/);
  const activating = fixture(map(), { onInput: state => state });
  assert.match((await activating.executor.execute(planFor(map(), [{ type: 'input', buttons: ['a'] }]), map())).error, /map travel did not leave the map|produced no observed change/);
  const predicted = fixture(map(), { onInput: state => state });
  assert.match((await predicted.executor.execute(planFor(map(), [{ type: 'input', buttons: ['left'], expect: { state_type: 'map', focus_path: '/map/Points/@Control@372' } }]), map())).error, /produced no observed change/);

  // A probe cannot hide an activation, a batch, a predicted destination or a combat input.
  const state = map();
  for (const actions of [
    [{ type: 'input', buttons: ['a'], probe: true }],
    [{ type: 'input', buttons: ['left', 'left'], probe: true }],
    [{ type: 'input', buttons: ['left'], probe: true, expect: { state_type: 'map', focus_path: '/map/Points/@Control@372' } }],
    [{ type: 'input', buttons: ['left'], probe: true, expect: { state_type: 'map' } }, { type: 'input', buttons: ['a'], from: { state_type: 'map', focus_path: '/x' } }],
  ]) assert.throws(() => validatePlan(planFor(state, actions), state), /outside live card play|batch navigation separately/);
  const combat = initialCombat();
  assert.throws(() => validatePlan(planFor(combat, [{ type: 'input', buttons: ['left'], probe: true }]), combat), /outside live card play/);
});

test('a batch that costs more energy than the turn has is refused before any input', async () => {
  // can_play is true for each of these on its own; together they cost 4 with 3
  // available, which used to surface only after the first cards were played.
  const state = initialCombat();
  state.player.energy = 3;
  const [bash, strike, defend] = [state.player.hand[0], state.player.hand[1], state.player.hand[2]];
  Object.assign(bash, { name: 'Bash', cost: 2 });
  Object.assign(strike, { name: 'Strike', cost: 1 });
  Object.assign(defend, { name: 'Defend', cost: 1, target_type: 'Self' });
  for (const card of state.player.hand.slice(3)) card.cost = 1;

  assert.throws(
    () => validatePlan(planFor(state, [play(bash.instance_id), play(strike.instance_id), { type: 'play', card: defend.instance_id }]), state),
    /spends 4 energy and the turn has 3/,
  );
  const f = fixture(state);
  await assert.rejects(() => f.run([play(bash.instance_id), play(strike.instance_id), { type: 'play', card: defend.instance_id }]), /spends 4 energy/);
  assert.equal(f.inputs.length, 0, 'and nothing reached the pad');

  // What the turn can pay for is fine, and so is a single card.
  validatePlan(planFor(state, [play(bash.instance_id), play(strike.instance_id)]), state);
  validatePlan(planFor(state, [play(bash.instance_id)]), state);

  // The arithmetic is only trusted when it is knowable: an X-cost card, or one
  // that can change the energy available, skips the check rather than guessing.
  const unknown = structuredClone(state);
  unknown.player.hand[1].cost = -1;
  validatePlan(planFor(unknown, [play(1), play(2), { type: 'play', card: 3 }]), unknown);
  const gainsEnergy = structuredClone(state);
  gainsEnergy.player.hand[1].description = 'Deal 5 damage. Gain 2 energy.';
  validatePlan(planFor(gainsEnergy, [play(1), play(2), { type: 'play', card: 3 }]), gainsEnergy);
});

test('a wrong prediction on the last step is reported, not paused; on an earlier step it still pauses', async () => {
  // Collecting a reward consumes it and focus lands on an auto-generated
  // sibling path nobody can predict. The action worked; only the guess did not.
  const rewards = () => ({
    state_type: 'rewards', run: { floor: 3, act: 1 }, player: { hp: 33, max_hp: 80 },
    rewards: { items: [{ index: 0, type: 'gold' }, { index: 1, type: 'card' }], can_proceed: true },
    ui: { focus_path: '/Rewards/RewardButton' },
  });
  const collected = state => {
    const next = structuredClone(state);
    next.rewards.items = [{ index: 0, type: 'card' }];
    next.ui.focus_path = '/Rewards/@Control@3081';
    return next;
  };

  const last = fixture(rewards(), { onInput: collected });
  const result = await last.executor.execute(planFor(rewards(), [
    { type: 'input', buttons: ['a'], expect: { state_type: 'rewards', focus_path: '/Rewards/RewardButton' } },
  ]), rewards());
  assert.equal(result.error, undefined, 'the scene changed, so the action is not a failure');
  assert.equal(result.completed[0].verified, true);
  assert.equal(result.completed[0].expectation_missed.observed.focus_path, '/Rewards/@Control@3081');
  assert.equal(last.inputs.length, 1, 'and nothing further was sent');

  // A trailing note does not make the press an earlier step.
  const noted = fixture(rewards(), { onInput: collected });
  const withNote = await noted.executor.execute(planFor(rewards(), [
    { type: 'input', buttons: ['a'], expect: { state_type: 'rewards', focus_path: '/Rewards/RewardButton' } },
    { type: 'learn', path: 'controls/rewards.md', content: '---\ndescription: Rewards\nkeys: rewards\n---\nFocus moves after collecting.\n', message: 'Record the reward focus rule' },
  ]), rewards());
  assert.equal(withNote.error, undefined);
  assert.equal(withNote.completed[1].action.type, 'learn');

  // With another gameplay action still queued, a wrong prediction must stop the
  // batch: the next input would be aimed at a scene that was never verified.
  const earlier = fixture(rewards(), { onInput: collected });
  const batched = await earlier.executor.execute(planFor(rewards(), [
    { type: 'input', buttons: ['down'], expect: { state_type: 'rewards', focus_path: '/Rewards/CardButton' } },
    { type: 'input', buttons: ['a'], from: { state_type: 'rewards', focus_path: '/Rewards/CardButton' } },
  ]), rewards());
  assert.match(batched.error, /did not reach expected screen\/focus/);
  assert.equal(earlier.inputs.length, 1, 'the activation was never sent');
});

test('a selection overlay during combat is a list, not card play', async () => {
  // The player reached a hand_select overlay on an auto-generated focus path
  // and could neither batch navigation nor probe, because both rules keyed off
  // "is there a battle" rather than "is a card being aimed".
  const overlay = () => ({
    state_type: 'hand_select', run: { floor: 12, act: 1 },
    player: { hp: 17, block: 8, energy: 0, hand: [{ instance_id: 1, index: 0, name: 'Strike', can_play: false, target_type: 'AnyEnemy' }] },
    battle: { is_play_phase: false, turn: 'player', round: 5, enemies: [{ entity_id: 'FOE_0', combat_id: 9, hp: 12 }] },
    ui: { focus_path: '/Hand/CardHolderContainer/@Control@3421' },
  });
  validatePlan(planFor(overlay(), [{ type: 'input', buttons: ['right', 'right'] }]), overlay());
  validatePlan(planFor(overlay(), [{ type: 'input', buttons: ['left'], probe: true }]), overlay());

  // And an unmoved probe answers the question instead of failing the run.
  const edge = fixture(overlay(), { onInput: state => state });
  const stuck = await edge.executor.execute(planFor(overlay(), [{ type: 'input', buttons: ['left'] }]), overlay());
  assert.equal(stuck.error, undefined);
  assert.equal(stuck.completed[0].moved, false);

  // Live card play keeps every restriction: a stray direction there changes
  // which enemy a lifted card hits.
  const play = initialCombat();
  assert.throws(() => validatePlan(planFor(play, [{ type: 'input', buttons: ['right', 'right'] }]), play), /batch navigation separately/);
  assert.throws(() => validatePlan(planFor(play, [{ type: 'input', buttons: ['left'], probe: true }]), play), /outside live card play/);
});

// The semantic navigation branch had no coverage at all, which is part of why
// nothing noticed that prompt.txt never told the model these actions exist.
// Shaped like the screen that halted a real run: NCardGrid points a card row's
// up and down neighbours back at the card and wraps left and right, so Skip
// sits outside the loop and is reached by its bound button instead.
const rewardScreen = () => ({
  state_type: 'card_reward', run: { floor: 1, act: 1 }, player: { hp: 80 },
  ui: {
    sensor_version: 6, scene_id: 'scene-reward', focused_element: 'element-card',
    focus_path: '/root/Run/NCardRewardSelectionScreen/UI/CardRow/GridCardHolder-CARD_AFTERLIFE',
    elements: [
      { id: 'element-card', label: 'Afterlife', type: 'NGridCardHolder', visible: true, enabled: true, focus_mode: 'all', selectable: true, activation: 'a', ambiguous: false, bounds: [960, 616, 300, 420], neighbors: { up: 'element-card', down: 'element-card', left: 'element-other', right: 'element-other' } },
      { id: 'element-other', label: 'Glacier', type: 'NGridCardHolder', visible: true, enabled: true, focus_mode: 'all', selectable: true, activation: 'a', ambiguous: false, bounds: [610, 616, 300, 420], neighbors: { up: 'element-other', down: 'element-other', left: 'element-card', right: 'element-card' } },
      { id: 'element-skip', label: 'Skip', type: 'NCardRewardAlternativeButton', visible: true, enabled: true, focus_mode: 'all', selectable: true, activation: 'a', press: 'b', hotkeys: ['ui_cancel'], ambiguous: false, bounds: [822, 884, 276, 73], neighbors: { up: 'element-screen', down: 'element-screen', left: 'element-screen', right: 'element-screen' } },
      { id: 'element-screen', label: 'Rewards', type: 'NRewardsScreen', visible: true, enabled: true, focus_mode: 'click', selectable: false, activation: null, ambiguous: false, bounds: [0, 0, 1920, 1080], neighbors: {} },
    ],
  },
});

test('a control bound to a button is pressed directly, with no route and no focus move', async () => {
  const screen = fixture(rewardScreen(), { onInput: (state, button) => {
    if (button === 'b') state.state_type = 'map';
    return state;
  } });
  const result = await screen.run([{ type: 'activate', target: 'element-skip', scene: 'scene-reward' }]);
  assert.equal(result.error, undefined);
  assert.equal(result.state.state_type, 'map');
  assert.deepEqual(screen.inputs.map(input => input.direction || input.button), ['b']);
  assert.equal(result.completed[0].pressed, 'b');
  // Focus never moved, and there is genuinely no route: inferring one from the
  // on-screen geometry would have spent presses that do nothing.
  assert.equal(result.state.ui.focused_element, 'element-card');
  assert.throws(() => navigationPath(rewardScreen(), 'element-card', 'element-skip'), /no verified focus path/);
});

test('an untargeted press refuses when focus moved off the control, but a probe stays relative', async () => {
  // A press with no target acts on whatever holds focus, so it is the only kind
  // of input whose meaning depends on focus not having moved. planIdentity no
  // longer refuses a plan for a focus move alone (the majority are churn that a
  // named target does not care about), so this guard carries that protection -
  // and only for the presses that need it.
  const moved = rewardScreen();
  // Focus on the Skip button rather than the card: a different kind of control,
  // which is the case that matters. A bare press planned for the card would
  // land on Skip instead.
  const screen = fixture(rewardScreen(), {
    onObserve: (state) => { state.ui.focused_element = 'element-skip'; return state; },
    onInput: state => state,
  });
  const refused = await screen.run([{ type: 'input', buttons: ['a'] }]);
  assert.match(refused.error, /focus moved off the control this press would activate/);
  assert.equal(screen.inputs.length, 0, 'nothing was sent');
  assert.equal(moved.ui.focused_element, 'element-card');
  const probe = fixture(rewardScreen(), { onInput: state => state });
  const probed = await probe.run([{ type: 'input', buttons: ['right'] }]);
  assert.equal(probed.error, undefined);
  assert.equal(probe.inputs.length, 1);
});

test('an element with no bound button is still reached by the route the game wired', async () => {
  const screen = fixture(rewardScreen(), { onInput: (state, button) => {
    if (button === 'left' && state.ui.focused_element === 'element-card') state.ui.focused_element = 'element-other';
    if (button === 'a' && state.ui.focused_element === 'element-other') state.state_type = 'card_select';
    return state;
  } });
  const result = await screen.run([{ type: 'activate', target: 'element-other', scene: 'scene-reward' }]);
  assert.equal(result.error, undefined);
  assert.deepEqual(screen.inputs.map(input => input.direction || input.button), ['left', 'a']);
});

test('activate works from a screen that holds no focus yet', async () => {
  const cold = rewardScreen();

  cold.ui.focused_element = null;
  const screen = fixture(cold, { onInput: (state, button) => {
    if (button === 'down' && !state.ui.focused_element) state.ui.focused_element = 'element-card';
    if (button === 'left' && state.ui.focused_element === 'element-card') state.ui.focused_element = 'element-other';
    if (button === 'a' && state.ui.focused_element === 'element-other') state.state_type = 'card_select';
    return state;
  } });
  const result = await screen.run([{ type: 'activate', target: 'element-other', scene: 'scene-reward' }]);
  assert.equal(result.error, undefined);
  assert.deepEqual(screen.inputs.map(input => input.direction || input.button), ['down', 'left', 'a']);
});

test('a route survives the screen redrawing under it, but not focus slipping off the target', async () => {
  // The route takes one read per press, so scene_id churns under it repeatedly.
  // A screen redrawing as the cursor crosses it is not the route going stale -
  // the press still lands on the control the plan named, and refusing here
  // would refuse the same churn the pre-execution identity comparison used to.
  const drifting = fixture(rewardScreen(), {
    onObserve: (state, reads) => { if (reads > 1) state.ui.scene_id = `scene-drawn-${reads}`; return state; },
    onInput: (state, button) => {
      if (button === 'left' && state.ui.focused_element === 'element-card') state.ui.focused_element = 'element-other';
      if (button === 'a' && state.ui.focused_element === 'element-other') state.state_type = 'card_select';
      return state;
    },
  });
  const walked = await drifting.run([{ type: 'activate', target: 'element-other', scene: 'scene-reward' }]);
  assert.equal(walked.error, undefined, 'a redrawing screen does not stale the route');
  assert.deepEqual(drifting.inputs.map(input => input.direction || input.button), ['left', 'a']);

  // The press DOES depend on where focus is: `a` activates whatever holds it,
  // and planIdentity deliberately no longer tracks focus, so this precondition
  // is the only thing standing between a slipped cursor and the wrong control.
  // The route lands on the target, then focus slips before the press is sent.
  const slipped = fixture(rewardScreen(), {
    onObserve: (state, reads) => {
      // Read 1 is the plan's screen; read 2 is the route's landing; read 3 is
      // the last-moment re-read the press is gated on.
      if (reads === 3) state.ui.focused_element = 'element-card';
      return state;
    },
    onInput: (state, button) => {
      if (button === 'left' && state.ui.focused_element === 'element-card') state.ui.focused_element = 'element-other';
      return state;
    },
  });
  const missed = await slipped.run([{ type: 'activate', target: 'element-other', scene: 'scene-reward' }]);
  assert.match(missed.error, /activation target became stale/);
  assert.deepEqual(slipped.inputs.map(input => input.direction || input.button), ['left'], 'the route pressed; the activation did not');
});

test('semantic navigation refuses a stale scene and keeps read-only queries input-free', async () => {
  const screen = rewardScreen();
  assert.throws(() => validatePlan(planFor(screen, [{ type: 'activate', target: 'element-skip', scene: 'scene-gone' }]), screen), /stale or missing scene ID/);
  assert.throws(() => validatePlan(planFor(screen, [{ type: 'activate', target: 'element-skip', scene: 'scene-reward' }, { type: 'navigate', target: 'element-card', scene: 'scene-reward' }]), screen), /final scene barrier/);
  assert.throws(() => validatePlan(planFor(screen, [{ type: 'path', target: 'element-other', scene: 'scene-reward' }, { type: 'navigate', target: 'element-card', scene: 'scene-reward' }]), screen), /read-only query must be standalone/);

  const query = fixture(screen, { onInput: state => state });
  const asked = await query.run([{ type: 'path', target: 'element-other', scene: 'scene-reward' }]);
  assert.equal(asked.error, undefined);
  assert.equal(query.inputs.length, 0);
  assert.deepEqual(asked.completed[0].path.map(step => step.direction), ['left']);
});

test('only the actuator is sent the interface, and it is sent what it can press rather than the graph', () => {
  const screen = rewardScreen();
  // A labelled focused element is the whole point of the sensor: no screenshot.
  assert.equal(needsScreenshot(screen), false);
  const sent = actuatorElements(screen);
  assert.ok(sent.every(item => item.neighbors === undefined && item.bounds === undefined));
  const skip = sent.find(item => item.id === 'element-skip');
  assert.equal(skip.label, 'Skip');
  assert.equal(skip.press, 'b');
  assert.deepEqual(skip.hotkeys, ['ui_cancel']);
  // The executor still sees the full graph it routes with.
  assert.ok(compactState(screen).ui.elements.every(item => item.neighbors !== undefined));
  // Nobody who plays the game sees any of it. An element id in front of the
  // strategist is only something to invent a route through.
  assert.equal(strategistState(screen).ui, undefined);
  assert.equal(combatState(initialCombat()).ui, undefined);
  assert.equal(combatState(initialCombat()).map, undefined);
  assert.equal(strategistState(initialCombat()).battle, undefined);
});

test('presentation that moves on its own is not a change, but a control that is gone is', async () => {
  // A tween sliding a control changes stateId every read. Nothing the plan
  // rests on moved, so the plan must still execute: treating this as stale is
  // what threw away most combat decisions without sending any input.
  const drifting = fixture(rewardScreen(), {
    onObserve: (state, reads) => { state.ui.elements[0].bounds = [960, 616 + reads, 300, 420]; return state; },
    onInput: (state, button) => { if (button === 'b') state.state_type = 'map'; return state; },
  });
  const moved = await drifting.run([{ type: 'activate', target: 'element-skip', scene: 'scene-reward' }]);
  assert.equal(moved.error, undefined);
  assert.deepEqual(drifting.inputs.map(input => input.direction || input.button), ['b']);

  // A scene id that moved while the screen stayed the same is not a change.
  // The sensor builds scene_id out of Godot instance ids, so it moves whenever
  // the game rebuilds a node - a tooltip, a pile counter, a holder the cursor
  // passed back over. Refusing on that alone is what threw away 402 finished
  // model turns. The press names a control that is still there, so it goes.
  const replaced = fixture(rewardScreen(), {
    onObserve: (state) => { state.ui.scene_id = 'scene-moved-on'; return state; },
    onInput: (state, button) => { if (button === 'b') state.state_type = 'map'; return state; },
  });
  const churned = await replaced.run([{ type: 'activate', target: 'element-skip', scene: 'scene-reward' }]);
  assert.equal(churned.error, undefined);
  assert.equal(churned.state.state_type, 'map');
  assert.deepEqual(replaced.inputs.map(input => input.direction || input.button), ['b']);

  // A control actually disappearing is the change that matters, and it is
  // refused before any read of the game - the identity comparison still holds
  // that line, and it is the only thing that ever should have.
  const gone = fixture(rewardScreen(), {
    onObserve: (state) => { state.ui.elements = state.ui.elements.filter(item => item.id !== 'element-skip'); return state; },
    onInput: state => state,
  });
  const refused = await gone.run([{ type: 'activate', target: 'element-skip', scene: 'scene-reward' }]).catch(error => error);
  assert.equal(refused.code, 'stale_observation');
  assert.equal(gone.inputs.length, 0);
  // The refusal hands back what the plan was written against and what is there
  // now, so the next call extends the plan instead of re-deriving the screen.
  assert.equal(refused.state.ui.elements.some(item => item.id === 'element-skip'), false);
});

test('a screen still arriving is routed around, but gameplay advancing during a route is not', async () => {
  // A reward deals its cards in after the plan was made: the scene changes with
  // nothing happening in the run. Recompute the route rather than pausing.
  let reads = 0;
  const arriving = fixture(rewardScreen(), {
    // Read 1 matches the plan; the screen finishes dealing during the route.
    onObserve: (state) => { if (++reads > 1) state.ui.scene_id = 'scene-dealt'; return state; },
    onInput: (state, button) => {
      if (button === 'left' && state.ui.focused_element === 'element-card') state.ui.focused_element = 'element-other';
      if (button === 'a' && state.ui.focused_element === 'element-other') state.state_type = 'card_select';
      return state;
    },
  });
  const settled = await arriving.run([{ type: 'activate', target: 'element-other', scene: 'scene-reward' }]);
  assert.equal(settled.error, undefined);
  assert.deepEqual(arriving.inputs.map(input => input.direction || input.button), ['left', 'a']);

  // Gameplay moving underneath a route is the real hazard and still stops it.
  const advancing = fixture(rewardScreen(), {
    onInput: (state, button) => { if (button === 'left') state.player.hp = 40; return state; },
  });
  const hazard = await advancing.run([{ type: 'activate', target: 'element-other', scene: 'scene-reward' }]);
  assert.match(hazard.error, /gameplay advanced during navigation/);
});

// A batch that stops cleanly part way is not a failed input.
//
// Live, on floor 25 of room 70f25b98: a one-shot "the next Attack you play
// costs 0" makes EVERY eligible card report cost 0 and can_play true, because
// each of them would be free IF PLAYED NEXT. Molten Fist spent the discount,
// Pommel Strike reverted to full price against 0 energy, and the executor
// correctly declined it BEFORE pressing anything. The turn still paused for an
// operator over a card the pad never touched.
test('a later play refused before its own input reports which action pressed nothing', async () => {
  const state = initialCombat();
  state.player.energy = 0;
  const [first, second] = state.player.hand;
  Object.assign(first, { name: 'Molten Fist', cost: 0 });
  Object.assign(second, { name: 'Pommel Strike', cost: 0 });
  // Playing the first spends the one-shot discount the second was counting on.
  const f = fixture(state, { afterPlay: (live, played) => {
    if (played !== first.instance_id) return;
    const other = live.player.hand.find(card => card.instance_id === second.instance_id);
    if (other) Object.assign(other, { cost: 1, can_play: false, unplayable_reason: 'EnergyCostTooHigh' });
  } });
  const result = await f.run([play(first.instance_id), play(second.instance_id)]);
  assert.match(result.error, /EnergyCostTooHigh/);
  assert.equal(result.completed.length, 1, 'the first card played');
  assert.equal(result.failedActionSentInput, false, 'and the second pressed nothing, so the run can re-plan instead of pausing');
});

// A potion is a barrier, not a solo act.
//
// Live, at decision 108 of room 5976c38f: the combat agent planned two cards
// and then a potion, and the validator rejected it three times for "one potion
// per plan" until the refinement budget ran out. Nothing can be planned PAST a
// potion, because what it does is only visible afterwards - but the cards
// before it are the model's call, not the validator's.
// A potion goes wherever the turn wants it. Requiring it LAST looked harmless
// and was not: drinking and then acting is the ordinary play, so the model put
// the potion first, the plan was refused, and it satisfied the refusal by
// deleting the potion and re-sending. That happened eight times in one run -
// through an elite fight - and not one potion was drunk. The executor already
// stops the batch after a potion, so the ordering was never load-bearing.
test('a potion goes anywhere in the turn, and the runtime stops after it', () => {
  const state = initialCombat();
  state.player.energy = 3;
  state.player.potions = [{ slot: 0, name: 'Fysh Oil', target_type: 'AnyPlayer', can_use_in_combat: true }];
  const potion = { type: 'use_potion', slot: 0 };
  const [first, second] = state.player.hand;

  validatePlan(planFor(state, [play(first.instance_id), potion]), state, { role: 'combat' });
  validatePlan(planFor(state, [potion]), state, { role: 'combat' });
  // The ordering the old rule refused, which is the one a buffing potion needs.
  validatePlan(planFor(state, [potion, play(first.instance_id)]), state, { role: 'combat' });
  validatePlan(planFor(state, [potion, play(first.instance_id), play(second.instance_id)]), state, { role: 'combat' });

  // A second potion could never be reached, so it is refused rather than dropped silently.
  assert.throws(
    () => validatePlan(planFor(state, [potion, { type: 'use_potion', slot: 0 }]), state, { role: 'combat' }),
    /one potion per plan/,
  );
});

// Gambling Chip removes each chosen card from the indexed candidates. Its
// selected tray has its own holders, and focused hand cards grow/reposition.
function handSelectionFixture({ picked = [], failNavigation = false, ignoreToggle = false } = {}) {
  const hand = ['Neow', 'Strike', 'Pommel', 'Guilty', 'Strike'].map((name, index) => ({
    name, id: name.toUpperCase(), instance_id: 119 - index,
  }));
  const selected = new Set(picked);
  let open = true;
  let focused = 117;
  const presses = [];
  const read = () => ({
    state_type: open ? 'hand_select' : 'combat', player: { hand },
    ...(open ? { hand_select: { mode: 'simple_select', can_confirm: true,
      cards: hand.filter(card => !selected.has(card.instance_id)).map((card, index) => ({ ...card, index })),
      selected_cards: [...selected].map((identity, index) => ({ index, name: hand.find(card => card.instance_id === identity).name })),
    } } : {}),
    ui: { scene_id: `selected-${[...selected].join('-')}`, focused_element: `holder-${focused}-${selected.has(focused)}`,
      elements: hand.toReversed().map((card, index) => ({
        id: `holder-${card.instance_id}-${selected.has(card.instance_id)}`,
        type: selected.has(card.instance_id) ? 'NSelectedHandCardHolder' : 'NHandCardHolder',
        reference: { kind: 'card', instance_id: card.instance_id },
        visible: true, enabled: true,
        bounds: [100 + index * 150, card.instance_id === focused ? 350 : 700, 600, 700],
      })),
    },
  });
  const executor = Object.create(Executor.prototype);
  executor.navigateElement = async action => {
    if (failNavigation) throw new Error('fixture navigation failed');
    focused = read().ui.elements.find(item => item.id === action.target).reference.instance_id;
    return read();
  };
  executor.button = async button => {
    presses.push([button, focused]);
    if (button === 'a' && !ignoreToggle) selected.has(focused) ? selected.delete(focused) : selected.add(focused);
    if (button === 'y') open = false;
  };
  executor.observe = executor.settled = async () => read();
  executor.sleep = async () => {};
  executor.record = () => {};
  return { executor, read, selected, presses };
}

test('hand selection keeps original physical cards as candidates shrink and duplicate Strikes move', async () => {
  const f = handSelectionFixture();
  const after = await f.executor.chooseCards({ cards: [0, 1, 3, 4] }, f.read());
  assert.equal(after.hand_select, undefined);
  assert.deepEqual([...f.selected].sort(), [115, 116, 118, 119]);
  assert.deepEqual(f.presses.filter(([button]) => button === 'a').map(([, identity]) => identity), [119, 118, 116, 115]);
  assert.equal(f.presses.at(-1)[0], 'y');
});

test('hand selection replaces the partial tray after an incident using current candidate indices', async () => {
  const f = handSelectionFixture({ picked: [118] });
  await f.executor.chooseCards({ cards: [0, 2, 3] }, f.read());
  assert.deepEqual([...f.selected].sort(), [115, 116, 119]);
  assert.deepEqual(f.presses[0], ['a', 118], 'clear previous selected Strike by identity');
});

test('choosing no hand cards clears the partial tray then confirms', async () => {
  const f = handSelectionFixture({ picked: [118] });
  await f.executor.chooseCards({ cards: [] }, f.read());
  assert.equal(f.selected.size, 0);
  assert.deepEqual(f.presses.map(([button]) => button), ['a', 'y']);
});

test('selection navigation failure never falls through to pressing the wrong card', async () => {
  const f = handSelectionFixture({ failNavigation: true });
  await assert.rejects(() => f.executor.chooseCards({ cards: [0] }, f.read()), /navigation failed/);
  assert.deepEqual(f.presses, []);
});

test('selection without an observed tray change stops without retrying the toggle or confirming', async () => {
  const f = handSelectionFixture({ ignoreToggle: true });
  await assert.rejects(() => f.executor.chooseCards({ cards: [0] }, f.read()), /did not move/);
  assert.deepEqual(f.presses.map(([button]) => button), ['a']);
});

test('ambiguous hand candidate mapping is refused before input', async () => {
  const f = handSelectionFixture();
  const state = f.read();
  state.hand_select.cards.reverse();
  await assert.rejects(() => f.executor.chooseCards({ cards: [0] }, state), /cannot map/);
  assert.deepEqual(f.presses, []);
});


test('an entirely selected hand still uses tray verification when choosing no cards', async () => {
  const f = handSelectionFixture({ picked: [115, 116, 117, 118, 119] });
  await f.executor.chooseCards({ cards: [] }, f.read());
  assert.equal(f.selected.size, 0);
  assert.deepEqual(f.presses.map(([button]) => button), ['a', 'a', 'a', 'a', 'a', 'y']);
});

test('stale hand-selection indices reject before any input after the tray shrinks', async () => {
  const f = handSelectionFixture({ picked: [119] });
  await assert.rejects(() => f.executor.chooseCards({ cards: [0, 1, 3, 4] }, f.read()), /no card at index 4/);
  assert.deepEqual(f.presses, [], 'the stale plan cannot press a newly reindexed card');
});

test('generic sparse and reordered card indices resolve by reference identity', async () => {
  let open = true;
  let focused = 'card-two';
  const pressed = [];
  const cards = [
    { index: 0, id: 'STRIKE', name: 'Strike', instance_id: 10 },
    { index: 2, id: 'POMMEL', name: 'Pommel Strike', instance_id: 12 },
  ];
  const elements = [
    { id: 'card-two', label: 'Pommel Strike', reference: { kind: 'card', instance_id: 12 }, bounds: [800, 0, 100, 100] },
    { id: 'card-zero', label: 'Strike', reference: { kind: 'card', instance_id: 10 }, bounds: [200, 0, 100, 100] },
  ];
  const read = () => ({ state_type: 'card_select', card_select: { cards, can_confirm: pressed.length > 0 },
    ui: { scene_id: `generic-${focused}`, focused_element: focused, elements } });
  const executor = Object.create(Executor.prototype);
  executor.navigateElement = async action => { focused = action.target; return read(); };
  executor.button = async button => { pressed.push([button, focused]); if (button === 'y') open = false; };
  executor.observe = executor.settled = async () => open ? read() : { state_type: 'combat' };
  executor.record = () => {};
  executor.sleep = async () => {};
  const after = await executor.chooseCards({ cards: [2] }, read());
  assert.equal(after.card_select, undefined);
  assert.deepEqual(pressed, [['a', 'card-two'], ['y', 'card-two']]);
});

test('generic selection refuses an index with ambiguous physical references', async () => {
  const executor = Object.create(Executor.prototype);
  const pressed = [];
  const state = { state_type: 'card_select', card_select: { cards: [{ index: 0, name: 'Strike' }], can_confirm: false },
    ui: { scene_id: 'ambiguous', focused_element: null, elements: [
      { id: 'one', label: 'Strike', reference: { kind: 'card', instance_id: 1 }, bounds: [0, 0, 10, 10] },
      { id: 'two', label: 'Strike', reference: { kind: 'card', instance_id: 2 }, bounds: [20, 0, 10, 10] },
    ] } };
  executor.button = async button => pressed.push(button);
  await assert.rejects(() => executor.chooseCards({ cards: [0] }, state), /cannot safely map/);
  assert.deepEqual(pressed, []);
});

// Live incident 1789020238941-12, room dfb5e885 floor 2: Neow's Fury put a
// "Choose up to 2 cards to put into your Hand" pile screen over a combat. The
// screen's own grid held Bash, Defend, Strike, Defend, Strike, and the player's
// hand of four - two more Defends and Strikes - stayed on screen underneath.
// Both kinds of holder carry reference.kind 'card', so index 2 (Strike) matched
// a grid holder and a hand holder and the run paused with "cannot safely map
// card index 2 to a unique screen card", having pressed nothing.
//
// The scene below is the incident's own: same five grid holders, same four hand
// holders, same bounds. `stamped` picks which half of the fix is under test -
// the sensor stamping identity onto the offers, or the executor ignoring the
// hand's holders when a scene arrives unstamped (an older mod build).
function pileOverHandFixture({ grid, hand, stamped = true } = {}) {
  const cards = grid.map(({ bounds, ...card }) => stamped ? card : { ...card, instance_id: undefined });
  const elements = [
    ...grid.map(card => ({ id: `grid-${card.instance_id}`, type: 'NGridCardHolder', label: card.name,
      reference: { kind: 'card', instance_id: card.instance_id }, visible: true, enabled: true,
      selectable: true, focus_mode: 'all', activation: 'a', bounds: card.bounds })),
    // The hand is on screen but not part of the screen: unfocusable, so not a
    // candidate even though it carries the same card reference.
    ...hand.map(card => ({ id: `hand-${card.instance_id}`, type: 'NHandCardHolder', label: card.name,
      reference: { kind: 'card', instance_id: card.instance_id }, visible: true, enabled: true,
      selectable: false, focus_mode: 'none', activation: 'a', bounds: card.bounds })),
  ];
  let focused = elements[0].id;
  const pressed = [];
  let open = true;
  const read = () => (open ? {
    state_type: 'card_select', run: { act: 1, floor: 2 },
    player: { hp: 76, max_hp: 80, energy: 2, hand: hand.map(card => ({ instance_id: card.instance_id, name: card.name })) },
    card_select: { screen_type: 'NCombatPileCardSelectScreen', prompt: 'Choose up to 2 cards to put into your Hand.',
      cards, can_confirm: pressed.some(([button]) => button === 'a'), can_cancel: false },
    ui: { scene_id: 'pile-select', focused_element: focused, elements },
  } : { state_type: 'monster', battle: { is_play_phase: true, enemies: [] }, player: { hp: 76, hand: [] }, ui: { elements: [] } });
  const executor = Object.create(Executor.prototype);
  executor.navigateElement = async action => { focused = action.target; return read(); };
  executor.button = async button => { pressed.push([button, focused]); if (button === 'y') open = false; };
  executor.observe = executor.settled = async () => read();
  executor.sleep = async () => {};
  executor.record = () => {};
  return { executor, read, pressed };
}

// The incident's own scene: five grid holders - including two Strikes - and the
// four-card hand underneath sharing two more models. Only the stamp the sensor
// now writes can tell grid Strike (instance 3) from grid Strike (instance 1).
const incidentGrid = [
  { index: 0, id: 'BASH', name: 'Bash', instance_id: 5, bounds: [-6, -15, 759, 951] },
  { index: 1, id: 'DEFEND_IRONCLAD', name: 'Defend', instance_id: 4, bounds: [1190, 80, 607, 760] },
  { index: 2, id: 'STRIKE_IRONCLAD', name: 'Strike', instance_id: 3, bounds: [910, 80, 607, 760] },
  { index: 3, id: 'DEFEND_IRONCLAD', name: 'Defend', instance_id: 2, bounds: [630, 80, 607, 760] },
  { index: 4, id: 'STRIKE_IRONCLAD', name: 'Strike', instance_id: 1, bounds: [350, 80, 607, 760] },
];
const incidentHand = [
  [10, 'Defend', [951, 636, 607, 760]], [9, 'Strike', [762, 629, 607, 760]],
  [8, 'Defend', [549, 672, 607, 760]], [7, 'Strike', [365, 721, 607, 760]],
].map(([instance_id, name, bounds]) => ({ instance_id, name, bounds }));

test('a stamped pile screen over a live hand resolves each index to its own grid card', async () => {
  const f = pileOverHandFixture({ grid: incidentGrid, hand: incidentHand });
  const after = await f.executor.chooseCards({ cards: [0, 2] }, f.read());
  assert.equal(after.card_select, undefined);
  // Bash is index 0 (grid instance 5), Strike is index 2 (grid instance 3).
  assert.deepEqual(f.pressed, [['a', 'grid-5'], ['a', 'grid-3'], ['y', 'grid-3']]);
  assert.equal(f.pressed.some(([, id]) => id.startsWith('hand-')), false, 'no hand holder is pressed');
});

// Without the stamp the scene cannot tell the grid's two Strikes apart, so the
// run must still refuse rather than press an arbitrary one.
test('an unstamped pile screen refuses an index the scene cannot pin to one holder', async () => {
  const f = pileOverHandFixture({ grid: incidentGrid, hand: incidentHand, stamped: false });
  await assert.rejects(() => f.executor.chooseCards({ cards: [2] }, f.read()), /cannot safely map/);
  assert.deepEqual(f.pressed, [], 'the ambiguous press never happens');
});

// The hand duplicates a model the grid offers exactly once. Unstamped, that is
// two matches by name; only the hand's unaddressability collapses it to the one
// grid holder the screen is actually offering.
test('an unstamped pile screen ignores the hand that duplicates a single grid card', async () => {
  const grid = [
    { index: 0, id: 'BASH', name: 'Bash', instance_id: 5, bounds: [350, 80, 607, 760] },
    { index: 1, id: 'POMMEL', name: 'Pommel Strike', instance_id: 4, bounds: [910, 80, 607, 760] },
  ];
  const hand = [{ instance_id: 22, name: 'Bash', bounds: [549, 672, 607, 760] }];
  const f = pileOverHandFixture({ grid, hand, stamped: false });
  const after = await f.executor.chooseCards({ cards: [0] }, f.read());
  assert.equal(after.card_select, undefined);
  assert.deepEqual(f.pressed, [['a', 'grid-5'], ['y', 'grid-5']]);
});

// The hand IS the selection surface in a hand-select screen, and upgrade_select
// shares the generic path with the pile screens. Filtering by holder type rather
// than by addressability disabled it outright.
test('a hand-select screen whose hand is the selection surface stays playable', async () => {
  const hand = [
    { instance_id: 21, name: 'Strike', bounds: [200, 700, 600, 700] },
    { instance_id: 22, name: 'Defend', bounds: [820, 700, 600, 700] },
  ];
  const cards = [{ index: 0, id: 'STRIKE_IRONCLAD', name: 'Strike', instance_id: 21 },
    { index: 1, id: 'DEFEND_IRONCLAD', name: 'Defend', instance_id: 22 }];
  let focused = 'hand-21';
  const pressed = [];
  let open = true;
  const read = () => (open ? {
    state_type: 'hand_select', hand_select: { mode: 'upgrade_select', prompt: 'Choose a card to upgrade.', cards, can_confirm: true },
    ui: { scene_id: 'upgrade', focused_element: focused, elements: hand.map(card => ({
      id: `hand-${card.instance_id}`, type: 'NHandCardHolder', label: card.name,
      reference: { kind: 'card', instance_id: card.instance_id }, visible: true, enabled: true,
      selectable: true, focus_mode: 'all', activation: 'a', bounds: card.bounds })) },
  } : { state_type: 'event', ui: { elements: [] } });
  const executor = Object.create(Executor.prototype);
  executor.navigateElement = async action => { focused = action.target; return read(); };
  executor.button = async button => { pressed.push([button, focused]); if (button === 'y') open = false; };
  executor.observe = executor.settled = async () => read();
  executor.sleep = async () => {};
  executor.record = () => {};
  const after = await executor.chooseCards({ cards: [1] }, read());
  assert.equal(after.hand_select, undefined);
  assert.deepEqual(pressed, [['a', 'hand-22'], ['y', 'hand-22']]);
});
