---
title: Rewards
description: >-
  Post-combat reward structure (sourced) and card/gold decision framework (inference). Skip/tradeoff logic is strategic.
character: Ironclad
act: any
tags: [rewards, card-pick, skip, gold]
topic: rewards
sources:
  - slaythespire.wiki.gg Map_Locations
  - slaythespire2.net
---

# Rewards — Decision Framework

## Core Reward Rules (Sourced)

Source: slaythespire.wiki.gg (Slay the Spire 2:Map_Locations, revision 50028)

| Combat Type | Card Reward | Gold | Extras |
|---|---|---|---|
| **Normal Monster** | Choose 1 of 3 cards | 10-20 (**8-15** A3+) | Potion (sometimes) |
| **Elite** | Choose 1 of 3 cards (higher rare/uncommon odds) | 35-45 (26-34 A3+) | Random Relic + Potion (sometimes) |
| **Boss (Act 1/2)** | Choose 1 of 3 Rare cards | 100 (75 A3+) | Potion (sometimes), then Ancient floor |
| **Boss (Act 3)** | Run victory | - | Unlocks next Ascension |

## Default Collection

Gold and relics should be taken immediately. Card rewards warrant evaluation.

## Card Skip / Take (Strategic Inference)

{strategic inference} General considerations for adding cards:

**Reasons to skip:**
- The current deck already handles the upcoming fights.
- Adding cards reduces the draw rate of key cards already in the deck.
- The offered cards do not solve a current weakness (frontload damage, AoE, block, scaling).

**Reasons to take:**
- The card addresses a specific gap (e.g., no block cards, no AoE, no scaling).
- The card directly supports your emerging archetype.
- The card has high standalone value unrelated to archetype.

{strategic inference} There is no universally correct "always take" or "always skip" list. Evaluate each run's current state.

## Ancient Choices

Source: slaythespire.wiki.gg (Slay the Spire 2:Map_Locations)

**Every act *starts* by meeting an Ancient, and Act 1 always starts with Neow.**
The floor after the Act 1 or Act 2 boss is always an Ancient floor — which is
the same thing seen from the other side, since that floor opens the next act.
Neow is therefore the first room of the run, not a post-boss reward.

Ancients heal 100% of your **missing** HP (80% at A2+, which explicitly includes
Neow).

Ancient relic effects (sourced from slaythespire2.net relic database):
- Downside-bearing Ancient relics include Ectoplasm (cannot gain gold), Sozu (cannot obtain new potions), Velvet Choker (card-play limit), Philosopher's Stone (enemy Strength), Snecko Eye (Confused), and Whispering Earring (Vakuu plays the first turn). Read the exact current effect before choosing.

{strategic inference} Evaluate the downside relative to your build's dependency on the resource being restricted.

## Potion Rewards (Sourced)

Source: slaythespire2.net (62 potions in beta v0.111.0)

- 3 potion slots base (2 at A4+ per Ascension table).
- White Beast Statue relic: potions always appear in combat rewards.
- Potion Belt relic: +2 slots.

## Source Attribution

- Combat reward structure from slaythespire.wiki.gg (Slay the Spire 2:Map_Locations, revision 50028, and Slay the Spire 2:Mechanics, revision 50033).
- Gold values, relic effects, potion counts from slaythespire2.net (beta v0.111.0).
- **All notes labeled `{strategic inference}` are unsourced gameplay reasoning.**