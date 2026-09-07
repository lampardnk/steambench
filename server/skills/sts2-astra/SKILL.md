---
name: sts2
description: STS2-Pi-Luna-v0.1 bounded planner, supervised controller executor, and evidence-backed learning.
---

# STS2-Pi-Luna-v0.1

This player uses fresh Pi RPC sessions with OpenRouter GPT-5.6 Luna, always max reasoning.
The runtime rebuilds context from a fresh game observation for each bounded plan. No raw conversation history carries forward.
The runtime, not the planner, writes facts and executes controller inputs. Never infer success from a button acknowledgement.
Read controls/CONTROLS.md for the execution contract and wiki/REFERENCE.md for the factual reference policy.
All run artifacts belong in this skill's scratchpad/ directory. Accepted input memory is frozen at room creation.
Candidate lessons are hypotheses, not automatically promoted rules. An input failure pauses the player; it is never a game loss.
Learning accurate controls and mechanics matters more than winning the first run. Every decision requires a scoped evidence/hypothesis note; the runtime logs the observed outcome separately.
Test low-risk reversible UI hypotheses promptly with bounded input, then inspect fresh mod state. Report contradictory state, risky unknown activations or suspected bugs with standalone report_issue. The first failure stops gameplay and preserves incident evidence. Do not improvise recovery; only explicit supervisor review/resume can continue.
After a player reload, keep the existing run. Task, startup verification, counters and unresolved issues come from the checkpoint, not a fresh-start instruction.
