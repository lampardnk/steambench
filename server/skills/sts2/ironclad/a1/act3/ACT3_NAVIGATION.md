---
description: Act 3 — Glory encounter pool, bosses, elites, events and Ironclad navigation scope. Verified mob list and boss intents.
character: ironclad
act: 3
category: navigation
ascension: a1
keys: [ironclad, act3, glory, aeonglass, queen, torch head amalgam, test subject, knight gang, flail knight, magi knight, spectral knight, mecha knight, soul nexus, axebot, cubex construct, punch construct, fabricator, frog knight, globe head, owl magistrate, scroll of biting, slimed berserker, the forgotten, the lost, devoted sculptor, turret operator, living shield]
---

# Act 3 — Glory (navigation scope)

Verified against slaythespire2.net beta (v0.111.0, display 2026-06-18).
This file covers the encounter pool and published boss data. Stats are base; A8
raises HP, A9 raises damage. Ascension 10 adds a second boss to the Act 3
final fight.

## Published page references

These exact wiki pages identify the encounter pool and boss entries; the beta dataset values above may differ from the current page, and live intents take precedence.

- [Aeonglass](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Aeonglass)
- [Queen](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Queen)
- [Queen — Torch Head Amalgam](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Queen#Torch_Head_Amalgam)
- [Test Subject](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Test_Subject)
- [Knight Gang](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Knight_Gang)
- [Mecha Knight](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Mecha_Knight)
- [Soul Nexus](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Soul_Nexus)
- [Axebot](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Axebot)
- [Cubex Construct](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cubex_Construct)
- [Punch Construct](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Punch_Construct)
- [Fabricator](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Fabricator)
- [Frog Knight](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Frog_Knight)
- [Globe Head](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Globe_Head)
- [Owl Magistrate](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Owl_Magistrate)
- [Scroll of Biting](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Scroll_of_Biting)
- [Slimed Berserker](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Slimed_Berserker)
- [The Lost and Forgotten](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Lost_and_Forgotten)
- [Devoted Sculptor](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Devoted_Sculptor)
- [Turret Operator](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Turret_Operator)


## Bosses (3, one per run; A10 fights two)

### Aeonglass — 512 HP (A8+: 535)
**Rotation (loops):**
- T1: Ebb — 26 dmg (A9+: 32) + 33 block
- T2: Eye Lasers — 11×2 = 22 (A9+: 12×2 = 24)
- T3: Increasing Intensity — Strength +1, Wither +1 (A9+: +2)
- Loops to Ebb.

Ebb combines 26 damage (A9+: 32) with 33 Block; Eye Lasers has two hits. Increasing Intensity increases Strength and adds Wither to the deck as listed. Calculation question: given the live intent and current powers, what values apply to this turn? The Wither effect is not defined in this file.

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

You Are Mine applies Weak 99, Frail 99, and Vulnerable 99. Burn Bright for Me provides 20 Block and Strength (amount not published) while the Amalgam is alive. After the Amalgam has died, the published branch is Off with Your Head → Execution → Enrage, repeating from Off with Your Head.
Calculation question: with the current debuff, Block, Strength, and branch state, what damage and status totals result from the next published Queen or Torch Head Amalgam intent?

### Test Subject — HP not listed (revives)
**Opening (loops):** Bite (20, A9+: 22) → Skull Bash (14, A9+: 16,
Vulnerable +1).
**After 1st revive:** Multi-Claw (10, A9+: 11) every turn.
**After 2+ revives:** Lacerate (10×3=30, A9+: 11×3=33) → Big Pounce (45) →
Burning Growl (Strength +2/+3, +3 Burn/+5) → loops Lacerate.
Respawn adds Nemesis +1 and Painful Stabs +1. Painful Stabs shuffles 1 Wound per unblocked hit; Nemesis grants Intangible 1 every other turn. The post-respawn move branch is determined by the current respawn count.
Calculation question: using the current respawn count and powers, what are the per-hit and total values for Lacerate, Big Pounce, and the next Burning Growl?
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

## Ironclad-relevant calculations

The following references identify published values that can affect arithmetic;
the current encounter state determines the result.

- Calculation question: given the live intent, current powers, and multi-hit or self-strengthening cycle, what values apply to this turn?
- Aeonglass: Ebb gains 33 block on the turn it is used, and its cycle is Ebb, Eye Lasers, Increasing Intensity, repeating.
- Queen: You Are Mine applies Weak, Frail and Vulnerable at 99 stacks. The attack branch begins once the Amalgam has died, and Enrage appears in that branch.
- Test Subject: Big Pounce deals 45. Painful Stabs adds Wounds to the discard pile. It revives, and its move set differs after the first revive and again from the second.
- On A10 the act presents two different Act 3 bosses in one run.
