---
title: The Merchant
description: Source-linked Merchant inventory and removal facts with a live-state budget comparison worksheet.
character: Ironclad
act: any
tags: [merchant, shop, gold, removal]
topic: merchant
sources:
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Merchant
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Map_Locations
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension
---

# The Merchant

The [STS2 Merchant page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Merchant)
describes the shop. The live `shop.items`, item prices and gold are authoritative.

## Inventory

| Stock | Wiki-described count or rule |
|---|---|
| Colored cards | 5 cards from the character's card pool. |
| Colorless cards | 2 cards; the Merchant page notes one is always Uncommon and one Rare in the standard stock. |
| Relics | 3 Relics. Shop Relics have their own availability rules. |
| Potions | 3 Potions. |
| Card removal | A Remove option is available; its live price and the run's Ascension determine whether it can be bought. |

The [Map Locations page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Map_Locations)
also identifies the Merchant as the primary way to spend Gold. The [Ascension page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension)
defines the Inflation modifier: removal starts at 100 Gold rather than 75 and
each later removal costs 50 more rather than 25.

## Reading the live shop

The runtime addresses a purchase by the `shop.items` index. Match the item's
name, kind and price from that object; the artwork itself is not a purchase
control. After a purchase, re-read the shop and gold because inventory and focus
can change. A full comparison uses the current gold, the item effect from live
text, the next reachable route and the cost of keeping or removing a card.
There is no universal purchase priority.

For a relic, card or Potion's definition, follow the exact [Relics List](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Relics_List),
[Cards List](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards_List) or
[Potions List](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Potions_List)
page and then check the live item.
