---
title: Buffs
description: >-
  Ironclad buff sources from observed card/relic data. Strategic interactions are inference unless source-cited.
character: Ironclad
act: any
tags: [buffs, mechanics, combat]
topic: buffs
sources:
  - slaythespire2.net beta v0.111.0
  - slaythespire.wiki.gg Keywords/Mechanics pages
---

# Buffs — Ironclad Reference

**Note**: Buff mechanics (stacking rules, duration, interaction) should be verified against the installed build. The guide below lists sources of known buffs for Ironclad and flags all strategic evaluations as inference.

## Buffs from Ironclad Cards & Relics (Sourced)

Source: slaythespire2.net card/relic database (beta v0.111.0, extracted 2026-06-18)

| Buff | Known Sources (sourced) | Effects from card text |
|---|---|---|
| **Strength** | Inflame (+2), Spot Weakness, Demon Form (+2/turn), Rupture (+1 per HP loss), Brand (+1), Fight Me! (+3, enemy +1), Ruined Helmet (double first gain), Vajra (+1 start), Shuriken (+1 per 3 Attacks/turn), Girya (+1 per rest), Brimstone (+2/turn, enemy +1), Red Skull (+3 while <= 50% HP) | +damage per hit. Source: slaythespire2.net card pages. |
| **Vigor** | Akabeko relic (+8 at combat start) | Extra damage on the next Attack. Setup Strike instead grants 2 Strength this turn; do not confuse these effects. |
| **Block** | Shrug It Off (8), Impervious (30, Exhaust), Blood Wall (lose 2 HP, 16), Flame Barrier (12 + Thorns), Second Wind (5 per non-Attack exhausted), Feel No Pain (3 per exhaust), Unmovable (double first), Colossus (5), Iron Wave (5+5dmg) | Block values per card text from slaythespire2.net. |
| **Plating** | Stone Armor, Gorget | Read the live power description for timing and amount. Do not model it as per-hit damage reduction. |
| **Thorns** | Bronze Scales relic (3), Flame Barrier (4, one turn) | Retaliate damage on hit. Source: slaythespire2.net relic/card data. |
| **Intangible** | Apparitions (event reward via Distinguished Cape relic) | Reduce all damage to 1. Source: slaythespire2.net event/relic pages. |

## Enemy Buffs — Source-Bounded Notes

The wiki.gg keywords page documents buffs that exist in the game engine. Which specific enemies apply each is determined by the monster data files — consult the installed build or encounter guide files in act1/act2/act3/ for exact enemy-specific buff patterns.

| Buff | Sourced mechanic (wiki.gg) |
|---|---|
| **Strength** | Increases enemy damage per hit. Some enemies self-buff. |
| **Thorns** | Damages attacker when hit. Prefer single large hits over multi-hit when facing. |
| **Plating** | Read the current power description and its timing; it is not a generic per-hit damage reduction rule. |
| **Minion** | Fatal will not trigger on kills. Minion deaths do not trigger Fatal.|

## Buff Interaction Notes (Strategic Inference)

- Strength + multi-hit attacks (per card text, each hit benefits from Strength).
- Vulnerable increases damage from Attacks by 50%, not all damage sources. Paper Phrog modifies the multiplier; use its current relic text.
- {strategic inference} Intangible interactions with multi-hit (all hits reduced to 1 regardless of count) — verify against installed build.

## Source Attribution

- Card/relic text from slaythespire2.net (beta v0.111.0 game data, extracted 2026-06-18).
- Buff definitions from slaythespire.wiki.gg (Slay the Spire 2:Keywords, revision 52813; Slay the Spire 2:Buffs page).
- **All notes labeled `{strategic inference}` are unsourced gameplay reasoning, not verified facts.**