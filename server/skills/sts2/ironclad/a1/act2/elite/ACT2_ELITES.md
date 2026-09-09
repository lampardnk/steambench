---
description: Act 2 elites — published HP, moves and turn cycles for every elite the act can present (5). Facts only; the encounter decides what to do with them.
character: ironclad
act: 2
category: elite
ascension: a1
keys: [ironclad, act2, elite, decimillipede, decimillipede, decimillipede, entomancer, infested prism]
sources: [slaythespire2.net]
---

# Act 2 — elites

All stats are generated from the slaythespire2.net beta dataset (the same
source the Act 1 notes were built from), so they can lag the installed build:
**treat the live intent in `battle.enemies[].intents` as authoritative whenever
it disagrees.** Where the dataset publishes no value it says so rather than
guessing.

## How to read entries

- **Attack** intents damage you; **Buff** targets the enemy itself; **Debuff**
  and **Status** land on you.
- HP is the spawn range, with the ascension range after it when it differs.
- "Encountered as" lists the groups this enemy is published in, which is not a
  promise about what a given floor rolls. Read the live roster.
- Turn order is the published cycle. Several enemies deviate or branch on
  conditions, so it tells you what to EXPECT, never what will happen.
- No tactics are prescribed here. HP, damage and cycle are facts; what to do
  with them is the encounter's own decision.

## Roster

### Decimillipede — 40–46 HP (ascension: 46–52)
Encountered as: Decimillipede×3.

- Writhe (Attack) — 5×2 (A9+: 6×2) dmg
- Bulk (Attack · Buff) — 6 (A9+: 7) dmg, Strength 2 (self)
- Constrict (Attack · Debuff) — 8 (A9+: 9) dmg, Weak 1 (player)
- Dead (Unknown) — no damage published
- Reattach (Heal) — no damage published

- Turn order:
  - Writhe → Constrict → Bulk → then repeats from Writhe
  - When TRIGGERED: Dead → Reattach → random: WRITHE, BULK, CONSTRICT

### Decimillipede — 40–46 HP (ascension: 46–52)
Encountered as: Decimillipede×3.

- Writhe (Attack) — 5×2 (A9+: 6×2) dmg
- Bulk (Attack · Buff) — 6 (A9+: 7) dmg, Strength 2 (self)
- Constrict (Attack · Debuff) — 8 (A9+: 9) dmg, Weak 1 (player)
- Dead (Unknown) — no damage published
- Reattach (Heal) — no damage published

- Turn order:
  - Writhe → Constrict → Bulk → then repeats from Writhe
  - When TRIGGERED: Dead → Reattach → random: WRITHE, BULK, CONSTRICT

### Decimillipede — 40–46 HP (ascension: 46–52)
Encountered as: Decimillipede×3.

- Writhe (Attack) — 5×2 (A9+: 6×2) dmg
- Bulk (Attack · Buff) — 6 (A9+: 7) dmg, Strength 2 (self)
- Constrict (Attack · Debuff) — 8 (A9+: 9) dmg, Weak 1 (player)
- Dead (Unknown) — no damage published
- Reattach (Heal) — no damage published

- Turn order:
  - Writhe → Constrict → Bulk → then repeats from Writhe
  - When TRIGGERED: Dead → Reattach → random: WRITHE, BULK, CONSTRICT

### Entomancer — 145 HP (ascension: 155)
Encountered as: Entomancer.

- Pheromone Spit (Buff) — Personal Hive 1 (self), Strength 2 (self), Strength 1 (self)
- Beeeees! (Attack) — 3×7 dmg
- Spear! (Attack) — 18 (A9+: 20) dmg

- Turn order:
  - Beeeees! → Spear! → Pheromone Spit → then repeats from Beeeees!

### Infested Prism — 161 HP (ascension: 171)
Encountered as: Infested Prism.

- Jab (Attack) — 15 (A9+: 17) dmg
- Radiate (Attack · Block) — 11 (A9+: 13) dmg, 11 block
- Whirlwind (Attack) — 5×3 (A9+: 6×3) dmg
- Pulsate (Attack · Buff · Block) — 8 (A9+: 10) dmg, 20 block, Vital Spark 2 (A9+: 3) (self)

- Turn order:
  - Jab → Radiate → Whirlwind → Pulsate → then repeats from Jab
