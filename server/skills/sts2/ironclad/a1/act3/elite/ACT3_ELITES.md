---
description: Act 3 elites — published HP, moves and turn cycles for every elite the act can present (5). Facts only; the encounter decides what to do with them.
character: ironclad
act: 3
category: elite
ascension: a1
keys: [ironclad, act3, elite, flail knight, magi knight, mecha knight, soul nexus, spectral knight]
sources: [slaythespire2.net]
---

# Act 3 — elites

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

### Flail Knight — 101 HP (ascension: 108)
Encountered as: Flail Knight, Magi Knight, Spectral Knight.

- War Chant (Buff) — Strength 3 (self)
- Flail (Attack) — 9×2 (A9+: 10×2) dmg
- Ram (Attack) — 15 (A9+: 17) dmg

- Turn order:
  - Ram → random: WAR_CHANT, FLAIL, RAM

### Magi Knight — 82 HP (ascension: 89)
Encountered as: Flail Knight, Magi Knight, Spectral Knight.

- Power Shield (Attack · Block) — 6 (A9+: 7) dmg, 5 block
- Dampen (Debuff) — no damage published
- Prep (Block) — 5 block
- Magic Bomb (Attack) — 35 (A9+: 40) dmg
- Ram (Attack) — 10 (A9+: 11) dmg

- Turn order:
  - Power Shield → Dampen → Ram → Prep → Magic Bomb → then repeats from Ram

### Mecha Knight — 300 HP (ascension: 320)
Encountered as: Mecha Knight.

- Charge (Attack) — 25 (A9+: 30) dmg
- Flamethrower (Status) — adds 4 Burn to your deck
- Windup (Buff · Block) — 15 block, Strength 5 (self)
- Heavy Cleave (Attack) — 35 (A9+: 40) dmg

- Turn order:
  - Charge → Flamethrower → Windup → Heavy Cleave → then repeats from Flamethrower

### Soul Nexus — 234 HP (ascension: 254)
Encountered as: Soul Nexus.

- Soul Burn (Attack) — 29 (A9+: 31) dmg
- Maelstrom (Attack) — 6×4 (A9+: 7×4) dmg
- Drain Life (Attack · Debuff) — 18 (A9+: 19) dmg, Weak 2 (player), Vulnerable 2 (player)

- Turn order:
  - Soul Burn
  - When TRIGGERED: Drain Life → random: SOUL_BURN, MAELSTROM, DRAIN_LIFE

### Spectral Knight — 93 HP (ascension: 97)
Encountered as: Flail Knight, Magi Knight, Spectral Knight.

- Hex (Debuff) — Hex 2 (self)
- Soul Slash (Attack) — 15 (A9+: 17) dmg
- Soul Flame (Attack) — 3×3 (A9+: 4×3) dmg

- Turn order:
  - Hex → Soul Slash → random: SOUL_SLASH, SOUL_FLAME
