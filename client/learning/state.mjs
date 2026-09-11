import crypto from 'node:crypto';
import { PROFILE } from './profile.mjs';

export const VERSION = PROFILE.checkpointVersion;
export const SENSOR_VERSION = 8;
export const digest = value => crypto.createHash('sha256').update(JSON.stringify(value) ?? 'null').digest('hex').slice(0, 16);

const contentIdentity = value => {
  if (Array.isArray(value)) return value.map(contentIdentity);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['index', 'semantic_id', 'keywords'].includes(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => [key, contentIdentity(nested)]));
};
export function semanticIdentity(kind, item) {
  if (!item || typeof item !== 'object') return null;
  if (item.semantic_id != null) return item.semantic_id;
  if (kind === 'map') return Number.isInteger(item.col) && Number.isInteger(item.row) ? `map:${item.col},${item.row}` : null;
  if (kind === 'rest') return item.id != null ? `rest:${item.id}` : null;
  if (kind === 'card') return Number.isInteger(item.instance_id) ? item.instance_id : null;
  if (kind === 'card_reward') return item.id ? `card:${item.id}:${item.is_upgraded === true ? 'upgraded' : 'base'}` : null;
  if (kind === 'relic') return item.id ? `relic:${item.id}` : null;
  return `${kind}:${digest(contentIdentity(item))}`;
}

function addSemanticIdentities(state) {
  const result = { ...state };
  const annotate = (owner, field, kind) => {
    if (!Array.isArray(owner?.[field])) return owner;
    return { ...owner, [field]: owner[field].map(item => ({ ...item, semantic_id: semanticIdentity(kind, item) })) };
  };
  result.rewards = annotate(result.rewards, 'items', 'reward');
  result.card_reward = annotate(result.card_reward, 'cards', 'card_reward');
  result.event = annotate(result.event, 'options', 'event_option');
  result.rest_site = annotate(result.rest_site, 'options', 'rest');
  result.shop = annotate(result.shop, 'items', 'shop_item');
  if (result.fake_merchant?.shop) result.fake_merchant = { ...result.fake_merchant, shop: annotate(result.fake_merchant.shop, 'items', 'shop_item') };
  result.map = annotate(result.map, 'next_options', 'map');
  result.card_select = annotate(result.card_select, 'cards', 'card');
  result.hand_select = annotate(result.hand_select, 'cards', 'card');
  result.bundle_select = annotate(result.bundle_select, 'bundles', 'bundle');
  result.relic_select = annotate(result.relic_select, 'relics', 'relic');
  result.treasure = annotate(result.treasure, 'relics', 'relic');
  return result;
}

export function settleAnimation(state) {
  const select = state?.card_select;
  if (!(select?.screen_type === 'transform' && select.preview_showing && Array.isArray(select.preview_cards))) return state;
  const [chosen] = select.preview_cards;
  return { ...state, card_select: { ...select, preview_cards: chosen ? [{ ...chosen, role: 'chosen_card' }] : [], random_result_preview: 'the continuously rolling preview is omitted because it does not determine the result' } };
}

/** Structured STS2MCP state is the sole model-visible game interface. */
export function compactState(value) {
  const state = settleAnimation(value);
  const { ui, ...withoutUi } = state || {};
  const result = addSemanticIdentities(withoutUi);
  if (result.player) {
    result.player = { ...result.player };
    for (const pile of ['hand', 'draw_pile', 'discard_pile', 'exhaust_pile']) result.player[pile] = result.player[pile]?.map(({ keywords, ...card }) => card);
  }
  if (Array.isArray(result.deck)) {
    const cards = new Map();
    for (const { keywords, ...card } of result.deck) {
      const key = digest(card);
      if (cards.has(key)) cards.get(key).count++;
      else cards.set(key, { ...card, count: 1 });
    }
    result.deck = [...cards.values()];
  }
  return result;
}

export function stateId(state) { return digest(compactState(state)).slice(0, 8); }
// Models occasionally expand the eight-character observation token into a UUID-like
// value after copying the correct prefix. Keep validation strict, but repair only
// that exact-current-prefix form; an unrelated or malformed prefix remains stale.
export function repairObservation(plan, state) {
  const expected = stateId(state);
  const observed = String(plan?.observation ?? '').trim().toLowerCase();
  if (observed === expected || !observed.startsWith(`${expected}-`) || !/^[0-9a-f?\.\-]+$/.test(observed.slice(expected.length + 1))) return plan;
  return { ...plan, observation: expected };
}
export function progressId(state) { return digest(compactState(state)); }
export function planIdentity(state) { return progressId(state); }
export function mapId(state) { return state?.state_type === 'map' ? digest(state.map) : null; }
export function isCombat(state) { return Boolean(state?.battle && Array.isArray(state.player?.hand)); }
export function isCardPlay(state) { return isCombat(state) && !/select|overlay|reward/.test(state.state_type); }
export function uncertainCard(card) { return /random|discover|choose|draw|discard|exhaust|transform|create|add .*hand|shuffle/i.test(`${card?.description || ''} ${card?.keywords?.map(k => k.name).join(' ') || ''}`); }
export function ready(state) {
  if (!state || typeof state.state_type !== 'string' || state.state_type === 'unknown') return false;
  if (isCombat(state)) return /select|overlay|reward/.test(state.state_type) || (state.battle?.is_play_phase === true && state.battle?.turn === 'player');
  switch (state.state_type) {
    case 'menu': return Array.isArray(state.options || state.menu?.options) && (state.options || state.menu.options).length > 0;
    case 'map': return Array.isArray(state.map?.next_options) && state.map.next_options.length > 0;
    case 'event': return state.event?.in_dialogue === true || (Array.isArray(state.event?.options) && state.event.options.length > 0);
    case 'rest_site': return (state.rest_site?.options?.length || 0) > 0 || state.rest_site?.can_proceed === true;
    case 'shop': return !state.shop?.error && ((state.shop?.items?.length || 0) > 0 || state.shop?.can_proceed === true);
    case 'fake_merchant': return !state.fake_merchant?.shop?.error && ((state.fake_merchant?.shop?.items?.length || 0) > 0 || state.fake_merchant?.shop?.can_proceed === true);
    case 'rewards': return (state.rewards?.items?.length || 0) > 0 || state.rewards?.can_proceed === true;
    case 'card_reward': return (state.card_reward?.cards?.length || 0) > 0;
    case 'treasure': return (state.treasure?.relics?.length || 0) > 0 || state.treasure?.can_proceed === true;
    case 'card_select': return (state.card_select?.cards?.length || 0) > 0 || state.card_select?.can_confirm === true || state.card_select?.can_cancel === true;
    case 'bundle_select': return (state.bundle_select?.bundles?.length || 0) > 0 || state.bundle_select?.can_confirm === true || state.bundle_select?.can_cancel === true;
    case 'relic_select': return (state.relic_select?.relics?.length || 0) > 0 || state.relic_select?.can_skip === true;
    case 'crystal_sphere': return Array.isArray(state.crystal_sphere?.cells);
    default: return true;
  }
}
export function unbuiltMenu(state) { return state?.state_type === 'menu' && !Array.isArray(state.options) && !Array.isArray(state.menu?.options); }
export function leftMap() { return false; }
export function focusIdentity() { return null; }
export function needsScreenshot() { return false; }

export function situationKey(state) {
  const compact = compactState(state);
  return [compact.run, compact.state_type, compact.player?.hp, compact.player?.gold, compact.player?.relics, compact.player?.potions, compact.player?.hand, compact.map?.current_position, compact.map?.next_options, compact.rewards, compact.card_reward, compact.card_select, compact.hand_select, compact.bundle_select, compact.relic_select, compact.treasure, compact.event, compact.rest_site, compact.shop, compact.crystal_sphere];
}
export function situationId(state) { return digest(situationKey(state)); }
export function stallReason(situations, window, distinct) {
  if (situations.length < window) return null;
  const seen = new Set(situations.slice(-window)).size;
  return seen < distinct ? seen : null;
}

const DIFF_FIELDS = [
  ['state_type', state => state?.state_type], ['menu_screen', state => state?.menu_screen ?? null],
  ['act', state => state?.run?.act ?? null], ['floor', state => state?.run?.floor ?? null],
  ['hp', state => state?.player?.hp ?? null], ['gold', state => state?.player?.gold ?? null],
  ['energy', state => state?.player?.energy ?? null], ['turn', state => state?.battle?.turn ?? null],
  ['round', state => state?.battle?.round ?? null],
];
export function stateDiff(before, after) { return Object.fromEntries(DIFF_FIELDS.flatMap(([name, read]) => read(before) === read(after) ? [] : [[name, { was: read(before), now: read(after) }]])); }
export function plannerResult(result) {
  return { completed: result.completed, ...(result.code === 'stale_observation' ? { replan: 'Observation changed before execution. Zero actions dispatched; use fresh state.', no_input_sent: true } : { error: result.error }), after: result.state ? { state_type: result.state.state_type, run: result.state.run, energy: result.state.player?.energy, map_id: mapId(result.state) } : null };
}

const MOMENT_IN_PATH = /(?:^|[/_-])(?:floor|round|turn|decision|seed)-?\d/;
const OUT_OF_BUDGET = /exceeded [\d.]+-second deadline|stop reason length|empty \w+ response/;
const STANDALONE_PLAN = /must be the only gameplay action in its plan/;
const TRANSIENT_UPSTREAM = /\b(?:429|50[0234])\b|rate[ _-]?limit|temporarily busy|overloaded|try again shortly|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i;
export function transientUpstream(message) { return TRANSIENT_UPSTREAM.test(message || ''); }
export function plannerGuidance(message) {
  if (/stale or missing observation ID/i.test(message || '')) return 'The observation token was missing, stale, or malformed. Copy the exact 8-character lowercase observation_id into the observation field with no UUID suffix or punctuation. No gameplay action was dispatched; answer from the SAME observation, or report the issue when evidence is insufficient.';
  if (OUT_OF_BUDGET.test(message || '')) return 'The previous response ran out of budget before a plan arrived. No gameplay action was dispatched. Answer from the SAME observation with a concise valid plan, or report the issue when evidence is insufficient.';
  if (STANDALONE_PLAN.test(message || '')) return 'A standalone gameplay action was combined with another gameplay action. Return either the deterministic card-play prefix only, or exactly one standalone action; never include end_turn with play_card or another mutation.';
  return 'The plan was rejected before any gameplay action was dispatched. Fix exactly what this message names and answer again from the same observation.';
}
export function noteProblem(action) {
  if (typeof action?.path !== 'string' || !/^[a-z0-9][a-z0-9/_-]{0,110}\.md$/.test(action.path) || action.path.includes('//') || action.path.includes('..')) return 'learn.path must be a lowercase .md path inside the strategy guide';
  if (!/^(?:ironclad\/a1\/(?:debugging|meta_strategy|act[123])\/|characters\/|ascension\/)/.test(action.path)) return 'use the strategy guide hierarchy; scratchpad and objective history are not strategy';
  if (MOMENT_IN_PATH.test(action.path)) return `learn.path names one moment of this run (${action.path}); write a seed-invariant mechanic instead`;
  if (typeof action.content !== 'string' || !action.content.trim() || action.content.length > 8000) return 'learn.content must be 1-8000 characters';
  if (!/^---\r?\n[\s\S]*?\bdescription:\s*\S[\s\S]*?\r?\n---/.test(action.content) || !/\bkeys:\s*\S/.test(action.content.slice(0, 600))) return 'learn.content must open with front matter carrying description and keys';
  if (typeof action.message !== 'string' || action.message.trim().length < 3 || action.message.length > 200) return 'learn.message must be a 3-200 character commit message';
  return null;
}
export function energyCost(cost) { const value = typeof cost === 'string' && /^\d+$/.test(cost.trim()) ? Number(cost) : cost; return Number.isInteger(value) && value >= 0 ? value : null; }

export const GAME_ACTIONS = new Set(['menu_select', 'play_card', 'use_potion', 'discard_potion', 'end_turn', 'combat_select_card', 'combat_confirm_selection', 'claim_reward', 'select_card_reward', 'skip_card_reward', 'proceed', 'shop_back', 'choose_event_option', 'advance_dialogue', 'choose_rest_option', 'shop_purchase', 'choose_map_node', 'select_card', 'confirm_selection', 'cancel_selection', 'select_bundle', 'confirm_bundle_selection', 'cancel_bundle_selection', 'select_relic', 'skip_relic_selection', 'claim_treasure_relic', 'crystal_sphere_set_tool', 'crystal_sphere_click_cell', 'crystal_sphere_proceed']);
const COMMON = ['learn', 'recall', 'research', 'lookup', 'wait', 'report_issue'];
const PLAN_ACTION_FIELDS = Object.freeze({
  menu_select: ['type', 'option', 'seed'], play_card: ['type', 'card', 'target'],
  use_potion: ['type', 'slot', 'target'], discard_potion: ['type', 'slot'], end_turn: ['type'],
  combat_select_card: ['type', 'card'], combat_confirm_selection: ['type'],
  claim_reward: ['type', 'reward'], select_card_reward: ['type', 'card'], skip_card_reward: ['type'], proceed: ['type'], shop_back: ['type'],
  choose_event_option: ['type', 'option'], advance_dialogue: ['type'], choose_rest_option: ['type', 'option'],
  shop_purchase: ['type', 'item'], choose_map_node: ['type', 'node'], select_card: ['type', 'card'],
  confirm_selection: ['type'], cancel_selection: ['type'], select_bundle: ['type', 'bundle'],
  confirm_bundle_selection: ['type'], cancel_bundle_selection: ['type'], select_relic: ['type', 'relic'],
  skip_relic_selection: ['type'], claim_treasure_relic: ['type', 'relic'], crystal_sphere_set_tool: ['type', 'tool'],
  crystal_sphere_click_cell: ['type', 'x', 'y'], crystal_sphere_proceed: ['type'],
  learn: ['type', 'path', 'content', 'message'], recall: ['type', 'path'], research: ['type', 'url'],
  lookup: ['type', 'query', 'item_type'], wait: ['type', 'seconds'], report_issue: ['type', 'issue'],
});
export const ROLE_ACTIONS = {
  strategist: new Set([...GAME_ACTIONS].filter(type => !['play_card', 'end_turn', 'combat_select_card', 'combat_confirm_selection'].includes(type)).concat(COMMON)),
  combat: new Set(['play_card', 'use_potion', 'discard_potion', 'end_turn', 'combat_select_card', 'combat_confirm_selection', 'select_card', 'confirm_selection', 'cancel_selection', ...COMMON]),
};
const standalone = new Set([...GAME_ACTIONS].filter(type => type !== 'play_card'));
export function repairPlan(plan, { role = null } = {}) {
  if (role !== 'combat' || !Array.isArray(plan?.actions)) return plan;
  const gameplay = plan.actions.filter(action => GAME_ACTIONS.has(action?.type));
  if (gameplay.length <= 1) return plan;
  const standaloneIndex = plan.actions.findIndex(action => standalone.has(action?.type));
  if (standaloneIndex < 0) return plan;
  const standaloneAction = plan.actions[standaloneIndex];
  const prefix = plan.actions.slice(0, standaloneIndex);
  const notes = plan.actions.slice(standaloneIndex + 1).filter(action => action?.type === 'learn');
  if (notes.some((note, index) => plan.actions.indexOf(note) !== plan.actions.length - notes.length + index)) return plan;
  if (standaloneIndex === 0) return { ...plan, actions: [standaloneAction, ...notes] };
  if (prefix.some(action => action?.type !== 'play_card')) return plan;
  return { ...plan, actions: [...prefix, ...notes] };
}

const integer = (value, name) => { if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative observed index`); };
const string = (value, name) => { if (typeof value !== 'string' || !value.trim() || value.length > 160) throw new Error(`${name} must be a non-empty string of at most 160 characters`); };
const present = (items, value, field) => Array.isArray(items) && items.some(item => item?.[field] === value);

export function validatePlan(plan, state, { role = null } = {}) {
  if (!plan || String(plan.observation ?? '').trim().toLowerCase() !== stateId(state)) throw new Error('stale or missing observation ID');
  if (!Array.isArray(plan.actions) || plan.actions.length < 1 || plan.actions.length > 8) throw new Error('a plan needs 1–8 actions');
  if (typeof plan.summary !== 'string' || plan.summary.length > 300) throw new Error('summary must be at most 300 characters');
  const notes = plan.actions.filter(action => action?.type === 'learn');
  if (notes.length > 1 || (notes.length && plan.actions.at(-1)?.type !== 'learn')) throw new Error('one learned note may appear only as the final action');
  const gameplay = plan.actions.filter(action => GAME_ACTIONS.has(action?.type));
  // Printed card costs describe the base card, not necessarily the cost at
  // resolution. Card effects can discount a later play or grant energy, while
  // STS2's live can_play flag is authoritative for the exact current state.
  // The executor revalidates every card immediately before its own POST.
  for (const action of plan.actions) {
    if (!action || typeof action !== 'object') throw new Error('invalid action');
    if (role && !ROLE_ACTIONS[role]?.has(action.type)) throw new Error(`the ${role} cannot use ${action.type}; its actions are ${[...(ROLE_ACTIONS[role] || [])].join(', ')}`);
    if (!role && !GAME_ACTIONS.has(action.type) && !COMMON.includes(action.type)) throw new Error(`unknown action type: ${action.type}`);
    const allowedFields = PLAN_ACTION_FIELDS[action.type];
    if (allowedFields) {
      const extra = Object.keys(action).find(key => !allowedFields.includes(key));
      if (extra) throw new Error(`${action.type}.${extra} is not an allowed plan field`);
    }
    if (standalone.has(action.type) && gameplay.length !== 1) throw new Error(`${action.type} must be the only gameplay action in its plan`);
    if (action.type === 'menu_select') {
      string(action.option, 'menu_select.option');
      if (action.seed !== undefined) string(action.seed, 'menu_select.seed');
      const options = state.options || state.menu?.options;
      const option = Array.isArray(options) ? options.find(item => item === action.option || item?.name === action.option || item?.id === action.option || item?.option === action.option || item?.label === action.option) : null;
      if (Array.isArray(options) && option == null) throw new Error('unknown menu option');
      if (option?.enabled === false) throw new Error('menu option is disabled');
    }
    else if (action.type === 'play_card') {
      integer(action.card, 'play_card.card');
      const card = state.player?.hand?.find(item => item.instance_id === action.card);
      if (!card) throw new Error('unknown card instance');
      if (card.can_play === false) throw new Error(`${card.name || action.card} is not currently playable`);
      if (card.target_type === 'AnyEnemy' && !state.battle?.enemies?.some(enemy => enemy.entity_id === action.target && enemy.hp > 0)) throw new Error('unknown enemy target');
      if (card.target_type !== 'AnyEnemy' && action.target != null) throw new Error(`${card.name} takes no target`);
    } else if (['use_potion', 'discard_potion'].includes(action.type)) {
      integer(action.slot, `${action.type}.slot`);
      const potion = state.player?.potions?.find(item => item.slot === action.slot);
      if (!potion) throw new Error(`no potion in slot ${action.slot}`);
      if (action.type === 'use_potion' && potion.can_use !== true) throw new Error(`potion in slot ${action.slot} is not currently usable`);
      if (action.type === 'use_potion' && potion.target_type === 'AnyEnemy' && !state.battle?.enemies?.some(enemy => enemy.entity_id === action.target && enemy.hp > 0)) throw new Error('unknown potion target');
      if (action.type === 'use_potion' && potion.target_type !== 'AnyEnemy' && action.target != null) throw new Error(`${potion.name || `potion in slot ${action.slot}`} takes no explicit target`);
    } else if (action.type === 'combat_select_card') { integer(action.card, 'combat_select_card.card'); if (!present(state.hand_select?.cards, action.card, 'instance_id')) throw new Error('unknown selectable combat card instance'); }
    else if (action.type === 'combat_confirm_selection' && state.hand_select?.can_confirm !== true) throw new Error('combat selection cannot be confirmed yet');
    else if (action.type === 'end_turn' && (!isCombat(state) || !ready(state))) throw new Error('turn cannot be ended from the current state');
    else if (action.type === 'claim_reward') { string(action.reward, 'claim_reward.reward'); if (!(state.rewards?.items || []).some(item => semanticIdentity('reward', item) === action.reward)) throw new Error('unknown reward'); }
    else if (action.type === 'select_card_reward') { string(action.card, 'select_card_reward.card'); if (!(state.card_reward?.cards || []).some(item => semanticIdentity('card_reward', item) === action.card)) throw new Error('unknown card reward'); }
    else if (action.type === 'skip_card_reward' && state.card_reward?.can_skip !== true) throw new Error('card reward cannot be skipped');
    else if (action.type === 'proceed') { const screen = state.rewards || state.rest_site || state.shop || state.fake_merchant?.shop || state.treasure; if (screen?.can_proceed !== true) throw new Error('cannot proceed from the current state'); }
    else if (action.type === 'shop_back') { const screen = state.shop || state.fake_merchant?.shop; if (screen?.can_close_inventory !== true) throw new Error('shop inventory cannot be closed from the current state'); }
    else if (action.type === 'choose_event_option') { string(action.option, 'choose_event_option.option'); const option = (state.event?.options || []).find(item => semanticIdentity('event_option', item) === action.option); if (!option) throw new Error('unknown event option'); if (option.is_locked) throw new Error('event option is locked'); }
    else if (action.type === 'advance_dialogue' && state.event?.in_dialogue !== true) throw new Error('event dialogue is not active');
    else if (action.type === 'choose_rest_option') { string(action.option, 'choose_rest_option.option'); const option = (state.rest_site?.options || []).find(item => semanticIdentity('rest', item) === action.option); if (!option) throw new Error('unknown rest option'); if (option.is_enabled === false) throw new Error('rest option is disabled'); }
    else if (action.type === 'shop_purchase') { string(action.item, 'shop_purchase.item'); const items = state.shop?.items || state.fake_merchant?.shop?.items; const item = (items || []).find(entry => semanticIdentity('shop_item', entry) === action.item); if (!item) throw new Error('unknown shop item'); if (item.is_stocked === false || item.can_afford === false) throw new Error('shop item is unavailable'); }
    else if (action.type === 'choose_map_node') { string(action.node, 'choose_map_node.node'); if (!(state.map?.next_options || []).some(item => semanticIdentity('map', item) === action.node)) throw new Error('unknown map node'); }
    else if (action.type === 'select_card') { integer(action.card, 'select_card.card'); if (!(state.card_select?.cards || []).some(item => semanticIdentity('card', item) === action.card)) throw new Error('unknown selection card'); }
    else if (action.type === 'select_bundle') { string(action.bundle, 'select_bundle.bundle'); if (!(state.bundle_select?.bundles || []).some(item => semanticIdentity('bundle', item) === action.bundle)) throw new Error('unknown bundle'); }
    else if (action.type === 'select_relic') { string(action.relic, 'select_relic.relic'); if (!(state.relic_select?.relics || []).some(item => semanticIdentity('relic', item) === action.relic)) throw new Error('unknown relic'); }
    else if (action.type === 'claim_treasure_relic') { string(action.relic, 'claim_treasure_relic.relic'); if (!(state.treasure?.relics || []).some(item => semanticIdentity('relic', item) === action.relic)) throw new Error('unknown treasure relic'); }
    else if (action.type === 'confirm_selection' && state.card_select?.can_confirm !== true) throw new Error('card selection cannot be confirmed yet');
    else if (action.type === 'cancel_selection' && state.card_select?.can_cancel !== true) throw new Error('card selection cannot be cancelled');
    else if (action.type === 'confirm_bundle_selection' && state.bundle_select?.can_confirm !== true) throw new Error('bundle selection cannot be confirmed yet');
    else if (action.type === 'cancel_bundle_selection' && state.bundle_select?.can_cancel !== true) throw new Error('bundle selection cannot be cancelled');
    else if (action.type === 'skip_relic_selection' && state.relic_select?.can_skip !== true) throw new Error('relic selection cannot be skipped');
    else if (action.type === 'crystal_sphere_set_tool') { if (!['big', 'small'].includes(action.tool)) throw new Error('tool must be big or small'); if (state.crystal_sphere?.[`can_use_${action.tool}_tool`] !== true) throw new Error(`${action.tool} crystal sphere tool is unavailable`); }
    else if (action.type === 'crystal_sphere_click_cell') { integer(action.x, 'x'); integer(action.y, 'y'); if (!(state.crystal_sphere?.clickable_cells || []).some(cell => cell.x === action.x && cell.y === action.y)) throw new Error('crystal sphere cell is not clickable'); }
    else if (action.type === 'crystal_sphere_proceed' && state.crystal_sphere?.can_proceed !== true) throw new Error('crystal sphere cannot proceed yet');
    else if (action.type === 'recall') { if (plan.actions.length !== 1) throw new Error('recall must be standalone'); if (action.path !== undefined && (typeof action.path !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9/_-]{0,110}\.md$/.test(action.path) || action.path.includes('..') || action.path.includes('//'))) throw new Error('unsafe recall path'); }
    else if (action.type === 'research' && (plan.actions.length !== 1 || typeof action.url !== 'string' || !/^https:\/\/[^\s]{4,380}$/.test(action.url))) throw new Error('research requires one https URL and must be standalone');
    else if (action.type === 'lookup' && (plan.actions.length !== 1 || typeof action.query !== 'string' || !action.query.trim() || action.query.length > 200 || !['all', 'card', 'relic'].includes(action.item_type || 'all'))) throw new Error('lookup requires one bounded card/relic query and must be standalone');
    else if (action.type === 'wait' && (plan.actions.length !== 1 || !Number.isInteger(action.seconds) || action.seconds < 1 || action.seconds > 10)) throw new Error('wait.seconds must be 1-10 and standalone');
    else if (action.type === 'report_issue' && (plan.actions.length !== 1 || typeof action.issue !== 'string' || action.issue.length < 3 || action.issue.length > 500)) throw new Error('report_issue requires a 3-500 character issue and must be standalone');
  }
  return plan;
}
