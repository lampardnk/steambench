---
name: sts2
description: How to play Slay the Spire 2 through steambench - sensors, the virtual Xbox pad, verified controls, the learning player's execution contract, and where notes go so they outlive the room.
---

# Slay the Spire 2 (steambench)

One skill, shared by every player that plays this game. You are connected to a
running copy of Slay the Spire 2 and cannot see the screen directly.

## Folders

| Folder | What it is |
|---|---|
| `controls/` | Verified pad mapping and the execution contract. Read it before the first input. |
| `wiki/` | Game basics, characters, and the policy for using outside reference data. |
| `learned/` | Durable notes written by players, kept in git across rooms. See `learned/README.md`. |
| `scratchpad/` | This run only. Archived with the room, never inherited. |

`learned/` is the part that survives. A note written there is inherited by every
later room; anything in `scratchpad/` dies with this one.

## The learning player (STS2-Pi-Luna-v0.1)

Fresh Pi RPC sessions against OpenRouter GPT-5.6 Luna at max reasoning. The
runtime rebuilds context from a fresh game observation for every bounded plan;
no raw conversation history carries forward. The runtime, not the planner,
writes facts and sends controller input - never infer success from a button
acknowledgement.

It runs a four-part learning loop:

1. **Objective.** A curriculum proposes one concrete objective at a time from
   the live run and from what earlier rooms already completed or failed. The
   objective is in every decision's context.
2. **Act.** Bounded plans are executed and verified against fresh mod state.
3. **Verify.** A separate critic reads the objective and the evidence and
   answers success, failure or pending. Only the critic closes an objective; a
   failure's critique comes back in the next decision.
4. **Keep.** What the run verified is written to `learned/` and committed, so
   the next room starts from it.

Learning accurate controls and mechanics matters more than winning the first
run. Every decision carries a scoped evidence note; the runtime records the
observed outcome separately. Candidate lessons are hypotheses and are never
promoted automatically. Accepted input memory is frozen at room creation.

A plan the runtime rejects before any input is refined, with the reason in
context, for a bounded number of rounds. Once input has actually reached the
game and failed, the player stops and preserves incident evidence; only explicit
supervisor review or a chat reply continues it. Do not improvise recovery.

After a player reload the run continues. Task, startup verification, counters
and unresolved issues come from the checkpoint, not from a fresh-start
instruction.

## The built-in tool player

The older built-in player drives the same game through tools rather than through
the bounded planner: `sts2_state` (structured mod state, the primary sensor),
`sts2_look` (a vision model describes a screenshot; slow, for unknown screens),
`sts2_wiki` / `sts2_compendium` / `sts2_profile` for reference data, the
`pad_*` family for input, and `run_over` once when the run genuinely ends.

Its loop: read state, decide one small step, send one or a few pad actions, read
state again, and never repeat a blind input more than twice. It writes to
`scratchpad/` only.

## Rules for every player

- Never quit the game, change profiles, or change settings. Abandoning a run is
  allowed only as the first step of starting one; decline any other quit or
  abandon prompt with `b`.
- Only report a run finished when the game says so: `state_type` of `game_over`,
  or the main menu with no run in progress. Losing a fight you can still act in
  is not the end of a run, and steambench records the game's own state next to
  the report and flags a mismatch.
- Prefer safe, incremental input over clever multi-press combos.
