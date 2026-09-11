import fs from 'node:fs';
import path from 'node:path';
import { VERSION, digest } from './state.mjs';

export function compatibility(state, policyHash) {
  if (!state.build?.game || !state.build?.mod) return null;
  return { game: state.build.game, mod: state.build.mod, policy: policyHash };
}

export function acceptedLessons(seed, build) {
  if (!build || seed?.version !== VERSION || digest(seed.compatibility) !== digest(build) || !Array.isArray(seed.lessons)) return [];
  return seed.lessons.filter(item => item.status === 'accepted' && typeof item.text === 'string'
    && item.text.length <= 500 && typeof item.review === 'string' && item.review.trim()
    && Array.isArray(item.evidence) && item.evidence.length > 0).slice(0, 8).map(item => item.text);
}

export class ObservationCatalog {
  constructor(directory) {
    this.file = path.join(directory, 'observed-catalog.json');
    this.entries = {};
    try {
      const previous = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (previous.version === VERSION && previous.entries) this.entries = previous.entries;
    } catch { }
  }

  observe(state, decision, build) {
    let changed = false;
    const add = (kind, item, conditions) => {
      const identity = item?.id || item?.name || item?.event_id || item?.event_name;
      if (!identity) return;
      const key = `${kind}:${identity}`;
      if (!this.entries[key] && Object.keys(this.entries).length >= 1500) return;
      const record = { ...item };
      for (const field of ['instance_id', 'index', 'can_play', 'unplayable_reason', 'entity_id', 'combat_id']) delete record[field];
      const variant = digest(record);
      const entries = this.entries[key] ||= [];
      if (entries.some(entry => entry.variant === variant)) return;
      entries.push({ variant, observation: record, conditions, compatibility: build, evidence: { decision, floor: state.run?.floor } });
      if (entries.length > 8) entries.shift();
      changed = true;
    };
    for (const card of state.deck || []) add('deck_card', card, 'Permanent deck observation, not a combat prediction.');
    for (const card of state.player?.hand || []) add('hand_card', card, { playerStatus: state.player.status, enemyStatuses: state.battle?.enemies?.map(enemy => enemy.status) });
    for (const enemy of state.battle?.enemies || []) add('enemy', enemy, { ascension: state.run?.ascension, round: state.battle.round });
    if (state.event) add('event', state.event, { optionsAreContextual: true });
    if (changed) fs.writeFileSync(this.file, JSON.stringify({ version: VERSION, compatibility: build, scope: 'Observed variants only; not universal mechanics or an exhaustive wiki.', entries: this.entries }, null, 2));
  }
}
