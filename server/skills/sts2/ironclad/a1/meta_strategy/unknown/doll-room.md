---
description: Doll Room — Any act. Exact outcomes for every option, with the trade-offs left open.
character: ironclad
act: any
category: unknown
ascension: a1
keys: [ironclad, unknown, event, doll room, any act]
sources: [slaythespire2.net]
---

# Doll Room

**Pool:** Any act  
**Pages:** 6

## What the screen says

You enter a hidden room...

It's packed with an array of dolls. Each are unique, their expressions ranging
from joy to sorrow, their attire spanning centuries and realms beyond your
own.

A chorus of whispers grows louder and louder until the dolls are shouting over
each other and calling for you...

You must choose one and leave immediately.

## Options — page `INITIAL`

| Option | Exact outcome | Then |
|---|---|---|
| **[Pick at Random]** | Obtain **a relic** (obtains one random doll relic of the 3) — screen text: "Obtain a random **Doll Relic**." | DAUGHTER_OF_WIND |
| **[Take Some Time]** | Lose 5 HP — screen text: "Lose 5 HP. Choose 1 of 2 **Doll Relics**." | TAKE_SOME_TIME |
| **[Examine Each and Make the Best Choice]** | Lose 15 HP — screen text: "Lose 15 HP. Choose 1 of 3 **Doll Relics**." | EXAMINE |

## Options — page `DAUGHTER_OF_WIND`

"You should be happy I chose you!" The doll proclaims triumphantly.

This page presents no standard options.

## Options — page `TAKE_SOME_TIME`

Amid the shouting, you quickly examine the dolls.  One of these two may be
good? It's hard to concentrate through the mental anguish.

| Option | Exact outcome | Then |
|---|---|---|
| **[TAKE.TAKE]** | Obtain **a relic** — screen text: "Receive **Daughter of the Wind**." | DAUGHTER_OF_WIND |
| **[TAKE.TAKE]** | Obtain **a relic** — screen text: "Receive **Mr. Struggles**." | MR_STRUGGLES |
| **[TAKE.TAKE]** | Obtain **a relic** — screen text: "Receive **Bing Bong**." | FABLE |

**Engine note:** shows 2 of the 3 dolls (random) as TAKE.TAKE options

## Options — page `EXAMINE`

You examine each and every doll before you make your choice.  The shouting has
reached a piercing crescendo but you manage to make a choice before going
completely mad!

| Option | Exact outcome | Then |
|---|---|---|
| **[TAKE.TAKE]** | Obtain **a relic** — screen text: "Receive **Daughter of the Wind**." | DAUGHTER_OF_WIND |
| **[TAKE.TAKE]** | Obtain **a relic** — screen text: "Receive **Mr. Struggles**." | MR_STRUGGLES |
| **[TAKE.TAKE]** | Obtain **a relic** — screen text: "Receive **Bing Bong**." | FABLE |

**Engine note:** shows all 3 dolls (shuffled) as TAKE.TAKE options

## Options — page `MR_STRUGGLES`

As you pick up the worn-looking doll, all of the voices go silent. This one
doesn't speak.

This page presents no standard options.

## Options — page `FABLE`

A warm voice happily fills your head. "We are going to uncover the most
delightful stories together!"

This page presents no standard options. reached by taking the BingBong doll

## Reading this

Every outcome above is what the option does, not what it is worth. Amounts that
the source publishes as a formula are given as the formula. Weigh them against
this run's HP, gold, deck and remaining route; nothing here says which to take.
