---
description: Act 1 Underdocks normal encounters — wiki fact reference for every published enemy, move, effect, and encounter grouping.
character: ironclad
act: 1
category: normal
ascension: a1
keys: [ironclad, act1, normal, underdocks, living fog, gas bomb, calcified cultist, damp cultist, seapunk, corpse slug, two-tailed rat, punch construct, haunted ship, sewer clam, gremlin merc, fat gremlin, sneaky gremlin, fossil stalker, toadpole, sludge spinner, thievery, ravenous, artifact, smoggy]
sources: [slaythespire.wiki.gg]
---

# Act 1 — Underdocks normal encounters

This is a source-bounded reference to the Underdocks normal pool. HP and
damage values use the wiki's base and displayed ascension values; the live
intent is authoritative if the installed build differs. “A8” is the wiki's
HP value at Ascension 8 and “A9” is its damage value at Ascension 9 unless an
entry says otherwise. “Appears with” describes a published encounter group,
not a guarantee that every listed companion is present together.

## Reading the entries

- Attack effects damage the player; Buff effects usually affect the enemy;
  Debuff and Status effects usually affect the player. The target is stated
  where a move combines effects.
- A move marked “random” is a published selection rule. Read the current
  `battle.enemies[].intents` for the actual roll.
- A multi-hit value such as `3×2` means two separate damage instances. Effects
  that trigger per hit, such as Suck or Thorns, use those instances separately.

## Roster

### Living Fog — 80 HP (A8: 82)

- Advanced Gas (Attack · Debuff) — 8 damage (A9: 9), then applies 1 Smoggy.
- Bloat (Attack · Summon) — 5 damage (A9: 6), then summons 1 Gas Bomb.
- Super Gas Blast (Attack) — 8 damage (A9: 9).
- Pattern: Advanced Gas first, then Bloat and Super Gas Blast alternate.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Living Fog](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Living_Fog).
- Smoggy does not stack and limits the player to 1 Skill per turn.
- Gas Bomb is a Minion summoned by Bloat. [Gas Bomb](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Gas_Bomb)
  has 7 HP (A8: 8), uses Explode for 8 damage (A9: 9), then dies. Minions
  abandon combat without their leader.
- Effect references: [Smoggy](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Smoggy)
  and [Minion](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Minion).

### Calcified Cultist — 38–41 HP (A8: 39–42)

Appears with Damp Cultist in the Cultists encounter and with Seapunk in the
published Underdocks group.

- Incantation (Buff) — gains 2 Ritual.
- Dark Strike (Attack) — 9 damage (A9: 11), every turn after Incantation.
- Pattern: Incantation, then Dark Strike repeatedly.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Cultists](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Calcified_Cultist)
  (the Calcified and Damp subsections share this page).
- The wiki records that the Cultists do not gain Strength on the turn they use
  Incantation; Ritual's later end-of-turn gain begins after that opening move.
- Effect reference: [Ritual](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ritual).

### Damp Cultist — 51–53 HP (A8: 52–54)

Appears with Calcified Cultist.

- Incantation (Buff) — gains 5 Ritual (A9: 6).
- Dark Strike (Attack) — 1 damage (A9: 3), every turn after Incantation.
- Pattern: Incantation, then Dark Strike repeatedly.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Cultists](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Damp_Cultist).
- Both Cultists skip their first Ritual gain on the Incantation turn; later
  Dark Strikes use the Strength accumulated at the end of earlier turns.
- Effect reference: [Ritual](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ritual).

### Seapunk — 44–46 HP (A8: 47–49)

Appears in Underdocks normal groups, including a group with Calcified Cultist.

- Sea Kick (Attack) — 11 damage (A9: 13).
- Spinning Kick (Attack) — 2×4 damage.
- Bubble Burp (Buff) — gains 7 Block (A9: 8) and 1 Strength (A9: 2).
- Pattern: Sea Kick, Spinning Kick, Bubble Burp, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Seapunk](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Seapunk).
- Bubble Burp's Strength carries into later attacks. Its fixed cycle is why
  later Sea Kick and Spinning Kick values can exceed their base move values.

### Corpse Slug — 25–27 HP (A8: 27–29)

Two or three Corpse Slugs appear together, each starting at a different point
of the same cycle.

- Whip Slap (Attack) — 3×2 damage.
- Glomp (Attack) — 8 damage (A9: 9).
- Goop (Debuff) — applies 2 Frail to the player.
- Pattern: Whip Slap, Glomp, Goop, then repeat.
- Starts with Ravenous 4 (A9: 5): when an enemy dies, it immediately eats it,
  becomes Stunned, and gains the listed Strength.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Corpse Slug](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Corpse_Slug).
- The wiki specifies that the individual slugs are staggered, so their moves
  are not synchronized even though their cycles match.
- Effect references: [Ravenous](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ravenous)
  and [Frail](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Frail).

### Two-Tailed Rat — 17–21 HP (A8: 18–22)

Three appear together.

- Scratch (Attack) — 8 damage (A9: 9).
- Disease Bite (Attack) — 6 damage (A9: 7).
- Screech (Debuff) — applies 1 Frail to the player.
- Call for Backup (Summon) — summons a new Two-Tailed Rat.
- Opening: one rat starts on Scratch, one on Disease Bite, and one on
  Screech. Later turns choose Scratch, Disease Bite, or Screech at random and
  cannot repeat the same move.
- After at least two turns, a rat may use Call for Backup. Each rat can call
  at most once and the group can summon at most three times.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Two-Tailed Rat](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Two-Tailed_Rat).
- The opening offsets and the delayed, capped summon rule are part of the
  encounter definition; a four-way random move on turn one is inaccurate.

### Punch Construct — 55 HP (A8: 60)

Appears in Underdocks and Glory, and starts with 1 Artifact.

- READY (Block) — gains 10 Block.
- Fast Punch (Attack · Debuff) — 5×2 damage (A9: 6×2), then applies 1 Frail
  to the player.
- Strong Punch (Attack) — 14 damage (A9: 16).
- Pattern: READY, Fast Punch, Strong Punch, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Punch Construct](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Punch_Construct).
- Artifact starts at 1 and negates the next debuff applied to the construct.
  The wiki's update history records the current Fast Punch → Strong Punch
  order and Frail application.
- Effect reference: [Artifact](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Artifact).

### Haunted Ship — 63 HP (A8: 67)

- Haunt (Debuff · Status) — applies 3 Weak to the player and shuffles 5 Dazed
  into the player's discard pile.
- Swipe (Attack) — 13 damage (A9: 14).
- Stomp (Attack) — 4×3 damage (A9: 5×3).
- Pattern: Haunt, then Swipe and Stomp alternate, beginning with Swipe.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Haunted Ship](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Haunted_Ship).
- The Dazed cards are placed in the discard pile, and Weak is applied on the
  opening Haunt. Dazed is unplayable and Ethereal.
- Effect references: [Weak](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Weak)
  and [Dazed](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Dazed).

### Sewer Clam — 56 HP (A8: 58)

- Starts with Plating 8 (A8: 9). Plating grants Block at the end of the
  player's turn and loses 1 stack at the start of the player's turn.
- Jet (Attack) — 10 damage (A9: 11).
- Pressurize (Buff) — gains 4 Strength.
- Pattern: Jet first, then Pressurize and Jet alternate.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Sewer Clam](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Sewer_Clam).
- The wiki notes that the coral grows each time Pressurize is used; the
  Strength remains on the Clam for later Jet attacks.
- Effect reference: [Plating](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Plating).

### Gremlin Merc — 47–49 HP (A8: 51–53)

- Thievery 20 — steals 20 Gold whenever it attacks.
- Surprise — on death, summons a Fat Gremlin and a Sneaky Gremlin.
- Gimme (Attack) — 7×2 damage (A8: 8×2).
- Double Smash (Attack · Debuff) — 6×2 damage (A8: 7×2), then applies 2 Weak.
- Hehe (Attack · Buff) — 8 damage (A8: 9), then gains 2 Strength.
- Pattern: Gimme, Double Smash, Hehe, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Gremlin Merc](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Gremlin_Merc).
- The wiki identifies Gremlin Merc as the only enemy whose attack damage
  increases at Ascension 8 rather than Ascension 9.
- Fat Gremlin and Sneaky Gremlin are summoned minions documented on the same
  page. Fat Gremlin wakes, then Flees with the stolen Gold and deals no damage;
  its Heist returns the stolen Gold if it is killed. Sneaky Gremlin wakes, then
  uses Tackle for 9 damage (A9: 10) every turn.
- Effect references: [Thievery](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Thievery),
  [Heist](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Heist), and
  [Minion](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Minion).

### Fat Gremlin — 13–17 HP (A8: 14–18)

Summoned by Gremlin Merc's Surprise.

- Spawned — wakes up and does nothing.
- Flee — leaves combat with the stolen Gold.
- Heist — when killed, returns all Gold stolen by Gremlin Merc.
- It has no damaging move.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Gremlin Merc](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Gremlin_Merc),
  which contains the Fat Gremlin subsection.
- The wiki lists Fat Gremlin among the enemies incapable of causing damage.
  [Heist](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Heist) defines
  the Gold-return trigger.

### Sneaky Gremlin — 10–14 HP (A8: 11–15)

Summoned by Gremlin Merc's Surprise.

- Spawned — wakes up and does nothing.
- Tackle (Attack) — 9 damage (A9: 10), every turn after Spawned.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Gremlin Merc](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Gremlin_Merc),
  which contains the Sneaky Gremlin subsection.
- Sneaky Gremlin is a minion of Gremlin Merc and abandons combat without its
  leader under the Minion rule.

### Fossil Stalker — 51–53 HP (A8: 54–56)

- Starts with Suck 3: each time an attack deals unblocked damage, gains 3
  Strength.
- Latch (Attack) — 12 damage (A9: 14).
- Tackle (Attack · Debuff) — 9 damage (A9: 11), then applies 1 Frail.
- Lash (Attack) — 3×2 damage (A9: 4×2).
- Pattern: always starts with Latch. After every move, chooses Latch, Tackle,
  or Lash with equal probability; it can repeat the same move.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Fossil Stalker](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Fossil_Stalker).
- Suck is triggered by unblocked attack damage, including an unblocked part of
  a multi-hit attack. The page explicitly gives no no-repeat restriction.
- Effect reference: [Frail](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Frail).

### Toadpole — 21–25 HP (A8: 22–26)

- Thorns 2 — when hit by an Attack, deals 2 damage back (value may vary by
  encounter data).
- Whirl (Attack) — 7 damage (A9: 8).
- Spiken (Buff) — gains 2 Thorns.
- Spike Spit (Attack · Buff) — 3×3 damage (A9: 4×3), then loses 2 Thorns.
- Pattern: Whirl, Spiken, Spike Spit, then repeat. In the Toadpoles (Weak)
  encounter, the front Toadpole starts on Spiken.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Toadpole](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Toadpole).
- Thorns triggers when the Toadpole is hit by an Attack; Spike Spit removes
  its two self-gained Thorns after dealing its damage.
- Effect reference: [Thorns](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Thorns).

### Sludge Spinner — 37–39 HP (A8: 41–42)

- Oil Spray (Attack · Debuff) — 8 damage (A9: 9), then applies 1 Weak.
- Slam (Attack) — 11 damage (A9: 12).
- Rage (Attack · Buff) — 6 damage (A9: 7), then gains 3 Strength.
- Pattern: Oil Spray first. Each later turn randomly chooses Oil Spray, Slam,
  or Rage, with no consecutive repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Sludge Spinner](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Sludge_Spinner).
- Rage is an attack and a Strength gain in the same move; later damage uses
  the accumulated Strength. Oil Spray's Weak affects Attack damage from the
  player for its duration.
- Effect reference: [Weak](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Weak).

## Neutral calculations and adaptive reading

- For a multi-hit intent, calculate each hit separately before final rounding.
  This matters for Thorns, Suck, Weak, and the eight hits in Unleash the
  Hounds (in the Overgrowth Raider pool).
- A Status card shuffled into the discard pile can still be drawn after the
  deck reshuffles; the exact card text controls whether it is playable,
  Ethereal, or unplayable.
- The source pages may include beta content. When a page, the installed build,
  and a generated encounter disagree, record the disagreement and prefer the
  live intent for the current room.
