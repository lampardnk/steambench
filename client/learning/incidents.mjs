import fs from 'node:fs';
import path from 'node:path';
import { VERSION, stateId } from './state.mjs';

export function saveIncident(directory, details) {
  const id = `${Date.now()}-${details.decision}`;
  const folder = path.join(directory, 'incidents', id);
  fs.mkdirSync(folder, { recursive: true });
  const { beforeImage, afterImage, ...evidence } = details;
  const incident = { id, version: VERSION, at: new Date().toISOString(), status: 'awaiting_operator', ...evidence };
  for (const [name, screenshot] of [['before', beforeImage], ['after', afterImage]]) {
    if (screenshot?.data_base64) {
      fs.writeFileSync(path.join(folder, `${name}.jpg`), Buffer.from(screenshot.data_base64, 'base64'));
      incident[`${name}Image`] = { file: `${name}.jpg`, ageMs: screenshot.age_ms };
    }
  }
  if (incident.after) incident.observationId = stateId(incident.after);
  fs.writeFileSync(path.join(folder, 'incident.json'), JSON.stringify(incident, null, 2));
  const attention = { id, decision: details.decision, error: details.error, path: `incidents/${id}/incident.json`, at: incident.at, status: incident.status };
  fs.writeFileSync(path.join(directory, 'attention.json'), JSON.stringify(attention, null, 2));
  return attention;
}

export function learningDelta(before, after) {
  const compact = state => state ? { state: state.state_type, run: state.run, hp: state.player?.hp, block: state.player?.block, energy: state.player?.energy, hand: state.player?.hand?.map(card => ({ instance: card.instance_id, id: card.id })), enemies: state.battle?.enemies?.map(enemy => ({ combatId: enemy.combat_id, hp: enemy.hp, block: enemy.block, status: enemy.status })) } : null;
  return { before: compact(before), after: compact(after) };
}
