---
description: Act 1 Overgrowth bosses — Ceremonial Beast, The Kin, Vantom. Verified HP, intent patterns, phase triggers and Ironclad tactics from slaythespire2.net beta.
character: ironclad
act: 1
category: boss
ascension: a1
keys: [ironclad, act1, boss, overgrowth, ceremonial beast, the kin, kin follower, kin priest, vantom, plow, ringing, wound]
sources: [slaythespire2.net]
---

# Act 1 — Overgrowth bosses

All stats verified from slaythespire2.net beta (v0.111.0, display 2026-06-18).
A8 raises HP; A9 raises damage. Installed build may differ.

## How to read entries

- **Debuff** intents are applied TO THE PLAYER by the enemy.
- **Buff** intents are applied TO THE ENEMY ITSELF.
- **Status** intents: self-applied counters or cards added to player's pile.
- Strength is permanent — it persists across phase transitions and affects
  all subsequent attacks by that entity.

## Ceremonial Beast — 252 HP (A8+: 262)

**Opening rotation:**
- T1: Stamp (Buff) — Plow +150 (A9+: +160). "Plow — The first time this
  creature's HP reaches 150 or below, it becomes Stunned." No damage, no
  Strength.
- T2+: Plow (Attack·Buff) — 18 dmg (A9+: 20) + Strength +2 (self). Keeps
  using Plow every turn.

Phase 1 damage: T2=18, T3=20, T4=22, T5=24... (+2 Strength per turn,
applied to self, persists).

**Triggered rotation** (when HP ≤ 150 — Plow stun fires):
- T1: Stunned (does nothing — free turn)
- T2: Beast Cry (Debuff) — Ringing +1 TO PLAYER. "You can only play 1 card
  this turn."
- T3: Stomp (Attack) — 15 dmg (A9+: 17)
- T4: Crush (Attack·Buff) — 17 dmg (A9+: 19) + Strength +3 (A9+: +4) (self)
- Loops to Beast Cry (T2), repeating T2–T4.

**Phase 1 Strength persists into Phase 2.** If Phase 1 had N Plows (after
T1 Stamp), the Beast has +2N Strength when Phase 2 starts. Example: 4 Plows
(T2–T5) = +8 Strength.

Phase 2 damage with +8 Strength from Phase 1:
- Stomp: 15+8 = 23, then 15+11 = 26, then 15+14 = 29... (+3 per cycle from
  Crush's Strength gain)
- Crush: 17+8 = 25, then +3 (total Str 11) → 17+11 = 28, then +3 (total 14)
  → 17+14 = 31, then +3 (total 17) → 17+17 = 34...

The faster you push through Phase 1, the less Strength the Beast carries
into Phase 2. Each extra Plow turn adds +2 to ALL Phase 2 attacks.

**Tactics**: Phase 1 is a race to 150 HP (deal 102 damage). Push maximum
damage early — don't over-block, since every extra turn adds +2 Strength
to Phase 2. At 150 HP, the Beast Stuns (free turn), then enters Phase 2.
Beast Cry (Ringing +1) limits you to 1 card/turn — play your best single
card (Demon Form, Inflame, Impervious, or a heavy attack). Stomp is
survivable; Crush is the killer — it gains +3 Strength every cycle, so
Crush escalates: 25, 28, 31, 34... (with 4 Phase 1 Plows). Block for Crush
or kill before it lands. Inflame before Phase 2 is ideal: your Strength
persists and amplifies your one card/turn. [Source verified]

## The Kin — Kin Priest (190 HP, A8+: 199) + 2× Kin Follower (58–59 each, A8+: 62–63)

**Kin Priest rotation (loops):**
- T1: Orb of Frailty (Attack·Debuff) — 8 dmg (A9+: 9) + Frail +1 TO PLAYER
- T2: Orb of Weakness (Attack·Debuff) — 8 dmg (A9+: 9) + Weak +1 TO PLAYER
- T3: Soul Beam (Attack) — 3×3 = 9 dmg (no A9 scaling listed)
- T4: Dark Ritual (Buff) — Strength +2 (A9+: +3) (self)
- Loops to Orb of Frailty.

**Kin Follower rotation (loops, each):**
- T1: Quick Slash (Attack) — 5 dmg
- T2: Boomerang (Attack) — 2×2 = 4 dmg
- T3: Power Dance (Buff) — Strength +2 (A9+: +3) (self)
- Loops to Quick Slash.

Frail: you gain 25% less Block from cards. Applied TO YOU.
Weak: you deal 25% less damage with Attacks. Applied TO YOU.

Dark Ritual (Strength +2) makes the Priest's orbs grow: 8→10→12... per cycle.
Power Dance (Strength +2) makes Followers' attacks grow: 5→7→9... per cycle.
Each entity's Strength only affects that entity's own attacks.

**Tactics**: Three enemies. Followers have low HP (58–59) — kill both first
to stop their Strength scaling and reduce incoming to just the Priest. Soul
Beam (3×3=9) and the Followers' combined ~9 dmg/turn means ~18 total early.
Kill a Follower in 1–2 turns with focused attacks.

Frail from Orb of Frailty reduces your block by 25% — ALL block cards are
affected, including Impervious (30 → 22 with Frail). Play block before Frail
lands, or accept reduced block and focus on killing.

Weak from Orb of Weakness reduces your attack damage by 25% — play your big
attacks before Weak lands if possible. Dark Ritual (Strength +2) makes the
Priest's 8-damage orbs grow — don't let the fight drag. Once Followers are
dead, the Priest alone does 8/8/9/buff — manageable with block + Strength
scaling. [Source: slaythespire2.net/monster/kin-priest?v=beta; Kin Follower
data from prior session — verify individually if needed]

## Vantom — 173 HP (A8+: 183)

**Rotation (loops):**
- T1: Ink Blot (Attack) — 7 dmg (A9+: 8). Single hit.
- T2: Inky Lance (Attack) — 6×2 = 12 dmg (A9+: 7×2 = 14). Two hits.
- T3: Dismember (Attack·Status) — 26 dmg (A9+: 30) + 3 Wound. Single hit.
  Wound: 3 Wound status cards added to your draw pile.
- T4: Prepare (Buff) — Strength +2 (self). No damage.
- Loops to Ink Blot.

Dismember is a single hit (26 dmg), so +2 Strength adds +2 (→ 28). Inky
Lance is 2 hits, so +2 Strength adds +2 per hit = +4 total ((6+2)×2 = 16).

Second cycle with +2 Strength (from Prepare):
- T5: Ink Blot = 7+2 = 9
- T6: Inky Lance = (6+2)×2 = 16
- T7: Dismember = 26+2 = 28
- T8: Prepare (+2, total Str = 4)

Third cycle with +4 Strength:
- T9: Ink Blot = 7+4 = 11
- T10: Inky Lance = (6+4)×2 = 20
- T11: Dismember = 26+4 = 30
- T12: Prepare (+2, total Str = 6)

**Tactics**: Dismember is the fight — 26 damage (30 at A9) plus 3 Wounds
clogging your draw. Block for it: Impervious (30 block, or 22 with Frail if
you have it) or Shrug + Defend. The Wounds dilute your deck mid-fight,
reducing good card draw rate. Kill before T3 is unrealistic (need 173 HP in
2 turns = 86/turn). Realistic: block T3 Dismember, then race. Prepare (T4)
means the next cycle hits harder: Ink Blot 9, Inky Lance 16, Dismember 28.
Don't let it cycle twice. Vulnerable + heavy attacks (Bludgeon, Heavy Blade
with Inflame) are the win condition. Use a Fire Potion (20 dmg) or Strength
Potion to push lethal. [Source verified]

## Ironclad boss prep checklist (editable)

- By Act 1 boss you want: one Strength source (Inflame/Demon Form), one big
  block (Impervious/Shrug), one heavy attack (Bludgeon/Heavy Blade/Carnage).
- Ceremonial Beast: race to 150 (minimize Phase 1 Plows), then play around
  Ringing (1 card/turn). Inflame before Phase 2.
- The Kin: kill Followers first, block Priest's orbs (account for Frail
  reducing ALL block), out-scale Dark Ritual.
- Vantom: block Dismember (26/30), deal with Wounds, kill in one cycle.
- Use potions in boss fights — don't hoard. Strength + Fire = 20+ extra dmg.
