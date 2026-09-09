---
description: Neow Act 1 Ancient choice — scout the map, let the boss name the biome, study its elites, then pick against this run's named problems. No tier lists.
character: ironclad
act: 1
category: ancient
ascension: a1
keys: [ironclad, act1, ancient, neow, relic, choice, boss, biome, overgrowth, underdocks, route, scouting, elite, transform, variance, booming conch, winged boots, lava rock]
sources: [slaythespire2.net, slaythespire.wiki.gg]
---

# Neow — Act 1 Ancient choice

First room of Act 1. An Ancient heals to full (A2+ restores 80% of missing HP).
Three relics: two free, then one priced. Retrieval cuts this note at 2500
characters — `recall` this path for the full pools, costs and probabilities.

## The short version

1. Scout `map` at Neow — it needs no UI navigation and no input.
2. The boss names the biome: Overgrowth or Underdocks.
3. Read that biome's elite and boss notes *before* choosing.
4. Name the two or three problems this run must actually solve.
5. No tier lists. Pros, cons, and say plainly when a pick is high-variance.
6. Plan a route, then re-decide it at every map screen.
7. Make the route the run's first objective — only one runs at a time.

## Decision framework

### 1. Scout before choosing
The mod exposes `map` at Neow with no UI navigation and no input:
- `map.boss.name` / `map.boss.id` — the act's boss, knowable right now.
- `map.nodes[].type` — count Elite, Rest Site, Merchant, Treasure, Event.
- `map.next_options[].leads_to` — one-level lookahead per reachable node.

Read the live `type` strings rather than assuming their spelling.

### 2. The boss names the biome
Act 1 boss pools are disjoint, so the boss identifies the biome:

- **Overgrowth** — Ceremonial Beast, The Kin, Vantom.
- **Underdocks** — Lagavulin Matriarch, Soul Fysh, Waterfall Giant.

If `map.boss` carries no name the biome is **unknown, not guessable**: pick a
relic that is fine in both and settle it at the first fight, where one enemy
name resolves it (the normal rosters are disjoint too).

### 3. Study that biome's elites and boss now, not after
- Overgrowth → `act1/elite/OVERGROWTH_ELITES.md`, `act1/boss/OVERGROWTH_BOSSES.md`
- Underdocks → `act1/elite/UNDERDOCKS_ELITES.md`, `act1/boss/UNDERDOCKS_BOSSES.md`

### 4. Name the problems this run must solve
Two or three, written down, drawn from the entries you read in step 3 — not
from a summary here. The mob, elite and boss notes carry the nuance; read the
biome's threats out of them and name what this run has to answer.

A relic is good *here* because it answers one of those problems.

### 5. No tier lists
Do not rank relics and do not import a ranking. The reference site serves
`/card-tier-list/<character>`; it is an opinion formed on other seeds and decks,
and it does not know your route, biome or deck. State pros and cons, and say
plainly when a pick is high-variance. "High risk, high reward" is a real answer
— take it deliberately rather than dressing it up as a rating.

### 6. Plan a route, commit to a direction, not to a path
Choose the route now so the relic choice has something to serve, then keep it
revisable: re-read `map.next_options` at every map screen and change the plan
when the run changes — damage taken, a relic that shifts what you survive, a
deck that did not come together. A route fixed at floor 1 and followed to the
boss is worse than one re-decided six times. Take a calculated risk when the
downside is known and survivable.

### 7. Make the route your first objective
The runtime holds **one active objective at a time**, so route planning cannot
run beside another goal. Open it first — scout, name the biome and the problems,
choose the line — then close it before any combat or bestiary objective. A relic
chosen before the route is known is a guess.

## Relic pros and cons

Effects and costs are in the pool tables below; this is only the trade-off.
Nothing here is a ranking — read it against the problems you named.

| Relic | Pro | Con / when it is wrong |
|---|---|---|
| Lost Coffer | card + potion, free | no help if the deck needs one specific answer |
| Phial Holster | slot + 2 potions; potions burst HP checks | dead weight if you hoard them |
| Booming Conch | draw 2 + energy, elite fights only | worthless on a route that skips elites |
| Neow's Talisman | upgrades Strike + Defend; helps every combat | low ceiling; wins no fight alone |
| Precise Scissors | removes a card you choose | slowest payoff; weak on a thin deck |
| Lava Rock | Act 1 boss drops 2 relics | pays only if you beat that boss |
| Golden Pearl | 150 gold, no curse | worth only the shop your route reaches |
| Winged Boots | ignores path restrictions 3× — route flexibility | worth least on an open map |
| Lead Paperweight | 1 of 2 Colorless, flexible | filler if neither answers a named problem |
| Neow's Torment | Neow's Fury is a strong attack | adds a card; Exhaust makes it one-shot |
| Arcane Scroll | a free random Rare | **high variance** — may answer nothing |
| Small Capsule | a free random relic | **high variance** — same |
| Neow's Bones | 2 random Neow relics | **highest variance** — two rolls plus a Curse |
| Large Capsule | 2 random relics | dilutes the deck with +1 Strike +1 Defend |
| Cursed Pearl | 333 gold, a lot of removal | Greed is unplayable and Eternal — every hand, all run |
| Leafy Poultice | transforms 2 basics | −12 Max HP bites on a route short of rest sites |
| Precarious Shears | removes 2 chosen cards — strongest thinning | −16 HP now; **high risk, high reward** |
| Silken Tress | Glam on the first card reward | loses all gold — check for a shop first |
| Silver Crucible | first 3 card rewards Upgraded | first Treasure Chest empty (guaranteed at midpoint) |

## No fixed transform outcome
Transform (New Leaf, Leafy Poultice) produces a random card of any rarity. You
cannot predict or target the result. The transform preview animation re-rolls
~once per second but does NOT determine the result (see controls/CONTROLS.md:
"confirm immediately with y. It is not a timing challenge."). Choose transform
only when the worst-case outcome is acceptable.

## Choice structure

Each visit offers **3 relics**: one from the Curse (cost) pool, then two from
the Positive (no-cost) pool. wiki.gg gives the order of resolution — the Curse
relic is picked first, the Positive pool is then adjusted around it, and all
three are offered together. The priced relic's weaker twin is removed from the
Positive pool, so you never see both a priced relic and its unpriced twin in the
same offer.

[Which on-screen slot the priced relic occupies is UNCONFIRMED — the sources
describe selection order, not display order. Read the live offer rather than
assuming it is third.]

## Positive (no-cost) pool — 2 offered

| Relic | Effect | Notes |
|---|---|---|
| Arcane Scroll | Obtain a random Rare card | only if Hefty Tablet not selected |
| Booming Conch | Elite combat: draw 2 + gain 1 energy | strong for elite fights |
| Fishing Rod | Every 3 normal combats, Upgrade a random card | slow value |
| Golden Pearl | Gain 150 Gold | only if Cursed Pearl not selected |
| Kaleidoscope | Obtain 2 card rewards from other characters | cross-character cards |
| Lead Paperweight | Choose 1 of 2 Colorless cards | flexible |
| Lost Coffer | 1 card reward + 1 random potion | only if Neow's Sacrifice not selected |
| Massive Scroll | Choose 1 of 3 Multiplayer cards | multiplayer only |
| Neow's Torment | Add 1 Neow's Fury (10 dmg, 2 discard→hand, Exhaust, 1 cost) to deck | strong attack |
| New Leaf | Transform 1 card | only if Leafy Poultice not selected |
| Phial Holster | +1 potion slot + 2 random potions | only if Neow's Sacrifice not selected |
| Precise Scissors | Remove 1 card from deck | only if Precarious Shears not selected |
| Scroll Boxes | Choose 1 of 2 card packs | deck-building |
| Winged Boots | Ignore path restrictions 3 times | non-multiplayer only |

**Either/or pairs (one is added):**
- Lava Rock (Act 1 boss drops 2 relics) OR Small Capsule (random relic) —
  only if Large Capsule not selected
- Nutritious Oyster (+11 Max HP) OR Stone Humidifier (+5 Max HP per rest)
- Neow's Talisman (Upgrade 1 Strike + 1 Defend) OR Pomander (Upgrade a card)

## Curse (cost) pool — 1 offered

| Relic | Effect | Cost |
|---|---|---|
| Cursed Pearl | Gain 333 Gold | Greed curse (unplayable, Eternal) |
| Dowsing Rod | Add 1 Dowsing (quest card) to deck | [wiki.gg] quest card burden |
| Hefty Tablet | Choose 1 of 3 Rare cards | Injury curse (unplayable) |
| Large Capsule | 2 random relics | +1 Strike +1 Defend to deck |
| Leafy Poultice | Transform 1 Strike + 1 Defend | Lose 12 Max HP |
| Neow's Bones | 2 random Neow relics | +1 random Curse |
| Neow's Sacrifice | 1 Ambergris + 1 Guilty curse | [wiki.gg] |
| Precarious Shears | Remove 2 cards | Lose 16 HP |
| Silken Tress | Enchant first card reward with Glam | Lose all Gold |
| Silver Crucible | First 3 card rewards Upgraded | first Treasure Chest empty (non-MP only) |

## Graded pairs

Each priced relic has a weaker unpriced twin, and only one appears: Cursed
Pearl/Golden Pearl, Hefty Tablet/Arcane Scroll, Leafy Poultice/New Leaf,
Precarious Shears/Precise Scissors. The Notes columns above mark each pair.

## Probabilities (non-multiplayer, from wiki.gg)

- All Curse pool relics: 10% each
- Lava Rock / Small Capsule: 5.9%
- Nutritious Oyster / Stone Humidifier / Neow's Talisman / Pomander: 6.5%
- Phial Holster / Lost Coffer: 11.7%
- Arcane Scroll / Golden Pearl / New Leaf / Precise Scissors: 11.8%
- All other Positive pool relics: 13.1%
