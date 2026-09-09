---
description: Act 2 bosses — published HP, moves and turn cycles for every boss the act can present (4). Facts only; the encounter decides what to do with them.
character: ironclad
act: 2
category: boss
ascension: a1
keys: [ironclad, act2, boss, crusher, knowledge demon, rocket, the insatiable]
sources: [slaythespire2.net]
---

# Act 2 — bosses

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

### Crusher — 209 HP (ascension: 219)
Encountered as: Crusher, Rocket.

- Thrash (Attack) — 12 (A9+: 14) dmg
- Enlarging Strike (Attack) — 4 dmg
- Bug Sting (Attack · Debuff) — 6×2 (A9+: 7×2) dmg, Weak 2 (player), Frail 2 (player)
- Adapt (Buff) — Strength 2 (A9+: 3) (self)
- Guarded Strike (Attack · Block) — 12 (A9+: 14) dmg, 18 block

- Turn order:
  - Thrash → Enlarging Strike → Bug Sting → Adapt → Guarded Strike → then repeats from Thrash

### Knowledge Demon — 379 HP (ascension: 399)
Encountered as: Knowledge Demon.

- Curse of Knowledge (Debuff) — no damage published
- Slap (Attack) — 17 (A9+: 18) dmg
- Knowledge Overwhelming (Attack) — 8×3 (A9+: 9×3) dmg
- Ponder (Attack · Buff · Heal) — 11 (A9+: 13) dmg, Strength 2 (A9+: 3) (self)

- Turn order:
  - Curse of Knowledge → Slap → Knowledge Overwhelming → Ponder → branch
  - When _curseOfKnowledgeCounter >= 3: Slap → Knowledge Overwhelming → Ponder → branch

### Rocket — 199 HP (ascension: 209)
Encountered as: Crusher, Rocket.

- Targeting Reticle (Attack) — 3 (A9+: 4) dmg
- Precision Beam (Attack) — 18 (A9+: 20) dmg
- Charge Up (Buff) — Strength 2 (A9+: 3) (self)
- Laser (Attack) — 31 (A9+: 35) dmg
- Recharge (Stun) — no damage published

- Turn order:
  - Targeting Reticle → Precision Beam → Charge Up → Laser → Recharge → then repeats from Targeting Reticle

### The Insatiable — 321 HP (ascension: 341)
Encountered as: The Insatiable.

- Liquify Ground (Buff · Status) — no damage published
- Thrash (Attack) — 8×2 (A9+: 9×2) dmg
- Thrash (Attack) — 8×2 (A9+: 9×2) dmg
- Lunging Bite (Attack) — 28 (A9+: 31) dmg
- Salivate (Buff) — Strength 2 (A9+: 3) (self)

- Turn order:
  - Liquify Ground → Thrash → Lunging Bite → Salivate → Thrash → then repeats from Thrash
