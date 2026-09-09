---
description: Act 3 normal encounters — published HP, moves and turn cycles for every normal the act can present (11). Facts only; the encounter decides what to do with them.
character: ironclad
act: 3
category: normal
ascension: a1
keys: [ironclad, act3, normal, axebot, cubex construct, fabricator, frog knight, globe head, owl magistrate, punch construct, scroll of biting, slimed berserker, the forgotten, the lost]
sources: [slaythespire2.net]
---

# Act 3 — normal encounters

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

### Axebot — 70–78 HP (ascension: 76–86)
Encountered as: Axebot.

- Boot Up (Buff · Block) — 10 block, Strength (amount not published) (self)
- The One-Two (Attack) — 9×2 (A9+: 10×2) dmg
- Hammer Uppercut (Attack · Debuff) — 12 (A9+: 14) dmg, Frail 2 (player), Weak 2 (player)

- Turn order:
  - Boot Up → Hammer Uppercut → The One-Two → then repeats from Hammer Uppercut

### Cubex Construct — 65 HP (ascension: 70)
Encountered as: Cubex Construct×2, Punch Construct.

- Charge Up (Buff) — Strength 2 (self)
- Repeater Blast (Attack · Buff) — 7 (A9+: 8) dmg, Strength 2 (self)
- Repeater Blast (Attack · Buff) — 7 (A9+: 8) dmg, Strength 2 (self)
- Expel (Attack) — 5×2 (A9+: 6×2) dmg

- Turn order:
  - Charge Up → Repeater Blast → Repeater Blast → Expel → then repeats from Repeater Blast

### Fabricator — 150 HP (ascension: 155)
Encountered as: Fabricator.

- Fabricate (Summon) — no damage published
- Fabricating Strike (Attack · Summon) — 18 (A9+: 21) dmg
- Disintegrate (Attack) — 11 (A9+: 13) dmg

- Turn order:
  - When CanFabricate: random: FABRICATE, FABRICATING_STRIKE
  - When !CanFabricate: Disintegrate → branch

### Frog Knight — 191 HP (ascension: 199)
Encountered as: Frog Knight.

- For the Queen (Buff) — Strength 5 (self)
- Strike Down Evil (Attack) — 21 (A9+: 23) dmg
- Tongue Lash (Attack · Debuff) — 13 (A9+: 14) dmg, Frail 2 (player)
- Beetle Charge (Attack) — 35 (A9+: 40) dmg

- Turn order:
  - Tongue Lash → Strike Down Evil → For the Queen → branch
  - When !HasBeetleCharged && base.Creature.CurrentHp < base.Creature.MaxHp / 2: Beetle Charge → Tongue Lash → Strike Down Evil → For the Queen → branch

### Globe Head — 148 HP (ascension: 158)
Encountered as: Globe Head.

- Channel Lightning (Attack) — 6×3 (A9+: 7×3) dmg
- Shocking Slap (Attack · Debuff) — 13 (A9+: 14) dmg, Frail 2 (player)
- Galvanic Burst (Attack · Buff) — 16 (A9+: 17) dmg, Strength 2 (self)

- Turn order:
  - Shocking Slap → Channel Lightning → Galvanic Burst → then repeats from Shocking Slap

### Owl Magistrate — 231 HP (ascension: 247)
Encountered as: Owl Magistrate.

- Magistrate Scrutiny (Attack) — 16 (A9+: 17) dmg
- Peck Assault (Attack) — 4×6 dmg
- Judicial Flight (Buff) — Soar 1 (self)
- Verdict (Attack · Debuff) — 33 (A9+: 36) dmg, Vulnerable 4 (player)

- Turn order:
  - Magistrate Scrutiny → Peck Assault → Judicial Flight → Verdict → then repeats from Magistrate Scrutiny

### Punch Construct — 55 HP (ascension: 60)
Encountered as: Cubex Construct×2, Punch Construct.

- READY (Block) — 10 block
- Strong Punch (Attack) — 14 (A9+: 16) dmg
- Fast Punch (Attack · Debuff) — 5×2 (A9+: 6×2) dmg, Frail 1 (player)

- Turn order:
  - READY → Fast Punch → Strong Punch → then repeats from READY

### Scroll of Biting — 30–37 HP (ascension: 33–39)
Encountered as: Scroll of Biting×4; Scroll of Biting×3.

- Chomp (Attack) — 14 (A9+: 16) dmg
- Chew (Attack) — 5×2 (A9+: 6×2) dmg
- More Teeth (Buff) — Strength 2 (self)

- Turn order:
  - Chomp → More Teeth → Chew → random: CHOMP, CHEW

### Slimed Berserker — 261 HP (ascension: 281)
Encountered as: Slimed Berserker.

- Vomit Ichor (Status) — adds 10 Slimed to your deck
- Leeching Hug (Buff · Debuff) — Strength 3 (self), Weak 3 (player)
- Smother (Attack) — 30 (A9+: 33) dmg
- Furious Pummeling (Attack) — 4×4 (A9+: 5×4) dmg

- Turn order:
  - Vomit Ichor → Furious Pummeling → Leeching Hug → Smother → then repeats from Vomit Ichor

### The Forgotten — 106 HP (ascension: 111)
Encountered as: The Forgotten, The Lost.

- Miasma (Buff · Debuff · Block) — 8 block, Dexterity 2 (player), Dexterity 2 (self)
- Dread (Attack) — no damage published

- Turn order:
  - Miasma → Dread → then repeats from Miasma

### The Lost — 93 HP (ascension: 99)
Encountered as: The Forgotten, The Lost.

- Debilitating Smog (Buff · Debuff) — Strength 2 (self), Strength 2 (player)
- Eye Lasers (Attack) — 4×2 (A9+: 5×2) dmg

- Turn order:
  - Debilitating Smog → Eye Lasers → then repeats from Debilitating Smog
