import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { Executor } from '../client/astra/executor.mjs';
import { PROFILE } from '../client/astra/profile.mjs';
import { compactState, stateId, validatePlan, needsScreenshot, plannerResult, plannerState, mapId } from '../client/astra/state.mjs';

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

test('configuration matches exact Luna/max with no provider restrictions or stale price metadata', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../client/astra/models.json', import.meta.url)));
  const model = config.providers[PROFILE.provider].models[0];
  assert.equal(model.id, PROFILE.model);
  assert.equal(model.samplingParams.reasoning.effort, 'max');
  assert.deepEqual(model.samplingParams.provider, { require_parameters: true });
  assert.equal(model.cost, undefined);
  assert.equal(needsScreenshot(initialCombat()), false);
  assert.equal(needsScreenshot({ state_type: 'rewards', ui: { focus_path: '/RewardsContainer/RewardButton' } }), true);
  const state = initialMap();
  const compact = plannerState(state, { after: { map_id: mapId(state) } }, 'Keep the chosen route.');
  assert.equal(compact.map.nodes, undefined);
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
  ]) assert.throws(() => validatePlan(planFor(state, actions), state), /standalone noncombat directional press|batch navigation separately/);
  const combat = initialCombat();
  assert.throws(() => validatePlan(planFor(combat, [{ type: 'input', buttons: ['left'], probe: true }]), combat), /standalone noncombat directional press/);
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
