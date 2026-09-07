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
| **Vulnerable** | Bash (2, 2 energy), Uppercut (1, 2 energy), Thunderclap (1 AoE, 1 energy), Tremble (3, Exhaust, 1 energy), Dominate (1, +Str per existing Vulnerable, Exhaust, 1 energy), Taunt (1, 1 energy), Molten Fist (doubles existing, Exhaust, 1 energy), Bag of Marbles relic (1 AoE at combat start) | +50% damage from attacks. Verify exact Vulnerable multiplier in installed build. |
| **Weak** | Uppercut (1, 2 energy), Red Mask relic (1 AoE at combat start) | -25% attack damage dealt. Verify exact reduction in installed build. |
| **Frail** | None from Ironclad cards | Reduces Block gain. Applied by some enemies. |

## Debuffs Enemies Apply — What to Watch For

Specific enemy debuff patterns belong in act1/act2/act3 encounter files. The list below notes debuff types present in the game (sourced from wiki.gg Debuffs page) and general considerations.

| Debuff | General note |
|---|---|
| **Vulnerable** | You take 50% more attack damage. Colossus card (Ironclad uncommon, 1 energy) reduces Vulnerable damage taken by 50% this turn (source: slaythespire2.net card data). |
| **Weak** | Your attacks deal 25% less damage. Strength offsets the reduction proportionally. |
| **Frail** | Gain 25% less Block from cards, including Impervious. Do not apply the reduction indiscriminately to every non-card source. |
| **Poison** | Lose HP at end of turn. Ironclad has no built-in poison removal. Tungsten Rod relic (Rare) reduces all HP loss by 1. |
| **Burn / Dazed / Wound (Status cards)** | Reduce access to useful cards. Check valid targets for True Grit, Burning Pact or Second Wind; Havoc is not a guaranteed status-removal tool. Exhaust payoffs apply only when an actual exhaust occurs. |
| **Slimed** | Status card. Exact cost/effect: check installed build card text. |

## Key Fact (Sourced)

Source: slaythespire2.net card database

**Bash** in beta v0.111.0: "Deal 8 damage. Apply 2 Vulnerable." (2 energy). This is the starting card's text.

## Source Attribution

- Card/relic text from slaythespire2.net (beta v0.111.0 game data).
- Debuff definitions from slaythespire.wiki.gg (Slay the Spire 2:Keywords, Slay the Spire 2:Debuffs).
- **All notes labeled `{strategic inference}` are unsourced gameplay reasoning, not verified facts.**