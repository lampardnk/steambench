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

## The grammar of every screen

**d-pad moves. `a` selects. `y` confirms or proceeds. `b` leaves.** Every screen
in this game is that same sentence, and almost every way a run gets stuck here
is one of the four being mistaken for another.

- **`a` acts on the highlighted thing and never advances the screen.** On a
  selection it TOGGLES, so a second `a` undoes the first.
- **`y` is the only thing that advances.** It confirms a selection, proceeds
  past a screen, ends a turn, and answers a confirmation raised by something
  else. When a screen looks finished but nothing happens, `y` is usually the
  press that was missing.
- **`b` leaves, cancels, or closes what is open** - and leaving is itself a
  choice, so `b` frequently raises a confirmation that `y` then answers. Both
  are reversible up to that `y`.

So read a screen by asking which of the four it is waiting for, rather than by
looking for a button named after what you want to do. The rules below are that
sentence applied to particular screens, not separate rules to memorise.

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

**A panel shortcut is the way INTO its row, not only a way to open it.** `x`,
`back`, `lb`/`rb` and `lt`/`rt` put focus on a fixed element wherever it was, so
a row the d-pad cannot reach is one press away. When the thing you want carries
no `press` of its own, the entrance is the panel button sitting in its row:
`x` reaches the potion strip from anywhere in a fight. Press the shortcut, then
walk the row. This is also the best answer when a screen has stopped making
sense - a shortcut lands somewhere known, where a direction only guesses.

**A full-screen element whose neighbours all point at itself is a modal, and
`b` closes it.** Inspecting a card opens `NInspectCardScreen` at 0,0,1920,1080
with `activation: null` and every neighbour its own id. Nothing in the elements
list closes it: what you see listed is the screen UNDERNEATH, and that screen's
own Back may report `enabled: false` and sit off-screen at a negative x while
the overlay is up. Its disabled state says nothing about the thing on top.
`back` is the map and the overlay swallows it; `b` is the way out.

**Two enabled controls can share one bound button, and the innermost wins.** A
selection confirm and End Turn both report `press: y` in combat; View Upgrades
and Confirm both do in the card zoom. Close the inner thing with `b` first, then
press what you meant.

**When a screen is unreadable, fuzz out of it - but fuzzing means VARYING.** A
`b`, or a few directional presses, returns almost anything to somewhere
recognisable. Keep track of what you have already pressed on this screen and do
not press it again: a button that changed nothing will change nothing on a
second attempt, and repeating a combination is how a run spends ten decisions
standing still. One press, then a fresh read. When `b`, a direction and the
panel toggle have each been tried once and the screen has not moved, it is not
going to - report that instead of pressing a fourth time.

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
- **Selection screens: `can_confirm` is the only readout.** These report no
  selected list, so a press that worked looks exactly like one that did nothing.
  True means a valid choice is held and `y` takes it; false means nothing is
  selected, whatever the highlight shows. The Confirm control mirrors it and
  goes `enabled: false` while it is false, so a dark Confirm means nothing is
  chosen rather than a broken screen. Read it after every press.
- **A card played from hand that asks you to pick another card** - an upgrade, a
  discard, an exhaust - opens `hand_select` with a `mode` and a prompt beginning
  "Confirm", usually with one card ALREADY selected and `can_confirm` already
  true. There `y` alone finishes it, and an `a` first will deselect what was
  chosen for you. The candidate list is what is eligible right now, so a card
  missing from it is ineligible rather than absent: an upgrade prompt does not
  offer a card that is already upgraded.
- **"Up to N" is satisfied by fewer than N, including none**, and on "choose N"
  `can_confirm` stays false until N are picked.
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
- **A shop room is left with `back`, not `b`.** `back` opens the map, and
  taking the map is what ends the room: on this build the state went straight
  from `shop` to `map` on a single `back` press. `b` on the shop's own
  BackButton did nothing across five presses several minutes apart, even though
  it reports `enabled: true` and `press: "b"`, and `shop.can_proceed` stays
  false with Proceed disabled because a shop is not left that way. Use `b` for
  what is OPEN ON TOP of the shop - a card inspection overlay - and `back` to
  leave the room.
- **Shops draw the artwork over the thing you buy.** The purchasable element is
  the PRICE TAG - `reference.kind: "entry"` - and the relic or potion picture
  beside it is `reference.kind: "model"`, which no element names as a neighbour
  and no route can reach. Shop cards are labelled `price | cost | type | name`,
  but shop relics and potions are labelled by price ALONE, so `shop.items` is
  the only place a name and a price meet. Turn the name you want into its price
  there, then route to the entry carrying that price.
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
- **Combat focus is one vertical cycle, and `down` walks it - only `down`.**
  Top to bottom: potion slots, relics, the allies-and-enemies field, the hand -
  then it wraps. `up` is inert on this build, so a row above is reached by
  going down and round, or by its shortcut. Left and right move within a row,
  and the creature field is a closed pair: `left` and `right` there only toggle
  between ally and enemy and never leave it. The hand is focused when a turn
  begins.
- **`focused_card` null means focus is outside the hand**, not that input was
  lost, and the hand is never more than one lap of `down` away. KEEP PRESSING
  `down` - one that lands on relics has not failed, it has moved one row. No
  interface state here is worth losing a turn over. Hand cards are also ordinary
  addressable elements labelled with the card name.
- **`player.hand[].index` is NOT the on-screen order.** A hand read 274, 275,
  276, 264, 257 by index while the screen read 274, 276, 264, 257, 275 left to
  right - index 1 was the rightmost of five. Every hand holder carries
  `reference.instance_id`, so tie a card to the thing focus lands on by that and
  order the row by each holder's `bounds`. Counting index positions walks to the
  wrong card. The row also wraps, so the shorter way round may be backwards.
- **Combat card play.** `a` first selects a card and then confirms it, Defend
  included. Null Godot focus can mean a self-target card is selected, not lost
  input: read `in_card_play` and `selected_card`. Never blindly double-`a` or
  navigate the hand during targeting, and do not assume stable hand indices.
- **`x` focuses the LEFTMOST potion slot, whether or not it holds a potion.**
  That slot is often empty, so the panel opens onto nothing; an empty slot is not
  a fault. The holders never name their potions - one element per slot, labels
  are Godot node names. `activation: "a"` marks a holder that HOLDS a potion, no
  activation marks an empty one, and `player.potions` names what you have with
  each `slot`; the occupied holders sit in that order left to right. They also
  report `reference.kind: "potion"`, which is how the runtime identifies one
  despite the missing label, and their `up` neighbour is themselves - the row
  is only left and right plus `down`. Walk the row
  with `left` and `right`.
- **`a` on a holder does not drink the potion.** It opens that potion's popup,
  which names it - so the popup is how you confirm which holder you are on. Its
  options vary (Use and Discard, or Use and Throw) and the cursor does not
  always start on the same one, so do not count presses from an assumed layout:
  `ui.focus_path` ends in the button under the cursor - `UseButton`,
  `DiscardButton`, `ThrowButton` - and that is the only thing worth reading.
  Press `a` when it names the one you want, and `b` backs out having spent
  nothing.
- **A potion that needs a target is not spent by Use or Throw - that only ARMS
  it.** When `target_type` is `AnyEnemy` or `AnyAlly`, pressing `a` on
  Use/Throw puts the game into targeting; then LEFT and RIGHT move the aim
  between creatures and a second `a` throws it at the one you are on. Read
  `ui.targeting` and `ui.focused_creature` to see where the aim actually is
  rather than assuming it started on the enemy you wanted, and `b` cancels
  without spending the potion. A `target_type` of `AnyPlayer` or `Self` has no
  such step and resolves on the first `a`.
- **That dropdown holds focus, and `down` cannot leave it.** While
  `ui.focus_path` contains `PotionPopup` you are inside a two-item menu and
  directional presses do nothing at all - walking the rows will not start until
  you are out. `b` closes it, `x` returns to the potion bar, `left` walks out of
  the bar towards the relics. Any of them is reversible; check `focus_path`
  after, not the press.
- **A one-shot discount makes EVERY eligible card report cost 0 at once.**
  "The next Attack you play costs 0" is true of each attack in hand
  individually - each would be free if it were the next one played - so several
  cards show cost 0 and `can_play: true` when only one of them can actually be
  free. `cost` and `can_play` describe a card played NEXT, not a set played
  together. While such an effect is live, send one play per decision and
  re-read; a batch will have its later cards refused.
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
