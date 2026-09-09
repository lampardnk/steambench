---
description: Colossal Flower — Act 2. Exact outcomes for every option, with the trade-offs left open.
character: ironclad
act: 2
category: unknown
ascension: a1
keys: [ironclad, unknown, event, colossal flower, act 2]
sources: [slaythespire2.net]
---

# Colossal Flower

**Pool:** Act 2  
**Pages:** 6

## What the screen says

There is a colossal flower growing atop a mountain of bones.

As its color-shifting petals pulsate, you sense there is a Powerful Cluster of
Pollen in the center but the undulating petals are razor sharp and
unpredictable.

You could grab some of the golden nectar, but reaching the prize in the center
is so tempting...

## Options — page `INITIAL`

| Option | Exact outcome | Then |
|---|---|---|
| **[Extract Nectar]** | Gold changes (gain Prize1 gold (amount hidden/random, from _prizeCosts[0])) — screen text: "Gain ? **Gold**." | EXTRACT_CURRENT_PRIZE |
| **[Reach Deeper]** | Lose 5 HP — screen text: "Enter deeper. Lose 5 HP." | REACH_DEEPER_1 |

## Options — page `EXTRACT_CURRENT_PRIZE`

You carefully gather some **nectar** from the flower's flesh. The petals
shimmer angrily.

This page presents no standard options.

## Options — page `REACH_DEEPER_1`

You push past a layer of razor-sharp petals, they're coated with a substance
that makes your skin tingle. This seems to numb the pain?  Maybe this is why
there is a pile of bones here...

| Option | Exact outcome | Then |
|---|---|---|
| **[Extract Nectar]** | Gold changes (gain Prize2 gold (amount hidden/random, from _prizeCosts[1])) — screen text: "Gain ? **Gold**." | EXTRACT_CURRENT_PRIZE |
| **[Reach Deeper]** | Lose 6 HP — screen text: "Enter even deeper. Lose 6 HP." | REACH_DEEPER_2 |

## Options — page `REACH_DEEPER_2`

The tingling turns into a throbbing weakness as you push onwards...  This
flower wants to eat me. Why did I go into it?

| Option | Exact outcome | Then |
|---|---|---|
| **[Extract Nectar]** | Gold changes (gain Prize3 gold (amount hidden/random, from _prizeCosts[2])) — screen text: "Gain ? **Gold**." | EXTRACT_INSTEAD |
| **[Enter the Center]** | Lose 7 HP; Obtain **a relic** — screen text: "Lose 7 HP. Obtain **Pollinous Core**." | POLLINOUS_CORE |

## Options — page `EXTRACT_INSTEAD`

Your whole body is numb and messed up from the toxins, barbs, and leaves.
Enough is enough.  You stow away a glob of **high-quality nectar** and
retreat.

This page presents no standard options.

## Options — page `POLLINOUS_CORE`

With a final lunge you grab hold of the pollinous core! The plant shudders
violently; its petals go dull, and the tingling stops.  The **golden nectar**
becomes worthless muck. You killed it.

This page presents no standard options.

## Reading this

Every outcome above is what the option does, not what it is worth. Amounts that
the source publishes as a formula are given as the formula. Weigh them against
this run's HP, gold, deck and remaining route; nothing here says which to take.
