---
description: Act 2 Hive normal encounters — wiki fact reference for every published enemy, move, effect, and encounter grouping.
character: ironclad
act: 2
category: normal
ascension: a1
keys: [ironclad, act2, hive, normal, bowlbugs, bowlbug egg, bowlbug nectar, bowlbug rock, bowlbug silk, chomper, exoskeleton, hunter killer, louse progenitor, myte, ovicopter, parafright, slumbering beetle, spiny toad, the obscura, tough egg, tunneler, tender, hard to kill, imbalanced, burrowed]
sources: [slaythespire.wiki.gg]
---

# Act 2 — Hive normal encounters

This is a source-bounded reference to the Hive normal pool. HP and damage
values use the wiki's base and displayed ascension values; the live intent is
authoritative if the installed build differs. “A8” is the wiki's HP value at
Ascension 8 and “A9” is its damage value at Ascension 9 unless an entry says
otherwise. The first two Hive floors use a separate weaker encounter pool;
the [Hive](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Hive) page
defines that routing.

## Reading the entries

- Attack, Buff, Debuff, and Status labels describe the move's effect class;
  targets are stated where a move combines effects.
- A multi-hit value such as `3×2` is two separate damage instances. Effects
  that trigger per hit or per card are calculated from those instances.
- A pattern is an encounter rule, not a prediction for a different build or a
  replacement for the live intent.

## Roster

### Bowlbug (Rock) — 45–48 HP (A8: 46–49)

- Imbalanced — when its attack is fully blocked, it becomes Stunned.
- Headbutt (Attack) — 15 damage (A9: 16).
- Dizzy — Stunned and does nothing after Imbalanced triggers.
- Pattern: Headbutt; after a fully blocked Headbutt, Dizzy then Headbutt
  resumes.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Bowlbugs](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Bowlbugs).
- The wiki specifies that “fully blocked” means at least 1 Block and no HP
  loss. Reducing Headbutt's damage to 0 without Block does not trigger
  Imbalanced, and damage taken by Osty does not count as the player's Block.
- Effect reference: [Imbalanced](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Imbalanced).

### Bowlbug (Egg) — 21–22 HP (A8: 23–24)

- Bite (Attack · Block) — 7 damage (A9: 8), then gains 7 Block.
- Uses Bite repeatedly.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Bowlbugs](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Bowlbugs).
- Bowlbug (Egg) is a worker variant that appears with Bowlbug (Rock) in the
  Hive encounter definitions.

### Bowlbug (Nectar) — 35–38 HP (A8: 36–39)

- Thrash (Attack) — 3 damage.
- Buff (Buff) — gains 15 Strength.
- Pattern: Thrash, Buff, Thrash, then repeat from Thrash.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Bowlbugs](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Bowlbugs).
- The Strength is a self-buff and persists for later Thrash moves. The worker
  variant can appear beside Bowlbug (Rock) or in the Bowlbug encounter pool.

### Bowlbug (Silk) — 40–43 HP (A8: 41–44)

- Thrash (Attack) — 4×2 damage (A9: 5×2).
- Spin Web (Debuff) — applies 1 Weak to the player.
- Pattern: Spin Web, Thrash, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Bowlbugs](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Bowlbugs).
- The current wiki move is Spin Web; “Toxic Spit” is not the Bowlbug (Silk)
  move name. Weak changes the player's Attack damage for its duration.
- Effect reference: [Weak](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Weak).

### Chomper — 60–64 HP (A8: 63–67)

- Starts with 2 Artifact.
- Clamp (Attack) — 8×2 damage (A9: 9×2).
- Screech (Status) — shuffles 3 Dazed into the player's discard pile.
- Pattern: Clamp, Screech, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Chomper](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Chomper).
- Artifact negates the next debuff applied to Chomper and loses one stack
  when it does so. Dazed is an unplayable Ethereal Status card.
- Effect references: [Artifact](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Artifact)
  and [Dazed](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Dazed).

### Exoskeleton — 24–28 HP (A8: 26–30)

- Starts with Hard to Kill 9: all damage taken and HP lost is reduced to 9,
  capping each individual instance.
- Skitter (Attack) — 1×3 damage (A9: 1×4).
- Mandibles (Attack) — 8 damage (A9: 9).
- Enrage (Buff) — gains 2 Strength.
- Opening by group position: first Skitters, second uses Mandibles, third uses
  Enrage, and a fourth randomly chooses Skitter or Mandibles.
- After Skitter, the next move randomly chooses Skitter or Mandibles without
  repeating Skitter; after Mandibles it uses Enrage; after Enrage it randomly
  chooses Skitter or Mandibles.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Exoskeleton](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Exoskeleton).
- The page's Useful Cards section records that each hit is capped at 9, while
  Doom and End of Days' “kill enemies” effect bypass Hard to Kill. It also
  records that Thorns triggers on every enemy attack and multiple times on
  Skitter.
- Effect reference: [Hard to Kill](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Buffs).

### Hunter Killer — 121 HP (A8: 126)

- Tenderizing Goop (Debuff) — applies 1 Tender to the player.
- Bite (Attack) — 17 damage (A9: 19).
- Puncture (Attack) — 7×3 damage (A9: 8×3).
- Pattern: Tenderizing Goop first; afterward Bite or Puncture is selected at
  random, with Puncture twice as likely and Bite unable to repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Hunter Killer](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Hunter_Killer).
- Tender reduces Strength and Dexterity after all effects of the played card
  resolve, so the card's displayed Attack damage and Block use the pre-Tender
  values for that play. A card that plays other cards triggers Tender after
  each nested card and then after the outer card resolves.
- Effect references: [Strength](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Strength)
  and [Dexterity](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Dexterity).

### Louse Progenitor — 134–136 HP (A8: 138–141)

- Web Cannon (Attack · Debuff) — 9 damage (A9: 10), then applies 2 Frail.
- Curl and Grow (Buff · Block) — gains 14 Block and 5 Strength.
- Pounce (Attack) — 14 damage (A9: 16).
- Pattern: Web Cannon, Curl and Grow, Pounce, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Louse Progenitor](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Louse_Progenitor).
- Curl and Grow's Block and Strength are self-effects. Frail from Web Cannon
  reduces Block gained from the player's cards.
- Effect reference: [Frail](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Frail).

### Myte — 61–67 HP (A8: 64–69)

Two Mytes always appear together. One opens with Toxic Cornucopia and the
other opens with Suck; both then use the same fixed pattern offset from one
another.

- Toxic Cornucopia (Status) — adds 2 Toxic to the player's hand.
- Bite (Attack) — 13 damage (A9: 15).
- Suck (Attack · Buff) — 4 damage (A9: 6), then gains 2 Strength (A9: 3).
- Pattern after each opening: Toxic Cornucopia, Bite, Suck, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Myte](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Myte).
- Toxic is added to the player's hand by the move; it is not a direct
  discard-pile or draw-pile insertion. The wiki records that card effects that
  remove Status cards can affect Toxic without paying its normal cost.
- Effect reference: [Toxic](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Toxic).

### Ovicopter — 124–130 HP (A8: 126–132)

- Lay Eggs (Summon) — summons 3 Tough Eggs.
- Smash (Attack) — 16 damage (A9: 17).
- Tenderizer (Attack · Debuff) — 7 damage (A9: 8), then applies 2 Vulnerable
  to the player.
- Nutritional Paste (Buff) — gains 3 Strength (A9: 4).
- Pattern: Lay Eggs, Smash, Tenderizer; after Tenderizer it uses Lay Eggs when
  it has 3 or fewer living allies, otherwise Nutritional Paste, then returns
  to Smash and Tenderizer.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Ovicopter](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ovicopter).
- Tough Egg is a Minion. Its Hatch timer starts at 2 when summoned during the
  enemy turn and at 1 when summoned during the player's turn; Hatch transforms
  it into a Hatchling and removes negative effects other than Minion.
- The Ovicopter's ally count includes its living eggs or hatchlings when the
  post-Tenderizer branch is evaluated.
- Effect references: [Vulnerable](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Vulnerable)
  and [Minion](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Minion).

### Tough Egg — 14–18 HP (A8: 15–19)

Summoned by Ovicopter's Lay Eggs.

- Hatch (Summon) — when its Hatch timer expires, transforms into a Hatchling
  and removes all powers except Minion.
- Nibble (Attack) — 4 damage (A9: 5).
- It waits while its Hatch timer counts down.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Ovicopter](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ovicopter),
  which contains the Tough Egg and Hatchling subsections.
- Hatching removes negative status effects applied to the egg. As a Minion,
  the egg and its Hatchling abandon combat if the Ovicopter dies.

### Parafright — 21 HP

Summoned by The Obscura's Illusion.

- Slam (Attack) — 16 damage (A9: 17).
- Uses Slam repeatedly.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: The Obscura](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Obscura),
  which contains the Parafright subsection.
- Parafright is a Minion of The Obscura and abandons combat without its
  leader. The Obscura's own revival is separate from the Parafright's move.

### The Obscura — 123 HP (A8: 129)

- Illusion (Summon) — summons 1 Parafright.
- Piercing Gaze (Attack) — 10 damage (A9: 11).
- Wail (Buff) — all enemies gain 3 Strength.
- Hardening Strike (Attack · Block) — 6 damage (A9: 7), then gains 6 Block.
- Pattern: Illusion first, then randomly chooses Piercing Gaze, Wail, or
  Hardening Strike without repeating the same move. When The Obscura dies, it
  revives next turn at full HP.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: The Obscura](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Obscura).
- Wail buffs all living enemies, including the summoned Parafright. The
  revival belongs to The Obscura; Parafright's Minion status only controls its
  relationship to its leader.

### Slumbering Beetle — 86 HP (A8: 89)

- Starts with Plating 15 (A8: 18) and Slumber.
- Snore — does nothing while Slumber remains.
- Roll Out (Attack · Buff) — 16 damage (A9: 18), then gains 2 Strength
  (A9: 3).
- While it has Slumber, it uses Snore. Once Slumber wears off, it loses
  Plating and uses Roll Out every turn.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Slumbering Beetle](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Slumbering_Beetle).
- Slumber wears off after taking turns or losing HP 3 times. The wiki records
  both the turn counter and HP-loss trigger; the exact counter is visible on
  the live power.
- Effect references: [Slumber](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Slumber)
  and [Plating](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Plating).

### Spiny Toad — 116–119 HP (A8: 121–124)

- Protruding Spikes (Buff) — gains 5 Thorns.
- Spike Explosion (Attack · Buff) — 23 damage (A9: 25), then loses 5 Thorns.
- Tongue Lash (Attack) — 17 damage (A9: 19).
- Pattern: Protruding Spikes, Spike Explosion, Tongue Lash, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Spiny Toad](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Spiny_Toad).
- Thorns deals its listed damage whenever the Toad is hit by an Attack; Spike
  Explosion removes the five stacks it gained from Protruding Spikes.
- Effect reference: [Thorns](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Thorns).

### Tunneler — 87 HP (A8: 92)

- Bite (Attack) — 13 damage (A9: 15).
- Burrow (Buff · Block) — gains 32 Block and Burrowed.
- Attack from Below (Attack) — 23 damage (A9: 26).
- Emerging Strike — becomes Stunned and does nothing for the turn.
- Pattern: Bite, Burrow, then Attack from Below every turn. If Burrowed Block
  is fully broken, Emerging Strike occurs and the sequence restarts with Bite.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Tunneler](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Tunneler).
- Fully breaking the Burrowed Block is the trigger for Emerging Strike; partial
  Block loss does not restart the sequence. “Dizzy” is not the current move
  name for this state.
- Effect reference: [Burrowed](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Burrowed).

## Neutral calculations and adaptive reading

- Apply additive Strength to each hit before final rounding. This is relevant
  to Chomper's Clamp, Exoskeleton's Skitter, Spiny Toad's Thorns retaliation,
  and all other multi-hit intents in the pool.
- Separate per-card rules (Artifact, Tender), per-instance rules (Hard to
  Kill, Thorns), and threshold/counter rules (Imbalanced, Slumber, Burrowed).
  Their triggers are not interchangeable.
- The source pages may include beta content. When a page, the installed build,
  and a generated encounter disagree, record the disagreement and prefer the
  live intent for the current room.
