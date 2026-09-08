---
description: Act 1 Overgrowth bosses — Ceremonial Beast, The Kin, Vantom. Verified HP, intent patterns, phase triggers and Ironclad tactics from slaythespire2.net beta.
character: ironclad
act: 1
category: boss
ascension: a1
keys: [ironclad, act1, boss, overgrowth, ceremonial beast, the kin, kin follower, kin priest, vantom, plow, ringing, wound, slippery, counter, multi-hit, aoe, drafting]
sources: [slaythespire2.net, slaythespire.wiki.gg]
---

# Act 1 — Overgrowth bosses

All stats verified from slaythespire2.net beta (v0.111.0, display 2026-06-18).
A8 raises HP; A9 raises damage. Installed build may differ.

Vantom's Slippery power comes from slaythespire.wiki.gg instead, which also
disagrees with slaythespire2.net on two Dismember details — both flagged below.

## How to read entries

- **Debuff** intents are applied TO THE PLAYER by the enemy.
- **Buff** intents are applied TO THE ENEMY ITSELF.
- **Status** intents: self-applied counters or cards added to player's pile.
- Card names here are **examples of a property**, not a shortlist. The Ironclad
  pool is ~90 cards and most never appear in this file. Match the property the
  fight rewards — many small damage instances, one big instance, Block banked for
  a chosen turn, damage to ALL enemies, exhaust/transform — against what this run
  has actually offered you. Read the whole pool with
  `research https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards_List?color=Ironclad`
  instead of narrowing to the few named below.
- Strength accumulates on the entity that gained it and is not removed by
  ordinary play — but a specific effect can strip it. Ceremonial Beast's Plow
  stun removes all of its own Strength; do not assume a phase transition
  carries Strength across.

## Ceremonial Beast — 252 HP (A8+: 262)

**Gimmick:** a two-phase fight where crossing the Plow threshold stuns it and
wipes all the Strength it built, then Phase 2's Ringing caps you at one card per
turn — so what a single card does is worth more than how many cards you hold.

**Opening rotation:**
- T1: Stamp (Buff) — Plow +150 (A9+: +160). Stack type Intensity: "The first
  time this enemy's HP reaches X or below, it becomes Stunned **and loses all
  its Strength**." No damage, no Strength.
- T2+: Plow (Attack·Buff) — 18 dmg (A9+: 20) + Strength +2 (self). Keeps
  using Plow every turn.

Phase 1 damage: T2=18, T3=20, T4=22, T5=24... (+2 Strength per turn, applied
to self). All of it is wiped when the threshold is crossed.

Edge case: if the Beast's HP is already at or below the threshold on turn 1
before it gains Plow, it does **not** stun on gaining Plow. It acts normally
until it next loses any HP, which triggers the stun then. [wiki.gg]

**Triggered rotation** (when HP ≤ 150 — Plow stun fires):
- T1: Stun — does nothing, and its Strength is now 0. A free turn for you.
- T2: Beast Cry (Debuff) — Ringing +1 TO PLAYER. "You can only play 1 card
  this turn."
- T3: Stomp (Attack) — 15 dmg (A9+: 17)
- T4: Crush (Attack·Buff) — 17 dmg (A9+: 19) + Strength +3 (A9+: +4) (self)
- Loops to Beast Cry (T2), repeating T2–T4.

**Phase 2 starts from 0 Strength.** The stun strips everything Phase 1 built,
so Phase 2 scales only from Crush's own +3 (A9+: +4) per cycle:

| Cycle | Beast Cry | Stomp | Crush | Strength after |
|---|---|---|---|---|
| 1 | Ringing, 0 dmg | 15 | 17 | 3 |
| 2 | Ringing, 0 dmg | 18 | 20 | 6 |
| 3 | Ringing, 0 dmg | 21 | 23 | 9 |
| 4 | Ringing, 0 dmg | 24 | 26 | 12 |

Racing Phase 1 is still right, but for a different reason than carrying less
Strength across: every extra Plow turn is escalating damage *to you* (18, 20,
22, 24...) for no lasting benefit to the Beast.

**Tactics**: Phase 1 is a race to 150 HP (deal 102 damage). Push maximum damage
early — don't over-block, since every extra Plow turn hits you harder than the
last. At 150 HP the Beast stuns, loses all its Strength, and gives you a free
turn; then Phase 2 begins from scratch. Beast Cry (Ringing +1) limits you to 1
card/turn — play the single card with the highest standalone payoff. Candidates
across the pool: a big attack (Bludgeon 32, Break 20 + 5 Vulnerable, Mangle 20
stripping 10 enemy Strength, Cinder 18, Hemokinesis 15), a big Block (Impervious
30, Blood Wall 16, Expect a Fight), or a Power that keeps paying on every later
turn (Demon Form, Inflame, Barricade, Corruption, Pyre, Crimson Mantle).
**Potions do not count as playing a card**, so Ringing does not restrict them — a potion is free value on exactly the turns your hand is capped. Stomp is survivable; Crush is the killer and the only thing that
scales now, climbing 17, 20, 23, 26... Block for Crush or kill before it lands.
*Your* Strength does persist, so Inflame before Phase 2 is ideal: it amplifies
the one card per turn Ringing allows.

**What to draft for it:** front-loaded cards — ones that do their whole job the
turn they are played. They pay twice here. Before the phase change they win the
race to 150 faster, so you eat fewer escalating Plows; after it, Ringing allows
one card per turn and a front-loaded card is the only kind still worth a whole
turn. Cards that need a combo, a setup turn, or several plays to matter are
close to dead under Ringing.

Sourced specifics on playing around Ringing:
- A card applying multiple stacks of Weak (Uppercut+) spent on the Beast Cry
  turn cuts the next turn's damage while still leaving you a card to play.
- Block-next-turn effects mitigate the one-card limit.
- Card-*generating* cards are useless, because the card they make cannot also be
  played: Infernal Blade, Stoke, Havoc.
- Effects that auto-play cards waste the single permitted play: Cascade,
  Hellraiser, Stampede.
- Two-card combos die here. Unrelenting ("the next Attack you play costs 0") and
  One-Two Punch both need a follow-up you are not allowed to play.
[Rotation, Plow and Ringing from wiki.gg; damage figures agree with
slaythespire2.net]

## The Kin — Kin Priest (190 HP, A8+: 199) + 2× Kin Follower (58–59 each, A8+: 62–63)

**Gimmick:** a swarm of three independent Strength scalers, but the Followers
are Minions — killing the Priest ends their participation, so AoE and
single-target burst are both real answers.

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

The two Followers start **offset**: one opens on Quick Slash, the other on
Power Dance. Read each one's intent separately rather than assuming they act
in step. [wiki.gg]

**Minion** (Follower power, does not stack) — "Minions abandon combat without
their leader." The Priest is the leader. [wiki.gg]

Frail: you gain 25% less Block from cards. Applied TO YOU.
Weak: you deal 25% less damage with Attacks. Applied TO YOU.

Dark Ritual (Strength +2) makes the Priest's orbs grow: 8→10→12... per cycle.
Power Dance (Strength +2) makes Followers' attacks grow: 5→7→9... per cycle.
Each entity's Strength only affects that entity's own attacks.

**Tactics**: Three enemies. Followers have low HP (58–59), so killing them is
cheap and stops two of the three Strength scalers — but it is not the only line,
and the Priest's death ends the fight outright (see below). Soul Beam (3×3=9)
and the Followers' combined ~9 dmg/turn means ~18 total early. A Follower dies
in 1–2 turns of focused attacks.

Frail from Orb of Frailty reduces your block by 25% — ALL block cards are
affected, including Impervious (30 → 22 with Frail). Play block before Frail
lands, or accept reduced block and focus on killing.

Weak from Orb of Weakness reduces your attack damage by 25% — play your big
attacks before Weak lands if possible. Dark Ritual (Strength +2) makes the
Priest's 8-damage orbs grow — don't let the fight drag. Once Followers are
dead, the Priest alone does 8/8/9/buff — manageable with block + Strength
scaling.

**Two ways to answer it.** Either bring AoE and clear the swarm, which stops
three Strength scalers at once, and the pool offers many: Breakthrough (9 to
ALL), Thunderclap (4 to ALL + Vulnerable), Stomp (12 to ALL, cheaper per Attack
already played), Howl from Beyond (18 to ALL), Conflagration (2 to ALL, 4 times),
Pact's End (18 to ALL), Whirlwind (5 to ALL, X times), or Inferno as an engine.
Flame Barrier also earns a place because all three enemies attack repeatedly. Or bring single-target damage big enough to drop the Priest: the
Followers carry the Minion power and abandon combat without their leader, so
felling the Priest ends the fight rather than leaving you two adds to mop up.
Either way the losing line is spreading damage evenly and letting all three
scale.

Because Weak and Frail land constantly here, damage and Block that do not come
from playing an Attack or a Block card keep working at full value: Feel No Pain,
Juggernaut, Inferno, Rupture, Crimson Mantle. [wiki.gg]
[Source: slaythespire2.net/monster/kin-priest?v=beta; Kin Follower
data from prior session — verify individually if needed]

## Vantom — 173 HP (A8+: 183)

**Gimmick:** a DPS check that scales its damage while clogging your draw, and
opens behind Slippery 9 — which caps the next 9 hits at 1 HP each, so the
*number* of times you damage it matters far more than how hard any one hit is.

**Rotation (loops):**
- T1: Ink Blot (Attack) — 7 dmg (A9+: 8). Single hit.
- T2: Inky Lance (Attack) — 6×2 = 12 dmg (A9+: 7×2 = 14). Two hits.
- T3: Dismember (Attack·Status) — 26 dmg (A9+: 30) + 3 Wound. Single hit.
  Wound: 3 Wound status cards added to your draw pile.
  [CONFLICT: wiki.gg gives 27 base damage, not 26, and shuffles the Wounds into
  your **discard** pile, not the draw pile. A9 damage agrees at 30. Block for 27
  and treat the live intent number as authoritative.]
- T4: Prepare (Buff) — Strength +2 (self). No damage.
- Loops to Ink Blot.

**Slippery 9** (Power, self, present from the start) — stack type Counter:
"The next X times it loses HP, it only loses 1 HP instead."

It caps damage rather than negating it, and one stack is spent per instance of
HP loss regardless of that instance's size. A 26-damage Bludgeon and a 4-damage
hit both deal **1** and both burn exactly one stack. So the first 9 instances
cost Vantom 9 HP in total, and the fight only really starts once the counter is
empty — 164 of its 173 HP still to remove, against a rotation that has been
scaling the whole time.

The counter is what you attack. Every separate instance of HP loss peels one —
multi-hit attacks strip several per card, and any repeating chip effect (damage
over time, a relic that pings each turn) peels one per tick for free. A single
heavy hit is the least efficient card in your deck here.
[Source: slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Vantom]

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

**Tactics**: this is a DPS check on a timer. Dismember is the fight — 26 damage
(30 at A9) plus 3 Wounds clogging your draw. Block for it: Impervious (30 block,
or 22 with Frail if you have it) or Shrug + Defend. The Wounds dilute your deck
mid-fight, reducing good card draw rate. Killing before T3 is unrealistic (173 HP
in 2 turns = 86/turn). Realistic: block T3 Dismember, then race. Prepare (T4)
means the next cycle hits harder: Ink Blot 9, Inky Lance 16, Dismember 28.
Don't let it cycle twice.

Read the Slippery counter before committing a big attack. Until it is empty
every hit deals 1, so a heavy attack is the *worst* card you can play into it —
Bludgeon deals 1 and peels one of nine. Spend the opening turns stripping the
counter with the cheapest instances you have. Cards that hit many times peel
several stacks each — Conflagration (4 hits), Sword Boomerang (3, 4 upgraded),
Twin Strike (2), Thrash (2), Dismantle (2 vs Vulnerable), Spite (2–3 if you lost
HP), Tear Asunder (one extra hit per HP loss this combat), Whirlwind (X) — and a
repeating engine peels one per tick for free (Inferno, Juggernaut, Hellraiser).
Note that a card can be a big attack without being multi-instance: Pommel Strike
draws but hits once, so it peels one like any other single hit. Only once it is empty do Vulnerable, Strength scaling, a heavy attack
and a Fire Potion (20 dmg) do their real damage — spending them into Slippery
throws them away for 1 damage each.

Budget the fight around this: 9 largely wasted instances up front, then 164 HP
against a rotation that has been gaining Strength while you stripped the counter.
How many turns that costs depends entirely on how many instances per turn you
can land, which is the argument for multi-hit over a single heavy card. [Rotation and damage from
slaythespire2.net; Slippery from wiki.gg]

## Ironclad boss prep checklist (editable)

- By Act 1 boss you want: one Strength source (Inflame/Demon Form), one big
  block (Impervious, Blood Wall, Expect a Fight), one heavy attack (Bludgeon,
  Break, Mangle, Cinder, Hemokinesis). Heavy Blade and Carnage are Slay the
  Spire 1 cards and do not exist here.
- Ceremonial Beast: race to 150 (minimize Phase 1 Plows), then play around
  Ringing (1 card/turn). Inflame before Phase 2.
- The Kin: kill Followers first, block Priest's orbs (account for Frail
  reducing ALL block), out-scale Dark Ritual.
- Vantom: strip Slippery 9 with multi-hit or chip damage before spending a
  heavy attack (every hit deals 1 until it is empty), block Dismember (26–27/30),
  and deal with the Wounds.
- Use potions in boss fights — don't hoard. Strength + Fire = 20+ extra dmg.

### Do not overfit the deck to the Act 1 boss

Knowing the boss is for weighting close calls, not for building the whole deck
around one fight. A deck tuned only to beat one Act 1 boss arrives in Act 2 and
Act 3 unbalanced, and those acts are longer and harsher than the fight it was
built for. High damage with good scaling, or consistent reliable block, stays a
correct pick even when it is not the boss-specific answer — take it over a
narrow counter-card unless the counter is what the run is actually short of.
