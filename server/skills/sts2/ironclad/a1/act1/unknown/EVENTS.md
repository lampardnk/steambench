---
description: Act 1 unknown-event index — all 30 events that can appear here, which pool each belongs to, and what gates it; the 8 shared with other acts live under meta_strategy/unknown. Each event has its own note with exact outcomes; this file routes you to it.
character: ironclad
act: 1
category: unknown
ascension: a1
keys: [ironclad, act1, unknown, event, events, overgrowth, underdocks, index, gating, gold, hp, floor]
sources: [slaythespire.wiki.gg]
---

# Act 1 — Unknown events

Thirty events can appear on an Act 1 Unknown floor. Each has its own note in
this folder with every option's exact outcome; open the one matching the event
on screen rather than reasoning from this index.

**There is no correct answer at an event.** These notes state what each option
costs and what it buys, and stop there. The right choice depends on this run's
HP, Max HP, gold, deck size, remaining route and what problems the deck still
has to solve — all of which you can read and this file cannot. Decide at the
event, from live state.

Always read the on-screen options too: numbers below are from the wiki and the
installed build can differ.

## Which events exist

Eight of the events that can appear here are not Act 1 events at all: they are
shared with Acts 2 and 3, and their notes live under
`meta_strategy/unknown/`. The rest are Act 1's own, and the biome splits them.

**Shared with every act (8)** — [brain-leech](../../meta_strategy/unknown/brain-leech.md) ·
[room-full-of-cheese](../../meta_strategy/unknown/room-full-of-cheese.md) ·
[self-help-book](../../meta_strategy/unknown/self-help-book.md) ·
[slippery-bridge](../../meta_strategy/unknown/slippery-bridge.md) ·
[tea-master](../../meta_strategy/unknown/tea-master.md) ·
[the-future-of-potions](../../meta_strategy/unknown/the-future-of-potions.md) ·
[the-legends-were-true](../../meta_strategy/unknown/the-legends-were-true.md) ·
[this-or-that](../../meta_strategy/unknown/this-or-that.md)

**Act 1, either biome (1)** — [the-sunken-statue](the-sunken-statue.md)

**Overgrowth only (12)** — [aroma-of-chaos](aroma-of-chaos.md) ·
[byrdonis-nest](byrdonis-nest.md) · [dense-vegetation](dense-vegetation.md) ·
[jungle-maze-adventure](jungle-maze-adventure.md) ·
[luminous-choir](luminous-choir.md) · [morphic-grove](morphic-grove.md) ·
[sapphire-seed](sapphire-seed.md) · [tablet-of-truth](tablet-of-truth.md) ·
[unrest-site](unrest-site.md) · [wellspring](wellspring.md) ·
[whispering-hollow](whispering-hollow.md) · [wood-carvings](wood-carvings.md)

**Underdocks only (9)** — [abyssal-baths](abyssal-baths.md) ·
[doors-of-light-and-dark](doors-of-light-and-dark.md) ·
[drowning-beacon](drowning-beacon.md) · [endless-conveyor](endless-conveyor.md) ·
[punch-off](punch-off.md) · [spiraling-whirlpool](spiraling-whirlpool.md) ·
[sunken-treasury](sunken-treasury.md) ·
[waterlogged-scriptorium](waterlogged-scriptorium.md) ·
[trash-heap](trash-heap.md)

The biome is fixed for the run, so only 21 of the 30 are reachable in any given
Act 1: the 9 that are not biome-locked plus that biome's 12 or 9. Identify the
biome first — see `act1/ancient/NEOW.md`.

Ten further shared events exist that have no note yet: crystal-sphere,
doll-room, potion-courier, ranwid-the-elder, relic-trader, stone-of-all-time,
symbiote, the-merchant, war-historian-repy, welcome-to-wongo-s. Read the screen
itself when one of those appears.

## What gates an event

An event you want can be made reachable, and one you do not want can be avoided,
by controlling these before stepping on an Unknown floor.

| Gate | Events |
|---|---|
| Gold ≥ 44 | Whispering Hollow |
| Gold ≥ 55 | Waterlogged Scriptorium |
| Gold ≥ 100 (and 2 transformable cards) | Morphic Grove |
| Gold ≥ 120 | Endless Conveyor |
| Gold ≥ 149 | Luminous Choir |
| Gold ≥ 150 | Tea Master |
| HP ≤ 70% of Max | Unrest Site |
| HP > 5 | Trash Heap |
| HP ≥ 10 and ≥ 1 card | The Legends Were True |
| Floor 6+ | Punch Off |
| Floor 7+, and a removable card | Slippery Bridge |
| At least 2 potions held | The Future of Potions? |
| At least 1 basic card | Wood Carvings |
| A Strike or Defend to enchant | Spiraling Whirlpool |
| No gate | Aroma of Chaos, Brain Leech, Byrdonis Nest, Dense Vegetation, Doors of Light and Dark, Drowning Beacon, Jungle Maze Adventure, Room Full of Cheese, Sapphire Seed, Self-Help Book, Sunken Treasury, Tablet of Truth, The Sunken Statue, This or That?, Wellspring |

Spending below a threshold removes that event from the pool, which changes what
else can roll. Holding 150 Gold past an Unknown floor is itself a decision.

## One event retrieval cannot find

`This or That?` is made entirely of common words, so nothing in its name
survives as a search term and it will never be pulled in automatically by the
situation. Every filename in this folder appears in the `learned_notes` list on
every decision — when the screen says This or That?, recall
`meta_strategy/unknown/this-or-that.md` by path rather than waiting for it to arrive.

## Reading these notes

- Every listed outcome is what the option does, not what it is worth.
- **Transform** means you pick the input card and the game picks the output; only
  Wood Carvings names its output in advance.
- **Enchant** attaches an effect to one specific card, and is lost if that card
  is later transformed.
- Curses differ enormously in cost. Ethereal (Clumsy) leaves your hand each turn;
  Guilty removes itself after 5 combats; Spore Mind can be exhausted for 1
  Energy; Poor Sleep has Retain and clogs your hand permanently; **Greed is
  Eternal and can never be removed by anything**.
- Max HP lost is permanent. Current HP is not: Burning Blood returns 6 after
  every combat, which makes current-HP prices cheaper for Ironclad than the
  number suggests, and Max HP prices exactly as expensive.
