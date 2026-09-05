# Controls (verified in game, Settings → Input)

The pad is a virtual Xbox controller. Names used by the tools: `a b x y lb rb lt rt back start guide ls rs`,
d-pad directions `up down left right`.

| Input | Meaning |
|---|---|
| d-pad / left stick | move the highlight between cards, targets, map nodes, rewards, menu entries |
| `a` | Select the highlighted element (play a card, choose a node, pick a reward, pick a menu entry) |
| `y` | Confirm (End Turn in combat, Proceed on reward screens, confirm a selection) |
| `b` | Cancel / Exit; deselects a lifted card; closes an overlay |
| `back` | View Map |
| `x` | Top panel (deck, relics, potions) |
| `lb` | View draw pile / page left |
| `rb` | View exhaust pile / page right |
| `lt` | View draw pile |
| `rt` | View discard pile |
| `start` | pause / settings. Never change settings, never quit. |

## Screen-specific behaviour

- Outside combat never press `lb`, `rb`, `lt`, `rt`, `x`, or `back`: they open deck, pile, or map overlays.
  If an overlay listing your whole deck appears, press `b` to close it.
- Pack / bundle and card-selection screens: `dpad left/right` moves between choices, `a` opens a preview
  (state shows "Preview is showing"), `y` confirms, `b` cancels the preview.
- Events and rewards: `dpad up/down` moves between options, `a` picks. After moving, use `sts2_look`
  with the question "which option is highlighted?" before pressing `a`.
- Map: `dpad left/right` moves between the available next nodes, `a` travels. Confirm with `sts2_state`
  that the floor changed.

## Combat cursor rules (verified)

- The state lists hand indices (0-based), energy, and enemy intents.
- At the start of your turn the cursor is on the FIRST card (index 0).
- After you play a card the cursor jumps to the LAST card in hand.
- Press `a` once to lift the highlighted card and `a` again to play it (the second press confirms the target;
  with a single enemy no aiming is needed). With several enemies, `dpad left/right` moves the target while lifted.
- First play of a turn: `pad_dpad right N` where N is the card index, then `a`, `a`.
- Later plays: `pad_dpad left M` where M = (hand size - 1 - index), then `a`, `a`.
- `y` ends the turn.
- Re-read `sts2_state` after every play and check that the hand changed as expected. If it did not, press `b`
  and use `sts2_look` to find the cursor.

## Survival rules

- Below 40% HP prefer rest sites over fights and rest (do not smith).
- Never enter an Elite below 60% HP.
- When an enemy intends to attack for more than your current HP, play block first.

## Main menu and starting a run (verify with `sts2_look`)

- The game opens on the main menu. `dpad up/down` moves between entries (Continue, New Run / Play, Compendium,
  Settings, Quit); `a` selects. Never select Quit or Settings.
- If a "Continue" option exists and you were told to start fresh, choose New Run instead; abandoning a run from
  the menu asks for confirmation (`dpad` to the confirm button, then `a`).
- Character select: `dpad left/right` moves between characters; the state or `sts2_look` tells you which one is
  highlighted. Ascension is a toggle or counter on the same screen: move to it with the d-pad and change it with
  `dpad up/down` or `a`, then move to Embark / Start and press `a`.
- Mods popup on first launch: if a dialog about mods appears, choose the option that keeps mods enabled.
