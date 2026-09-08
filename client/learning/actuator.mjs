import { LANE } from './agents.mjs';
import { actuatorContext, addressable } from './context.mjs';
import { needsScreenshot, stateId, validatePlan } from './state.mjs';

/**
 * The pad has one owner.
 *
 * The agents that play the game say what they want done - "skip this reward",
 * "take the left path", "buy the Bag of Preparation" - and never name a control,
 * a direction or an element id, because they are not shown any. This is where a
 * goal becomes presses, and it is the only place that reads the interface.
 *
 * Most goals never reach a model. A screen's Skip, Proceed, Confirm or Leave is
 * an element with that label, and matching a requested label against the
 * addressable controls answers the request outright - no call, no latency, and
 * no chance of an invented id. The model is the fallback for the screens where
 * the label does not settle it.
 */

/** Labels as a person reads them: NRewards_Proceed_Button and "Proceed" are the same request. */
export function normalizeLabel(label) {
  return String(label || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ')
    .toLowerCase()
    .replace(/\b(?:n|button|btn|control|label)\b/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The one control this goal is asking for, or null when the labels do not
 * settle it. Deliberately strict: a near-match that presses the wrong button on
 * a reward screen costs a card, so ambiguity is handed to the model instead of
 * guessed at.
 */
export function matchElement(state, wanted) {
  const target = normalizeLabel(wanted);
  if (target.length < 2) return null;
  const focused = state.ui?.focused_element ?? null;
  const candidates = (state.ui?.elements || []).filter(item => addressable(item, focused) && item.enabled === true && item.label);
  const exact = candidates.filter(item => normalizeLabel(item.label) === target);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const contains = candidates.filter(item => {
    const label = normalizeLabel(item.label);
    return label.includes(target) || target.includes(label);
  });
  return contains.length === 1 ? contains[0] : null;
}

/**
 * The screen-level commands. A goal that opens with one of these is asking for
 * that button, whatever else the sentence mentions.
 */
const COMMANDS = ['confirm', 'cancel', 'proceed', 'continue', 'leave', 'skip', 'close', 'back', 'done', 'buy', 'purchase', 'rest', 'smith', 'upgrade', 'remove', 'embark', 'abandon'];

/**
 * A command control the goal names, or null. "Confirm the transformation of the
 * selected Strike" names two things - the command and the card - and a resolver
 * that only reads target_label picks the card.
 */
export function commandElement(state, goal) {
  const words = new Set(normalizeLabel(goal).split(' '));
  const named = COMMANDS.filter(command => words.has(command));
  if (named.length !== 1) return null;
  return matchElement(state, named[0]);
}

/**
 * A plan for this intent without asking anyone, or null. Deterministic
 * resolution is an optimisation, so it declines whenever it is not certain -
 * the model sees the whole screen and costs a couple of seconds.
 *
 * Nothing is inferred from the goal text beyond that: guessing a target out of
 * a sentence is the hallucination this whole split exists to remove.
 */
export function resolveIntent(state, intent) {
  const element = intent?.target_label ? matchElement(state, intent.target_label) : null;
  if (!element) return null;
  // The goal named a command AND the label named something else. A real run
  // asked to "confirm the transformation of the currently selected Strike" with
  // target_label "Strike", and this resolved to the Strike card - which was not
  // even actuatable - instead of Confirm. Which one is meant is a judgement, so
  // it is not made here.
  const command = commandElement(state, intent.goal);
  if (command && command.id !== element.id) return null;
  // A control is only reachable by its bound button, or by routing to it from
  // whatever holds focus now. On an overlay that adopts no focus at all - the
  // transform preview is one - an element with no bound button cannot be
  // reached, and resolving to it produces a plan that cannot run.
  if (!element.press && !state.ui?.focused_element) return null;
  return {
    observation: stateId(state),
    summary: `Activate ${element.label}`,
    note: `Resolved "${intent.target_label}" to ${element.id} (${element.label}) by label match; no model call.`,
    actions: [{ type: 'activate', target: element.id, scene: state.ui?.scene_id }],
  };
}

export class Actuator {
  constructor({ planner, executor, roster, record = () => {}, screenshot = null, lane = LANE.actuator }) {
    this.planner = planner;
    this.executor = executor;
    this.roster = roster;
    this.record = record;
    // Fetched here rather than by the caller, and only on the path that can use
    // it: an image answers "which control is raised", which is this member's
    // question and nobody else's. A fight no longer pays for one every turn.
    this.screenshot = screenshot;
    this.modelCalls = 0;
    this.resolved = 0;
    // Kept for the incident record: what the model was actually looking at.
    this.lastImage = null;
  }

  /**
   * One agent's plan, turned into something the pad can actually run. An
   * `intent` is resolved here; everything else - card play, ending a turn, a
   * note - is already concrete and passes through untouched. A trailing note
   * rides along either way, so the agent that verified something still gets to
   * propose it.
   *
   * Nothing is sent by this method. The caller still gets to refuse the
   * resolved plan - a repeat of the last one, a third probe in a row - while
   * the scene is untouched, which is only possible if resolving and sending are
   * separate steps.
   */
  async resolve(plan, state, options) {
    const note = plan.actions.length > 1 && plan.actions.at(-1).type === 'learn' ? plan.actions.at(-1) : null;
    const steps = note ? plan.actions.slice(0, -1) : plan.actions;
    if (steps[0]?.type !== 'intent') return { plan, resolution: 'direct', intent: null };
    const intent = steps[0];
    const { plan: padPlan, resolution } = await this.plan(intent, state, options);
    const actions = note ? [...padPlan.actions, note] : padPlan.actions;
    const merged = { ...padPlan, observation: stateId(state), actions };
    // The executor's own reading of the plan, done here so a bad resolution is
    // refused while nothing has been sent.
    validatePlan(merged, state);
    return { plan: merged, resolution, intent };
  }

  /** Send it. The only path from a plan to the controller. */
  async execute(plan, state) {
    return this.executor.execute(plan, state).catch(error => ({ error: error.message, code: error.code, completed: [], staleState: error.state }));
  }

  /** The pad plan for one intent, from the label if it can be, from the model otherwise. */
  async plan(intent, state, { notes = [], controlNotes = [], lastResult = null, instructions = [], from = 'strategist', image = null, counters = {} } = {}) {
    const direct = resolveIntent(state, intent);
    if (direct) {
      this.resolved++;
      this.record({ type: 'actuator', agent: this.lane, resolution: 'label', goal: intent.goal, target_label: intent.target_label, element: direct.actions[0].target });
      this.roster?.count(this.lane);
      this.roster?.as(this.lane, { type: 'message_start' });
      this.roster?.as(this.lane, { type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: `${intent.goal} → ${direct.summary} (label match, no model call)` } });
      this.roster?.as(this.lane, { type: 'message_update', assistantMessageEvent: { type: 'text_end' } });
      return { plan: direct, resolution: 'label' };
    }
    const look = image || (this.screenshot && needsScreenshot(state) ? await this.screenshot() : null);
    this.lastImage = look;
    const context = actuatorContext(state, intent, { notes, controlNotes, lastResult, instructions, from, counters });
    this.record({ type: 'actuator_context', agent: this.lane, characters: JSON.stringify(context).length, elements: context.elements.length, screenshot: Boolean(look), goal: intent.goal });
    this.modelCalls++;
    this.roster?.count(this.lane);
    this.roster?.as(this.lane, { type: 'message_start' });
    const plan = await this.planner.ask({ role: 'actuator', agent: this.lane, prompt: 'actuator.txt', context, image: look, deadlineMs: 30000, stream: true, primary: true })
      .catch(error => { error.lane = this.lane; throw error; });
    try { validatePlan(plan, state, { role: 'actuator' }); }
    catch (error) { error.lane = this.lane; throw error; }
    return { plan, resolution: 'model' };
  }
}
