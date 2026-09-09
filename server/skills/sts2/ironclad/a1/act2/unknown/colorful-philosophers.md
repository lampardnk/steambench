---
description: Colorful Philosophers — Act 2. Exact outcomes for every option, with the trade-offs left open.
character: ironclad
act: 2
category: unknown
ascension: a1
keys: [ironclad, unknown, event, colorful philosophers, act 2]
sources: [slaythespire2.net]
---

# Colorful Philosophers

**Pool:** Act 2  
**Pages:** 2

## What the screen says

Before you is a rather epic sight.

You see 3 different colored statues towering over a dais, having a heated
debate over the philosophical implications of color.

As you listen in, you get a sense that the most important question at hand is
which color truly is THE BEST.

You chime in with your thoughts.

## Options — page `INITIAL`

| Option | Exact outcome | Then |
|---|---|---|
| **[Red]** | Card reward (offers 3 card-reward choices from Ironclad pool: one Common, one Uncommon, one Rare (each choice picks 3 cards / DynamicVars.Cards)) — screen text: "Obtain 3 Ironclad cards." | DONE |
| **[Green]** | Card reward (offers Common/Uncommon/Rare card rewards from Silent pool) — screen text: "Obtain 3 Silent cards." | DONE |
| **[Blue]** | Card reward (offers Common/Uncommon/Rare card rewards from Defect pool) — screen text: "Obtain 3 Defect cards." | DONE |
| **[Orange]** | Card reward (offers Common/Uncommon/Rare card rewards from Regent pool) — screen text: "Obtain 3 Regent cards." | DONE |
| **[Pink]** | Card reward (offers Common/Uncommon/Rare card rewards from Necrobinder pool) — screen text: "Obtain 3 Necrobinder cards." | DONE |
| **[Equality]** | other (en.json lists EQUALITY (Obtain Prismatic Shard) but the current decompiled GenerateInitialOptions does not emit it; likely unused/legacy or handled elsewhere) — screen text: "Obtain **Prismatic Shard**." | DONE |

**Engine note:** Options are generated dynamically: for each other-character card pool the player has unlocked (order: NECROBINDER, IRONCLAD, REGENT, SILENT, DEFECT), an option is offered, then randomly trimmed to at most 3. The player's own character color is excluded.

## Options — page `DONE`

Your opinion doesn't seem welcome, and the statues resume their unending
debate.

This page presents no standard options.

## Reading this

Every outcome above is what the option does, not what it is worth. Amounts that
the source publishes as a formula are given as the formula. Weigh them against
this run's HP, gold, deck and remaining route; nothing here says which to take.
