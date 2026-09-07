# Runtime-owned run artifacts

- facts.json: current authoritative observation, overwritten each decision.
- run.md: short strategic hypothesis and last verified outcome.
- events.jsonl: observations, inputs, results, errors and model usage; never replayed wholesale into context.
- metrics.json: cumulative decision/input counts, wall time, model and memory identity.
- candidates.jsonl: proposed lessons linked to decision evidence; not accepted facts.
- accepted.json: optional frozen input lesson set copied from .runtime/wolf/astra-memory/accepted.json.
- observed-catalog.json: bounded, evidence-linked card/enemy/event variants from this run, not an exhaustive wiki or universal base statistics.
- learning.jsonl: required pre-action evidence/hypothesis notes and separately recorded observed outcomes, never replayed wholesale.
- checkpoint.json: atomic same-run task, strategy, startup verification, counters, latest state and pending issue, restored on player-only reload.
- incidents/<id>/: immutable incident JSON and available before/after screenshots, recent input attempts/sensors, plan and build identity.
- attention.json: current pending/resolved issue pointer; ordinary chat cannot acknowledge it.
- incident-resolutions.jsonl: supervisor review/fix history, separate from original incident evidence.

Take notes every decision, including controls and failure hypotheses, but do not describe predicted actions as observed successes. Learning accurate mechanics comes before a first-run win. An issue stops further input until explicit supervisor resume. Aggressive note-taking must not inflate future context: only current facts, short strategy, latest result and compatible reviewed lessons carry forward.

Accepted lessons must match the game assembly, mod assembly and player-policy fingerprints; contain a human review and evidence; and fit the eight-lesson budget. Mismatched or malformed memory is ignored. Candidate generation is not proof that a lesson improves performance. Review and compare frozen memory variants on held-out runs before promoting them.

This folder is archived with the room. Do not write to /workspace/scratchpad; that path is not archived.
