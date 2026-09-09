---
description: Act 2 — Hive encounter pool, bosses, elites, events and Ironclad navigation scope. Verified mob list and boss intents.
character: ironclad
act: 2
category: navigation
ascension: a1
keys: [ironclad, act2, hive, kaiser crab, crusher, rocket, knowledge demon, the insatiable, decimillipede, entomancer, infested prism, bowlbug, chomper, exoskeleton, hunter killer, louse progenitor, myte, ovicopter, the obscura, spiny toad]
sources: [slaythespire2.net, slaythespire.wiki.gg]
---

# Act 2 — Hive (navigation scope)

Verified against slaythespire2.net beta (v0.111.0, display 2026-06-18).
This file covers the encounter pool and verified boss data. Detailed per-mob
strategy files will be added as the run encounters them. Stats are base; A8
raises HP, A9 raises damage.

## Bosses (3, one per run)

### Kaiser Crab — Crusher (209 HP, A8+: 219) + Rocket (199 HP, A8+: 209)
**Crusher rotation (loops):**
- T1: Thrash — 12 dmg (A9+: 14)
- T2: Enlarging Strike — 4 dmg
- T3: Bug Sting — 6×2 (A9+: 7×2) + Weak +2 + Frail +2
- T4: Adapt — Strength +2 (A9+: +3)
- T5: Guarded Strike — 12 dmg (A9+: 14) + 18 block
- Loops to Thrash.
Bug Sting applies Weak (you deal 25% less) AND Frail (you gain 25% less
block) — double debuff. Guarded Strike has 18 block; overkill it or accept
the block.

**Rocket rotation (loops):**
- T1: Targeting Reticle — 3 dmg (A9+: 4)
- T2: Precision Beam — 18 dmg (A9+: 20)
- T3: Charge Up — Strength +2 (A9+: +3)
- T4: Laser — 31 dmg (A9+: 35)
- T5: Recharge (stunned, free turn)
- Loops to Targeting Reticle.
Laser (31/35) is the kill shot — block for it or kill before T4. Recharge
(T5) is a free damage window. Strength from Charge Up scales the next cycle.

### Knowledge Demon — 379 HP (A8+: 399)
**Opening:** Curse of Knowledge (debuff) → Slap (17, A9+: 18) → Knowledge
Overwhelming (8×3=24, A9+: 9×3=27) → Ponder (11 dmg, A9+: 13, Heal 30,
Strength +2, A9+: +3). When Curse of Knowledge ≥ 3, switches to: Slap →
Knowledge Overwhelming → Ponder (loop).
**Tactics**: Highest HP boss in Act 2. Ponder heals 30 AND gains Strength —
the fight gets worse if you can't out-damage the heal. Knowledge Overwhelming
(8×3) is multi-hit — Weak helps. Curse of Knowledge limits card plays (likely
similar to Ringing/Smoggy). Block the Slap (17-18) and Knowledge Overwhelming
(24-27). Kill before Strength stacks or bring Shackling Potion (-7 Strength
this turn).

### The Insatiable — 321 HP (A8+: 341)
**Rotation:** Liquify Ground (buff+status, no damage) → Thrash (8×2=16,
A9+: 9×2=18) → Lunging Bite (28, A9+: 31) → Salivate (Strength +2,
A9+: +3) → Thrash (8×2) → loops to Lunging Bite.
**Tactics**: Lunging Bite (28/31) is the big hit. Salivate scales Strength —
every cycle, Thrash and Lunging Bite grow. Weak on Thrash (multi-hit) cuts
total. Block hard for Lunging Bite. This is a DPS race against self-buffing
Strength.

## Elites (3)
- Decimillipede — 3 segments, 40-46 HP each (A8+: varies). Multi-segment boss.
- Entomancer — 145 HP. Summons Osty (1 HP).
- Infested Prism — 161 HP.

## Normal encounters (10)
- Bowlbug Swarm (3): Bowlbug (Rock) 45-48 HP + 2 random
- Slumber Party: Bowlbug (Rock) 45-48 + Bowlbug (Silk) 40-43 + Slumbering
  Beetle 86
- An Automaton Pair: 2× Chomper (60-64)
- Many Exoskeletons: 4× Exoskeleton (24-28)
- Hunter Killer: 121 HP
- Louse Progenitor: 134-136 HP
- Mass of Mytes: 2× Myte (61-67)
- Ovicopter: 124-130 HP
- The Obscura: 123 HP
- Spiny Toad: 116-119 HP

Weak: Bowlbugs (1), Exoskeletons (3), Thieving Hopper (1, 79 HP),
Tunneler (1, 87 HP).

## Events (10, Act 2 — Hive)
Amalgamator (2), Bugslayer (2), Colorful Philosophers (6), Colossal Flower (2),
Field of Man-Sized Holes (2), Infested Automaton (2), The Lost Wisp (3),
Spirit Grafter (2), The Lantern Key (2), Zen Weaver (4).

## Any-act events that can appear in Act 2
See the Act 1 unknown file for the full 18 any-act event list.

## Ironclad-relevant mechanics

Facts a plan may turn on. What to do with them is the encounter's call.

- Act 2 damage per hit is higher than Act 1's across the pool.
- Knowledge Demon attacks 8x3 and The Insatiable 8x2, so both lose a large
  share of their output to Weak, which scales with the number of hits.
- Kaiser Crab is Crusher (209 HP, ascension 219) alongside Rocket (199 HP,
  ascension 209). Rocket's Charge Up precedes its Laser, which hits for 31
  (ascension 35).
- Knowledge Demon's Ponder heals it 30 HP.
- The Insatiable's Strength scales both Thrash and Lunging Bite.
