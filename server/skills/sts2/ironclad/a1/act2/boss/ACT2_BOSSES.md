---
description: Act 2 Hive bosses — wiki fact reference for every published boss, move, effect, phase, and encounter interaction.
character: ironclad
act: 2
category: boss
ascension: a1
keys: [ironclad, act2, hive, boss, kaiser crab, crusher, rocket, surrounded, knowledge demon, curse of knowledge, disintegration, mind rot, sloth, waste away, the insatiable, sandpit, frantic escape]
sources: [slaythespire.wiki.gg]
---

# Act 2 — Hive bosses

This is a source-bounded reference to the Hive boss pool. HP and damage values
use the wiki's base and displayed ascension values; the live intent is
authoritative if the installed build differs. “A8” is the wiki's HP value at
Ascension 8 and “A9” is its damage value at Ascension 9 unless an entry says
otherwise.

## Reading the entries

- Attack, Buff, Debuff, and Status labels describe the move's effect class;
  targets are stated where a move combines effects.
- A multi-hit value such as `8×3` is three separate damage instances.
- A pattern or choice set is an encounter rule. Read the live intent and
  current powers when a branch or counter changes.

## Roster

### Kaiser Crab — Crusher (209 HP, A8: 219) and Rocket (199 HP, A8: 209)

The Kaiser Crab is a two-enemy boss encounter. Crusher is the left claw and
Rocket is the right claw.

#### Shared state

- While both claws are alive, the player has Surrounded. A card or potion that
  targets one claw turns the player toward that claw; attacks from the claw
  the player faces away from deal 50% more final damage.
- When either claw dies, the surviving claw gains 6 Strength and 99 Block.

#### Crusher

- Thrash (Attack) — 12 damage (A9: 14).
- Enlarging Strike (Attack) — 4 damage.
- Bug Sting (Attack · Debuff) — 6×2 damage (A9: 7×2), then applies 2 Weak and
  2 Frail to the player.
- Adapt (Buff) — gains 2 Strength (A9: 3).
- Guarded Strike (Attack · Block) — 12 damage (A9: 14), then gains 18 Block.
- Pattern: Thrash, Enlarging Strike, Bug Sting, Adapt, Guarded Strike, then
  repeat.

#### Rocket

- Targeting Reticle (Attack) — 3 damage (A9: 4).
- Precision Beam (Attack) — 18 damage (A9: 20).
- Charge Up (Buff) — gains 2 Strength (A9: 3).
- Laser (Attack) — 31 damage (A9: 35).
- Recharge — does nothing.
- Pattern: Targeting Reticle, Precision Beam, Charge Up, Laser, Recharge, then
  repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Kaiser Crab](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Kaiser_Crab).
- The wiki records that a single-target Attack or Skill played by another card
  or effect can target a random claw, changing the player's facing; an
  all-enemy or random-target effect does not turn the player. A single-target
  potion also turns the player toward its target.
- Surrounded increases the final damage from the claw the player faces away
  from; it is separate from Weak and Vulnerable.
- Effect reference: [Surrounded](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Surrounded).

### Knowledge Demon — 379 HP (A8: 399)

- Curse of Knowledge (Debuff) — presents one of two debuffs for the player to
  choose. The selected card is shown as an option, is immediately played, and
  is removed; it is not added to the hand or deck.
- Set 1: Disintegration (6 damage at end of turn) or Mind Rot (draw 1 fewer
  card each turn).
- Set 2: Disintegration (7 damage at end of turn) or Sloth (cannot play more
  than 3 cards each turn).
- Set 3: Disintegration (8 damage at end of turn) or Waste Away (gain 1 less
  Energy per turn).
- Slap (Attack) — 17 damage (A9: 18).
- Knowledge Overwhelming (Attack) — 8×3 damage (A9: 9×3).
- Ponder (Attack · Buff · Heal) — 11 damage (A9: 13), heals 30 HP per player,
  and gains 2 Strength (A9: 3).
- Pattern before three Curse of Knowledge uses: Curse of Knowledge, Slap,
  Knowledge Overwhelming, Ponder. After all three sets have been offered, the
  Curse move is skipped and Slap, Knowledge Overwhelming, Ponder repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Knowledge Demon](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Knowledge_Demon).
- Curse of Knowledge options are temporary selection cards, not ordinary
  cards in the player's deck. The wiki records the three pairings above and
  that each set is offered once before the shorter cycle begins.
- Ponder's Heal and Strength are separate self-effects from its 11/13 attack;
  the Heal is 30 HP per player.
- Effect references: [Disintegration](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Disintegration),
  [Mind Rot](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Mind_Rot),
  [Sloth](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Sloth), and
  [Waste Away](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Waste_Away).

### The Insatiable — 321 HP (A8: 341)

- Liquify Ground (Buff · Status) — gains 4 Sandpit, counted separately for
  each player, and shuffles 6 Frantic Escape into each player's deck: 3 into
  the draw pile and 3 into the discard pile.
- Thrash (Attack) — 8×2 damage (A9: 9×2).
- Lunging Bite (Attack) — 28 damage (A9: 31).
- Salivate (Buff) — gains 2 Strength (A9: 3).
- Pattern: Liquify Ground, Thrash, Lunging Bite, Salivate, Thrash, then repeat
  from the first Thrash.

#### Sandpit and Frantic Escape

- Sandpit is a Duration: in X turns the player is eaten and dies when the
  counter reaches 0. Fairy in a Bottle does not prevent this death.
- Frantic Escape is a 1-cost Colorless Common Status card. It says: “Get
  farther away. Increase Sandpit by 1. Increase the cost of this card by 1.”

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: The Insatiable](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Insatiable).
- [Frantic Escape](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Frantic_Escape)
  documents the six-card creation split, the increasing cost on successive
  plays, and its Status-card interactions with Compact, Iteration, Flak
  Cannon, Rocket Punch, and Touch of Insanity.
- The wiki explicitly notes that exhausting or transforming Frantic Escape is
  not always beneficial because those cards supply the Sandpit extension.
- The Insatiable's Sandpit is counted separately for each player in multiplayer.
- Effect reference: [Sandpit](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Sandpit).

## Neutral calculations and adaptive reading

- Kaiser Crab's Surrounded modifier is applied to the claw the player faces
  away from; targeting and facing are part of the damage calculation.
- Knowledge Demon presents three one-time choice sets before its three-move
  cycle repeats. The Insatiable's Sandpit is a death timer extended by cards,
  while its Strength is a separate combat stat.
- The source pages may include beta content. When a page, the installed build,
  and a generated encounter disagree, record the disagreement and prefer the
  live intent for the current room.
