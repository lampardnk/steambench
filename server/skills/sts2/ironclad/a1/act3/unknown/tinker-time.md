---
description: Tinker Time — Act 3. Exact outcomes for every option, with the trade-offs left open.
character: ironclad
act: 3
category: unknown
ascension: a1
keys: [ironclad, unknown, event, tinker time, act 3]
sources: [slaythespire2.net]
---

# Tinker Time

**Pool:** Act 3  
**Pages:** 4

## What the screen says

Navigating through an endless sea of corpses, you find a mad scientist
scavenging for various scraps.

"Yes. Hi, hello! You look like a capable fighter... I need a tester for my
next atrocity device! How about it?"

## Options — page `INITIAL`

| Option | Exact outcome | Then |
|---|---|---|
| **[Accept]** | Create a custom card to add to your **Deck**. | CHOOSE_CARD_TYPE |

## Options — page `CHOOSE_CARD_TYPE`

"What kind of tool will help you kill everyone?"

| Option | Exact outcome | Then |
|---|---|---|
| **[Weapon]** | other (set MadScience card type = Attack) — screen text: "Make an Attack." | CHOOSE_RIDER |
| **[Protector]** | other (set MadScience card type = Skill) — screen text: "Make a Skill." | CHOOSE_RIDER |
| **[Gadget]** | other (set MadScience card type = Power) — screen text: "Make a Power." | CHOOSE_RIDER |

**Engine note:** shows 2 of the 3 type options at random

## Options — page `CHOOSE_RIDER`

"Excellent choice! Now what should it DO?" The scientist rubs her hands
together with glee.

| Option | Exact outcome | Then |
|---|---|---|
| **[Sapping]** | Add **Mad Science** (MadScience with Sapping rider (applies Weak/Vulnerable)) — screen text: "Apply 2 **Weak**. Apply 2 **Vulnerable**." | DONE |
| **[Violence]** | Add **Mad Science** (MadScience with Violence rider (3 hits)) — screen text: "Hits 2 additional times." | DONE |
| **[Choking]** | Add **Mad Science** (MadScience with Choking rider (Strangle)) — screen text: "Whenever you play a card this turn, the enemy loses 6 HP." | DONE |
| **[Energized]** | Add **Mad Science** (MadScience with Energized rider (+2 energy)) — screen text: "Gain <e>2</e>." | DONE |
| **[Wisdom]** | Add **Mad Science** (MadScience with Wisdom rider (draw 3)) — screen text: "Draw 3 cards." | DONE |
| **[Chaos]** | Add **Mad Science** (MadScience with Chaos rider) — screen text: "Add a random card into your **Hand**. It's free to play this turn." | DONE |
| **[Expertise]** | Add **Mad Science** (MadScience with Expertise rider (Strength/Dexterity)) — screen text: "Gain 2 **Strength**. Gain 2 **Dexterity**." | DONE |
| **[Curious]** | Add **Mad Science** (MadScience with Curious rider (cost reduction 1)) — screen text: "Powers cost 1 <e/> less." | DONE |
| **[Improvement]** | Add **Mad Science** (MadScience with Improvement rider) — screen text: "At the end of combat, **Upgrade** a random card." | DONE |

**Engine note:** shows 2 of the available riders at random (rider pool depends on chosen card type). Each option finalizes the MadScience card with the chosen type + rider and adds it to the deck.

## Options — page `DONE`

"Whew! All done. This is for you! Now get out there and slaughter!!"  Little
did you know, that scientist went on to create hundreds of weapons, resulting
in several thousand deaths within the Spire.

This page presents no standard options.

## Reading this

Every outcome above is what the option does, not what it is worth. Amounts that
the source publishes as a formula are given as the formula. Weigh them against
this run's HP, gold, deck and remaining route; nothing here says which to take.
