---
description: Act 1 Overgrowth normal encounters — wiki fact reference for every published enemy, move, effect, and encounter grouping.
character: ironclad
act: 1
category: normal
ascension: a1
keys: [ironclad, act1, normal, overgrowth, cubex construct, fogmog, flyconid, snapping jaxfruit, fuzzy wurm crawler, shrinker beetle, slithering strangler, mawler, nibbit, vine shambler, eye with teeth, inklet, slimes, ruby raiders, wriggler, artifact, slow, slippery, shrink, constrict]
sources: [slaythespire.wiki.gg]
---

# Act 1 — Overgrowth normal encounters

This is a source-bounded reference to the Overgrowth normal pool. HP and
damage values use the wiki's base and displayed ascension values; the live
intent is authoritative if the installed build differs. “A8” is the wiki's
HP value at Ascension 8 and “A9” is its damage value at Ascension 9 unless an
entry says otherwise. “Appears with” describes published encounter groups,
not a guarantee that every listed companion is present together.

## Reading the entries

- Attack effects damage the player; Buff effects usually affect the enemy;
  Debuff and Status effects usually affect the player. The target is stated
  where a move combines effects.
- A move marked “random” is a published selection rule. Read the current
  `battle.enemies[].intents` for the actual roll.
- A multi-hit value such as `3×2` means two separate instances of 3 damage.
  Strength, Weak, Slippery, Thorns, and similar effects can therefore depend
  on the number of instances rather than only on the displayed total.

## Roster

### Cubex Construct — 65 HP (A8: 70)

Appears in Overgrowth and Glory. In Overgrowth it is a normal enemy.

- Charge Up (Buff) — gains 2 Strength.
- Repeater Blast (Attack · Buff) — 7 damage (A9: 8), then gains 2 Strength.
- Expel Blast (Attack) — 5×2 damage (A9: 6×2).
- Starts with 1 Artifact. Artifact negates the next debuff applied to the
  enemy and loses one stack when it does so.
- Pattern: Charge Up, Repeater Blast, Repeater Blast, Expel Blast; the three
  latter moves repeat after the opening Charge Up.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Cubex Construct](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cubex_Construct).
- The wiki records that Charge Up and each Repeater Blast grant 2 Strength,
  so the opening sequence has granted 6 Strength before Expel Blast. Expel
  Blast has two damage instances and therefore uses that Strength twice.
- Effect reference: [Artifact](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Artifact).

### Fogmog — 74 HP (A8: 78)

Appears with an Eye With Teeth summoned at the start of combat.

- Illusory Spores (Summon) — summons 1 Eye With Teeth.
- Thwack (Attack · Buff) — 8 damage (A9: 9), then gains 1 Strength.
- Headbutt (Attack) — 14 damage (A9: 16).
- Pattern: Illusory Spores, then a 40% Thwack / 60% Headbutt choice. After a
  Thwack it uses Headbutt; after Headbutt it uses Thwack, then returns to the
  weighted choice. It cannot choose the same move twice in the weighted step.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Fogmog](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Fogmog).
- Eye With Teeth is a minion. When it dies, its Illusion revives it next turn
  at full HP; killing the summon therefore does not end the summon cycle.
- [Eye With Teeth](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Eye_With_Teeth)
  shuffles 3 Dazed into the player's discard pile with Distract and is one of
  the game's enemies that cannot cause damage.

### Flyconid — 47–49 HP (A8: 51–53)

- Weakening Spores (Debuff) — applies 2 Vulnerable to the player.
- Frail Spores (Attack · Debuff) — 8 damage (A9: 9), then applies 2 Frail to
  the player.
- Smash (Attack) — 11 damage (A9: 12).
- On its first turn it chooses Frail Spores with a 2/3 chance or Smash with a
  1/3 chance; it cannot open with Weakening Spores.
- Later turns choose Weakening Spores with weight 3/6, Frail Spores with
  weight 2/6, or Smash with weight 1/6. The same move cannot repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Flyconid](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Flyconid).
- Weakening Spores makes the player take 50% more attack damage through
  Vulnerable; Frail reduces Block gained from cards by 25%.
- Effect references: [Weak](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Weak)
  and [Vulnerable](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Vulnerable).

### Snapping Jaxfruit — 31–33 HP (A8: 34–36)

- Energy Orb (Attack · Buff) — 3 damage (A9: 4), then gains 2 Strength.
- Uses Energy Orb every turn.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Snapping Jaxfruit](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Snapping_Jaxfruit).
- The Strength is retained between turns, so each later Energy Orb includes
  the accumulated Strength at the time it attacks.

### Fuzzy Wurm Crawler — 55–57 HP (A8: 58–59)

- Acid Goop (Attack) — 4 damage (A9: 6).
- Inhale (Buff) — gains 7 Strength.
- Pattern: Acid Goop, Inhale, Acid Goop, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Fuzzy Wurm Crawler](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Fuzzy_Wurm_Crawler).
- Inhale's Strength carries into future cycles. The first Acid Goop after
  the first Inhale is therefore 11 base-plus-Strength damage before other
  modifiers, and later cycles continue to increase.

### Shrinker Beetle — 38–40 HP (A8: 40–42)

- Shrinker (Debuff) — applies Shrink to the player.
- Chomp (Attack) — 7 damage (A9: 8).
- Stomp (Attack) — 13 damage (A9: 14).
- Pattern: Shrinker, then Chomp and Stomp alternate.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Shrinker Beetle](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Shrinker_Beetle).
- The wiki's Shrink note specifies that Osty is not affected by Shrink and
  deals full damage with his own Attack cards. Shrink is a damage modifier
  separate from Weak; use the live effect text for its remaining duration.
- Effect reference: [Weak](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Weak)
  records the wiki's distinction between Shrink and Weak.

### Slithering Strangler — 53–55 HP (A8: 54–56)

- Constrict (Debuff) — applies 3 Constrict to the player.
- Thwack (Attack) — 7 damage (A9: 8), then gains 5 Block.
- Lash (Attack) — 12 damage (A9: 13).
- Pattern: Constrict, then a 50/50 Lash or Thwack choice, then Constrict
  again and another 50/50 choice. The choice can repeat the previous attack.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Slithering Strangler](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Slithering_Strangler).
- Constrict deals its listed damage at the end of the player's turn while
  the Strangler is alive. Each later application adds another 3 stacks.
- Effect reference: [Constrict](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Constrict).

### Mawler — 72 HP (A8: 76)

- Claw (Attack) — 4×2 damage (A9: 5×2).
- Rip and Tear (Attack) — 14 damage (A9: 16).
- Roar (Debuff) — applies 3 Vulnerable to the player.
- Pattern: opens with Claw. Each later turn chooses Rip and Tear, Roar, or
  Claw with equal weight; it cannot repeat a move, and Roar is used at most
  once per fight.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Mawler](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Mawler).
- Roar's Vulnerable changes incoming Attack damage to the player for its
  duration; the effect is applied by the move and is not a self Strength buff.
- Effect reference: [Vulnerable](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Vulnerable).

### Nibbit — 42–46 HP (A8: 44–48)

- Butt (Attack) — 12 damage (A9: 13).
- Hesitant Slice (Attack · Block) — 6 damage (A9: 7), then gains 5 Block
  (A9: 6).
- Hiss (Buff) — gains 2 Strength (A9: 3).
- Encounter openings are position-dependent: the solo/weak encounter opens
  with Butt; in the paired/normal encounter the front Nibbit opens with
  Hesitant Slice and the back Nibbit opens with Hiss.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Nibbit](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Nibbit).
- The wiki identifies the paired opening as front Hesitant Slice / back Hiss;
  a generic “all Nibbits start on the same move” rule is incorrect.

### Vine Shambler — 61 HP (A8: 64)

- Swipe (Attack) — 6×2 damage (A9: 7×2).
- Grasping Vines (Attack · Debuff) — 8 damage (A9: 9), then applies 1
  Tangled to the player.
- Chomp (Attack) — 16 damage (A9: 18).
- Pattern: Swipe, Grasping Vines, Chomp, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Vine Shambler](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Vine_Shambler).
- Tangled increases the Energy cost of Attack cards for its duration. The wiki
  specifically records that damaging non-Attack cards such as Deadly Poison or
  Inferno are not affected by Tangled's Attack-cost increase.
- Effect reference: [Tangled](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Tangled).

### Eye With Teeth — 6 HP

Summoned by Fogmog's Illusory Spores.

- Illusion — when it dies, revives next turn at full HP.
- Distract (Status) — shuffles 3 Dazed into the player's discard pile.
- It has no damaging move.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Fogmog](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Fogmog),
  which documents the summon and revival; see also [Eye With Teeth](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Eye_With_Teeth).
- The wiki lists Eye With Teeth among the game's enemies incapable of causing
  damage. Dazed is an unplayable Ethereal Status card.
- Effect reference: [Dazed](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Dazed).

### Inklet — 11–17 HP each (A8: 12–18)

Three Inklets always appear together. Each starts with Slippery 1.

- Jab (Attack) — 3 damage (A9: 4).
- Windup Punch (Attack) — 2×3 damage (A9: 3×3).
- Piercing Gaze (Attack) — 10 damage (A9: 11).
- Each Inklet alternates Jab with a random Piercing Gaze or Windup Punch.
  After either Piercing Gaze or Windup Punch it uses Jab; after Jab it makes
  the random choice again. The middle Inklet always opens with Windup Punch;
  the two outer Inklets open with Jab most often or Windup Punch.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Inklet](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Inklet).
- Slippery is a Counter: the next X times the enemy loses HP, that instance
  removes only 1 HP and consumes one stack. The wiki's update history records
  that a fully blocked hit no longer consumes a Slippery stack.
- Effect reference: [Slippery](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Buffs)
  (the shared Buffs page lists Inklet and Vantom as its users).

### Slimes

The Slimes page documents four Overgrowth normal enemies. They appear in the
Slimes encounter and as companions in other Overgrowth encounters.

| Enemy | HP (A8) | Moves and published pattern |
|---|---:|---|
| Leaf Slime (S) | 11–15 (12–16) | Tackle 3 (A9: 4); Goop shuffles 1 Slimed into the discard pile. |
| Leaf Slime (M) | 32–35 (33–36) | Opens Sticky Shot (2 Slimed), then alternates Clump Shot 8 (A9: 9) and Sticky Shot. |
| Twig Slime (S) | 7–11 (8–12) | Tackle 4 (A9: 5) every turn. |
| Twig Slime (M) | 26–28 (27–29) | Opens Sticky Shot (1 Slimed); then Chomp 11 (A9: 12) at 67% or Sticky Shot at 33%, with no consecutive Sticky Shot. |

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Slimes](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Slimes).
- The page lists Easy Slimes as one of each small variety plus a random medium
  variety, and Hard Slimes as one of each variety. It also lists Flyconid
  with a random medium Slime and Slithering Strangler with either both small
  Slimes or a random medium Slime.
- Slimed is shuffled into the discard pile by these moves. Effect reference:
  [Slimed](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Slimed).

### Ruby Raiders

Each Ruby Raiders encounter contains three distinct raider types selected from
Axe, Assassin, Brute, Crossbow, and Tracker.

| Raider | HP (A8) | Moves and pattern |
|---|---:|---|
| Axe Raider | 20–22 (21–23) | Swing 5 (A9: 6) and gains 5 Block (A9: 6), Swing again, then Big Swing 12 (A9: 13); repeats. |
| Assassin Raider | 18–23 (19–24) | Killshot 10 (A9: 11), every turn. |
| Brute Raider | 30–33 (31–34) | Beat 7 (A9: 8), then Clap gains 3 Strength; alternates. |
| Crossbow Raider | 18–21 (19–22) | Reload gains 3 Block, then Fire! 14 (A9: 16); alternates. |
| Tracker Raider | 21–25 (22–26) | Track applies 2 Frail, then Unleash the Hounds deals 1×8 (A9: 1×9); Hounds repeats after Track. |

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Ruby Raiders](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ruby_Raiders).
- The wiki states that the three raiders are sampled without duplicates. It
  also records that Tracker Raider's eight 1-damage instances become 0 after
  Weak because final damage is rounded down.
- Effect references: [Weak](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Weak)
  and [Frail](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Frail).

### Wriggler — 17–21 HP (A8: 18–22)

Wrigglers appear in the Dense Vegetation event and are summoned by Phrog
Parasite.

- Nasty Bite (Attack) — 6 damage (A9: 7).
- Wriggle (Status · Buff) — shuffles 1 Infection into the player's discard
  pile and gains 2 Strength.
- Wrigglers alternate Nasty Bite and Wriggle. When multiple are present, odd
  numbered Wrigglers start on Nasty Bite and even numbered Wrigglers start on
  Wriggle.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Phrog Parasite](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Phrog_Parasite),
  which contains the Wriggler subsection.
- Wrigglers summoned by Phrog Parasite spend their first turn Stunned; the
  four Wrigglers in Dense Vegetation start their pattern immediately.
- Infection is an unplayable Status card that deals its listed damage during
  the player's turn. Effect reference: [Infection](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Infection).

## Neutral calculations and adaptive reading

- For a multi-hit intent, calculate each hit separately before applying final
  rounding. This matters for Weak, Strength, Thorns, and Tracker Raider's
  one-damage hits.
- Slippery consumes one counter per HP-loss instance, while Skittish (on the
  Act 1 elite Gardener) triggers once per Attack card. These are distinct
  event types; do not transfer one rule to the other.
- The source pages are current wiki pages and may include beta content. When a
  page, the installed build, and a generated encounter disagree, record the
  disagreement and prefer the live intent for the current room.
