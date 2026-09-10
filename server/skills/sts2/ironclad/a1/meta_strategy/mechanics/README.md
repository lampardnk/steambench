---
title: Mechanics
description: Wiki-linked core card, pile, transform, enchantment and affliction mechanics for Ironclad.
character: Ironclad
act: any
tags: [mechanics, combat, deckbuilding, transform, enchantment, affliction, piles]
topic: mechanics
sources:
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Mechanics
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Keywords
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Enchantments
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Afflictions
---

# Core mechanics

Use the live sensor for the current phase, card text, pile membership, modified
cost and available controls. The links below are explanatory references and can
lag the installed build.

## Turns and resources

The [Keywords page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Keywords)
defines Energy as the resource used to play cards and states that the standard
start of a turn grants 3 Energy. It also defines Block as damage prevention until
the next turn, with damage applied to Block before HP. The sensor's current
Energy, Block, intents and card text decide how those rules apply in a turn.

## Card piles

The [Cards page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards) and
[Keywords page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Keywords)
describe the combat piles and their card keywords:

- cards in Hand are the cards currently available to play or select;
- the Draw pile contains future cards, but its membership does not reveal a
  guaranteed draw order;
- played or discarded cards enter the Discard pile unless their text says
  otherwise;
- Exhaust removes a card from the deck until combat ends and places it in the
  Exhaust pile; only specific effects can play cards from Exhaust;
- Powers leave the ordinary Hand/pile flow according to their live text.

The runtime's `encounter_scratchpad` reports membership and counts. It is not a
prediction of random draws.

## Upgrades and transforms

The [Cards reference](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards)
describes card generation, upgraded cards and transform sources. An upgrade or
transform can change cost, values, keywords or text, so use the current card
description and the active selection screen. The [Eternal keyword](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Keywords)
describes the permanent-deck restriction on removing or transforming Eternal
cards; an in-battle effect can have separate rules stated in its own text.

Do not predict a random transform, reroll, generated card or upgrade outcome.
Record only the observed result or a precise source-backed rule.

## Enchantments

[Enchantments](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Enchantments)
are permanent positive effects added to cards in the Deck or during combat. The
enchantment name and amount are part of the live card text. The page's exact
definition and linked individual enchantment pages are the source for an
effect; the current card remains authoritative if a build changes it.

## Afflictions

[Afflictions](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Afflictions)
are modifiers placed on cards during combat by an enemy that affect the cards in
some way. Read the affected card's live text and the source enemy's live power;
do not infer an Affliction from a similar keyword or from a previous encounter.

## Cross-character mechanics

The [Keywords page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Keywords)
defines Silent's Poison and Sly, Regent's Stars and Forge, Necrobinder's Doom
and Summon, and Defect's Channel, Evoke, Focus and Orbs. They may appear in a
cross-character reference, but they do not add actions to the Ironclad role.

## Decision use

Calculate the cost, timing, target, pile transition and observable payoff of the
mechanic in the current state. A comparison remains a run-specific hypothesis;
the mechanic definition itself must retain its exact source and uncertainty.
