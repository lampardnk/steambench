import test from 'node:test';
import assert from 'node:assert/strict';
import { SystemOne, SystemOneUnavailable, choice, noul } from '../client/learning/systemone.mjs';
import { aspectQuestions, bucket, cascade, flatChoice, optionCriteria, readAspects } from '../client/learning/cascade.mjs';
import { SURFACES, surfaceFor } from '../client/learning/surfaces.mjs';
import { forcedMove, semanticIdentity, validatePlan, stateId } from '../client/learning/state.mjs';
import { rerank } from '../client/learning/retrieval.mjs';

const CONFIG = { baseUrl: 'https://example.invalid/decisions', model: 'pinned-model-1.0', apiKeyEnv: 'TEST_KEY', deadlineMs: 500, maxAttempts: 3 };
const env = { TEST_KEY: 'secret' };

/** A fetch that records what it was sent and replays a scripted response list. */
function stubFetch(responses) {
  const sent = [];
  const queue = [...responses];
  const impl = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return {
      ok: next.status === undefined || next.status === 200,
      status: next.status ?? 200,
      json: async () => next.body,
      text: async () => JSON.stringify(next.body ?? ''),
    };
  };
  return { impl, sent };
}
const answered = (answers) => ({ body: { model: CONFIG.model, answers, usage: { input_tokens: 10, output_tokens: 2, cost: 0.000001 } } });

test('the pinned model id is sent, never an alias', async () => {
  const { impl, sent } = stubFetch([answered({ q: { type: 'noul', noul: 0.9 } })]);
  const one = new SystemOne({ env, fetchImpl: impl, config: CONFIG });
  await one.ask({ state: 'x', questions: { q: noul('is it so') } });
  assert.equal(sent[0].body.model, 'pinned-model-1.0');
  assert.equal(sent[0].auth, 'Bearer secret');
});

test('an absent key makes the model unavailable rather than failing the run', async () => {
  const one = new SystemOne({ env: {}, fetchImpl: async () => assert.fail('must not call out'), config: CONFIG });
  assert.equal(one.available, false);
  await assert.rejects(() => one.ask({ state: 'x', questions: { q: noul('anything') } }), SystemOneUnavailable);
});

test('a transient outage is retried and then surrendered to the planner', async () => {
  const { impl, sent } = stubFetch([{ status: 502, body: 'bad gateway' }, { status: 502, body: 'bad gateway' }, answered({ q: { type: 'noul', noul: 0.7 } })]);
  const one = new SystemOne({ env, fetchImpl: impl, config: CONFIG });
  assert.equal((await one.ask({ state: 'x', questions: { q: noul('is it so') } })).answers.q.noul, 0.7);
  assert.equal(sent.length, 3);

  const exhausted = stubFetch([{ status: 502, body: 'x' }, { status: 502, body: 'x' }, { status: 502, body: 'x' }]);
  const two = new SystemOne({ env, fetchImpl: exhausted.impl, config: CONFIG });
  await assert.rejects(() => two.ask({ state: 'x', questions: { q: noul('is it so') } }), SystemOneUnavailable);
  assert.equal(exhausted.sent.length, 3);
});

test('a rejected body is not retried, because retrying cannot fix it', async () => {
  const { impl, sent } = stubFetch([{ status: 422, body: 'malformed question' }]);
  const one = new SystemOne({ env, fetchImpl: impl, config: CONFIG });
  await assert.rejects(() => one.ask({ state: 'x', questions: { q: noul('is it so') } }), /422/);
  assert.equal(sent.length, 1);
});

test('usage is billed to the lane that spent it, with its real cost', async () => {
  const emitted = [];
  const { impl } = stubFetch([answered({ q: { type: 'noul', noul: 0.5 } })]);
  const one = new SystemOne({ env, fetchImpl: impl, config: CONFIG, emit: (event) => emitted.push(event) });
  await one.ask({ state: 'x', questions: { q: noul('is it so') }, agent: 'combat-3', role: 'systemone' });
  const [usage] = emitted.filter(event => event.type === 'steambench_usage');
  assert.equal(usage.agent, 'combat-3');
  assert.equal(usage.usage.input, 10);
  assert.equal(usage.usage.cost, 0.000001);
});

test('probabilities become words before a second call ever sees them', () => {
  assert.equal(bucket(0.92), 'almost certainly yes');
  assert.equal(bucket(0.5), 'unclear');
  assert.equal(bucket(0.02), 'almost certainly no');
  assert.equal(bucket(undefined), 'not assessed');
  const options = [{ id: 'a', label: 'Aye' }, { id: 'b', label: 'Bee' }];
  const shape = { id: (o) => o.id, name: (o) => o.label };
  const answers = { 'a::keen': { noul: 0.95 }, 'b::keen': { noul: 0.05 } };
  const digest = readAspects(answers, options, { keen: 'is it keen' }, shape);
  assert.deepEqual(digest, [{ option: 'Aye', keen: 'almost certainly yes' }, { option: 'Bee', keen: 'almost certainly no' }]);
  // No raw probability may survive into the layer-2 state.
  assert.ok(!JSON.stringify(digest).match(/0\.\d/));
});

test('a Choice can only answer with an identity the screen published', async () => {
  const options = [{ semantic_id: 'reward:one' }, { semantic_id: 'reward:two' }];
  const criteria = optionCriteria(options, { id: (o) => o.semantic_id, describe: (o) => o.semantic_id });
  assert.deepEqual(Object.keys(criteria), ['reward:one', 'reward:two']);
  const { impl, sent } = stubFetch([answered({ pick: { type: 'choice', choice: 'reward:two', confidence: 0.8, probabilities: {} } })]);
  const one = new SystemOne({ env, fetchImpl: impl, config: CONFIG });
  const result = await flatChoice({ systemOne: one, state: {}, options, id: (o) => o.semantic_id, describe: (o) => o.semantic_id, instructions: 'which' });
  assert.equal(result.id, 'reward:two');
  assert.deepEqual(Object.keys(sent[0].body.questions.pick.criteria), ['reward:one', 'reward:two']);
});

test('the cascade asks every option about every aspect in one call, then decides over the words', async () => {
  const options = [{ id: 'x', label: 'Ex' }, { id: 'y', label: 'Why' }];
  const aspects = { keen: 'is it keen', cheap: 'is it cheap' };
  assert.equal(Object.keys(aspectQuestions(options, aspects, { id: (o) => o.id, name: (o) => o.label })).length, 4);
  const { impl, sent } = stubFetch([
    answered({ 'x::keen': { noul: 0.9 }, 'x::cheap': { noul: 0.1 }, 'y::keen': { noul: 0.2 }, 'y::cheap': { noul: 0.95 } }),
    answered({ pick: { type: 'choice', choice: 'x', confidence: 0.66, probabilities: {} } }),
  ]);
  const one = new SystemOne({ env, fetchImpl: impl, config: CONFIG });
  const result = await cascade({
    systemOne: one, state: { some: 'state' }, situation: { hp: 10 }, options, aspects,
    id: (o) => o.id, name: (o) => o.label, describe: (o) => o.label, instructions: 'which',
  });
  assert.equal(sent.length, 2);
  assert.equal(Object.keys(sent[0].body.questions).length, 4);
  // Layer 2 reads the assessments, not the original state.
  assert.deepEqual(sent[1].body.state.assessments, [{ option: 'Ex', keen: 'almost certainly yes', cheap: 'almost certainly no' }, { option: 'Why', keen: 'probably no', cheap: 'almost certainly yes' }]);
  assert.equal(sent[1].body.state.some, undefined);
  assert.equal(result.id, 'x');
  assert.equal(result.confidence, 0.66);
});

test('a screen with nothing to choose between has no surface', () => {
  const base = { run: { act: 1, floor: 4 }, player: { hp: 40, max_hp: 75, relics: [] }, deck: [] };
  assert.equal(surfaceFor({ ...base, state_type: 'map', map: { next_options: [{ col: 1, row: 2, type: 'Monster' }] } }), null);
  assert.equal(surfaceFor({ ...base, state_type: 'monster' }), null);
  const two = surfaceFor({ ...base, state_type: 'map', map: { next_options: [{ col: 1, row: 2, type: 'Monster' }, { col: 3, row: 2, type: 'RestSite' }] } });
  assert.equal(two.mode, 'gate');
  assert.equal(two.resolved.length, 2);
});

test('deck-building annotates and never gates, because its confidence runs backwards', () => {
  // Measured: 6/12 agreement when confident against 3/3 when not. A gate there
  // would act on exactly the picks it got wrong.
  assert.equal(SURFACES.card_reward.mode, 'annotate');
  assert.equal(SURFACES.shop.mode, 'annotate');
  assert.equal(SURFACES.card_reward.threshold, undefined);
  // Reward claiming was measured and dropped: the gate fired twice and was
  // wrong both times, so the screen has no surface at all.
  assert.equal(SURFACES.rewards, undefined);
  // Navigation is the opposite case and is allowed to act.
  assert.equal(SURFACES.map.mode, 'gate');
  assert.ok(SURFACES.map.threshold > 0);
});

test('a forced move is a real plan the validator accepts', () => {
  const state = {
    state_type: 'map', run: { act: 1, floor: 3 }, player: { hp: 40, max_hp: 75 },
    map: { next_options: [{ col: 2, row: 3, type: 'Monster' }] }, build: { game: 'g', mod: 'm' },
  };
  const forced = forcedMove(state);
  assert.deepEqual(forced, { type: 'choose_map_node', node: semanticIdentity('map', state.map.next_options[0]) });
  const plan = { observation: stateId(state), summary: 'only one option', actions: [forced] };
  assert.equal(validatePlan(plan, state, { role: 'strategist' }), plan);
});

test('a screen that still has a real alternative is never forced', () => {
  const base = { run: { act: 1, floor: 3 }, player: { hp: 40, max_hp: 75 }, build: { game: 'g', mod: 'm' } };
  const one = { next_options: [{ col: 2, row: 3, type: 'Monster' }] };
  assert.equal(forcedMove({ ...base, state_type: 'map', map: { next_options: [{ col: 1, row: 2 }, { col: 3, row: 2 }] } }), null);
  // Both of these were taken from the run, where the player did the other
  // thing: drank a potion rather than walking on, and proceeded past a reward
  // rather than claiming it.
  assert.equal(forcedMove({ ...base, state_type: 'map', map: one, player: { ...base.player, potions: [{ slot: 0, name: 'Flex Potion', can_use: true }] } }), null);
  assert.ok(forcedMove({ ...base, state_type: 'map', map: one, player: { ...base.player, potions: [] } }));
  assert.equal(forcedMove({ ...base, state_type: 'rewards', rewards: { items: [{ type: 'potion', potion_id: 'FLEX' }], can_proceed: true } }), null);
  assert.ok(forcedMove({ ...base, state_type: 'rewards', rewards: { items: [{ type: 'potion', potion_id: 'FLEX' }], can_proceed: false } }));
  // Resting always has declining as an alternative, so it is left to a decision.
  assert.equal(forcedMove({ ...base, state_type: 'rest_site', rest_site: { options: [{ id: 'rest', name: 'Rest' }] } }), null);
  // Dialogue is not an option list.
  assert.equal(forcedMove({ ...base, state_type: 'event', event: { in_dialogue: true, options: [{ name: 'go on' }] } }), null);
});

test('reranking reorders the shortlist and can never admit an unvetted note', async () => {
  const ranked = [
    { note: { path: 'a.md', description: 'about shops' } },
    { note: { path: 'b.md', description: 'about the Wriggler' } },
    { note: { path: 'c.md', description: 'about rest sites' } },
  ];
  const { impl } = stubFetch([answered({ n0: { noul: 0.1 }, n1: { noul: 0.97 }, n2: { noul: 0.3 } })]);
  const one = new SystemOne({ env, fetchImpl: impl, config: CONFIG });
  const out = await rerank(ranked, { state_type: 'monster', battle: { enemies: [{ name: 'Wriggler' }] } }, { systemOne: one });
  assert.deepEqual(out.map(item => item.note.path), ['b.md', 'c.md', 'a.md']);
  assert.equal(out.length, ranked.length);
});

test('an unavailable reranker leaves the lexical order exactly as it was', async () => {
  const ranked = [{ note: { path: 'a.md', description: 'one' } }, { note: { path: 'b.md', description: 'two' } }];
  const down = new SystemOne({ env, fetchImpl: async () => { throw new Error('502'); }, config: CONFIG });
  assert.deepEqual((await rerank(ranked, { state_type: 'map' }, { systemOne: down })).map(i => i.note.path), ['a.md', 'b.md']);
  const absent = new SystemOne({ env: {}, fetchImpl: async () => assert.fail('must not call out'), config: CONFIG });
  assert.deepEqual((await rerank(ranked, { state_type: 'map' }, { systemOne: absent })).map(i => i.note.path), ['a.md', 'b.md']);
});

test('retries share one budget, so a fast path can never outlast the planner it saves', async () => {
  // Three attempts at the full deadline would spend longer than the planner
  // call this is trying to avoid. The budget covers the whole ask, so once it
  // is gone no further attempt is made however many remain.
  const { impl, sent } = stubFetch([{ status: 502, body: 'x' }, { status: 502, body: 'x' }, { status: 502, body: 'x' }, { status: 502, body: 'x' }]);
  const one = new SystemOne({ env, fetchImpl: impl, config: { ...CONFIG, deadlineMs: 200, maxAttempts: 4 } });
  const started = Date.now();
  await assert.rejects(() => one.ask({ state: 'x', questions: { q: noul('is it so') } }), SystemOneUnavailable);
  assert.ok(sent.length < 4, `the budget must stop retrying; made ${sent.length} of 4 attempts`);
  assert.ok(Date.now() - started < 1000, 'the whole ask respects one deadline, not one per attempt');
});

test('a selection screen that publishes no selection state verifies on acknowledgement', async () => {
  // Taken from room 024de76b decisions 36 and 37, where the screenshots showed
  // the card correctly selected while the observation stayed byte-identical.
  const { Executor } = await import('../client/learning/executor.mjs');
  const cards = [{ instance_id: 24, index: 0, name: 'Strike' }, { instance_id: 31, index: 5, name: 'Shrug It Off' }];
  const screen = {
    state_type: 'card_select', run: { act: 1, floor: 4 }, player: { hp: 49, max_hp: 80 },
    card_select: { cards, can_confirm: true, can_cancel: false, screen_type: 'NCombatPileCardSelectScreen', preview_showing: false },
    build: { game: 'g', mod: 'm' }, sensor_version: 8,
  };
  const posts = [];
  const executor = new Executor({
    call: async (request) => {
      if (request.op === 'sts2-get') return { body: JSON.stringify(screen) };
      posts.push(request);
      return { body: JSON.stringify({ ok: true }) };
    },
    verifyMs: 300, pollMs: 20,
  });
  const plan = { observation: stateId(screen), summary: 'pick one', actions: [{ type: 'select_card', card: 24 }] };
  const result = await executor.execute(plan, screen, { role: 'strategist', agent: 'strategist', decision: 1 });
  assert.equal(result.error, undefined, `select_card must not fail verification: ${result.error}`);
  assert.equal(result.completed.length, 1);
  assert.equal(result.completed[0].verified, true);
  assert.equal(posts.length, 1);
});

test('once selection state is published, it is verified rather than assumed', async () => {
  const { Executor } = await import('../client/learning/executor.mjs');
  // The same screen, but the mod now reports which card is selected - and it
  // reports the wrong one, so acknowledgement must no longer be enough.
  const cards = [{ instance_id: 24, index: 0, name: 'Strike', selected: false }, { instance_id: 31, index: 5, name: 'Shrug It Off', selected: true }];
  const screen = {
    state_type: 'card_select', run: { act: 1, floor: 4 }, player: { hp: 49, max_hp: 80 },
    card_select: { cards, can_confirm: true, can_cancel: false, screen_type: 'NCombatPileCardSelectScreen', preview_showing: false },
    build: { game: 'g', mod: 'm' }, sensor_version: 8,
  };
  const executor = new Executor({
    call: async (request) => (request.op === 'sts2-get' ? { body: JSON.stringify(screen) } : { body: JSON.stringify({ ok: true }) }),
    verifyMs: 200, pollMs: 20,
  });
  const plan = { observation: stateId(screen), summary: 'pick one', actions: [{ type: 'select_card', card: 24 }] };
  const result = await executor.execute(plan, screen, { role: 'strategist', agent: 'strategist', decision: 1 });
  assert.match(String(result.error), /transition was not observed/);
});

test('claiming a potion with a full belt is refused before dispatch', async () => {
  // Room 024de76b decision 265: STS2MCP accepted the claim, nothing happened,
  // and the run paused for an operator. max_potion_slots makes it knowable.
  const { plannerGuidance } = await import('../client/learning/state.mjs');
  const potion = (slot, id) => ({ id, name: id, slot, can_use: true });
  const reward = { index: 0, type: 'potion', description: "Gambler's Brew", potion_id: 'GAMBLERS_BREW' };
  const screen = (potions) => ({
    state_type: 'rewards', run: { act: 2, floor: 19 },
    player: { hp: 73, max_hp: 80, gold: 170, max_potion_slots: 3, potions },
    rewards: { items: [reward], can_proceed: true }, build: { game: 'g', mod: 'm' },
  });
  const full = screen([potion(0, 'FYSH_OIL'), potion(1, 'POWER_POTION'), potion(2, 'HEART_OF_IRON')]);
  const plan = (state) => ({ observation: stateId(state), summary: 'take it', actions: [{ type: 'claim_reward', reward: semanticIdentity('reward', reward) }] });
  assert.throws(() => validatePlan(plan(full), full, { role: 'strategist' }), /potion belt is full/);
  // The guidance names both ways out, because both are legal here.
  assert.match(plannerGuidance('the potion belt is full, so this potion cannot be claimed'), /discard_potion/);
  assert.match(plannerGuidance('the potion belt is full, so this potion cannot be claimed'), /proceed/);
  // A free slot still claims, and a non-potion reward is never blocked.
  const room = screen([potion(0, 'FYSH_OIL')]);
  assert.equal(validatePlan(plan(room), room, { role: 'strategist' }).actions.length, 1);
  const gold = { index: 0, type: 'gold', amount: 25 };
  const goldScreen = { ...full, rewards: { items: [gold], can_proceed: true } };
  const goldPlan = { observation: stateId(goldScreen), summary: 'take it', actions: [{ type: 'claim_reward', reward: semanticIdentity('reward', gold) }] };
  assert.equal(validatePlan(goldPlan, goldScreen, { role: 'strategist' }).actions.length, 1);
});
