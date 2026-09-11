# Scratchpad — run-local state

`/workspace/skills/sts2/scratchpad/` holds per-run state. It is archived with
the room and **never inherited across seeds**: every run is a different map,
different offers and different rolls, so nothing here is read by a later room.

`skills/sts2/scratchpad.md`, one level up, is reserved for proposed factual
corrections for human review. It is not retrieved or copied into later rooms.
No encounter diary, run verdict, or advice for the next seed belongs there.

## What is in here

| File | What it holds | Lifecycle |
|---|---|---|
| `facts.json` | Snapshot of the game state the last decision was made against. | Overwritten each decision. |
| `events.jsonl` | Observations, dispatched semantic actions, verification, errors, token usage. | Appended each decision. |
| `metrics.json` | Decisions, wall time, verified plays, execution overhead, the agent roster. | Updated each decision. |
| `objectives.json` | The objective ladder: what the curriculum opened, how the critic settled it. | Updated on settlement. |
| `encounters.jsonl` | One handoff report per fight — outcome, HP cost, what worked, what the deck needs. | Appended when a fight closes. |
| `encounter.json` | The fight currently open, if any. | Overwritten during combat. |
| `candidates.jsonl` | The plans considered and the one chosen. | Appended each decision. |
| `learning.jsonl` | Pre-action hypotheses, and the outcomes actually observed. | Appended each decision. |
| `observed-catalog.json` | Bounded catalog of card, enemy and event variants seen this run. | Appended during the run. |
| `checkpoint.json` | Atomic run state, used when the player container reloads without restarting the game. | Saved periodically. |
| `act1-timer.json` | Wall time spent in Act 1, for pacing. | Updated each decision. |
| `incidents/<id>/` | Immutable capture of one failure: before and after state, sensor ring, screenshot, the rejected plan. | Created on each pause. |
| `attention.json` | Pointer to the unresolved incident, when one is open. | Written on pause, cleared on resume. |
| `incident-resolutions.jsonl` | The supervisor reviews that resumed the run. | Appended on resume. |

## What belongs in the library instead

Anything true of the seed is worthless next run: a map roll, an offer, a turn
transcript. What transfers goes to a human as a proposal in `scratchpad.md`,
and a human decides whether it joins the library:

- How a semantic choice behaves and what transition it produces → the relevant `meta_strategy/` or act-specific note.
- What an act can put in front of you → `ironclad/a1/act1/{normal,elite,boss,unknown,ancient,potion}/`.
- Rules that hold across runs → `ironclad/a1/meta_strategy/{buffs,debuffs,mechanics,map,keywords,cards,relics,restsite,merchant,rewards,deck_archetypes,playbook}/`.

No narrative run diaries or end-of-run strategic reflections are generated. Structured checkpoints and incident evidence stay with this run; they are never inherited as game knowledge.
