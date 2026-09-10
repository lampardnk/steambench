---
title: Effect glossary
description: >-
  What every named buff, debuff, enemy power and status card actually does, with
  its stacking type and what happens to it between turns. Definitions only.
character: any
act: any
tags: [effects, powers, buffs, debuffs, statuses, keywords, combat]
topic: effects
keys: [Tender, Slippery, Hard to Kill, Hardened Shell, Illusion, Soar, Personal Hive, Nemesis, Minion, Painful Stabs, Ritual, Curl Up, Enrage, Territorial, Suck, High Voltage, Back Attack, Crab Rage, Surrounded, Burrowed, Steam Eruption, Sandpit, Frantic Escape, Chains of Binding, Bound, Curse of Knowledge, Disintegration, Mind Rot, Sloth, Waste Away, Hex, Dampen, Smoggy, Ringing, Plow, Shriek, Slow, Tangled, Constrict, Magic Bomb, Imbalanced, Shrink, Adaptable, Asleep, Slumber, Skittish, Escape Artist, Flutter, Galvanic, Hatch, Heist, Infested, Paper Cuts, Possess Speed, Possess Strength, Rampart, Ravenous, Reattach, Stock, Surprise, Swipe, Thievery, Time Limit, Vital Spark, Withering Presence, Artifact, Intangible, Thorns, Vigor, Buffer, Regen, Plating, Blur, Barricade, Confused, Doom, Poison, Vulnerable, Weak, Frail, Strength, Dexterity, Dazed, Wound, Stunned, Ethereal, Innate, Retain, Replay, Unplayable, Eternal, Exhaust, Fatal]
sources:
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Buffs
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Debuffs
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Keywords
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Mechanics
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Cards
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Potions
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Queen
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Knowledge_Demon
  - https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Insatiable
---

# Effect glossary

The rosters name effects; this says what they do. Every line is a paraphrase of
the linked wiki glossary or an exact-page encounter entry. Where the game shows a
live number, the number on screen is the authority — this file is for what the
name means.

**Provenance marker.** Blocks headed **[wiki-driven]** are the wiki's own Notes,
Interactions and Useful Cards sections: community-selected and community-tested
observations, reproduced because they record what players have verified about an
interaction. They are evidence about the game, on the same footing as a stat
block — not this library's opinion about how to play, and not a plan you are
being handed. Anything not marked that way is the effect's published text.

## How to read a stack

The game does not label these categories; the wiki uses them to describe
observed behaviour. See [Buffs](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Buffs)
and [Debuffs](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Debuffs).

- **Intensity** — X stacks make the effect X times stronger.
- **Duration** — X stacks mean X turns; one stack is lost as the turn passes.
- **Counter** — triggers on an event and usually loses a stack each trigger.
- **Does not stack** — present or absent; usually lasts the whole combat.

Between turns an effect is **permanent** (not removed by normal means),
**conserved** (unaffected by the turn passing), **decremented** (loses one
stack), **removed** (loses all stacks with no effect), **consumed** (loses all
stacks on triggering at the start of the next turn), or **reset** (counters
return to an initial value).

`Artifact` negates the application of the next debuff received, one stack per
debuff negated.

## Enemy powers

What an enemy carries. Named in the act rosters, defined here. The stack labels
come from the [Buffs](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Buffs)
and [Debuffs](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Debuffs) pages;
enemy-specific Notes/Interactions are linked at the section where they are
used.

| Power | Carried by | Effect | Stack | Between turns |
|---|---|---|---|---|
| **Tender** | Hunter Killer | Whenever you play a card, lose X Strength and X Dexterity **this turn**. | Intensity | Permanent |
| **Hard to Kill** | Exoskeleton | Reduce all damage taken and HP lost by it to 9. Caps every individual instance. | Intensity | Permanent |
| **Hardened Shell** | Skulking Colony | It cannot lose more than X HP each turn. Cap resets at the start of each player turn. | Intensity | Reset |
| **Slippery** | Vantom, Inklet | The next X times it loses HP, it only loses 1 HP instead. One stack per instance. | Counter | Conserved |
| **Illusion** | Parafright, Eye With Teeth | When this dies, it revives next turn at full HP. | Does not stack | Permanent |
| **Minion** | various summons | Minions abandon combat without their leader. | Does not stack | Permanent |
| **Nemesis** | Test Subject | At the end of every other turn, gains Intangible 1. | Does not stack | Permanent |
| **Painful Stabs** | Test Subject | Shuffle X Wounds into your Discard Pile each time you receive unblocked attack damage. | Intensity | Permanent |
| **Adaptable** | Test Subject | When it would be defeated, it instead revives even stronger. | Does not stack | Permanent |
| **Enrage** | Test Subject | Whenever you play a Skill, gains X Strength. | Intensity | Permanent |
| **Personal Hive** | Entomancer | Whenever this enemy is hit by an Attack, add X Dazed into your Draw Pile. | Intensity | Permanent |
| **Soar** | Owl Magistrate | Receives 50% less attack damage until it lands. | Does not stack | Removed |
| **Flutter** | Thieving Hopper | Receives 50% less damage from Attacks. Deal attack damage X times to Stun it. | Intensity | Permanent |
| **Escape Artist** | Thieving Hopper | Tries to escape the combat after X turns. | Duration | Decremented |
| **Swipe** | Thieving Hopper | Upon killing this enemy, the stolen card is returned. One instance per stolen card. | Does not stack | Permanent |
| **Thievery** | Gremlin Merc | Steals X Gold when Attacking. | Intensity | Permanent |
| **Heist** | Gremlin Merc → Fat Gremlin | When killed, returns all the stolen Gold. | Intensity | Permanent |
| **Surprise** | Gremlin Merc | On death, spawns a Sneaky Gremlin and a Fat Gremlin. | Does not stack | Permanent |
| **Curl Up** | Louse Progenitor | Gains X Block upon first being hit. | Intensity | Conserved |
| **Territorial** | Byrdonis | At the end of its turn, gains X Strength. | Intensity | Permanent |
| **Suck** | Fossil Stalker | Whenever it deals unblocked attack damage, it gains X Strength. | Intensity | Permanent |
| **High Voltage** | Zapbot | At the start of its turn, it gains X Strength. | Intensity | Permanent |
| **Ravenous** | Corpse Slug | When an enemy dies, it immediately eats it, becoming Stunned and gaining X Strength. | Intensity | Permanent |
| **Skittish** | Phantasmal Gardener | The first time it is hit each turn, it gains X Block. Once per turn. | Intensity | Reset |
| **Burrowed** | Tunneler | Block is not removed at the start of its turn. Stunned if all Block is removed. Loses all Block when Burrowed is removed. | Does not stack | Conserved |
| **Steam Eruption** | Waterfall Giant | When killed, deals X damage at the end of your next turn. Accumulates through its moves; on death it becomes Stunned, then explodes next turn for the full amount. | Intensity | Permanent |
| **Stock** | Axebot | When killed, a new Axebot is summoned in its place with X−1. At 0, no further Axebots spawn. | Intensity | Conserved |
| **Reattach** | Decimillipede | If other segments are still alive, revives in 2 turns with X HP. | Does not stack | Permanent |
| **Infested** | Phrog Parasite | On death, spawns 4 Wrigglers. | Does not stack | Permanent |
| **Rampart** | Living Shield | At the start of the player's turn, Turret Operator gains X Block. | Intensity | Permanent |
| **Paper Cuts** | Scroll of Biting | Whenever it deals unblocked attack damage to you, you lose X Max HP. | Intensity | Permanent |
| **Galvanic** | Globe Head | Powers are afflicted with Galvanized, which damages the card's owner when played. | Intensity | Permanent |
| **Vital Spark** | Infested Prism | All Skills are Tainted X. | Intensity | Permanent |
| **Withering Presence** | Aeonglass | Every 6 cards you play, add a Wither to your Hand. | Does not stack | Permanent |
| **Possess Strength** | The Lost | When killed, returns all stolen Strength to the player. | Does not stack | Permanent |
| **Possess Speed** | The Forgotten | When killed, returns all stolen Dexterity to the player. | Does not stack | Permanent |
| **Asleep** | Lagavulin Matriarch | Awakens upon losing HP or after X turns. | Duration | Decremented |
| **Slumber** | Slumbering Beetle | Awakens upon taking turns or losing HP X times; loses stacks from both. | Counter and Duration | Decremented |
| **Hatch** | Tough Egg | Hatches after X turns. | Duration | Decremented |
| **Time Limit** | Battleworn Dummy | You have X more turns to defeat it. | Duration | Decremented |
| **Ritual** | various | At the end of its turn, gains X Strength. **Skips the first end-of-turn trigger when applied by an enemy.** | Intensity | Permanent |

## Facing — orientation is a real axis

`Back Attack` and `Surrounded` mean position matters, and the game says
orientation is changeable. [wiki.gg Buffs/Debuffs]

- **Back Attack** (Crusher) — deals 50% more damage when attacking you from
  behind. Does not stack, conserved.
- **Crab Rage** (Rocket, Crusher) — when an ally dies, it gains 6 Strength and
  99 Block. Does not stack, permanent.
- **Surrounded** (applied by Crusher, Rocket) — you receive 50% more damage if
  attacked from behind. The game's own text: "Use targeting cards or potions to
  change your orientation." Does not stack, permanent.

## Debuffs an enemy can put on you

| Debuff | Applied by | Effect | Stack | Between turns |
|---|---|---|---|---|
| **Vulnerable** | many | Receive 50% more damage from Attacks for X turns. | Duration | Decremented |
| **Weak** | many | Attacks deal 25% less damage for X turns. | Duration | Decremented |
| **Frail** | many | Gain 25% less Block from cards for X turns. | Duration | Decremented |
| **Strength (negative)** | many | Decreases attack damage by X. | Intensity | Permanent |
| **Dexterity (negative)** | Lagavulin Matriarch, Tender, The Forgotten | Decreases Block gained from cards by X. | Intensity | Permanent |
| **Poison** | many | At the end of the player's turn, the poisoned creature loses X HP, then Poison is reduced by 1. | Intensity | Decremented |
| **Shrink** | Beetle Juice, Shrinker Beetle | Attacks deal 30% less damage. Removed when the applier dies, or after 3 turns. | Duration / does not stack | Decremented / conserved |
| **Slow** | Bygone Effigy | Whenever you play a card, **this enemy** receives 10% more damage from Attacks this turn. | Intensity | Permanent |
| **Tangled** | Vine Shambler | Attacks cost an additional energy for 2 turns. | Duration | Decremented |
| **Constrict** | Slithering Strangler | While the Strangler is alive, at the end of your turn take X damage. | Intensity | Conserved |
| **Magic Bomb** | Magi Knight | Take X damage at the end of your turn. Cleared if the Magi Knight dies. | Intensity | Conserved |
| **Dampen** | Magi Knight | While the Magi Knight is alive, ALL your cards are Downgraded. | Does not stack | Conserved |
| **Hex** | Spectral Knight | While the Spectral Knight is alive, ALL your cards are Ethereal. | Does not stack | Conserved |
| **Smoggy** | Living Fog | You can only play 1 Skill per turn. | Does not stack | Permanent |
| **Ringing** | Ceremonial Beast | You can only play 1 card this turn. | — | Permanent |
| **Plow** | Ceremonial Beast | The first time this enemy's HP reaches X or below, it becomes Stunned and loses all its Strength. | Intensity | Conserved |
| **Shriek** | Terror Eel | The first time this enemy's HP reaches X or below, it becomes Stunned. | Intensity | Conserved |
| **Imbalanced** | Bowlbug (Rock) | If the enemy's attacks are fully blocked, it becomes Stunned. | Does not stack | Permanent |
| **Confused** | Snecko Eye | The costs of your cards are randomized on draw, from 0 to 3. | Does not stack | Permanent |
| **Chains of Binding** | Queen | The first X cards drawn each turn are Afflicted with **Bound**. | Intensity | Conserved |
| **Doom** | Necrobinder kit, some effects | At the end of the enemy turn, if it has X or less HP, it dies. Kills without modifying HP, so it **ignores Block, Slippery and Intangible**. | Intensity | Permanent |

## Boss mechanics that change how a turn works

### The Insatiable — Sandpit and Frantic Escape

- **Sandpit** (Duration, decremented): "In X turns, you will be eaten and die."
  Reaching 0 kills the player. **Fairy in a Bottle does not prevent this death.**
  In multiplayer each player sees only their own Sandpit.
- **Liquify Ground** grants 4 Sandpit and shuffles **6 Frantic Escape** into the
  deck — 3 into the draw pile, 3 into the discard pile.
- **Frantic Escape** is a 1-cost Colorless Common **Status** card: "Get farther
  away. Increase Sandpit by 1. Increase the cost of this card by 1." It is
  playable, its cost rises by 1 with every play, and playing it is what adds
  turns to the timer.
- The wiki records this as the exception to normal Status handling: "Unlike with
  other Status cards, it is not always advantageous to Exhaust or Transform
  Frantic Escapes, as they are often required to keep the player alive." Cards
  that exhaust Statuses for value (Flak Cannon) consume the deck's supply.
- Pattern: Liquify Ground, then Thrash → Lunging Bite → Salivate → Thrash →
  repeat from Lunging Bite. Source: [The Insatiable](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Insatiable).

**[wiki-driven]** Insatiable interactions recorded in the [The Insatiable
Notes and Interactions sections](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:The_Insatiable#Notes):
- Fairy in a Bottle will not prevent the death stemming from Sandpit.
- Iteration triggers consistently in this fight, because the deck starts with six
  Frantic Escapes shuffled in.
- Flak Cannon hits an additional six times the first time it is played, and doing
  so leaves no remaining way to add Sandpit through Frantic Escapes.
- Compact converts a Frantic Escape into Fuel; Rocket Punch temporarily drops in
  cost when the Frantic Escapes are created; Touch of Insanity sets a Frantic
  Escape's cost to 0, after which it still rises by 1 per play as usual.

### Knowledge Demon — Curse of Knowledge is a forced choice

- **Curse of Knowledge**: each player **chooses one of two debuffs to receive**.
  The options change each time the move is used.
  - Set 1: Disintegration (6 damage/turn) or Mind Rot (draw 1 fewer card/turn)
  - Set 2: Disintegration (7 damage/turn) or Sloth (max 3 cards/turn)
  - Set 3: Disintegration (8 damage/turn) or Waste Away (1 less energy/turn)
- The options **are shown as cards but never enter your hand or deck**. Once
  chosen they are instantly played and removed from the game.
- After the third Curse of Knowledge, the move is skipped and the remaining
  three moves repeat in order.
- The resulting debuffs: **Disintegration** — at the end of your turn, take X
  damage (intensity, permanent). **Mind Rot** — draw X fewer cards each turn.
  **Sloth** — you cannot play more than X cards each turn. **Waste Away** — gain
  X less energy per turn. All four are permanent.
- **Runtime**: this is a mandatory card-selection screen appearing mid-combat.
  It is resolved with a `choose` action against the open selection screen, the
  same as any other card-select. Nothing happens until it is answered.
  Source: [Knowledge Demon](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Knowledge_Demon).

**[wiki-driven]** Knowledge Demon interactions recorded in the [Knowledge Demon
Notes and Interactions sections](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Knowledge_Demon#Notes):
- Disintegration's per-turn damage is answered either by defensive cards such as
  Footwork or Feel No Pain, or by entering with a large HP pool and ending the
  fight before it accumulates.
- Strength reduction (Piercing Wail, Monarch's Gaze) reduces multi-hit damage
  substantially, Knowledge Overwhelming being 8×3.
- Strong draw (Acrobatics, Machine Learning) reduces Mind Rot's impact; Runic
  Pyramid reduces it substantially by carrying cards between turns.
- Pyre offsets the energy loss from Waste Away.
- Under Sloth, expensive high-value cards (Impervious, Ice Lance) use the limited
  card plays; Pocketwatch pairs with a 3-card turn, which Sloth already enforces.

### Queen — Chains of Binding and Bound

- **Puppet Strings** applies 3 Chains of Binding to all players; **You're Mine**
  applies 99 Frail, 99 Weak and 99 Vulnerable.
- **Bound**: only 1 Bound card can be played each turn; cards are un-Bound at
  end of turn.
- Recorded interactions: after a Bound card is played, no other Bound card can
  be played that turn even via Sly or a Duplicator. Cards duplicated by Music
  Box or Dual Wield are also Bound. **Transforming** a Bound card in battle
  removes Bound from it. Bound cards un-Bind at end of turn even when Retained.
  A Bound card played once and returned to hand still cannot be played again
  that turn.
- The Queen's pattern depends on the Torch Head Amalgam (which carries
  **Minion**) being alive. Source: [Queen](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Queen).

**[wiki-driven]** Queen timing recorded in the [Queen Notes and Interactions
sections](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Queen#Notes):
- If the Amalgam dies after its turn to an effect such as Doom, the Queen
  immediately switches to Off with Your Head, skipping the usual Enrage.
- If the Amalgam is killed on turn 2 or earlier, the Queen does not use Enrage on
  her first cycle.
- After You're Mine the player is effectively permanently Vulnerable, making the
  enraged loop land as Off with Your Head 7×5 (9×5 at A9) and Execution 25 (30).

## Buffs you can hold

| Buff | Effect | Stack | Between turns |
|---|---|---|---|
| **Strength** | Increases attack damage by X. | Intensity | Permanent |
| **Dexterity** | Increases Block gained from cards by X. | Intensity | Permanent |
| **Artifact** | Negates X debuffs. | Counter | Conserved |
| **Thorns** | When hit by an attack, deal X damage back. | Intensity | Permanent |
| **Vigor** | Your next Attack deals X additional damage. | Intensity | Conserved |
| **Buffer** | Prevent the next X times you would lose HP. | Counter | Conserved |
| **Intangible** | Reduce all damage taken and HP loss to 1, for X turns. Removed at the end of the enemy turn. | Duration | Decremented |
| **Plating** | At the end of your turn, gain X Block; reduced by 1 at the start of your turn. On enemies, decreases by 1 per player per turn. | Intensity and Duration | Decremented |
| **Blur** | Block is not removed at the start of your next X turns. | Duration | Decremented |
| **Barricade** | Block is not removed at the start of your turn. | Does not stack | Permanent |
| **Regen** | At the end of your turn, heal X HP, then reduce Regen by 1. | Intensity and Duration | Decremented |
| **Block Next Turn** | At the start of your next turn, gain X Block. Modified by Block modifiers including Dexterity and Frail. | Intensity | Consumed |
| **Energy Next Turn** | Gain X additional energy next turn. | Intensity | Consumed |
| **Draw Cards Next Turn** | At the start of your next turn, draw X additional cards. | Intensity | Consumed |
| **Free Attack** (Unrelenting) | Your next X Attacks cost 0. | Counter | Conserved |
| **Duplication** | Your next X cards are played an extra time. | Counter | Conserved |
| **Gigantification** | The next X Attacks you play deal triple damage. | Counter | Conserved |
| **Temporary Strength** | Flex Potion, Reptile Trinket, Setup Strike, Coordinate and Feeding Frenzy all grant X Strength **until end of turn** and are mechanically identical. | Intensity | Removed |
| **Temporary Dexterity** | Speed Potion, Anticipate and Helical Dart, likewise. | Intensity | Removed |

Ironclad powers (Demon Form, Feel No Pain, Dark Embrace, Rupture, Corruption,
Juggernaut, Inferno, Rage, Flame Barrier, Self-Forming Clay, Unmovable,
Hellraiser, Stampede, Juggling, Cruelty, Vicious, Colossus, Crimson Mantle,
Aggression, One-Two Punch, Pyre) are listed with exact text on
[wiki.gg Buffs](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Buffs).

## Status cards

Status cards are added to your deck by enemies and effects. Two matter enough to
state here; the rest carry their text on screen.

- **Dazed** — Unplayable, Ethereal. Cannot be played; Exhausts itself if in hand
  at end of turn. Sources include Eye With Teeth (Distract, 3 to discard),
  Chomper (Screech, 3 to discard), Haunted Ship (Haunt, 5 to discard),
  Noisebot (Noise, 2 to draw and 2 to discard), Entomancer (Personal Hive, into
  the draw pile), Boost Away, and Blessed Antler (3 into the draw pile after the
  opening hand). Letting a Dazed Exhaust triggers Joss Paper, Forgotten Soul and
  Charon's Ashes. Source: [Dazed](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Dazed).

  **[wiki-driven]** Dazed interactions from the [Dazed Notes and Interactions
  sections](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Dazed): Compact converts it to Fuel(+); Flak
  Cannon exhausts it for damage; Iteration draws 2 (3 upgraded) if it is the
  first Status drawn that turn; Trash to Treasure channels a random Orb when it
  is created; Pagestorm triggers on drawing it.
- **Frantic Escape** — see The Insatiable above. Playable, and the exception to
  every other Status card.

## Card keywords

See [Keywords](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Keywords).

- **Exhaust** — removed from the deck until the end of combat, into the Exhaust
  pile. Recoverable only by specific cards (Howl from Beyond, Knife Trap,
  Summon Forth, Bombardment, Make It So, Eidolon, Bolas).
- **Ethereal** — Exhausted automatically if in hand at the end of your turn.
- **Innate** — always appears in the first hand. Innate cards **replace** normal
  draws rather than adding to them; if there are more Innate cards than the
  opening hand size, all are still drawn.
- **Retain** — not discarded at end of turn. Some Statuses and Curses discard
  themselves anyway as part of their effect.
- **Replay** — played an additional time in a row; multiple sources stack
  cumulatively.
- **Unplayable** — cannot be played and has no energy cost. If an effect tries
  to play one (Havoc, Distilled Chaos) it goes to the discard pile instead and
  does not count as a card play.
- **Eternal** — cannot be removed or transformed from your deck. Can still be
  transformed in-battle by BEGONE! or Entropy, and Thieving Hopper can be made
  to steal one.
- **Fatal** — triggers when the card kills a non-Minion enemy.
- **Block** — prevents damage until next turn; damage hits Block before HP.
- **Energy** — the standard start of a turn grants 3 Energy; it is not conserved
  across turns except through an effect such as Ice Cream. See [Keywords](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Keywords).
