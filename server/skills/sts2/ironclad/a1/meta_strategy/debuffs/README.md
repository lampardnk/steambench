---
title: Debuffs
description: >-
  Debuff sources from Ironclad kit and common enemy debuffs. All counter strategies are inference unless source-cited.
character: Ironclad
act: any
tags: [debuffs, mechanics, combat]
topic: debuffs
sources:
  - slaythespire2.net beta v0.111.0
  - slaythespire.wiki.gg Keywords/Debuffs pages
---

# Debuffs — Ironclad Reference

**Note**: Debuff mechanics (duration, stacking, interaction) should be verified against the installed build. Card text for Ironclad's debuff cards is sourced from slaythespire2.net but enemy debuff patterns vary by encounter.

## Debuffs Ironclad Applies (Sourced)

Source: slaythespire2.net card database (beta v0.111.0)

| Debuff | Ironclad Cards/Relics | Notes from card text |
|---|---|---|
| **Vulnerable** | Bash (2), Uppercut (1, 2 upgraded), Thunderclap (1 to ALL), Tremble (3, Exhaust), Dominate (1, and gain Strength per Vulnerable already on it, Exhaust), Taunt (1), Molten Fist (doubles what is already there, Exhaust), **Break** (Ancient: 20 dmg + 5), Bag of Marbles relic (1 to ALL at combat start) | Duration: "Receive 50% more damage from Attacks for X turns", decrementing each turn. **Payoff cards**: Bully (+2 dmg per Vulnerable), Cruelty (Vulnerable enemies take +25%, +50% upgraded), Vicious (draw 1 whenever you apply Vulnerable), Dismantle (hits twice if the target is Vulnerable). |
| **Weak** | Uppercut (1, 2 upgraded), Red Mask relic (1 to ALL at combat start) | Duration: "Attacks deal 25% less damage for X turns." Uppercut is Ironclad's **only** card source, which is worth knowing before planning around Weak. Rounding is down, so Weak zeroes out attacks that hit for 1 — it shuts the Tracker Raider off entirely. |
| **Frail** | None from Ironclad cards | Reduces Block gain. Applied by some enemies. |

## Debuffs Enemies Apply — What to Watch For

Specific enemy debuff patterns belong in act1/act2/act3 encounter files. The list below notes debuff types present in the game (sourced from wiki.gg Debuffs page) and general considerations.

| Debuff | General note |
|---|---|
| **Vulnerable** | You take 50% more attack damage. Colossus card (Ironclad uncommon, 1 energy) reduces Vulnerable damage taken by 50% this turn (source: slaythespire2.net card data). |
| **Weak** | Your attacks deal 25% less damage. Strength offsets the reduction proportionally. |
| **Frail** | Gain 25% less Block from cards, including Impervious. Do not apply the reduction indiscriminately to every non-card source. |
| **Poison** | "At the **start** of its turn, loses X HP, then reduce Poison by 1" — start of turn, not end. Ironclad has no poison of its own. Tungsten Rod relic reduces all HP loss by 1. |
| **Burn / Dazed / Wound (Status cards)** | Reduce access to useful cards. Check valid targets for True Grit, Burning Pact or Second Wind; Havoc is not a guaranteed status-removal tool. Exhaust payoffs apply only when an actual exhaust occurs. |
| **Slimed** | Status card shuffled into your discard by the Overgrowth slimes. Check live card text for cost. |
| **Dexterity down** | Intensity and **permanent** — it does not wear off. Lagavulin Matriarch's Soul Siphon is the Act 1 source. It reduces Block gained *from cards*, per instance, so many-small-Block cards suffer far more than one large one. |
| **Shrink** | "Attacks deal 30% less damage" — applied to **you** by the Shrinker Beetle, and also removed early if the Beetle dies. |
| **Constrict** | Intensity, **conserved**: while the Slithering Strangler lives, take X damage at the end of your turn. It re-applies every other turn, so it compounds. |
| **Ringing / Smoggy / Tangled** | Action restrictions rather than damage: 1 card per turn (Ceremonial Beast), 1 Skill per turn (Living Fog, does not stack), attacks cost +1 energy for 2 turns (Vine Shambler). |

## Key Fact (Sourced)

Source: slaythespire2.net card database

**Bash** in beta v0.111.0: "Deal 8 damage. Apply 2 Vulnerable." (2 energy). This is the starting card's text.

## Source Attribution

- Card/relic text from slaythespire2.net (beta v0.111.0 game data).
- Debuff definitions from slaythespire.wiki.gg (Slay the Spire 2:Keywords, Slay the Spire 2:Debuffs).
- **All notes labeled `{strategic inference}` are unsourced gameplay reasoning, not verified facts.**