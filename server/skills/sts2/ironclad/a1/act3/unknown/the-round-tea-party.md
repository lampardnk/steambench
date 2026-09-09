---
description: The Round Tea Party — Act 3. Exact outcomes for every option, with the trade-offs left open.
character: ironclad
act: 3
category: unknown
ascension: a1
keys: [ironclad, unknown, event, the round tea party, act 3]
sources: [slaythespire2.net]
---

# The Round Tea Party

**Pool:** Act 3  
**Pages:** 5

## What the screen says

You find an invitation for a "Sir Galalot" to a tea party and decide to show
up in his stead.

Upon entering an unassuming rotunda, you find yourself in the midst of
commanders, generals, warlords, and mercenaries having... tea?

The gigantic knight donning a golden crown speaks.

"Thou art late for Tea?!"

## Options — page `INITIAL`

| Option | Exact outcome | Then |
|---|---|---|
| **[Enjoy Your Tea]** | Obtain **a relic** — screen text: "Obtain **Royal Poison**. Heal to full HP." | ENJOY_TEA |
| **[Pick a Fight]** | other (no immediate effect; ThatDoesDamage(11) hint. Damage is actually dealt on CONTINUE_FIGHT) — screen text: "Lose 11 HP. Obtain a random **Relic**." | PICK_FIGHT |

## Options — page `ENJOY_TEA`

You grab a teacup and down it one go. It's SCALDING HOT but you don't change
your expression. The patrons are stunned by your lack of self preservation.
"We meant no offense, Sir Galalot. our sincerest apologies."  You enjoy some
tea and crumpets, unaware of the poison you've ingested.

This page presents no standard options.

## Options — page `PICK_FIGHT`

You jump onto the table and kick the warlord knight in the face!  The knight
lets out a haunting shriek and keels over.  *everyone gasps*

| Option | Exact outcome | Then |
|---|---|---|
| **[Continue]** | Lose 11 HP; Obtain **a relic** (obtain next relic from front of relic pool) | CONTINUE_FIGHT |

## Options — page `CONTINUE_FIGHT`

The patrons stare wide-eyed at the corpse of one of their regulars... then
bursts into applause!?  "We were wondering how to rid of Sir Wygore,
incredible work!"  They dump out your poisoned tea and you discuss tactics and
secrets all night. A most excellent tea party.

This page presents no standard options.

## Options — page `NOPE`

They all point their weapons at you-  "At least pay the **entrance fee** if
you want to live."

This page presents no standard options. page exists in en.json but is NOT referenced by the decompiled C#

## Reading this

Every outcome above is what the option does, not what it is worth. Amounts that
the source publishes as a formula are given as the formula. Weigh them against
this run's HP, gold, deck and remaining route; nothing here says which to take.
