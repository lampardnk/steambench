import { SYSTEM_ONE } from './profile.mjs';
import { transientUpstream } from './state.mjs';

/**
 * The System One model: cheap typed judgements, no generated text.
 *
 * This is deliberately not the planner. `planner.ask` spawns Pi, streams a
 * response and parses a plan out of prose; this posts one JSON body and gets
 * back values with probabilities attached. Nothing here can produce an action
 * the caller did not already enumerate, which is the whole reason it is safe
 * to put in front of a decision: a Choice can only return a key it was handed.
 *
 * A plain fetch rather than @typesafe-ai/sdk. The player image should not grow
 * a dependency for one POST, and the SDK's main draw - retry with backoff - is
 * already the house pattern via `transientUpstream`.
 */

/** A yes/no judgement. Returns a probability, not a boolean. */
export const noul = (instructions, criteria = null) => ({ type: 'noul', instructions, ...(criteria ? { criteria } : {}) });
/** One option out of a closed set. `criteria` maps option id to description. */
export const choice = (instructions, criteria) => ({ type: 'choice', instructions, criteria });
/**
 * A rubric rating. Present for completeness and used nowhere in the cascade:
 * measured against the same decisions, a Noul battery agreed 9/15 where a
 * Score battery managed 5/15, which matches the vendor's own note that Jev's
 * score levels are weakly calibrated. Reach for it only when something is
 * genuinely ordinal and a threshold will not do.
 */
export const score = (instructions, criteria) => ({ type: 'score', instructions, criteria });

export class SystemOneUnavailable extends Error {
  constructor(message) { super(message); this.name = 'SystemOneUnavailable'; }
}

/** Whether a room can consult the model at all. Absent key means "no". */
export function configured(env = process.env) { return Boolean(env[SYSTEM_ONE.apiKeyEnv]); }

export class SystemOne {
  /**
   * `fetchImpl` is injected so tests exercise the retry, the deadline and the
   * answer shape without reaching the network.
   */
  constructor({ emit = () => {}, record = () => {}, env = process.env, fetchImpl = globalThis.fetch, config = SYSTEM_ONE } = {}) {
    this.emit = emit;
    this.record = record;
    this.env = env;
    this.fetchImpl = fetchImpl;
    this.config = config;
    this.available = Boolean(env[config.apiKeyEnv]);
  }

  /**
   * Evaluate one state against a map of typed questions.
   *
   * Every question is answered against the same state in one round trip, and
   * the model prices only its input, so asking twelve costs what asking one
   * costs - measured at 0.65s for twelve against 0.88s for one. Batch
   * generously rather than making a second call.
   *
   * Throws `SystemOneUnavailable` when there is no key or the route stays
   * broken. Callers treat that as "ask the planner", never as a run failure.
   */
  async ask({ state, questions, agent = 'systemone', role = 'systemone', deadlineMs = this.config.deadlineMs }) {
    if (!this.available) throw new SystemOneUnavailable(`${this.config.apiKeyEnv} is absent`);
    if (!questions || !Object.keys(questions).length) throw new Error('system one needs at least one question');
    const body = JSON.stringify({ state, model: this.config.model, questions });
    const started = Date.now();
    let last = null;
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      // One budget for the whole call, not one per attempt. Retrying three
      // times at the full deadline could spend longer than the planner it is
      // trying to save, which would make a "fast path" the slowest thing here.
      const remaining = deadlineMs - (Date.now() - started);
      if (remaining <= 0) break;
      try {
        const response = await this.fetchImpl(this.config.baseUrl, {
          method: 'POST', signal: AbortSignal.timeout(remaining),
          headers: { Authorization: `Bearer ${this.env[this.config.apiKeyEnv]}`, 'Content-Type': 'application/json' },
          body,
        });
        if (!response.ok) {
          // The route answers a rejected body with 4xx and a transient outage
          // with 5xx, and only the second is worth another attempt. A 502 here
          // is an origin failure, not a malformed question.
          const detail = (await response.text().catch(() => '')).slice(0, 200);
          const error = new Error(`system one ${response.status}: ${detail}`);
          if (response.status < 500 && response.status !== 429) throw Object.assign(error, { fatal: true });
          last = error;
        } else {
          const payload = await response.json();
          const latencyMs = Date.now() - started;
          const usage = payload.usage || {};
          this.record({ type: 'system_one_usage', role, agent, model: payload.model, usage, latencyMs, attempts: attempt, questions: Object.keys(questions).length });
          // Billed to the same ledger as the planner, or the dashboard would
          // report a run as costing only what the expensive model spent.
          this.emit({
            type: 'steambench_usage', agent, role, model: payload.model, latencyMs, thinking: null,
            usage: { input: usage.input_tokens || 0, output: usage.output_tokens || 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0), cost: usage.cost || 0 },
            stopReason: 'stop', contextWindow: null,
          });
          return { answers: payload.answers || {}, usage, model: payload.model, latencyMs };
        }
      } catch (error) {
        if (error.fatal) throw error;
        last = error;
        if (!(transientUpstream(error.message) || error.name === 'TimeoutError' || error.name === 'AbortError' || /system one 5\d\d|system one 429/.test(error.message))) throw error;
      }
      if (attempt < this.config.maxAttempts && deadlineMs - (Date.now() - started) > 0) await new Promise(resolve => setTimeout(resolve, 150 * attempt));
    }
    this.record({ type: 'system_one_failure', role, agent, error: last?.message, attempts: this.config.maxAttempts });
    throw new SystemOneUnavailable(last?.message || 'system one unavailable');
  }
}
