import { compactState, isCombat, mapId, stateId } from './state.mjs';

/**
 * What each member of the team is allowed to read.
 *
 * The sensor contains role-specific blocks. Each projection removes only the
 * blocks that role has no business reading; what survives remains the live
 * sensor data rather than a summary or paraphrase.
 */

const OMIT_FOR_STRATEGIST = ['ui', 'battle'];
const OMIT_FOR_COMBAT = ['ui', 'map', 'deck'];

function without(state, keys) {
  const result = { ...state };
  for (const key of keys) delete result[key];
  return result;
}

/**
 * Map, routing, drafting, shops, events, rest sites. No fight and no interface:
 * a fight belongs to its own encounter agent, and the pad belongs to the
 * actuator, so an element id in front of the strategist is only something to
 * hallucinate a route through.
 */
export function strategistState(state, { mapUnchanged = false } = {}) {
  const compact = without(compactState(state), OMIT_FOR_STRATEGIST);
  if (compact.player) {
    compact.player = { ...compact.player };
    for (const pile of ['hand', 'draw_pile', 'discard_pile', 'exhaust_pile']) delete compact.player[pile];
  }
  // A map that has not changed since the last decision does not need its 71
  // nodes sent again; the reachable options and the boss still do.
  if (mapUnchanged && compact.map) {
    const { nodes, ...map } = compact.map;
    compact.map = { ...map, full_graph_unchanged: true, node_count: nodes?.length };
  }
  return compact;
}

/**
 * One fight. No map, because routing belongs to the strategist; no permanent
 * deck, because the encounter scratchpad carries the combat piles and avoids
 * presenting duplicate card inventories.
 */
/**
 * Where things are, and what is half-done.
 *
 * The whole `ui` block used to be stripped for combat, on the grounds that a
 * play agent has no business routing to elements. It does not - but the block
 * also carries facts about the FIGHT that exist nowhere else, and dropping it
 * took them all. A human sees them by looking at the screen; this agent cannot
 * look, so they have to be handed over.
 *
 * - `targets` gives each enemy's combat_id and screen position. Position is
 *   relevant when an attack or effect uses the current target or orientation.
 * - The hand's screen order is not guaranteed to match `hand[].index`. Position
 *   is what the pad walks, so a plan naming a card must use the current observed
 *   hand-selection identity and screen order.
 * - A card can be half-played - lifted, awaiting a target - and the agent that
 *   has to finish it needs to know.
 */
function combatLayout(state) {
  const ui = state.ui || {};
  const targets = (ui.targets || [])
    .filter(t => t && Number.isFinite(t.x))
    .sort((a, b) => a.x - b.x)
    .map((t, position) => ({ combat_id: t.combat_id, position_left_to_right: position, x: t.x, y: t.y, hittable: t.hittable !== false }));
  const hand = (ui.elements || [])
    .filter(el => el.reference?.kind === 'card' && el.reference.instance_id != null && Array.isArray(el.bounds))
    .sort((a, b) => a.bounds[0] - b.bounds[0])
    .map((el, position) => ({ instance_id: el.reference.instance_id, name: el.label ?? null, position_left_to_right: position }));
  return {
    enemy_positions: targets,
    hand_left_to_right: hand,
    ...(ui.in_card_play ? { in_card_play: true, selected_card: ui.selected_card ?? null } : {}),
    ...(ui.targeting ? { targeting: true, aimed_at_combat_id: ui.focused_creature ?? null } : {}),
    focused_card: ui.focused_card ?? null,
    note: 'Positions are screen order, which is what the pad walks and what an untargeted attack resolves against. hand_left_to_right is NOT hand[].index order.',
  };
}

export function combatState(state) {
  const compact = without(compactState(state), OMIT_FOR_COMBAT);
  if (compact.player) {
    compact.player = { ...compact.player };
    // Pile membership reaches this agent through encounter_scratchpad, grouped
    // and counted. Draw order is not knowable and listing the pile invites a
    // plan that assumes it.
    for (const pile of ['draw_pile', 'discard_pile', 'exhaust_pile']) delete compact.player[pile];
  }
  compact.layout = combatLayout(state);
  return compact;
}

/**
 * A control worth naming to the actuator. Decoration - a tooltip, a keyword
 * blurb, a top-bar readout - is mouse-focusable in Godot and so arrives in the
 * element list looking addressable. It is not: the pad cannot land on it and no
 * button is bound to it, so it is nothing but a plausible wrong answer.
 */
export function addressable(item, focusedId) {
  if (item.visible === false) return false;
  if (item.id === focusedId) return true;
  if (item.press || (Array.isArray(item.hotkeys) && item.hotkeys.length)) return true;
  if (item.focus_mode === undefined) return item.selectable === true;
  return item.focus_mode === 'all';
}

/** The element list as the actuator reads it: identity, label, and how to reach it. */
/** Godot instance ids increase, so the larger id is the later node. */
const generation = item => Number(String(item?.id ?? '').replace(/\D/g, '')) || 0;

/**
 * Collapse the ghosts of rebuilt overlays.
 *
 * Reopening a preview can leave an earlier generation's nodes in the tree, still
 * reported visible and still focusable. Same-label, same-bounds elements are the
 * same thing on screen; keep the later node, because that is the generation the
 * game is driving.
 */
export function dedupeElements(items = []) {
  const out = [];
  const at = new Map();
  for (const item of items) {
    const bounds = Array.isArray(item?.bounds) ? item.bounds.join(',') : null;
    if (!item?.label || !bounds) { out.push(item); continue; }
    const key = `${item.label}|${bounds}`;
    const index = at.get(key);
    if (index === undefined) { at.set(key, out.length); out.push(item); continue; }
    if (generation(item) > generation(out[index])) out[index] = item;
  }
  return out;
}

export function actuatorElements(state) {
  const focused = state.ui?.focused_element ?? null;
  return dedupeElements(state.ui?.elements || [])
    .filter(item => addressable(item, focused))
    .map(({ id, label, press, hotkeys, activation, selectable, enabled, focus_mode }) => ({
      id, label: label ?? null, ...(press ? { press } : {}), ...(hotkeys?.length ? { hotkeys } : {}),
      ...(activation ? { activation } : {}), selectable: selectable === true, enabled: enabled === true,
      ...(focus_mode ? { focus_mode } : {}),
      ...(id === focused ? { focused: true } : {}),
    }));
}

/**
 * The pad's whole world: one goal handed down by whoever is playing, the
 * controls on screen, and the notes about this screen. No deck, no map, no
 * objective, no strategy - an actuator that can weigh the play is an actuator
 * that will second-guess the agent that asked for it.
 */
export function actuatorContext(state, intent, { notes = [], controlNotes = [], lastResult = null, instructions = [], from = 'strategist', counters = {} } = {}) {
  return {
    requested_by: from,
    goal: String(intent?.goal || '').slice(0, 300),
    target_label: intent?.target_label ? String(intent.target_label).slice(0, 80) : null,
    observation_id: stateId(state),
    scene_id: state.ui?.scene_id ?? null,
    state_type: state.state_type,
    menu_screen: state.menu_screen ?? null,
    focused_element: state.ui?.focused_element ?? null,
    focus_path: state.ui?.focus_path ?? null,
    focus_type: state.ui?.focus_type ?? null,
    elements: actuatorElements(state),
    elements_truncated: state.ui?.elements_truncated === true,
    controls_notes: controlNotes,
    known_control_notes: notes.filter(path => /(?:^|\/)controls\//.test(path)).slice(0, 24),
    last_result: lastResult,
    user_instructions: instructions.slice(-2),
    // The probe and note guards are the actuator's own: it is the member that
    // presses directions, so it is the one that has to be told it is repeating.
    ...counters,
  };
}

/** Notes matching the screen, split by who they are for. */
export function splitNotes(retrieved) {
  const control = retrieved.filter(note => /(?:^|\/)controls\//.test(note.path));
  return { control, play: retrieved.filter(note => !control.includes(note)) };
}

export function strategistContext({ state, task, ladder, objectiveCheck, retrieved, lastResult, lastEncounter, instructions, strategy, accepted, notes, act1, counters, freshRunVerified }) {
  const mapUnchanged = Boolean(strategy && lastResult?.after?.map_id && lastResult.after.map_id === mapId(state));
  return {
    // The standing task is the kickoff, which opens by demanding a fresh run and
    // the abandonment of any existing one. Once startup is verified that clause
    // is not merely spent, it CONTRADICTS the screen - and a player reloaded
    // mid-run reads it against Act 2 floor 21 and quite correctly refuses to
    // act. Say plainly that the startup half is done and only the play half
    // still stands.
    task: task.slice(0, 3000),
    ...(freshRunVerified ? { task_startup_note: 'Startup is already verified and this run is in progress. The startup half of the task - abandon any pre-existing run, choose the character, Embark - is DONE and must never be repeated, including after a reload. Only the play-the-run half still stands.' } : {}),
    fresh_run_verified: freshRunVerified,
    observation_id: stateId(state),
    state: strategistState(state, { mapUnchanged }),
    strategy,
    ...ladder,
    objective_check: objectiveCheck,
    retrieved_notes: splitNotes(retrieved).play,
    last_encounter: lastEncounter,
    act1_timer: act1,
    accepted_lessons: accepted,
    known_notes: notes.slice(0, 60),
    last_result: lastResult,
    user_instructions: instructions.slice(-3),
    ...counters,
  };
}

export function combatContext({ state, briefing, scratchpad, retrieved, lastResult, instructions, notes, counters }) {
  return {
    briefing,
    observation_id: stateId(state),
    state: combatState(state),
    encounter_scratchpad: scratchpad,
    retrieved_notes: splitNotes(retrieved).play,
    known_notes: notes.filter(path => /\/(?:normal|elite|boss|ancient|potion)\//.test(path) || /meta_strategy\/(?:buffs|debuffs|mechanics|keywords|cards|relics)\//.test(path)).slice(0, 40),
    last_result: lastResult,
    user_instructions: instructions.slice(-2),
    ...counters,
  };
}

/**
 * What the encounter agent is told when it opens. Built from live state rather
 * than asked for, so opening a fight costs no model call: the strategist's
 * standing plan and the objective are already written down.
 */
export function briefing({ state, kind, strategy, objective, task }) {
  return {
    encounter: kind,
    act: state.run?.act ?? null,
    floor: state.run?.floor ?? null,
    ascension: state.run?.ascension ?? null,
    character: state.player?.character ?? null,
    entered_at_hp: state.player?.hp ?? null,
    max_hp: state.player?.max_hp ?? null,
    potions: state.player?.potions ?? [],
    relics: (state.player?.relics || []).map(({ id, name, description, counter }) => ({ id, name, description, counter })),
    standing_plan: strategy ? String(strategy).slice(0, 800) : null,
    objective: objective ? { text: objective.text, done_when: objective.done_when } : null,
    run_task: String(task || '').slice(0, 600),
  };
}

/** Which encounter this is, or null when there is no fight. */
/**
 * Screens that mean the encounter is genuinely behind you.
 *
 * A fight used to end the moment the screen stopped LOOKING like combat, and a
 * Colorless Potion is enough to do that: it opens a card-choice screen carrying
 * no hand, so isCombat went false mid-elite, encounterKind returned null, and
 * the runtime closed the fight with the "not at 0 HP, so won" fallback. Bygone
 * Effigy was alive at 33 HP and the player at 46/80; the report said "won, 11
 * HP" and the potion was spent for nothing.
 *
 * An overlay a card or potion opened - card_select, hand_select, a grid - is
 * still the fight. The encounter is over when the game has left it.
 */
const AFTER_ENCOUNTER = new Set(['rewards', 'card_reward', 'combat_reward', 'game_over', 'map', 'rest_site', 'shop', 'event', 'unknown', 'boss_reward', 'chest', 'menu']);

export function encounterOver(state, fight) {
  if (!fight) return false;
  // The floor moved: whatever happened, this fight is not it any more.
  if (Number.isInteger(state?.run?.floor) && state.run.floor !== fight.floor) return true;
  return AFTER_ENCOUNTER.has(String(state?.state_type || '').toLowerCase());
}

export function encounterKind(state) {
  if (!isCombat(state)) return null;
  const type = String(state.state_type || '').toLowerCase();
  if (type.includes('boss')) return 'boss';
  if (type.includes('elite')) return 'elite';
  const node = String(state.map?.current_position?.type || '').toLowerCase();
  if (node.includes('boss')) return 'boss';
  if (node.includes('elite')) return 'elite';
  return 'normal';
}
