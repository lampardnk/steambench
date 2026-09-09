---
description: Relic Trader — Any act. Exact outcomes for every option, with the trade-offs left open.
character: ironclad
act: any
category: unknown
ascension: a1
keys: [ironclad, unknown, event, relic trader, any act]
sources: [slaythespire2.net]
---

# Relic Trader

**Pool:** Any act  
**Pages:** 2

## What the screen says

You turn a corner and suddenly, a shadowy figure is just standing there. He
pivots to face you.

"Welcome! What're ya trading?"

The figure inquires as he flares open his cloak to reveal a slew of suspicious
wares.

## Options — page `INITIAL`

| Option | Exact outcome | Then |
|---|---|---|
| **[Take the Top One]** | Lose a relic (remove owned relic slot 0 (random tradable relic)); Obtain **a relic** (gain new relic slot 0 (pulled from relic pool front)) — screen text: "Trade **?** for **?**." | DONE |
| **[Take the Middle One]** | Lose a relic (remove owned relic slot 1 (random tradable relic)); Obtain **a relic** (gain new relic slot 1 (pulled from relic pool front)) — screen text: "Trade **?** for **?**." | DONE |
| **[Take the Bottom One]** | Lose a relic (remove owned relic slot 2 (random tradable relic)); Obtain **a relic** (gain new relic slot 2 (pulled from relic pool front)) — screen text: "Trade **?** for **?**." | DONE |

**Engine note:** Up to 3 offers shown depending on how many tradable relics you own (>=1 shows TOP, >=2 MIDDLE, >=3 BOTTOM). Each offer trades one of your randomly-chosen owned relics for one new relic pulled from the front of the relic pool. If no options qualify, a generic PROCEED option (key 'PROCEED', not in this event's options) leads to DONE.

## Options — page `DONE`

"Hehehe Heh... Thank you!"

This page presents no standard options.

## Reading this

Every outcome above is what the option does, not what it is worth. Amounts that
the source publishes as a formula are given as the formula. Weigh them against
this run's HP, gold, deck and remaining route; nothing here says which to take.
