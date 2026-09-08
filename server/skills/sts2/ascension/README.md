---
description: The A1-A10 Ascension modifiers and what each one changes, so the A3+/A6+/A8+/A9+ notation used across the guide resolves to something concrete.
character: any
act: any
category: ascension
keys: [ascension, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, difficulty, modifiers, swarming elites, poverty, inflation, tough enemies, deadly enemies, ascender's bane, double boss]
sources: [slaythespire.wiki.gg]
---

# Ascension modifiers

Reserved cross-character reference: Ascension is not Ironclad-specific, so it
sits at the skill root rather than under `ironclad/a1/`.

Modifiers are **cumulative** — each level includes every level below it. The
maximum is 10. Each character unlocks its own levels independently.

| Level | Name | Effect |
|---|---|---|
| 1 | Swarming Elites | ~60% more Elites spawn |
| 2 | Weary Traveler | Ancients heal only 80% of missing HP, **Neow included** |
| 3 | Poverty | Enemies **and Treasure Chests** drop 25% less Gold |
| 4 | Tight Belt | One fewer potion slot (3 → 2) |
| 5 | Ascender's Bane | Start with Ascender's Bane — Unplayable, Ethereal, **Eternal**, so it can never be removed |
| 6 | Inflation | Shop removal starts at 100 Gold instead of 75, and rises 50 per removal instead of 25 |
| 7 | Scarcity | Rare and Upgraded cards appear half as often, in combat rewards **and** in the Merchant's stock |
| 8 | Tough Enemies | All enemies have more HP |
| 9 | Deadly Enemies | All enemies deal more damage |
| 10 | Double Boss | Two bosses at the end of Act 3 |

## What this means at A1, which is what this guide is written for

**Only Swarming Elites applies.** Everything else on that list is off.

- Enemy HP and damage in the encounter files are **base values**. The `(A8+: …)`
  and `(A9+: …)` figures quoted throughout are there so the notes stay correct
  if the ascension is raised — they are not your numbers.
- Gold is at full rate, so the shop and gold-gated events are more reachable
  than the A3+ figures suggest.
- You have 3 potion slots, not 2.
- You carry no Ascender's Bane, so your starting deck is clean.
- Shop removal starts at 75 Gold and rises by 25.
- The one thing that *is* harder: roughly 60% more elite nodes on the map than
  at Ascension 0. That is where the "5 → 8 elites" figure in
  `meta_strategy/map/README.md` comes from, and it is why routing around or
  through elites is the main Act 1 decision rather than an afterthought.

## Where the levels bite, if this is ever raised

- **A2** removes the full Neow heal, which changes how much HP you can spend
  early.
- **A6** roughly doubles the lifetime cost of deck thinning.
- **A8/A9** are the two that invalidate every damage calculation in the
  encounter files; read the parenthesised values from that point on.
