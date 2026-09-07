import fs from 'node:fs';
import path from 'node:path';
import { DIRECTIONS, isCombat, noteProblem, progressId, ready, startupTransition, stateId, uiMatches, uncertainCard, validatePlan } from './state.mjs';

export const MAX_NOTE = 8000;

/** Files under learned/ outlive the room, so the player can see what it already wrote. */
export function learnedFiles(skillDir) {
  const base = path.join(skillDir || '', 'learned');
  const out = [];
  const walk = (relative) => {
    for (const entry of fs.readdirSync(path.join(base, relative), { withFileTypes: true })) {
      const next = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(next);
      else if (entry.isFile()) out.push(next);
    }
  };
  try { walk(''); } catch { return []; }
  return out.sort();
}

export class Executor {
  constructor({ call, record = () => {}, signal, skillDir = null }) {
    this.call = call;
    this.record = record;
    this.signal = signal;
    this.skillDir = skillDir;
    this.inputs = 0;
  }

  /**
   * Write one durable note and commit it under the player's own message. Any
   * problem is returned as a result, never thrown: a note is bookkeeping, and
   * losing it must not discard gameplay the plan already verified.
   */
  async keepNote(action) {
    const problem = noteProblem(action);
    if (problem) return { action, verified: false, error: `note not kept: ${problem}` };
    try {
      const file = this.notePath(action.path);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const existed = fs.existsSync(file);
      fs.writeFileSync(file, action.content.endsWith('\n') ? action.content : `${action.content}\n`);
      const response = await this.call({ op: 'skill-commit', message: action.message });
      return { action, verified: true, path: `learned/${action.path}`, replaced: existed, commit: response?.commit || null, committed: Boolean(response?.committed) };
    } catch (error) {
      return { action, verified: false, error: `note not kept: ${error.message}` };
    }
  }

  /** Resolve a learned-note path inside this room's skill copy. */
  notePath(relative) {
    if (!this.skillDir) throw new Error('this room has no skill library; notes cannot be kept');
    const base = path.join(this.skillDir, 'learned');
    const target = path.resolve(base, relative);
    if (target !== path.normalize(target) || !target.startsWith(base + path.sep)) throw new Error('note path escapes learned/');
    return target;
  }

  async sleep(milliseconds) {
    this.signal?.throwIfAborted();
    await new Promise(resolve => setTimeout(resolve, milliseconds));
    this.signal?.throwIfAborted();
  }

  async observe() {
    this.signal?.throwIfAborted();
    const response = await this.call({ op: 'sts2-get', path: '/api/v1/singleplayer', query: { format: 'json' } });
    const state = JSON.parse(response.body);
    if (!state || typeof state.state_type !== 'string') throw new Error('invalid game observation');
    this.record({ type: 'sensor', state, inputCount: this.inputs });
    return state;
  }

  async settled(initial) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const state = attempt === 0 && initial ? initial : await this.observe();
      if (ready(state)) return state;
      await this.sleep(250);
    }
    throw new Error('game did not reach an actionable state within 10 seconds');
  }

  async button(button) {
    this.signal?.throwIfAborted();
    this.inputs++;
    const request = ['up', 'down', 'left', 'right'].includes(button)
      ? { op: 'pad-dpad', direction: button, presses: 1 }
      : { op: 'pad-press', button, hold_ms: 80 };
    this.record({ type: 'input', button, request });
    await this.call(request);
    await this.sleep(180);
  }

  async focusChange(button, before, field) {
    await this.button(button);
    for (let attempt = 0; attempt < 6; attempt++) {
      const state = await this.observe();
      if (state.ui?.[field] !== before.ui?.[field]) return state;
      await this.sleep(100);
    }
    throw new Error(`${button} did not change ${field}; refusing another navigation input`);
  }

  async navigateHand(cardId, before) {
    const hand = [...before.player.hand].sort((a, b) => a.index - b.index);
    const focused = hand.findIndex(card => card.instance_id === before.ui.focused_card);
    const desired = hand.findIndex(card => card.instance_id === cardId);
    if (focused < 0 || desired < 0 || before.ui.in_card_play) throw new Error('cannot establish hand focus; inspect the screenshot');
    const distance = desired - focused;
    if (!distance) return before;
    if (Math.abs(distance) > 12) throw new Error('hand navigation exceeds 12 presses');
    for (let step = 0; step < Math.abs(distance); step++) await this.button(distance < 0 ? 'left' : 'right');
    // One check for the complete deterministic segment, never one model call per click.
    for (let attempt = 0; attempt < 6; attempt++) {
      const state = await this.observe();
      if (progressId(state) !== progressId(before) || state.ui?.in_card_play) throw new Error('gameplay changed during hand navigation');
      if (state.ui?.focused_card === cardId) return state;
      await this.sleep(100);
    }
    throw new Error('hand navigation did not reach intended card; refusing selection');
  }

  async play(action, before, targetCombatId) {
    if (!ready(before) || !isCombat(before)) throw new Error('not an actionable combat');
    const card = before.player.hand.find(item => item.instance_id === action.card);
    if (!card?.can_play) throw new Error(`card cannot be played: ${card?.unplayable_reason || 'not in hand'}`);
    const target = before.battle.enemies.find(enemy => targetCombatId != null ? enemy.combat_id === targetCombatId : enemy.entity_id === action.target);
    if (card.target_type === 'AnyEnemy' && (!target || target.hp <= 0)) throw new Error('the originally observed enemy target is no longer alive');
    if (card.target_type === 'AnyAlly') throw new Error('ally targeting is not supported by the play helper');
    let state = before;
    if (state.ui?.hand_mode !== 'Play') throw new Error(`hand is not in Play mode: ${state.ui?.hand_mode || 'missing UI sensor'}`);
    if (state.ui.in_card_play && state.ui.selected_card !== action.card) {
      state = await this.focusChange('b', state, 'in_card_play');
      if (state.ui.in_card_play) throw new Error('could not cancel a different card selection');
    }
    if (!state.ui.in_card_play) {
      if (state.ui.focused_card == null) {
        state = await this.focusChange('down', state, 'focused_card');
      }
      state = await this.navigateHand(action.card, state);
      if (state.ui?.focused_card !== action.card) throw new Error('failed to focus intended card');
      await this.button('a');
      for (let attempt = 0; attempt < 10; attempt++) {
        state = await this.observe();
        if (state.ui?.in_card_play || !state.player?.hand?.some(item => item.instance_id === action.card)) break;
        await this.sleep(100);
      }
    }
    if (state.player?.hand?.some(item => item.instance_id === action.card)) {
      if (!state.ui?.in_card_play || state.ui.selected_card !== action.card) throw new Error('intended card is not selected; refusing confirmation');
      if (card.target_type === 'AnyEnemy') {
        for (let attempt = 0; attempt < before.battle.enemies.length * 2 + 2; attempt++) {
          if (state.ui.focused_creature === target.combat_id) break;
          const focused = state.ui.targets?.find(item => item.combat_id === state.ui.focused_creature);
          const desired = state.ui.targets?.find(item => item.combat_id === target.combat_id && item.hittable);
          if (!focused || !desired || !state.ui.targeting || state.ui.selected_card !== action.card) throw new Error('cannot verify enemy target focus');
          const horizontal = desired.x - focused.x;
          const vertical = desired.y - focused.y;
          const direction = Math.abs(horizontal) >= Math.abs(vertical) ? (horizontal < 0 ? 'left' : 'right') : (vertical < 0 ? 'up' : 'down');
          state = await this.focusChange(direction, state, 'focused_creature');
        }
        if (!state.ui.targeting || state.ui.focused_creature !== target.combat_id) throw new Error('failed to focus intended enemy');
      }
      if (state.ui.selected_card !== action.card) throw new Error('card selection changed before confirmation');
      await this.button('a');
    }
    for (let attempt = 0; attempt < 24; attempt++) {
      state = await this.observe();
      if (!isCombat(state) || (!state.player.hand.some(item => item.instance_id === action.card) && !state.ui?.in_card_play)) break;
      await this.sleep(200);
    }
    if (isCombat(state) && (state.player.hand.some(item => item.instance_id === action.card) || state.ui?.in_card_play)) throw new Error('intended card was not played');
    state = await this.settled(state);
    // Hand removal precedes the discard/exhaust animation. For an ordinary card,
    // wait for its destination before another navigation segment can begin.
    const pileCount = value => [value.player?.discard_pile_count, value.player?.exhaust_pile_count].every(Number.isFinite)
      ? value.player.discard_pile_count + value.player.exhaust_pile_count : null;
    const priorPiles = pileCount(before);
    if (!uncertainCard(card) && ['Attack', 'Skill'].includes(card.type) && priorPiles !== null) {
      const pending = () => isCombat(state) && state.state_type === before.state_type && state.ui?.hand_mode === 'Play'
        && pileCount(state) !== null && pileCount(state) < priorPiles + 1;
      for (let attempt = 0; pending() && attempt < 24; attempt++) {
        await this.sleep(100);
        state = await this.observe();
      }
      if (pending()) throw new Error('played card destination did not settle; stopping before further input');
    }
    const previous = new Set(before.player.hand.map(item => item.instance_id));
    const removed = before.player.hand.filter(item => !state.player?.hand?.some(next => next.instance_id === item.instance_id));
    const unexpected = isCombat(state) && (removed.some(item => item.instance_id !== action.card) || state.player.hand.some(item => !previous.has(item.instance_id)));
    const roster = value => value.battle?.enemies.filter(enemy => enemy.hp > 0).map(enemy => [enemy.combat_id, enemy.entity_id]);
    const rosterChanged = JSON.stringify(roster(state)) !== JSON.stringify(roster(before));
    const barrier = uncertainCard(card) ? 'card effect requires fresh planning' : unexpected ? 'hand changed'
      : rosterChanged ? 'enemy targets changed' : !isCombat(state) ? 'combat completed'
        : state.ui?.hand_mode !== 'Play' || state.state_type !== before.state_type ? 'selection or scene changed'
          : state.battle?.round !== before.battle.round ? 'round changed' : null;
    return { state, barrier, card: card.name };
  }

  async execute(plan, observation) {
    validatePlan(plan, observation);
    let state = await this.observe();
    if (stateId(state) !== plan.observation) {
      const error = new Error('state changed while planning; no input sent');
      error.code = 'stale_observation';
      throw error;
    }
    const completed = [];
    // A note closing the plan records what the plan verified, so it is written
    // after the gameplay actions - including when a barrier stopped them early.
    const note = plan.actions.length > 1 && plan.actions.at(-1).type === 'learn' ? plan.actions.at(-1) : null;
    // A trailing note sends nothing, so everything downstream reasons about the
    // gameplay actions alone - the same slice validatePlan checks against.
    const steps = note ? plan.actions.slice(0, -1) : plan.actions;
    for (const action of steps) {
      const before = state;
      try {
        if (action.type === 'play') {
          const targetCombatId = observation.battle?.enemies.find(enemy => enemy.entity_id === action.target)?.combat_id;
          const result = await this.play(action, before, targetCombatId);
          state = result.state;
          completed.push({ action, verified: true, card: result.card, barrier: result.barrier });
          if (result.barrier) {
            this.record({ type: 'action', before, after: state, action, verified: true, barrier: result.barrier });
            break;
          }
        } else if (action.type === 'end_turn') {
          if (!isCombat(state) || !ready(state) || state.ui?.hand_mode !== 'Play') throw new Error('not ready to end turn');
          if (state.ui.in_card_play) {
            state = await this.focusChange('b', state, 'in_card_play');
            if (state.ui.in_card_play) throw new Error('card selection did not cancel before end turn');
          }
          await this.button('y');
          for (let attempt = 0; attempt < 40; attempt++) {
            await this.sleep(250);
            state = await this.observe();
            if (!isCombat(state) || (state.battle.round !== before.battle.round && ready(state))) break;
          }
          if (isCombat(state) && (state.battle.round === before.battle.round || !ready(state))) throw new Error('end turn was not confirmed');
          completed.push({ action, verified: true });
        } else if (action.type === 'input') {
          if (action.from && !uiMatches(state, action.from)) throw new Error('UI sequence precondition changed; no sequence input sent');
          for (const button of action.buttons) await this.button(button);
          const traveling = before.state_type === 'map' && action.buttons.join(',') === 'a';
          for (let attempt = 0; attempt < (traveling ? 40 : 6); attempt++) {
            state = await this.settled();
            const changed = stateId(state) !== stateId(before) && (!traveling || state.state_type !== 'map');
            if (changed && (!action.expect || uiMatches(state, action.expect))) break;
            await this.sleep(250);
          }
          if (traveling && state.state_type === 'map') throw new Error('map travel did not leave the map within 10 seconds; stopping before further input');
          // One reversible directional press is a probe whether or not it says so: an unchanged
          // focus is the answer (already at that edge), not a fault. Opaque @Control@NNNN labels
          // make this the only way to locate focus. Every other sequence still pauses.
          const probing = action.probe || (steps.length === 1 && action.buttons.length === 1
            && DIRECTIONS.includes(action.buttons[0]) && !action.expect && !isCombat(before));
          if (probing && stateId(state) === stateId(before)) {
            completed.push({ action, buttons: action.buttons, verified: true, moved: false, detail: 'Focus did not move, so it was already at that edge of the reachable options.' });
            this.record({ type: 'action', before, after: state, action, verified: true, moved: false });
            break;
          }
          if (stateId(state) === stateId(before)) throw new Error('UI sequence produced no observed change; stopping before further input');
          // A wrong prediction is not a failed action. What the gate protects
          // against is sending the NEXT input into a scene that is not the one
          // planned for - so on the last step, with the scene demonstrably
          // changed and nothing left to send, a missed expectation is reported
          // as an unmet hypothesis and the planner decides from fresh state.
          // Sibling focus paths are auto-generated and genuinely unpredictable,
          // and pausing a run over one turned successful actions into incidents.
          const missed = action.expect && !uiMatches(state, action.expect);
          const last = action === steps.at(-1);
          if (missed && !last) throw new Error('UI sequence did not reach expected screen/focus; stopping before further input');
          if (missed) {
            completed.push({ action, buttons: action.buttons, verified: true, expectation_missed: { expected: action.expect, observed: { state_type: state.state_type, menu_screen: state.menu_screen ?? null, focus_path: state.ui?.focus_path ?? null } }, detail: 'The action changed the scene but not into what you predicted. Nothing further was sent; decide from fresh state, and do not predict a sibling focus path again.' });
            this.record({ type: 'action', before, after: state, action, verified: true, expectationMissed: true });
            break;
          }
          const navigation = action.buttons.every(button => DIRECTIONS.includes(button));
          if (navigation && progressId(state) !== progressId(before)) throw new Error('navigation changed gameplay unexpectedly; stopping before further input');
          const barrier = !navigation && !startupTransition(before, action);
          completed.push({ action, buttons: action.buttons, verified: true, barrier, ...(probing ? { moved: true } : {}) });
          if (barrier) {
            this.record({ type: 'action', before, after: state, action, verified: true, barrier: true });
            break;
          }
        } else if (action.type === 'scout') {
          const request = { op: 'pad-stick', stick: action.stick || 'left', x: 0, y: action.direction === 'up' ? -1 : 1, hold_ms: action.hold_ms };
          this.signal?.throwIfAborted();
          this.inputs++;
          this.record({ type: 'input', request });
          await this.call(request);
          await this.sleep(250);
          state = await this.settled();
          if (progressId(state) !== progressId(before)) throw new Error('map scouting changed gameplay state unexpectedly; inspect before further input');
          completed.push({ action, verified: false, transport_acknowledged: true, visual_check_required: true, detail: 'Map scrolling may not change mod JSON. Check the next image; do not infer camera movement from acknowledgement.' });
        } else if (action.type === 'lookup') {
          const response = await this.call({ op: 'sts2-get', path: '/api/v1/wiki', query: { query: action.query, item_type: action.item_type || 'all', limit: 5, format: 'json' } });
          state = await this.observe();
          const reference = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
          completed.push({ action, verified: true, source: 'STS2MCP /api/v1/wiki; reference, not live combat modifiers', reference: reference.slice(0, 6000), truncated: reference.length > 6000 });
        } else if (action.type === 'learn') {
          // Durable knowledge for later rooms, committed to the library under the
          // player's own message. Notes are reference data, never instructions.
          completed.push(await this.keepNote(action));
        } else if (action.type === 'recall') {
          if (!action.path) {
            completed.push({ action, verified: true, learned_files: learnedFiles(this.skillDir) });
          } else {
            const file = this.notePath(action.path);
            if (!fs.existsSync(file)) throw new Error(`no learned note at learned/${action.path}`);
            const text = fs.readFileSync(file, 'utf8');
            completed.push({ action, verified: true, path: `learned/${action.path}`, truncated: text.length > MAX_NOTE, text: text.slice(0, MAX_NOTE) });
          }
        } else if (action.type === 'research') {
          const page = await this.call({ op: 'web-get', url: action.url });
          completed.push({ action, verified: true, source: page.url, retrieved: page.retrieved, provenance: page.provenance, truncated: Boolean(page.truncated), text: page.text });
        } else if (action.type === 'wait') {
          await this.sleep(1000);
          state = await this.settled();
          completed.push({ action, verified: stateId(state) !== stateId(before) });
        } else throw new Error('report_issue must be handled without gameplay by the supervisor');
        this.record({ type: 'action', before, after: state, action, verified: completed.at(-1)?.verified });
      } catch (error) {
        this.record({ type: 'action_failure', before, action, error: error.message });
        const after = await this.observe().catch(() => state);
        return { completed, error: error.message, state: after };
      }
    }
    if (note) completed.push(await this.keepNote(note));
    this.record({ type: 'plan_result', before: observation, after: state, completed });
    return { completed, state };
  }
}
