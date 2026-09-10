---
description: Act 1 Underdocks bosses — wiki fact reference for every published boss, phase, move, effect, and encounter interaction.
character: ironclad
act: 1
category: boss
ascension: a1
keys: [ironclad, act1, boss, underdocks, lagavulin matriarch, soul fysh, waterfall giant, steam eruption, intangible, soul siphon, plating, asleep, beckon, explode]
sources: [slaythespire.wiki.gg]
---

# Act 1 — Underdocks bosses

This is a source-bounded reference to the Underdocks boss pool. HP and damage
values use the wiki's base and displayed ascension values; the live intent is
authoritative if the installed build differs. “A8” is the wiki's HP value at
Ascension 8 and “A9” is its damage value at Ascension 9 unless an entry says
otherwise.

## Reading the entries

- Attack, Buff, Debuff, and Status labels describe the move's effect class;
  targets are stated where a move affects the player or another enemy.
- A multi-hit value such as `3×2` is two separate damage instances.
- Phase, threshold, and death-sequence text describes a state transition. Read
  the live intent and current power stacks when the transition occurs.

## Roster

### Lagavulin Matriarch — 222 HP (A8: 233)

#### Opening state

- Asleep — does nothing for 3 turns or until it takes unblocked damage,
  whichever occurs first.
- Plating 12 — grants Block at the end of the player's turn and loses 1 stack
  at the start of the player's turn. It is lost when the Matriarch wakes.

#### Awake pattern

- Slash (Attack) — 19 damage (A9: 21).
- Disembowel (Attack) — 9×2 damage (A9: 10×2).
- Slash2 (Attack · Block) — 12 damage (A9: 14), then gains 12 Block (A9: 14).
- Soul Siphon (Buff · Debuff) — removes 2 Strength and 2 Dexterity from the
  player and gains 2 Strength.
- Pattern after waking: Slash, Disembowel, Slash2, Soul Siphon, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Lagavulin Matriarch](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Lagavulin_Matriarch).
- The opening Asleep state ends on any unblocked damage or after three turns;
  the wiki records that the opening turns are a setup window and that Plating
  is removed on wake.
- Soul Siphon permanently reduces the player's Strength and Dexterity by 2
  each time it is used. The wiki's interaction note distinguishes per-instance
  damage or Block effects from single-instance effects under this reduction.
- Effect references: [Asleep](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Asleep),
  [Plating](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Plating), and
  [Soul Siphon](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Soul_Siphon).

### Soul Fysh — 211 HP (A8: 221)

- Beckon (Status) — shuffles 2 Beckon into the player's deck: 1 into the draw
  pile and 1 into the discard pile.
- De-Gas (Attack) — 16 damage (A9: 18).
- Gaze (Attack · Status) — 7 damage (A9: 8), then shuffles 1 Beckon into the
  player's discard pile.
- Fade (Buff) — gains 2 Intangible.
- Scream (Attack · Debuff) — 13 damage (A9: 15), then applies 3 Vulnerable to
  the player.
- Pattern: Beckon, De-Gas, Gaze, Fade, Scream, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Soul Fysh](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Soul_Fysh).
- Beckon is a card in the player's deck. A Beckon remaining in hand at the
  end of the player's turn costs 6 HP; the exact card text controls whether a
  discard, Exhaust, or Transform removes it.
- The first stack of Fade's Intangible expires during the transition from the
  Fysh's turn, so the wiki records that the move effectively provides 1
  Intangible to the following player turn. Doom damage is not reduced by
  Intangible.
- Effect references: [Beckon](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Beckon),
  [Intangible](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Intangible), and
  [Vulnerable](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Vulnerable).

### Waterfall Giant — 240 HP (A8: 250)

#### Opening and repeating pattern

- Pressurize (Buff) — gains 15 Steam Eruption.
- Stomp (Attack · Debuff) — 15 damage (A9: 16), applies 1 Weak, and gains 3
  Steam Eruption.
- Ram (Attack) — 10 damage (A9: 11), then gains 3 Steam Eruption.
- Siphon (Buff · Heal) — heals 10 HP per player, then gains 3 Steam Eruption.
- Pressure Gun (Attack) — 20 damage (A9: 23), increasing by 5 each use, then
  gains 3 Steam Eruption.
- Pressure Up (Attack) — 13 damage (A9: 14), then gains 3 Steam Eruption.
- Pattern: Pressurize first; then Stomp, Ram, Siphon, Pressure Gun, Pressure
  Up, and repeat from Stomp.

#### Death sequence

- About To Blow — becomes invulnerable, removes Steam Eruption, and prepares
  the next move.
- Explode — deals damage equal to the stored Steam Eruption amount, then dies.
- If it is killed while it has no Steam Eruption, it dies normally without the
  About To Blow / Explode sequence.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Waterfall Giant](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Waterfall_Giant).
- Steam Eruption is an accumulated death trigger: the stored amount is the
  damage of Explode. The wiki records that About To Blow removes the stack and
  makes the Giant invulnerable before Explode.
- The wiki lists cards and relic effects that remove or hold Block as relevant
  to the final Explode turn, and records that Anger can increase the number of
  Attack cards in the deck. These are interaction facts, not a fixed deck
  prescription.
- Effect references: [Steam Eruption](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Steam_Eruption),
  [About To Blow](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:About_To_Blow), and
  [Explode](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Explode).

## Neutral calculations and adaptive reading

- Soul Siphon is a permanent player-stat reduction, while Plating and Steam
  Eruption are separate Block and death-trigger systems. Track their stacks
  independently.
- Intangible reduces damage and HP loss to 1; the first Fade stack expires at
  the turn transition documented above. Steam Eruption damage is an Explode
  effect and must be evaluated from its current stored amount.
- The source pages may include beta content. When a page, the installed build,
  and a generated encounter disagree, record the disagreement and prefer the
  live intent for the current room.
