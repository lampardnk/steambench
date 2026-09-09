---
description: The execution contract — the virtual pad is the only way to act, the mod is read-only, and what stops a plan. Read before any input.
character: ironclad
act: any
category: controls
ascension: a1
keys: [controls, execution, contract, pad, buttons, focus, navigation, d-pad, card play, targeting, scout, map, batching, pause, incident, safety, potion, overlay, hand, bundle, neow, preview, confirm]
sources: [operator observation, live verification]
---

# Controls and the execution contract

The pad is a virtual Xbox controller: `a b x y lb rb lt rt back start guide ls rs`
and d-pad directions `up down left right`. It is the only way to act. The
STS2MCP mod adds read-only UI focus and card-instance observation; it has no
action endpoint.

## Verified button mapping (Settings -> Input)

| Input | Meaning |
|---|---|
| d-pad / left stick | move the highlight between cards, targets, map nodes, rewards, menu entries |
| `a` | select the highlighted element |
| `y` | confirm: End Turn in combat, Proceed on reward screens, confirm a selection |
| `b` | cancel / back; deselects a lifted card; closes an overlay |
| `x` | top panel (deck, relics, potions) |
| `back` | view map |
| `lb` / `rb` | page left / right; draw and exhaust pile overlays |
| `lt` / `rt` | draw pile / discard pile |
| `start` | pause and settings. Never change settings, never quit. |

## How to read any screen

**These screens are rows, stacked top to bottom. The pad walks them.** The thing
you want is above, below or beside where you are, and the press is towards it.
Do not solve a route through the reported wiring, and do not call something
unreachable because the wiring names no path - several screens are not wired the
way they are drawn. Press towards it, look, press again. Directional presses
activate nothing, so a wrong one costs a press. Give up only when focus stops
moving on both axes or returns somewhere it has already been: a card row wraps
into a closed loop on purpose, and there the answer is a bound button.

**Bound buttons beat navigation.** An element carrying `press` is activated by
that button from anywhere, whatever holds focus. Some controls are reachable no
other way - a card reward's Skip sits outside a row that wraps into itself, and
is bound to `b`.

**Two enabled controls can share one bound button, and the innermost wins.** A
selection confirm and End Turn both report `press: y` in combat; View Upgrades
and Confirm both do in the card zoom. Close the inner thing with `b` first, then
press what you meant.

**When a screen is unreadable, fuzz out of it.** A `b`, or a few directional
presses, returns almost anything to somewhere recognisable, and both are
reversible. Do that and re-observe before reporting an issue.

**A directional press that changes nothing** means focus was already at that
edge. One exploratory press is always safe; re-read before assuming a move is
still needed.

## Screen behaviour observed on this build

- **Map.** Reachable options occupy one row: LEFT and RIGHT move between them in
  visual order; up and down do nothing. `map.current_position` is the last
  visited LOCATION, not a cursor - a next node may already be highlighted. Read
  `map.nodes` and `next_options` rather than tracing a route from a screenshot.
  Each reachable node IS an element, labelled "<Type> at column C, row R" -
  the same col, row and type its `next_options` entry carries, so the two line
  up exactly. Its focus PATH is an auto-generated `@Control@362`, which names
  nothing; the label does. The type names down the right-hand side at x=1582
  are the legend, and carry no activation: they are captions, not nodes.
- **Selection screens confirm separately, and `can_confirm` says when.**
  `hand_select` and `card_select` name a candidate set; `a` on a candidate
  selects it and NEVER finishes the screen. A separate Confirm bound to `y` does.
  When `can_confirm` is already true the screen is satisfied and `y` is the whole
  remaining move - pressing `a` again does nothing at all. "Up to N" is satisfied
  by fewer than N, including none. A shrinking candidate list is selection
  working: `hand_select.cards` omits what is already in `selected_cards`.
- **Pack, bundle and card-selection.** LEFT/RIGHT moves between choices, `a`
  opens a preview, `b` cancels it.
- **The bundle preview IS the confirm step.** `a` on a bundle opens its cards
  side by side, with back on `b` and a CHECKMARK ON `y`. `y` there takes the
  bundle. Confirm, Cancel and View Upgrades exist only inside a preview, never on
  the bundle screen. A further `a` zooms one card, and that zoom is the only view
  where `y` toggles the upgrade rendering instead of confirming. Every open and
  close leaves the previous generation's card nodes in the tree, so one card name
  can match three focusable elements; confirm the bundle, never route to a card.
- **Transform preview.** The card beside your choice re-rolls about once a
  second. That is animation and never decides the result: confirm with `y`.
- **Events and rewards.** UP/DOWN moves and `a` picks, but sibling focus paths
  are auto-generated (`@Control@1386`) and name no item. When the label is
  opaque, find the focused item in the screenshot: it is drawn raised and
  enlarged, usually with a tooltip, and is not simply the topmost or leftmost.
- **Reward screens.** Read `rewards.items` live: contents vary by seed and a
  screen may hold several gold rows plus a card row. Each row is focused and
  activated separately, and collecting one moves focus to an auto-generated
  sibling, so re-read focus first. A card row opens the card-reward screen.
  **There is no Proceed control**: the one button is Skip on `y`, and Skip also
  finishes the screen once you have taken what you want. `can_proceed: true` does
  not promise a Proceed button - it says `y` will leave. Its absence is not a
  fault.
- **Rest sites.** Read `rest_site.options` and their enabled state; services vary
  by run. Empty `options` with `can_proceed` true is a resolved site: `y`
  proceeds.
- **Choosing a card to enchant or to smith ends with NO FOCUS, on purpose.**
  Once the card is chosen, the foreground shows it beside what it becomes, and
  the only controls are `b` to go back and `y` to confirm. `ui.focused_element`
  and `ui.focus_path` are both null and no directional press will change that -
  the screen is not waiting for one. `card_select.can_confirm` is already true,
  which is the tell. The large card elements are the before-and-after preview,
  not choices: never try to activate one, and never route to a card by name
  here. This holds for the rest-site smith and for any event that asks which
  card to enchant; events that enchant at random show no such screen at all.
- **Combat focus is one vertical cycle, and `down` walks it.** Top to bottom:
  potion slots, relics, the allies-and-enemies field, the hand - then it wraps.
  Left and right move within a row. The hand is focused when a turn begins.
- **`focused_card` null means focus is outside the hand**, not that input was
  lost, and the hand is never more than one lap of `down` away. KEEP PRESSING
  `down` - one that lands on relics has not failed, it has moved one row. No
  interface state here is worth losing a turn over. Hand cards are also ordinary
  addressable elements labelled with the card name.
- **Combat card play.** `a` first selects a card and then confirms it, Defend
  included. Null Godot focus can mean a self-target card is selected, not lost
  input: read `in_card_play` and `selected_card`. Never blindly double-`a` or
  navigate the hand during targeting, and do not assume stable hand indices.
- **`x` focuses the LEFTMOST potion slot, whether or not it holds a potion.**
  That slot is often empty, so the panel opens onto nothing; an empty slot is not
  a fault. The holders never name their potions - one element per slot, labels
  are Godot node names. `activation: "a"` marks a holder that HOLDS a potion, no
  activation marks an empty one, and `player.potions` names what you have with
  each `slot`; the occupied holders sit in that order left to right. Walk the row
  with `left` and `right`.
- **`a` on a holder does not drink the potion.** It opens that potion's popup,
  which names it and offers Use and Discard - so the popup is how you confirm
  which holder you are on. Discard sits under the cursor and Use directly above,
  so `up` reaches Use. `b` backs out having spent nothing.
- **Zero energy.** Every card with a positive cost reports `can_play: false`.
  Costs are STRINGS ("2"), so compare as numbers, and a batch spends energy as it
  goes: sum the whole plan against the turn's energy.
- **Powers** leave the hand for the power area rather than a pile, so nothing
  lands in a pile to wait on.
- **Main menu.** A visibly loaded main menu can report null focus. One `a`
  establishes focus on SingleplayerButton; observe before activating anything.
- **`scout`** scrolls the map with a stick. Camera motion may leave the mod JSON
  unchanged: inspect the next screenshot rather than concluding the input failed,
  and never repeat a scout on an unchanged view.

## Starting a run

steambench always wants a fresh run and the game may resume an old one. At
startup only: abandon any run in progress and confirm, choose Singleplayer then
Standard, pick the requested character and ascension, Embark, and verify that
`run.floor` is 1 and the character matches. Never continue somebody else's run.
Once startup is verified, never abandon or restart, including after a reload.
