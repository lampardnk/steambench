// Sole model identity shared by the backend, player, and capability probe.
// Provider details live here and in Pi's matching models.json entry only.
export const PROFILE = Object.freeze({
  key: 'luna',
  name: 'STS2-Pi-Luna',
  provider: 'experiential',
  baseUrl: 'https://api.experientiallabs.ai/v1',
  model: 'gpt-5.6-luna',
  apiKeyEnv: 'EXPLABS_API_KEY',
  reasoning: 'max',
  // Reasoning tokens share this completion budget. The route has previously
  // accepted 65,536 reliably, which leaves ample room for max reasoning while
  // remaining below the model page's advertised 128K output ceiling.
  maxTokens: 65536,
  contextWindow: 1050000,
  image: 'steambench-learning:latest',
  checkpointVersion: 'STS2-Pi-Learn-v0.7',
  plannerDeadlineMs: 120000,
});

/**
 * The System One model the player asks for cheap, typed judgements.
 *
 * Jev answers a map of typed questions against one state and returns values
 * with calibrated probabilities. It writes no text, so it never replaces the
 * planner - it front-runs it on the decisions that are classifications rather
 * than reasoning, and hands back anything it is not sure about.
 *
 * Routed through OpenRouter rather than the Experiential Labs gateway the
 * planner uses. Measured against that gateway, order-rotated and interleaved so
 * neither route got a kinder window: Noul and Choice answered 20/20 on both,
 * but 4- and 6-level Score answered 20/20 here against 10/20 there. OpenRouter
 * also reports a pinned version instead of a moving alias, which matters
 * because the confidence gates below are tuned against one version's numbers.
 *
 * `optional` is the whole safety story: with no key the player runs exactly as
 * it did before, because every caller falls back to the planner.
 */
export const SYSTEM_ONE = Object.freeze({
  baseUrl: 'https://openrouter.ai/api/alpha/decisions',
  // Pinned, never 'jev-latest': an alias moves when a release ships and would
  // silently retune every threshold in the cascade.
  model: 'typesafe/jev-1.13-20260917',
  apiKeyEnv: 'OPENROUTER_API_KEY',
  optional: true,
  // Measured at 0.39-0.43s per call on this route. The budget is for a stall,
  // not for the model: past this the planner answers instead, and waiting
  // longer costs more than the call was ever going to save.
  deadlineMs: 8000,
  maxAttempts: 3,
});

// The planner's key is required; the System One key is not. A room with no
// OPENROUTER_API_KEY is fully functional and simply never consults Jev.
export const API_KEY_ENVS = Object.freeze([PROFILE.apiKeyEnv, SYSTEM_ONE.apiKeyEnv]);

export function normalizePlayerKind(kind = 'builtin') {
  if (kind === 'builtin') return kind;
  throw new Error('player.kind must be builtin; custom and legacy players are not supported');
}
