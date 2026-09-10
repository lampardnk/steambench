---
description: Act 2 Hive elites — wiki fact reference for every published elite, move, effect, and encounter interaction.
character: ironclad
act: 2
category: elite
ascension: a1
keys: [ironclad, act2, hive, elite, decimillipede, entomancer, infested prism, reattach, personal hive, tainted, vital spark]
sources: [slaythespire.wiki.gg]
---

# Act 2 — Hive elites

This is a source-bounded reference to the Hive elite pool. HP and damage
values use the wiki's base and displayed ascension values; the live intent is
authoritative if the installed build differs. “A8” is the wiki's HP value at
Ascension 8 and “A9” is its damage value at Ascension 9 unless an entry says
otherwise.

## Reading the entries

- Attack, Buff, Debuff, and Status labels describe the move's effect class;
  targets are stated where a move combines effects.
- A multi-hit value such as `3×7` is seven separate damage instances.
- A pattern is an encounter rule, not a prediction for a different build or a
  replacement for the live intent.

## Roster

### Decimillipede — 40–46 HP per segment (A8: 46–52), three segments

The encounter contains front, middle, and back segments with the same stats.
Each segment starts at a different point of the cycle.

- Reattach 25 — if another segment is alive, revives the segment in 2 turns
  with 25 HP.
- Bulk (Attack · Buff) — 6 damage (A9: 7), then gains 2 Strength.
- Writhe (Attack) — 5×2 damage (A9: 6×2).
- Outgas (Attack · Debuff) — 8 damage (A9: 9), then applies 1 Weak.
- Pattern per living segment: Bulk, Writhe, Outgas, then repeat. The opening
  offsets remain until a segment dies; a revived segment resumes with a random
  move and can disrupt the prior synchrony.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Decimillipede](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Decimillipede).
- A segment at 0 HP is not a final kill while another segment remains. The wiki
  records that Fatal effects trigger only when the final enemy is killed.
- The Reattach page records the two-turn delay and 25 HP revival. Doom timing
  can overlap a regeneration because Doom resolves after enemy-turn events;
  Poison has a different timing.
- Effect references: [Reattach](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Reattach)
  and [Weak](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Weak).

### Entomancer — 145 HP (A8: 165)

- Starts with Personal Hive 1. Whenever it is hit by an Attack, Personal Hive
  adds 1 Dazed to the player's draw pile.
- Beeeees! (Attack) — 3×7 damage (A9: 3×8).
- Spear! (Attack) — 18 damage (A9: 20).
- Pheromone Spit (Buff) — gains 1 Personal Hive and 1 Strength. If Personal
  Hive is already 3, it gains 2 Strength instead.
- Pattern: Beeeees!, Spear!, Pheromone Spit, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Entomancer](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Entomancer).
- Personal Hive triggers when the Entomancer takes Attack damage, not merely
  when an Attack card is played. A multi-hit Attack can therefore trigger it
  once per hit; indirect damage does not add Dazed through this power.
- Personal Hive stops increasing at 3; subsequent Pheromone Spit uses give the
  alternate Strength amount. Dazed is added to the player's draw pile.
- Effect reference: [Personal Hive](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Entomancer).

### Infested Prism — 161 HP (A8: 171)

- Vital Spark 2 (A9: 3) — all Skills are Tainted by the listed amount.
- Tainted — the player takes the listed additional damage from Attacks for the
  turn after playing a Tainted Skill.
- Jab (Attack) — 15 damage (A9: 17).
- Radiate (Attack · Block) — 11 damage (A9: 13), then gains 16 Block (A9: 18).
- Whirlwind (Attack) — 5×3 damage (A9: 6×3).
- Pulsate (Attack · Block · Buff) — 8 damage (A9: 10), gains 20 Block (A9:
  22), and gains 2 Vital Spark (A9: 3).
- Pattern: Jab, Radiate, Whirlwind, Pulsate, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Infested Prism](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Infested_Prism).
- Tainted is attached to Skills and increases Attack damage taken for that
  turn. The wiki explicitly records that a non-Skill card that provides Block,
  such as Iron Wave or After Image, does not gain Tainted.
- Vital Spark is refreshed by Pulsate and controls the amount assigned by the
  all-Skills Tainted power.
- Effect references: [Tainted](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Tainted)
  and [Vital Spark](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Vital_Spark).

## Neutral calculations and adaptive reading

- Decimillipede's three HP bars are one encounter with separate segment
  timers. Reattach, Poison, and Doom resolve at different times, so a segment
  count alone does not determine the next visible intent.
- Personal Hive is a per-damage-instance trigger, whereas Tainted is a
  per-Skill damage consequence. Read the card type and current power value
  before applying either calculation.
- The source pages may include beta content. When a page, the installed build,
  and a generated encounter disagree, record the disagreement and prefer the
  live intent for the current room.
