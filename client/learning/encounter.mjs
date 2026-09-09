import { digest } from './state.mjs';
const card = item => ({ instance_id: item.instance_id ?? null, id: item.id || item.card_id, name: item.name, type: item.type, description: item.description?.slice(0, 320) });
// The mod publishes buffs and debuffs as `status`. This read `powers || buffs`,
// neither of which the sensor has ever set, so player_powers and every enemy's
// powers were reported as [] on every turn of every fight - while the state
// itself carried Thorns 3, Strength 1 and Surrounded 1. An empty list is worse
// than a missing field: it reads as "no powers", which is a lie.
const extractPowers = entity => (entity?.status || entity?.powers || entity?.buffs || [])
  .map(p => ({ id: p.id || p.power_id, name: p.name, amount: p.amount ?? null, type: p.type ?? null, description: p.description?.slice(0, 160) }));

// Reconstructed from current observations after every reload. Never inherits old combat state.
export class EncounterScratchpad {
  constructor() { this.reset(); }
  reset() { this.key = null; this.value = null; }
  observe(state, verifiedEffects = []) {
    if (!state.battle || !state.player?.hand) { this.reset(); return null; }
    const enemyIds = (state.battle.enemies || []).map(e => e.combat_id ?? e.entity_id ?? e.name).join(',');
    const key = digest([state.run?.seed ?? null, state.run?.act, state.run?.floor, state.ui?.encounter_id ?? enemyIds]);
    const encounterChanged = key !== this.key;
    if (encounterChanged) this.reset();
    const previous = this.value;
    this.key = key;
    const recentEffects = encounterChanged ? verifiedEffects.slice(-4) : [...(previous?.verified_recent_effects || []), ...verifiedEffects].slice(-4);
    this.value = {
      encounter: key,
      round: state.battle.round,
      piles: Object.fromEntries(['hand', 'draw_pile', 'discard_pile', 'exhaust_pile'].map(name => [name, { count: state.player[`${name}_count`] ?? state.player[name]?.length ?? null, cards: (state.player[name] || []).map(card), order_known: name !== 'draw_pile' }])),
      player_powers: extractPowers(state.player),
      // Everything a turn is spent out of, and everything that spends itself
      // without saying so. A relic counter can advance or reset with no log
      // line, so the current value is the only record of it.
      resources: {
        hp: state.player.hp ?? null, max_hp: state.player.max_hp ?? null, block: state.player.block ?? null,
        energy: state.player.energy ?? null, max_energy: state.player.max_energy ?? null,
        potion_slots: state.player.max_potion_slots ?? null,
      },
      potions: (state.player.potions || []).map(p => ({ slot: p.slot, name: p.name, description: p.description, target_type: p.target_type, usable_in_combat: p.can_use_in_combat !== false })),
      relics: (state.player.relics || []).map(r => ({ id: r.id, name: r.name, description: r.description, counter: r.counter ?? null })),
      enemies: (state.battle.enemies || []).map(e => ({ combat_id: e.combat_id ?? e.entity_id, name: e.name, hp: e.hp, max_hp: e.max_hp ?? null, block: e.block ?? null, intents: e.intents, powers: extractPowers(e) })),
      verified_recent_effects: recentEffects,
      unresolved_hypotheses: encounterChanged ? [] : (previous?.unresolved_hypotheses || []),
      authority: 'Fresh piles, powers and intents replace all earlier memory. Draw pile membership is not draw order.',
    };
    return this.context();
  }
  hypothesize(text) { if (this.value) this.value.unresolved_hypotheses = [String(text).slice(0, 600)]; }
  context() {
    if (!this.value) return null;
    const result = structuredClone(this.value);
    // Compress repetitions, retaining every exhausted identity and every restriction.
    for (const pile of Object.values(result.piles)) {
      const groups = new Map();
      for (const item of pile.cards) {
        const key = digest([item.id, item.name, item.description]);
        if (!groups.has(key)) groups.set(key, { ...item, instances: [], count: 0 });
        const row = groups.get(key); row.count++; row.instances.push(item.instance_id);
      }
      pile.cards = [...groups.values()];
    }
    return result;
  }
}
