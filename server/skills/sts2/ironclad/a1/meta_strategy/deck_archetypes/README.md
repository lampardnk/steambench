---
title: Deck Archetypes
description: >-
  Ironclad deck archetype definitions, card pools, play patterns, relic synergies, and draft priorities.
character: Ironclad
act: any
tags: [archetypes, deckbuilding, strategy]
topic: archetypes
---

# Deck Archetypes — Editable Guide


> **Editable** — Meta evolves with patches. Feel free to add new archetypes or update card pools.

## Archetype 1: Strength Scaling

**Core idea**: Stack Strength to make every Attack hit harder.

### Key Cards
- **Inflame** (+2 Strength, 1 energy) — efficiency benchmark
- **Demon Form** (+2 Strength/turn, 3 energy) — slow but fight-winning
- **Setup Strike** (7 damage and +3 Strength for the turn) — temporary, so it multiplies a multi-hit turn rather than the whole fight
- **Rupture** (+1 Strength per HP loss on turn) — enables self-damage synergy
- **Brand** (lose 1 HP, Exhaust 1, +1 Strength, 0 energy) — efficient
- **Fight Me!** (+3 Strength, gives enemy +1 Strength, 2 energy)
- **Dominate** (+1 Strength per Vulnerable on target, Exhaust, 1 energy) — burst scaling

### Supporting Cards
- **Setup Strike** (7 damage, gain 2 Strength this turn, 1 energy) — temporary attack scaling; check modified live text.
- **Pommel Strike** (9 dmg, draw 1) — cycle
- **Headbutt** (9 dmg, retrieve from discard) — setup
- **Whirlwind** (X-cost AoE) — scales extremely well with Strength
- **Sword Boomerang** (3 random hits) — triple Strength scaling
- **Twin Strike** (5 dmg x2) — double Strength scaling

### Key Relics
- **Ruined Helmet** (double first Strength gain — INFLAME BECOMES +4)
- **Red Skull** (+3 Strength <= 50% HP)
- **Vajra** (+1 Strength per combat)
- **Shuriken** (+1 Strength per 3 Attacks/turn)
- **Paper Phrog** (+75% Vulnerable damage)
- **Brimstone** (+2 Strength/turn, enemies +1 — race condition)

### Play Pattern
1. Play Inflame/Demon Form early
2. Apply Vulnerable (Bash/Uppercut/Thunderclap)
3. Hit with multi-hit or AoE (Whirlwind, Twin Strike, Sword Boomerang)
4. Re-up Strength as needed

{strategic inference} **Weaknesses**: Slow start (Demon Form is 3 energy, provides no immediate block). May struggle without AoE for multi-enemy fights. Strength reduction debuffs (if present in STS2) would threaten this build. Verify Strength-drain mechanics in installed build.

---

## Archetype 2: Exhaust Engine

**Core idea**: Exhaust cards for value — draw (Dark Embrace), block (Feel No Pain), damage (Charon's Ashes).

### Key Cards
- **Dark Embrace** (draw 1 per exhaust) — engine core
- **Feel No Pain** (+3 Block per exhaust) — survival core
- **Fiend Fire** (Exhaust hand, 7 dmg each) — burst
- **Second Wind** (Exhaust non-Attacks, 5 Block each) — AoE clear + block
- **Burning Pact** (Exhaust 1, draw 2) — cycle
- **True Grit** (7 Block, exhaust random) — defense + exhaust trigger

### Supporting Cards
- **Havoc** (play top card free, Exhaust it) — RNG but triggers all effects
- **Infernal Blade** (random Attack, free this turn, Exhaust) — disposable value
- **Forgotten Ritual** (+3 energy if exhausted this turn) — burst energy
- **Drum of Battle** (draw 2, +2 energy on exhaust)

### Key Relics
- **Charon's Ashes** (3 damage to ALL enemies per exhaust) — scales with exhaust volume, so it needs the enablers above to be worth a slot
- **Joss Paper** (draw 1 per 5 exhausts)
- **Burning Sticks** (copy the first Exhausted Skill)
- **Forgotten Soul** (1 dmg to random enemy per exhaust)
- **Darkstone Periapt** (6 max HP per Curse obtained — if curse-generating)

### Play Pattern
1. Play Dark Embrace + Feel No Pain early
2. Cycle Second Wind, Burning Pact, Havoc to trigger exhausts
3. Draw into payoffs naturally
4. Fiend Fire or Pact's End to close fights

{strategic inference} **Weaknesses**: Vulnerable to status cards stuffing hand before key Powers are drawn. Slow until the engine is assembled. Requires drawing specific key cards (Dark Embrace, Feel No Pain) to function.

---

## Archetype 3: Block Shell (Body Slam)

**Core idea**: Build massive Block, then convert to damage via Body Slam.

### Key Cards
- **Body Slam** (deal damage equal to Block) — finisher
- **Shrug It Off** (8 Block, draw 1) — cycle + defense
- **Impervious** (30 Block, Exhaust) — burst block
- **Blood Wall** (lose 2 HP, gain 16 Block)
- **Flame Barrier** (12 Block + Thorns)
- **Second Wind** (exhaust non-Attacks, Block each)
- **Feel No Pain** (Block per exhaust)
- **Unmovable** (double first Block card each turn)
- **Stone Armor** (4 Plating per turn)

### Key Relics
- **Vambrace** (double first Block from card each combat — overlaps with Unmovable)
- **Cloak Clasp** (1 Block per card in hand at end of turn)
- **Sturdy Clamp** (up to 10 Block persists)
- **Orichalcum** (6 Block if you end turn without Block)
- **Kunai** (+1 Dexterity per 3 Attacks/turn — makes Block cards more efficient)

### Play Pattern
1. Build Block early, using efficient block cards
2. Scale Block with Dexterity/Unmovable/Cloak Clasp
3. One-shot with Body Slam
4. Note: Body Slam costs 1 and deals damage equal to total Block (current, not persistent)

{strategic inference} **Weaknesses**: Body Slam is the only damage source — need to draw it. Uncertain interaction with Frail (verify exact Frail mechanics in installed build). Weak vs. enemies that bypass Block (direct HP loss mechanics). Needs card draw to find Body Slam consistently.

---

## Archetype 4: Self-Damage / HP Economy

**Core idea**: Spend HP aggressively for outsized benefits, recover with Burning Blood and healing.

### Key Cards
- **Bloodletting** (lose 3 HP, +2 energy, 0 cost)
- **Offering** (lose 6 HP, +2 energy, draw 3, Exhaust)
- **Hemokinesis** (lose 2 HP, deal 15 damage)
- **Crimson Mantle** (lose 1 HP/turn, gain 8 Block/turn)
- **Inferno** (lose 1 HP/turn, 6 AoE per HP loss)
- **Rupture** (+1 Strength per HP loss)
- **Breakthrough** (lose 1 HP, 9 AoE damage)
- **Brand** (lose 1 HP, Exhaust 1, +1 Strength)

### Key Relics
- **Self-Forming Clay** (3 Block next turn per HP loss) — makes self-damage safer
- **Demon Tongue** (heal equal to first HP loss each turn — makes Bloodletting/Offering free)
- **Burning Blood** (6 heal per combat — baseline recovery)
- **Red Skull** (+3 Strength while <= 50% HP — encourages low-HP plays)
- **Tungsten Rod** (lose 1 less HP — makes self-damage less punishing)

### Play Pattern
1. Spend HP aggressively Act 1 when Burning Blood will recover
2. Curve into Rupture + Inferno for auto-damage engine
3. Use energy and card draw from HP costs to find finishers
4. Stay low for Red Skull bonus — recover just enough

{strategic inference} **Weaknesses**: High-risk — low HP means potential one-shot. Vulnerable to enemies that deal direct HP loss. Requires careful HP management for elite fights.

---

## Archetype 5: Hybrid — Strength + Exhaust

**Most common winning Ironclad deck**. Combine Strength scaling with exhaust synergy. Exhaust thins the deck to draw scaling powers faster. Strength makes whatever attacks survive hit hard.

Natural overlaps:
- **Burning Pact** exhausts weak cards for draw, finding your Strength.
- **Fiend Fire** exhausts the hand for massive burst, scales with Strength.
- **Feel No Pain** keeps you alive while setting up.
- **Dark Embrace** finds your scaling faster.
- **Offering** accelerates both plans.

## Source Attribution

- Card data from slaythespire2.net (beta v0.111.0 game data, extracted 2026-06-18).
- Relic data from slaythespire2.net (beta v0.111.0).
- **Archetype definitions, play patterns, and synergy analysis are strategic inference. Edit as patches change the meta.**