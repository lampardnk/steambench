---
description: Act 1 Underdocks elites — Phantasmal Gardeners, Skulking Colony, Terror Eel. Verified HP, intents, patterns and Ironclad tactics from slaythespire2.net beta.
character: ironclad
act: 1
category: elite
ascension: a1
keys: [ironclad, act1, elite, underdocks, phantasmal gardener, skulking colony, terror eel, vigor, skittish, hardened shell, shriek, damage cap]
sources: [slaythespire2.net, slaythespire.wiki.gg]
---

# Act 1 — Underdocks elites

All stats verified from slaythespire2.net beta (v0.111.0, display 2026-06-18),
then corrected against slaythespire.wiki.gg, which supplied the powers that
decide all three fights and that the first source does not list.
A8 raises HP; A9 raises damage. Installed build may differ.

## How to read entries

- **Debuff** intents are applied TO THE PLAYER by the enemy.
- **Buff** intents are applied TO THE ENEMY ITSELF.
- **Vigor** (Buff): "Your next Attack deals additional damage." The "Your"
  refers to the enemy — its next attack gains the Vigor bonus. Vigor is
  consumed on the next attack.
- Card names below are examples of a property, not a shortlist. The Ironclad
  pool is ~90 cards; read it with
  `research https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards_List?color=Ironclad`.

## Phantasmal Gardeners — 4× (26–31 HP each, A8+: 27–32)

**Gimmick:** each one gains Block the first time it is hit each turn, so *how
many separate cards* you attack with matters more than how many total hits.

**Power — Skittish 6 (A8+: 7)** (Intensity): "The first time it is hit each
turn, it gains 6 Block."

Two details decide how to play around it:
- Skittish triggers **after the first Attack card fully resolves**. A card that
  hits twice lands both hits, *then* the Gardener blocks. So a multi-hit card
  gets its whole damage through, while two separate small cards do not.
- Damage that is not from an Attack card never triggers Skittish at all —
  retaliation and damage-over-time effects bypass it completely.

**Moves** — all four cycle the same order, each starting at a different point,
so they are always on different moves:
- Bite — 5 dmg · Lash — 7 dmg · Flail — 1×3 = 3 dmg · Enlarge — +2 Strength
  (A9+: +3), no damage.

Incoming is a steady 15 a turn before Strength, with exactly one Gardener
Enlarging each turn. After one full cycle every Gardener has +2 Strength; note
Flail hits three times, so Strength inflates it fastest (3 → 9 at +2).

**Tactics**: killing one is worth more than damaging all four, because it
removes both a scaler and a Skittish body. Damage to all enemies is still
strong, but understand what it does against Skittish: it triggers all four
shields at once. The efficient shapes here are one card that hits many times,
or damage that does not come from an Attack card. Spreading small individual
attacks across four Gardeners is the worst thing you can do — that is four
Block gains for very little damage.
[Moves and damage from slaythespire2.net; Skittish and its resolution timing
from wiki.gg]

## Skulking Colony — 75 HP (A8+: 80)

**Gimmick:** it cannot lose more than 20 HP in a turn, so this fight has a
minimum length no amount of damage can shorten.

**Power — Hardened Shell 20** (Intensity): "It cannot lose more than 20 HP each
turn."

At 75 HP (80 at A8) that is **at least 4 turns** to kill, whatever your deck
does. Overkill is wasted: a 32-damage Bludgeon deals 20 here, exactly as a
20-damage hand would. Damage beyond 20 in a turn is thrown away.

The cap resets at the start of **your** turn *and* at the start of **its**
turn. Damage that lands on the enemy's turn — retaliation, damage-over-time —
draws from a fresh 20, so it is possible to remove up to 40 in a full round
rather than 20.

**Rotation (loops):** Zoom 14 (A9+: 16) · Zoom 14 (16) · Inertia 9 (11) and
**+2 Strength** (A9+: +4) · Piercing Stabs 7×2 = 14 (8×2 = 16).

| Cycle | Zoom | Zoom | Inertia | Piercing Stabs |
|---|---|---|---|---|
| 1 | 14 | 14 | 9 (Str→2) | (7+2)×2 = 18 |
| 2 | 16 | 16 | 11 (Str→4) | (7+4)×2 = 22 |
| 3 | 18 | 18 | 13 (Str→6) | (7+6)×2 = 26 |

**Tactics**: because you cannot shorten the fight below 4 turns, the question
is not how to burst it down but how to survive four-plus turns of a rotation
that opens with 28 damage across two turns and escalates every cycle. Build the
turn to hit exactly the cap and spend everything else on Block — a hand that
deals 20 and blocks is strictly better than one that deals 35 and does not.
Weak on the two Zoom turns cuts 28 to 21. Anything that damages it on its own
turn is unusually valuable here, because it draws from a second cap.
[Rotation and damage from slaythespire2.net; Hardened Shell and its double
reset from wiki.gg]

## Terror Eel — 140 HP (A8+: 150)

**Gimmick:** at a known HP threshold it stuns, then applies Vulnerable for the
rest of the fight — so the second half is fought at +50% incoming damage, and
you can see it coming.

**Power — Shriek 70 (A8+: 75)**: when its HP drops to that number or below, it
becomes Stunned and then uses **Terror**. This is an HP threshold you can read
and plan around, not a hidden trigger.

**Rotation (loops):** Crash 16 (A9+: 18) · Thrash 3×3 = 9 (A9+: 4×3 = 12) and
gains **6 Vigor**. It starts on Crash.

Vigor is spent by its next attack, so Thrash always feeds the following Crash:
T1 Crash 16, T2 Thrash 9, T3 Crash 22, T4 Thrash 9, T5 Crash 22... From T3 on,
every Crash lands at 22 (A9+: 24).

**At the threshold:** Stun (does nothing) → **Terror** applies **99
Vulnerable** → back to the Crash/Thrash cycle. 99 stacks is the rest of the
fight, so from that point every attack hits you for 50% more: Crash 22 becomes
33, Thrash 9 becomes roughly 14.

**Tactics**: the Stun and Terror turns are two turns where it deals no damage —
the largest free window in the fight, and it arrives at a moment you choose by
controlling when you cross 70 HP. The half of the fight after Terror is far
more expensive than the half before, so the useful question is how much of its
140 HP you can remove *before* tripping the threshold, and whether you would
rather arrive at it with Block banked or with the Eel nearly dead. Weak is
worth most on Thrash turns because it hits three times.
[Rotation, damage and Vigor from slaythespire2.net; the Shriek threshold and
Terror from wiki.gg]

## What each fight asks for (editable)

Not a ranking, and not a card list — these three punish different deck shapes,
and a deck built for one is not built for the others.

| Elite | HP | The constraint | What that rewards |
|---|---|---|---|
| Phantasmal Gardeners | 4× 26–31 | Skittish: Block on first hit each turn | one card that hits many times, or damage that is not an Attack card |
| Skulking Colony | 75 | Hardened Shell: max 20 HP lost per turn | exactly-enough damage plus Block; surviving 4+ turns, not bursting |
| Terror Eel | 140 | Shriek 70 → permanent Vulnerable | removing HP before the threshold, and Block banked for after it |

- Don't hoard potions: an elite is what they are for.
- Vulnerable applied to the enemy makes *your* attacks deal +50% to it. It does
  not make its attacks hit you harder.
