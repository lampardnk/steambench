---
description: Act 1 Overgrowth elites — wiki fact reference for every published enemy, move, effect, and encounter interaction.
character: ironclad
act: 1
category: elite
ascension: a1
keys: [ironclad, act1, elite, overgrowth, bygone effigy, byrdonis, phrog parasite, wriggler, slow, territorial, infested, infection]
sources: [slaythespire.wiki.gg]
---

# Act 1 — Overgrowth elites

This is a source-bounded reference to the Overgrowth elite pool. HP and damage
values use the wiki's base and displayed ascension values; the live intent is
authoritative if the installed build differs. “A8” is the wiki's HP value at
Ascension 8 and “A9” is its damage value at Ascension 9 unless an entry says
otherwise.

## Reading the entries

- Attack, Buff, Debuff, and Status labels describe the move's effect class;
  targets are stated where a move affects the player or another enemy.
- A multi-hit value such as `3×4` is four separate damage instances.
- A pattern is an encounter rule, not a prediction for a different build or a
  replacement for the live intent.

## Roster

### Bygone Effigy — 127 HP (A8: 132)

- Slow — whenever a card is played, Attack damage against it is increased by
  10% for that turn.
- Sleep — does nothing and is Asleep.
- Wake (Buff) — gains 10 Strength.
- Slashes (Attack) — 13 damage (A9: 15).
- Pattern: Sleep, Wake, then Slashes every turn.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Bygone Effigy](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Bygone_Effigy).
- Slow increases Attack-card damage only; Poison, Doom, and Power effects that
  deal damage are unaffected. The wiki records floor rounding for Slow's
  damage calculation and lists Slashes as effectively 23 (25 at A9) after the
  opening 10 Strength.
- The Sleep phase on this enemy is a move state rather than the Asleep debuff
  used by some other enemies.

### Byrdonis — 81–84 HP (A8: 90)

- Territorial 1 — gains 1 Strength at the end of its turn.
- Swoop (Attack) — 17 damage (A9: 19).
- Peck (Attack) — 3×3 damage (A9: 4×3).
- Pattern: alternates Swoop and Peck, beginning with Swoop.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Byrdonis](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Byrdonis).
- Peck has three damage instances, so each point of Byrdonis's Strength adds
  three total damage on a Peck turn; Swoop receives one additional damage per
  Strength.
- Effect reference: [Strength](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Strength).

### Phrog Parasite — 61–64 HP (A8: 66–68)

- Infested — when Phrog Parasite dies, summons 4 Wrigglers.
- Infect (Status) — shuffles 3 Infection into the player's discard pile.
- Lash (Attack) — 4×4 damage (A9: 5×4).
- Pattern: alternates Infect and Lash, beginning with Infect.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Phrog Parasite](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Phrog_Parasite).
- Wrigglers summoned by Infested spend their first turn Stunned. The encounter
  continues until all four Wrigglers are defeated.
- The page records a timing difference: when the Parasite dies during the
  player's turn, Wrigglers are Stunned on that turn and can act next turn;
  when it dies during the enemy turn, the stun is delayed to the player's next
  turn. A death caused by Poison, Doom, or reflected damage can therefore
  produce a different visible timing than a direct Attack kill.
- Infection deals damage during the player's turn and can trigger effects that
  respond to unblocked damage or HP loss. Effect reference: [Infection](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Infection).

### Wriggler — 17–21 HP (A8: 18–22)

This summoned enemy is also listed by the Phrog Parasite page and appears in
the Dense Vegetation event.

- Nasty Bite (Attack) — 6 damage (A9: 7).
- Wriggle (Status · Buff) — shuffles 1 Infection into the player's discard
  pile and gains 2 Strength.
- Pattern: alternates Nasty Bite and Wriggle. In a group, odd-numbered
  Wrigglers start on Nasty Bite and even-numbered Wrigglers start on Wriggle.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Phrog Parasite](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Phrog_Parasite),
  which contains the Wriggler subsection.
- Wrigglers from Infested are Stunned for their first turn; the four spawned
  by Dense Vegetation start their pattern immediately.
- [Infection](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Infection) is
  an unplayable Status card; its discard-pile placement and the Wriggler's
  Strength gain are separate effects.

## Neutral calculations and adaptive reading

- Slow is a per-card-turn modifier, while Slippery (on Vantom and Inklets) is
  a per-HP-loss counter. A card's number of hits therefore interacts with the
  two powers in different ways.
- Phrog Parasite's death creates a second roster. Keep the four Wriggler
  entries separate from the Parasite's HP and move cycle when calculating the
  encounter's remaining enemy count.
- The source pages may include beta content. When a page, the installed build,
  and a generated encounter disagree, record the disagreement and prefer the
  live intent for the current room.
