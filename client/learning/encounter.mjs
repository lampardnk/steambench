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
  reset() { this.key = null; this.value = null; this.turn = null; }

  /**
   * How many Attacks have already been played this turn.
   *
   * Stomp reads "Deal 12 damage to ALL enemies. Costs 1 less for each Attack
   * played this turn", and the hand reports its cost RIGHT NOW - so the agent
   * can see what Stomp costs but not what it would cost after the Strikes it
   * is about to plan. The game keeps that tally and the mod does not publish
   * it, so the runtime counts it: cards played this turn are the ones that
   * have joined the discard or exhaust piles since the round began.
   *
   * A mid-turn reshuffle empties the discard back into the draw pile and
   * destroys the baseline. That is reported as null, not as a smaller number -
   * a wrong count here is worse than an absent one, because it would be
   * spent on arithmetic.
   */
  countPlayed(state) {
    const seen = [...(state.player?.discard_pile || []), ...(state.player?.exhaust_pile || [])];
    const ids = new Set(seen.map(item => item.instance_id).filter(id => id != null));
    const round = state.battle?.round ?? null;
    if (!this.turn || this.turn.round !== round) {
      this.turn = { round, baseline: ids, valid: true };
      return { attacks: 0, cards: 0 };
    }
    // Anything the baseline held that is no longer there means the piles were
    // rebuilt underneath us; the delta stops meaning anything.
    if (this.turn.valid) this.turn.valid = [...this.turn.baseline].every(id => ids.has(id));
    if (!this.turn.valid) return { attacks: null, cards: null };
    const fresh = seen.filter(item => item.instance_id != null && !this.turn.baseline.has(item.instance_id));
    return { attacks: fresh.filter(item => item.type === 'Attack').length, cards: fresh.length };
  }
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
      ...(() => { const played = this.countPlayed(state); return { attacks_played_this_turn: played.attacks, cards_played_this_turn: played.cards }; })(),
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
      authority: 'Fresh piles, powers and intents replace all earlier memory. Draw pile membership is not draw order. attacks_played_this_turn is what a cost-reducing card has already counted; null means a reshuffle made it unknowable, so read the live cost instead.',
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
