---
description: Act 1 Overgrowth normal encounters — verified mob HP, intents, damage scaling, and Ironclad tactics. All stats sourced from slaythespire2.net beta.
character: ironclad
act: 1
category: normal
ascension: a1
keys: [ironclad, act1, normal, overgrowth, cubex construct, fogmog, flyconid, snapping jaxfruit, fuzzy wurm crawler, shrinker beetle, slithering strangler, mawler, nibbit, vine shambler, eye with teeth, inklet, leaf slime, twig slime, ruby raiders, axe raider, assassin raider, brute raider, crossbow raider, tracker raider, wriggler, slimed, shrink, constrict]
sources: [slaythespire2.net, slaythespire.wiki.gg]
---

# Act 1 — Overgrowth normal encounters

All stats verified from slaythespire2.net beta (v0.111.0, display 2026-06-18),
then completed and corrected against slaythespire.wiki.gg, which resolved every
effect the first source left undefined and supplied two encounter groups the
first source omitted entirely.
A8 raises HP; A9 raises damage. Installed build may differ — treat in-game
intent as authoritative when it conflicts.

## How to read entries

- **Debuff** intents are applied TO THE PLAYER by the enemy.
- **Buff** intents are applied TO THE ENEMY ITSELF.
- **Attack · Buff/Debuff** combines damage with a self-buff or player-debuff.
- "Appears with" on the wiki = possible companions across encounters, NOT a
  guaranteed simultaneous spawn. Actual encounter composition varies.
- Several enemies here pick moves at random rather than cycling. Where that is
  the case the probabilities are given; read the live intent regardless.
- Card names are examples of a property, not a shortlist. Read the pool with
  `research https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards_List?color=Ironclad`.

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

- **Weakening Spores** (Debuff) — applies **2 Vulnerable** TO THE PLAYER. No
  damage. While Vulnerable you take 50% more from attacks.
- **Frail Spores** (Attack·Debuff) — 8 dmg (A9+: 9) + **2 Frail** TO THE PLAYER
  (you gain 25% less Block from cards).
- **Smash** (Attack) — 11 dmg (A9+: 12).

**Move selection.** Turn 1 is Frail Spores (2/3) or Smash (1/3) — it can never
open with Weakening Spores. Every turn after is Weakening Spores (3/6), Frail
Spores (2/6) or Smash (1/6), and it cannot repeat the move it just used.

So Weakening Spores is its *most likely* move from turn 2 onward, and the turn
after it lands is when Frail Spores or Smash hits you at +50%.

**Tactics**: low HP (47–49) and no scaling — the danger is entirely the debuff
pair, which is worst when other enemies are alive to exploit the Vulnerable.
Kill it before it can set up the second half of that pattern. [Damage from
slaythespire2.net; move names and probabilities from wiki.gg]

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

- T1: **Shrinker** (Debuff) — applies **Shrink**. No damage.
- Then alternates **Chomp** — 7 dmg (A9+: 8) — and **Stomp** — 13 dmg (A9+: 14).

**Shrink** (Duration 2, does not stack) is applied **to you**: your Attack cards
deal 30% less damage for 2 turns. The earlier ambiguity about who receives it is
resolved — wiki.gg notes that the summon Osty "is not affected by Shrink and
deals full damage with his own Attack cards", which only makes sense if Shrink
sits on the player.

**Tactics**: the opening Shrinker turn deals no damage, but it is also the worst
turn to spend your biggest attack, because the next two turns of your damage are
cut by 30%. Push cheap damage or set up while it is active, and land heavy hits
once it expires. Stomp (13/14) is the hit to block for. At 38–40 HP it dies in
2–3 clean attacks. [Damage from slaythespire2.net; Shrink's duration, stacking
and receiver from wiki.gg]

### Slithering Strangler — 53–55 HP (A8+: 54–56)

- **Constrict** (Debuff) — applies **3 Constrict** TO THE PLAYER.
- **Thwack** (Attack·Defend) — 7 dmg (A9+: 8) + gains 5 Block.
- **Lash** (Attack) — 12 dmg (A9+: 13).

**Pattern:** Constrict → 50/50 Thwack or Lash → **Constrict again** → 50/50 →
and so on. It applies Constrict on every other turn, not once.

**Constrict** (Intensity): "While the Slithering Strangler is alive, at the end
of your turn, take X damage." Because it re-applies every second turn, the
stacks accumulate — 3, then 6, then 9 — so the passive drain grows steadily and
only stops when the Strangler dies.

**Tactics**: this is a damage race against a stack that compounds every other
turn, not a fight you can grind. Thwack's 5 Block makes trading on those turns
inefficient, so save your heavy hits for Lash turns. Killing it removes all
Constrict damage at once, which makes finishing it worth more than the HP the
final push costs. [Damage from slaythespire2.net; Constrict's wording and the
re-application pattern from wiki.gg]

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

### Eye With Teeth (Fogmog summon) — 6 HP

- **Illusion** (does not stack): "When this dies, it revives next turn at full
  HP."
- **Distract** — shuffles **3 Dazed** into your discard pile. Every turn.

It deals **no damage at all** — it is one of only four enemies in the game
incapable of dealing damage. The earlier description of it as "chip damage" was
wrong in both directions: it cannot hurt you, and killing it accomplishes
nothing because Illusion revives it at full HP the next turn.

**Tactics**: never spend damage on it. Its whole function is to bury your draw
pile in Dazed, which makes the fight worse the longer it runs — so the answer is
to kill Fogmog quickly, not to clear the summon. [wiki.gg]

### Inklet — 11–17 HP each (A8+: 12–18), always 3 of them

Each Inklet starts with **Slippery 1** — the same counter Vantom uses: the next
1 time it loses HP, it only loses 1 HP instead. One throwaway hit per Inklet
clears it.

- **Jab** — 3 dmg (A9+: 4) · **Windup Punch** — 2×3 = 6 dmg (A9+: 3×3 = 9) ·
  **Piercing Gaze** — 10 dmg (A9+: 11).
- The two outer Inklets usually open with Jab; the middle one always opens with
  Windup Punch. After Windup Punch or Piercing Gaze it always uses Jab; after
  Jab it picks randomly between Piercing Gaze and Windup Punch.

**Tactics**: three bodies each holding one Slippery stack means your first hit
on each is worth 1 damage regardless of size. Cheap wide damage strips all three
stacks far more efficiently than one big attack, which wastes its entire value
on a single stack.

### Slimes

Four varieties, appearing together or as companions. All of them shuffle
**Slimed** status cards into your discard pile rather than dealing damage on
those turns.

| Slime | HP (A8+) | Moves |
|---|---|---|
| Leaf Slime (S) | 11–15 (12–16) | Tackle 3 (4) · Goop: 1 Slimed. Random each turn, no repeats. |
| Leaf Slime (M) | 32–35 (33–36) | Clump Shot 8 (9) · Sticky Shot: 2 Slimed. Opens Sticky Shot, then alternates. |
| Twig Slime (S) | 7–11 (8–12) | Tackle 4 (5), every turn. |
| Twig Slime (M) | 26–28 (27–29) | Chomp 11 (12) · Sticky Shot: 1 Slimed. Opens Sticky Shot, then 67% Chomp / 33% Sticky Shot, never Sticky twice running. |

**Tactics**: the damage is low; the cost is deck pollution that persists after
the fight. A long slime fight leaves you carrying Slimed into the next one, so
speed matters more than the incoming damage suggests.

### Ruby Raiders — 3 per encounter, drawn from 5 types with no duplicates

| Raider | HP (A8+) | Pattern |
|---|---|---|
| Axe Raider | 20–22 (21–23) | Swing 5 (6) + gains 5 (6) Block · Swing · Big Swing 12 (13). Fixed cycle. |
| Assassin Raider | 18–23 (19–24) | Killshot 10 (11), every turn. |
| Brute Raider | 30–33 (31–34) | Beat 7 (8) · Clap: gains **3 Strength**. Alternates, starts on Beat. |
| Crossbow Raider | 18–21 (19–22) | Reload: gains 3 Block · **Fire! 14 (16)**. Alternates, starts on Reload. |
| Tracker Raider | 21–25 (22–26) | Track: applies **2 Frail** · Unleash the Hounds **1×8** (1×9). Opens Track, then Hounds every turn. |

**Tactics**: which three you face changes the fight completely. Brute Raider is
the only one that scales, so it is the one that punishes a slow fight. Crossbow
Raider telegraphs perfectly — Fire! only ever lands on the turn after Reload.
The Tracker Raider has an exploitable quirk: its hits are 1 damage each, so
**Weak rounds every hit down to 0** and shuts it off completely. Damage to all
enemies is strong here given three low-HP bodies. [wiki.gg]

### Wriggler — 17–21 HP (A8+: 18–22)

Appears as 4 in the Dense Vegetation event, and is summoned by the Phrog
Parasite elite on its death.

- **Nasty Bite** — 6 dmg (A9+: 7).
- **Wriggle** — shuffles 1 **Infection** into your discard pile and gains **2
  Strength**.
- They alternate, and start offset from each other: odd-numbered ones open on
  Nasty Bite, even-numbered ones on Wriggle.

## Ironclad strategy notes (editable)

- Burning Blood heals 6 HP post-combat — trading HP for speed is acceptable.
- Prioritize attack cards in rewards. The pool is wide — Uppercut, Pommel
  Strike, Twin Strike, Bludgeon, Cinder, Iron Wave, Hemokinesis, Rampage,
  Unrelenting and Thunderclap are all live options, and which one is right
  depends on the fight, not on this list. One block card is enough early.
- Against Strength-scalers (Cubex Construct, Fuzzy Wurm Crawler, Snapping
  Jaxfruit, Nibbit): kill speed matters more than block. Every turn they
  survive, their damage increases.
- Against debuffers (Flyconid, Slithering Strangler, Shrinker Beetle): kill
  fast to stop debuff accumulation. Vulnerable/Frail/Constrict/Tangled all
  make you more fragile, and Constrict compounds every other turn.
- Fogmog's Eye With Teeth summon deals no damage and revives when killed — kill
  Fogmog and ignore the summon entirely.
- Several Overgrowth fights are decided by the *number* of damage instances
  rather than their size: Inklets hold a Slippery stack each, and the Tracker
  Raider's eight 1-damage hits go to zero under Weak.
