---
description: Hungry for Mushrooms — Act 3. Exact outcomes for every option, with the trade-offs left open.
character: ironclad
act: 3
category: unknown
ascension: a1
keys: [ironclad, unknown, event, hungry for mushrooms, act 3]
sources: [slaythespire2.net]
---

# Hungry for Mushrooms

**Pool:** Act 3  
**Pages:** 4

## What the screen says

How long has it been since you ate?

...wait, what's that fantastic smell?

Following the scent, you reach a cozy campground with all manner of tasty
mushrooms being cooked! You don't consider the safety of eating these
mushrooms because you are so hungry.

(So hungry that you don't notice the dead adventurer)

## Options — page `INITIAL`

| Option | Exact outcome | Then |
|---|---|---|
| **[Big Mushroom]** | Obtain **a relic** | BIG_MUSHROOM |
| **[Fragrant Mushroom]** | Lose 15 HP (ThatDoesDamage(15) hint associated with taking the Fragrant Mushroom); Obtain **a relic** | FRAGRANT_MUSHROOM |

## Options — page `BIG_MUSHROOM`

You bite into the Big Mushroom. Its flesh is firm, starchy, and satisfying.
The more you eat, the hungrier you become, as if the mushroom is feeding on
your hunger.  So yummy... you enter a food coma. This gluttony will cost you.

This page presents no standard options.

## Options — page `FRAGRANT_MUSHROOM`

You sample the Fragrant One, a small woody mushroom with a delicate scent of
shellfish...  A burst of energy spurs you to run, jump, and **rigorously
train**! Then, a sudden stabbing pain hits you as the living fungi struggles
within you during its brief final moments.

This page presents no standard options.

## Options — page `MEDLEY`

The medley of mushrooms looks the most appetizing so you go for that.  "MY
MUSHROOMS!!"  The adventurer, presumably dead, attacks you! You knock them
out, and with a seasoning of guilt, finish the rest of the fine meal.

This page presents no standard options. page exists in en.json but is NOT referenced in the decompiled C# (only BIG_MUSHROOM and FRAGRANT_MUSHROOM relic options are generated)

## Reading this

Every outcome above is what the option does, not what it is worth. Amounts that
the source publishes as a formula are given as the formula. Weigh them against
this run's HP, gold, deck and remaining route; nothing here says which to take.
