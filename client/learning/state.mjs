import crypto from 'node:crypto';
import { PROFILE } from './profile.mjs';

export const VERSION = PROFILE.checkpointVersion;
export const SENSOR_VERSION = 6;
export const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value) ?? 'null').digest('hex').slice(0, 16);

/**
 * The same screen, with the part of it that moves on its own taken out.
 *
 * A transform preview shows the chosen card on the left and a card that
 * re-rolls about once a second on the right. That roll is animation: it never
 * determines the transformed card. Neutralising the preview cards was not
 * enough - the roll replaces a node, so the mod rebuilds `ui.scene_id` with it,
 * and the rolled card's element carries its name and model id. Every one of
 * those is in the identity a plan rests on, so a run reached Neow, chose a
 * Strike to transform, and then had three plans in a row thrown away as stale
 * before the room paused, having sent nothing.
 *
 * Applied where the sensor is read, so nothing downstream has to know: the
 * observation id, the plan identity, the actuator's scene and the executor's
 * own checks all see one stable screen. Idempotent.
 */
export function settleAnimation(state) {
  const select = state?.card_select;
  if (!(select?.screen_type === 'transform' && select.preview_showing && Array.isArray(select.preview_cards))) return state;
  const [chosen] = select.preview_cards;
  const rolling = select.preview_cards[1]?.id;
  const result = {
    ...state,
    card_select: {
      ...select,
      preview_cards: chosen ? [{ ...chosen, role: 'chosen_card' }] : [],
      random_result_preview: 'the card shown right of the chosen one re-rolls continuously and does not determine the result; it is omitted',
    },
  };
  if (state.ui) {
    result.ui = {
      ...state.ui,
      // Names the screen and the card being transformed, which is what a plan
      // actually rests on here, rather than whichever card the roll is showing.
      scene_id: `transform-preview:${chosen?.id ?? 'unknown'}`,
      elements: (state.ui.elements || []).map(item => (rolling && item.reference?.model_id === `CARD.${rolling}`
        ? { ...item, label: null, reference: { ...item.reference, model_id: 'CARD.<re-rolling>' } }
        : item)),
    };
  }
  return result;
}

export function compactState(state) {
  state = settleAnimation(state);
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
  return result;
}

/**
 * Geometry is not identity.
 *
 * A hovering sprite drifts a pixel or two between reads. stateId digested
 * element bounds, so the observation id changed while absolutely nothing
 * happened - and validatePlan rejects a plan whose observation no longer
 * matches, before any input is sent. Live, three reads a second apart on one
 * combat screen produced three different ids from a 2px bob, so every plan
 * written against that screen was stale on arrival and the run could not act
 * at all. The elements themselves still carry bounds for the caller that needs
 * them; they just do not decide whether this is the same situation.
 */
const withoutGeometry = (state) => (state?.ui?.elements
  ? { ...state, ui: { ...state.ui, elements: state.ui.elements.map(({ bounds, ...rest }) => rest) } }
  : state);

/**
 * Short on purpose. The model has to copy this back verbatim, and a run died at
 * decision 4 because it wrote f97f37503c665f42 for f97c37503c665f42 - one
 * character out of sixteen. Eight is still specific enough for a value that is
 * only ever compared against one other value, and it halves what has to be
 * transcribed. The real staleness gate is not this: the executor re-reads the
 * game before acting and refuses a plan whose observation no longer matches
 * what is actually on screen.
 */
export function stateId(state) {
  return digest(withoutGeometry(compactState(state))).slice(0, 8);
}

export function progressId(state) {
  const { ui, ...rest } = compactState(state);
  return digest(rest);
}

/**
 * The situation the run is in: what it has achieved, and what the screen in
 * front of it is offering.
 *
 * `progressId` cannot answer "is this run still getting anywhere". It digests
 * `state_type`, so a reward list and the card screen behind it are two
 * different values, and a run that walks between them forever looks like a run
 * that keeps moving. A live room spent 363 of its 449 inputs doing exactly that
 * - open card reward, press `b`, repeat - for 86 minutes and 11.3M of the run's
 * 17.0M tokens, and it never left the loop on its own.
 *
 * So this key deliberately leaves out `state_type`, the element ids and the
 * focus: those churn or oscillate on their own. What is left is the run's
 * position and holdings, and the contents of whatever is being offered. Two
 * observations with the same key are the same moment reached twice.
 */
export function situationId(state) {
  return digest(situationKey(settleAnimation(state)));
}

/**
 * Whether the recent inputs were spent inside too few distinct situations.
 *
 * Returns how many distinct situations the window held, or null when the run
 * is still finding new ones. It is a separate function from the guard that
 * throws so the boundary can be pinned by a test: a run stopped for stalling
 * when it was in fact moving is the expensive mistake here, and the margins
 * are what keep it honest. `window` and `distinct` are the caller's policy,
 * passed in rather than defaulted, so the constants live in one place.
 */
export function stallReason(situations, window, distinct) {
  if (situations.length < window) return null;
  const seen = new Set(situations.slice(-window)).size;
  return seen < distinct ? seen : null;
}

/**
 * The fields behind `situationId`, kept separate so the caller that has to
 * explain a stall can name what did not change.
 */
export function situationKey(state) {
  const player = state.player || {};
  const battle = state.battle || {};
  const map = state.map || {};
  const hand = state.hand_select || {};
  const event = state.event || {};
  const sorted = (items, pick) => (items || []).map(item => pick(item)).sort();
  return [
    state.run?.act ?? null, state.run?.floor ?? null,
    player.hp ?? null, player.max_hp ?? null, player.gold ?? null,
    sorted(player.relics, item => item?.id ?? null),
    sorted(player.potions, item => item?.id ?? null),
    sorted(state.deck, card => `${card?.id ?? ''}|${card?.is_upgraded === true}`),
    sorted(player.hand, card => card?.id ?? null),
    // What the screen is offering, so a screen that merely rebuilt is not read
    // as progress.
    sorted(state.rewards?.items, item => `${item?.index ?? ''}|${item?.type ?? ''}|${item?.description ?? ''}`),
    sorted(state.card_reward?.cards, card => `${card?.id ?? ''}|${card?.is_upgraded === true}`),
    sorted(state.card_select?.cards, card => `${card?.id ?? ''}|${card?.index ?? ''}`),
    sorted(hand.cards, card => `${card?.id ?? ''}|${card?.index ?? ''}`),
    // A bundle screen offers groups of cards; the group is what would change if
    // one were taken. Leaving it out reported the Ancient's bundle screen as a
    // stall while it was being read normally, which is the kind of false alarm
    // that stops healthy runs.
    sorted(state.bundle_select?.bundles, bundle => `${bundle?.index ?? ''}|`
      + sorted(bundle?.cards, card => card?.id ?? null).join(',')),
    state.bundle_select?.prompt ?? null,
    hand.prompt ?? null, hand.mode ?? null,
    event.event_id ?? null, event.in_dialogue === true,
    sorted(event.options, option => `${option?.index ?? ''}|${option?.id ?? ''}|${option?.title ?? ''}`),
    sorted(state.rest_site?.options, option => `${option?.index ?? ''}|${option?.id ?? ''}`),
    sorted(state.shop?.items, item => `${item?.id ?? ''}|${item?.price ?? ''}`),
    sorted(state.treasure?.relics, relic => relic?.id ?? null),
    // A fight moves on its own: rounds, enemy health, the cards in hand.
    battle.round ?? null, battle.turn ?? null,
    sorted(battle.enemies, enemy => `${enemy?.name ?? ''}|${enemy?.hp ?? ''}|${enemy?.block ?? ''}`),
    map.current_column ?? null, map.current_row ?? null,
    state.menu_screen ?? null,
  ];
}

export function mapId(state) {
  return state.state_type === 'map' ? digest(state.map) : null;
}

/**
 * What a plan actually rests on. stateId covers every field the sensor reports,
 * including presentation that moves on its own: a tween sliding a control,
 * a "Game Saved" toast, a focus outline redraw, an idle animation during
 * combat. Comparing that against a plan made a few seconds earlier declared
 * almost every combat decision stale and threw it away without sending input.
 * Gameplay progress and the set of controls on screen are what a plan depends
 * on; if those are unchanged the plan is still good.
 *
 * Both of those have to be read in STABLE identity, which the previous version
 * was not. It digested `ui.scene_id` and `ui.focused_element`, and the sensor
 * builds both out of Godot instance ids that it mints fresh whenever a node is
 * rebuilt. Measured over 572 idle windows in the archive - consecutive sensor
 * reads with no pad input, which is exactly the gap a model spends thinking -
 * that declared 17.5% of them stale after the screen had not changed at all.
 * The churn is not the game doing something: tooltip text nodes
 * (MegaRichTextLabel) are rebuilt as they show and hide, pile buttons and gold
 * readouts are rebuilt as they update, and a card-targeting cursor passing back
 * over a holder mints a new id for the same holder. All 402 "state changed while
 * planning" refusals in the archive came from this class, and each one threw
 * away a finished model turn and made it plan the same screen again.
 *
 * So the control set is compared by what each control IS - its type, what it
 * refers to, how it is activated - rather than by which object happens to
 * implement it, and only controls the pad can actually address are compared at
 * all: decoration the runtime would never let a plan name cannot be something a
 * plan rests on. Measured on the same 572 windows this holds every real
 * transition (a potion popup opening, a shop stocking) and every case where
 * gameplay progress moved, while dropping false staleness to 1.8%.
 *
 * Focus is deliberately NOT part of this. It is restored by the game after
 * every press, and it moves on its own (a card-targeting cursor passing over a
 * holder). A plan names what it acts on, and the executor re-resolves that by
 * walking the focus graph from wherever focus currently is; a plan pressing
 * relative to live focus does not exist in this codebase - `navigate` has never
 * been used, and every `input` sequence either starts from focus the model
 * itself just verified or is a one-press probe whose whole point is that it is
 * relative.
 */
export function planIdentity(state) {
  // Settled here too, not only by the caller. progressId and stateId already
  // normalise through compactState, and reading ui.scene_id raw while they did
  // not was the inconsistency that let a plan validate and then be declared
  // stale by the very next read of the same unchanged screen.
  const settled = settleAnimation(state);
  return digest([progressId(settled), settled.state_type ?? null, settled.menu_screen ?? null, controlIdentity(settled)]);
}

/**
 * What a control IS, as opposed to which object currently implements it. A node
 * rebuilt by the game keeps its meaning; the instance id under it does not, and
 * neither does presentation text that changed because a counter updated.
 */
function stableControl(item) {
  return [item.type ?? '', item.reference?.kind ?? '', item.activation ?? '',
    item.reference?.card?.id ?? '', item.reference?.model_id ?? '',
    item.reference?.type ?? '', item.reference?.name ?? '',
    item.hotkeys?.length ? 'hotkey' : ''].join('|');
}

/** The controls a plan can name, by what they are rather than which object they are. */
function controlIdentity(state) {
  const counts = new Map();
  for (const item of state.ui?.elements || []) {
    if (!(item.selectable || item.press || item.hotkeys?.length)) continue;
    const kind = stableControl(item);
    counts.set(kind, (counts.get(kind) || 0) + 1);
  }
  // Sorted so the digest does not depend on the order the sensor happened to
  // walk the tree, and counted so a control appearing or leaving still shows.
  return [...counts].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([kind, count]) => `${count}x ${kind}`);
}

/**
 * The control holding focus, as stable identity.
 *
 * Focus is deliberately not part of planIdentity - it moves on its own, and an
 * action that names its target is unaffected by where focus moved from, because
 * the executor re-resolves the name by walking the focus graph from wherever it
 * happens to be. The exception is a bare activation press, which acts on
 * whatever is focused; the executor compares this before sending one, so that
 * one class keeps the protection the old identity gave it.
 */
export function focusIdentity(state) {
  const focused = (state?.ui?.elements || []).find(item => item.id === state?.ui?.focused_element);
  return focused ? stableControl(focused) : null;
}
const DIFF_FIELDS = [
  ['state_type', state => state.state_type],
  ['menu_screen', state => state.menu_screen ?? null],
  ['act', state => state.run?.act ?? null],
  ['floor', state => state.run?.floor ?? null],
  ['hp', state => state.player?.hp ?? null],
  ['gold', state => state.player?.gold ?? null],
  ['energy', state => state.player?.energy ?? null],
  ['turn', state => state.battle?.turn ?? null],
  ['round', state => state.battle?.round ?? null],
  ['scene_id', state => state.ui?.scene_id ?? null],
  ['focused_element', state => state.ui?.focused_element ?? null],
  ['focus_path', state => state.ui?.focus_path ?? null],
];

/**
 * The fields that differ between two observations. A replan gets this instead
 * of being told only that something moved: re-deriving a whole screen because
 * focus shifted by one row is the expensive way to learn one fact.
 */
export function stateDiff(before, after) {
  const changed = {};
  for (const [name, read] of DIFF_FIELDS) {
    const was = read(before);
    const now = read(after);
    if (was !== now) changed[name] = { was, now };
  }
  const labels = state => new Set((state.ui?.elements || []).map(item => item.label).filter(Boolean));
  const [old, fresh] = [labels(before), labels(after)];
  const gone = [...old].filter(label => !fresh.has(label)).slice(0, 8);
  const added = [...fresh].filter(label => !old.has(label)).slice(0, 8);
  if (gone.length) changed.controls_gone = gone;
  if (added.length) changed.controls_added = added;
  return changed;
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

/**
 * A menu the game has not built yet. The mod answers as soon as it is loaded,
 * which is before the main menu scene exists: the very first observation of a
 * room reported state_type "menu", menu_screen "main" and an EMPTY element list
 * with null focus, and an empty payload is identical to the next empty payload,
 * so quiescing declared it settled at once. The actuator then did the only
 * sensible thing with a menu that lists no controls - pressed A to establish
 * focus - against a screen that was not listening, and the run paused on its
 * first decision. Seconds later the same endpoint reported nine elements with
 * focus on SingleplayerButton.
 *
 * A real menu always has at least one control. No controls and no focus is not
 * a settled screen; it is a screen that has not arrived.
 */
export function unbuiltMenu(state) {
  return state?.state_type === 'menu'
    && !state.ui?.focused_element
    && !state.ui?.focus_path
    && (state.ui?.elements?.length ?? 0) === 0;
}

export function ready(state) {
  if (unbuiltMenu(state)) return false;
  if (leftMap(state)) return false;
  return !isCombat(state) || /select|overlay|reward/.test(state.state_type) || (state.battle.is_play_phase === true && state.battle.turn === 'player');
}

/**
 * A map nobody is standing on is a map that has already been left.
 *
 * Choosing a node commits immediately, but the map stays drawn - unchanged, so
 * two reads match and it looks settled - while the next room loads. Every one
 * of the eight node presses in room ba94db7f was followed by a decision spent
 * on that leftover map, and one of them planned a route on it while the game
 * was already showing an event, which paused the run. The tell is focus: the
 * live map always has a node focused, and the leftover map has none.
 */
export function leftMap(state) {
  return state?.state_type === 'map' && !state?.ui?.focused_element && !state?.ui?.focus_path;
}

// A path that names one moment of one run - a floor number, a specific round -
// is journalling a seed, not recording something a later run can use. The next
// run has a different map, different offers and different fights.
const MOMENT_IN_PATH = /(?:^|[/_-])(?:floor|round|turn|decision|seed)-?\d/;

/**
 * Why a learned note cannot be kept, or null when it is fine. Kept separate from
 * validatePlan so a badly formed note is reported rather than ending the run.
 */
// A planner that ran out of budget produced no plan at all, which is a different
// failure from a plan that arrived and was rejected: there is nothing in it to
// correct, and "fix exactly what this message names" names nothing, so the model
// reads it as a demand for more care and spends even longer. That is a loop, and
// three rounds of it end the room - which is how a floor-3 combat died with the
// model three times hitting `stop reason length` before emitting one character of
// JSON. Both budgets fail this way: wall-clock deadline, and output tokens the
// reasoning is spending before it reaches the answer.
const OUT_OF_BUDGET = /exceeded [\d.]+-second deadline|stop reason length|empty \w+ response/;

// An upstream provider that is busy, rate limited or dropped the connection has
// told us nothing about the plan: the model never got to answer. Refining against
// it asks the model to fix someone else's outage, and three refinement rounds end
// the room - which is how a floor-3 run died to three 429s in a row. Back off and
// ask again instead. Deliberately narrow: a model or plan error must still be
// refined, never retried blindly.
const TRANSIENT_UPSTREAM = /\b(?:429|50[0234])\b|rate[ _-]?limit|temporarily busy|overloaded|try again shortly|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i;

export function transientUpstream(message) {
  return TRANSIENT_UPSTREAM.test(message || '');
}

export function plannerGuidance(message) {
  if (OUT_OF_BUDGET.test(message || '')) {
    return 'The previous response ran out of budget before a plan arrived. No gameplay input was sent. Answer from the SAME observation with a concise valid plan; optional commentary may be omitted. Calculate the consequences and uncertainty relevant to this decision. If the available evidence is insufficient to act, report the issue instead of guessing.';
  }
  return 'The plan was rejected before any input was sent, so the scene is unchanged. Fix exactly what this message names and answer again from the same observation.';
}

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

/**
 * A card's cost as a number, or null when the arithmetic is not knowable.
 * The sensor reports cost as a STRING ("2", not 2), which silently disabled the
 * budget check below for every card in the game until a floor-3 plan spent 4
 * energy on a 3-energy turn and failed at the game with two cards already sent.
 * X-cost and unplayable cards report something that is not a number, and those
 * genuinely are unknowable, so they still skip the check rather than count zero.
 */
export function energyCost(cost) {
  const value = typeof cost === 'string' && /^\d+$/.test(cost.trim()) ? Number(cost) : cost;
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * What each member of the team is allowed to ask for. The split is the point:
 * a strategist that cannot name an element id cannot invent one, and a combat
 * agent that cannot press a raw button cannot wander off the fight. The
 * executor is the strictest reader of all - it accepts every concrete action
 * and refuses `intent`, so an unresolved goal can never reach the pad.
 */
export const ROLE_ACTIONS = {
  strategist: new Set(['buy', 'rest', 'leave', 'choose', 'intent', 'learn', 'recall', 'research', 'lookup', 'wait', 'report_issue']),
  combat: new Set(['play', 'use_potion', 'choose', 'end_turn', 'intent', 'learn', 'research', 'lookup', 'wait', 'report_issue']),
  actuator: new Set(['activate', 'navigate', 'input', 'path', 'elements', 'scout', 'use_potion', 'choose', 'buy', 'rest', 'leave', 'learn', 'wait', 'report_issue']),
};

export function validatePlan(plan, state, { role = null } = {}) {
  if (!plan || String(plan.observation ?? '').trim().toLowerCase() !== stateId(state)) throw new Error('stale or missing observation ID');
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
    const allowed = role ? ROLE_ACTIONS[role] : null;
    if (allowed && !allowed.has(action.type)) throw new Error(`the ${role} cannot use ${action.type}; its actions are ${[...allowed].join(', ')}`);
    if (action.type === 'intent') {
      // One intent per plan. It is a scene barrier by construction: the screen
      // it acts on is gone once it lands, so anything planned behind it was
      // planned against a screen that no longer exists.
      if (!role) throw new Error('an intent must be resolved into concrete input before it reaches the game');
      if (actions.length !== 1) throw new Error('one intent per plan; it ends at the screen it acts on');
      if (typeof action.goal !== 'string' || !action.goal.trim() || action.goal.length > 300) throw new Error('intent.goal must be a 1-300 character description of what you want done');
      if (action.target_label !== undefined && action.target_label !== null && (typeof action.target_label !== 'string' || !action.target_label.trim() || action.target_label.length > 80)) throw new Error('intent.target_label must be the on-screen name of the target, at most 80 characters');
    } else if (action.type === 'play') {
      if (!isCombat(state) || !Number.isInteger(action.card) || !state.player.hand.some(card => card.instance_id === action.card)) throw new Error('unknown card instance');
      if (action.target != null && typeof action.target !== 'string') throw new Error('invalid target');
      const card = state.player.hand.find(item => item.instance_id === action.card);
      if (card.target_type === 'AnyEnemy' && !state.battle.enemies.some(enemy => enemy.entity_id === action.target && enemy.hp > 0)) throw new Error('unknown enemy target');
    } else if (action.type === 'rest') {
      const options = state?.rest_site?.options;
      if (!Array.isArray(options) || !options.length) throw new Error('rest needs a rest site with options; a site reporting none is already resolved and is left with leave');
      const option = options.find(entry => entry.index === action.option);
      if (!Number.isInteger(action.option) || !option) throw new Error(`no rest option ${action.option}; the site offers ${options.map(entry => `${entry.index} (${entry.name})`).join(', ')}`);
      if (option.is_enabled === false) throw new Error(`${option.name} is not available here`);
      if (actions.indexOf(action) !== actions.length - 1) throw new Error('a rest option must be the last action in the plan; what it opens is only visible afterwards');
    } else if (action.type === 'leave') {
      if (actions.length !== 1) throw new Error('leave is standalone; the screen it acts on is gone afterwards');
    } else if (action.type === 'buy') {
      // Named by the index the shop itself publishes. Everything the runtime
      // needs to find the control - category, price, name - is on that entry.
      const items = state?.shop?.items;
      if (!Array.isArray(items) || !items.length) throw new Error('buy needs an open shop');
      const item = items.find(entry => entry.index === action.item);
      if (!Number.isInteger(action.item) || !item) throw new Error(`no shop item ${action.item}; the shop offers ${items.map(entry => `${entry.index} (${entry.card_name || entry.relic_name || entry.potion_name || entry.category}, ${entry.price})`).join(', ')}`);
      if (item.is_stocked === false) throw new Error(`shop item ${action.item} has already been bought`);
      if (item.can_afford === false) throw new Error(`${item.card_name || item.relic_name || item.potion_name || item.category} costs ${item.price} and you have ${state.player?.gold}`);
      if (actions.indexOf(action) !== actions.length - 1) throw new Error('a purchase must be the last action in the plan; what it opens is only visible afterwards');
    } else if (action.type === 'choose') {
      const screen = state?.hand_select || state?.card_select;
      if (!screen) throw new Error('choose needs an open card-selection screen');
      if (!Array.isArray(action.cards) || !action.cards.length || action.cards.length > 12 || !action.cards.every(Number.isInteger)) throw new Error('choose.cards must be 1-12 card indices from the open screen');
      if (new Set(action.cards).size !== action.cards.length) throw new Error('a card index may appear only once');
      for (const index of action.cards) {
        if (!(screen.cards || []).some(card => card.index === index)) throw new Error(`no card at index ${index}; the screen offers ${(screen.cards || []).map(card => `${card.index} (${card.name})`).join(', ')}`);
      }
      if (actions.indexOf(action) !== actions.length - 1) throw new Error('a choose must be the last action in the plan; what it does is only visible afterwards');
    } else if (action.type === 'use_potion') {
      // Named the way the state names it: a slot, and for a thrown potion the
      // combat_id it goes at. The runtime owns the presses.
      if (!isCombat(state)) throw new Error('a potion can only be used in combat this way');
      const potion = (state.player?.potions || []).find(item => item.slot === action.slot);
      if (!Number.isInteger(action.slot) || !potion) throw new Error(`no potion in slot ${action.slot}; player.potions holds slots ${(state.player?.potions || []).map(item => item.slot).join(', ') || 'none'}`);
      if (potion.can_use_in_combat === false) throw new Error(`${potion.name} cannot be used in this combat`);
      const thrown = ['AnyEnemy', 'AnyAlly'].includes(potion.target_type);
      if (thrown && !state.battle.enemies.some(enemy => enemy.combat_id === action.target && enemy.hp > 0)) throw new Error(`${potion.name} is ${potion.target_type} and needs target set to a living enemy's combat_id; living enemies are ${state.battle.enemies.filter(enemy => enemy.hp > 0).map(enemy => `${enemy.combat_id} (${enemy.name})`).join(', ')}`);
      if (!thrown && action.target != null) throw new Error(`${potion.name} is ${potion.target_type} and takes no target`);
      // A potion is a scene barrier, not an ordering rule, and this is the
      // second time the validator has been wrong about it. Requiring it LAST
      // was worse than the "standalone" rule it replaced: drinking and then
      // acting is the ordinary play - a Strength potion has to precede the
      // attacks it buffs - so the model wrote the potion first, the plan was
      // refused, and the cheapest way to satisfy the refusal was to DROP the
      // potion and re-send without it. That fired eight times in one run and
      // not one potion was drunk, through an elite fight the player was
      // holding potions for.
      //
      // Nothing downstream needs the ordering: the executor already stops the
      // batch after a potion and hands back a barrier, so actions planned past
      // it are simply not executed and the model replans from what the potion
      // actually did. Put it where the turn wants it.
      if (actions.filter(item => item.type === 'use_potion').length > 1) throw new Error('one potion per plan; the runtime stops the batch after it, so a second could never be reached');
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
      // Reading a note is not writing one. `learn` insists on lowercase so
      // proposals arrive in one naming style, but half the library shipped with
      // names like UNDERDOCKS_BOSSES.md, and requiring lowercase here made
      // every one of them unreadable: the real name was refused by the
      // validator and the lowercase name did not exist, so a run deadlocked
      // between the two and burned its whole refine budget. Case belongs to the
      // file; the check is for path safety.
      if (action.path !== undefined && (typeof action.path !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9/_-]{0,110}\.md$/.test(action.path) || action.path.includes('..') || action.path.includes('//'))) throw new Error('recall.path must be a .md path inside the strategy guide, exactly as it is named in known_notes');
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
  const costs = played.map(card => (card && !uncertainCard(card) ? energyCost(card.cost) : null));
  if (played.length > 1 && Number.isInteger(state.player?.energy) && costs.every(cost => cost !== null)) {
    const total = costs.reduce((sum, cost) => sum + cost, 0);
    if (total > state.player.energy) throw new Error(`this plan spends ${total} energy and the turn has ${state.player.energy}: ${played.map((card, index) => `${card.name} ${costs[index]}`).join(', ')}. Plan what the turn can pay for`);
  }
  if (new Set(actions.filter(a => a.type === 'play').map(a => a.card)).size !== played.length) throw new Error('a card instance may appear only once in a plan');
  if (plan.strategy != null && (typeof plan.strategy !== 'string' || plan.strategy.length > 1200)) throw new Error('strategy exceeds 1200 characters');
  if (plan.lesson != null && (typeof plan.lesson !== 'string' || plan.lesson.length > 600)) throw new Error('lesson exceeds 600 characters');
  if (typeof plan.note !== 'string' || !plan.note.trim() || plan.note.length > 1200) throw new Error('a learning note of 1–1200 characters is required');
  return plan;
}

export function uncertainCard(card) {
  // ...and a card that changes what a LATER card costs. Unrelenting reads
  // "Deal 15 damage. The next Attack you play costs 0", so Unrelenting, Strike,
  // Strike costs 2+0+1 = 3 and not the 4 its printed costs add up to. The
  // budget refused that turn three times over and spent the run's whole
  // refinement budget arguing with arithmetic the model had got right.
  return /draw|random|choose|select|discover|create|generate|(?:add|put|return|move).*hand|top card|replay|(?:gain|lose) .*energy|costs? (?:\d+ less|0|nothing)|free to play/i.test(card.description || '');
}
