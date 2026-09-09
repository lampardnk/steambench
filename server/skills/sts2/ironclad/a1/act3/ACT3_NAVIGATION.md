---
description: Act 3 — Glory encounter pool, bosses, elites, events and Ironclad navigation scope. Verified mob list and boss intents.
character: ironclad
act: 3
category: navigation
ascension: a1
keys: [ironclad, act3, glory, aeonglass, queen, torch head amalgam, test subject, knight gang, flail knight, magi knight, spectral knight, mecha knight, soul nexus, axebot, fabricator, frog knight, globe head, owl magistrate, scroll of biting, slimed berserker, the forgotten, the lost, devopted sculptor, turret operator, living shield]
sources: [slaythespire2.net, slaythespire.wiki.gg]
---

# Act 3 — Glory (navigation scope)

Verified against slaythespire2.net beta (v0.111.0, display 2026-06-18).
This file covers the encounter pool and verified boss data. Detailed per-mob
strategy files will be added as the run encounters them. Stats are base; A8
raises HP, A9 raises damage. Ascension 10 adds a second boss to the Act 3
final fight.

## Bosses (3, one per run; A10 fights two)

### Aeonglass — 512 HP (A8+: 535)
**Rotation (loops):**
- T1: Ebb — 26 dmg (A9+: 32) + 33 block
- T2: Eye Lasers — 11×2 = 22 (A9+: 12×2 = 24)
- T3: Increasing Intensity — Strength +1, Wither +1 (A9+: +2)
- Loops to Ebb.

Ebb attacks for 26 AND blocks 33 — you need to punch through 33 block to deal
damage on that turn, or save your burst for Eye Lasers (no block). Increasing
Intensity scales Strength and Wither every cycle. [INFERENCE] Wither likely
reduces your block or healing — verify in-game. This is a long fight (512
HP); bring sustained scaling (Demon Form) and block.

### Queen — 400 HP (A8+: 419) + Torch Head Amalgam (199 HP)
**Opening:**
- T1: Puppet Strings — Chains of Binding +3 (first 3 cards drawn each turn
  are Afflicted with Bound)
- T2: You Are Mine — Weak +99, Frail +99, Vulnerable +99 on you

**When Amalgam alive:** Burn Bright for Me — 20 block + Strength (loops).
**When Amalgam dead:**
- T1: Off with Your Head — 3×5 = 15 dmg (A9+: 4×5 = 20)
- T2: Execution — 15 dmg (A9+: 18)
- T3: Enrage — Strength +2
- Loops to Off with Your Head.

You Are Mine applies Weak +99, Frail +99, Vulnerable +99 — you deal 25% less
and take 50% more, and your block is nearly useless. This is a devastating
opening. [INFERENCE] the debuffs may be permanent or long-duration; verify
in-game. Kill the Torch Head Amalgam first to trigger the attack phase (Burn
Bright for Me is defensive). Then race the Queen's attack rotation before
Enrage stacks too much Strength. Off with Your Head is multi-hit (3×5) — Weak
reduces it, but you're already at Weak +99.

### Test Subject — HP not listed (revives)
**Opening (loops):** Bite (20, A9+: 22) → Skull Bash (14, A9+: 16,
Vulnerable +1).
**After 1st revive:** Multi-Claw (10, A9+: 11) every turn.
**After 2+ revives:** Lacerate (10×3=30, A9+: 11×3=33) → Big Pounce (45) →
Burning Growl (Strength +2/+3, +3 Burn/+5) → loops Lacerate.
**Respawn trigger:** Respawns once with Nemesis +1 and Painful Stabs +1.
Painful Stabs shuffles 1 Wound per unblocked hit. Nemesis: gains Intangible 1
every other turn. Big Pounce (45) is a potential kill — block for it.

## Elites (3)
- Knight Gang: 3 enemies — Flail Knight (101 HP), Magi Knight (82 HP),
  Spectral Knight (93 HP).
- Mecha Knight — 300 HP.
- Soul Nexus — 234 HP.

## Normal encounters (9)
- Axebot: 70-78 HP
- Construct Menagerie: 3 enemies — 2× Cubex Construct (65) + Punch Construct
  (55). Cubex Construct also appears in Act 1.
- Fabricator: 150 HP (summons Guardbot 16-20)
- Frog Knight: 191 HP
- A Lone Globe Head: 148 HP
- Owl Magistrate: 231 HP
- Many Scrolls of Biting: 4× Scroll of Biting (30-37)
- Slimed Berserker: 261 HP
- Lost and Forgotten: The Forgotten (106) + The Lost (93)

Weak: Devoted Sculptor (162), Turret Operator (2×: Living Shield 55 +
  Turret Operator 41), Scrolls of Biting (3× Scroll of Biting 30-37).

## Events (7, Act 3 — Glory)
Battleworn Dummy (3), Grave of the Forgotten (3), Hungry for Mushrooms (2),
Reflections snoitcelfeR (2), The Round Tea Party (2), Tinker Time (1),
The Trial (2).

## Any-act events that can appear in Act 3
See the Act 1 unknown file for the full 18 any-act event list.

## Ironclad-relevant mechanics

Facts a plan may turn on. What to do with them is the encounter's call.

- Act 3 normals reach 200+ HP, hit multiple times per turn, and several scale
  themselves; fights here run longer than in earlier acts.
- Aeonglass: Ebb gains it 33 block on the turn it is used, and its cycle is
  Ebb, Eye Lasers, Increasing Intensity, repeating.
- Queen: You Are Mine applies Weak, Frail and Vulnerable at 99 stacks. The
  attack phase begins once the Amalgam dies, and Enrage stacks from there.
- Test Subject: Big Pounce deals 45. Painful Stabs adds Wounds to the discard
  pile. It revives, and its move set differs after the first revive and again
  from the second.
- On A10 the act presents two different Act 3 bosses in one run.
