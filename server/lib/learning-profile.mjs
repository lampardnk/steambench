// Shared identity for the backend, player, and isolated capability probe.
//
// One entry per model the player can run as. Switching is a one-word change -
// STEAMBENCH_MODEL in the environment, or the default below - and nothing else
// in the codebase names a provider, a base URL or a key: everything reads
// PROFILE. models.json carries every provider here, so a switch needs no edit
// to the Pi configuration either.
export const MODEL_PROFILES = Object.freeze({
  experiential: {
    key: 'experiential',
    name: 'STS2-Pi-Experiential',
    provider: 'experiential',
    baseUrl: 'https://api.experientiallabs.ai/v1',
    model: 'gpt-5.6-luna',
    apiKeyEnv: 'EXPLABS_API_KEY',
    // 'max' is pi's own thinking level (off|minimal|low|medium|high|xhigh|max).
    // It only reaches the model when models.json also lets the effort parameter
    // through: measured on one combat turn, --thinking alone changed nothing
    // (~800 reasoning tokens either way, the variance swamping the setting),
    // and with supportsReasoningEffort on it went to 1350-3771. Latency rises
    // with it, 10s to 17-44s, which is inside plannerDeadlineMs and is the
    // trade being made. Reasoning is spent out of max_tokens here, so maxTokens
    // rises with it or the answer itself gets truncated.
    // Asking for an explicit effort changed neither, so nothing is sent - the
    // request stays minimal, which the capability probe enforces.
    reasoning: 'max',
    // Reasoning tokens are spent out of this budget, so it is not the size of
    // the answer - it is the size of the answer plus everything the model
    // thought first. A 64-token cap on this model returned finish_reason
    // "length" with 64 reasoning tokens and no content at all, which is the
    // exact failure that ended rooms on the previous one.
    maxTokens: 65536,
    contextWindow: 1050000,
  },
  deepseek: {
    key: 'deepseek',
    name: 'STS2-Pi-DeepSeek',
    provider: 'experiential',
    baseUrl: 'https://api.experientiallabs.ai/v1',
    model: 'deepseek-v4.1-flash',
    apiKeyEnv: 'EXPLABS_API_KEY',
    // Measured against the live route. reasoning_effort is honoured and max is
    // an accepted level (the route also takes none|minimal|low|medium|high|
    // xhigh|ultra), and thinking is billed out of max_tokens - the request that
    // answered "OK" still spent 13 reasoning tokens from the same budget - so
    // the cap has to cover the thought and the answer together.
    reasoning: 'max',
    // The route refuses anything larger: "exceeds this model route's maximum of
    // 393216". A cap, not a spend: an ordinary decision uses a tiny fraction.
    maxTokens: 393216,
    // The route names this itself: "the largest context window on this model
    // route is 1,048,576 tokens". A 100k-token prompt was accepted and cached.
    contextWindow: 1048576,
  },
  orcarouter: {
    key: 'orcarouter',
    name: 'STS2-Pi-OrcaRouter',
    provider: 'orcarouter',
    baseUrl: 'https://api.orcarouter.ai/v1',
    model: 'z-ai/glm-5.3-flash-free',
    apiKeyEnv: 'ORCA_KEY',
    reasoning: 'default',
    maxTokens: 4096,
    contextWindow: 128000,
  },
  gemini: {
    key: 'gemini',
    name: 'STS2-Pi-Gemini',
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-3.8-flash',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    // Measured on the live route: `reasoning_effort` is honoured and high is
    // accepted. Not `max`: pi silently clamps max down to high unless the model
    // declares thinkingLevelMap:{max:"max"}, and this route does not need a map
    // to be told high - so high is what it is actually sent, and saying max here
    // would be a configuration that lies about the wire.
    reasoning: 'high',
    // Thinking is billed out of max_tokens here too: the request that answered
    // "OK" spent 103 of its 108 completion tokens reasoning, and the route
    // reports 65536 as its maximum completion. A cap sized for the answer alone
    // truncates the thought.
    maxTokens: 65536,
    contextWindow: 1048576,
  },
});

export const DEFAULT_MODEL = 'gemini';

const selected = process.env.STEAMBENCH_MODEL || DEFAULT_MODEL;
if (!MODEL_PROFILES[selected]) {
  throw new Error(`STEAMBENCH_MODEL=${selected} is not a known profile; choose one of ${Object.keys(MODEL_PROFILES).join(', ')}`);
}

export const PROFILE = Object.freeze({
  image: 'steambench-learning:latest',
  // Bumped whenever the model changes: a checkpoint written by one model's run
  // is not a run this one can resume. v0.6 is the gemini run.
  checkpointVersion: 'STS2-Pi-Learn-v0.6',
  plannerDeadlineMs: 120000,
  ...MODEL_PROFILES[selected],
});

/** Every key the player might need, so a container is given the one it uses. */
export const API_KEY_ENVS = Object.freeze([...new Set(Object.values(MODEL_PROFILES).map(profile => profile.apiKeyEnv))]);

export function normalizePlayerKind(kind = 'builtin') {
  if (kind === 'builtin') return kind;
  throw new Error('player.kind must be builtin; custom and legacy players are not supported');
}
