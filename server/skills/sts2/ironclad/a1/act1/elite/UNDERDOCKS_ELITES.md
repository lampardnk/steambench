---
description: Act 1 Underdocks elites — wiki fact reference for every published enemy, move, effect, and encounter interaction.
character: ironclad
act: 1
category: elite
ascension: a1
keys: [ironclad, act1, elite, underdocks, phantasmal gardener, skulking colony, terror eel, skittish, hardened shell, shriek, terror, vigor]
sources: [slaythespire.wiki.gg]
---

# Act 1 — Underdocks elites

This is a source-bounded reference to the Underdocks elite pool. HP and damage
values use the wiki's base and displayed ascension values; the live intent is
authoritative if the installed build differs. “A8” is the wiki's HP value at
Ascension 8 and “A9” is its damage value at Ascension 9 unless an entry says
otherwise.

## Reading the entries

- Attack, Buff, Debuff, and Status labels describe the move's effect class;
  targets are stated where a move affects the player or another enemy.
- A multi-hit value such as `3×3` is three separate damage instances.
- A pattern is an encounter rule, not a prediction for a different build or a
  replacement for the live intent.

## Roster

### Phantasmal Gardener — 26–31 HP each (A8: 27–32), four per encounter

- Skittish 6 (A8: 7) — the first time it is hit each turn, gains 6 Block (A8:
  7).
- Bite (Attack) — 5 damage.
- Lash (Attack) — 7 damage.
- Flail (Attack) — 1×3 damage.
- Enlarge (Buff) — gains 2 Strength (A9: 3).
- The four Gardeners use the same Bite → Lash → Flail → Enlarge cycle, each
  starting at a different point.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Phantasmal Gardener](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Phantasmal_Gardener).
- Skittish resolves after the first Attack card against that Gardener has
  fully resolved. A multi-hit card therefore resolves all of its hits before
  the Block is gained; two separate Attack cards can trigger the power on two
  separate occasions in the same turn.
- Non-Attack damage does not trigger Skittish. The wiki lists indirect effects
  such as Flame Barrier, Noxious Fumes, Negative Pulse, and Haze as examples.

### Skulking Colony — 75 HP (A8: 80)

- Hardened Shell 20 — cannot lose more than 20 HP in a turn.
- Zoom (Attack) — 14 damage (A9: 16), used twice at the start of the cycle.
- Inertia (Attack · Buff) — 9 damage (A9: 11), then gains 2 Strength (A9: 4).
- Piercing Stabs (Attack) — 7×2 damage (A9: 8×2).
- Pattern: Zoom, Zoom, Inertia, Piercing Stabs, then repeat.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Skulking Colony](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Skulking_Colony).
- Hardened Shell resets at the start of both the player's turn and the
  Colony's turn. The wiki records that 20 Attack damage plus 20 Poison damage
  can therefore remove up to 40 HP over one round, because Poison resolves on
  the enemy turn.
- Thorns and Reflect also resolve on the enemy turn and use that second cap.

### Terror Eel — 140 HP (A8: 150)

- Shriek 70 (A8: 75) — when HP reaches the threshold, becomes Stunned and then
  uses Terror.
- Crash (Attack) — 16 damage (A9: 18).
- Thrash (Attack · Buff) — 3×3 damage (A9: 4×3), then gains 6 Vigor.
- Stun — does nothing.
- Terror (Debuff) — applies 99 Vulnerable to the player.
- Pattern: Crash and Thrash alternate, beginning with Crash. The threshold
  inserts Stun and Terror before the normal cycle resumes.

#### Notes/Interactions [wiki-driven]

- Source: [Slay the Spire 2: Terror Eel](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Terror_Eel).
- The 70 (75 at A8) value is an HP threshold, not an attack value. Terror's
  99 Vulnerable effectively lasts for the remainder of the fight.
- Thrash's Vigor modifies the next Attack and is consumed by that attack;
  after the opening Crash, the next Crash receives the Vigor bonus.
- Effect references: [Vigor](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Vigor)
  and [Vulnerable](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Vulnerable).

## Neutral calculations and adaptive reading

- Skittish is keyed to the first Attack card that hits a Gardener each turn;
  Hardened Shell is keyed to HP lost during separate player and enemy turns.
  Neither is a general damage cap for the whole combat.
- Terror Eel's threshold is checked against current HP, while Vigor is consumed
  by the next Attack. Read the intent and current power stacks when a threshold
  or consumed buff is near a boundary.
- The source pages may include beta content. When a page, the installed build,
  and a generated encounter disagree, record the disagreement and prefer the
  live intent for the current room.
