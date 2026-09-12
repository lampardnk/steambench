// What each member of the team spent, per turn and in total.
//
// The player already wrote this to its own run log, which the browser cannot
// read, so the dashboard had no way to show what a decision cost. Every turn
// is billed to the lane that spent it, and the lane totals are kept as running
// sums rather than recomputed from the turn list, so trimming old turns never
// changes what an agent is reported to have spent over the whole run.

/** Turns kept per lane. Old turns roll off; the lane's totals do not. */
const MAX_TURNS_PER_LANE = 200;

const TOKEN_FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning', 'totalTokens'];
const count = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/**
 * Tokens a turn put through the context window.
 *
 * Every call is a fresh session, so this is what one turn occupied, never a
 * conversation growing towards a limit: the prompt plus what the model wrote
 * back. Cache reads count - they occupy the window whether or not they were
 * billed as fresh input.
 */
export function contextUsed(turn) {
  return count(turn.input) + count(turn.cacheRead) + count(turn.output);
}

const emptyTotals = () => ({ turns: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0, latencyMs: 0, peakContextUsed: 0 });

export class UsageLedger {
  constructor({ maxTurns = MAX_TURNS_PER_LANE } = {}) {
    this.maxTurns = maxTurns;
    /** @type {Map<string, {turns: object[], totals: ReturnType<emptyTotals>, contextWindow: number|null}>} */
    this.lanes = new Map();
  }

  /** Record one model call against the lane that made it. */
  add(message) {
    const lane = message.agent || message.role || 'room';
    const usage = message.usage || {};
    const turn = {
      at: Date.now(),
      role: message.role || null,
      model: message.model || null,
      thinking: message.thinking || null,
      stopReason: message.stopReason || null,
      latencyMs: count(message.latencyMs),
      contextWindow: count(message.contextWindow) || null,
    };
    for (const field of TOKEN_FIELDS) turn[field] = count(usage[field]);
    // A provider that reports no total is not a provider that spent nothing.
    if (!turn.totalTokens) turn.totalTokens = turn.input + turn.output;
    turn.contextUsed = contextUsed(turn);

    const entry = this.lanes.get(lane) || { turns: [], totals: emptyTotals(), contextWindow: null };
    entry.turns.push(turn);
    if (entry.turns.length > this.maxTurns) entry.turns.splice(0, entry.turns.length - this.maxTurns);
    entry.contextWindow = turn.contextWindow || entry.contextWindow;
    for (const field of TOKEN_FIELDS) entry.totals[field] += turn[field];
    entry.totals.turns++;
    entry.totals.latencyMs += turn.latencyMs;
    entry.totals.peakContextUsed = Math.max(entry.totals.peakContextUsed, turn.contextUsed);
    this.lanes.set(lane, entry);
    return { lane, turn };
  }

  /** Plain object for the wire; Maps do not survive JSON. */
  get snapshot() {
    return Object.fromEntries([...this.lanes].map(([lane, entry]) => [lane, { turns: entry.turns, totals: entry.totals, contextWindow: entry.contextWindow }]));
  }

  /** Restore a snapshot so a resumed room keeps what it already spent. */
  restore(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return this;
    for (const [lane, entry] of Object.entries(snapshot)) {
      if (!entry || !Array.isArray(entry.turns)) continue;
      this.lanes.set(lane, { turns: entry.turns, totals: { ...emptyTotals(), ...entry.totals }, contextWindow: entry.contextWindow ?? null });
    }
    return this;
  }
}
