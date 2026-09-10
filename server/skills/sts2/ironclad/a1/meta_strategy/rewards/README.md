---
description: Source-linked combat reward facts, live-state card, gold and Potion selection rules, and which of the two Skip controls actually skips.
character: Ironclad
act: any
category: rewards
keys: [rewards, card reward, card pick, skip, decline, back, stuck, loop, gold, potion, relic, ancient]
sources:
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Map_Locations
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Potions
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension
---

# Rewards

The [STS2 Map Locations page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Map_Locations)
describes the standard reward structure. The live reward object, item text and
current Ascension are authoritative.

| Encounter | Wiki-described reward |
|---|---|
| Normal Monster | 10–20 Gold (8–15 with Poverty), a choice of 3 cards and sometimes a Potion. |
| Elite | 35–45 Gold (26–34 with Poverty), a choice of 3 cards with higher rare/uncommon odds, a random Relic and sometimes a Potion. |
| Act 1/2 Boss | 100 Gold (75 with Poverty), a choice of 3 Rare cards and sometimes a random Potion; the following floor is an Ancient floor. |
| Act 3 Boss | Run victory, according to the page's map-location description. |

Entering a new Act restores HP. The [Health page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Health)
describes HP as "replenished at Rest Sites, between acts, or with any number of
healing effects", and the Ascension page defines the only change to it: from
Ascension 2 the Ancients heal 80% of missing HP instead of all of it. The
observed value at Ascension 1 was 35/86 HP on leaving Act 1 and 86/86 at the
Ancient, a heal of every point that was missing. Compare the HP before the boss
rewards and after the Ancient screen to confirm the level in force.

That makes HP held above what the act's remaining fights require worth nothing
once its boss is won: it is refilled anyway. It stays fully live before that -
the hallway fights, the Elites and the boss itself are all fought at the HP you
actually have - so the constraint is surviving what is still in front of you,
not banking a reserve past the boss.

The reward page also links the [Cards mechanics](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards),
[Potions](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Potions) and
[Ascension](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension) references.

## Taking a reward

Read `rewards.items` and the current card/relic/Potion descriptions. A card
choice is a comparison between adding that card and skipping it; calculate the
effect against the current deck, route, resource state and visible threats. A
random generated card, upgrade, transform or Potion result is unknown until the
screen shows it. Gold and Relics have their live item identity and effect.

Use the card-selection contract in [CONTROLS.md](../controls/CONTROLS.md) for a
choice screen. After collecting one row, re-read focus and the remaining rows.
Offers, selected cards, prices, floors and outcomes from one seed belong in the
scratchpad and do not form a durable lesson.

## Two controls are labelled `Skip`, and only one of them skips

The card screen and the reward list each draw a control called `Skip`. They are
different controls with opposite meanings, and confusing them cost one run 363
inputs and 86 minutes.

- On the **reward list**, Skip is a `NProceedButton` bound to `y`, and it
  resolves the list: the list closes and the run moves on to the map. It is
  also the only way to leave the list, so leaving with a row still unclaimed
  means leaving without it - the one run that did so kept its deck unchanged.
- On the **card screen**, Skip is an `NCardRewardAlternativeButton` bound to `b`,
  and its hotkeys are `ui_cancel` and `mega_pause_and_back`. It is a **Back**:
  it puts the screen away and returns you to the list **without deciding
  anything**. The row is still there and opening it offers the same three cards.

The asymmetry is not visible in the state at all: both are labelled `Skip`, and
`can_skip` is reported only by the card screen (`true`, all 285 times it was
seen) - the reward list reports `can_proceed` and never mentions skipping. So
neither field tells you which Skip you are looking at, and only the element and
its binding do. Across every recorded run `b` was pressed on the card screen
212 times and the reward survived all 212. On the run that stalled, the same
three cards - Ashen Strike, Setup Strike, Thunderclap - came back six times in a
row and were taken on the seventh visit, when the row did finally disappear and
the deck grew by one. While the card screen is open its `y` Skip is drawn but
**disabled**; `y` only works from the list.

So the loop, and how to not be in it: open the row, read the three cards, press
`b` meaning "decline", see the row still there, open it again. It never
resolves, because `b` never decided anything. Two rules:

- **Decide on the card screen, acting there.** Take a card by activating it, or
  leave with `b` - but understand `b` has decided nothing, so do not reopen the
  row expecting a different offer. The offer is fixed until a card is taken.
- **To actually decline, press `y` on the reward list.** The list is the screen
  that resolves the reward, and leaving it with the row unclaimed is a decline
  in one press. Returning to the card screen for a second look is not.

Reopening a row you have already read tells you nothing new: the same three
cards come back. If you cannot choose between them, take the least-bad one.

## Ancient floors

The [Ancients page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ancients)
and live Ancient screen define its options, costs and outcomes. Do not infer an
Ancient's result from its name or from another act. The arrival at an Ancient
floor is the act transition, which is the point HP is restored - see the note
on entering a new Act above. At Ascension 2 and above the
[Ascension page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension)
defines the Weary Traveler change to that heal.
