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
    // The model reasons, and the provider's own default effort is what was
    // measured: 137-190 reasoning tokens and 2-9 seconds on real contexts.
    // Asking for an explicit effort changed neither, so nothing is sent - the
    // request stays minimal, which the capability probe enforces.
    reasoning: 'default',
    // Reasoning tokens are spent out of this budget, so it is not the size of
    // the answer - it is the size of the answer plus everything the model
    // thought first. A 64-token cap on this model returned finish_reason
    // "length" with 64 reasoning tokens and no content at all, which is the
    // exact failure that ended rooms on the previous one.
    maxTokens: 16384,
    contextWindow: 1050000,
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
});

export const DEFAULT_MODEL = 'experiential';

const selected = process.env.STEAMBENCH_MODEL || DEFAULT_MODEL;
if (!MODEL_PROFILES[selected]) {
  throw new Error(`STEAMBENCH_MODEL=${selected} is not a known profile; choose one of ${Object.keys(MODEL_PROFILES).join(', ')}`);
}

export const PROFILE = Object.freeze({
  image: 'steambench-learning:latest',
  // Bumped whenever the model changes: a checkpoint written by one model's run
  // is not a run this one can resume.
  checkpointVersion: 'STS2-Pi-Learn-v0.3',
  plannerDeadlineMs: 120000,
  ...MODEL_PROFILES[selected],
});

/** Every key the player might need, so a container is given the one it uses. */
export const API_KEY_ENVS = Object.freeze([...new Set(Object.values(MODEL_PROFILES).map(profile => profile.apiKeyEnv))]);

export function normalizePlayerKind(kind = 'builtin') {
  if (kind === 'builtin') return kind;
  throw new Error('player.kind must be builtin; custom and legacy players are not supported');
}
