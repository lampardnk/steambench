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

export const API_KEY_ENVS = Object.freeze([PROFILE.apiKeyEnv]);

export function normalizePlayerKind(kind = 'builtin') {
  if (kind === 'builtin') return kind;
  throw new Error('player.kind must be builtin; custom and legacy players are not supported');
}
