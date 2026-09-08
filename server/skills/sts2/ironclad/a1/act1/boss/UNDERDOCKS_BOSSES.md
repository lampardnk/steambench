---
description: Act 1 Underdocks bosses — Lagavulin Matriarch, Soul Fysh, Waterfall Giant. Verified HP, intent patterns, phase triggers and Ironclad tactics from slaythespire2.net beta.
character: ironclad
act: 1
category: boss
ascension: a1
keys: [ironclad, act1, boss, underdocks, lagavulin matriarch, soul fysh, waterfall giant, steam eruption, intangible, soul siphon, plating, asleep, beckon, explode]
sources: [slaythespire2.net, slaythespire.wiki.gg]
---

# Act 1 — Underdocks bosses

All stats verified from slaythespire2.net beta (v0.111.0, display 2026-06-18),
then cross-checked against slaythespire.wiki.gg, which supplied the powers and
resolved every effect the first source left undefined.
A8 raises HP; A9 raises damage. Installed build may differ.

## How to read entries

- **Debuff** intents are applied TO THE PLAYER by the enemy.
- **Buff** intents are applied TO THE ENEMY ITSELF.
- **Status** intents: effect may be self-applied or undefined on source page.
- Card names here are **examples of a property**, not a shortlist. The Ironclad
  pool is ~90 cards and most never appear in this file. Match the property the
  fight rewards — many small damage instances, one big instance, Block banked for
  a chosen turn, damage to ALL enemies, exhaust/transform — against what this run
  has actually offered you. Read the whole pool with
  `research https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards_List?color=Ironclad`
  instead of narrowing to the few named below.
- Strength/Dexterity on the player: Strength increases your attack damage;
  Dexterity improves your Block from cards. Soul Siphon strips BOTH.

## Lagavulin Matriarch — 222 HP (A8+: 233)

**Gimmick:** it hands you a three-turn setup window and then permanently strips
2 Strength and 2 Dexterity every fourth turn — so the fight is about what you
build during the sleep and how little that build depends on per-hit numbers.

**Opening — Asleep 3 with Plating 12:**
- **Asleep** (Duration) — "Awakens upon losing HP or after X turns." It sleeps
  for **3 turns**, or until it takes **unblocked damage**, whichever comes first.
- **Plating 12** (Intensity and Duration) — "At the end of your turn, gain X
  Block. Plating is reduced by 1 at the start of your turn." It is accruing
  Block while it sleeps; waking it removes the Plating entirely.

Three free turns is the largest setup window any Act 1 boss gives you, and
attacking into it ends the window early. [wiki.gg]

**Awake rotation** (four moves, loops):
- T1: Slash (Attack) — 19 dmg (A9+: 21). Single hit, no block.
- T2: Disembowel (Attack) — 9×2 = 18 dmg (A9+: 10×2 = 20). Two hits.
- T3: Slash2 (Attack·Defend) — 12 dmg (A9+: 14) + 12 block (A8+: 14) (self).
  A distinct move from T1's Slash: less damage, but it gains Block.
- T4: Soul Siphon (Buff·Debuff) — Strength +2 (self) + Strength -2 TO
  PLAYER + Dexterity -2 TO PLAYER. No damage.
- Loops to Slash (19 dmg).

**Soul Siphon**: the Matriarch gains +2 Strength (self), and you **permanently**
lose 2 Strength and 2 Dexterity — every fourth turn, cumulatively. Dexterity
improves Block gained from cards, so your block shrinks alongside your damage.

Which of your cards this hurts is not uniform, and it decides what to draft and
what to play: the penalty applies to **each instance** of damage or Block. A
card that deals or blocks in many small instances loses value fast, while one
big instance barely notices. Cards that survive it: Bludgeon (32 in one hit),
Break, Mangle, Cinder, Hemokinesis, and single large Block like Impervious or
Blood Wall. Cards it guts: Conflagration (4 instances), Sword Boomerang (3),
Whirlwind (X), Twin Strike, Thunderclap, Tear Asunder — every instance pays the
penalty separately. This is the exact inverse of Vantom's Slippery, where many
small instances are what you want — do not carry one lesson into the other
fight. [wiki.gg]

**Tactics**: the three sleeping turns are the fight's most valuable resource —
the wiki calls them out as making expensive Powers like Demon Form easy to land.
Spend them on setup, not on chip damage: unblocked damage wakes it early and
throws away the rest of the window. Bank Strength, Powers and Block, then open.

The awake cycle hits hard: 19, 18, 12+block, then Soul Siphon. Each Siphon is a
permanent −2/−2, so the fight gets harder the longer it runs and re-buffing
(Inflame, Demon Form, Rupture, Brand, Fight Me!) only treads water. Prefer to arrive with a build that
survives the subtraction rather than one that must out-pace it.

Slash2's 12 block means you need surplus damage to punch through. Weak on the
Matriarch (Thunderclap, Uppercut) cuts Disembowel from 18 to ~13 — multi-hit
attacks lose the most to Weak, so apply it before its two-hit turn. This is the
hardest Act 1 boss for a Strength-reliant Ironclad.
[Rotation and damage from slaythespire2.net; Asleep, Plating and the
per-instance Siphon rule from wiki.gg]

## Soul Fysh — 211 HP (A8+: 221)

**Gimmick:** it poisons your deck with Beckon status cards that bleed you if you
hold them, then goes Intangible for the turn you most want to hit it — so deck
hygiene and hitting in the right window matter more than raw damage.

**Rotation (loops):**
- T1: Beckon (Status) — no damage. Shuffles **2 Beckon into your deck**: one
  into the draw pile, one into the discard pile.
- T2: De-Gas (Attack) — 16 dmg (A9+: 18)
- T3: Gaze (Attack·Status) — 7 dmg (A9+: 8) + shuffles **1 more Beckon** into
  your discard pile.
- T4: Fade (Buff) — Intangible +2 (self).
- T5: Scream (Attack·Debuff) — 13 dmg (A9+: 15) + Vulnerable +3 TO PLAYER
- Loops to Beckon.

**Beckon** (the card it gives you) — 1 Energy, Status: "At the end of your turn,
if this is in your Hand, lose 6 HP." Three arrive per cycle. Holding one costs
6 HP; playing one costs an Energy you needed elsewhere. Exhausting or
transforming it removes it for good, which is why that beats discarding it back
into the pile. [wiki.gg]

**Intangible** (Duration) — "Reduce all damage taken and HP loss to 1. Lasts for
X turns." Applied to the Fysh. Every source of damage is reduced to 1, so
multi-hit chips through (5 hits = 5 damage) while one big hit deals 1.

Fade grants 2, but **it is worth only one of your turns**: the first stack fades
instantly on the turn transition out of the Fysh's turn, so it effectively holds
1 Intangible against you. Damage that is not an attack — Doom-style effects —
ignores Intangible entirely. [wiki.gg]

**Vulnerable +3**: Applied to YOU — "Receive 50% more damage from Attacks for X
turns." After Scream, the next De-Gas (16) hits for 24 (A9: 18 → 27).

**Tactics**: Beckon (T1) deals no damage, but it is not a free turn — it is when
your deck gets worse. Three Beckon arrive per cycle, each a 1-Energy card that
costs 6 HP if it is still in hand at end of turn. Over a long fight that is the
real damage source. Exhaust or transform them when you can; discarding only delays them. Second Wind
is the standout answer — Beckon is a Status, so it exhausts every copy in hand
*and* converts each into Block. Fiend Fire and Stoke exhaust the whole hand,
while Burning Pact, True Grit and Brand each remove one.

De-Gas (16/18) is the big hit; block for it. Fade costs you **one** turn of
useful damage, not two — spend that turn blocking or setting up rather than
throwing a heavy attack into it, and note that multi-hit still chips (1 per
hit). Right after Fade is your window: Scream then applies Vulnerable +3 to you,
so the following De-Gas hits for 24 (A9: 27) — block hard there. The cycle is 5
turns, so plan Strength scaling to land the big hit on the turn Fade drops.
Vulnerable applied to the Fysh (Uppercut, Thunderclap) amplifies that burst.
[Rotation and damage from slaythespire2.net, De-Gas A9 and every Beckon/
Intangible detail from wiki.gg]

## Waterfall Giant — 240 HP (A8+: 250)

**Gimmick:** killing it is what sets off the bomb — it banks Steam Eruption all
fight, then on death explodes for exactly that total, so the fight is won by
killing it fast *and* holding enough Block for one final turn.

**Opening rotation:**
- T1: Pressurize (Buff) — Steam Eruption +15 (A9+: +20). No damage.
- T2: Stomp (Attack·Buff·Debuff) — 15 dmg (A9+: 16) + Steam Eruption +3 +
  Weak +1 TO PLAYER
- T3: Ram (Attack·Buff) — 10 dmg (A9+: 11) + Steam Eruption +3
- T4: Siphon (Buff·Heal) — heals **10 HP** (A8+: 15) per player + Steam
  Eruption +3. No damage.
- T5: Pressure Gun (Attack) — **20 dmg (A9+: 23), and it increases by 5 with
  every use** + Steam Eruption +3. This is the hardest-hitting move in the
  rotation and the only one that grows.
- T6: Pressure Up (Attack·Buff) — 13 dmg (A9+: 14) + Steam Eruption +3
- Loops to Stomp (T2), repeating T2–T6.

**Steam Eruption** (Intensity) — "When killed, deals X damage at the end of your
next turn." The damage **is** the accumulated stack total; there is no separate
formula. [wiki.gg]

Steam Eruption accumulation: T1=15, T2=18, T3=21, T4=24, T5=27, T6=30,
T7=33 (loop Stomp), T8=36, T9=39, T10=42, T11=45, T12=48...

**Death sequence** (trigger: reducing it to 0 HP *while it holds Steam
Eruption*):
- About To Blow — it becomes invulnerable, cleanses all its buffs and debuffs,
  and prepares to explode. Its HP bar reads infinity; it is not killable in
  practice during this turn.
- Explode — deals damage equal to its stored Steam Eruption, then it dies.

The one exception: killed with **no** Steam Eruption on it, it dies normally and
the sequence never happens. [wiki.gg]

**Weak +1**: Applied to YOU on T2 (Stomp). Your attacks deal 25% less
damage. Prioritize Strength (Inflame) to overcome the reduction.

**Tactics**: you cannot dodge the explosion by killing it faster — killing it is
the trigger. What killing faster buys you is a *smaller* explosion, because the
damage equals the stacks it has banked (30 by T6, 48 by T12). So the fight has
two requirements at once: end it early, and still have Block in hand on the
turn it goes off.

That second requirement is a drafting and play constraint, not an afterthought.
The wiki's advice is to raise the Block density of your deck over the fight so
the final hand is not all attacks. Ironclad has plenty to draft toward: Blood
Wall (16 for 2 HP), Impervious (30), Shrug It Off, True Grit, Evil Eye, Expect a
Fight (scales with Strength), Second Wind, Colossus, Flame Barrier, or a standing
source like Crimson Mantle, Barricade, Unmovable or Stone Armor. Thin the attacks
with Burning Pact, True Grit or Brand, and note that **Anger is actively
dangerous here** — it copies itself into your discard pile, so it steadily raises
the odds of an all-attack hand on the turn that kills you. Hold a Block card back
for the Explode turn rather than spending everything on the kill.

Siphon (T4) is the only genuine low-damage window, and it still heals the Giant
10 HP (A8+: 15) — pressure it, but know you are racing a heal. Pressure Gun (T5)
is the opposite of a free window: 20 damage climbing by 5 every use, the hardest
hit in the fight. Stomp applies Weak (−25% your damage) — Inflame to overcome.
[Rotation from slaythespire2.net; Pressure Gun scaling, Siphon heal, the
About To Blow / Explode sequence and the block-density advice from wiki.gg]
