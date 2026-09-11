---
title: Rest Sites
description: Source-linked Rest Site options and live-state selection rules for Ironclad.
character: Ironclad
act: any
tags: [rest site, healing, upgrades, enchantments]
topic: restsite
sources:
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Rest_Sites
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Map_Locations
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Relics_List
---

# Rest Sites

The [STS2 Rest Sites page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Rest_Sites)
defines the default options. The live `rest_site.options`, enabled state and
card-selection screen are authoritative for this run.

| Option | Wiki-described effect |
|---|---|
| **Rest** | Heal 30% of Max HP, rounded down. The page notes that the option remains available at full HP. |
| **Smith** | Upgrade a card in the Deck. Eligibility and the resulting card are shown by the live selection screen. |
| Relic-enabled options | Some Relics and circumstances add options, including Dig or additional services. Read the current option text and the exact [Relics List](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Relics_List) entry. |

The [Map Locations page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Map_Locations)
states that a Rest Site is always placed before a Boss regardless of the path.
This is a map fact, not a promise that a particular option is enabled.

## Selection

Read `rest_site.options` and copy the chosen option's `semantic_id`; the
executor resolves it to the current STS2MCP index after a fresh state read. A
card chosen for Smith or another service is selected by its stable
`instance_id`; do not infer eligibility or upgrade text from the base name. If
the site has no remaining options and `can_proceed` is true, use `proceed`.

## Decision worksheet

Compare healing, upgrading and any relic-enabled service against the current HP,
deck, next reachable encounters and available future Rest Sites. Calculate the
risk/reward from this run; there is no fixed HP threshold or universal upgrade
priority in this note.
