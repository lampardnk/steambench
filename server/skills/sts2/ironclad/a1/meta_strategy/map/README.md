---
title: Map navigation
description: Source-linked map location facts and a live-state route comparison worksheet for Ironclad.
character: Ironclad
act: any
tags: [map, pathing, route planning, locations]
topic: map
sources:
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Map_Locations
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension
---

# Map navigation

The [STS2 Map Locations page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Map_Locations)
describes the map icons, location rules and encounter pools. The live `map`
object is authoritative for the current graph, reachable options and boss.

## Location facts

| Location | Wiki-described contents |
|---|---|
| Monster | A normal combat. The page states that the first three Act 1 encounters, and the first two in Acts 2 and 3, use the easy pool; later monster encounters use the hard pool. A completed normal combat gives 10–20 Gold (8–15 at the Poverty modifier), a choice of 3 cards and sometimes a Potion. |
| Elite | An Elite combat. A completed Elite gives 35–45 Gold (26–34 with Poverty), sometimes a Potion, a choice of 3 cards with higher rare/uncommon odds, and a random Relic. |
| Rest Site | A Rest Site. The [Rest Sites page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Rest_Sites) describes Rest, Smith and relic-enabled options. |
| Unknown | An Unknown can become an Event, Monster, Merchant or Treasure Room. The wiki says an encounter type that has not appeared becomes more likely in later Unknown rooms. |
| Treasure Room | A Treasure Room contains a chest and its relic/gold reward as described by the live room and the [Map Locations page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Map_Locations). |
| Merchant | The Merchant's stock and removal are described on [The Merchant page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Merchant). |
| Boss | A Boss combat. The page states that there is always a Rest Site before the Boss regardless of route; Act 1/2 boss rewards include 100 Gold (75 with Poverty), a choice of 3 Rare cards and sometimes a random Potion. |
| Ancient | An Ancient encounter between acts; read the live options and the [Ancients page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ancients). |

The `Poverty` values and other difficulty changes are defined on [Ascension](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension).
The source does not replace the run's observed reward.

## Route comparison

`map.next_options` is the set of nodes reachable from the current location;
`map.nodes` is the known graph and `map.boss` is the act's boss. `map.current_position`
is a visited location, not a cursor. Compare each reachable route using the
current HP, deck, potions, relics, available rest and the encounter types shown
by the graph. A route choice is a risk/reward calculation; no location has a
fixed value across seeds.

Do not treat an Unknown as a known event before the room resolves. Do not infer
a future enemy, card offer, event outcome or random reward from the map.
