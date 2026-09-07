---
description: Act 1 Overgrowth normal encounters — verified mob HP, intents, damage scaling, and Ironclad tactics. All stats sourced from slaythespire2.net beta.
character: ironclad
act: 1
category: normal
ascension: a1
keys: [ironclad, act1, normal, overgrowth, cubex construct, fogmog, flyconid, snapping jaxfruit, fuzzy wurm crawler, shrinker beetle, slithering strangler, mawler, nibbit, vine shambler, eye with teeth]
sources: [slaythespire2.net]
---

# Act 1 — Overgrowth normal encounters

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

### Cubex Construct — 65 HP (A8+: 70)
Act 1 Overgrowth, Act 3 Glory. Appears with Punch Construct (Act 3).

- T1: Charge Up (Buff) — Strength +2 (self, no damage)
- T2: Repeater Blast (Attack·Buff) — 7 dmg (A9+: 8) + Strength +2 (self)
- T3: Repeater Blast (Attack·Buff) — 7 dmg (A9+: 8) + Strength +2 (self)
- T4: Expel (Attack) — 5×2 (A9+: 6×2)
- Loops to Repeater Blast (T2), repeating T2–T4.

Strength progression (self): T1 end = 2, T2 end = 4, T3 end = 6, then +2 per
Repeater Blast in subsequent cycles. Expel does not add Strength.

Damage: T2 = 7+2 = 9, T3 = 7+4 = 11, T4 = (5+6)×2 = 22, T5 = 7+6 = 13,
T6 = 7+8 = 15, T7 = (5+10)×2 = 30. The Expel hits are the most dangerous
(22, 30, 42...).

**Tactics**: T1 is a free setup turn (no damage) — play Inflame or push damage.
Kill before the second Expel (T7). Strength snowballs fast (+2 per Repeater
Blast). In multi-enemy fights, this is a priority target — the scaling makes
it lethal if ignored.

### Fogmog — 74 HP (A8+: 78)
Appears with Eye with Teeth (summoned on T1).

- T1: Illusory Spores (Summon) — summons Eye with Teeth (no damage to player)
- T2: Thwack (Attack·Buff) — 8 dmg (A9+: 9) + Strength +1 (self)
- T3: Random — 40% Thwack (8 dmg + Str +1) / 60% Headbutt (14 dmg, A9+: 16)
- Loops to Thwack (T2 position).

Strength: +1 per Thwack. Slow snowball. Headbutt (14/16) is the big hit and
does NOT benefit from Strength (it's a pure Attack, no Buff component).
Thwack does benefit: T2 = 8+0 = 8, T4 = 8+2 = 10, T6 = 8+4 = 12...

**Tactics**: T1 is a free turn (summon, no player damage). The Eye with Teeth
adds chip damage — kill Fogmog first, not the summon. Block Headbutt (14).
Thwack scales slowly (+1/cycle), so the fight is manageable if you kill within
3–4 cycles. [Source: slaythespire2.net/monster/fogmog?v=beta]

### Flyconid — 47–49 HP (A8+: 51–53)
Possible companions (wiki "Appears with"): Leaf Slime (M), Snapping Jaxfruit,
Twig Slime (M). Not guaranteed to all spawn together.

- **Vulnerable Spores** (Debuff) — applies Vulnerable +2 TO THE PLAYER. While
  you have Vulnerable, incoming attacks deal +50% damage to you.
- **Frail Spores** (Attack·Debuff) — 8 dmg (A9+: 9) + applies Frail +2 TO THE
  PLAYER. While you have Frail, you gain 25% less Block from cards.
- **Smash** (Attack) — 11 dmg (A9+: 12).

**Opening rotation** (50/50 random): Frail Spores (8 dmg + Frail +2) or
Smash (11 dmg).

**Triggered rotation** (33/33/33 random): Vulnerable Spores, Frail Spores, or
Smash. Trigger condition: [UNCERTAIN — wiki says "special power broken, or
dies and revives"].

**Tactics**: Vulnerable Spores makes YOU take +50% from subsequent Flyconid
attacks — Frail Spores becomes ~12, Smash becomes ~16–17 while you're
Vulnerable. Frail Spores reduces your block by 25%. Both debuffs make you
fragile. Kill fast — Flyconid has low HP (47–49), so 2–3 focused attacks clear
it. In multi-enemy fights, kill it before it debuffs you. [Source verified]

### Snapping Jaxfruit — 31–33 HP (A8+: 34–36)
Possible companions (wiki "Appears with"): Flyconid, Leaf Slime (M/S),
Slithering Strangler, Twig Slime (M/S). Not guaranteed to all spawn together.

- Every turn: **Energy Orb** (Attack·Buff) — 3 dmg (A9+: 4) + Strength +2
  (self). No other moves. Loops forever.

Strength: +2 per turn. T1 = 3, T2 = 5, T3 = 7, T4 = 9, T5 = 11...

**Tactics**: At 31–33 HP, this needs 2–3 turns of focused damage (Strike 6
× 5–6 hits; Bash 8 + follow-up). You cannot one-shot it with starter cards.
Kill within 3 turns to cap damage at 7/turn. The Strength scaling is steady
but starts low (3 on T1), so it's not immediately threatening — but it
becomes a priority target in multi-enemy fights where it can scale
uncontested. [Source verified]

### Fuzzy Wurm Crawler — 55–57 HP (A8+: 58–59)
Possible companions: Shrinker Beetle. Not guaranteed simultaneous.

- T1: Acid Goop (Attack) — 4 dmg (A9+: 6)
- T2: Inhale (Buff) — Strength +7 (self, no damage)
- T3: Acid Goop (Attack) — 4 dmg + 7 Strength = 11 (A9+: 6+7 = 13)
- Loops to T1 (Acid Goop). Strength persists.

Full sequence with Strength accumulation:
T1 = 4, T2 = [Inhale +7, total Str 7], T3 = 4+7 = 11, T4 = 4+7 = 11,
T5 = [Inhale +7, total Str 14], T6 = 4+14 = 18, T7 = 4+14 = 18,
T8 = [Inhale +7, total Str 21], T9 = 4+21 = 25, T10 = 4+21 = 25...

Each Inhale adds +7 Strength. Two Acid Goops per Inhale cycle. Damage
jumps: 4 → 11 → 18 → 25 → 32... per Acid Goop after each Inhale.

**Tactics**: The snowball is the threat. Kill before the second Inhale (T5)
if possible — damage jumps from 11 to 18. Weak reduces all Acid Goops by 25%
(11 → 8, 18 → 14). The Inhale turns (T2, T5, T8...) deal no damage — push
damage on those turns. [Source verified]

### Shrinker Beetle — 38–40 HP (A8+: 40–42)
Possible companions: Fuzzy Wurm Crawler.

- T1: Shrinker (Debuff) — applies Shrink -1
- T2: Chomp (Attack) — 7 dmg (A9+: 8)
- T3: Stomp (Attack) — 13 dmg (A9+: 14)
- Loops to Chomp (T2), repeating Chomp → Stomp.

**Shrink**: wiki says "This creature's Attacks deal 30% less damage for the
next 3 turns." The Debuff intent type conventionally targets the player in
STS, but the description's use of "This creature" (rather than "you") is
ambiguous. [UNCERTAIN — receiver]:
- If applied to YOU: your attack cards deal 30% less for 3 turns. This
  significantly reduces Ironclad's damage output.
- If applied to the BEETLE (self): Chomp 7 → ~5, Stomp 13 → ~9.
- Verify in-game which entity receives Shrink.

**Tactics**: Stomp (13/14) is the big hit — block for it regardless of Shrink
receiver. Low HP (38–40), so 2–3 attacks kill it. The Shrinker turn (T1) deals
no damage — push damage then. [Source: slaythespire2.net/monster/shrinker-beetle?v=beta]

### Slithering Strangler — 53–55 HP (A8+: 54–56)
Possible companions: Leaf Slime (M/S), Snapping Jaxfruit, Twig Slime (M/S).

- T1: Constrict (Debuff) — applies Constrict +3 TO THE PLAYER.
- T2: Random — 50% Thwack / 50% Lash
- Loops to T1 (Constrict).

**Constrict**: "While the Slithering Strangler is alive, at the end of your
turn, take 1 damage." Per stack. With +3 stacks, you take 3 damage at the
end of each turn. This damage occurs as long as the Strangler is alive.
[UNCERTAIN — whether this bypasses Block; verify in-game.]

**Thwack** (Attack·Defend) — 7 dmg (A9+: 8) + 5 block (self). The block makes
the Strangler harder to damage on Thwack turns.

**Lash** (Attack) — 12 dmg (A9+: 13).

**Tactics**: Constrict is passive damage (3/turn) that only stops when the
Strangler dies. Kill the Strangler to remove it. Thwack's 5 block makes
trading inefficient — save big attacks for Lash turns (no block). Focus the
Strangler after clearing smaller targets. [Source verified]

### Mawler — 72 HP (A8+: 76)
No companions listed — solo encounter.

- T1: Claw (Attack) — 4×2 = 8 dmg (A9+: 5×2 = 10)
- T2: Random — 33% Rip and Tear / 33% Roar / 33% Claw
- Loops to T1 (Claw).

**Rip and Tear** (Attack) — 14 dmg (A9+: 16).
**Roar** (Debuff) — applies Vulnerable +3 TO THE PLAYER. While you have
Vulnerable, Mawler's attacks deal +50% to you: Claw 8 → 12, Rip and Tear
14 → 21.
**Claw** (Attack) — 4×2 = 8 dmg (A9+: 5×2 = 10).

**Tactics**: Roar (Vulnerable +3) is the dangerous move — block hard after
seeing it, since the next attack deals +50%. Claw is multi-hit (4×2); Weak
reduces total damage by 25%. Mid-HP (72) — block-and-trade with Shrug It Off.
Don't let it cycle repeatedly. [Source verified]

### Nibbit — 42–46 HP (A8+: 44–48)
No companions listed — appears as a pair (2× Nibbit). Position-dependent
rotations (STS2 positioning mechanic).

- **Butt** (Attack) — 12 dmg (A9+: 13)
- **Slice** (Attack·Defend) — 6 dmg (A9+: 7) + 5 block (A9+: 6) (self)
- **Hiss** (Buff) — Strength +2 (A9+: +3) (self)

Rotations:
- **When alone**: Butt → Slice → Hiss → loop
- **When not in front**: Hiss → Butt → Slice → loop
- **When in front**: Slice → Hiss → Butt → loop

Hiss is a self-buff: Strength +2 per cycle. Butt grows: 12 → 14 → 16 → 18...
Slice has 5 block (self), making the Nibbit harder to damage on Slice turns.

**Tactics**: Kill one Nibbit first to halve incoming damage and stop one
Strength scaler. Butt (12) is the big hit — block for it. Slice's block
makes it a bad trade turn. Hiss turns deal no damage — push damage then.
[Source verified]

### Vine Shambler — 61 HP (A8+: 64)
No companions listed — solo encounter.

- T1: Swipe (Attack) — 6×2 = 12 dmg (A9+: 7×2 = 14)
- T2: Grasping Vines (Attack·Debuff) — 8 dmg (A9+: 9) + Tangled +1 TO PLAYER
- T3: Chomp (Attack) — 16 dmg (A9+: 18)
- Loops to T1 (Swipe).

**Tangled**: "Attacks cost 1 additional Energy this turn." Applied to YOU.
On T2 (Grasping Vines), your attacks cost +1 Energy for that turn.

**Tactics**: Play expensive cards before T2 (Grasping Vines). Chomp (16/18)
is the big hit — block for it. Swipe is multi-hit (6×2); Weak helps. Don't
let it cycle — Tangled stacks, making each cycle's T2 increasingly punishing.
[Source verified]

### Eye with Teeth (Fogmog summon)
Summoned by Fogmog on T1. No individual page fetched — stats/intents not
verified. Treat as chip damage; kill Fogmog first.

### Inklet / Leaf Slime / Twig Slime
Not individually verified from source pages. HP ranges from encounter list
data (prior session). Inklet: ~11–17 HP (swarm of 3). Leaf Slime (M): ~32–35
HP. Twig Slime (M): ~26–28 HP. Small variants: 7–15 HP. [Source: encounter
list, not individual pages — verify in-game.]

## Ironclad strategy notes (editable)

- Burning Blood heals 6 HP post-combat — trading HP for speed is acceptable.
- Prioritize attack cards in rewards: Carnage, Uppercut, Pommel Strike,
  Twin Strike, Bludgeon. One block card (Shrug It Off) is enough early.
- Against Strength-scalers (Cubex Construct, Fuzzy Wurm Crawler, Snapping
  Jaxfruit, Nibbit): kill speed matters more than block. Every turn they
  survive, their damage increases.
- Against debuffers (Flyconid, Slithering Strangler, Shrinker Beetle): kill
  fast to stop debuff accumulation. Vulnerable/Frail/Constrict/Tangled all
  make you more fragile.
- Fogmog's Eye with Teeth summon adds chip damage; kill Fogmog, not the summon.
