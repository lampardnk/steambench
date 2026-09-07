// Shared identity for the backend, player, and isolated capability probe.
export const PROFILE = Object.freeze({
  name: 'STS2-Pi-OrcaRouter',
  image: 'steambench-learning:latest',
  checkpointVersion: 'STS2-Pi-Learn-v0.2',
  provider: 'orcarouter',
  baseUrl: 'https://api.orcarouter.ai/v1',
  model: 'z-ai/glm-5.3-flash-free',
  reasoning: 'default',
  apiKeyEnv: 'ORCA_KEY',
  maxTokens: 4096,
  plannerDeadlineMs: 120000,
});

export function normalizePlayerKind(kind = 'builtin') {
  if (kind === 'builtin') return kind;
  throw new Error('player.kind must be builtin; custom and legacy players are not supported');
}
