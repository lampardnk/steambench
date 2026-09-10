---
description: Act 1 Overgrowth bosses — wiki fact reference for every published boss, phase, move, effect, and encounter interaction.
character: ironclad
act: 1
category: boss
ascension: a1
keys: [ironclad, act1, boss, overgrowth, ceremonial beast, the kin, kin priest, kin follower, vantom, plow, ringing, wound, slippery, counter, minion]
sources: [slaythespire.wiki.gg]
---

# Act 1 — Overgrowth bosses

This is a source-bounded reference to the Overgrowth boss pool. HP and damage
values use the wiki's base and displayed ascension values; the live intent is
authoritative if the installed build differs. “A8” is the wiki's HP value at
Ascension 8 and “A9” is its damage value at Ascension 9 unless an entry says
otherwise.

## Reading the entries

- Attack, Buff, Debuff, and Status labels describe the move's effect class;
  targets are stated where a move affects the player or another enemy.
- A multi-hit value such as `3×3` is three separate damage instances.
- Phase or threshold text describes a game state transition. Read the live
  intent and power stacks when the transition occurs.

## Roster

### Ceremonial Beast — 252 HP (A8: 262)

#### Phase 1

- Stamp (Buff) — gains Plow 150 (A9: 160).
- Plow (Attack · Buff) — 18 damage (A9: 20), then gains 2 Strength.
- Uses Plow every turn after Stamp. The first time its HP reaches the Plow
  threshold, it becomes Stunned and loses all of its Strength.

#### Phase 2

- Stun — does nothing after the threshold transition.
- Beast Cry (Debuff) — applies 1 Ringing to the player.
- Stomp (Attack) — 15 damage (A9: 17).
- Crush (Attack · Buff) — 17 damage (A9: 19), then gains 3 Strength (A9: 4).
- Pattern after Stun: Beast Cry, Stomp, Crush, then repeat from Beast Cry.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Ceremonial Beast](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ceremonial_Beast).
- The Plow value is an HP threshold. The wiki records that the Beast loses all
  accumulated Strength at the transition; Phase 2 Strength comes from Crush.
- Ringing limits the player to one card play for that turn. The wiki records
  that automatically played cards can consume that play, card-generating
  effects may fail to provide their normal value, and cards that apply effects
  on the next turn can still function without being extra card plays.
- Effect references: [Ringing](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ringing)
  and [Plow](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Plow).

### The Kin — Kin Priest (190 HP, A8: 199) and two Kin Followers (58–59 HP each, A8: 62–63)

The Kin is one boss encounter containing one Kin Priest and two Kin Followers.

#### Kin Priest

- Orb of Frailty (Attack · Debuff) — 8 damage (A9: 9), then applies 1 Frail.
- Orb of Weakness (Attack · Debuff) — 8 damage (A9: 9), then applies 1 Weak.
- Soul Beam (Attack) — 3×3 damage.
- Dark Ritual (Buff) — gains 2 Strength (A9: 3).
- Pattern: Orb of Frailty, Orb of Weakness, Soul Beam, Dark Ritual, then
  repeat.

#### Kin Follower (each)

- Quick Slash (Attack) — 5 damage.
- Boomerang (Attack) — 2×2 damage.
- Power Dance (Buff) — gains 2 Strength (A9: 3).
- Pattern: Quick Slash, Boomerang, Power Dance, then repeat. The two Followers
  start offset: one opens with Quick Slash and the other with Power Dance.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: The Kin](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Kin).
- The two Followers have the Minion rule and abandon combat without their
  leader, the Kin Priest. Each entity's Strength affects its own attacks.
- The wiki records that indirect damage and Block are unaffected by the
  player's Weak and Frail, while multi-hit attacks and damage to all enemies
  interact with all three entities separately.
- Effect references: [Weak](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Weak),
  [Frail](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Frail), and
  [Minion](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Minion).

### Vantom — 173 HP (A8: 183)

- Starts with Slippery 9.
- Ink Blot (Attack) — 7 damage (A9: 8).
- Inky Lance (Attack) — 6×2 damage (A9: 7×2).
- Dismember (Attack · Status) — 27 damage (A9: 30), then shuffles 3 Wound
  into the player's discard pile.
- Prepare (Buff) — gains 2 Strength.
- Pattern: Ink Blot, Inky Lance, Dismember, Prepare, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Vantom](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Vantom).
- Slippery is a Counter: the next X times Vantom loses HP, each instance
  removes only 1 HP instead and consumes one stack. The wiki's useful-card
  notes record that multi-hit attacks, Poison instances, and repeat damage
  effects remove multiple stacks over time; a single large hit still removes
  only one stack while the counter remains.
- Dismember places Wounds in the discard pile. Wound is a Status card and its
  exact text is a separate card rule; it is not a Strength or Slippery stack.
- Effect references: [Slippery](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Buffs)
  and [Wound](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Wound).

## Neutral calculations and adaptive reading

- Apply Strength and other additive modifiers to each hit before final
  rounding; multi-hit attacks therefore have a different relationship to
  Weak, Vulnerable, and Slippery than single-hit attacks.
- Ceremonial Beast's Strength is reset at the Plow threshold, while Vantom's
  Slippery counter is consumed by HP-loss instances. These are separate phase
  and counter rules.
- The source pages may include beta content. When a page, the installed build,
  and a generated encounter disagree, record the disagreement and prefer the
  live intent for the current room.
