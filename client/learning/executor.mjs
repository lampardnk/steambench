import { elements, pressableElement, targetElement, navigationPath } from './navigation.mjs';
import { indexNotes } from './retrieval.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { DIRECTIONS, isCardPlay, isCombat, noteProblem, planIdentity, progressId, ready, settleAnimation, startupTransition, stateId, uiMatches, unbuiltMenu, uncertainCard, validatePlan } from './state.mjs';

export const MAX_NOTE = 16000;

/** Files under learned/ outlive the room, so the player can see what it already wrote. */
export function learnedFiles(skillDir) { return indexNotes(skillDir).map(item => item.path).sort(); }

// How long to let a screen finish moving before planning against it, and how
// many reads to spend waiting. It returns as soon as two reads match, so a
// still screen costs one extra read; only a screen that keeps moving - a reward
// dealing its cards in - spends the budget, and 1.5s is shorter than the model
// call it protects.
// The combat screen's focus rows, top to bottom: potions, relics, the
// creatures, the hand. `down` walks them and wraps, so one full pass always
// finds the hand if the hand can be focused at all.
const COMBAT_FOCUS_ROWS = 4;
// How many times a screen may change shape under a route before it counts as
// unstable. One per press along a strip that redraws, plus room to settle.
const MAX_RESCENES = 12;
const QUIESCE_MS = 150;
const QUIESCE_READS = 10;

// Every note the player writes lands here as a proposal, in the room's skill
// copy, so it rides the end-of-room commit into the library's history where a
// human can read it. Nothing under this file is ever retrieved or inherited.
export const SCRATCHPAD_NOTE = 'scratchpad.md';
export const REFLECTION_HEADER = ['# Run reflection', '',
  'What this run learned, written as it happened and closed with the team\'s own',
  'reflection. NOT part of the library: nothing here is retrieved, inherited or',
  'trusted by a later room. A human reads it and decides what is worth keeping.', '', '---', ''].join('\n');

export class Executor {
  constructor({ call, record = () => {}, signal, skillDir = null }) {
    this.call = call;
    this.record = record;
    this.signal = signal;
    this.skillDir = skillDir;
    this.inputs = 0;
  }

  /**
   * Stage one proposed note in the scratchpad and commit it under the player's
   * own message. The player CANNOT write the library: every note it produced
   * went straight into the shared tree, where a single run's guess became a fact
   * the next room inherited, and the diary entries and near-duplicate control
   * notes accumulated faster than anyone could weed them. Notes are now
   * proposals appended to one file for a human to merge. action.path is the
   * destination it argues for, recorded as a label, never opened.
   *
   * Any problem is returned as a result, never thrown: a note is bookkeeping,
   * and losing it must not discard gameplay the plan already verified.
   */
  async keepNote(action) {
    const problem = noteProblem(action);
    if (problem) return { action, verified: false, error: `note not kept: ${problem}` };
    try {
      if (!this.skillDir) throw new Error('this room has no skill library; notes cannot be kept');
      const file = path.join(path.resolve(this.skillDir), SCRATCHPAD_NOTE);
      const entry = [`## ${action.path}`, '', `- proposed: ${new Date().toISOString()}`, `- message: ${action.message}`, '',
        action.content.trim(), '', '---', ''].join('\n');
      fs.appendFileSync(file, (fs.existsSync(file) ? '' : REFLECTION_HEADER) + entry);
      const response = await this.call({ op: 'skill-commit', message: action.message });
      return {
        action, verified: true, staged: SCRATCHPAD_NOTE, proposed_path: action.path,
        note: 'Staged for human review. It is NOT in the library and no later room will retrieve it.',
        commit: response?.commit || null, committed: Boolean(response?.committed),
      };
    } catch (error) {
      return { action, verified: false, error: `note not kept: ${error.message}` };
    }
  }

  /** Resolve a learned-note path inside this room's skill copy. */
  notePath(relative) {
    if (!this.skillDir) throw new Error('this room has no skill library; notes cannot be kept');
    const base = path.resolve(this.skillDir);
    const target = path.resolve(base, relative);
    if (target !== path.normalize(target) || !target.startsWith(base + path.sep)) throw new Error('note path escapes learned/');
    return target;
  }

  async sleep(milliseconds) {
    const started = Date.now();
    this.signal?.throwIfAborted();
    await new Promise(resolve => setTimeout(resolve, milliseconds));
    this.record({ type: 'overhead', kind: 'wait', milliseconds: Date.now() - started });
    this.signal?.throwIfAborted();
  }

  async observe() {
    this.signal?.throwIfAborted();
    const response = await this.call({ op: 'sts2-get', path: '/api/v1/singleplayer', query: { format: 'json' } });
    const raw = JSON.parse(response.body);
    if (!raw || typeof raw.state_type !== 'string') throw new Error('invalid game observation');
    // Settled here, once, so every reader downstream sees the same screen.
    const state = settleAnimation(raw);
    this.record({ type: 'sensor', state, inputCount: this.inputs });
    return state;
  }

  async settled(initial) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const state = attempt === 0 && initial ? initial : await this.observe();
      if (ready(state)) return state;
      await this.sleep(250);
    }
    throw new Error(unbuiltMenu(await this.observe())
      ? 'the game reports a menu with no controls after 10 seconds; the menu scene has not finished loading'
      : 'game did not reach an actionable state within 10 seconds');
  }

  /**
   * An actionable state that has also stopped moving. Planning takes seconds,
   * so a screen still playing its entrance animation has changed by the time
   * the plan arrives and the decision is thrown away unexecuted. Waiting for
   * two identical reads costs a few hundred milliseconds and saves a whole
   * model call. Some screens animate forever, so the wait is bounded and the
   * newest observation is used regardless.
   */
  async quiesced() {
    let state = await this.settled();
    let previous = stateId(state);
    for (let attempt = 0; attempt < QUIESCE_READS; attempt++) {
      await this.sleep(QUIESCE_MS);
      const next = await this.observe();
      if (!ready(next)) { state = await this.settled(next); previous = stateId(state); continue; }
      state = next;
      const current = stateId(state);
      if (current === previous) return state;
      previous = current;
    }
    this.record({ type: 'quiesce_timeout', stateType: state.state_type });
    return state;
  }

  async button(button) {
    this.signal?.throwIfAborted();
    this.inputs++;
    const request = ['up', 'down', 'left', 'right'].includes(button)
      ? { op: 'pad-dpad', direction: button, presses: 1 }
      : { op: 'pad-press', button, hold_ms: 80 };
    this.record({ type: 'input', button, request });
    const started = Date.now();
    await this.call(request);
    this.record({ type: 'overhead', kind: 'input', milliseconds: Date.now() - started });
    await this.sleep(180);
  }

  async navigateElement(action, before) {
    let state = before;
    // Edges that were pressed and did not land where the graph predicted.
    // Remembering one makes the retry take a different route instead of walking
    // into the same press again.
    const avoid = new Set();
    // The scene the route is being computed against. A screen that is still
    // arriving - a reward dealing its cards in - changes shape without anything
    // happening in the run, and treating that as fatal paused a run that had
    // just won its first fight. Gameplay advancing is the real hazard and is
    // still fatal; a settling screen only means the route must be recomputed,
    // which costs nothing because directional presses are reversible.
    let scene = action.scene;
    // A re-scene is not a failed attempt, so it does not spend the recovery
    // budget - it only has to be bounded. Moving focus along the potion strip
    // changes scene_id on EVERY press, because the holder under the cursor
    // draws its popup; a reward screen does the same while it deals its rows
    // in. Counting those as failures meant the budget was gone after two
    // presses and a run that was walking correctly towards its target was
    // paused for "navigation recovery budget exhausted".
    let rescenes = 0;
    for (let recovery = 0; recovery <= 2; recovery++) {
      if (progressId(state) !== progressId(before)) throw new Error('gameplay advanced during navigation; nothing further was sent');
      if (state.ui?.scene_id !== scene) {
        if (++rescenes > MAX_RESCENES) throw new Error('the screen kept changing while routing to this element');
        this.record({ type: 'navigation_rescene', from: scene, to: state.ui?.scene_id ?? null });
        scene = state.ui?.scene_id;
        recovery--;
        continue;
      }
      const target = targetElement(state, action.target);
      if (state.ui.focused_element === target.id) return state;
      // A freshly loaded screen can hold no focus at all, and a route has to
      // start from somewhere. A directional press is reversible and activates
      // nothing, so it is the safe way to make the screen adopt a focus before
      // routing from it.
      if (!state.ui.focused_element) {
        if (recovery === 2) {
          // Two reversible presses have already been spent trying to make the
          // screen adopt a focus. It has not, so this is a screen driven by
          // bound buttons rather than by the pad - saying "press a direction"
          // here sends the next plan back into what just failed. Name what is
          // actually reachable instead.
          const bound = elements(state).filter(item => item.press && item.enabled !== false).map(item => `${item.label || item.id} (${item.press})`);
          throw new Error(`this screen adopts no focus, so no route can start and ${action.target} cannot be reached by navigating${bound.length ? `; it is driven by bound buttons: ${bound.slice(0, 8).join(', ')}` : ''}`);
        }
        await this.button('down');
        state = await this.observe();
        continue;
      }
      let route;
      try { route = navigationPath(state, state.ui.focused_element, target.id, 12, avoid); }
      catch (error) {
        if (recovery === 2) throw error;
        state = await this.observe(); // read-only recovery; never invent a neighbor
        continue;
      }
      for (const step of route) {
        if (state.ui.focused_element !== step.from) break;
        await this.button(step.direction);
        state = await this.observe();
        if (progressId(state) !== progressId(before)) throw new Error('gameplay advanced during navigation; nothing further was sent');
        if (state.ui?.scene_id !== scene) break;
        // Standing on the target is the whole point of the route, so it ends
        // here whatever the graph expected. A reward screen names its rows
        // with auto-generated siblings (@Control@1848), so a step can land
        // correctly and still not equal the id the graph predicted; that used
        // to mark the walk failed and, on the last recovery pass, throw while
        // focus was already on the element the plan asked for.
        if (state.ui.focused_element === target.id) return state;
        if (state.ui.focused_element !== step.to) { avoid.add(`${step.from}|${step.direction}`); break; }
      }
      if (state.ui.focused_element === target.id) return state;
      // Only directions with unchanged gameplay are recoverable, twice at most.
    }
    throw new Error('navigation recovery budget exhausted; explicit resume required');
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

  /**
   * Combat focus is one vertical cycle - potions, relics, the creatures, the
   * hand - and `down` walks it, wrapping back to the hand. So a hand that has
   * lost focus is never more than a lap away.
   *
   * This used to press `down` exactly once and give up if that did not land on
   * a card. From the potion row it lands on relics, which is not the hand, so
   * it threw; the model then re-issued the same play, the same single press
   * happened again, and the run sat there. That was four supervisor pauses and
   * a turn thrown away on a screen where holding `down` would have worked.
   */
  async focusHand(before) {
    let path = before.ui?.focus_path ?? null;
    for (let lap = 0; lap < COMBAT_FOCUS_ROWS; lap++) {
      await this.button('down');
      for (let attempt = 0; attempt < 6; attempt++) {
        const state = await this.observe();
        if (state.ui?.focused_card != null) return state;
        if ((state.ui?.focus_path ?? null) !== path) { path = state.ui?.focus_path ?? null; break; }
        await this.sleep(100);
      }
    }
    throw new Error('a full pass of down never reached the hand; inspect the screenshot');
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
      if (state.ui.focused_card == null) state = await this.focusHand(state);
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
    } else if (!uncertainCard(card) && card.type === 'Power' && isCombat(state)) {
      // A Power goes to the power area, not to a pile, so the wait above has
      // nothing to count and skipped it entirely - and its buff and the energy it
      // spent were still landing when the next card's hand navigation began,
      // which reads as "gameplay changed during hand navigation" and kills a
      // batch that was doing exactly what it was asked to. With no pile to
      // count, wait for the state to stop moving instead. Only a card that
      // really has no pile destination: a missing pile count is a sensor gap and
      // must not quietly add a quiesce to every play.
      state = await this.quiesced();
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
    this.recoveries = 0;
    let state = await this.observe();
    if (planIdentity(state) !== planIdentity(observation)) {
      const error = new Error('state changed while planning; no input sent');
      error.code = 'stale_observation';
      error.state = state;
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
        if (action.type === 'elements' || action.type === 'path') {
          completed.push({ action, verified: true, ...(action.type === 'elements' ? { elements: elements(state) } : { path: navigationPath(state, action.from || state.ui.focused_element, action.target) }) });
        } else if (action.type === 'navigate' || action.type === 'activate') {
          // A control the game bound to a button is activated by pressing it,
          // from wherever focus happens to be. Some are reachable no other way:
          // a card reward's Skip sits outside a card row whose up and down
          // neighbours point back at itself, so there is no route to walk.
          const bound = action.type === 'activate' ? pressableElement(state, action.target).press : null;
          if (bound) {
            const fresh = await this.observe();
            const target = pressableElement(fresh, action.target);
            if (fresh.ui?.scene_id !== action.scene || progressId(fresh) !== progressId(state)) throw new Error('activation target became stale');
            if (!target.label || target.ambiguous || target.press !== bound) throw new Error('activation semantics are unknown; inspect screenshot and report issue');
            await this.button(bound);
            state = await this.settled();
            if (stateId(state) === stateId(fresh)) throw new Error('unknown activation outcome; explicit resume required');
            completed.push({ action, verified: true, pressed: bound, barrier: 'activation: replan from fresh scene' });
            this.record({ type: 'action', before, after: state, action, verified: true });
            break;
          }
          state = await this.navigateElement(action, state);
          if (action.type === 'activate') {
            // Re-read at the last possible moment; never retry an activation.
            const fresh = await this.observe();
            const target = targetElement(fresh, action.target);
            if (!target.label || target.ambiguous || target.activation !== 'a') throw new Error('activation semantics are unknown; inspect screenshot and report issue');
            // Against the scene navigation actually finished on, not the one the
            // plan was written against: a screen that settled while routing is
            // already handled there, and the real precondition is that the
            // intended element holds focus and nothing has happened since.
            if (fresh.ui?.scene_id !== state.ui?.scene_id || fresh.ui.focused_element !== action.target || progressId(fresh) !== progressId(state)) throw new Error('activation target became stale');
            await this.button('a');
            state = await this.settled();
            if (stateId(state) === stateId(fresh)) throw new Error('unknown activation outcome; explicit resume required');
            completed.push({ action, verified: true, barrier: 'activation: replan from fresh scene' });
            this.record({ type: 'action', before, after: state, action, verified: true });
            break;
          }
          completed.push({ action, verified: true });
        } else if (action.type === 'play') {
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
            && DIRECTIONS.includes(action.buttons[0]) && !action.expect && !isCardPlay(before));
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
            if (!fs.existsSync(file)) throw new Error(`no learned note at ${action.path}`);
            const text = fs.readFileSync(file, 'utf8');
            completed.push({ action, verified: true, path: action.path, truncated: text.length > MAX_NOTE, text: text.slice(0, MAX_NOTE) });
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
