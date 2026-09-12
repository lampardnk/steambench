import { compactState, isCombat, mapId, stateId } from './state.mjs';

const without = (state, keys) => {
  const result = { ...state };
  for (const key of keys) delete result[key];
  return result;
};

export function strategistState(state, { mapUnchanged = false } = {}) {
  const compact = without(compactState(state), ['battle']);
  if (compact.player) {
    compact.player = { ...compact.player };
    for (const pile of ['hand', 'draw_pile', 'discard_pile', 'exhaust_pile']) delete compact.player[pile];
  }
  if (mapUnchanged && compact.map) {
    const { nodes, ...map } = compact.map;
    compact.map = { ...map, full_graph_unchanged: true, node_count: nodes?.length };
  }
  return compact;
}

export function combatState(state) {
  const compact = without(compactState(state), ['map', 'deck']);
  if (compact.player) {
    compact.player = { ...compact.player };
    for (const pile of ['draw_pile', 'discard_pile', 'exhaust_pile']) delete compact.player[pile];
  }
  return compact;
}

export function strategistContext({ state, task, ladder, objectiveCheck, retrieved, lastResult, lastEncounter, instructions, strategy, accepted, notes, act1, counters, freshRunVerified, resumeExistingRun = false }) {
  const mapUnchanged = Boolean(strategy && lastResult?.after?.map_id && lastResult.after.map_id === mapId(state));
  return {
    task: task.slice(0, 3000),
    ...(freshRunVerified ? { task_startup_note: resumeExistingRun ? 'This verified run was interrupted by a game process restart. Select the advertised continue option exactly once to restore the preserved run; never abandon it.' : 'Startup is verified and this run is in progress. Never abandon, restart, or repeat startup after a reload.' } : {}),
    fresh_run_verified: freshRunVerified,
    resume_existing_run: resumeExistingRun,
    observation_id: stateId(state),
    state: strategistState(state, { mapUnchanged }),
    strategy, ...ladder, objective_check: objectiveCheck, retrieved_notes: retrieved,
    last_encounter: lastEncounter, act1_timer: act1, accepted_lessons: accepted,
    known_notes: notes.slice(0, 60), last_result: lastResult,
    user_instructions: instructions.slice(-3), ...counters,
  };
}

export function combatContext({ state, briefing, scratchpad, retrieved, lastResult, instructions, notes, counters }) {
  return {
    briefing, observation_id: stateId(state), state: combatState(state), encounter_scratchpad: scratchpad,
    retrieved_notes: retrieved,
    known_notes: notes.filter(path => /\/(?:normal|elite|boss|ancient|potion)\//.test(path) || /meta_strategy\/(?:buffs|debuffs|mechanics|keywords|cards|relics)\//.test(path)).slice(0, 40),
    last_result: lastResult, user_instructions: instructions.slice(-2), ...counters,
  };
}

export function briefing({ state, kind, strategy, objective, task }) {
  return {
    encounter: kind, encounter_id: state.encounter_id ?? null, act: state.run?.act ?? null,
    floor: state.run?.floor ?? null, ascension: state.run?.ascension ?? null,
    character: state.player?.character ?? null, entered_at_hp: state.player?.hp ?? null,
    max_hp: state.player?.max_hp ?? null, potions: state.player?.potions ?? [],
    relics: (state.player?.relics || []).map(({ id, name, description, counter }) => ({ id, name, description, counter })),
    standing_plan: strategy ? String(strategy).slice(0, 800) : null,
    objective: objective ? { text: objective.text, done_when: objective.done_when } : null,
    run_task: String(task || '').slice(0, 600),
  };
}

const AFTER_ENCOUNTER = new Set(['rewards', 'card_reward', 'combat_reward', 'game_over', 'map', 'rest_site', 'shop', 'event', 'unknown', 'boss_reward', 'chest', 'menu']);
export function encounterOver(state, fight) {
  if (!fight) return false;
  if (Number.isInteger(state?.run?.floor) && state.run.floor !== fight.floor) return true;
  // A few post-combat frames retain state_type "monster" while publishing a
  // completion message. Without battle and hand data there is no combat
  // action surface left; keep the encounter agent from planning that reward
  // transition as if it were another turn.
  if (!isCombat(state)) return true;
  return AFTER_ENCOUNTER.has(String(state?.state_type || '').toLowerCase());
}
export function encounterKind(state) {
  if (!isCombat(state)) return null;
  const type = String(state.state_type || '').toLowerCase();
  const node = String(state.map?.current_position?.type || '').toLowerCase();
  if (type.includes('boss') || node.includes('boss')) return 'boss';
  if (type.includes('elite') || node.includes('elite')) return 'elite';
  return 'normal';
}
