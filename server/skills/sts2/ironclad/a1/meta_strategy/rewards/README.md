---
description: Source-linked combat reward facts and live-state card, gold and Potion selection rules.
character: Ironclad
act: any
category: rewards
keys: [rewards, card reward, card pick, skip, gold, potion, relic, ancient]
sources:
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Map_Locations
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Potions
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension
---

# Rewards

The [STS2 Map Locations page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Map_Locations)
describes the standard reward structure. The live reward object, item text and
current Ascension are authoritative.

| Encounter | Wiki-described reward |
|---|---|
| Normal Monster | 10–20 Gold (8–15 with Poverty), a choice of 3 cards and sometimes a Potion. |
| Elite | 35–45 Gold (26–34 with Poverty), a choice of 3 cards with higher rare/uncommon odds, a random Relic and sometimes a Potion. |
| Act 1/2 Boss | 100 Gold (75 with Poverty), a choice of 3 Rare cards and sometimes a random Potion; the following floor is an Ancient floor. |
| Act 3 Boss | Run victory, according to the page's map-location description. |

The reward page also links the [Cards mechanics](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards),
[Potions](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Potions) and
[Ascension](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension) references.

## Taking a reward

Read `rewards.items` and the current card/relic/Potion descriptions. A card
choice is a comparison between adding that card and skipping it; calculate the
effect against the current deck, route, resource state and visible threats. A
random generated card, upgrade, transform or Potion result is unknown until the
screen shows it. Gold and Relics have their live item identity and effect.

Use the card-selection contract in [CONTROLS.md](../controls/CONTROLS.md) for a
choice screen. After collecting one row, re-read focus and the remaining rows.
Offers, selected cards, prices, floors and outcomes from one seed belong in the
scratchpad and do not form a durable lesson.

## Ancient floors

The [Ancients page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ancients)
and live Ancient screen define its options, costs and outcomes. Do not infer an
Ancient's result from its name or from another act. At Ascension 2 and above,
the [Ascension page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension)
defines the Weary Traveler healing change.
