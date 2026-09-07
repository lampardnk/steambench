---
description: Act 1 Overgrowth elites — Bygone Effigy, Byrdonis, Phrog Parasite. Verified HP, intents, patterns and Ironclad tactics from slaythespire2.net beta.
character: ironclad
act: 1
category: elite
ascension: a1
keys: [ironclad, act1, elite, overgrowth, bygone effigy, byrdonis, phrog parasite, wriggler, infection]
sources: [slaythespire2.net]
---

# Act 1 — Overgrowth elites

All stats verified from slaythespire2.net beta (v0.111.0, display 2026-06-18).
A8 raises HP; A9 raises damage. Installed build may differ.

## How to read entries

- **Debuff** intents are applied TO THE PLAYER by the enemy.
- **Buff** intents are applied TO THE ENEMY ITSELF.
- **Status** intents: self-applied status counters (like Ritual). [UNCERTAIN
  for Infection — effect not defined on source pages.]
- "Triggered during battle" = rotation switch on a condition (wiki: "e.g. a
  special power is broken, or it dies and revives"). Exact triggers are
  [UNCERTAIN — not fully defined on source pages].

Never enter an elite below 60% HP (survival default from controls/CONTROLS.md).

## Bygone Effigy — 127 HP (A8+: 132)

**Opening rotation:**
- T1: Sleep (Stun) — does nothing. Free setup turn.
- T2: Wake (Buff) — Strength +10 (self). No damage.
- T3+: Slashes (Attack) — 13 dmg (A9+: 15) + 10 Strength = 23 (A9+: 25).
  Keeps using Slashes every turn.

**Triggered rotation** (trigger condition: [UNCERTAIN — wiki says "special
power broken, or dies and revives"]):
- T1: Sleep (Stun) — does nothing.
- T2+: Slashes (Attack) — 13 dmg (A9+: 15). Keeps using Slashes.

The triggered rotation does NOT include Wake. Strength from the opening Wake
(+10) is permanent and does not increase further — there is no mechanism to
gain additional Strength in either rotation. Slashes is a flat 23 (A9+: 25)
every turn after Wake. [UNCERTAIN — if the trigger resets stats (e.g. on
revive), Slashes may drop to base 13. Verify in-game.]

**Tactics**: T1 Sleep is a free Power turn — play Inflame or push damage.
T2 Wake is also no damage — push damage. From T3 on, Slashes hits flat 23 every
turn. There is no scaling beyond the initial +10 — the fight is a steady 23
dmg/turn check, not a snowball. Kill in 5–6 turns (127 HP / 25 dmg per turn ≈
5 turns). Block 23 each turn with Shrug + Defend, or race with Strength-scaled
attacks. [Source: slaythespire2.net/monster/bygone-effigy?v=beta]

## Byrdonis — 81–84 HP (A8+: 90)

No "Appears with" listed. [UNCERTAIN — prior notes mentioned a "Byrdpip"
summon, but the Byrdonis source page shows no summon move. Verify in-game.]

**Rotation (loops):**
- T1: Swoop (Attack) — 17 dmg (A9+: 19)
- T2: Peck (Attack) — 3×3 = 9 dmg (A9+: 4×3 = 12)
- Loops to Swoop.

No self-buffs, no debuffs, no scaling. Pure damage loop.

**Tactics**: Swoop (17/19) is the big hit — block for it. Peck is multi-hit
(3×3), so Weak reduces total by 25% (9 → 7, 12 → 9). Moderate HP (81–84) —
kill in 3–4 turns with focused attacks. No scaling means the fight is safe
to take slowly if needed. Vulnerable + heavy hit (Bludgeon, Carnage) for
burst. [Source: slaythespire2.net/monster/byrdonis?v=beta]

## Phrog Parasite — 61–64 HP (A8+: 66–68)

Appears with Wriggler (17–21 HP, A8+: 18–22).

**Phrog Parasite rotation (loops):**
- T1: Infect (Status) — +3 Infection. No damage.
  [UNCERTAIN — Infection effect not defined on source page. The Status intent
  type suggests self-application (like Ritual). Verify in-game.]
- T2: Lash (Attack) — 4×4 = 16 dmg (A9+: 5×4 = 20). Four hits of 4 each.
- Loops to Infect.

The Phrog Parasite does NOT gain Strength in its rotation. Lash damage is
flat 16 (A9+: 20) unless Infection modifies it (undefined).

**Wriggler rotation:**
- Opening: T1 Nasty Bite (Attack) — 6 dmg (A9+: 7) → T2 Wriggle (Buff·Status)
  — Strength +2 + Infection +1 (both self) → loops to Nasty Bite.
- Alternate ("In wriggler2"): T1 Wriggle → T2 Nasty Bite → loops to Wriggle.
- Triggered: T1 Spawned (Stun, 1 turn) → special condition.

Wriggle is a self-buff: Strength +2 to the WRIGGLER. This makes the
Wriggler's Nasty Bite grow: 6 → 8 → 10 → 12... It does NOT affect the Phrog
Parasite's Lash. Each entity's Strength only affects that entity's own
attacks.

**Tactics**: Kill Wriggler first (17–21 HP, 1–2 attacks) to stop its Strength
scaling on Nasty Bite. The Phrog's Lash is flat 16 (A9+: 20) — no Strength
scaling on the Phrog itself. Infect turn (T1) deals no damage — push damage.
Weak reduces Lash from 16 to 12 (4 hits × 25% reduction each). Applying
Vulnerable to the Phrog (via Bash, Uppercut) makes YOUR attacks deal +50%
to the Phrog — this is always beneficial and does NOT affect the Phrog's
Lash damage to you. Use Vulnerable freely to burst the Phrog down.
[Source: slaythespire2.net/monster/phrog-parasite?v=beta,
slaythespire2.net/monster/wriggler?v=beta]

## Ironclad elite prep checklist (editable)

- Need ~25+ damage per turn by first elite.
- Bring at least one Strength source (Inflame, Spot Weakness, Demon Form) for
  consistent output across all three elites.
- Weak application (Thunderclap, Uppercut) reduces multi-hit attacks (Peck
  3×3, Lash 4×4) substantially — 25% total reduction.
- Impervious or Shrug It Off for the big single hits (Swoop 17, Slashes 23).
- Don't hoard potions: use Strength/Fire/Block potions in elite fights.
- Vulnerable (from Bash) is always good — it makes your attacks deal +50% to
  the target. It does NOT make the target's attacks hit you harder.
