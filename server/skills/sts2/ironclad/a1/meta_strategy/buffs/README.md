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
| **Strength** | Inflame (+2, +3 upgraded), **Demon Form (+3/turn, +4 upgraded)**, Rupture (+1 per HP loss, +2 upgraded), Brand (+1, +2 upgraded), Fight Me! (+3, enemy +1), Dominate (+1 per Vulnerable on the enemy), and relics: Ruined Helmet, Vajra, Shuriken, Girya, Brimstone, Red Skull | Intensity, **permanent for the combat**. Increases attack damage by X — per hit, so multi-hit cards gain most. |
| **Vigor** | Akabeko relic; Prep Time; Terror Eel uses it too | Intensity, **conserved**: "Your next Attack deals X additional damage." Spent by one attack. Setup Strike is NOT Vigor — it grants **3 Strength (4 upgraded) until end of turn**, which is a different mechanic that multiplies across every hit of a multi-hit card. |
| **Block** | Shrug It Off (8), Impervious (30, Exhaust), Blood Wall (lose 2 HP, 16), Flame Barrier (12 + Thorns), Second Wind (5 per non-Attack exhausted, 7 upgraded), Feel No Pain (3 per exhaust, 4 upgraded), Unmovable (doubles the first Block gain from a card each turn), **Colossus (4, 7 upgraded)**, Iron Wave (5 Block + 5 dmg), True Grit (7), Taunt (6), Evil Eye (8, +8 more if you exhausted a card this turn), Expect a Fight (15, +5 per Strength), Rage (3 Block per Attack played this turn), Crimson Mantle (7/turn for 1 HP), Barricade (Block is not removed at the start of your turn) | Block values per card text from slaythespire2.net. |
| **Plating** | Stone Armor, Gorget | Read the live power description for timing and amount. Do not model it as per-hit damage reduction. |
| **Thorns** | Bronze Scales relic (3), Flame Barrier (4, one turn) | Retaliate damage on hit. Source: slaythespire2.net relic/card data. |
| **Intangible** | rare; Soul Fysh uses it against you | Duration: "Reduce all damage taken and HP loss to 1. Lasts for X turns." **Removed at the end of the enemy turn**, so a stack granted on the enemy's turn protects it for only one of your turns. |

## Enemy Buffs — Source-Bounded Notes

The wiki.gg keywords page documents buffs that exist in the game engine. Which specific enemies apply each is determined by the monster data files — consult the installed build or encounter guide files in act1/act2/act3/ for exact enemy-specific buff patterns.

| Buff | Sourced mechanic (wiki.gg) |
|---|---|
| **Strength** | Increases enemy damage per hit. Some enemies self-buff. |
| **Thorns** | Damages attacker when hit. Prefer single large hits over multi-hit when facing. |
| **Plating** | Read the current power description and its timing; it is not a generic per-hit damage reduction rule. |
| **Minion** | Fatal will not trigger on kills. Minion deaths do not trigger Fatal.|

## Stack types — the framework that makes the rest predictable

Source: slaythespire.wiki.gg (Buffs / Debuffs pages). Every status behaves one of
these ways, and knowing which tells you whether waiting a turn helps.

| Stack type | Meaning | Between turns |
|---|---|---|
| **Intensity** | more stacks = stronger effect | usually *permanent* for the combat |
| **Duration** | lasts as many turns as it has stacks | *decremented* by 1 at end of turn |
| **Counter** | triggers on an event, losing a stack each time | *conserved* until spent |
| **Does not stack** | on/off, usually from a Power card | lasts the whole combat |

So Strength and Thorns never wear off, while Vulnerable, Weak and Frail always
do — which means a debuff on you is a timer you can sometimes simply outlast,
and Strength on an enemy is not.

**Ritual has a quirk worth knowing**: "At the end of its turn, gains X Strength"
— but it *skips the first end-of-turn trigger when applied by an enemy*. So a
cultist that casts Ritual on turn 1 does not gain Strength that turn; the first
tick lands at the end of its second turn.

## Buff Interaction Notes (Strategic Inference)

- Strength + multi-hit attacks (per card text, each hit benefits from Strength).
- Vulnerable increases damage from Attacks by 50%, not all damage sources. Paper Phrog modifies the multiplier; use its current relic text.
- {strategic inference} Intangible interactions with multi-hit (all hits reduced to 1 regardless of count) — verify against installed build.

## Source Attribution

- Card/relic text from slaythespire2.net (beta v0.111.0 game data, extracted 2026-06-18).
- Buff definitions from slaythespire.wiki.gg (Slay the Spire 2:Keywords, revision 52813; Slay the Spire 2:Buffs page).
- **All notes labeled `{strategic inference}` are unsourced gameplay reasoning, not verified facts.**