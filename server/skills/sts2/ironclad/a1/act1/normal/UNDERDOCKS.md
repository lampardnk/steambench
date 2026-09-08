---
description: Act 1 Underdocks normal encounters — verified mob HP, intents, damage scaling, and Ironclad tactics. All stats sourced from slaythespire2.net beta.
character: ironclad
act: 1
category: normal
ascension: a1
keys: [ironclad, act1, normal, underdocks, living fog, calcified cultist, damp cultist, seapunk, corpse slug, gremlin merc, fossil stalker, haunted ship, punch construct, sewer clam, two-tailed rat, gas bomb, toadpole, sludge spinner, fat gremlin, sneaky gremlin, thievery, suck, smoggy, minion]
sources: [slaythespire2.net, slaythespire.wiki.gg]
---

# Act 1 — Underdocks normal encounters

All stats verified from slaythespire2.net beta (v0.111.0, display 2026-06-18),
then completed and corrected against slaythespire.wiki.gg, which resolved every
effect the first source left undefined and supplied several powers it omits.
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

### Living Fog — 80 HP (A8+: 82)

- T1: **Advanced Gas** (Attack·Debuff) — 8 dmg (A9+: 9) + applies **Smoggy**.
- Then alternates **Bloat** — 5 dmg (A9+: 6) + summons a Gas Bomb — and
  **Super Gas Blast** — 8 dmg (A9+: 9).

**Smoggy** (does **not** stack): "You can only play 1 Skill per turn." The
earlier question about whether it stacks past 1 is resolved — it does not, so
one Advanced Gas is as bad as several.

**Gas Bomb — 7 HP (A8+: 8)**, power **Minion**: "Minions abandon combat without
their leader." Its only move is **Explode** — 8 dmg (A9+: 9), then it dies.

**Tactics**: Smoggy caps you at one Skill per turn but leaves Attacks and Powers
untouched, which suits an attack-heavy Ironclad better than most. Potions are not
cards either, so a Block Potion covers the defensive turn Smoggy denied you. Each Gas Bomb
is 8 damage on a 7 HP body — cheap to pop before it detonates, but the Minion
power means killing Living Fog itself removes every bomb at once. That makes
focusing the Fog strictly better than clearing bombs, provided you can survive
the ones already primed. [Damage from slaythespire2.net; Smoggy's stacking, Gas
Bomb HP and the Minion rule from wiki.gg]

### Calcified Cultist — 38–41 HP (A8+: 39–42)
Possible companions (wiki "Appears with"): Damp Cultist, Seapunk.

- T1: Incantation (Buff) — Ritual +2 (self). "Ritual — Gain Strength at the
  end of your turn." So the cultist gains +2 Strength at end of each turn.
- T2: Dark Strike (Attack) — 9 dmg (A9+: 11). Then keeps using Dark Strike
  every turn.

**Ritual skips its first end-of-turn trigger when an enemy applies it**, so the
Strength arrives one turn later than it looks: T1 Incantation (no gain), T2 Dark
Strike = **9**, then +2 at end of T2, T3 = 11, T4 = 13, T5 = 15...

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

Same one-turn delay from Ritual: T1 Incantation (no gain), T2 Dark Strike = **1**,
then +5 at end of T2, T3 = 6, T4 = 11, T5 = 16, T6 = 21... The opening two turns
are nearly free, and the fight becomes lethal fast after that.

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

**It steals your gold, and it does not fight alone for long.**

Powers:
- **Thievery 20** — "Steals 20 Gold when Attacking." Every attack takes gold.
- **Surprise** — when the Gremlin Merc dies, it summons a **Fat Gremlin** and a
  **Sneaky Gremlin**.

Rotation, in fixed order: **Gimme** 7×2 = 14 (A8+: 8×2 = 16) · **Double Smash**
6×2 = 12 (A8+: 7×2 = 14) + applies **2 Weak** · **Hehe** 8 (A8+: 9) + gains 2
Strength · back to Gimme.

Note this is the **only enemy in the game whose damage scales at Ascension 8
rather than Ascension 9**.

**Sneaky Gremlin — 10–14 HP (A8+: 11–15)**: Spawned (does nothing) on its first
turn, then **Tackle** 9 (A9+: 10) every turn.

**Fat Gremlin — 13–17 HP (A8+: 14–18)**, power **Heist**: "When killed, returns
all the stolen Gold." It deals no damage — it Spawns, then **Flees**, taking
every gold piece the Merc stole with it.

**Tactics**: this fight has a resource clock as well as an HP clock. Every Merc
attack removes 20 gold, and killing the Merc does not end the fight — it starts
the second half, where the Fat Gremlin is actively running off with your money.
You get the gold back only by killing the Fat Gremlin before it escapes, and it
has one free turn before it starts fleeing. Killing the Merc early limits the
theft; killing the Fat Gremlin fast recovers it. The Sneaky Gremlin is the only
one of the three that threatens you afterwards. [Damage from slaythespire2.net;
Thievery, Surprise, Heist and both minions from wiki.gg]

### Fossil Stalker — 51–53 HP (A8+: 54–56)

**Power — Suck 3**: "Whenever it deals unblocked attack damage, it gains 3
Strength." This is the fight. There is no scripted trigger and no second
rotation — the file previously guessed at one. What actually happens is that
every hit you fail to block makes every future hit larger.

- Always opens with **Latch** — 12 dmg (A9+: 14).
- Every turn after is a flat 33/33/33 random pick between **Latch**, **Tackle**
  — 9 dmg (A9+: 11) + applies 1 **Frail** — and **Lash** — 3×2 = 6 dmg (A9+:
  4×2 = 8). It may repeat the same move.

**Tactics**: blocking is not optional here, it is the scaling check. Let the
opening Latch through and it is immediately +3 Strength on everything after.
Tackle's Frail then reduces the Block you use to stop the next one, which is how
this enemy runs away with a fight. Lash is the move that punishes accumulated
Strength worst, since it hits twice. Block fully on the turns you can, and note
that partial blocking still triggers Suck — only fully blocked damage does not.
[Damage from slaythespire2.net; Suck and the random selection from wiki.gg]

### Toadpole — 21–25 HP (A8+: 22–26)

Power: **Thorns** — "When hit by an attack, deal X damage back."

Fixed cycle: **Whirl** 7 (A9+: 8) → **Spiken** gains **2 Thorns** → **Spike
Spit** 3×3 = 9 (A9+: 4×3 = 12) and removes 2 Thorns from itself. In the weak
Toadpoles encounter the front one starts on Spiken instead.

**Tactics**: Thorns punishes the number of times you hit it, not how hard — so
against a Toadpole the efficient shape is the opposite of most fights here: one
large hit rather than many small ones. It spends its own Thorns on Spike Spit,
so the safest window to attack repeatedly is right after that move.

### Sludge Spinner — 37–39 HP (A8+: 41–42)

Always opens with **Oil Spray** — 8 dmg (A9+: 9) + applies 1 **Weak**. After
that it picks randomly among its three moves each turn and cannot repeat:

- **Oil Spray** — 8 (9) + 1 Weak · **Slam** — 11 (12) · **Rage** — 6 (7) and
  gains **3 Strength**.

**Tactics**: it opens by cutting your damage 25%, and Rage is the only scaling
move — at +3 Strength a turn it climbs quickly if the fight drags. The no-repeat
rule means a Rage turn is never followed by another, so the Strength arrives at
a predictable maximum of every other turn.

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
- Gremlin Merc: it steals 20 Gold per attack and splits into two minions on
  death, one of which flees with the money. Block Gimme (14) on T1, kill the
  Merc early to cap the theft, then kill the Fat Gremlin to get the gold back.
- Fossil Stalker: block or it snowballs — every unblocked hit is +3 Strength.
- Toadpole: Thorns punishes the number of hits, so prefer one big attack.
