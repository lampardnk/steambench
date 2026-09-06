---
name: sts2
description: How to play Slay the Spire 2 through steambench: sensors (sts2_state, sts2_look, wiki), the virtual Xbox pad (pad_dpad, pad_press), verified controls, screen-by-screen tips, survival rules, and where to keep notes.
---

# Slay the Spire 2 (steambench)

You are connected to a running Slay the Spire 2 game. You cannot see the screen directly.
You have two sensors and one actuator, all exposed as tools:

- `sts2_state`: exact structured game state from the STS2MCP mod. Cheap. Primary sensor.
- `sts2_look`: a vision model describes a screenshot. Slow. Use it only when `sts2_state` reports a menu,
  popup, or unknown screen, or when the state did not change after your input.
- `sts2_wiki`, `sts2_compendium`, `sts2_profile`, `sts2_profiles`: reference data. Use `sts2_wiki`
  before picking or playing a card or relic whose effect you do not know.
- `pad_dpad`, `pad_press`, `pad_stick`, `pad_neutral`, `pad_status`: the virtual Xbox pad. This is the only way to act.
- `run_over`: call this once when the run ends (death, victory, or the game cannot continue). It ends the session.

## Folders in this skill

- `controls/` (read only): verified button mapping and cursor rules. Read `controls/CONTROLS.md` before the first input.
- `wiki/` (read only): game basics and character notes. Do not edit these files.
- `scratchpad/`: yours. Keep notes here (deck plan, relics, what worked, cursor quirks you discovered).
  Write a short `scratchpad/run.md` and update it every few floors. Never write anywhere else.

## Loop

1. Call `sts2_state`.
2. If you have not started your run yet, follow "Starting a run" in
   `controls/CONTROLS.md`: abandon any run already in progress, confirm, then
   start a new singleplayer run with the character and ascension you were given.
3. Decide one small step from the state. Think in game terms: energy, block, enemy intents, card effects.
4. Send one or a few pad actions. Keep holds short (default 80 ms). Do not send long sequences blind.
5. Call `sts2_state` again. If nothing changed, call `sts2_look` ("where is the highlight? is a popup open?"),
   then adjust. Never repeat the same blind input more than twice.
6. Repeat. Narrate each decision in one or two short sentences before acting; do not pad your messages.

## Rules

- Never quit the game, change profiles, or change settings. Abandoning a run is allowed only as step 1 of
  "Starting a run"; at any other time, decline a quit or abandon prompt with `b`.
- If pad actions have no visible effect twice in a row, call `pad_status`; if it reports a problem, say so and stop.
- If `sts2_state` says the mod is unreachable, wait a few seconds, retry once, then report and stop.
- Prefer safe, incremental inputs over clever multi-press combos.
- When the run is over, write a final summary to `scratchpad/run.md`, then call `run_over` with the result.
- Only call `run_over` when the game itself says the run ended: `sts2_state` reports `state_type` of
  `game_over`, or you are back at the main menu with no run in progress. Losing a fight you can still
  act in, or a screen you cannot read, is not the end of a run. steambench records the game's own state
  next to your report and flags a mismatch.
