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

A directional press that changes nothing means the focus was already at that
edge of the reachable options. One standalone exploratory press is always safe;
re-read the highlight before assuming a move is still needed.

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

## Survival defaults

- Below 40% HP prefer a rest site to a fight, and rest rather than smith.
- Never enter an elite below 60% HP.
- When an enemy intends more damage than your current HP, block first.

## Starting a run

steambench always wants a fresh run and the game may resume an old one. At
startup only: abandon any run in progress and confirm, choose Singleplayer then
Standard, pick the requested character and ascension, Embark, and verify that
`run.floor` is 1 and the character matches. Never continue somebody else's run.
Once startup is verified, never abandon or restart, including after a reload.
