// Shared by the backend and learning image; keep storage/checkpoint aliases stable.
export const PROFILE = Object.freeze({
  name: 'STS2-Pi-Luna-v0.1',
  image: 'sts2-pi-luna:0.1',
  checkpointVersion: 'STS2-Pi-Learn-v0.1',
  provider: 'openrouter',
  model: 'openai/gpt-5.6-luna',
  reasoning: 'max',
  apiKeyEnv: 'OPENROUTER_API_KEY',
  plannerDeadlineMs: 180000,
});
