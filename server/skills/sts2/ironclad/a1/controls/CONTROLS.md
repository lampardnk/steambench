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

Outside combat, `lb`, `rb`, `lt`, `rt`, `x` and `back` open overlays. If an
overlay listing the whole deck appears, `b` closes it.

## Screen behaviour observed on this build

- **Map.** The reachable next options occupy one row: LEFT and RIGHT move
  between them in visual left-to-right order, up and down do nothing.
  `map.current_position` is the last visited run location, not the cursor - a
  next node may already be highlighted. Prefer `map.nodes` and
  `next_options` over tracing a route from a screenshot. Numeric Godot node
  suffixes are not map coordinates.
- **Pack, bundle and card-selection screens.** LEFT/RIGHT moves between choices,
  `a` opens a preview, `y` confirms, `b` cancels the preview.
- **The bundle preview IS the confirm step.** On the Neow bundle screen `a` on a
  bundle opens the three cards side by side, with a back arrow on `b` and a
  CHECKMARK ON `y`. Pressing `y` there takes the bundle; it is not an obstacle
  in front of the choice, and backing out with `b` only returns you to where you
  started. `Confirm`, `Cancel` and `View Upgrades` do not exist on the bundle
  screen itself - they appear only inside a preview. A further `a` zooms one
  card, and that zoom is the ONLY view carrying `Y  View Upgrades` along the
  bottom, where `y` toggles the upgrade rendering instead of confirming.
  Every open and close leaves the previous generation's card nodes in the tree,
  so one card name can match three visible focusable elements at once. Confirm
  the bundle; never route to a card here.
- **Transform preview.** Choosing a card shows it beside a card that re-rolls
  about once a second. That roll is animation and never determines the result:
  confirm immediately with `y`. It is not a timing challenge.
- **Events and rewards.** UP/DOWN moves between options and `a` picks, but
  sibling focus paths are auto-generated (`@Control@1386`) and name no item.
  When the label is opaque, find the focused item in the screenshot: it is drawn
  raised and enlarged, usually with a tooltip, overlapping its neighbours, and
  it is not simply the topmost or leftmost one.
- **Combat.** `a` first selects a card and then confirms it, Defend included.
  Null Godot focus can mean a self-target card is selected, not lost input. Read
  `in_card_play` and `selected_card`; never blindly double-`a` or navigate the
  hand during targeting. Do not assume first-card or last-card focus, or stable
  hand indices.

- **Bound buttons beat navigation.** An element in `ui.elements` carrying
  `press` is activated by that controller button FROM ANYWHERE, whatever holds
  focus. Some controls are reachable no other way. A card reward's card row
  wires each card's up and down neighbours back to the card itself and wraps
  left/right within the row, so the row is a CLOSED LOOP by design and Skip sits
  outside it: no sequence of directional presses reaches it, and Skip is bound to
  `b`. "No verified focus path" means the route does not exist, not that it has
  not been found - look for `press` rather than probing.
- **Reward screens.** Read `rewards.items` live: the count and contents vary by
  seed, and a screen may hold several independent gold rows plus a card row.
  Each collectible row is focused and activated separately, and collecting one
  removes only that row and moves focus to an auto-generated sibling, so re-read
  focus before the next activation. A card row opens the card-reward screen.
- **A reward screen has no Proceed control.** The one button on it is Skip,
  bound to `y`, and Skip is also how you leave once you have taken what you
  want: activate the rows you want with `a`, then press `y`. `can_proceed: true`
  does not mean a Proceed button exists - it means `y` will leave the screen.
  Its absence is not a fault and not worth reporting; `y` finishes a reward
  screen whether `rewards.items` is empty or still holds things you decided to
  leave behind.
- **Rest sites.** Read `rest_site.options` and their enabled state; services vary
  by run. An empty `options` with `can_proceed` true is a resolved site, not
  missing UI: `y` proceeds.
- **Every selection screen confirms separately, and `can_confirm` says when.**
  `hand_select` and `card_select` name a candidate set and a prompt; `a` on a
  candidate selects it and NEVER finishes the screen. The finishing control is a
  separate element labelled Confirm, bound to `y`. When `can_confirm` is already
  true, the screen is satisfied and `y` is the whole remaining move - pressing
  `a` on a card again does nothing at all, and a prompt saying "up to N" is
  satisfied by fewer than N, including none. `hand_select.cards` may omit cards
  already in `selected_cards` rather than repeating the whole hand, so a
  shrinking candidate list is selection working, not cards disappearing.
- **Zero energy.** Every card with a positive cost reports `can_play: false` with
  `EnergyCostTooHigh`. Costs are reported as STRINGS ("2"), so compare them as
  numbers. A batch spends energy as it goes: sum the whole plan against the
  energy the turn actually has, not one card at a time.
- **Powers.** A Power leaves the hand for the power area rather than a discard or
  exhaust pile, so nothing lands in a pile to wait on. Let it settle before
  navigating to the next card.
- **Main menu.** A visibly loaded main menu can report null focus. One `a`
  establishes focus on SingleplayerButton; observe before activating anything.
- **`x` focuses the LEFTMOST potion slot, whether or not it holds a potion.**
  This is the single most common way to get stuck here: the leftmost slot is
  often empty, so the panel opens onto nothing, and an empty slot is not a
  fault. Move along the row with `left` and `right` to reach the potion you
  want.
- **The holders never name their potions.** They are a row of 60x60 elements in
  the top bar, one per SLOT including empty ones, and their labels are Godot
  node names (`PotionHolder`, or null for the siblings). What tells you the row
  apart is `activation`: a holder carrying `activation: "a"` holds a potion, and
  one with no activation is an empty slot. `player.potions` names what you have,
  each with its `slot`, and the occupied holders sit in that order left to
  right. Count occupied holders, not positions.
- **Pressing `a` on a holder does not drink the potion.** It opens that potion's
  popup, which names it and offers Use and Discard, so the popup is also how you
  confirm which holder you are on: open it, read it, `b` out if it is the wrong
  one. Nothing is spent until Use is activated. Discard sits under the cursor
  and Use is directly above it, so `up` reaches Use.
- **Top-bar panels during combat.** `b` closes the panel and returns focus to
  the combat field, which is one `down` short of the hand.
- **The potion holders carry no potion names.** They are a row of 60x60
  elements in the top bar, and their labels are Godot node names
  (`PotionHolder`, or null for the siblings) - they never say what is in them,
  and the row has one element per SLOT, including empty ones. Do not try to work
  out which holder holds which potion from the element list; it does not say.
  `player.potions` is what names them, each with its `slot`, and the holders sit
  in that same left-to-right order.
- **Pressing `a` on a holder does not drink the potion.** It opens that potion's
  popup, which names it and offers Use and Discard. So the popup is how you
  confirm which holder you are on: open it, read it, and `b` out if it is the
  wrong one. Nothing is spent until Use is activated, so this is the cheap way
  to resolve an unlabeled holder rather than reporting it.
- **Combat focus is one vertical cycle, and `down` walks it.** The rows are, top
  to bottom: potion slots, relics, the allies-and-enemies field, the hand - then
  it wraps back to the potions. Left and right move within a row. The hand is
  focused when a turn begins; `x` jumps to the potions; `down` from there goes
  relics, then the field, then back into the hand.
- **`focused_card` null means focus is outside the hand**, not that input was
  lost, and the hand is never more than one lap of `down` away. KEEP PRESSING
  `down` until a card is focused rather than concluding a press failed - one
  `down` that lands on relics has not failed, it has moved one row. There is no
  interface state here worth losing a turn over. The hand's cards are also
  ordinary addressable elements - the card name is the label - so routing to one
  by label works too.
- **Two enabled controls can share one bound button, and the innermost one
  wins.** `SelectModeConfirmButton` and `End Turn 2` both report `press: y` in
  combat; `View Upgrades` and `Confirm` both report `press: y` in the card zoom.
  The press goes to whatever opened most recently: with a selection active `y`
  confirms the selection rather than ending the turn, and inside the card zoom
  `y` toggles the upgrade view rather than confirming the bundle. So close the
  inner thing first with `b`, then press the button you meant.
- **When the interface is in a state you cannot read, fuzz out of it.** A `b`,
  or a few directional presses, returns almost any screen to somewhere
  recognisable, and both are reversible. Do that and re-observe before reporting
  an issue: an unfamiliar overlay is not an incident.

A directional press that changes nothing means the focus was already at that
edge of the reachable options. One standalone exploratory press is always safe;
re-read the highlight before assuming a move is still needed.

**READ THE SCREEN THE WAY A PLAYER LOOKS AT IT.** Every screen here is rows
stacked top to bottom, and the pad walks them: the thing you want is above,
below or beside where you are, and the press is towards it. Do not try to solve
a route through the reported wiring and do not conclude a thing is unreachable
because the wiring does not name a path - several screens are not wired the way
they are drawn, and the potion strip, the combat rows and a reward list with
auto-generated siblings are all walked rather than solved. Press towards it,
look, press again. Directional presses activate nothing, so a wrong one costs a
press. Give up only when focus stops moving on both axes, or comes back
somewhere it has already been - a card row wraps into a closed loop on purpose,
and there the answer really is a bound button.

## Execution contract (learning player)

- Prefer `play` keyed by an observed card `instance_id`. The executor computes
  the hand-navigation segment, verifies its destination once, then checks
  selection and the completed play. A transport failure cancels the remainder.
- Self-target and multi-enemy targeting go through the same helper, which
  verifies the selected card and the enemy's combat identity before confirming.
  Ally-target cards still need observed navigation.
- At most eight actions per plan. Draws, random effects, choices, replay,
  return-to-hand effects and unexpected hand changes stop the batch.
- UI navigation allows 1-12 d-pad presses per sequence with one fresh state
  check at its boundary. Navigation and activation may share a decision when the
  destination focus is known exactly. Unknown transitions, purchases, event
  choices and abandonment end the plan. Only the known Singleplayer ->
  Standard -> character-select transitions continue after an activation, and
  each is observed and verified.
- `scout` scrolls the map with the joystick, up/down, left or right stick,
  100-600 ms, released automatically. Up is y=-1. Camera motion may leave the
  mod JSON unchanged: inspect the next screenshot rather than concluding the
  input failed, and do not repeat a scout on an unchanged view.
- Animation waits and cheap state checks stay inside the executor. Legal free
  cards remain playable at zero energy.
- Be quick with low-risk UI hypotheses: one brief prediction, bounded input,
  fresh state. Do not re-analyse the whole route before every button.
- A plan the runtime rejects before any input is refined with the reason in
  context for a bounded number of rounds. Once input has reached the game and
  failed, the player pauses: do not repeat the input, back out, play a different
  card or change scenes to debug. `report_issue` is for contradictory state,
  unsupported or risky activation, and suspected bugs - not for an untested
  reversible hypothesis.
- Stale plans, repeated identical plans and prolonged lack of progress pause
  rather than generating unbounded input.
- Reloading the player does not restart the game. Resume the supervisor-reviewed
  interaction from fresh state; never repeat the startup sequence.

## Starting a run

steambench always wants a fresh run and the game may resume an old one. At
startup only: abandon any run in progress and confirm, choose Singleplayer then
Standard, pick the requested character and ascension, Embark, and verify that
`run.floor` is 1 and the character matches. Never continue somebody else's run.
Once startup is verified, never abandon or restart, including after a reload.
