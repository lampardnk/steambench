import fs from 'node:fs';
import path from 'node:path';
import { indexNotes, MAX_NOTE_IN_CONTEXT } from './retrieval.mjs';
import { isCombat, noteProblem, planIdentity, ready, semanticIdentity, settleAnimation, stateId, uncertainCard, validatePlan } from './state.mjs';

export const MAX_NOTE = MAX_NOTE_IN_CONTEXT;
export const SCRATCHPAD_NOTE = 'scratchpad.md';
export const PROPOSALS_HEADER = ['# Proposed factual corrections', '', 'Unreviewed, seed-invariant mechanics only.', 'Not retrieved or inherited until a human curates them.', '', '---', ''].join('\n');
export function learnedFiles(skillDir) { return indexNotes(skillDir).map(item => item.path).sort(); }

const QUIESCE_MS = 150;
const QUIESCE_READS = 10;
const VERIFY_MS = 10000;

function itemIndex(items, value, identity) {
  const item = (items || []).find(identity);
  if (!item) throw new Error(`semantic target ${JSON.stringify(value)} is no longer present`);
  const index = Number.isInteger(item.index) ? item.index : (items || []).indexOf(item);
  if (!Number.isInteger(index) || index < 0) throw new Error('STS2MCP did not publish an index for the semantic target');
  return index;
}

/** Resolve semantic identities only against the observation immediately before dispatch. */
export function resolveMcpAction(action, state) {
  switch (action.type) {
    case 'menu_select': return { action: action.type, params: { option: action.option, ...(action.seed ? { seed: action.seed } : {}) } };
    case 'play_card': return { action: action.type, params: { card_index: itemIndex(state.player?.hand, action.card, card => card.instance_id === action.card), ...(action.target ? { target: action.target } : {}) } };
    case 'use_potion': return { action: action.type, params: { slot: action.slot, ...(action.target ? { target: action.target } : {}) } };
    case 'discard_potion': return { action: action.type, params: { slot: action.slot } };
    case 'combat_select_card': return { action: action.type, params: { card_index: itemIndex(state.hand_select?.cards, action.card, card => card.instance_id === action.card) } };
    case 'claim_reward': return { action: action.type, params: { index: itemIndex(state.rewards?.items, action.reward, item => semanticIdentity('reward', item) === action.reward) } };
    case 'select_card_reward': return { action: action.type, params: { card_index: itemIndex(state.card_reward?.cards, action.card, item => semanticIdentity('card_reward', item) === action.card) } };
    case 'choose_event_option': return { action: action.type, params: { index: itemIndex(state.event?.options, action.option, item => semanticIdentity('event_option', item) === action.option) } };
    case 'choose_rest_option': return { action: action.type, params: { index: itemIndex(state.rest_site?.options, action.option, item => semanticIdentity('rest', item) === action.option) } };
    case 'shop_purchase': { const items = state.shop?.items || state.fake_merchant?.shop?.items; return { action: action.type, params: { index: itemIndex(items, action.item, item => semanticIdentity('shop_item', item) === action.item) } }; }
    case 'shop_back': return { action: action.type, params: {} };
    case 'choose_map_node': return { action: action.type, params: { index: itemIndex(state.map?.next_options, action.node, item => semanticIdentity('map', item) === action.node) } };
    case 'select_card': return { action: action.type, params: { index: itemIndex(state.card_select?.cards, action.card, item => semanticIdentity('card', item) === action.card) } };
    case 'select_bundle': return { action: action.type, params: { index: itemIndex(state.bundle_select?.bundles, action.bundle, item => semanticIdentity('bundle', item) === action.bundle) } };
    case 'select_relic': return { action: action.type, params: { index: itemIndex(state.relic_select?.relics, action.relic, item => semanticIdentity('relic', item) === action.relic) } };
    case 'claim_treasure_relic': return { action: action.type, params: { index: itemIndex(state.treasure?.relics, action.relic, item => semanticIdentity('relic', item) === action.relic) } };
    case 'crystal_sphere_set_tool': return { action: action.type, params: { tool: action.tool } };
    case 'crystal_sphere_click_cell': return { action: action.type, params: { x: action.x, y: action.y } };
    default: return { action: action.type, params: {} };
  }
}

function transitionVerified(action, before, after) {
  if (action.type === 'menu_select'
      && before.state_type === 'menu'
      && before.menu_screen === 'character_select'
      && before.selected_character === action.option
      && after.state_type === before.state_type
      && after.menu_screen === before.menu_screen
      && after.selected_character === action.option) return true;
  if (stateId(before) === stateId(after)) return false;
  if (action.type === 'play_card') return !after.player?.hand?.some(card => card.instance_id === action.card);
  if (action.type === 'use_potion' || action.type === 'discard_potion') {
    const old = before.player?.potions?.find(potion => potion.slot === action.slot);
    const current = after.player?.potions?.find(potion => potion.slot === action.slot);
    return !current || current.id !== old?.id;
  }
  return true;
}

function playBarrier(action, before, after) {
  if (!isCombat(after)) return 'combat completed';
  const card = before.player.hand.find(item => item.instance_id === action.card);
  if (uncertainCard(card)) return 'card effect requires fresh planning';
  const oldEnemies = (before.battle?.enemies || []).filter(e => e.hp > 0).map(e => e.entity_id);
  const newEnemies = (after.battle?.enemies || []).filter(e => e.hp > 0).map(e => e.entity_id);
  if (JSON.stringify(oldEnemies) !== JSON.stringify(newEnemies)) return 'enemy targets changed';
  const expected = before.player.hand.filter(item => item.instance_id !== action.card).map(item => item.instance_id).sort();
  const actual = (after.player?.hand || []).map(item => item.instance_id).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) return 'hand changed unexpectedly';
  if (after.state_type !== before.state_type || after.battle?.round !== before.battle?.round) return 'combat phase changed';
  return null;
}

function deferredPlayability(action, state) {
  if (action.type !== 'play_card') return false;
  const card = state.player?.hand?.find(item => item.instance_id === action.card);
  return card?.can_play === false && card.unplayable_reason === 'EnergyCostTooHigh';
}

const DEFERRED_PLAYABILITY_MS = 1000;

export class Executor {
  constructor({ call, record = () => {}, signal, skillDir = null, verifyMs = VERIFY_MS, pollMs = 150 }) { this.call = call; this.record = record; this.signal = signal; this.skillDir = skillDir; this.verifyMs = verifyMs; this.pollMs = pollMs; this.actions = 0; }
  async sleep(ms) {
    const started = Date.now(); this.signal?.throwIfAborted();
    await new Promise(resolve => setTimeout(resolve, ms));
    this.record({ type: 'overhead', kind: 'wait', milliseconds: Date.now() - started });
    this.signal?.throwIfAborted();
  }
  async observe() {
    this.signal?.throwIfAborted();
    const response = await this.call({ op: 'sts2-get', path: '/api/v1/singleplayer', query: { format: 'json' } });
    let raw;
    try { raw = JSON.parse(response.body); } catch { throw new Error('STS2MCP returned malformed game state'); }
    if (!raw || typeof raw.state_type !== 'string') throw new Error('invalid game observation');
    const state = settleAnimation(raw);
    this.record({ type: 'sensor', state, actionCount: this.actions });
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
  async quiesced() {
    let state = await this.settled();
    let previous = stateId(state);
    for (let attempt = 0; attempt < QUIESCE_READS; attempt++) {
      await this.sleep(QUIESCE_MS);
      const next = await this.observe();
      state = ready(next) ? next : await this.settled(next);
      const current = stateId(state);
      if (current === previous) return state;
      previous = current;
    }
    this.record({ type: 'quiesce_timeout', stateType: state.state_type });
    return state;
  }
  async verify(action, before) {
    const deadline = Date.now() + this.verifyMs;
    let after = before;
    while (Date.now() < deadline) {
      await this.sleep(this.pollMs);
      after = await this.observe();
      if (transitionVerified(action, before, after) && ready(after)) return after;
    }
    const error = new Error(`STS2MCP acknowledged ${action.type}, but its expected state transition was not observed within ${this.verifyMs / 1000}s`);
    error.after = after;
    throw error;
  }
  async keepNote(action) {
    const problem = noteProblem(action);
    if (problem) return { action, verified: false, error: `note not kept: ${problem}` };
    try {
      if (!this.skillDir) throw new Error('this room has no skill library');
      const file = path.join(path.resolve(this.skillDir), SCRATCHPAD_NOTE);
      const entry = [`## ${action.path}`, '', `- proposed: ${new Date().toISOString()}`, `- message: ${action.message}`, '', action.content.trim(), '', '---', ''].join('\n');
      fs.appendFileSync(file, (fs.existsSync(file) ? '' : PROPOSALS_HEADER) + entry);
      const response = await this.call({ op: 'skill-commit', message: action.message });
      return { action, verified: true, staged: SCRATCHPAD_NOTE, proposed_path: action.path, commit: response?.commit || null, committed: Boolean(response?.committed) };
    } catch (error) { return { action, verified: false, error: `note not kept: ${error.message}` }; }
  }
  notePath(relative) {
    if (!this.skillDir) throw new Error('this room has no skill library');
    const base = path.resolve(this.skillDir), target = path.resolve(base, relative);
    if (!target.startsWith(base + path.sep)) throw new Error('note path escapes skill directory');
    return target;
  }
  async execute(plan, observation) {
    validatePlan(plan, observation);
    let state = await this.observe();
    if (planIdentity(state) !== planIdentity(observation)) {
      return { completed: [], error: 'state changed while planning; no action dispatched', code: 'stale_observation', state, staleState: state, failedActionDispatched: false };
    }
    const completed = [];
    let dispatchedInPlan = false;
    const note = plan.actions.length > 1 && plan.actions.at(-1).type === 'learn' ? plan.actions.at(-1) : null;
    const steps = note ? plan.actions.slice(0, -1) : plan.actions;
    for (const action of steps) {
      const before = state;
      const actionsBefore = this.actions;
      let acknowledgement = null;
      try {
        if (['learn', 'recall', 'research', 'lookup', 'wait'].includes(action.type)) {
          if (action.type === 'learn') completed.push(await this.keepNote(action));
          else if (action.type === 'recall') {
            if (!action.path) completed.push({ action, verified: true, learned_files: learnedFiles(this.skillDir) });
            else { const file = this.notePath(action.path); if (!fs.existsSync(file)) throw new Error(`no learned note at ${action.path}`); const text = fs.readFileSync(file, 'utf8'); completed.push({ action, verified: true, path: action.path, truncated: text.length > MAX_NOTE, text: text.slice(0, MAX_NOTE) }); }
          } else if (action.type === 'research') { const page = await this.call({ op: 'web-get', url: action.url }); completed.push({ action, verified: true, ...page }); }
          else if (action.type === 'lookup') { const page = await this.call({ op: 'sts2-get', path: '/api/v1/wiki', query: { query: action.query, item_type: action.item_type || 'all', limit: 5, format: 'json' } }); completed.push({ action, verified: true, source: 'STS2MCP wiki', text: String(page.body).slice(0, 6000) }); }
          else { await this.sleep(action.seconds * 1000); state = await this.quiesced(); completed.push({ action, verified: stateId(state) !== stateId(before) }); }
          continue;
        }
        let fresh = await this.observe();
        // The first gameplay dispatch must still match the planner's exact
        // observation. Once a verified action has landed, STS2 may publish
        // delayed discard/status fields; semantic validation against the fresh
        // state below remains the guard for every later action.
        if (!dispatchedInPlan && planIdentity(fresh) !== planIdentity(before)) {
          const error = new Error('state changed immediately before dispatch; no action sent');
          error.code = 'stale_observation';
          throw error;
        }
        // Earlier verified actions may change energy, playability, targets, or
        // selection affordances. Re-run the semantic guard against the exact
        // state used for index resolution so a now-invalid later action is
        // refused before its POST. STS2 can briefly publish the energy
        // deduction before a one-shot next-attack discount reaches the card;
        // wait for that specific transient projection to settle.
        try {
          validatePlan({ observation: stateId(fresh), summary: plan.summary, actions: [action] }, fresh);
        } catch (error) {
          if (!dispatchedInPlan || !deferredPlayability(action, fresh)) throw error;
          this.record({ type: 'deferred_playability_wait', action, reason: fresh.player.hand.find(item => item.instance_id === action.card)?.unplayable_reason });
          const deadline = Date.now() + DEFERRED_PLAYABILITY_MS;
          while (Date.now() < deadline && deferredPlayability(action, fresh)) {
            await this.sleep(this.pollMs);
            fresh = await this.observe();
          }
          validatePlan({ observation: stateId(fresh), summary: plan.summary, actions: [action] }, fresh);
        }
        const wire = resolveMcpAction(action, fresh);
        this.signal?.throwIfAborted();
        this.actions++;
        dispatchedInPlan = true;
        this.record({ type: 'action_dispatch', request: { op: 'sts2-action', ...wire } });
        acknowledgement = await this.call({ op: 'sts2-action', ...wire });
        state = await this.verify(action, fresh);
        if (acknowledgement?.auditId) await this.call({ op: 'sts2-action-verify', id: acknowledgement.auditId, verification: 'verified' }).catch(() => {});
        const barrier = action.type === 'play_card' ? playBarrier(action, fresh, state) : `${action.type}: replan from fresh state`;
        const done = { action, mcp: wire, acknowledgement, verified: true, barrier };
        completed.push(done);
        this.record({ type: 'action', before: fresh, after: state, ...done });
        if (barrier) break;
      } catch (error) {
        if (acknowledgement?.auditId) await this.call({ op: 'sts2-action-verify', id: acknowledgement.auditId, verification: 'failed', detail: error.message }).catch(() => {});
        const after = error.after || await this.observe().catch(() => state);
        this.record({ type: 'action_failure', before, after, action, error: error.message, outcomeUnknown: error.code === 'sts2_action_outcome_unknown' });
        return { completed, error: error.message, code: error.code, state: after, ...(error.code === 'stale_observation' ? { staleState: after } : {}), failedActionDispatched: this.actions > actionsBefore, outcomeUnknown: error.code === 'sts2_action_outcome_unknown' };
      }
    }
    if (note) completed.push(await this.keepNote(note));
    this.record({ type: 'plan_result', before: observation, after: state, completed });
    return { completed, state };
  }
}
