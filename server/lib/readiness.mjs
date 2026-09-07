import fs from 'node:fs';
import path from 'node:path';
import { PROFILE } from './learning-profile.mjs';

// Only an actual Pi streaming/JSON/image probe can mark the exact free model ready.
// A missing key, absent/expired evidence, or any failed capability leaves it unready.
export function learningReadiness(cfg, now = Date.now()) {
  if (!cfg.learningKey) return { ready: false, reason: 'ORCA_KEY is absent from the system environment' };
  try {
    const result = JSON.parse(fs.readFileSync(path.join(cfg.runtimeDir, 'learning', 'provider-readiness.json'), 'utf8'));
    if (result.model !== PROFILE.model || result.baseUrl !== PROFILE.baseUrl || result.profile !== PROFILE.checkpointVersion) throw new Error('probe configuration differs');
    if (!(result.at <= now && now - result.at < 24 * 60 * 60 * 1000)) throw new Error('probe evidence expired');
    if (result.ready !== true || !['streaming', 'json', 'image'].every(key => result.capabilities?.[key] === true)) {
      return { ready: false, reason: `Exact-model probe failed: ${String(result.error || 'capability rejected').slice(0, 300)}` };
    }
    return { ready: true, reason: null };
  } catch { return { ready: false, reason: 'Run the isolated exact-model capability probe; no current passing evidence exists' }; }
}
