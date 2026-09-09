---
description: Welcome to Wongo's — Any act. Exact outcomes for every option, with the trade-offs left open.
character: ironclad
act: any
category: unknown
ascension: a1
keys: [ironclad, unknown, event, welcome to wongo s, welcome to wongo's, any act]
sources: [slaythespire2.net]
---

# Welcome to Wongo's

**Pool:** Any act  
**Pages:** 5

## What the screen says

"Welcome to Wongo's. We have what you want at Wongtastic prices." says the
least enthusiastic clerk you have ever met.

"Peruse our wares and enjoy your time at Wongo's," they continue, without even
looking up.

## Options — page `INITIAL`

| Option | Exact outcome | Then |
|---|---|---|
| **[Wongo's Bargain Bin]** | Lose 100 Gold; Obtain **a relic** (random Common shop-eligible relic); other (earn 32 Wongo Points; grants WongoCustomerAppreciationBadge relic when total reaches 2000) — screen text: "Pay 100 **Gold**. Obtain 1 random **Common Relic**." | AFTER_BUY |
| **[Locked]** | Requires 100 **Gold**. | ends |
| **[Wongo's Featured Item]** | Lose 200 Gold; Obtain **a relic** (the featured item: a random Rare shop-eligible relic (RandomRelic)); other (earn 16 Wongo Points; grants WongoCustomerAppreciationBadge when total reaches 2000) — screen text: "Pay 200 **Gold**. Obtain **Wongo's Mystery Ticket**." | AFTER_BUY |
| **[Locked]** | Requires 200 **Gold**. | ends |
| **[Wongo's Mystery Box]** | Lose 300 Gold; Obtain **a relic**; other (earn 8 Wongo Points; grants WongoCustomerAppreciationBadge when total reaches 2000) — screen text: "Pay 300 **Gold**. Obtain 3 random **Relics** after 5 combats." | AFTER_BUY |
| **[Locked]** | Requires 300 **Gold**. | ends |
| **[Leave]** | downgradeCard (downgrade one random upgraded card in your deck (if any)) — screen text: "Downgrade a random card." | LEAVE |

**Engine note:** Each purchase option is shown enabled only if you can afford it; otherwise its _LOCKED disabled variant is shown. After any purchase you go to AFTER_BUY, or AFTER_BUY_BADGE_COUNTER / AFTER_BUY_RECEIVE_BADGE depending on Wongo Points progress toward the 2000-point Wongo Customer Appreciation Badge.

## Options — page `AFTER_BUY`

"We are Wongo-wow'd by your generosity... Wonderful patron, you now have 0
**Wongo Points**. With just 0 more points, you will receive our exclusive
**Wongo Customer Appreciation Badge**. Have a Wongtastic day."  You have no
clue what they are talking about and vow to never return to a Wongo's.

This page presents no standard options. one of three post-purchase terminal pages; sibling variants AFTER_BUY_BADGE_COUNTER and AFTER_BUY_RECEIVE_BADGE are chosen based on Wongo Point progress

## Options — page `LEAVE`

"Um... excuse me you can't just leave without buying something at Wongo's,"
says the clerk with an irritated tone.  You have a heated debate over customer
choice and it leaves you mentally drained.

This page presents no standard options.

## Options — page `AFTER_BUY_BADGE_COUNTER`

"We are Wongo-wow'd by your generosity... Wonderful patron, you now have 0
**Wongo Points**. With just 0 more points, you will receive our exclusive
**Wongo Customer Appreciation Badge**. Have a Wongtastic day."  You have
already received 0 of these worthless badges. You vow to never return to a
Wongo's.

This page presents no standard options.

## Options — page `AFTER_BUY_RECEIVE_BADGE`

"We are Wongo-wow'd by your generosity... Wonderful patron, you now have 0
**Wongo Points**. Your points have earned you a **Wongo Customer Appreciation
Badge**." The clerk hands you a cheaply made badge. "Have a Wongtastic day."
You have now received 0 badges. You vow to never return to a Wongo's.

This page presents no standard options. shown when this purchase pushes Wongo Points past 2000; grants WongoCustomerAppreciationBadge

## Reading this

Every outcome above is what the option does, not what it is worth. Amounts that
the source publishes as a formula are given as the formula. Weigh them against
this run's HP, gold, deck and remaining route; nothing here says which to take.
