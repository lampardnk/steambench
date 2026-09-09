---
description: The Trial — Act 3. Exact outcomes for every option, with the trade-offs left open.
character: ironclad
act: 3
category: unknown
ascension: a1
keys: [ironclad, unknown, event, the trial, act 3]
sources: [slaythespire2.net]
---

# The Trial

**Pool:** Act 3  
**Pages:** 11

## What the screen says

You join a line of people entering a massive building.

As you pass under a golden archway, horns blare, confetti explodes, and
streamers glide down from the ceiling!

"Entrant -1, you are the DECIDER for today's Trial."

## Options — page `INITIAL`

| Option | Exact outcome | Then |
|---|---|---|
| **[Accept]** | Serve as today's Decider. | MERCHANT |
| **[Reject]** | You are not allowed to Reject. | REJECT |

## Options — page `MERCHANT`

A wealthy-looking merchant, presents his case. He is accused of murder by one
of his rivals. The evidence is thin, and you have a feeling that the man is
innocent, but the onlookers seem out for blood.

| Option | Exact outcome | Then |
|---|---|---|
| **[DECIDE: Guilty]** | Add **Regret** (add Regret curse); Obtain **a relic** (obtain 2 relics pulled from the front of the relic pool) — screen text: "Add Regret to your **Deck**. Obtain 2 random **Relics**." | MERCHANT_GUILTY |
| **[DECIDE: Innocent]** | Add **Shame** (add Shame curse); Upgrade chosen card — screen text: "Add Shame to your **Deck**. **Upgrade** 2 cards." | MERCHANT_INNOCENT |

## Options — page `NOBLE`

A **powerful noble** steps forward. You find a note in your pocket indicating
that if you decide innocence you will be handsomely rewarded. The **noble**
barely argues against the corruption charges and gives you a knowing smirk.
You can't stop corruption but you can pocket some **gold...**

| Option | Exact outcome | Then |
|---|---|---|
| **[DECIDE: Guilty]** | Heal 10 HP — screen text: "Heal 10 HP." | NOBLE_GUILTY |
| **[DECIDE: Innocent]** | Add **Regret** (add Regret curse); Gain 300 Gold — screen text: "Add Regret to your **Deck**. Obtain 300 **Gold**." | NOBLE_INNOCENT |

## Options — page `NONDESCRIPT`

A nondescript woman with a hard-to-read face steps forward. She is charged
with the crime of theft and con-artistry. When the woman speaks, you believe
her, but ample witnesses attest to her misdeeds. Both sides of the story are
compelling!

| Option | Exact outcome | Then |
|---|---|---|
| **[DECIDE: Guilty]** | Add **Doubt** (add Doubt curse); Add **a card** (offered 2 card rewards, each choose 1 of 3 from your character card pool) — screen text: "Add Doubt to your **Deck**. Gain 2 card rewards." | NONDESCRIPT_GUILTY |
| **[DECIDE: Innocent]** | Add **Doubt** (add Doubt curse); Transform chosen card (transform 2 chosen cards into random cards) — screen text: "Add Doubt to your **Deck**. **Transform** 2 cards." | NONDESCRIPT_INNOCENT |

## Options — page `REJECT`

"YOU CANNOT REFUSE!!"  Shouts the **Grand Arbiter of the Courts**.  "Those who
reject this privilege are penalized with DEATH. Do you still defy!?"

| Option | Exact outcome | Then |
|---|---|---|
| **[Accept]** | Give in. Serve as today's Decider. | MERCHANT |
| **[Double Down]** | other (opens the abandon-run confirmation popup; flagged as will-kill/abandon the run) — screen text: "Face lethal repercussions." | ends |

## Options — page `MERCHANT_GUILTY`

You rule that all of the man's possessions are to be taken and given as
processing fees for the court. The crowd howls in glee!

This page presents no standard options.

## Options — page `MERCHANT_INNOCENT`

You go with your conscience and rule that the man is innocent. Despite the
boos and accusations of being a "paid-off judge" you feel like you did the
right thing.

This page presents no standard options.

## Options — page `NOBLE_GUILTY`

The **powerful noble** was beheaded. One less corrupt noble.

This page presents no standard options.

## Options — page `NOBLE_INNOCENT`

You don't really know that he's guilty... Yeah, that's it! The **bribe** has
nothing to do with the outcome here. Nope.

This page presents no standard options.

## Options — page `NONDESCRIPT_GUILTY`

You aren't totally sure, but making the hard choice, you think the evidence is
adequate. Did you really make the right call?

This page presents no standard options.

## Options — page `NONDESCRIPT_INNOCENT`

You aren't totally sure, but you have a reasonable doubt. You don't know if
you made the right call, but innocence seems like the better choice.

This page presents no standard options.

## Reading this

Every outcome above is what the option does, not what it is worth. Amounts that
the source publishes as a formula are given as the formula. Weigh them against
this run's HP, gold, deck and remaining route; nothing here says which to take.
