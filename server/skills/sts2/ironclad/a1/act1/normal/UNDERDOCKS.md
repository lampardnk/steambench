---
description: Act 1 Underdocks normal encounters — verified mob HP, intents, damage scaling, and Ironclad tactics. All stats sourced from slaythespire2.net beta.
character: ironclad
act: 1
category: normal
ascension: a1
keys: [ironclad, act1, normal, underdocks, living fog, calcified cultist, damp cultist, seapunk, corpse slug, gremlin merc, fossil stalker, haunted ship, punch construct, sewer clam, two-tailed rat, gas bomb]
sources: [slaythespire2.net]
---

# Act 1 — Underdocks normal encounters

All stats verified from slaythespire2.net beta (v0.111.0, display 2026-06-18).
A8 raises HP; A9 raises damage. Installed build may differ — treat in-game
intent as authoritative when it conflicts.

## How to read entries

- **Debuff** intents are applied TO THE PLAYER by the enemy.
- **Buff** intents are applied TO THE ENEMY ITSELF.
- **Attack · Buff/Debuff** combines damage with a self-buff or player-debuff.
- "Appears with" on the wiki = possible companions across encounters, NOT a
  guaranteed simultaneous spawn. Actual encounter composition varies.
- "Triggered during battle" = the enemy switches rotation when a condition is
  met (wiki: "e.g. a special power is broken, or it dies and revives").
  Exact trigger conditions are [UNCERTAIN — not fully defined on source pages].

## Key monsters — verified stats and intents

### Living Fog — 80 HP (A8+: 82)
Appears with Gas Bomb (summoned on T2 via Bloat).

- T1: Advanced Gas (Attack·Debuff) — 8 dmg (A9+: 9) + Smoggy +1 TO PLAYER
- T2: Bloat (Attack·Summon) — 5 dmg (A9+: 6) + summons Gas Bomb
- T3: Super Gas Blast (Attack) — 8 dmg (A9+: 9)
- Loops to Bloat (T2), repeating T2–T3.

**Smoggy**: "You can only play 1 Skill per turn." Applied to YOU. Each
Advanced Gas adds +1 Smoggy (restricts further). [UNCERTAIN — does Smoggy
stack beyond +1, or is +1 the cap? Verify in-game.]

**Tactics**: Smoggy restricts Skills, so lean on Attacks and Powers. Save
your one Skill per turn for Shrug It Off or Impervious. Ironclad's
attack-heavy deck handles the Skill restriction better than most. Kill the
Gas Bomb if it threatens, but prioritize Living Fog. The damage is moderate
(8/5/8 cycle), so the Smoggy debuff is the real threat. [Source verified]

### Calcified Cultist — 38–41 HP (A8+: 39–42)
Possible companions (wiki "Appears with"): Damp Cultist, Seapunk.

- T1: Incantation (Buff) — Ritual +2 (self). "Ritual — Gain Strength at the
  end of your turn." So the cultist gains +2 Strength at end of each turn.
- T2: Dark Strike (Attack) — 9 dmg (A9+: 11). Then keeps using Dark Strike
  every turn.

Strength progression: T1 end = +2, T2 = 9+2 = 11, T2 end = +4, T3 = 9+4 = 13,
T3 end = +6, T4 = 9+6 = 15, T4 end = +8, T5 = 9+8 = 17...

**Tactics**: Ritual +2 Strength per turn makes Dark Strike scale: 11, 13, 15,
17... Kill fast — at 38–41 HP, 2–3 attacks suffice. The Incantation turn (T1)
deals no damage — push damage then. In the Cultists encounter (Calcified +
Damp), kill Calcified first (lower HP, slower Ritual). [Source verified]

### Damp Cultist — 51–53 HP (A8+: 52–54)
Possible companions: Calcified Cultist.

- T1: Incantation (Buff) — Ritual +5 (A9+: +6) (self). Gains +5 Strength at
  end of each turn.
- T2: Dark Strike (Attack) — 1 dmg (A9+: 3). Then keeps using Dark Strike
  every turn.

Strength progression: T1 end = +5, T2 = 1+5 = 6, T2 end = +10, T3 = 1+10 = 11,
T3 end = +15, T4 = 1+15 = 16, T4 end = +20, T5 = 1+20 = 21...

**Tactics**: Ritual +5 is much faster than Calcified's +2. Dark Strike starts
at 1 but snowballs hard: 6, 11, 16, 21... Higher HP (51–53) than Calcified,
so it takes longer to kill. In the Cultists encounter, kill Calcified first
(quick kill, stops one scaler), then focus Damp before its Dark Strike becomes
lethal (T4+: 16+ dmg). [Source verified]

### Seapunk — 44–46 HP (A8+: 47–49)
Possible companions: Calcified Cultist.

- T1: Sea Kick (Attack) — 11 dmg (A9+: 13)
- T2: Spinning Kick (Attack) — 2×4 = 8 dmg (no A9 scaling listed)
- T3: Bubble Burp (Buff·Defend) — 7 block (A9+: 8) + Strength +1 (A9+: +2)
  (self). No damage to player.
- Loops to Sea Kick.

Strength: +1 per cycle (every 3 turns). Bubble Burp's block (7) makes the
Seapunk harder to damage on T3. Spinning Kick is multi-hit (2×4); Weak reduces
total by 25%.

**Tactics**: Sea Kick (11/13) is the big hit — block for it. Bubble Burp
turns (T3) deal no damage — push damage then. Strength scales slowly (+1 per
cycle), so this is a moderate fight. In Underdocks Wildlife (Calcified +
Seapunk), kill Calcified first (lower HP, Ritual scaling). [Source verified]

### Corpse Slug — 25–27 HP (A8+: 27–29)
No companions listed — appears as swarm (3× in encounter).

- T1: Whip Slap (Attack) — 3×2 = 6 dmg (no A9 scaling listed)
- T2: Glomp (Attack) — 8 dmg (A9+: 9)
- T3: Goop (Debuff) — Frail +2 TO PLAYER. No damage.
- Loops to Whip Slap.

Frail: you gain 25% less Block from cards. Applied to YOU.

**Tactics**: Very low HP (25–27) — any single attack kills one. Don't block;
just kill. Whirlwind or any AoE clears multiple. Goop (T3) applies Frail but
deals no damage — if the fight reaches T3, your block is weakened. Burning
Blood heals 6 HP post-combat, covering incidental damage. [Source verified]

### Two-Tailed Rat — 17–21 HP (A8+: 18–22)
No companions listed — appears as swarm (3× in encounter).

Every turn: Random — 25% each:
- Scratch (Attack) — 8 dmg (A9+: 9)
- Disease Bite (Attack) — 6 dmg (A9+: 7)
- Screech (Debuff) — Frail +1 TO PLAYER. No damage.
- Call for Backup (Summon) — summons another Two-Tailed Rat.

**Tactics**: Very low HP (17–21) — any attack kills one. Kill fast to prevent
Call for Backup from swelling the swarm. Don't block. Whirlwind or Explosive
Ampoule clears all three. [Source verified]

### Punch Construct — 55 HP (A8+: 60)
Act 1 Underdocks, Act 3 Glory. Possible companion: Cubex Construct (Act 3).

- T1: Ready (Defend) — 10 block (self). No damage.
- T2: Fast Punch (Attack·Debuff) — 5×2 = 10 dmg (A9+: 6×2 = 12) + Frail +1
  TO PLAYER.
- T3: Strong Punch (Attack) — 14 dmg (A9+: 16)
- Loops to Ready (T1).

Frail: you gain 25% less Block from cards. Applied on T2.

**Tactics**: Ready (T1) gives 10 block — don't waste attacks into it; use T1
for setup (Inflame, Shrug). Fast Punch applies Frail before the Strong Punch
hit — your block for T3 will be 25% less effective. Strong Punch (14/16) is
the big hit. Kill by T3 or block hard (accounting for Frail reduction).
[Source verified]

### Haunted Ship — 63 HP (A8+: 67)
No companions listed — solo encounter.

- T1: Haunt (Debuff·Status) — Weak +3 TO PLAYER + 5 Dazed into your draw
  pile. No damage.
- T2: Swipe (Attack) — 13 dmg (A9+: 14)
- T3: Stomp (Attack) — 4×3 = 12 dmg (A9+: 5×3 = 15)
- Loops to Swipe (T2).

Weak: you deal 25% less damage with Attacks. Applied to YOU.
Dazed: 5 Dazed (unplayable) status cards clog your draw pile, reducing good
card draw rate.

**Tactics**: Haunt (T1) deals no damage but weakens you and clogs your deck.
The Dazed cards dilute your draws for several turns. Swipe (13/14) is the
moderate hit; Stomp (4×3 = 12/15) is multi-hit. Weak reduces your damage
output by 25% — prioritize Strength (Inflame) to overcome it. Don't waste
big attacks on T1 (no damage, just debuff). [Source verified]

### Sewer Clam — 56 HP (A8+: 58)
No companions listed — solo encounter.

- T1: Jet (Attack) — 10 dmg (A9+: 11)
- T2: Pressurize (Buff) — Strength +4 (self). No damage.
- Loops to Jet (T1).

Strength: +4 per cycle. Jet scales: T1 = 10, T3 = 10+4 = 14, T5 = 10+8 = 18,
T7 = 10+12 = 22...

**Tactics**: Pressurize (T2) deals no damage — push damage on that turn. Jet
scales fast (+4 per cycle). Kill within 2 cycles (4 turns) before Jet reaches
18+. Block Jet (10/14/18). [Source verified]

### Gremlin Merc — 47–49 HP (A8+: 51–53)
Possible companions (wiki "Appears with"): Fat Gremlin, Sneaky Gremlin.

- T1: Gimme (Attack) — 7×2 = 14 dmg (A8+: 8×2 = 16)
- T2: Double Smash (Attack·Debuff) — 6×2 = 12 dmg (A8+: 7×2 = 14) + Weak +2
  TO PLAYER.
- T3: Hehe (Attack·Buff) — 8 dmg (A8+: 9) + Strength +2 (self)
- Loops to Gimme (T1).

Weak: you deal 25% less with Attacks. Applied to YOU on T2.
Strength: +2 per cycle on the Merc (self). Gimme scales: T1 = 14, T4 = 14+2 =
16, T7 = 14+4 = 18...

**Tactics**: Gimme (14/16) is the big hit T1 — block for it immediately. Double
Smash applies Weak, reducing your damage for 2 turns — play your big attacks
before T2 if possible. Hehe (T3) adds Strength but only deals 8. Kill within
2 cycles (6 turns) before scaling matters. In multi-gremlin encounters, Merc
is the highest-priority target (highest damage + Strength scaling).
[Source verified]

### Fossil Stalker — 51–53 HP (A8+: 54–56)
No companions listed — solo encounter.

**Opening rotation:**
- T1: Latch (Attack) — 12 dmg (A9+: 14)

**Triggered rotation** (trigger condition: [UNCERTAIN — wiki says "special
power broken, or dies and revives"]):
- T1: Lash (Attack) — 3×2 = 6 dmg (A9+: 4×2 = 8)
- T2: Random — 33% Latch (12 dmg) / 33% Tackle / 33% Lash (3×2)
- Loops to T2 (random).

**Tackle** (Attack·Debuff) — 9 dmg (A9+: 11) + Frail +1 TO PLAYER.
**Latch** (Attack) — 12 dmg (A9+: 14).
**Lash** (Attack) — 3×2 = 6 dmg (A9+: 4×2 = 8).

Frail: you gain 25% less Block from cards. Applied to YOU.

**Tactics**: Opening Latch (12/14) is the big hit — block for it. In the
triggered rotation, Tackle applies Frail, weakening your block before
subsequent Latch hits. Lash is multi-hit (3×2); Weak helps. Moderate HP
(51–53) — standard block-and-trade. [Source verified]

### Toadpole / Sludge Spinner
Not individually verified from source pages. Listed in encounter data as
weak encounters: Toadpoles (2×, ~21–25 HP), Sludge Spinner (~37–39 HP).
[Source: encounter list, not individual pages — verify in-game.]

## Ironclad strategy notes (editable)

- Burning Blood heals 6 HP post-combat — trade HP for speed on swarm fights.
- Corpse Slugs and Rats: don't block, just kill. Your heal covers it.
- Living Fog: Smoggy is the real threat. Lean on Attacks (Ironclad's
  strength) and save your one Skill per turn for Shrug It Off.
- Cultists encounter: kill Calcified first (lower HP, slower Ritual), then
  focus Damp before Dark Strike snowballs (Ritual +5/turn).
- Punch Construct: T1 block is a setup turn — don't waste attacks. Account
  for Frail when blocking T3 Strong Punch.
- Haunted Ship: Dazed clogs your draw — don't let the fight drag. Weak from
  Haunt reduces your output; Inflame to overcome.
- Sewer Clam: Pressurize turns are free damage windows. Kill fast — Jet
  scales +4 per cycle.
- Gremlin Merc: highest-priority target in multi-gremlin fights. Block Gimme
  (14) T1.
