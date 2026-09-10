---
name: sts2
description: Source-linked Slay the Spire 2 Ironclad reference and safe play contract for Ascension 1.
---

# Slay the Spire 2 reference

Read the live sensor first. Current card text, can-play state, enemy intents and
effects, pile membership, focus controls and available options outrank every
reference. The strategist returns semantic intents; the actuator owns the pad.

## Find the relevant guide

Ironclad Ascension 1 material lives under `ironclad/a1/`:

- `controls/CONTROLS.md` — verified interface and input contract; read before
  any input.
- `debugging/README.md` — incident evidence and explicit resume procedure.
- `meta_strategy/map/`, `merchant/`, `restsite/`, `rewards/` — map, shop, rest
  and reward facts plus a generic decision worksheet.
- `meta_strategy/cards/`, `deck_archetypes/`, `playbook/` — card text and
  neutral comparison questions; these contain no fixed tier list.
- `meta_strategy/buffs/`, `debuffs/`, `effects/`, `keywords/`, `mechanics/` —
  named effects, statuses, keywords, timing and card-state mechanics.
- `meta_strategy/relics/`, `potion/` — relic and potion catalog references.
- `act1/`, `act2/`, `act3/` — encounter and event references. Match the live
  encounter; a possible pool member is not an observed enemy.
- `REFERENCE.md` — source precedence, version uncertainty and lookup limits.

Cross-character references live at the skill root: `ascension/` contains the
Ascension table and `characters/` contains character facts. `scratchpad/` is
run-local state and evidence; it is never durable game knowledge.

## Source-linked facts

The allowed web references are the [STS2 wiki main page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Main),
[Keywords](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Keywords),
[Buffs](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Buffs),
[Debuffs](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Debuffs),
[Mechanics](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Mechanics),
[Cards](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards),
[Cards List](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards_List),
[Relics](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Relics),
[Relics List](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Relics_List),
[Potions](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Potions),
[Potions List](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Potions_List),
[Map Locations](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Map_Locations),
[The Merchant](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Merchant),
[Rest Sites](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Rest_Sites),
[Ascension](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension),
[Enchantments](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Enchantments),
and [Afflictions](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Afflictions).
The beta data site is [slaythespire2.net](https://slaythespire2.net/?v=beta).

Use a precise page link for every copied fact. Wiki Notes and Interactions are
community-selected observations: keep them only when the page was inspected,
mark them `[wiki-driven]`, and link the exact page and section. A wiki page can
lag the installed build; if live state conflicts with it, keep the discrepancy
and follow live state. Missing facts remain unknown.

## Play and learning contract

Calculate damage, Block, Energy, draw access, timing and risk/reward from the
current state. A generic comparison or an adaptive question is allowed; a fixed
card ranking, route prescription, purchase verdict or matchup rule is not.

Batch only deterministic actions whose intermediate state remains verified. A
draw, random result, selection screen, changed target, changed hand or room
transition requires a fresh decision. Durable notes describe reusable mechanics,
conditions, timings, source uncertainty or enemy intent graphs. Offers, floors,
rounds, HP, maps, hands and outcomes from one seed remain in the scratchpad.

The first planner, provider or executor failure pauses input, releases the pad,
and preserves incident evidence. Do not retry blindly, change settings or alter
the game. An unresolved incident is acknowledged only through the explicit
supervisor resume procedure in `debugging/README.md`.
