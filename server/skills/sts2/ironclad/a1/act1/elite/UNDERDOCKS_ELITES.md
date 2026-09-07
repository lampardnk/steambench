---
description: Act 1 Underdocks elites — Phantasmal Gardeners, Skulking Colony, Terror Eel. Verified HP, intents, patterns and Ironclad tactics from slaythespire2.net beta.
character: ironclad
act: 1
category: elite
ascension: a1
keys: [ironclad, act1, elite, underdocks, phantasmal gardener, skulking colony, terror eel, vigor]
sources: [slaythespire2.net]
---

# Act 1 — Underdocks elites

All stats verified from slaythespire2.net beta (v0.111.0, display 2026-06-18).
A8 raises HP; A9 raises damage. Installed build may differ.

## How to read entries

- **Debuff** intents are applied TO THE PLAYER by the enemy.
- **Buff** intents are applied TO THE ENEMY ITSELF.
- **Vigor** (Buff): "Your next Attack deals additional damage." The "Your"
  refers to the enemy — its next attack gains the Vigor bonus. Vigor is
  consumed on the next attack.
- "Triggered during battle" = rotation switch on a condition (wiki: "e.g. a
  special power is broken, or it dies and revives"). Exact triggers are
  [UNCERTAIN — not fully defined on source pages].

Never enter an elite below 60% HP (survival default from controls/CONTROLS.md).

## Phantasmal Gardeners — 4× (26–31 HP each, A8+: 27–32)

Four enemies with staggered position-dependent rotations. Each cycles through
the same 4 moves in a different order.

**Moves (all self-explanatory):**
- Flail (Attack) — 1×3 = 3 dmg
- Enlarge (Buff) — Strength +2 (A9+: +3) (self, no damage)
- Bite (Attack) — 5 dmg (no A9 scaling listed)
- Lash (Attack) — 7 dmg (no A9 scaling listed)

**Position rotations (each loops after 4 turns):**

| Turn | Pos 1 | Pos 2 | Pos 3 | Pos 4 |
|------|-------|-------|-------|-------|
| T1 | Flail (3) | Bite (5) | Lash (7) | Enlarge (0) |
| T2 | Enlarge (0) | Lash (7) | Flail (3) | Bite (5) |
| T3 | Bite (5) | Flail (3) | Enlarge (0) | Lash (7) |
| T4 | Lash (7) | Enlarge (0) | Bite (5) | Flail (3) |

T1 total incoming: 3 + 5 + 7 + 0 = 15 dmg (moderate). T2: 0 + 7 + 3 + 5 = 15.
T3: 5 + 3 + 0 + 7 = 15. T4: 7 + 0 + 5 + 3 = 15. Each turn has consistent 15
base damage, with one Gardener Enlarging (no damage) each turn.

After one full cycle (T1–T4), each Gardener has Enlarged once (+2 Strength
each). Strength makes all that Gardener's subsequent attacks hit harder:
Flail 3→5, Bite 5→7, Lash 7→9. After two cycles, +4 each: Flail 3→7, Bite 5→9,
Lash 7→11.

**Tactics**: 4 low-HP enemies with Strength scaling. Kill 1–2 early to reduce
total damage and Enlarge stacks. Each kill removes ~4 avg dmg/turn and one
Strength scaler. Whirlwind is strong here (hits all 4). Don't let the fight go
beyond 2 cycles (8 turns) — 4 Enlarges means all attacks scale. Focus-fire
the Gardener about to Enlarge next to deny Strength gain. [Source verified]

## Skulking Colony — 75 HP (A8+: 80)

**Rotation (loops):**
- T1: Zoom (Attack) — 14 dmg (A9+: 16)
- T2: Zoom (Attack) — 14 dmg (A9+: 16)
- T3: Inertia (Attack·Buff) — 9 dmg (A9+: 11) + Strength +2 (A9+: +4) (self)
- T4: Piercing Stabs (Attack) — 7×2 = 14 dmg (A9+: 8×2 = 16)
- Loops to Zoom.

Strength from Inertia is permanent and affects ALL subsequent attacks.
Progression:
- Cycle 1: T1=14, T2=14, T3=9+0=9 (Str +2), T4=(7+2)×2=18
- Cycle 2: T1=14+2=16, T2=14+2=16, T3=9+2=11 (Str +4), T4=(7+4)×2=22
- Cycle 3: T1=14+4=18, T2=14+4=18, T3=9+4=13 (Str +6), T4=(7+6)×2=26

**Tactics**: High early pressure — 28 damage over T1–T2. Block hard or kill
fast. Inertia's Strength makes everything hit harder each cycle. Kill by T3
(first Inertia) to avoid any Strength gain, or by T4 to limit it to +2. Weak
on T1–T2 cuts the 28 to 21. Ironclad's Strength scaling (Inflame + attacks)
can out-race this. Vulnerable + Bludgeon/Heavy Blade is a strong opener.
[Source verified]

## Terror Eel — 140 HP (A8+: 150)

**Opening rotation (loops):**
- T1: Crash (Attack) — 16 dmg (A9+: 18)
- T2: Thrash (Attack·Buff) — 3×3 = 9 dmg (A9+: 4×3 = 12) + Vigor +6 (self)
- Loops to Crash.

**Vigor**: "Your next Attack deals additional damage." Gained by the Eel
during Thrash (T2). The NEXT attack (Crash, T3) gains +6. Vigor is consumed
on use. Crash is a single hit, so Vigor adds +6 once.

Opening damage pattern: T1 Crash = 16, T2 Thrash = 9 (+Vigor), T3 Crash =
16+6 = 22, T4 Thrash = 9 (+Vigor), T5 Crash = 22, T6 Thrash = 9 (+Vigor)...
So Crash alternates: 16, 22, 16, 22... (or all 22 after the first cycle
since Vigor is always active from the previous Thrash).

Actually: T1 = 16 (no Vigor), T2 = 9 (grants Vigor), T3 = 16+6 = 22 (consumes
Vigor), T4 = 9 (grants Vigor), T5 = 16+6 = 22 (consumes), T6 = 9... So from
T3 onward, Crash is always 22 (Vigor is always available from the previous
Thrash).

**Triggered rotation** (trigger: [UNCERTAIN — wiki says "special power
broken, or dies and revives"]):
- T1: Stunned (Stun) — does nothing
- T2: Terrorize (Debuff) — Vulnerable +99 TO PLAYER. No damage.
- T3: Crash (16) — player has Vulnerable: 16 × 1.5 = 24
- T4: Thrash (9) + Vigor +6 — player Vulnerable: 9 × 1.5 = 14 (≈13.5)
- T5: Crash (16+6 = 22) — player Vulnerable: 22 × 1.5 = 33
- T6: Thrash (9) + Vigor — Vulnerable: 14
- T7: Crash (22) — Vulnerable: 33
- Loops to Crash (T3 position).

Vulnerable +99 means 99 turns of +50% damage taken. Effectively permanent
for this fight.

**Tactics**: Highest HP Act 1 elite — a DPS check. In the opening rotation,
Crash alternates 16/22 (A9: 18/24) — block for the 22 hits. Thrash is
multi-hit (3×3); Weak reduces total by 25% (9→7, 12→9).

In the triggered rotation: Stun (T1) and Terrorize (T2) are two free turns
— push maximum damage. After Terrorize, you have Vulnerable +99: every
incoming attack deals +50%. First Crash = 24, then 33 with Vigor. Block
hard: you need ~24–33 block per Crash turn. Use potions (Strength, Fire,
Block) — this fight needs every advantage.

Applying Vulnerable to the Eel (via Bash, Uppercut) makes YOUR attacks
deal +50% to the Eel. This is always beneficial and does NOT affect the
Eel's attacks on you. [Source verified]

## Ironclad elite comparison (editable)

| Elite | HP | Big hit | Threat | Key card |
|---|---|---|---|---|
| Phantasmal Gardeners | 4×26–31 | scattered 15/turn | Strength snowball | Whirlwind |
| Skulking Colony | 75 | Zoom 14×2 | early burst + Strength | Impervious, Inflame |
| Terror Eel | 140 | Crash 16→22 | DPS check + Vigor | Bludgeon, Strength pot |
