---
description: Source precedence for Ironclad A1 factual notes; live state outranks community references.
character: ironclad
act: any
category: reference
ascension: a1
keys: [reference, sources, wiki, slaythespire2, wiki.gg, lookup, research, versioned, build, provenance, uncertainty]
sources: [https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Main, https://slaythespire2.net/?v=beta]
---

# Versioned factual knowledge

Use the installed build's observed card descriptions, `can_play` flags, enemy
intents, powers, statuses, piles and choices. Do not import Slay the Spire 1
character lists, encounter values or mechanics. A live modified card description
outranks a base catalog entry.

The runtime keeps an observed catalog in the room scratchpad. It keeps current
buffed hand text separate from permanent base card facts, does not treat draw
pile membership as draw order, and does not assume a random result before it is
observed. Candidate lessons remain hypotheses until reviewed.

The standalone `lookup` action queries the read-only STS2MCP `/api/v1/wiki`
endpoint for cards and relics. It returns at most five fuzzy results and 6000
result characters from the active profile's discovered catalog; it does not
search monsters or events. `research` fetches one external page and must retain
its exact URL and any uncertainty.

## Allowed references

- [STS2 wiki main](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Main)
- [Keywords](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Keywords),
  [Buffs](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Buffs),
  [Debuffs](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Debuffs),
  [Mechanics](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Mechanics)
- [Cards](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards) and
  [Cards List](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards_List)
- [Relics](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Relics) and
  [Relics List](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Relics_List)
- [Potions](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Potions) and
  [Potions List](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Potions_List)
- [Map Locations](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Map_Locations),
  [The Merchant](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Merchant),
  [Rest Sites](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Rest_Sites),
  [Ascension](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension)
- [Beta game data](https://slaythespire2.net/?v=beta), where a page exists.

The wiki pages are community-maintained and can disagree with the installed
build or with beta data. Record both values and the precise source when they
differ. Never turn a source prediction into an intent, hidden event outcome or
semantic-action fact. Wiki Notes/Interactions are retained as `[wiki-driven]`
observations and linked to the exact page; they are evidence, while any local
decision criterion is an explicitly labeled hypothesis.
