import fs from 'node:fs';

const entries = JSON.parse(fs.readFileSync(new URL('./references.json', import.meta.url), 'utf8'));
const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function encounterReferences(state) {
  const names = new Set([
    ...(state.battle?.enemies || []).flatMap(enemy => [enemy.name, enemy.id]),
    state.event?.name, state.event?.id,
    ...(state.state_type === 'map' ? [state.map?.boss?.name, state.map?.boss?.id] : []),
  ].filter(Boolean).map(normalize));
  return entries.filter(entry => entry.names.some(name => names.has(normalize(name)))).slice(0, 3);
}
