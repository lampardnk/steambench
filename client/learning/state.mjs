import crypto from 'node:crypto';
import { PROFILE } from './profile.mjs';

export const VERSION = PROFILE.checkpointVersion;
export const SENSOR_VERSION = 3;
export const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value) ?? 'null').digest('hex').slice(0, 16);

export function compactState(state) {
  const player = state.player;
  const result = { ...state };
  if (player) {
    result.player = { ...player };
    // Preserve exhausted card identities, pile membership and all active restrictions.
    for (const pile of ['hand', 'draw_pile', 'discard_pile', 'exhaust_pile']) {
      result.player[pile] = player[pile]?.map(({ keywords, ...card }) => card);
    }
  }
  if (Array.isArray(state.deck)) {
    const cards = new Map();
    for (const { keywords, ...card } of state.deck) {
      const key = digest(card);
      if (cards.has(key)) cards.get(key).count++;
      else cards.set(key, { ...card, count: 1 });
    }
    result.deck = [...cards.values()];
  }
  // A transform preview shows the chosen card on the left and a card that re-rolls about once a
  // second on the right. That roll is animation: it never determines the transformed card. Keeping
  // it would change the observation identity between every read, so no plan could ever execute.
  const select = state.card_select;
  if (select?.screen_type === 'transform' && select.preview_showing && Array.isArray(select.preview_cards)) {
    const [chosen] = select.preview_cards;
    result.card_select = {
      ...select,
      preview_cards: chosen ? [{ ...chosen, role: 'chosen_card' }] : [],
      random_result_preview: 'the card shown right of the chosen one re-rolls continuously and does not determine the result; it is omitted',
    };
  }
  return result;
}

export function stateId(state) {
  return digest(compactState(state));
}

export function progressId(state) {
  const { ui, ...rest } = compactState(state);
  return digest(rest);
}

export function mapId(state) {
  return state.state_type === 'map' ? digest(state.map) : null;
}

export function plannerState(state, lastResult, strategy) {
  const result = compactState(state);
  if (result.player) for (const pile of ['draw_pile', 'discard_pile', 'exhaust_pile']) delete result.player[pile];
  if (state.state_type === 'map' && strategy && lastResult?.after?.map_id === mapId(state)) {
    const { nodes, ...map } = result.map;
    result.map = { ...map, full_graph_unchanged: true, node_count: nodes?.length };
  }
  return result;
}

export function plannerResult(result) {
  return {
    completed: result.completed,
    ...(result.code === 'stale_observation'
      ? { replan: 'Observation changed before execution. Zero inputs sent; use fresh state.', no_input_sent: true }
      : { error: result.error }),
    after: result.state ? { state_type: result.state.state_type, run: result.state.run, energy: result.state.player?.energy, map_id: mapId(result.state) } : null,
  };
}

export function needsScreenshot(state) {
  if (state.ui?.sensor_version === SENSOR_VERSION && state.ui.focused_element && state.ui.elements?.some(item => item.id === state.ui.focused_element && item.label)) return false;
  if (isCombat(state) && state.ui?.hand_mode === 'Play') return false;
  if (state.state_type === 'menu' && /(?:Singleplayer|Standard|Embark|Continue|Abandon).*Button/i.test(state.ui?.focus_path || '')) return false;
  return true;
}

export const DIRECTIONS = ['up', 'down', 'left', 'right'];

export function uiMatches(state, expected) {
  return expected && state.state_type === expected.state_type
    && (expected.menu_screen === undefined || state.menu_screen === expected.menu_screen)
    && (expected.focus_path === undefined || state.ui?.focus_path === expected.focus_path);
}

// Only these known startup transitions may continue into another semantic action.
// Each transition still observes and checks its destination before further input.
export function startupTransition(state, action) {
  if (state.state_type !== 'menu' || action.buttons.join(',') !== 'a') return false;
  const focus = state.ui?.focus_path || '';
  const destination = /\/SingleplayerButton$/.test(focus) ? 'singleplayer'
    : /\/StandardButton$/.test(focus) ? 'character_select' : null;
  return destination && action.expect?.state_type === 'menu' && action.expect.menu_screen === destination;
}

function validUiExpectation(expected) {
  return expected && typeof expected.state_type === 'string'
    && Object.keys(expected).every(key => ['state_type', 'menu_screen', 'focus_path'].includes(key))
    && [expected.menu_screen, expected.focus_path].every(value => value === undefined || value === null || typeof value === 'string');
}

export function isCombat(state) {
  return Boolean(state.battle && Array.isArray(state.player?.hand));
}

/**
 * Live card play, as opposed to a selection overlay that happens to be open
 * during a combat. The batching and probe restrictions exist to protect
 * targeting: a card is lifted, an enemy is aimed at, and a stray direction
 * changes what gets hit. A discard, exhaust or card-select overlay is a list
 * UI with none of that, and treating it as card play left the player unable to
 * batch navigation OR probe - stuck on an auto-generated focus path with no
 * legal way to find out what it was pointing at.
 */
export function isCardPlay(state) {
  return isCombat(state) && !/select|overlay|reward/.test(state.state_type);
}

export function ready(state) {
  return !isCombat(state) || /select|overlay|reward/.test(state.state_type) || (state.battle.is_play_phase === true && state.battle.turn === 'player');
}

// A path that names one moment of one run - a floor number, a specific round -
// is journalling a seed, not recording something a later run can use. The next
// run has a different map, different offers and different fights.
const MOMENT_IN_PATH = /(?:^|[/_-])(?:floor|round|turn|decision|seed)-?\d/;

/**
 * Why a learned note cannot be kept, or null when it is fine. Kept separate from
 * validatePlan so a badly formed note is reported rather than ending the run.
 */
export function noteProblem(action) {
  if (typeof action?.path !== 'string' || !/^[a-z0-9][a-z0-9/_-]{0,110}\.md$/.test(action.path) || action.path.includes('//') || action.path.includes('..')) {
    return 'learn.path must be a lowercase .md path under ironclad/a1/ (for example ironclad/a1/act1/normal/wriggler.md), or under the cross-character roots characters/ or ascension/';
  }
  if (!/^(?:ironclad\/a1\/(?:controls|debugging|meta_strategy|act[123])\/|characters\/|ascension\/)/.test(action.path)) return 'use the strategy guide hierarchy; scratchpad and objective history are not strategy';
  if (MOMENT_IN_PATH.test(action.path)) {
    return `learn.path names one moment of this run (${action.path}); every run is a different seed, so a note about "what happened at floor 4" helps nobody. Write the repeatable thing instead: the enemy's intent graph, what the screen always does, the problem this situation is an instance of`;
  }
  if (typeof action.content !== 'string' || !action.content.trim() || action.content.length > 8000) return 'learn.content must be 1-8000 characters';
  if (!/^---\r?\n[\s\S]*?\bdescription:\s*\S[\s\S]*?\r?\n---/.test(action.content) || !/\bkeys:\s*\S/.test(action.content.slice(0, 600))) {
    return 'learn.content must open with front matter carrying description and keys, between --- lines; the keys are how the runtime finds this note again';
  }
  if (typeof action.message !== 'string' || action.message.trim().length < 3 || action.message.length > 200) return 'learn.message must be a 3-200 character commit message';
  return null;
}

export function validatePlan(plan, state) {
  if (!plan || plan.observation !== stateId(state)) throw new Error('stale or missing observation ID');
  if (!Array.isArray(plan.actions) || plan.actions.length < 1 || plan.actions.length > 8) throw new Error('a plan needs 1–8 actions');
  if (typeof plan.summary !== 'string' || plan.summary.length > 300) throw new Error('summary must be at most 300 characters');
  // Writing a note sends no game input, and what is worth recording is usually
  // whatever the plan just verified. One learn may therefore close any plan;
  // everything else is validated as though it were not there.
  const notes = plan.actions.filter(item => item?.type === 'learn');
  if (notes.length > 1) throw new Error('a plan may keep at most one learned note');
  if (notes.length && plan.actions.at(-1).type !== 'learn') throw new Error('a learned note must be the final action; it records what the plan verified');
  const actions = notes.length ? plan.actions.slice(0, -1) : plan.actions;
  for (const action of plan.actions) {
    if (!action || typeof action !== 'object') throw new Error('invalid action');
    if (action.type === 'play') {
      if (!isCombat(state) || !Number.isInteger(action.card) || !state.player.hand.some(card => card.instance_id === action.card)) throw new Error('unknown card instance');
      if (action.target != null && typeof action.target !== 'string') throw new Error('invalid target');
      const card = state.player.hand.find(item => item.instance_id === action.card);
      if (card.target_type === 'AnyEnemy' && !state.battle.enemies.some(enemy => enemy.entity_id === action.target && enemy.hp > 0)) throw new Error('unknown enemy target');
    } else if (['navigate', 'activate', 'elements', 'path'].includes(action.type)) {
      if (action.scene !== state.ui?.scene_id || typeof action.scene !== 'string') throw new Error('stale or missing scene ID');
      if (['navigate', 'activate', 'path'].includes(action.type) && typeof action.target !== 'string') throw new Error('target element ID required');
      if (actions.some(item => !['navigate', 'activate', 'elements', 'path'].includes(item.type))) throw new Error('semantic navigation cannot mix with other actions');
      if (action.type === 'activate' && actions.indexOf(action) !== actions.length - 1) throw new Error('activation is a final scene barrier');
      if (['elements', 'path'].includes(action.type) && actions.length !== 1) throw new Error('read-only query must be standalone');
    } else if (action.type === 'input') {
      if (!Array.isArray(action.buttons) || action.buttons.length < 1 || action.buttons.length > 12) throw new Error('UI sequences require 1–12 buttons');
      if (action.buttons.some(button => !['a', 'b', 'x', 'y', 'start', 'back', 'up', 'down', 'left', 'right', 'lb', 'rb'].includes(button))) throw new Error('invalid button');
      if (actions.some(item => item.type !== 'input')) throw new Error('UI sequences cannot mix with combat or standalone actions');
      if (action.from !== undefined && !validUiExpectation(action.from)) throw new Error('invalid UI precondition');
      if (action.expect !== undefined && !validUiExpectation(action.expect)) throw new Error('invalid UI expectation');
      const index = actions.indexOf(action);
      if (index > 0 && (!validUiExpectation(action.from) || !action.from.focus_path)) throw new Error('later UI actions require an exact expected screen and focus precondition');
      const source = index === 0 ? state : { state_type: action.from.state_type, menu_screen: action.from.menu_screen, ui: { focus_path: action.from.focus_path } };
      const navigation = action.buttons.every(button => DIRECTIONS.includes(button));
      if (action.buttons.length > 1 && (!navigation || isCardPlay(state))) throw new Error('batch navigation separately from activation; combine verified semantic sequences in one plan');
      if (action.probe !== undefined && (action.probe !== true || actions.length !== 1 || action.buttons.length !== 1 || !navigation || action.expect || isCardPlay(state))) throw new Error('probe is a single standalone directional press, with no expected destination, outside live card play');
      if (index < actions.length - 1 && (!action.expect || (!navigation && !startupTransition(source, action)))) throw new Error('activation is a final semantic boundary except verified startup transitions');
      if (navigation && index < actions.length - 1 && !action.expect.focus_path) throw new Error('navigation before activation requires the exact destination focus');
      // A directional move that predicts the focus it starts from cannot be verified: reject it
      // before any input rather than spending presses on an expectation that must fail.
      const origin = index === 0 ? state.ui?.focus_path : action.from?.focus_path;
      if (navigation && action.expect?.focus_path && origin && action.expect.focus_path === origin) throw new Error('a directional move cannot expect the focus it starts from; navigate standalone when the destination path is unknown');
      if (isCardPlay(state) && actions.length !== 1) throw new Error('raw combat UI input must be standalone');
    } else if (action.type === 'scout') {
      if (actions.length !== 1 || state.state_type !== 'map' || !['up', 'down'].includes(action.direction) || !['left', 'right'].includes(action.stick || 'left') || !Number.isInteger(action.hold_ms) || action.hold_ms < 100 || action.hold_ms > 600) throw new Error('scout requires a map, up/down direction, left/right stick and 100–600 ms hold');
    } else if (action.type === 'learn') {
      // Field problems are reported by the executor, not thrown: a note is
      // optional bookkeeping and must never cost a run its verified progress.
    } else if (action.type === 'recall') {
      if (actions.length !== 1) throw new Error('recall must be a standalone action');
      if (action.path !== undefined && (typeof action.path !== 'string' || !/^[a-z0-9][a-z0-9/_-]{0,110}\.md$/.test(action.path) || action.path.includes('..'))) throw new Error('recall.path must be a lowercase .md path inside the strategy guide');
    } else if (action.type === 'research') {
      if (actions.length !== 1) throw new Error('research must be a standalone action');
      if (typeof action.url !== 'string' || !/^https:\/\/[^\s]{4,380}$/.test(action.url)) throw new Error('research.url must be one https reference URL');
    } else if (action.type === 'lookup') {
      if (actions.length !== 1 || typeof action.query !== 'string' || !action.query.trim() || action.query.length > 200 || !['all', 'card', 'relic'].includes(action.item_type || 'all')) throw new Error('lookup requires a bounded card/relic query and no gameplay actions');
    } else if (action.type === 'end_turn') {
      if (!isCombat(state) || actions.indexOf(action) !== actions.length - 1) throw new Error('end_turn must be the last combat action');
    } else if (action.type === 'wait') {
      if (actions.length !== 1) throw new Error('wait must be a standalone action');
    } else if (action.type === 'report_issue') {
      if (actions.length !== 1 || typeof action.issue !== 'string' || !action.issue.trim() || action.issue.length > 1200) throw new Error('report_issue requires one bounded issue description and no gameplay actions');
    } else throw new Error('unsupported action');
  }
  // can_play answers "can this card be played right now", one card at a time. A
  // batch spends energy as it goes, so three individually playable cards can
  // still cost more than the turn has - and that only surfaced once the earlier
  // cards had already been played, which pauses the run. Budget it here, while
  // nothing has been sent. Skipped whenever the arithmetic is not knowable:
  // an unknown cost, or a card whose effects can change the energy available.
  const played = actions.filter(action => action.type === 'play')
    .map(action => state.player?.hand?.find(card => card.instance_id === action.card));
  if (played.length > 1 && Number.isInteger(state.player?.energy)
    && played.every(card => card && Number.isInteger(card.cost) && card.cost >= 0 && !uncertainCard(card))) {
    const total = played.reduce((sum, card) => sum + card.cost, 0);
    if (total > state.player.energy) throw new Error(`this plan spends ${total} energy and the turn has ${state.player.energy}: ${played.map(card => `${card.name} ${card.cost}`).join(', ')}. Plan what the turn can pay for`);
  }
  if (new Set(actions.filter(a => a.type === 'play').map(a => a.card)).size !== played.length) throw new Error('a card instance may appear only once in a plan');
  if (plan.strategy != null && (typeof plan.strategy !== 'string' || plan.strategy.length > 1200)) throw new Error('strategy exceeds 1200 characters');
  if (plan.lesson != null && (typeof plan.lesson !== 'string' || plan.lesson.length > 600)) throw new Error('lesson exceeds 600 characters');
  if (typeof plan.note !== 'string' || !plan.note.trim() || plan.note.length > 1200) throw new Error('a learning note of 1–1200 characters is required');
  return plan;
}

export function uncertainCard(card) {
  return /draw|random|choose|select|discover|create|generate|(?:add|put|return|move).*hand|top card|replay|(?:gain|lose) .*energy/i.test(card.description || '');
}
