import { across, elements, navigationPath, panelEntrance, pressableElement, targetElement, towards } from './navigation.mjs';

/**
 * A card-selection screen that does not report what is selected.
 *
 * "Choose 2 Common Cards to Add to Your Deck" carries the candidates and
 * can_confirm and nothing else - no selected list, no per-card flag. So picking
 * the FIRST card changes nothing an observer can see, and the guard that
 * catches presses which did nothing cannot tell the difference. It fired on
 * every multi-select reward screen. can_confirm flipping is the only signal,
 * and it only arrives once enough cards are picked.
 */
function unreportedSelection(state, target) {
  if (!state?.card_select && !state?.hand_select) return false;
  const element = (state.ui?.elements || []).find(item => item.id === target);
  return element?.reference?.kind === 'card';
}

/**
 * What a selection screen says about itself after a press.
 *
 * `a` on one of these TOGGLES the highlighted card, and the screen reports no
 * selected list, so the only way to know what a press did is can_confirm. A run
 * that could not see it pressed `a` ten times, toggled its choice off, and then
 * kept activating a Confirm button that had gone dark. Handing the gate back
 * with the action makes the next decision a reading rather than a guess.
 */
export function selectionGate(state) {
  const screen = state?.hand_select || state?.card_select;
  if (!screen) return null;
  const confirm = (state.ui?.elements || []).find(item => item.press === 'y' && item.enabled === true && /confirm/i.test(item.label || ''));
  return {
    prompt: screen.prompt ?? null,
    mode: screen.mode ?? screen.screen_type ?? null,
    can_confirm: screen.can_confirm === true,
    confirm_control: confirm?.id ?? null,
    candidates: (screen.cards || []).map(card => card.name),
  };
}

/** The bound buttons a stuck screen still offers, named in the error. */
/**
 * What the mod says this element is, when it has no readable label.
 *
 * The label check exists so a press never lands on something the run cannot
 * identify. But a potion holder is never labelled - the mod says so, and
 * CONTROLS.md documents it - and it is reported `ambiguous` because the label
 * it shares with its neighbours is null. That combination refused every potion
 * in combat: at the act 1 boss on floor 17 the run reached the right holder
 * with `x`, was refused, and paused twice on the same decision. The mod does
 * name these: `reference.kind` is "potion". An element the mod has typed is
 * identified, and the target was addressed by exact id, so the label adds
 * nothing the id has not already settled.
 */
const identified = (element) => Boolean(element?.label) || Boolean(element?.reference?.kind);

/**
 * Why a press did nothing, when the state already says so.
 *
 * `a` on the empty leftmost potion holder reports `activation: null`, and the
 * run was told only that nothing changed - twice in one boss turn, because
 * "nothing changed" gives a model no reason to try a different element. The
 * screen knew: the thing under focus does not take that button.
 */
function inertPress(state, buttons = []) {
  const focused = (state?.ui?.elements || []).find(item => item.id === state.ui.focused_element);
  if (!focused || !buttons.includes('a') || focused.activation === 'a') return '';
  return `: the focused element (${focused.label || focused.reference?.kind || focused.id}) reports activation ${JSON.stringify(focused.activation ?? null)}, so \`a\` does nothing on it`;
}

export function reachable(state) {
  const bound = elements(state).filter(item => item.press && item.enabled !== false).map(item => `${item.label || item.id} (${item.press})`);
  const gates = ['can_confirm', 'can_proceed', 'can_cancel']
    .flatMap(key => Object.entries(state || {})
      .filter(([, value]) => value && typeof value === 'object' && typeof value[key] === 'boolean')
      .map(([name, value]) => `${name}.${key}=${value[key]}`));
  const parts = [bound.length ? `bound buttons: ${bound.slice(0, 8).join(', ')}` : '', gates.length ? `screen reports ${gates.join(', ')}` : ''].filter(Boolean);
  return parts.length ? `; ${parts.join('; ')}` : '';
}
import { indexNotes, MAX_NOTE_IN_CONTEXT } from './retrieval.mjs';

// Reversible ways out of something that is holding focus, cheapest first.
const ESCAPES = ['b', 'x', 'left'];
import fs from 'node:fs';
import path from 'node:path';
import { DIRECTIONS, focusIdentity, isCardPlay, isCombat, leftMap, noteProblem, planIdentity, progressId, ready, settleAnimation, startupTransition, stateId, uiMatches, unbuiltMenu, uncertainCard, validatePlan } from './state.mjs';

export const MAX_NOTE = MAX_NOTE_IN_CONTEXT;

/** Files under learned/ outlive the room, so the player can see what it already wrote. */
export function learnedFiles(skillDir) { return indexNotes(skillDir).map(item => item.path).sort(); }

// How long to let a screen finish moving before planning against it, and how
// many reads to spend waiting. It returns as soon as two reads match, so a
// still screen costs one extra read; only a screen that keeps moving - a reward
// dealing its cards in - spends the budget, and 1.5s is shorter than the model
// call it protects.
// How many times a screen may change shape under a route before it counts as
// unstable. One per press along a strip that redraws, plus room to settle.
const MAX_RESCENES = 12;
const QUIESCE_MS = 150;
const QUIESCE_READS = 10;

// Factual correction proposals are kept for human review. They are neither
// retrieved as knowledge nor copied into a later room.
export const SCRATCHPAD_NOTE = 'scratchpad.md';
export const PROPOSALS_HEADER = ['# Proposed factual corrections', '',
  'Unreviewed, seed-invariant mechanics and interface observations only.',
  'Not retrieved or inherited. No run diary, draft/routing verdicts, or advice',
  'for the next seed. A human verifies sources before curating library notes.', '', '---', ''].join('\n');

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
      fs.appendFileSync(file, (fs.existsSync(file) ? '' : PROPOSALS_HEADER) + entry);
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
    const last = await this.observe();
    // A map that never regains focus is still a map, and the screen in front of
    // the agent is the best thing to plan against. Waiting for the room it is
    // loading is worth ten seconds; refusing to look at it afterwards is not.
    if (leftMap(last)) { this.record({ type: 'map_never_refocused' }); return last; }
    throw new Error(unbuiltMenu(last)
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

  /**
   * Walk towards something the way a person does: look at where it is, press
   * that way, look again.
   *
   * navigationPath only crosses a screen the game wired, and several screens
   * are not wired the way they are drawn - the potion strip, the combat rows,
   * a reward list whose siblings are auto-named. On those it reports no route
   * and the run stops, when three presses in the obvious direction would have
   * arrived. Every step here is verified by observation rather than predicted,
   * and directional presses activate nothing, so being wrong costs one press.
   *
   * It gives up rather than guessing when focus stops moving on both axes, or
   * comes back to somewhere it has already been - a card row wraps into a
   * closed loop by design, and "no route" is the true answer there.
   */
  async walkToward(target, state, scene, before) {
    const seen = new Set([state.ui?.focused_element]);
    for (let step = 0; step < 12; step++) {
      const here = targetElement(state, state.ui.focused_element);
      const wanted = targetElement(state, target.id);
      for (const direction of [towards(here, wanted), across(towards(here, wanted))]) {
        await this.button(direction);
        state = await this.observe();
        if (progressId(state) !== progressId(before)) throw new Error('gameplay advanced during navigation; nothing further was sent');
        if (state.ui?.focused_element === target.id) return state;
        if (state.ui?.focused_element && state.ui.focused_element !== here.id) break;
      }
      const landed = state.ui?.focused_element;
      // Unmoved on both axes, or back somewhere already visited: this screen
      // does not connect the two, and more presses will not change that.
      if (!landed || landed === here.id || seen.has(landed)) return null;
      seen.add(landed);
      if (state.ui?.scene_id !== scene) scene = state.ui?.scene_id;
    }
    return null;
  }

  /**
   * Jump into the target's row with its panel shortcut, then walk from there.
   *
   * Walking fails outright when the two rows are not wired together, and no
   * amount of looking at the screen fixes that - the potion bar is simply not
   * below the creatures. Pressing the shortcut puts focus somewhere known and
   * turns an impossible walk into a short one. Each button is tried once per
   * decision: one that did not land in the row will not land in it a second
   * time.
   */
  async enterRow(target, state, scene, before, spent) {
    const button = panelEntrance(state, target, spent);
    if (!button) return null;
    spent.add(button);
    await this.button(button);
    state = await this.observe();
    if (progressId(state) !== progressId(before)) throw new Error('gameplay advanced during navigation; nothing further was sent');
    if (state.ui?.focused_element === target.id) return state;
    if (!state.ui?.focused_element) return null;
    return this.walkToward(target, state, state.ui?.scene_id ?? scene, before);
  }

  /**
   * What the screen still offers, for an error that would otherwise be a dead
   * end. "Unknown activation outcome" told the run nothing it could act on; a
   * card-select screen that was already satisfied and only needed its Confirm
   * paused a run instead.
   */

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
    // Panel shortcuts already spent this decision, so a row that the shortcut
    // did not reach is not entered by pressing the same shortcut again.
    const entrances = new Set();
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
      // A freshly loaded screen can hold no focus, and a route has to start
      // somewhere; a directional press is reversible and activates nothing.
      // But some screens hold no focus BY DESIGN and never will: choosing a
      // card to enchant, or to smith at a rest site, ends in a foreground
      // before-and-after preview driven only by `b` and `y`. Two presses, then
      // say what the screen actually offers instead of guessing at more.
      if (!state.ui.focused_element) {
        if (recovery === 2) throw new Error(`this screen adopts no focus, so ${action.target} cannot be reached by navigating${reachable(state)}`);
        await this.button('down');
        state = await this.observe();
        continue;
      }

      let route;
      try { route = navigationPath(state, state.ui.focused_element, target.id, 12, avoid); }
      catch (error) {
        // The wiring does not describe this screen. Look at it instead.
        const walked = await this.walkToward(target, state, scene, before);
        if (walked) return walked;
        const entered = await this.enterRow(target, state, scene, before, entrances);
        if (entered) return entered;
        if (recovery === 2) throw new Error(`${error.message}${reachable(state)}`);
        state = await this.observe(); // read-only recovery; never invent a neighbor
        continue;
      }
      for (const step of route) {
        if (state.ui.focused_element !== step.from) break;
        await this.button(step.direction);
        state = await this.observe();
        if (progressId(state) !== progressId(before)) throw new Error('gameplay advanced during navigation; nothing further was sent');
        // Standing on the target is the whole point of the route, so it ends
        // here whatever the graph expected. A reward screen names its rows
        // with auto-generated siblings (@Control@1848), so a step can land
        // correctly and still not equal the id the graph predicted; that used
        // to mark the walk failed and, on the last recovery pass, throw while
        // focus was already on the element the plan asked for.
        if (state.ui.focused_element === target.id) return state;
        if (state.ui.focused_element !== step.to) { avoid.add(`${step.from}|${step.direction}`); break; }
        // Focus went exactly where the route said, so a changed scene_id is the
        // screen redrawing under the cursor, not a stale route. A shop restyles
        // the highlighted item on EVERY press: a four-press walk that was
        // tracking its route perfectly spent the whole re-scene budget and the
        // run paused one press from the relic it wanted. Adopt the new id and
        // keep walking; only a press that lands somewhere unpredicted is a
        // reason to stop and re-plan.
        if (state.ui?.scene_id !== scene) scene = state.ui.scene_id;
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
   * Get focus back into the hand.
   *
   * The screen is rows - potions, relics, the creatures, the hand - and `down`
   * walks them and wraps, so the hand is never far. But `down` cannot leave
   * something holding focus: selecting a potion opens a two-item Use/Discard
   * dropdown, and inside it `down` does nothing at all. A run spent four
   * presses in there and was told a full pass had failed.
   *
   * So when a press moves nothing, try the reversible ways out in turn: close
   * what opened, toggle the panel that opened it, or walk sideways out of the
   * row entirely. None of them activates anything, so being wrong costs a
   * press.
   *
   * There is no row count here on purpose. The old one was four, which is the
   * kind of number that is right until a screen has five.
   */
  async focusHand(before) {
    let path = before.ui?.focus_path ?? null;
    // An escape that moved nothing will not move anything the second time, so
    // it is spent. Without this the ladder walks b, x, left, b, x, left...
    const spent = new Set();
    for (let step = 0; step < 10; step++) {
      await this.button('down');
      let state = await this.observe();
      if (state.ui?.focused_card != null) return state;
      if ((state.ui?.focus_path ?? null) !== path) { path = state.ui?.focus_path ?? null; continue; }
      // `down` moved nothing, so something is holding focus. Try the reversible
      // ways out, in the order that costs least: close whatever opened, toggle
      // the panel that opened it, then walk sideways out of the row.
      let escaped = false;
      for (const button of ESCAPES.filter(item => !spent.has(item))) {
        await this.button(button);
        state = await this.observe();
        if (state.ui?.focused_card != null) return state;
        if ((state.ui?.focus_path ?? null) !== path) { path = state.ui?.focus_path ?? null; escaped = true; break; }
        spent.add(button);
      }
      if (!escaped) return null;
    }
    return null;
  }

  /**
   * Walk the hand to a card, the way the hand is actually drawn.
   *
   * `player.hand[].index` is not the on-screen order. On floor 19 of room
   * 70f25b98 the hand read Defend(274), Crimson Mantle+(275), Defend(276),
   * Howl(264), Strike(257) while the screen read, left to right, 274, 276,
   * 264, 257, 275 - index 1 was the RIGHTMOST of five. Counting
   * `desired - focused` in index space therefore pressed once where the card
   * was four away, and the run stopped rather than select the wrong card.
   *
   * Every hand element carries `reference.instance_id`, so the card and the
   * thing focus lands on can be tied together exactly. Order by where they are
   * drawn and the distance is real; the row wraps, so going the short way round
   * is also available.
   */
  async navigateHand(cardId, before) {
    const holders = (before.ui?.elements || [])
      .filter(item => item.reference?.kind === 'card' && item.reference.instance_id != null && Array.isArray(item.bounds))
      .sort((a, b) => a.bounds[0] - b.bounds[0]);
    const hand = holders.length
      ? holders.map(item => ({ instance_id: item.reference.instance_id }))
      : [...before.player.hand].sort((a, b) => a.index - b.index);
    const focused = hand.findIndex(card => card.instance_id === before.ui.focused_card);
    const desired = hand.findIndex(card => card.instance_id === cardId);
    if (focused < 0 || desired < 0 || before.ui.in_card_play) throw new Error('cannot establish hand focus; inspect the screenshot');
    // The row wraps, so the shorter way round may be backwards.
    const direct = desired - focused;
    const around = direct > 0 ? direct - hand.length : direct + hand.length;
    const distance = holders.length && Math.abs(around) < Math.abs(direct) ? around : direct;
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

  /**
   * Take one rest-site option, by the index the site publishes.
   *
   * `rest_site.options` gives the index, id, name and enabled state; the
   * controls are labelled with those same names and carry
   * `reference.kind: "option"`. One pause in twenty-three observations came
   * from routing this by hand.
   */
  async restOption(action, before) {
    const options = before.rest_site?.options || [];
    const option = options.find(entry => entry.index === action.option);
    if (!option) throw new Error(`no rest option ${action.option}; the site offers ${options.map(entry => `${entry.index} (${entry.name})`).join(', ') || 'none'}`);
    if (option.is_enabled === false) throw new Error(`${option.name} is not available at this rest site`);
    const controls = (before.ui?.elements || []).filter(el => el.enabled !== false && el.label);
    const target = controls.find(el => el.reference?.kind === 'option' && el.label.trim() === option.name)
      || controls.find(el => el.label.trim() === option.name);
    if (!target) throw new Error(`the ${option.name} control is not on screen${reachable(before)}`);
    const state = await this.navigateElement({ type: 'activate', target: target.id, scene: before.ui?.scene_id }, before);
    await this.button(target.press || 'a');
    const after = await this.settled();
    if (stateId(after) === stateId(state)) throw new Error(`pressing ${target.press || 'a'} on ${option.name} changed nothing${reachable(after)}`);
    this.record({ type: 'rest_taken', option: action.option, name: option.name });
    return after;
  }

  /**
   * Leave the screen, by whatever the screen actually uses.
   *
   * These do not agree, and the disagreement cost three rescues in one run. A
   * SHOP room is left with `back` - the View Map button - and not with `b`:
   * five `b` presses over five minutes never left one, while a single `back`
   * did. A screen that reports `can_proceed` and shows a Proceed control is
   * left by that control's own button. Everything else closes with `b`.
   */
  async leaveScreen(before) {
    const gate = ['shop', 'rest_site', 'rewards', 'card_select', 'hand_select', 'event']
      .map(key => before[key]).find(value => value && typeof value === 'object' && typeof value.can_proceed === 'boolean');
    const proceed = (before.ui?.elements || []).find(el => el.enabled === true && /proceed/i.test(el.label || ''));
    let button;
    if (before.state_type === 'shop') button = 'back';
    else if (gate?.can_proceed === true && proceed) button = proceed.press || 'a';
    else button = 'b';
    await this.button(button);
    let after = await this.settled();
    // Leaving frequently raises a confirmation, which `y` answers.
    if (stateId(after) === stateId(before)) {
      await this.button('y');
      after = await this.settled();
    }
    if (stateId(after) === stateId(before)) throw new Error(`neither ${button} nor y left this ${before.state_type}${reachable(after)}`);
    this.record({ type: 'left_screen', from: before.state_type, button });
    return after;
  }

  /**
   * Buy one thing from a shop, by the index the shop publishes.
   *
   * Shops were the worst screen in the run log - one operator pause every six
   * observations, roughly ten times the combat rate - and always for the same
   * three reasons. The purchasable control is the PRICE TAG; the relic artwork
   * drawn over it is `reference.kind: "model"` and no neighbour names it, so no
   * route to it exists. Relics and potions are labelled by price ALONE, so only
   * `shop.items` knows what a tag is for, and prices collide (two 51s in one
   * shop). Cards do carry their name, in a `price | cost | type | name` label.
   *
   * So: cards resolve by name, everything else by price, and a collision is
   * broken by position - the items of a category sit left to right in the order
   * `shop.items` lists them.
   */
  async buyItem(action, before) {
    const items = before.shop?.items || [];
    const item = items.find(entry => entry.index === action.item);
    if (!item) throw new Error(`no shop item ${action.item}`);
    const name = item.card_name || item.relic_name || item.potion_name || item.category;
    const goldBefore = before.player?.gold;

    const entries = (before.ui?.elements || [])
      .filter(el => el.reference?.kind === 'entry' && el.enabled !== false && Array.isArray(el.bounds) && el.label)
      .sort((a, b) => (Math.abs(a.bounds[1] - b.bounds[1]) > 40 ? a.bounds[1] - b.bounds[1] : a.bounds[0] - b.bounds[0]));
    let target = null;
    if (item.category === 'card' && item.card_name) {
      const wanted = entries.filter(el => el.label.includes(`| ${item.card_name} |`) || el.label.includes(`| ${item.card_name}`));
      if (wanted.length === 1) [target] = wanted;
    }
    if (!target) {
      // Price-only tags. Where a price is shared, take the one at this item's
      // rank among the same-priced items of its category.
      const priced = entries.filter(el => el.label.trim() === String(item.price));
      if (priced.length === 1) [target] = priced;
      else if (priced.length > 1) {
        const rank = items.filter(entry => entry.price === item.price && entry.category === item.category)
          .findIndex(entry => entry.index === item.index);
        target = priced[rank] || null;
      }
    }
    if (!target) throw new Error(`could not find the control for ${name} at ${item.price} gold; the shop's price tags are ${entries.map(el => JSON.stringify(el.label.slice(0, 24))).join(', ')}`);

    const state = await this.navigateElement({ type: 'activate', target: target.id, scene: before.ui?.scene_id }, before);
    await this.button(target.press || 'a');
    const after = await this.settled();
    const goldAfter = after.player?.gold;
    const stillStocked = (after.shop?.items || []).find(entry => entry.index === action.item)?.is_stocked;
    if (stillStocked === true && Number.isInteger(goldBefore) && goldBefore === goldAfter) {
      throw new Error(`pressing ${target.press || 'a'} on ${name} spent no gold and left it stocked${reachable(after)}`);
    }
    this.record({ type: 'purchase', item: action.item, name, price: item.price, goldBefore, goldAfter });
    void state;
    return after;
  }

  /**
   * Use a potion, all of it, with every press verified.
   *
   * This existed only as prose in the control manual, and a run spent about
   * fifty presses in one combat turn failing to follow it: `x, a, a` finishes a
   * DRINK potion, whose only target is the player, so it is easily learned as
   * "how to use a potion" and then repeated forever on one that must be THROWN.
   * A thrown potion is only ARMED by that second `a`; the aim then sits on a
   * creature and needs steering. Cards have had `play` doing this for them the
   * whole time. Potions had nothing, so the model rediscovered the sequence
   * from scratch every turn and got it wrong every turn.
   */
  async usePotion(action, before) {
    if (!ready(before) || !isCombat(before)) throw new Error('not an actionable combat');
    const potion = (before.player?.potions || []).find(item => item.slot === action.slot);
    if (!potion) throw new Error(`no potion in slot ${action.slot}`);
    const thrown = ['AnyEnemy', 'AnyAlly'].includes(potion.target_type);
    // The OCCUPIED holders, left to right. An empty slot is sometimes reported
    // as a holder with no activation and sometimes not reported at all, so a
    // slot number is not a position in this row: at the act 2 boss, slots 1 and
    // 2 were held and only two holders existed, while `x` put focus on a third
    // the elements list never mentioned. Occupied holders do appear in slot
    // order, which is the mapping that survives both shapes.
    const occupied = value => (value?.ui?.elements || [])
      .filter(item => item.reference?.kind === 'potion' && item.activation === 'a' && Array.isArray(item.bounds))
      .sort((a, b) => a.bounds[0] - b.bounds[0]);
    const rank = (before.player.potions || []).map(item => item.slot).sort((a, b) => a - b).indexOf(action.slot);

    let state = before;
    if (!/PotionHolder|PotionPopup/.test(state.ui?.focus_path || '')) {
      await this.button('x');
      state = await this.observe();
    }
    const wanted = occupied(state)[rank];
    if (!wanted) throw new Error(`the screen reports ${occupied(state).length} occupied potion holders but ${(before.player.potions || []).length} potions${reachable(state)}`);
    // Walk to it by identity rather than by counting: `x` can land on a holder
    // the elements list does not carry at all.
    for (const direction of ['right', 'left']) {
      for (let step = 0; step < 8 && state.ui?.focused_element !== wanted.id; step++) {
        await this.button(direction);
        const next = await this.observe();
        if (next.ui?.focused_element === state.ui?.focused_element) break;
        state = next;
      }
      if (state.ui?.focused_element === wanted.id) break;
    }
    if (state.ui?.focused_element !== wanted.id) throw new Error(`could not reach the holder for slot ${action.slot} (${potion.name}); focus stopped on ${state.ui?.focus_path}${reachable(state)}`);

    // Open the holder's popup, then take whichever control the popup is on.
    // Its options vary (Use/Discard, Use/Throw) and the cursor does not always
    // start on the same one, so the focus path is the only reliable readout.
    await this.button('a');
    state = await this.observe();
    if (!/PotionPopup/.test(state.ui?.focus_path || '')) throw new Error(`pressing a on the slot ${action.slot} holder did not open its popup${reachable(state)}`);
    for (let step = 0; step < 4 && !/UseButton|ThrowButton/.test(state.ui?.focus_path || ''); step++) {
      await this.button('up');
      state = await this.observe();
    }
    if (!/UseButton|ThrowButton/.test(state.ui?.focus_path || '')) throw new Error(`the ${potion.name} popup is open but its Use control was not reached; focus is ${state.ui?.focus_path}`);
    await this.button('a');
    state = await this.settled();
    if (progressId(state) !== progressId(before) && !thrown) {
      this.record({ type: 'potion_used', slot: action.slot, name: potion.name, thrown: false });
      return state;
    }

    // A drink is already finished. A throw is only ARMED: the aim now sits on
    // some creature and has to be walked onto the one that was asked for.
    if (!thrown) {
      if ((before.player.potions || []).length === (state.player?.potions || []).length) throw new Error(`${potion.name} did not resolve; focus is ${state.ui?.focus_path}${reachable(state)}`);
      this.record({ type: 'potion_used', slot: action.slot, name: potion.name, thrown: false });
      return state;
    }
    if (!state.ui?.targeting) throw new Error(`${potion.name} is ${potion.target_type} but the game did not enter targeting; focus is ${state.ui?.focus_path}${reachable(state)}`);
    const seen = new Set();
    for (let step = 0; step < 8 && state.ui.focused_creature !== action.target; step++) {
      if (seen.has(state.ui.focused_creature)) break;
      seen.add(state.ui.focused_creature);
      await this.button('right');
      state = await this.observe();
      if (!state.ui?.targeting) throw new Error('targeting was cancelled while aiming; the potion was not spent');
    }
    if (state.ui.focused_creature !== action.target) {
      // Try the other way before giving up: the aim may have started past it.
      for (let step = 0; step < 8 && state.ui.focused_creature !== action.target; step++) {
        await this.button('left');
        state = await this.observe();
        if (!state.ui?.targeting) throw new Error('targeting was cancelled while aiming; the potion was not spent');
      }
    }
    if (state.ui.focused_creature !== action.target) {
      await this.button('b');
      throw new Error(`could not aim ${potion.name} at combat_id ${action.target}; the aim stopped on ${state.ui?.focused_creature}. Cancelled without spending it.`);
    }
    await this.button('a');
    state = await this.settled();
    if ((state.player?.potions || []).some(item => item.slot === action.slot)) throw new Error(`${potion.name} still occupies slot ${action.slot} after the throw${reachable(state)}`);
    this.record({ type: 'potion_used', slot: action.slot, name: potion.name, thrown: true, target: action.target });
    return state;
  }

  /**
   * Resolve a card-selection screen: pick the named cards and confirm.
   *
   * A card or potion that opens one of these ("Choose a card to Exhaust",
   * "Choose a card", an upgrade prompt) left the model hand-pressing `a` and
   * `y` at a screen that reports NO selected list. `a` toggles, so a press that
   * worked and one that undid the last one look identical, and runs have
   * pressed `a` ten times and then hammered a Confirm that had gone dark.
   * can_confirm is the only readout, so every press here is judged by it.
   *
   * The screen often opens with a card ALREADY selected for you, and an `a`
   * would deselect it. That is not knowable up front - no selected list - so it
   * is handled by watching can_confirm fall and pressing again.
   */
  // SimpleSelect moves chosen cards out of the candidate list and renumbers
  // the remaining cards. Resolve the original request to physical identities
  // before pressing anything; the selected tray is a separate set of controls.
  async chooseHandCards(action, before) {
    const cardsIn = (value, type) => (value.ui?.elements || []).filter(item =>
      item.type === type && item.reference?.kind === 'card' && item.visible !== false);
    const instanceOf = item => item?.instance_id ?? item?.reference?.instance_id ?? null;
    const selected = value => cardsIn(value, 'NSelectedHandCardHolder').map(instanceOf);
    const available = cardsIn(before, 'NHandCardHolder');
    const availableIds = available.map(instanceOf);
    if (availableIds.some(id => id == null) || new Set(availableIds).size !== availableIds.length) {
      throw new Error('cannot map hand-selection candidates to unique physical cards');
    }
    const allHand = before.player?.hand || [];
    const handById = new Map(allHand.map(card => [card.instance_id, card]));
    if (handById.size !== allHand.length || availableIds.some(identity => !handById.has(identity))) {
      throw new Error('cannot map hand-selection candidates to unique physical cards');
    }
    const hand = allHand.filter(card => availableIds.includes(card.instance_id));
    const candidates = before.hand_select.cards || [];
    if (candidates.length !== availableIds.length || hand.length !== candidates.length) {
      throw new Error('cannot map hand-selection candidates to unique physical cards');
    }
    const sameCard = (candidate, card) => {
      const candidateId = candidate?.id ?? candidate?.card_id;
      const cardId = card?.id ?? card?.card_id;
      return (candidateId != null && cardId != null && candidateId === cardId)
        || (candidateId == null && candidate?.name != null && candidate.name === card?.name);
    };
    const candidateIds = candidates.map((candidate, offset) => {
      const card = hand[offset];
      const explicit = instanceOf(candidate);
      if (explicit != null && explicit !== card.instance_id) throw new Error('cannot map hand-selection candidates to unique physical cards');
      if (explicit == null && !sameCard(candidate, card)) throw new Error('cannot map hand-selection candidates to unique physical cards');
      return card.instance_id;
    });
    if (new Set(candidateIds).size !== candidateIds.length) {
      throw new Error('cannot map hand-selection candidates to unique physical cards');
    }
    const selectedBefore = selected(before);
    if (selectedBefore.some(identity => !handById.has(identity)) || new Set(selectedBefore).size !== selectedBefore.length) {
      throw new Error('cannot verify selected hand cards by physical identity');
    }
    const wanted = action.cards.map(index => {
      const offset = candidates.findIndex(card => card.index === index);
      if (offset < 0) throw new Error(`no card at index ${index}`);
      return candidateIds[offset];
    });
    if (new Set(wanted).size !== wanted.length) throw new Error('hand-selection identities are not unique');
    let state = before;
    const toggle = async (identity, selecting) => {
      const type = selecting ? 'NHandCardHolder' : 'NSelectedHandCardHolder';
      const matches = cardsIn(state, type).filter(item => instanceOf(item) === identity);
      if (matches.length !== 1) throw new Error('intended selection card is missing or ambiguous');
      const target = matches[0];
      if (state.ui?.focused_element !== target.id) {
        state = await this.navigateElement({ type: 'navigate', target: target.id, scene: state.ui?.scene_id }, state);
      }
      const focused = (state.ui?.elements || []).find(item => item.id === state.ui?.focused_element);
      if (instanceOf(focused) !== identity || focused.type !== type) {
        throw new Error('could not verify focus on the intended selection card');
      }
      await this.button('a');
      for (let attempt = 0; attempt < 10; attempt++) {
        state = await this.observe();
        if (!state.hand_select) throw new Error('hand-selection screen closed before confirmation');
        if (selected(state).includes(identity) === selecting) return;
        await this.sleep(100);
      }
      throw new Error('selection did not move the intended card; stopping before further input');
    };
    // choose.cards is the final requested selection, including on incident
    // recovery where a previous partial attempt left cards in the tray.
    for (const identity of selectedBefore) if (!wanted.includes(identity)) await toggle(identity, false);
    for (const identity of wanted) if (!selected(state).includes(identity)) await toggle(identity, true);
    const actual = selected(state);
    if (actual.length !== wanted.length || actual.some(identity => !wanted.includes(identity)) || state.hand_select.can_confirm !== true) {
      throw new Error('hand-selection tray does not match the requested cards or cannot confirm');
    }
    await this.button('y');
    state = await this.settled();
    if (state.hand_select) throw new Error('confirming with y left the hand-selection screen open');
    this.record({ type: 'cards_chosen', cards: action.cards, instances: wanted, confirmed: 'y' });
    return state;
  }

  async chooseCards(action, before) {
    if (before.hand_select?.mode === 'simple_select' &&
        (before.ui?.elements || []).some(item => ['NHandCardHolder', 'NSelectedHandCardHolder'].includes(item.type))) {
      return this.chooseHandCards(action, before);
    }
    const screenOf = value => value?.hand_select || value?.card_select || null;
    let state = before;
    if (!screenOf(state)) throw new Error('no card-selection screen is open');
    const wanted = action.cards;
    // Resolve each published index through its physical/reference identity.
    // Never fall back to row[index]: sparse or reordered screens are unsafe.
    // Only controls the pad can actually land on are candidates. A selection
    // screen can be drawn over a live combat, and the player's hand stays on
    // screen underneath it carrying the same `reference.kind: "card"`, so a
    // pile screen offering a Strike beside a hand holding one matched both and
    // the run paused with "cannot safely map card index 2 to a unique screen
    // card" (incident 1789020238941-12). `selectable` is the sensor's own
    // "focus_mode == all" verdict - the same notion context.mjs calls
    // addressable - and the hand's holders are not addressable here. A
    // hand-select screen, where the hand *is* the surface, marks its holders
    // selectable, so this cannot disable one. The focus check below still has
    // to confirm the target, so a sensor that omits the flag loses nothing.
    const selectable = item => item.selectable !== false;
    const holders = value => (value.ui?.elements || [])
      .filter(item => item.reference?.kind === 'card' && Array.isArray(item.bounds) && selectable(item))
      .sort((a, b) => (Math.abs(a.bounds[1] - b.bounds[1]) > 40 ? a.bounds[1] - b.bounds[1] : a.bounds[0] - b.bounds[0]));
    const instanceOf = item => item?.instance_id ?? item?.reference?.instance_id ?? null;
    const cardMatches = (card, holder) => {
      const cardInstance = instanceOf(card);
      const holderInstance = instanceOf(holder);
      if (cardInstance != null && holderInstance != null) return cardInstance === holderInstance;
      const cardId = card?.id ?? card?.card_id;
      const ref = holder.reference || {};
      return (cardId != null && [ref.id, ref.model_id, ref.card_id].includes(cardId))
        || (card?.name != null && (holder.label === card.name || ref.name === card.name));
    };
    for (const index of wanted) {
      const screen = screenOf(state);
      if (!screen) throw new Error('the selection screen closed before every card was picked');
      const card = (screen.cards || []).find(item => item.index === index);
      if (!card) throw new Error(`no card at index ${index}; the screen offers ${(screen.cards || []).map(item => `${item.index} (${item.name})`).join(', ')}`);
      const matches = holders(state).filter(holder => cardMatches(card, holder));
      if (matches.length !== 1) throw new Error(`cannot safely map card index ${index} to a unique screen card`);
      const target = matches[0];
      if (state.ui?.focused_element !== target.id) {
        state = await this.navigateElement({ type: 'navigate', target: target.id, scene: state.ui?.scene_id }, state);
      }
      const focused = (state.ui?.elements || []).find(item => item.id === state.ui?.focused_element);
      if (!focused || !cardMatches(card, focused)) throw new Error('could not verify focus on the intended selection card');
      const beforePress = screenOf(state)?.can_confirm === true;
      await this.button('a');
      state = await this.observe();
      if (!screenOf(state)) break; // a single-pick screen can resolve on the press
      // can_confirm falling means that `a` DESELECTED something the screen had
      // chosen for us. Press again: now the selection is the one we asked for.
      if (beforePress && screenOf(state).can_confirm === false) {
        await this.button('a');
        state = await this.observe();
      }
    }
    const screen = screenOf(state);
    if (!screen) {
      this.record({ type: 'cards_chosen', cards: wanted, confirmed: 'screen resolved on selection' });
      return this.settled(state);
    }
    if (screen.can_confirm !== true) throw new Error(`the screen still reports can_confirm false after picking ${wanted.join(', ')}; it wants a different number of cards${reachable(state)}`);
    await this.button('y');
    state = await this.settled();
    if (screenOf(state) && screenOf(state).can_confirm === true) throw new Error(`confirming with y left the selection screen open${reachable(state)}`);
    this.record({ type: 'cards_chosen', cards: wanted, confirmed: 'y' });
    return state;
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
        const found = await this.focusHand(state);
        if (!found) throw new Error(`focus is outside the hand and neither walking nor backing out reached it${reachable(state)}`);
        state = found;
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
      // Whether THIS action reached the pad, which is a different question from
      // whether the batch did. A later play refused before its own input leaves
      // the scene exactly as the earlier plays made it.
      const inputsBefore = this.inputs;
      try {
        if (action.type === 'elements' || action.type === 'path') {
          completed.push({ action, verified: true, ...(action.type === 'elements' ? { elements: elements(state) } : { path: navigationPath(state, action.from || state.ui.focused_element, action.target) }) });
        } else if (action.type === 'navigate' || action.type === 'activate') {
          // A control the game bound to a button is activated by pressing it,
          // from wherever focus happens to be. Some are reachable no other way:
          // a card reward's Skip sits outside a card row whose up and down
          // neighbours point back at itself, so there is no route to walk.
          let bound = null;
          if (action.type === 'activate') {
            try { bound = pressableElement(state, action.target).press; }
            catch (error) { throw /disabled/.test(error.message) ? new Error(`${error.message}${reachable(state)}`) : error; }
          }
          if (bound) {
            const fresh = await this.observe();
            const target = pressableElement(fresh, action.target);
            // The same comparison the executor opened with, over the window
            // this press actually spans: the plan was written against one
            // observation and the press is sent after a fresh read. Raw
            // scene_id cannot answer it - the sensor builds that out of Godot
            // instance ids that churn whenever a node is rebuilt, so a
            // tooltip appearing or a pile count updating refused the press
            // exactly as planIdentity used to refuse the whole plan. What has
            // to hold is that the screen still offers what the plan named:
            // pressableElement has already thrown if the control is gone or
            // disabled, and the binding check below ties how it is activated
            // to the one the plan was written for.
            if (planIdentity(fresh) !== planIdentity(state)) throw new Error('activation target became stale');
            if (!identified(target) || (target.ambiguous && !target.reference?.kind) || target.press !== bound) throw new Error(`activation semantics are unknown; inspect screenshot and report issue${reachable(fresh)}`);
            await this.button(bound);
            state = await this.settled();
            if (stateId(state) === stateId(fresh) && !unreportedSelection(state, action.target)) throw new Error(`pressing ${bound} on ${action.target} changed nothing${reachable(state)}`);
            completed.push({ action, verified: true, pressed: bound, barrier: 'activation: replan from fresh scene' });
            this.record({ type: 'action', before, after: state, action, verified: true });
            break;
          }
          state = await this.navigateElement(action, state);
          if (action.type === 'activate') {
            // Re-read at the last possible moment; never retry an activation.
            const fresh = await this.observe();
            const target = targetElement(fresh, action.target);
            if (!identified(target) || (target.ambiguous && !target.reference?.kind) || target.activation !== 'a') throw new Error(`activation semantics are unknown; inspect screenshot and report issue${reachable(fresh)}`);
            // Against the screen navigation actually finished on, not the one
            // the plan was written against: a screen that settled while routing
            // is already handled there. What has to hold is that the intended
            // element still holds focus (this press activates whatever is
            // focused) and that nothing has happened since - read in stable
            // identity, because raw scene_id moves whenever the game rebuilds
            // a node, and that is presentation, not the screen changing.
            if (fresh.ui.focused_element !== action.target || planIdentity(fresh) !== planIdentity(state)) throw new Error('activation target became stale');
            await this.button('a');
            state = await this.settled();
            if (stateId(state) === stateId(fresh) && !unreportedSelection(state, action.target)) throw new Error(`activating ${action.target} changed nothing${reachable(state)}`);
            const gate = selectionGate(state);
            completed.push({ action, verified: true, ...(gate ? { selection: gate } : {}),
              barrier: gate
                ? `selection: can_confirm is ${gate.can_confirm}. ${gate.can_confirm ? `The choice is held; activate ${gate.confirm_control || 'the Confirm control'} (bound y) to take it. Do NOT press a again - it would deselect.` : 'Nothing is selected yet; select a candidate before confirming.'}`
                : 'activation: replan from fresh scene' });
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
          // A press with no target acts on whatever holds focus, so it is the
          // one kind of input that depends on focus staying where the plan saw
          // it. Focus moves on its own often enough to matter (a card-targeting
          // cursor drifting over a holder, a rebuilt control), and planIdentity
          // no longer refuses a plan for that alone, because the great majority
          // of such movements are churn that a named target does not care
          // about. Directional presses are excluded: a single one is a probe
          // whose whole point is to be relative, and a multi-press route is
          // re-walked from wherever focus is.
          // Compared against the observation the plan was written for, not
          // against the previous action's result: every press in a plan was
          // written against the same screen.
          const activation = action.buttons.some(button => !DIRECTIONS.includes(button));
          if (activation && focusIdentity(before) !== focusIdentity(observation)) {
            throw new Error('focus moved off the control this press would activate; no input sent');
          }
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
          if (stateId(state) === stateId(before)) throw new Error(`UI sequence produced no observed change${inertPress(state, action.buttons)}; stopping before further input${reachable(state)}`);
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
        } else if (action.type === 'rest') {
          state = await this.restOption(action, before);
          completed.push({ action, verified: true, barrier: 'rest: replan from fresh state' });
          this.record({ type: 'action', before, after: state, action, verified: true });
          break;
        } else if (action.type === 'leave') {
          state = await this.leaveScreen(before);
          completed.push({ action, verified: true, barrier: 'leave: replan from fresh state' });
          this.record({ type: 'action', before, after: state, action, verified: true });
          break;
        } else if (action.type === 'buy') {
          state = await this.buyItem(action, before);
          completed.push({ action, verified: true, bought: (before.shop?.items || []).find(entry => entry.index === action.item)?.card_name || null, barrier: 'purchase: replan from fresh state' });
          this.record({ type: 'action', before, after: state, action, verified: true });
          break;
        } else if (action.type === 'choose') {
          state = await this.chooseCards(action, before);
          completed.push({ action, verified: true, barrier: 'selection: replan from fresh state' });
          this.record({ type: 'action', before, after: state, action, verified: true });
          break;
        } else if (action.type === 'use_potion') {
          state = await this.usePotion(action, before);
          completed.push({ action, verified: true, potion: (before.player?.potions || []).find(item => item.slot === action.slot)?.name || null, barrier: 'potion: replan from fresh state' });
          this.record({ type: 'action', before, after: state, action, verified: true });
          break;
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
            if (!fs.existsSync(file)) {
              // Name the real thing rather than the miss. Filenames in this
              // library are not all lowercase, so the near miss is usually case.
              const wanted = action.path.toLowerCase();
              const near = learnedFiles(this.skillDir).filter(item => item.toLowerCase() === wanted)
                || [];
              const same = near.length ? near : learnedFiles(this.skillDir).filter(item => item.toLowerCase().endsWith(wanted.split('/').pop()));
              throw new Error(`no learned note at ${action.path}${same.length ? `; did you mean ${same.slice(0, 3).join(', ')}` : ''}`);
            }
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
        return { completed, error: error.message, state: after, failedActionSentInput: this.inputs > inputsBefore };
      }
    }
    if (note) completed.push(await this.keepNote(note));
    this.record({ type: 'plan_result', before: observation, after: state, completed });
    return { completed, state };
  }
}
