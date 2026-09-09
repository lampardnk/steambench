---
description: Act 2 normal encounters — published HP, moves and turn cycles for every normal the act can present (16). Facts only; the encounter decides what to do with them.
character: ironclad
act: 2
category: normal
ascension: a1
keys: [ironclad, act2, normal, bowlbug (egg), bowlbug (nectar), bowlbug (rock), bowlbug (silk), chomper, exoskeleton, hunter killer, louse progenitor, myte, ovicopter, parafright, slumbering beetle, spiny toad, the obscura, tough egg, tunneler]
sources: [slaythespire2.net]
---

# Act 2 — normal encounters

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

### Bowlbug (Egg) — 21–22 HP (ascension: 23–24)
Encountered as: Bowlbug (Rock), RANDOM×2; Bowlbug (Rock).

- Bite (Attack · Block) — 7 (A9+: 8) dmg, 7 block

- Turn order:
  - Bite → then repeats from Bite

### Bowlbug (Nectar) — 35–38 HP (ascension: 36–39)
Encountered as: Bowlbug (Rock), RANDOM×2; Bowlbug (Rock).

- Thrash (Attack) — 3 dmg
- Buff (Buff) — Strength 15 (A9+: 16) (self)
- Thrash (Attack) — 3 dmg

- Turn order:
  - Thrash → Buff → Thrash → then repeats from Thrash

### Bowlbug (Rock) — 45–48 HP (ascension: 46–49)
Encountered as: Bowlbug (Rock), RANDOM×2; Bowlbug (Rock), Bowlbug (Silk), Slumbering Beetle; Bowlbug (Rock).

- Headbutt (Attack) — 15 (A9+: 16) dmg
- Dizzy (Stun) — no damage published

- Turn order:
  - Headbutt → branch
  - When IsOffBalance: Dizzy → Headbutt → branch

### Bowlbug (Silk) — 40–43 HP (ascension: 41–44)
Encountered as: Bowlbug (Rock), RANDOM×2; Bowlbug (Rock), Bowlbug (Silk), Slumbering Beetle.

- Thrash (Attack) — 4×2 (A9+: 5×2) dmg
- Toxic Spit (Debuff) — Weak 1 (player)

- Turn order:
  - Toxic Spit → Thrash → then repeats from Toxic Spit

### Chomper — 60–64 HP (ascension: 63–67)
Encountered as: Chomper, Tunneler; Chomper×2.

- Clamp (Attack) — 8×2 (A9+: 9×2) dmg
- Screech (Status) — adds 3 Dazed to your deck

- Turn order:
  - Clamp → Screech → then repeats from Clamp

### Exoskeleton — 24–28 HP (ascension: 25–29)
Encountered as: Exoskeleton×4; Exoskeleton×3.

- Skitter (Attack) — 1×3 dmg
- Mandibles (Attack) — 8 (A9+: 9) dmg
- Enrage (Buff) — Strength 2 (self)

- Turn order:
  - When base.Creature.SlotName == "first": Skitter → random: SKITTER, MANDIBLES
  - When base.Creature.SlotName == "second": Mandibles → Enrage → random: SKITTER, MANDIBLES
  - When base.Creature.SlotName == "third": Enrage → random: SKITTER, MANDIBLES
  - When base.Creature.SlotName == "fourth": random: SKITTER, MANDIBLES

### Hunter Killer — 121 HP (ascension: 126)
Encountered as: Hunter Killer.

- Tenderizing Goop (Debuff) — Tender 1 (player)
- Bite (Attack) — 17 (A9+: 19) dmg
- Puncture (Attack) — 7×3 (A9+: 8×3) dmg

- Turn order:
  - Tenderizing Goop
  - When TRIGGERED: Bite
  - When TRIGGERED: Puncture → random: BITE, PUNCTURE

### Louse Progenitor — 134–136 HP (ascension: 138–141)
Encountered as: Louse Progenitor.

- Web Cannon (Attack · Debuff) — 9 (A9+: 10) dmg, Frail 2 (player)
- Pounce (Attack) — 14 (A9+: 16) dmg
- Curl and Grow (Buff · Block) — 14 block, Strength 5 (self)

- Turn order:
  - Web Cannon → Curl and Grow → Pounce → then repeats from Web Cannon

### Myte — 61–67 HP (ascension: 64–69)
Encountered as: Myte×2.

- Toxic Cornucopia (Status) — adds 2 Toxic to your deck
- Bite (Attack) — 13 (A9+: 15) dmg
- Suck (Attack · Buff) — 4 (A9+: 6) dmg, Strength 2 (A9+: 3) (self)

- Turn order:
  - When base.Creature.SlotName == "first": Toxic Cornucopia → Bite → Suck → then repeats from Toxic Cornucopia
  - When base.Creature.SlotName == "second": Suck → Toxic Cornucopia → Bite → then repeats from Suck

### Ovicopter — 124–130 HP (ascension: 126–132)
Encountered as: Ovicopter.

- Lay Eggs (Summon) — Minion 1 (self), Tough Egg 1 (self)
- Smash (Attack) — 16 (A9+: 17) dmg
- Tenderizer (Attack · Debuff) — 7 (A9+: 8) dmg, Vulnerable 2 (player)
- Nutritional Paste (Buff) — Strength 3 (A9+: 4) (self)

- Turn order:
  - Lay Eggs → Smash → Tenderizer → branch
  - When !CanLay: Nutritional Paste → Smash → Tenderizer → branch

### Parafright — 21 HP
Encountered as: The Obscura.

- Slam (Attack) — 16 (A9+: 17) dmg

- Turn order:
  - Slam → then repeats from Slam

### Slumbering Beetle — 86 HP (ascension: 89)
Encountered as: Bowlbug (Rock), Bowlbug (Silk), Slumbering Beetle.

- Snore (Stun) — no damage published
- Roll Out (Attack · Buff) — 16 (A9+: 18) dmg, Strength 2 (self)

- Turn order:
  - Snore → branch
  - When !base.Creature.HasPower<SlumberPower>(): Roll Out → then repeats from Roll Out

### Spiny Toad — 116–119 HP (ascension: 121–124)
Encountered as: Spiny Toad.

- Protruding Spikes (Buff) — Thorns 5 (self)
- Spike Explosion (Attack) — 23 (A9+: 25) dmg, Thorns -5 (self)
- Tongue Lash (Attack) — 17 (A9+: 19) dmg

- Turn order:
  - Protruding Spikes → Spike Explosion → Tongue Lash → then repeats from Protruding Spikes

### The Obscura — 123 HP (ascension: 129)
Encountered as: The Obscura.

- Illusion (Summon) — Parafright 1 (self)
- Piercing Gaze (Attack) — 10 (A9+: 11) dmg
- Sail (Buff) — no damage published
- Hardening Strike (Attack · Block) — 6 (A9+: 7) dmg, 6 block

- Turn order:
  - Illusion
  - When TRIGGERED: Hardening Strike → random: PIERCING_GAZE, SAIL, HARDENING_STRIKE

### Tough Egg — 14–18 HP (ascension: 15–19)
Encountered as: Ovicopter.

- Hatch (Summon) — no damage published
- Nibble (Attack) — 4 (A9+: 5) dmg

- Turn order:
  - Hatch → Nibble → then repeats from Nibble

### Tunneler — 87 HP (ascension: 92)
Encountered as: Chomper, Tunneler; Tunneler.

- Bite (Attack) — 13 (A9+: 15) dmg
- Burrow (Buff · Block) — 32 block, Burrowed 1 (self)
- Attack from Below (Attack) — 23 (A9+: 26) dmg
- Dizzy (Stun) — no damage published

- Turn order:
  - Bite → Burrow → Attack from Below → then repeats from Attack from Below
  - When TRIGGERED: Dizzy → Bite → Burrow → Attack from Below → then repeats from Attack from Below
