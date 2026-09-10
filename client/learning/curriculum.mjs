// The automatic curriculum and its critic.
//
// Voyager (Wang et al., 2023) reports that two components carry most of its
// lifelong-learning performance: a curriculum that proposes the next objective
// from the agent's own situation and history (-93% discovered items when
// replaced by a random one), and a self-verification critic that decides
// whether an objective was actually met (-73% when removed). This player had
// neither: it had one fixed run task and no notion of an objective being done,
// so nothing chose what to learn next and nothing closed the loop.
//
// The adaptation to Slay the Spire 2 differs from Minecraft in one structural
// way. Voyager's tasks are single program executions, so its critic answers
// success or failure. Here an objective ("clear act 1 without dropping below
// 60% HP") spans many decisions, so the critic must also be able to answer
// pending; only success and failure close an objective.
//
// The ladder lives in the skill library at learned/curriculum.json, so the
// objectives one room completed and failed are inherited by the next.
import fs from 'node:fs';
import path from 'node:path';
import { digest } from './state.mjs';
import { PROFILE } from './profile.mjs';

const SCHEMA = 1;
const MAX_HISTORY = 60;
// Voyager re-queries the curriculum after four rounds of failed refinement.
const MAX_ATTEMPTS = 3;
// Cheap guards on the auxiliary calls: an objective is checked at real progress
// boundaries, and never more than once every few decisions.
const CHECK_EVERY = 12;
const MIN_CHECK_GAP = 3;
// The auxiliary calls run on the same model as the decision, which answers in
// tens of seconds. At 15 seconds every propose and every verify timed out, so
// no objective was ever opened and the curriculum silently did nothing for a
// whole run. Half the decision budget is ample for a short answer and still
// bounds a hung call.
const AUXILIARY_DEADLINE_MS = Math.round(PROFILE.plannerDeadlineMs / 2);
// The folders the library actually has. The area is what biases retrieval
// towards the notes an objective is about (retrieval.mjs), so a name no
// directory answers to - bestiary, setups, pools - ranks nothing.
const AREAS = ['meta_strategy', 'controls', 'act1', 'act2', 'act3', 'characters', 'ascension', 'debugging'];
const clamp = (value, limit) => (typeof value === 'string' ? value.slice(0, limit) : '');

/**
 * A small, stable description of where the run is, for proposal and verification.
 *
 * This is the ONLY window the curriculum and the critic have on the run:
 * `situation()` is read by `propose` and by `verify`, and by nothing else - the
 * strategist and the combat agent have their own projections. An objective can
 * only be as concrete as what arrives here, which is why the first run's ladder
 * was four HP floors: `deck_size` was a count and the relics never arrived at
 * all, so "is this deck strong enough for the boss ahead" was unanswerable and
 * nobody could ask it.
 *
 * Two fields carry the weight:
 * - The deck as cards, with cost/type/upgrade, because an objective about what
 *   the deck must be able to do cannot be checked against a number.
 * - `boss` from the map, because the power question is always relative to a
 *   named encounter at a known floor. The map has carried it since floor 1.
 *
 * Relics and potions are read from `player`, where the mod puts them. The
 * earlier `state.relics` spelling resolved to undefined in every one of the
 * 189 observations of room 1810711c, so both agents have always been told this
 * run held no relics at all.
 *
 * Card descriptions are included: the critic has to reason about what the deck
 * does, and a bare name makes that a recall of the model's own training data
 * rather than a reading of the live state.
 */
export function situation(state, extra = {}) {
  const relics = state?.player?.relics || state?.relics || [];
  const potions = state?.player?.potions || [];
  const deck = Array.isArray(state?.deck) ? state.deck : [];
  const map = state?.map || null;
  return {
    state_type: state?.state_type || null,
    menu_screen: state?.menu_screen || null,
    act: state?.run?.act ?? null,
    floor: state?.run?.floor ?? null,
    ascension: state?.run?.ascension ?? null,
    character: state?.run?.character || state?.player?.character || null,
    hp: state?.player?.hp ?? null,
    max_hp: state?.player?.max_hp ?? null,
    gold: state?.player?.gold ?? null,
    relics: relics.map(relic => ({ name: relic?.name || relic?.id || null, description: relic?.description || null, counter: relic?.counter ?? null })).filter(relic => relic.name).slice(0, 24),
    potions: potions.map(potion => ({ name: potion?.name || potion?.id || null, description: potion?.description || null, slot: potion?.slot ?? null })).filter(potion => potion.name).slice(0, 8),
    // The deck as cards, so a completion condition can name what the deck must
    // do rather than how many cards are in it.
    deck: deck.map(card => ({ name: card?.name || card?.id || null, cost: card?.cost ?? null, type: card?.type ?? null, upgraded: card?.is_upgraded === true, description: card?.description || null })).filter(card => card.name),
    deck_size: deck.length,
    // The encounter the act ends with, and the floor it sits on, when the map
    // is in front of us. This is what makes a power target measurable against a
    // named threat instead of an invented HP number.
    boss: map?.boss ? { name: map.boss.name || map.boss.id || null, floor: map.boss.row ?? null } : null,
    enemies: (state?.battle?.enemies || []).map(enemy => enemy.name).filter(Boolean).slice(0, 6),
    event: state?.event?.name || state?.event?.event_name || null,
    ...extra,
  };
}

export class Curriculum {
  constructor({ skillDir, planner, record = () => {}, playerName = 'player', roomId = null }) {
    this.file = skillDir ? path.join(skillDir, 'scratchpad', 'objectives.json') : null;
    this.planner = planner;
    this.record = record;
    this.playerName = playerName;
    this.roomId = roomId;
    this.lastCheckedAt = 0;
    this.lastMarker = null;
    this.crossedBoundary = false;
    this.load();
    this.retireForeignObjective();
  }

  /**
   * An objective is opened against one run. A new room is a new seed: a
   * different map, different offers, different fights. An objective the
   * previous room left open therefore describes a situation that no longer
   * exists and can never be met, so it is closed here rather than left for the
   * critic to keep failing. The completed and failed lists are the part meant
   * to cross rooms, and they are untouched.
   */
  retireForeignObjective() {
    const objective = this.active;
    const from = objective?.opened?.room;
    if (!objective || !this.roomId || !from || from === this.roomId) return null;
    objective.status = 'abandoned';
    objective.closed = { at: Date.now(), reasoning: `left open when room ${from} ended; a new room plays a new seed, so this objective's situation no longer exists` };
    this.save();
    this.record({ type: 'objective_retired_with_room', id: objective.id, from });
    return objective;
  }

  load() {
    this.ledger = { version: SCHEMA, objectives: [] };
    if (!this.file) return;
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (saved?.version === SCHEMA && Array.isArray(saved.objectives)) {
        this.ledger = saved;
        for (const item of this.ledger.objectives) if (item.status === 'failed') item.status = 'abandoned';
      }
    } catch { /* a missing or unreadable ladder simply starts empty */ }
  }

  save() {
    if (!this.file) return false;

    this.ledger.summary = this.summary();
    this.ledger.updated = new Date().toISOString();
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.ledger, null, 2) + '\n');
    return true;
  }

  get active() {
    return this.ledger.objectives.find(item => item.status === 'active') || null;
  }

  get completed() { return this.ledger.objectives.filter(item => item.status === 'completed'); }
  get failed() { return this.ledger.objectives.filter(item => item.status === 'abandoned'); }

  summary() {
    const areas = {};
    for (const item of this.ledger.objectives) {
      const area = AREAS.includes(item.area) ? item.area : 'meta_strategy';
      areas[area] ||= { completed: 0, abandoned: 0 };
      if (item.status === 'completed') areas[area].completed++;
      if (item.status === 'abandoned') areas[area].abandoned++;
    }
    return areas;
  }

  /** What the decision prompt sees: the current objective plus a bounded frontier. */
  context() {
    const active = this.active;
    return {
      objective: active && {
        text: active.text,
        why: active.why,
        done_when: active.done_when,
        area: active.area,
        attempts: active.attempts,
        last_critique: active.critiques?.at(-1) || null,
      },
      curriculum_summary: this.summary(),
    };
  }

  /** True when there is nothing to work towards and the run can carry one. */
  needsObjective(state) {
    return !this.active && Boolean(state?.run?.floor);
  }

  /**
   * True at a real progress boundary: the run moved, or enough decisions have
   * passed that a long objective deserves a second look.
   */
  dueForCheck(state, decision) {
    const objective = this.active;
    if (!objective) return false;
    if (decision - this.lastCheckedAt < MIN_CHECK_GAP) return false;
    return this.crossedBoundary;
  }

  /**
   * Latch the boundary rather than compare against the immediately previous
   * decision. In STS2 the floor number advances exactly when a fight begins, and
   * the caller will not run the critic while state.battle is set - so the one
   * decision that saw the transition was always skipped, and this method then
   * overwrote the marker and erased the evidence. The critic never ran once in
   * 85 decisions. A crossing stays pending until a check actually consumes it.
   *
   * The act and floor alone cannot see the start of a run. Neow sits on act 1
   * floor 1, and choosing a blessing does not move either number: an objective
   * opened before the blessing and settled after it produced an identical
   * marker, so the boundary never latched, the critic was never asked, and the
   * objective stayed active until the run left floor 1. The Ancient's identity
   * plus whether its options are still open is what changes across that screen,
   * so it belongs in the marker.
   */
  observe(state) {
    const event = state?.event || null;
    const ancient = event ? `${event.event_id || event.event_name || 'event'}/${event.is_ancient === true}/${event.in_dialogue === true}` : '';
    const marker = `${state?.run?.act}/${state?.run?.floor}/${state?.state_type === 'game_over'}/${ancient}`;
    if (this.lastMarker !== null && marker !== this.lastMarker) this.crossedBoundary = true;
    this.lastMarker = marker;
  }

  /** Ask the curriculum reasoner for the next objective, given the frontier. */
  async propose(state, { task, decision = 0 }) {
    const payload = {
      run: situation(state),
      standing_task: clamp(task, 1500),
      curriculum_summary: this.summary(),
    };
    const answer = await this.planner.ask({ role: 'curriculum', prompt: 'curriculum.txt', context: payload, deadlineMs: AUXILIARY_DEADLINE_MS });
    const objective = {
      id: `obj-${digest({ decision, text: answer?.objective, at: Date.now() }).slice(0, 8)}`,
      text: clamp(answer?.objective, 240),
      why: clamp(answer?.why, 400),
      done_when: clamp(answer?.done_when, 300),
      area: AREAS.includes(answer?.area) ? answer.area : 'meta_strategy',
      status: 'active',
      attempts: 0,
      critiques: [],
      opened: { room: this.roomId, decision, at: Date.now(), act: state?.run?.act ?? null, floor: state?.run?.floor ?? null, by: this.playerName },
    };
    if (!objective.text || !objective.done_when) throw new Error('curriculum returned no objective and completion condition');
    this.ledger.objectives.push(objective);
    this.lastCheckedAt = decision;
    this.crossedBoundary = false;
    this.save();
    this.record({ type: 'objective_opened', objective });
    return objective;
  }

  /**
   * Self-verification. The critic sees the objective, its completion condition
   * and the evidence, and answers success, failure or pending. A failure returns
   * a critique, which the next decision receives; after MAX_ATTEMPTS failures the
   * objective is abandoned so the curriculum can propose something reachable.
   */
  async verify(state, { decision, evidence = [] }) {
    const objective = this.active;
    if (!objective) return null;
    this.lastCheckedAt = decision;
    this.crossedBoundary = false;
    const payload = {
      objective: { text: objective.text, why: objective.why, done_when: objective.done_when },
      opened_at: objective.opened,
      attempts: objective.attempts,
      previous_critiques: objective.critiques.slice(-2),
      run_now: situation(state),
      evidence: evidence.slice(-12),
    };
    const answer = await this.planner.ask({ role: 'critic', prompt: 'critic.txt', context: payload, deadlineMs: AUXILIARY_DEADLINE_MS });
    const verdict = ['success', 'failure', 'pending'].includes(answer?.verdict) ? answer.verdict : 'pending';
    const reasoning = clamp(answer?.reasoning, 600);
    const critique = clamp(answer?.critique, 600);
    const result = { verdict, reasoning, critique, objective: objective.text, area: objective.area, id: objective.id };
    if (verdict === 'success') {
      objective.status = 'completed';
      objective.closed = { decision, at: Date.now(), reasoning };
    } else if (verdict === 'failure') {
      objective.attempts += 1;
      if (critique) objective.critiques.push(critique);
      // Three attempts are for an objective another try could still reach. One
      // whose moment has passed is finished now: repeating a critique the
      // player cannot act on wastes the decisions it is attached to.
      const unreachable = answer?.reachable === false;
      if (unreachable || objective.attempts >= MAX_ATTEMPTS) {
        objective.status = 'abandoned';
        objective.closed = { decision, at: Date.now(), reasoning: reasoning || critique };
        result.abandoned = true;
        result.unreachable = unreachable;
      }
    }
    this.save();
    this.record({ type: 'objective_checked', ...result, status: objective.status, attempts: objective.attempts });
    return result;
  }

  /** Close the ladder honestly when a run ends without the critic being asked. */
  closeRun(state, { decision, result }) {
    const objective = this.active;
    if (!objective) return null;
    objective.status = 'abandoned';
    objective.closed = { decision, at: Date.now(), reasoning: `the run ended (${result}) with this objective still open` };
    this.save();
    this.record({ type: 'objective_closed_with_run', id: objective.id, status: objective.status });
    return objective;
  }
}
