# Scratchpad - this run only

Archived with the room and never inherited. Durable notes belong in `learned/`.

## Written by the learning runtime

- `facts.json`: the current authoritative observation, overwritten each decision.
- `run.md`: short strategic hypothesis and the last verified outcome.
- `events.jsonl`: observations, inputs, results, errors and model usage.
- `metrics.json`: cumulative decision and input counts, wall time, model and memory identity.
- `curriculum.json`: this run's view of the objective ladder; the durable copy lives in `learned/curriculum.json`.
- `candidates.jsonl`: proposed lessons linked to decision evidence. Not accepted facts.
- `accepted.json`: optional frozen lesson set copied from `.runtime/wolf/astra-memory/accepted.json`.
- `observed-catalog.json`: bounded, evidence-linked card, enemy and event variants seen this run.
- `learning.jsonl`: the required pre-action hypothesis and the separately recorded outcome.
- `checkpoint.json`: atomic same-run task, strategy, startup verification, counters, latest state and pending issue; restored on a player-only reload.
- `incidents/<id>/`: immutable incident JSON with before/after screenshots, recent inputs and sensors, plan and build identity.
- `attention.json`, `incident-resolutions.jsonl`: the current pending issue and the supervisor review history.

None of these files is replayed wholesale into a prompt. Only current facts, a
short strategy, the latest result, the active objective and the notes retrieved
for the current situation carry forward.

## Suggested files for a tool-driven player

- `run.md`: character, ascension, deck plan, relics, floor, HP, updated every few floors.
- `lessons.md`: cursor quirks and screens that confused you. Promote anything durable into `learned/`.

Accepted lessons must match the game assembly, mod assembly and player-policy
fingerprints, carry a human review and evidence, and fit the eight-lesson
budget. Mismatched or malformed memory is ignored.
