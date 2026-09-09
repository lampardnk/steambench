---
description: Crystal Sphere — Any act. Exact outcomes for every option, with the trade-offs left open.
character: ironclad
act: any
category: unknown
ascension: a1
keys: [ironclad, unknown, event, crystal sphere, any act]
sources: [slaythespire2.net]
---

# Crystal Sphere

**Pool:** Any act  
**Pages:** 4

## What the screen says

"I predicted you'd enter...!"

A raspy voice calls out as you enter a mystic hut.

"Your destiny has brought you here. We must uncover your future and fortunes
so you can SAVE US ALL!!"

"Okay, here are the options for the Crystal Sphere reading. Be sure to sign
this waiver as well," she says while bringing out pen and parchment.

## Options — page `INITIAL`

| Option | Exact outcome | Then |
|---|---|---|
| **[Uncover Future]** | Lose 50 Gold (lose gold equal to UncoverFutureCost = 50 + random(1..50)); other (play CrystalSphere minigame with 3 prophesize reveals (reveals/manipulates upcoming card rewards)) — screen text: "Pay 50 **Gold**. Divine 3 times." | FINISH |
| **[Payment Plan]** | Add **Debt** (add Debt curse to deck); other (play CrystalSphere minigame with 6 reveals) — screen text: "Gain a ?. Divine 6 times." | FINISH |

## Options — page `FINISH`

I'm done pondering

This page presents no standard options.

## Options — page `UNCOVER_FUTURE`

Uncover Future

This page presents no standard options. en.json page for the UNCOVER_FUTURE flavor/minigame; code sends both options to FINISH after the minigame

## Options — page `PAYMENT_PLAN`

Payment Plan

This page presents no standard options. en.json page for the PAYMENT_PLAN flavor/minigame; code sends both options to FINISH after the minigame

## Reading this

Every outcome above is what the option does, not what it is worth. Amounts that
the source publishes as a formula are given as the formula. Weigh them against
this run's HP, gold, deck and remaining route; nothing here says which to take.
