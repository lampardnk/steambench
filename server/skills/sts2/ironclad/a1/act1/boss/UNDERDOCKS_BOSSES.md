---
description: Act 1 Underdocks bosses — Lagavulin Matriarch, Soul Fysh, Waterfall Giant. Verified HP, intent patterns, phase triggers and Ironclad tactics from slaythespire2.net beta.
character: ironclad
act: 1
category: boss
ascension: a1
keys: [ironclad, act1, boss, underdocks, lagavulin matriarch, soul fysh, waterfall giant, steam eruption, intangible, soul siphon]
sources: [slaythespire2.net]
---

# Act 1 — Underdocks bosses

All stats verified from slaythespire2.net beta (v0.111.0, display 2026-06-18).
A8 raises HP; A9 raises damage. Installed build may differ.

## How to read entries

- **Debuff** intents are applied TO THE PLAYER by the enemy.
- **Buff** intents are applied TO THE ENEMY ITSELF.
- **Status** intents: effect may be self-applied or undefined on source page.
- Strength/Dexterity on the player: Strength increases your attack damage;
  Dexterity improves your Block from cards. Soul Siphon strips BOTH.

## Lagavulin Matriarch — 222 HP (A8+: 233)

**Opening:**
- T1: Sleep (Stun) — does nothing. Free setup turn.

**Awake rotation** ("While not asleep," loops):
- T1: Slash (Attack) — 19 dmg (A9+: 21). Single hit, no block.
- T2: Disembowel (Attack) — 9×2 = 18 dmg (A9+: 10×2 = 20). Two hits.
- T3: Slash (Attack·Defend) — 12 dmg (A9+: 14) + 12 block (A9+: 14) (self).
  Note: this is a DIFFERENT Slash from T1 — it deals less damage but gains
  12 block for the Matriarch.
- T4: Soul Siphon (Buff·Debuff) — Strength +2 (self) + Strength -2 TO
  PLAYER + Dexterity -2 TO PLAYER. No damage.
- Loops to Slash (19 dmg).

**Soul Siphon**: The Matriarch gains +2 Strength (self), and you lose -2
Strength and -2 Dexterity. Dexterity: "improves Block gained from cards."
Losing Dexterity means your block cards give less block. Combined with
Strength loss, this cripples Ironclad's scaling engine.

**Tactics**: T1 Sleep is a free Power turn — play Inflame, Demon Form, or
Barricade. The awake cycle hits hard: 19, 18, 12+block, then Soul Siphon
strips your Strength and Dexterity (-2 each). Soul Siphon is devastating for
Ironclad — your Strength scaling is your engine. Kill before T4 (Soul
Siphon) if possible, or re-apply Strength after (Inflame, Spot Weakness).

The 12-block Slash (T3) means you need extra damage to punch through.
Applying Weak to the Matriarch (via Thunderclap, Uppercut) reduces
Disembowel from 18 to ~13 (25% reduction on multi-hit). Strength-pot +
Inflame before T1 Sleep ends is ideal. This is the hardest Act 1 boss for
Strength-reliant Ironclad. [Source verified]

## Soul Fysh — 211 HP (A8+: 221)

**Rotation (loops):**
- T1: Beckon (Status) — no damage. [UNCERTAIN — effect not defined on source
  page. Verify in-game.]
- T2: De-Gas (Attack) — 16 dmg (A9+: 17)
- T3: Gaze (Attack·Status) — 7 dmg (A9+: 8) + undefined status.
  [UNCERTAIN — what status does Gaze apply? Verify in-game.]
- T4: Fade (Buff) — Intangible +2 (self). "Reduce all damage taken and HP
  loss to 1 this turn." For 2 turns, every hit deals 1 damage to the Fysh.
- T5: Scream (Attack·Debuff) — 13 dmg (A9+: 15) + Vulnerable +3 TO PLAYER
- Loops to Beckon.

**Intangible**: Applied to the Fysh (self-buff). For 2 turns, every source
of damage to the Fysh is reduced to 1. Multi-hit attacks deal 1 per hit
(Whirlwind with 5 hits = 5 damage). Single big hits are wasted (Bludgeon
= 1 damage).

**Vulnerable +3**: Applied to YOU. While Vulnerable, incoming attacks deal
+50% to you. After Scream, De-Gas (16) becomes 16 × 1.5 = 24 (A9: 17 × 1.5
= 26).

**Tactics**: Beckon (T1) is a free turn — set up Strength/Powers. De-Gas
(16/17) is the big hit; block for it. Fade (Intangible +2) is the key
mechanic: for 2 turns, every hit deals 1 damage — don't waste big attacks
during Fade. Instead, block and set up. Multi-hit attacks (Whirlwind, Twin
Strike, Pommel Strike) get 1 damage per hit and can chip through Intangible.
After Fade ends, Scream (13/15) applies Vulnerable +3 to you — you take
50% more from the next De-Gas (24/26). Block hard post-Scream. The cycle is
5 turns — plan Strength scaling to land a big hit right after Fade ends.
Applying Vulnerable to the Fysh (from Uppercut/Thunderclap) amplifies your
post-Fade burst — always beneficial. [Source verified]

## Waterfall Giant — 240 HP (A8+: 250)

**Opening rotation:**
- T1: Pressurize (Buff) — Steam Eruption +15 (A9+: +20). No damage.
- T2: Stomp (Attack·Buff·Debuff) — 15 dmg (A9+: 16) + Steam Eruption +3 +
  Weak +1 TO PLAYER
- T3: Ram (Attack·Buff) — 10 dmg (A9+: 11) + Steam Eruption +3
- T4: Siphon (Buff·Heal) — Steam Eruption +3. No damage, heals the Giant.
  [UNCERTAIN — heal amount not listed on source page.]
- T5: Pressure Gun (Attack) — Steam Eruption +3. No damage value listed.
  [UNCERTAIN — does Pressure Gun deal damage? Source shows no damage value.]
- T6: Pressure Up (Attack·Buff) — 13 dmg (A9+: 14) + Steam Eruption +3
- Loops to Stomp (T2), repeating T2–T6.

**Steam Eruption**: "When killed, deals damage at the end of your next
turn." The Giant accumulates Steam Eruption stacks throughout the fight.
When the Giant dies, the total stacks deal damage. [UNCERTAIN — exact damage
formula. Presumably total stacks = damage, but not confirmed on source.]

Steam Eruption accumulation: T1=15, T2=18, T3=21, T4=24, T5=27, T6=30,
T7=33 (loop Stomp), T8=36, T9=39, T10=42, T11=45, T12=48...

**Triggered rotation** (trigger: [UNCERTAIN — wiki says "special power
broken, or dies and revives"]):
- T1: About to Blow (Stun, used once)
- T2+: Explode (Attack). Keeps using Explode every turn.
  [UNCERTAIN — Explode damage not listed on source page.]

**Weak +1**: Applied to YOU on T2 (Stomp). Your attacks deal 25% less
damage. Prioritize Strength (Inflame) to overcome the reduction.

**Tactics**: Steam Eruption is a doom mechanic — it stacks every turn and
deals damage when the Giant dies. The longer the fight, the more stacks
(30 by T6, 48 by T12). Kill fast to minimize Steam Eruption, but be
prepared for the death explosion. Stomp applies Weak (-25% your damage) —
Inflame to overcome it. Siphon (T4) and Pressure Gun (T5) are low/no-damage
turns — push damage during these windows. The triggered Explode phase
happens on death — block for it. [UNCERTAIN — Explode damage unknown.]
This is a DPS race against a stacking mechanic — don't turtle.
[Source verified]

## Ironclad boss comparison (editable)

| Boss | HP | Free turn | Key mechanic | Win condition |
|---|---|---|---|---|
| Lagavulin Matriarch | 222 | T1 Sleep | Soul Siphon (-2 Str/Dex) | Kill before Siphon or re-buff |
| Soul Fysh | 211 | T1 Beckon | Intangible +2 (Fade) | Burst after Fade, block Scream |
| Waterfall Giant | 240 | none | Steam Eruption stacks | DPS race, block Explode |
