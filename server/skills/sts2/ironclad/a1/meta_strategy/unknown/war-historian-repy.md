---
description: War Historian, Repy — Any act. Exact outcomes for every option, with the trade-offs left open.
character: ironclad
act: any
category: unknown
ascension: a1
keys: [ironclad, unknown, event, war historian repy, war historian, repy, any act]
sources: [slaythespire2.net]
---

# War Historian, Repy

**Pool:** Any act  
**Pages:** 5

## What the screen says

An academic is trapped in a hanging cage next to a treasure chest.

The academic is muttering about "One-Time-Use Keys" while furiously writing
something.

Looks like you can unlock the cage or the chest.

## Options — page `INITIAL`

| Option | Exact outcome | Then |
|---|---|---|
| **[Unlock the Cage]** | Remove a card (complete quest & remove a LanternKey from deck); Obtain **a relic** — screen text: "Lose **Lantern Key**. Obtain **History Course**." | UNLOCK_CAGE |
| **[Unlock the Chest]** | Remove a card (complete quest & remove a LanternKey from deck); other (offer reward choice: 2 potions + 2 relics) — screen text: "Lose **Lantern Key**. Procure 2 random **Potions**. Obtain 2 random **Relics**." | UNLOCK_CHEST |

## Options — page `UNLOCK_CAGE`

Repy bows in appreciation as you open the cage. He hands you a **thick leather
tome**.  "Those who know not of history are doomed to repeat it. But you seem
to know a thing or two about repeats don't you?"

| Option | Exact outcome | Then |
|---|---|---|
| **[Unlock the Chest]** | other (SecondUnlockChest: offer 2 potions + 2 relics, remove remaining LanternKeys) — screen text: "Lose **Lantern Key**. Procure 2 random **Potions**. Obtain 2 random **Relics**." | EXTRA_UNLOCK_CHEST |

**Engine note:** Terminal unless ShouldGetSecondReward (single-player and another LanternKey remains). In that case the page instead offers the other reward.

## Options — page `UNLOCK_CHEST`

"Not going to free the scholar, Repy? Based on classic philosophy, you would
be considered a moral failure. That's right, maybe consider the LIVING PERSON
that is locked up next time! It is not as if there is a valuable member of
society in a DIRE PREDICAMENT or anything!!"  "Look, okay, see how small this
cage is!? Why am I complaining? You've already made your unscholarly
decision... oh, what's inside there? Some **potions** and **relics**? Isn't
that just great. Just great. Really great for you..."  Repy's eyes follow you
with disdain as you walk away.

| Option | Exact outcome | Then |
|---|---|---|
| **[Unlock the Cage]** | Obtain **a relic** (SecondUnlockCage; remove remaining LanternKeys) — screen text: "Lose **Lantern Key**. Obtain **History Course**." | EXTRA_UNLOCK_CAGE |

**Engine note:** Terminal unless ShouldGetSecondReward. In that case offers the cage reward instead.

## Options — page `EXTRA_UNLOCK_CHEST`

As Repy walks away, you use your spare key to open the chest.

This page presents no standard options.

## Options — page `EXTRA_UNLOCK_CAGE`

You hear Repy let out a sigh of relief as you pull out the spare key from your
pocket.  "You really had me going there".

This page presents no standard options.

## Reading this

Every outcome above is what the option does, not what it is worth. Amounts that
the source publishes as a formula are given as the formula. Weigh them against
this run's HP, gold, deck and remaining route; nothing here says which to take.
