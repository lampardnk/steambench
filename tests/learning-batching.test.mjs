import test from 'node:test';
import assert from 'node:assert/strict';
import { Executor, resolveMcpAction } from '../client/learning/executor.mjs';
import { SENSOR_VERSION, assertCompatibleSensor, compactState, hasVerifiedProgress, planIdentity, plannerGuidance, reasoningTier, recoverableSuffixFailure, refinementResult, repairObservation, repairPlan, semanticIdentity, stateId, validatePlan } from '../client/learning/state.mjs';

const card = (instance_id, index, name = `Card ${instance_id}`, extra = {}) => ({ instance_id, index, id: name.toUpperCase().replaceAll(' ', '_'), name, cost: '1', target_type: 'None', can_play: true, description: 'Deal 6 damage.', ...extra });
const enemy = (entity_id = 'JAW_WORM_0') => ({ entity_id, combat_id: 0, name: 'Jaw Worm', hp: 40, block: 0 });
const combat = (hand = [card(10, 0), card(11, 1)]) => ({ state_type: 'monster', run: { act: 1, floor: 1 }, player: { hp: 80, energy: 3, hand, potions: [] }, battle: { round: 1, turn: 'player', is_play_phase: true, enemies: [enemy()] }, build: { game: 'g', mod: 'm' } });
const plan = (state, actions) => ({ observation: stateId(state), summary: 'fixture', note: 'fixture', actions });
test('the player accepts only the exact structured-state sensor contract', () => {
  const compatible = { build: { game: 'g', mod: 'm' }, sensor_version: SENSOR_VERSION };
  assert.equal(assertCompatibleSensor(compatible), compatible);
  assert.throws(() => assertCompatibleSensor({ ...compatible, sensor_version: SENSOR_VERSION - 1 }), /sensor contract mismatch/);
  assert.throws(() => assertCompatibleSensor({ build: compatible.build }), /sensor contract mismatch/);
  assert.throws(() => assertCompatibleSensor({ ...compatible, sensor_error: 'broken' }), /missing or incompatible/);
});
test('continue is permitted only for an explicitly verified resume', () => {
  const menu = { state_type: 'menu', menu_screen: 'main', options: ['continue', 'abandon_run'], build: { game: 'g', mod: 'm' } };
  const continued = plan(menu, [{ type: 'menu_select', option: 'continue' }]);
  assert.throws(() => validatePlan(continued, menu), /only permitted when resuming/);
  assert.doesNotThrow(() => validatePlan(continued, menu, { role: 'strategist', allowContinue: true }));
  assert.throws(() => validatePlan(continued, menu, { role: 'strategist', allowContinue: false }), /only permitted when resuming/);
});

test('a resolved combat selection stays resolved across a later refinement', () => {
  const current = combat([card(133, 0, 'Whirlwind+'), card(135, 1, 'Unrelenting+'), card(136, 2, 'Defend+')]);
  const staleConfirmation = plan(current, [{ type: 'combat_confirm_selection' }]);
  assert.throws(
    () => validatePlan(staleConfirmation, current, { role: 'combat' }),
    /requires an active hand_select; the current observation has none/,
  );
  assert.match(plannerGuidance('combat_confirm_selection requires an active hand_select; the current observation has none'), /hand_select: null/);
  assert.match(plannerGuidance('combat_confirm_selection requires an active hand_select; the current observation has none'), /Do not repeat/);
  const active = { ...current, state_type: 'hand_select', hand_select: { cards: [], can_confirm: true } };
  assert.doesNotThrow(() => validatePlan(plan(active, [{ type: 'combat_confirm_selection' }]), active, { role: 'combat' }));

  const verifiedConfirmation = {
    completed: [{ action: { type: 'combat_confirm_selection' }, verified: true }],
    after: { state_type: 'boss', energy: 3 },
  };
  const timeout = refinementResult('combat exceeded 120-second deadline', 'answer concisely', 1, verifiedConfirmation);
  const rejectedRepeat = refinementResult('combat_confirm_selection requires an active hand_select', 'read the current state', 2, timeout);
  assert.equal(timeout.last_verified_result, verifiedConfirmation);
  assert.equal(rejectedRepeat.last_verified_result, verifiedConfirmation);
});

function fixture(initial, mutate) {
  let state = structuredClone(initial);
  const posts = [];
  const events = [];
  const call = async request => {
    if (request.op === 'sts2-get') return { body: JSON.stringify(state) };
    if (request.op === 'sts2-action') {
      posts.push(structuredClone(request));
      state = mutate(state, request, posts.length);
      return { acknowledgement: { status: 'ok' } };
    }
    throw new Error(`unexpected ${request.op}`);
  };
  const executor = new Executor({ call, record: event => events.push(event), verifyMs: 20, pollMs: 0 });
  executor.sleep = async () => {};
  return { executor, posts, events, state: () => state, set: value => { state = value; } };
}

test('re-reads before every POST and resolves shifted hand indices from stable instance IDs', async () => {
  const initial = combat();
  const f = fixture(initial, (state, request) => {
    const played = state.player.hand[request.params.card_index];
    return { ...state, player: { ...state.player, energy: state.player.energy - 1, hand: state.player.hand.filter(item => item.instance_id !== played.instance_id).map((item, index) => ({ ...item, index })) }, battle: { ...state.battle, enemies: state.battle.enemies.map(item => ({ ...item, hp: item.hp - 6 })) } };
  });
  const result = await f.executor.execute(plan(initial, [{ type: 'play_card', card: 10 }, { type: 'play_card', card: 11 }]), initial);
  assert.equal(result.error, undefined);
  assert.deepEqual(f.posts.map(post => post.params.card_index), [0, 0]);
  assert.equal(result.completed.length, 2);
});
test('does not reject a later card when delayed discard state settles after the prior card', async () => {
  const initial = combat([card(10, 0), card(11, 1)]);
  let state = structuredClone(initial);
  let reads = 0;
  const posts = [];
  const call = async request => {
    if (request.op === 'sts2-get') {
      reads++;
      if (reads === 4) state = { ...state, player: { ...state.player, discard_pile: [card(10, 0)], discard_pile_count: 1 } };
      return { body: JSON.stringify(state) };
    }
    if (request.op === 'sts2-action') {
      posts.push(structuredClone(request));
      const played = state.player.hand[request.params.card_index];
      state = { ...state, player: { ...state.player, energy: state.player.energy - 1, hand: state.player.hand.filter(item => item.instance_id !== played.instance_id).map((item, index) => ({ ...item, index })) }, battle: { ...state.battle, enemies: state.battle.enemies.map(item => ({ ...item, hp: item.hp - 6 })) } };
      return { acknowledgement: { status: 'ok' } };
    }
    throw new Error(`unexpected ${request.op}`);
  };
  const executor = new Executor({ call, verifyMs: 20, pollMs: 0 });
  executor.sleep = async () => {};
  const result = await executor.execute(plan(initial, [{ type: 'play_card', card: 10 }, { type: 'play_card', card: 11 }]), initial);
  assert.equal(result.error, undefined);
  assert.equal(posts.length, 2);
});

test('waits for a delayed next-attack discount before continuing a batch', async () => {
  const initial = combat([
    card(10, 0, 'Unrelenting', { cost: '2', target_type: 'AnyEnemy', description: 'Deal 14 damage. The next Attack you play costs 0.' }),
    card(11, 1, 'Bash', { cost: '2', target_type: 'AnyEnemy' }),
    card(12, 2, 'Strike', { cost: '1', target_type: 'AnyEnemy' }),
  ]);
  let state = structuredClone(initial);
  let reads = 0;
  const posts = [];
  const call = async request => {
    if (request.op === 'sts2-get') {
      reads++;
      if (reads === 4) {
        state = {
          ...state,
          player: {
            ...state.player,
            hand: state.player.hand.map(item => item.instance_id === 11 ? { ...item, cost: '0', can_play: true } : item),
          },
        };
      }
      return { body: JSON.stringify(state) };
    }
    if (request.op === 'sts2-action') {
      posts.push(structuredClone(request));
      const played = state.player.hand[request.params.card_index];
      const energy = played.instance_id === 10 ? 2 : played.instance_id === 11 ? 0 : 1;
      let hand = state.player.hand.filter(item => item.instance_id !== played.instance_id).map((item, index) => ({ ...item, index }));
      if (played.instance_id === 10) hand = hand.map(item => item.instance_id === 11 ? { ...item, can_play: false } : item);
      state = {
        ...state,
        player: { ...state.player, energy: state.player.energy - energy, hand },
        battle: { ...state.battle, enemies: state.battle.enemies.map(item => ({ ...item, hp: item.hp - 6 })) },
      };
      return { acknowledgement: { status: 'ok' } };
    }
    throw new Error(`unexpected ${request.op}`);
  };
  const executor = new Executor({ call, verifyMs: 20, pollMs: 0 });
  executor.sleep = async () => {};
  const result = await executor.execute(plan(initial, [
    { type: 'play_card', card: 10, target: 'JAW_WORM_0' },
    { type: 'play_card', card: 11, target: 'JAW_WORM_0' },
    { type: 'play_card', card: 12, target: 'JAW_WORM_0' },
  ]), initial);
  assert.equal(result.error, undefined);
  assert.equal(posts.length, 3);
  assert.deepEqual(posts.map(post => post.params.card_index), [0, 0, 0]);
});

test('classifies a verified prefix refusal as recoverable without treating unknown writes as safe', async () => {
  const initial = combat([card(10, 0), card(11, 1)]);
  const f = fixture(initial, state => ({
    ...state,
    player: { ...state.player, energy: 0, hand: [{ ...state.player.hand[1], index: 0, can_play: false }], },
  }));
  const result = await f.executor.execute(plan(initial, [{ type: 'play_card', card: 10 }, { type: 'play_card', card: 11 }]), initial);
  assert.equal(f.posts.length, 1);
  assert.equal(hasVerifiedProgress(result), true);
  assert.equal(recoverableSuffixFailure(result), true);
  assert.equal(recoverableSuffixFailure({ ...result, completed: [], failedActionDispatched: true }), false);
  assert.equal(recoverableSuffixFailure({ ...result, code: 'sts2_action_outcome_unknown', failedActionDispatched: true }), false);
});

test('targeted cards carry the observed entity ID and changing targets stops the batch', async () => {
  const initial = combat([card(10, 0, 'Strike', { target_type: 'AnyEnemy' }), card(11, 1)]);
  const f = fixture(initial, state => ({ ...state, player: { ...state.player, hand: [card(11, 0)] }, battle: { ...state.battle, enemies: [] } }));
  const result = await f.executor.execute(plan(initial, [{ type: 'play_card', card: 10, target: 'JAW_WORM_0' }, { type: 'play_card', card: 11 }]), initial);
  assert.equal(f.posts.length, 1);
  assert.equal(f.posts[0].params.target, 'JAW_WORM_0');
  assert.equal(result.completed[0].barrier, 'enemy targets changed');
});

test('still rejects a first action when state changes after the planner snapshot', async () => {
  const initial = combat();
  let reads = 0;
  const posts = [];
  const call = async request => {
    if (request.op === 'sts2-get') {
      reads++;
      const state = reads === 2 ? { ...initial, player: { ...initial.player, energy: 2 } } : initial;
      return { body: JSON.stringify(state) };
    }
    if (request.op === 'sts2-action') posts.push(request);
    throw new Error(`unexpected ${request.op}`);
  };
  const executor = new Executor({ call, verifyMs: 20, pollMs: 0 });
  executor.sleep = async () => {};
  const result = await executor.execute(plan(initial, [{ type: 'end_turn' }]), initial);
  assert.equal(result.code, 'stale_observation');
  assert.equal(result.failedActionDispatched, false);
  assert.equal(posts.length, 0);
});
test('waits for a map destination instead of accepting an in-flight map snapshot', async () => {
  const initial = {
    state_type: 'map',
    run: { act: 1, floor: 1 },
    map: {
      current_position: { col: 3, row: 0, type: 'Ancient' },
      next_options: [{ index: 0, col: 0, row: 1, type: 'Monster' }, { index: 1, col: 4, row: 1, type: 'Monster' }],
    },
    player: { hp: 80, gold: 0, potions: [] },
    build: { game: 'g', mod: 'm' },
  };
  const inFlight = { ...initial, map: { ...initial.map, next_options: [initial.map.next_options[1]] } };
  const destination = { ...initial, map: { ...initial.map, current_position: { col: 0, row: 1, type: 'Monster' }, next_options: [{ index: 0, col: 0, row: 2, type: 'Monster' }] } };
  let phase = 'before';
  const posts = [];
  const call = async request => {
    if (request.op === 'sts2-get') {
      if (phase === 'before') return { body: JSON.stringify(initial) };
      if (phase === 'in_flight') { phase = 'destination'; return { body: JSON.stringify(inFlight) }; }
      return { body: JSON.stringify(destination) };
    }
    if (request.op === 'sts2-action') { posts.push(request); phase = 'in_flight'; return { acknowledgement: { status: 'ok' } }; }
    throw new Error(`unexpected ${request.op}`);
  };
  const executor = new Executor({ call, verifyMs: 20, pollMs: 0 });
  executor.sleep = async () => {};
  const result = await executor.execute(plan(initial, [{ type: 'choose_map_node', node: 'map:0,1' }]), initial);
  assert.equal(result.error, undefined);
  assert.equal(result.completed[0].verified, true);
  assert.equal(result.state.map.current_position.col, 0);
  assert.equal(posts[0].params.index, 0);
});

test('repairs a model-expanded observation token only when it preserves the current ID prefix', () => {
  const initial = combat();
  const expanded = { ...plan(initial, [{ type: 'play_card', card: 10 }]), observation: `${stateId(initial)}-6ce3-4e7a-8178-7e7e68173b5c` };
  const repaired = repairObservation(expanded, initial);
  assert.equal(repaired.observation, stateId(initial));
  assert.doesNotThrow(() => validatePlan(repaired, initial, { role: 'combat' }));
  const stale = { ...expanded, observation: 'deadbeef-6ce3-4e7a-8178-7e7e68173b5c' };
  assert.equal(repairObservation(stale, initial).observation, stale.observation);
});
test('repairs a mixed standalone combat plan without inventing an action', () => {
  const initial = combat();
  const invalid = plan(initial, [{ type: 'play_card', card: 10 }, { type: 'end_turn' }]);
  const repaired = repairPlan(invalid, { role: 'combat' });
  assert.deepEqual(repaired.actions, [{ type: 'play_card', card: 10 }]);
  assert.doesNotThrow(() => validatePlan(repaired, initial, { role: 'combat' }));
  assert.deepEqual(repairPlan({ ...invalid, actions: [{ type: 'end_turn' }, { type: 'play_card', card: 10 }] }, { role: 'combat' }).actions, [{ type: 'end_turn' }]);
  const withNote = { ...invalid, actions: [{ type: 'play_card', card: 10 }, { type: 'end_turn' }, { type: 'learn', path: 'x.md', content: 'x', message: 'x' }] };
  assert.deepEqual(repairPlan(withNote, { role: 'combat' }).actions, [{ type: 'play_card', card: 10 }, { type: 'learn', path: 'x.md', content: 'x', message: 'x' }]);
  const standaloneWithNote = { ...invalid, actions: [{ type: 'end_turn' }, { type: 'learn', path: 'x.md', content: 'x', message: 'x' }] };
  assert.equal(repairPlan(standaloneWithNote, { role: 'combat' }), standaloneWithNote);
});

test('repairs card-reward syntax only when it uniquely identifies the observed generic selection', () => {
  const selection = {
    state_type: 'card_select',
    card_select: {
      cards: [
        { id: 'CRUELTY', is_upgraded: false, instance_id: 222 },
        { id: 'BARRICADE', is_upgraded: false, instance_id: 223 },
      ],
      can_skip: true,
      can_cancel: true,
    },
  };
  const choose = plan(selection, [{ type: 'select_card_reward', card: 'card:CRUELTY:base' }]);
  const repairedChoose = repairPlan(choose, { role: 'strategist', state: selection });
  assert.deepEqual(repairedChoose.actions, [{ type: 'select_card', card: 222 }]);
  assert.doesNotThrow(() => validatePlan(repairedChoose, selection, { role: 'strategist' }));
  const skip = repairPlan(plan(selection, [{ type: 'skip_card_reward' }]), { role: 'strategist', state: selection });
  assert.deepEqual(skip.actions, [{ type: 'cancel_selection' }]);
  assert.doesNotThrow(() => validatePlan(skip, selection, { role: 'strategist' }));

  const reward = { state_type: 'card_reward', card_reward: { cards: [{ id: 'CRUELTY', is_upgraded: false, index: 0 }], can_skip: true } };
  const realRewardPlan = plan(reward, [{ type: 'select_card_reward', card: 'card:CRUELTY:base' }]);
  assert.equal(repairPlan(realRewardPlan, { role: 'strategist', state: reward }), realRewardPlan);
});

test('executes a five-base-energy line when a prior attack discounts the next one', async () => {
  const initial = combat([
    card(10, 0, 'Unrelenting', { cost: '2', target_type: 'AnyEnemy', description: 'Deal 14 damage. The next Attack you play costs 0.' }),
    card(11, 1, 'Bash', { cost: '2', target_type: 'AnyEnemy' }),
    card(12, 2, 'Strike', { cost: '1', target_type: 'AnyEnemy' }),
  ]);
  const f = fixture(initial, (state, request) => {
    const played = state.player.hand[request.params.card_index];
    const energy = played.instance_id === 10 ? 2 : played.instance_id === 11 ? 0 : 1;
    return {
      ...state,
      player: {
        ...state.player,
        energy: state.player.energy - energy,
        hand: state.player.hand.filter(item => item.instance_id !== played.instance_id).map((item, index) => ({
          ...item,
          index,
          ...(played.instance_id === 10 && item.instance_id === 11 ? { cost: '0' } : {}),
        })),
      },
      battle: { ...state.battle, enemies: state.battle.enemies.map(item => ({ ...item, hp: item.hp - 6 })) },
    };
  });
  const result = await f.executor.execute(plan(initial, [
    { type: 'play_card', card: 10, target: 'JAW_WORM_0' },
    { type: 'play_card', card: 11, target: 'JAW_WORM_0' },
    { type: 'play_card', card: 12, target: 'JAW_WORM_0' },
  ]), initial);
  assert.equal(result.error, undefined);
  assert.equal(result.completed.length, 3);
  assert.equal(f.posts.length, 3);
});

test('refuses an unaffordable later card before its POST when no discount exists', async () => {
  const initial = combat([
    card(10, 0, 'Heavy Attack', { cost: '2', target_type: 'AnyEnemy' }),
    card(11, 1, 'Second Heavy Attack', { cost: '2', target_type: 'AnyEnemy' }),
  ]);
  const f = fixture(initial, (state, request) => ({
    ...state,
    player: {
      ...state.player,
      energy: 1,
      hand: state.player.hand.filter(item => item.instance_id !== request.params.card_index + 10).map((item, index) => ({ ...item, index, can_play: false })),
    },
  }));
  const result = await f.executor.execute(plan(initial, [
    { type: 'play_card', card: 10, target: 'JAW_WORM_0' },
    { type: 'play_card', card: 11, target: 'JAW_WORM_0' },
  ]), initial);
  assert.equal(f.posts.length, 1);
  assert.equal(result.completed.length, 1);
  assert.equal(result.failedActionDispatched, false);
  assert.match(result.error, /not currently playable/);
});

test('potion use requires the overlay current-usability flag and an observed target', () => {
  const state = combat();
  state.player.potions = [{ slot: 0, id: 'FIRE_POTION', name: 'Fire Potion', target_type: 'AnyEnemy', can_use: false }];
  assert.throws(() => validatePlan(plan(state, [{ type: 'use_potion', slot: 0, target: 'JAW_WORM_0' }]), state), /not currently usable/);
  state.player.potions[0].can_use = true;
  assert.throws(() => validatePlan(plan(state, [{ type: 'use_potion', slot: 0 }]), state), /unknown potion target/);
  assert.doesNotThrow(() => validatePlan(plan(state, [{ type: 'use_potion', slot: 0, target: 'JAW_WORM_0' }]), state));
});

test('stale observations reject before POST', async () => {
  const initial = combat();
  const f = fixture({ ...initial, player: { ...initial.player, energy: 2 } }, state => state);
  const result = await f.executor.execute(plan(initial, [{ type: 'end_turn' }]), initial);
  assert.equal(result.code, 'stale_observation');
  assert.equal(result.failedActionDispatched, false);
  assert.equal(result.staleState.player.energy, 2);
  assert.equal(f.posts.length, 0);
});

test('an action rejection after dispatch is reported and never followed by another write', async () => {
  const initial = combat();
  let calls = 0;
  const error = Object.assign(new Error('connection lost'), { code: 'sts2_action_outcome_unknown' });
  const executor = new Executor({ call: async request => {
    if (request.op === 'sts2-get') return { body: JSON.stringify(initial) };
    calls++; throw error;
  }, verifyMs: 10, pollMs: 0 });
  const result = await executor.execute(plan(initial, [{ type: 'end_turn' }]), initial);
  assert.equal(calls, 1);
  assert.equal(result.failedActionDispatched, true);
  assert.equal(result.outcomeUnknown, true);
});

test('acknowledgement without an observed postcondition is a failure', async () => {
  const initial = combat();
  const f = fixture(initial, state => state);
  const result = await f.executor.execute(plan(initial, [{ type: 'end_turn' }]), initial);
  assert.match(result.error, /expected state transition/);
  assert.equal(f.posts.length, 1);
});

test('character selection verifies from the structured selected-character field', async () => {
  const initial = { state_type: 'menu', menu_screen: 'character_select', message: 'Select a character.', options: [{ name: 'IRONCLAD', enabled: true }] };
  const f = fixture(initial, state => ({ ...state, selected_character: 'IRONCLAD' }));
  const result = await f.executor.execute(plan(initial, [{ type: 'menu_select', option: 'IRONCLAD' }]), initial);
  assert.equal(result.error, undefined);
  assert.equal(result.completed[0].verified, true);
  assert.equal(result.state.selected_character, 'IRONCLAD');
});
test('accepts an acknowledged character selection already reflected in state', async () => {
  const initial = { state_type: 'menu', menu_screen: 'character_select', selected_character: 'IRONCLAD', message: 'Select a character.', options: [{ name: 'IRONCLAD', enabled: true }] };
  const f = fixture(initial, state => state);
  const result = await f.executor.execute(plan(initial, [{ type: 'menu_select', option: 'IRONCLAD' }]), initial);
  assert.equal(result.error, undefined);
  assert.equal(result.completed[0].verified, true);
  assert.equal(result.state.selected_character, 'IRONCLAD');
});

test('structured model state excludes presentation/navigation data', () => {
  const state = { ...combat(), ui: { elements: [{ id: 'x' }], focus_path: '/x', hotkeys: ['x'] } };
  assert.equal('ui' in compactState(state), false);
});

test('semantic resolver covers every indexed noncombat surface', () => {
  const state = { rewards: { items: [{ index: 4, type: 'gold', gold_amount: 20 }] }, card_reward: { cards: [{ index: 2, id: 'BASH' }] }, event: { options: [{ index: 3, title: 'Enter' }] }, rest_site: { options: [{ index: 5, id: 'smith' }] }, shop: { items: [{ index: 8, category: 'relic', relic_id: 'ANCHOR', price: 150 }] }, map: { next_options: [{ index: 6, col: 2, row: 4 }] }, card_select: { cards: [{ index: 9, instance_id: 99 }] }, bundle_select: { bundles: [{ index: 7, cards: [{ id: 'BASH' }, { id: 'STRIKE' }] }] }, relic_select: { relics: [{ index: 1, id: 'BURNING_BLOOD' }] }, treasure: { relics: [{ index: 2, id: 'ANCHOR' }] } };
  const cases = [
    [{ type: 'claim_reward', reward: semanticIdentity('reward', state.rewards.items[0]) }, 'index', 4],
    [{ type: 'select_card_reward', card: semanticIdentity('card_reward', state.card_reward.cards[0]) }, 'card_index', 2],
    [{ type: 'choose_event_option', option: semanticIdentity('event_option', state.event.options[0]) }, 'index', 3],
    [{ type: 'choose_rest_option', option: semanticIdentity('rest', state.rest_site.options[0]) }, 'index', 5],
    [{ type: 'shop_purchase', item: semanticIdentity('shop_item', state.shop.items[0]) }, 'index', 8],
    [{ type: 'choose_map_node', node: semanticIdentity('map', state.map.next_options[0]) }, 'index', 6],
    [{ type: 'select_card', card: 99 }, 'index', 9],
    [{ type: 'select_bundle', bundle: semanticIdentity('bundle', state.bundle_select.bundles[0]) }, 'index', 7],
    [{ type: 'select_relic', relic: semanticIdentity('relic', state.relic_select.relics[0]) }, 'index', 1],
    [{ type: 'claim_treasure_relic', relic: semanticIdentity('relic', state.treasure.relics[0]) }, 'index', 2],
  ];
  for (const [action, key, index] of cases) assert.equal(resolveMcpAction(action, state).params[key], index, action.type);
  assert.deepEqual(resolveMcpAction({ type: 'shop_back' }, { shop: { can_close_inventory: true } }), { action: 'shop_back', params: {} });
  assert.throws(() => validatePlan(plan({ state_type: 'shop', shop: { can_close_inventory: false } }, [{ type: 'shop_back' }]), { state_type: 'shop', shop: { can_close_inventory: false } }), /cannot be closed/);
  assert.doesNotThrow(() => validatePlan(plan({ state_type: 'shop', shop: { can_close_inventory: true } }, [{ type: 'shop_back' }]), { state_type: 'shop', shop: { can_close_inventory: true } }));
});
test('verified event proceed accepts the map state produced after a transition', async () => {
  const initial = { state_type: 'event', event: { options: [{ index: 0, title: 'Proceed', is_proceed: true }] }, run: { act: 1, floor: 1 }, player: { hp: 80, energy: null, potions: [] }, build: { game: 'g', mod: 'm' } };
  const f = fixture(initial, () => ({ state_type: 'map', map: { next_options: [{ index: 0, col: 0, row: 1 }] }, run: { act: 1, floor: 1 }, player: { hp: 80, energy: null, potions: [] }, build: { game: 'g', mod: 'm' } }));
  const result = await f.executor.execute(plan(initial, [{ type: 'choose_event_option', option: semanticIdentity('event_option', initial.event.options[0]) }]), initial);
  assert.equal(result.error, undefined);
  assert.equal(result.state.state_type, 'map');
  assert.equal(result.completed[0].verified, true);
});

test('validation excludes removed raw and handoff schemas', () => {
  const state = combat();
  for (const action of [{ type: 'intent', goal: 'x', target_label: 'x' }, { type: 'activate', target: 'x' }, { type: 'navigate', target: 'x' }, { type: 'input', buttons: ['a'] }, { type: 'path' }, { type: 'elements' }, { type: 'scout' }]) {
    assert.throws(() => validatePlan(plan(state, [action]), state), /unknown action/);
  }
  assert.throws(() => validatePlan(plan(state, [{ type: 'play_card', card: 10, target_label: 'first enemy' }]), state), /not an allowed plan field/);
});

const mapScreen = () => ({
  state_type: 'map', run: { act: 1, floor: 5 },
  player: { hp: 70, gold: 99, potions: [], relics: [{ id: 'BURNING_BLOOD', name: 'Burning Blood', counter: 0 }] },
  map: { current_position: { col: 1, row: 4 }, next_options: [{ col: 2, row: 4, type: 'monster' }, { col: 2, row: 5, type: 'event' }] },
  build: { game: 'g', mod: 'm' },
});

test('a plan is stale only when something it reads has moved', () => {
  const before = mapScreen();
  const route = plan(before, [{ type: 'choose_map_node', node: 'map:2,4' }]);

  const relicTicked = mapScreen();
  relicTicked.player.relics[0].counter = 3;
  assert.equal(planIdentity(before, route), planIdentity(relicTicked, route));
  // The same churn still moves the whole-state digest, which is what used to
  // throw the plan away.
  assert.notEqual(stateId(before), stateId(relicTicked));

  const rerouted = mapScreen();
  rerouted.map.next_options[0].row = 7;
  assert.notEqual(planIdentity(before, route), planIdentity(rerouted, route));

  const hurt = mapScreen();
  hurt.player.hp = 60;
  assert.notEqual(planIdentity(before, route), planIdentity(hurt, route));
});

test('combat plans ignore the piles they are never shown but not the resources they spend', () => {
  const settled = combat();
  settled.player.discard_pile = [card(1, 0), card(2, 1)];
  const drawn = combat();
  drawn.player.discard_pile = [card(1, 0)];
  const ending = plan(settled, [{ type: 'end_turn' }]);
  assert.equal(planIdentity(settled, ending), planIdentity(drawn, ending));

  const refunded = combat();
  refunded.player.discard_pile = [card(1, 0), card(2, 1)];
  refunded.player.energy = 2;
  assert.notEqual(planIdentity(settled, ending), planIdentity(refunded, ending));
});

test('a plan that reads nothing still compares the whole screen', () => {
  const quiet = combat();
  quiet.player.discard_pile = [card(1, 0)];
  const noisy = combat();
  noisy.player.discard_pile = [card(1, 0), card(2, 1)];
  const complaint = { observation: stateId(quiet), summary: 'fixture', note: 'fixture', actions: [{ type: 'report_issue', issue: 'the screen does not match' }] };
  assert.notEqual(planIdentity(quiet, complaint), planIdentity(noisy, complaint));
  assert.equal(planIdentity(quiet), planIdentity(quiet, complaint));
});

test('churn the plan never reads does not cost the dispatch', async () => {
  const initial = mapScreen();
  const posts = [];
  let reads = 0;
  const call = async request => {
    if (request.op === 'sts2-get') {
      reads++;
      const state = structuredClone(initial);
      // The relic ticks between the planner's snapshot and the dispatch.
      if (reads >= 2) state.player.relics[0].counter = 3;
      if (posts.length) state.map.current_position = { col: 2, row: 4 };
      return { body: JSON.stringify(state) };
    }
    if (request.op === 'sts2-action') { posts.push(structuredClone(request)); return { acknowledgement: { status: 'ok' } }; }
    throw new Error(`unexpected ${request.op}`);
  };
  const executor = new Executor({ call, verifyMs: 20, pollMs: 0 });
  executor.sleep = async () => {};
  const result = await executor.execute(plan(initial, [{ type: 'choose_map_node', node: 'map:2,4' }]), initial);
  assert.equal(result.error, undefined);
  assert.equal(result.code, undefined);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].params.index, 0);
});

test('a rejected identity is told to copy the one the screen published', () => {
  for (const message of ['unknown reward', 'unknown shop item', 'unknown event option', 'unknown rest option', 'unknown map node', 'unknown relic']) {
    assert.match(plannerGuidance(message), /semantic_id of the observed item exactly/);
  }
  // The card_reward family keeps its own more specific guidance.
  assert.match(plannerGuidance('unknown card reward'), /Match the action to state_type/);
  assert.match(plannerGuidance('summary must be at most 300 characters'), /Fix exactly what this message names/);
});

test('thinking is spent on the screens that commit the run', () => {
  assert.equal(reasoningTier(combat(), 'combat'), 'max');
  assert.equal(reasoningTier({ state_type: 'elite', player: { hand: [] }, battle: { turn: 'player' } }, 'strategist'), 'max');
  for (const state_type of ['shop', 'card_reward', 'card_select', 'rest_site', 'event']) {
    assert.equal(reasoningTier({ state_type }, 'strategist'), 'medium');
  }
  for (const state_type of ['map', 'rewards', 'menu', 'treasure']) {
    assert.equal(reasoningTier({ state_type }, 'strategist'), 'low');
  }
});
