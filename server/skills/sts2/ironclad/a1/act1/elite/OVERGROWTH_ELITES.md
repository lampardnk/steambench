---
description: Act 1 Overgrowth elites — Bygone Effigy, Byrdonis, Phrog Parasite. Verified HP, intents, patterns and Ironclad tactics from slaythespire2.net beta.
character: ironclad
act: 1
category: elite
ascension: a1
keys: [ironclad, act1, elite, overgrowth, bygone effigy, byrdonis, phrog parasite, wriggler, infection, slow, territorial, infested]
sources: [slaythespire2.net, slaythespire.wiki.gg]
---

# Act 1 — Overgrowth elites

All stats verified from slaythespire2.net beta (v0.111.0, display 2026-06-18),
then corrected against slaythespire.wiki.gg, which supplied the three powers
that decide these fights and that the first source does not list.
A8 raises HP; A9 raises damage. Installed build may differ.

## How to read entries

- **Debuff** intents are applied TO THE PLAYER by the enemy.
- **Buff** intents are applied TO THE ENEMY ITSELF.
- **Status** intents put status cards into YOUR deck. Infection is one of
  these — it is not a counter on the enemy.
- Card names below are examples of a property, not a shortlist. The Ironclad
  pool is ~90 cards; read it with
  `research https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards_List?color=Ironclad`.

Never enter an elite below 60% HP (survival default from controls/CONTROLS.md).

## Bygone Effigy — 127 HP (A8+: 132)

**Gimmick:** every card you play makes it take 10% more Attack damage that
turn, so the cheap cards you would normally skip are what set up the big one.

**Power — Slow** (Intensity): "Whenever you play a card, this enemy receives
10% more damage from Attacks this turn." It resets each turn.

- Only **Attack cards** benefit. Damage from Powers, Poison, Doom or similar
  is unaffected by Slow.
- Rounding is always **down**. A 6-damage Strike deals 6 at 0–1 Slow, 7 at 2–3,
  8 at 4, 9 at 5–6, 10 at 7–8, 11 at 9, 12 at 10.
- The order within a turn therefore matters: spend cheap cards first to build
  Slow, then land the largest Attack last.

**Rotation:**
- T1: Sleep — does nothing. A free turn.
- T2: Wake — gains **10 Strength**. No damage. A second free turn.
- T3+: Slashes — 13 dmg (A9+: 15), plus that 10 Strength = **23 (A9+: 25)**
  every turn, forever.

It gains no further Strength after Wake, so 23 per turn is flat, not a
snowball. That makes it a fixed damage check rather than a race: 127 HP against
a steady 23 a turn.

**Tactics**: two free turns up front is a large setup window. From T3 it is a
flat 23 a turn, so you can choose to block it indefinitely as long as you can
produce ~23 Block a turn — nothing gets worse over time. If you would rather
race, Slow is the lever: a hand of cheap cards played before your heaviest
Attack can add 50%+ to that one hit. Note that a deck built around one big
Attack and nothing else generates little Slow and gets the least from it.
[Rotation and damage from slaythespire2.net; Slow, its rounding and its
Attack-only restriction from wiki.gg]

## Byrdonis — 81–84 HP (A8+: 90)

**Gimmick:** it gains Strength at the end of every one of its turns, and half
its attacks hit three times — so the damage curve bends upward fast.

**Power — Territorial 1** (Intensity): "At the end of its turn, gains 1
Strength." Every turn, without exception.

**Rotation (loops):**
- T1: Swoop — 17 dmg (A9+: 19). Single hit.
- T2: Peck — 3×3 = 9 dmg (A9+: 4×3 = 12). Three hits.
- Loops to Swoop.

Because Peck hits three times, each point of Strength adds **3** to a Peck turn
but only 1 to a Swoop turn. With Territorial ticking every turn:

| Turn | Move | Strength when it acts | Damage |
|---|---|---|---|
| 1 | Swoop | 0 | 17 |
| 2 | Peck | 1 | (3+1)×3 = 12 |
| 3 | Swoop | 2 | 19 |
| 4 | Peck | 3 | (3+3)×3 = 18 |
| 5 | Swoop | 4 | 21 |
| 6 | Peck | 5 | (3+5)×3 = 24 |

**Tactics**: this is **not** a fight to take slowly — the Peck turns overtake
the Swoop turns by turn 6 and keep climbing. Weak is unusually strong here
because it cuts a three-hit attack, and Peck turns are where the Strength is
being spent. At 81–84 HP it dies in 3–4 focused turns, which is the plan;
letting it cycle six or more times is how this elite kills you.
[Rotation and damage from slaythespire2.net; Territorial from wiki.gg]

## Phrog Parasite — 61–64 HP (A8+: 66–68)

**Gimmick:** it poisons your deck with Infection status cards, and killing it
starts the second half of the fight rather than ending it.

**Power — Infested**: when the Phrog Parasite dies, it summons **4 Wrigglers**.
They are Stunned and do nothing on their first turn. The fight continues until
every Wriggler is dead.

**Phrog Parasite rotation (loops):**
- T1: Infect — shuffles **3 Infection status cards into your discard pile**.
  No damage.
- T2: Lash — 4×4 = 16 dmg (A9+: 5×4 = 20). Four hits.
- Loops to Infect.

Infection is a card in **your** deck, not a counter on the enemy. Its damage
lands during your turn, which means it triggers your own on-HP-loss effects
(Rupture, Inferno) rather than only hurting you.

**Wriggler — 17–21 HP (A8+: 18–22)**, four of them:
- Nasty Bite — 6 dmg (A9+: 7).
- Wriggle — shuffles 1 Infection into your discard pile, and gains **2
  Strength** (its own).
- They alternate, and start **offset**: odd-numbered ones open on Nasty Bite,
  even-numbered ones on Wriggle.

**Timing detail worth knowing**: whether the Wrigglers are Stunned on your next
turn depends on how the Phrog dies. Killed by an Attack, they are Stunned
during the current turn, so they act on your next one. Killed by Poison or Doom
— or by its own attack via Thorns — they spawn with no intent and are Stunned
during your next turn instead, buying you a full extra turn.

**Tactics**: the Phrog is only 61–64 HP, so the danger is not its damage but
what follows. Plan the whole encounter before you kill it: four Wrigglers, each
gaining 2 Strength on alternating turns and each adding more Infection to your
deck. Damage to all enemies is worth far more here than single-target, and it
is worth having that ready *before* the Phrog dies rather than drafting for it
after. Effects that discard, exhaust or transform Infections stop them dealing
damage at all.
[Rotation and damage from slaythespire2.net; Infested, Infection's destination
and the death-timing rule from wiki.gg]

## Ironclad elite prep checklist (editable)

- Need ~25+ damage per turn by first elite.
- Bring at least one Strength source (Inflame, Demon Form, Rupture, Brand,
  Fight Me!, Setup Strike for a single turn) for
  consistent output across all three elites.
- Weak reduces multi-hit attacks (Peck 3×3, Lash 4×4) substantially — 25% off
  each of the hits.
- Enough Block for the big single hits (Swoop 17, Slashes 23) — Impervious,
  Blood Wall, Shrug It Off, Evil Eye, Expect a Fight all reach it.
- These three elites want three different things: Bygone Effigy rewards a wide
  cheap hand, Byrdonis rewards speed, and Phrog Parasite rewards damage to all
  enemies. A deck tuned for one is not tuned for the others.
- Don't hoard potions: use Strength/Fire/Block potions in elite fights.
- Vulnerable (from Bash) is always good — it makes your attacks deal +50% to
  the target. It does NOT make the target's attacks hit you harder.
