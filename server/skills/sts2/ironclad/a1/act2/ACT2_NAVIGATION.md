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
This file covers the encounter pool and published boss data. Stats are base; A8
raises HP, A9 raises damage. The live intent is authoritative when it differs.
Boss encounter source pages: [Kaiser Crab](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Kaiser_Crab), [Knowledge Demon](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Knowledge_Demon), and [The Insatiable](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Insatiable).

## Bosses (3, one per run)

### Kaiser Crab — Crusher (209 HP, A8+: 219) + Rocket (199 HP, A8+: 209)
**Crusher rotation (loops):**
- T1: Thrash — 12 dmg (A9+: 14)
- T2: Enlarging Strike — 4 dmg
- T3: Bug Sting — 6×2 (A9+: 7×2) + Weak +2 + Frail +2
- T4: Adapt — Strength +2 (A9+: +3)
- T5: Guarded Strike — 12 dmg (A9+: 14) + 18 block
- Loops to Thrash.
Bug Sting applies Weak +2 and Frail +2. Guarded Strike adds 18 block after its 12-damage attack. The cycle and current block/facing state determine the damage calculation for each turn.

**Rocket rotation (loops):**
- T1: Targeting Reticle — 3 dmg (A9+: 4)
- T2: Precision Beam — 18 dmg (A9+: 20)
- T3: Charge Up — Strength +2 (A9+: +3)
- T4: Laser — 31 dmg (A9+: 35)
- T5: Recharge (stunned, free turn)
- Loops to Targeting Reticle.
Recharge is a stunned, no-damage turn. Charge Up's Strength gain precedes Laser in the published cycle; calculation question: what is the Laser damage at the current Strength and ascension value?

### Knowledge Demon — 379 HP (A8+: 399)
**Opening:** Curse of Knowledge (debuff) → Slap (17, A9+: 18) → Knowledge
Overwhelming (8×3=24, A9+: 9×3=27) → Ponder (11 dmg, A9+: 13, Heal 30,
Strength +2, A9+: +3). When Curse of Knowledge ≥ 3, switches to: Slap →
Knowledge Overwhelming → Ponder (loop).
Ponder deals 11 damage (A9+: 13), heals 30 HP, and grants Strength +2 (A9+: +3). Curse of Knowledge presents a temporary choice: Disintegration (6/7/8 end-of-turn damage) or Mind Rot (draw 1 fewer), then Disintegration or Sloth (maximum 3 cards per turn), then Disintegration or Waste Away (1 less Energy per turn). Each set is offered once; the cycle then repeats without Curse of Knowledge.
Calculation question: given the current Curse of Knowledge choice, the boss's Strength, and the next Slap, Knowledge Overwhelming, or Ponder intent, what damage, draw, card-play, Energy, and healing totals result?

### The Insatiable — 321 HP (A8+: 341)
**Rotation:** Liquify Ground (buff+status, no damage) → Thrash (8×2=16,
A9+: 9×2=18) → Lunging Bite (28, A9+: 31) → Salivate (Strength +2,
A9+: +3) → Thrash (8×2) → loops to Lunging Bite.
Lunging Bite deals 28 (A9+: 31), and Salivate grants Strength +2 (A9+: +3). The Strength value persists into later Thrash and Lunging Bite attacks; Weak changes the damage calculation for affected attacks.
Calculation question: using the current Strength, Weak, and cycle position, what are the per-hit and total values for the next Thrash and Lunging Bite?

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

## Ironclad-relevant calculations

The following references identify published values that can affect arithmetic;
the current encounter state determines the result.
- Calculation question: given the live intent, current powers, and multi-hit or self-strengthening cycle, what values apply to this turn?
- Knowledge Demon attacks 8×3 and The Insatiable 8×2; Weak is applied to the resulting attack damage according to the current status value.
- Kaiser Crab is Crusher (209 HP, A8: 219) alongside Rocket (199 HP, A8: 209). Rocket's Charge Up precedes its Laser, which hits for 31 (A9: 35).
- Knowledge Demon's Ponder heals it 30 HP and grants Strength +2 (A9: +3).
- The Insatiable's Salivate grants Strength +2 (A9: +3), which applies to later attacks.
