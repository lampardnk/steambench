---
description: Act 3 bosses — published HP, moves and turn cycles for every boss the act can present (4). Facts only; the encounter decides what to do with them.
character: ironclad
act: 3
category: boss
ascension: a1
keys: [ironclad, act3, boss, aeonglass, queen, test subject, torch head amalgam]
sources: [slaythespire2.net]
---

# Act 3 — bosses

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

### Aeonglass — 512 HP (ascension: 535)
Encountered as: Aeonglass.

- Ebb (Attack · Block) — 26 (A9+: 32) dmg, 33 block
- Eye Lasers (Attack) — 11×2 (A9+: 12×2) dmg
- Increasing Intensity (Buff · Status) — Strength (amount not published) (self), adds 1 (A9+: 2) Wither to your deck

- Turn order:
  - Ebb → Eye Lasers → Increasing Intensity → then repeats from Ebb

### Queen — 400 HP (ascension: 419)
Encountered as: Queen, Torch Head Amalgam.

- Puppet Strings (Debuff) — Chains of Binding 3 (player). Chains of Binding: the
  first X cards drawn each turn are Afflicted with Bound. Bound: only 1 Bound
  card can be played each turn, and cards are un-Bound at end of turn.
  - After a Bound card is played, no other Bound card can be played that turn,
    including via Sly or a Duplicator. Copies made by Music Box or Dual Wield are
    also Bound. Transforming a Bound card in battle removes Bound from it. Bound
    cards un-Bind at end of turn even when Retained. A Bound card played once and
    returned to hand still cannot be played again that turn. [wiki.gg]
- You Are Mine (Debuff) — Weak 99 (player), Frail 99 (player), Vulnerable 99 (player)
- Burn Bright for Me (Buff · Block) — 20 block, Strength (amount not published) (self)
- Off with Your Head (Attack) — 3×5 (A9+: 4×5) dmg
- Execution (Attack) — 15 (A9+: 18) dmg
- Enrage (Buff) — Strength 2 (self)

- Turn order:
  - Puppet Strings → You Are Mine → branch
  - When !HasAmalgamDied: Burn Bright for Me → branch
  - When HasAmalgamDied: Off with Your Head → Execution → Enrage → then repeats from Off with Your Head

### Test Subject — HP not published
Encountered as: Test Subject.

- Respawn (Buff · Heal) — Nemesis 1 (self), Painful Stabs 1 (self)
- Bite (Attack) — 20 (A9+: 22) dmg
- Skull Bash (Attack · Debuff) — 14 (A9+: 16) dmg, Vulnerable 1 (player)
- Multi-Claw (Attack) — 10 (A9+: 11) dmg
- Lacerate (Attack) — 10×3 (A9+: 11×3) dmg
- Big Pounce (Attack) — 45 dmg
- Burning Growl (Buff · Status) — Strength 2 (A9+: 3) (self), adds 3 (A9+: 5) Burn to your deck

- Turn order:
  - Bite → Skull Bash → then repeats from Bite
  - When Respawns < 2: Multi-Claw → then repeats from Multi-Claw
  - When Respawns >= 2: Lacerate → Big Pounce → Burning Growl → then repeats from Lacerate
  - When TRIGGERED: Respawn → branch

### Torch Head Amalgam — 199 HP (ascension: 211)
Encountered as: Queen, Torch Head Amalgam.

- Tackle (Attack) — 18 (A9+: 19) dmg
- Tackle (Attack) — 18 (A9+: 19) dmg
- Beam (Attack) — 8×3 dmg
- Tackle (Attack) — 14 (A9+: 15) dmg
- Tackle (Attack) — 14 (A9+: 15) dmg

- Turn order:
  - Tackle → Tackle → Beam → Tackle → Tackle → then repeats from Beam
