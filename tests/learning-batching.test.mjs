import test from 'node:test';
import assert from 'node:assert/strict';
import { Executor, resolveMcpAction } from '../client/learning/executor.mjs';
import { compactState, semanticIdentity, stateId, validatePlan } from '../client/learning/state.mjs';

const card = (instance_id, index, name = `Card ${instance_id}`, extra = {}) => ({ instance_id, index, id: name.toUpperCase().replaceAll(' ', '_'), name, cost: '1', target_type: 'None', can_play: true, description: 'Deal 6 damage.', ...extra });
const enemy = (entity_id = 'JAW_WORM_0') => ({ entity_id, combat_id: 0, name: 'Jaw Worm', hp: 40, block: 0 });
const combat = (hand = [card(10, 0), card(11, 1)]) => ({ state_type: 'monster', run: { act: 1, floor: 1 }, player: { hp: 80, energy: 3, hand, potions: [] }, battle: { round: 1, turn: 'player', is_play_phase: true, enemies: [enemy()] }, build: { game: 'g', mod: 'm' } });
const plan = (state, actions) => ({ observation: stateId(state), summary: 'fixture', note: 'fixture', actions });

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

test('revalidates a later card against live playability before POST', async () => {
  const initial = combat([card(10, 0, 'Setup', { cost: '0' }), card(11, 1, 'Follow Up', { cost: '0' })]);
  const f = fixture(initial, state => ({
    ...state,
    player: { ...state.player, hand: [{ ...state.player.hand[1], index: 0, can_play: false }] },
  }));
  const result = await f.executor.execute(plan(initial, [{ type: 'play_card', card: 10 }, { type: 'play_card', card: 11 }]), initial);
  assert.equal(f.posts.length, 1);
  assert.equal(result.completed.length, 1);
  assert.equal(result.failedActionDispatched, false);
  assert.match(result.error, /not currently playable/);
});

test('targeted cards carry the observed entity ID and changing targets stops the batch', async () => {
  const initial = combat([card(10, 0, 'Strike', { target_type: 'AnyEnemy' }), card(11, 1)]);
  const f = fixture(initial, state => ({ ...state, player: { ...state.player, hand: [card(11, 0)] }, battle: { ...state.battle, enemies: [] } }));
  const result = await f.executor.execute(plan(initial, [{ type: 'play_card', card: 10, target: 'JAW_WORM_0' }, { type: 'play_card', card: 11 }]), initial);
  assert.equal(f.posts.length, 1);
  assert.equal(f.posts[0].params.target, 'JAW_WORM_0');
  assert.equal(result.completed[0].barrier, 'enemy targets changed');
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
});

test('validation excludes removed raw and handoff schemas', () => {
  const state = combat();
  for (const action of [{ type: 'intent', goal: 'x', target_label: 'x' }, { type: 'activate', target: 'x' }, { type: 'navigate', target: 'x' }, { type: 'input', buttons: ['a'] }, { type: 'path' }, { type: 'elements' }, { type: 'scout' }]) {
    assert.throws(() => validatePlan(plan(state, [action]), state), /unknown action/);
  }
  assert.throws(() => validatePlan(plan(state, [{ type: 'play_card', card: 10, target_label: 'first enemy' }]), state), /not an allowed plan field/);
});
