# STS2-Pi-Luna-v0.1

The independently selectable learning player uses **OpenRouter `openai/gpt-5.6-luna`, max reasoning**. Its display name is `STS2-Pi-Luna-v0.1`; its image is `sts2-pi-luna:0.1`, built with `Dockerfile.luna`. This supersedes the earlier GLM and Experiential Labs Astra configurations. Original `steambench-pi` / Nemotron and its key are unchanged. Internal paths `client/astra/`, setup kind `astra` and metadata field `astraPlayer` remain compatibility identifiers, not the selected model. Checkpoint schema identity remains `STS2-Pi-Learn-v0.1` so a player reload does not discard a run.

## Design: learn accurately, keep context small

1. Read authoritative STS2 state and read-only UI sensors. Keep hand, energy, intents, statuses, compact permanent deck and relevant selection data, not irrelevant pile contents.
2. Start a fresh Pi context for each decision: current facts, task, latest result, short strategy, up to eight compatible reviewed lessons, up to three operator messages, and an image when needed. Never replay the transcript or the raw learning journal.
3. Request a bounded JSON plan of at most eight actions plus a **required evidence/hypothesis note**. Learning controls and mechanics outranks winning the first run. Prefer good-enough plays to exhaustive permutation search.
4. Execute known card navigation/confirmation locally, with state checks after navigation segments and completed card plays, including ordinary card discard/exhaust publication. Batch deterministic cards; stop at draw/random/selection/replay/return-to-hand effects, unexpected hand changes, enemy roster changes or turn/room changes.
5. On the **first actual planner, provider or executor failure**, stop inputs, release the pad, capture an incident and request supervisor review. The model cannot improvise recovery or resume itself. A standalone `report_issue` action requests help without game input.

One standalone noncombat directional press is a probe: if nothing moves, that is the answer (focus was already at that edge), not a failure. Batched sequences, activations and moves with a predicted destination still pause when nothing changes, and a directional move may not predict the focus it starts from. Sensor v2 exposes `@Control@NNNN` focus paths with no map-node, event-option or grid index, so probes and images are how focus is located.

UI plans support 1–12 directional presses per sequence, checked once at the boundary. Up to eight semantic sequences can share a model decision. A later activation requires an exact screen/focus precondition; navigation before it must establish that focus. Purchases, event choices, abandonment and unknown transitions end the plan. Known Singleplayer → Standard → character-select transitions can share a plan with verified intermediate states. Combat batches use observed card identities and stop on draws, generated/random cards, selection prompts, target death/identity changes and combat completion. An actual failed input cancels the entire remainder and pauses.

The model receives structured state first. Screenshots are requested for missing UI information and incident evidence, rather than on every combat decision. Full unchanged map graphs are omitted on repeated navigation; keep the chosen route and immediate objective in strategy. The map focus gap still requires images. Metrics now record sensors, screenshot requests, completed actions, batch input counts and execution latency alongside model usage. Raw journals stay outside future context.

Up to two stale-plan rebuilds are allowed only when **no input was sent**; the third pauses. Other bounds: three unchanged observations, repeated identical plans, 800 decisions, a 180-second model deadline and 40,000 context characters. Max reasoning stays fixed; these bounds do not guarantee short latency. Before this UI revision, three right-focus decisions consumed approximately 6.4 minutes and 14.5k reasoning tokens, repeatedly reconsidering the same map route. Measure post-change decisions rather than assuming the prompt fixes that latency.

## Provider and build

The dedicated learning key is stored locally in `.runtime/wolf/learning/openrouter.key` (directory 700, file 600), outside Git and Docker build context. The backend reads it at startup from `/etc/wolf/learning/openrouter.key`. `STEAMBENCH_LEARNING_OPENROUTER_API_KEY` optionally overrides it. Never print a key, dump container environments, or copy it into documentation. The original Nemotron `OPENROUTER_API_KEY` in `.env` is separate.

```sh
DOCKER_CONTEXT=default docker build -f Dockerfile.luna -t sts2-pi-luna:0.1 .
OPENROUTER_API_KEY="$(cat .runtime/wolf/learning/openrouter.key)" \
  DOCKER_CONTEXT=default docker run --rm -e OPENROUTER_API_KEY sts2-pi-luna:0.1 --smoke
bash host/build_astra_mod.sh
DOCKER_CONTEXT=default docker compose build server
```

Do not enable shell tracing around credentials. The sensor build mounts the installed game read-only and writes `.runtime/sts2mcp/astra-out/`; it does not install into the personal game. Compatible base source must first exist from `host/install_sts2mcp.sh build`.

**Pi/OpenRouter 404 nuance:** direct API success did not prove the Pi request worked. Pi added `store` and `max_completion_tokens`; strict provider routing rejected unsupported parameters. `models.json` now uses `compat.supportsStore: false` and `maxTokensField: "max_tokens"`, retaining `provider.require_parameters: true` and `reasoning.effort: "max"`. This compatibility correction originated with GLM; the actual Luna/max screenshot audit also passed. Omitting unsupported `store` is not a privacy guarantee: OpenRouter/account/provider retention policies still apply.

Model documentation: https://openrouter.ai/openai/gpt-5.6-luna . Routing: https://openrouter.ai/docs/guides/routing/provider-selection . Reasoning: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens . Pi cost metadata is not billing evidence.

Routing has no provider allowlist, exclusions or ordering. OpenRouter can select any provider allowed by account preferences that supports the required parameters. Exact Luna/max and `provider.require_parameters: true` remain. The protected learning key is reused. Cost metadata is omitted because Luna route prices were not verified; Pi's zero cost fields must not be interpreted as free usage.

Building does not update existing containers. **Backend recreation destroys in-memory rooms.** Do not apply a server update while a room needs preservation. The older Astra room had no compatible learning checkpoint and was archived/replaced with user approval before deploying this supervisor. Future player-only reloads do not need a backend restart. See `ASTRA_HANDOFF.md` for the current checkpoint. Dashboard builds do not deploy to steambench.dev.

## Supervisor loop: stop, inspect, fix, explicitly resume

These commands require the updated backend. They read its token from local `.env` or `STEAMBENCH_TOKEN` without printing it:

```sh
node host/learning-player.mjs status ROOM_ID
node host/learning-player.mjs watch ROOM_ID --timeout 600
node host/learning-player.mjs inspect ROOM_ID
node host/learning-player.mjs pause ROOM_ID
DOCKER_CONTEXT=default docker build -f Dockerfile.luna -t sts2-pi-luna:0.1 .
node host/learning-player.mjs reload ROOM_ID
node host/learning-player.mjs resume ROOM_ID --issue INCIDENT_ID \
  --message 'What was observed, the reviewed fix, and the one interaction to retry'
```

- `node host/learning-supervise.mjs ROOM_ID` runs a bounded three-combat/15-minute observation window and requests an operator pause on exit. The limit is measured from room creation and persists across reviews/reloads. Run it only within authorized gameplay supervision. It writes a private metrics report under `.runtime/wolf/learning/`.
- `watch` is read-only and exits with code 2 on an incident. The dashboard also shows the issue. The coding supervisor can inspect/fix while this conversation is active; **there is no background service that wakes Codex after this conversation ends**. An unattended issue remains paused.
- `inspect` shows compact before/after evidence, planned action, input attempts and screenshot paths. Inspect the immutable incident before trying anything. No arbitrary back/end-turn/card presses to diagnose a failure.
- `pause` cancels the planner; wait for `agentStatus: idle` before `reload`. `reload` stops/replaces **only the player container**, preserving game/lobby/media/home, transcript, task, decision counters and the checkpoint. It never sends a fresh-start prompt.
- Reloading requires a compatible checkpoint and a successful model/checkpoint handshake. It does not auto-resume. **An ordinary chat message now resumes a paused, reloaded or issue-reporting player**: the reply is recorded in `incident-resolutions.jsonl` as `via: "chat"` with no acknowledged incident ID, the incident evidence is untouched, and the run continues. The `resume` route still requires the exact incident ID. So when a UI blocks the player, it can `report_issue` and you answer in the room chat.
- `resume` records the review in a separate resolution journal. It does not rewrite the incident. Re-observe the existing game; never abandon or restart it as part of a player fix.
- Player-only reload applies player code fixes, not a new sensor DLL or backend code. Those need separate deployment planning; do not restart the game/server as an implicit recovery step.

API equivalents: `GET /api/rooms/:id/player/status`, `POST /api/rooms/:id/player/restart`, `POST /api/rooms/:id/player/resume {issueId,message}`. All require the backend token. Releasing buttons does not freeze the game engine or prevent independent human input/animations.

## Controls and sensor nuances

- **Every card needs selection and confirmation**, including Defend. Null Godot focus can mean a self-target card is selected. Check `in_card_play` and `selected_card`; never blindly double-A.
- Card `instance_id` is a per-game-process weak-table identity, not name/index/hash. Never carry it across game processes.
- Enemy display IDs such as `TOADPOLE_0` can renumber after a death. Bind to `combat_id`, stop at roster changes and observe again before retargeting.
- Target positions use the game's internal canvas, not screenshot/room mouse pixels. The executor uses their relative directions and verifies focus after navigation; a failed focus movement stops before another button.
- Sensor v2 includes permanent deck, game/mod fingerprints and victory evidence. It is read-only. Ally-targeted cards, potions and unusual screens need observed single-button navigation or an explicit help request, not invented helper support.
- At initial startup only, abandon an inherited run and verify a newly started floor 1. On reload, checkpointed startup verification and the existing task are restored; never perform this startup again.

## Objectives and self-verification

Adapted from Voyager (Wang et al., 2023; the paper and its figures are in `research/voyager/`). Its ablations attribute most of its lifelong-learning performance to two components, and this player had neither: it had one fixed run task and no notion of an objective being finished, so nothing chose what to learn next and nothing closed the loop.

**Automatic curriculum** (`client/astra/curriculum.mjs`, prompt `curriculum.txt`). One objective at a time, proposed from the live run and from the objectives earlier rooms completed and failed. Each carries `done_when`: the observable condition that settles it, so it can actually be checked. The ladder lives at `learned/curriculum.json` in the skill library, which means the frontier is inherited by the next room rather than restarted with it. Voyager reports a 93% drop in discovered items when its curriculum is replaced by a random one.

**Self-verification** (prompt `critic.txt`). A separate call reads the objective, its `done_when` and the run's *verified* evidence — not the plan's intentions — and answers `success`, `failure` or `pending`. Only the critic closes an objective. A failure returns a critique that goes straight into the player's next decision; three failures abandon the objective so the curriculum can propose something reachable, mirroring Voyager's four-round give-up. Voyager reports a 73% drop without this module, the largest of any feedback type it ablates.

`pending` is the adaptation to this game. Voyager's tasks are single program executions, so its critic answers only success or failure. An objective here — "clear act 1 without dropping below 60% HP" — spans dozens of decisions, so the honest answer while play is still on the way is neither, and a premature `success` would teach the player that it knows something it does not.

**Iterative prompting.** Voyager refines a rejected program with the error in its next prompt rather than escalating. A plan this runtime rejects before any input reaches the game — bad shape, stale observation, a repeat of the plan just refused — now comes back as `last_result.refine_round` with `no_input_sent` and specific `guidance`, for up to three rounds. The first-error gate is unchanged where it matters: `executor.inputs` is compared across the batch, and any failure after input actually reached the pad still pauses immediately with the incident preserved.

Cost is bounded by cadence, not by model: the critic runs at act/floor boundaries with a minimum gap, and the curriculum runs only when nothing is open. Both go through `Planner.ask()` with their own system prompt, so their tokens are recorded like any other call; only the decision call streams its thinking to the dashboard.

## The skill library persists across rooms

`server/lib/library.js` keeps one git repository at `.runtime/wolf/learning/library/` (server `/etc/wolf/learning/library`). It holds `sts2/` — one skill per game, shared by every player kind — with the skill documents plus a `learned/` tree of durable notes. An older `sts2-astra/` tree is renamed in place with `git mv` the first time a room asks for `sts2`, so the notes and the history that produced them survive the consolidation. A room no longer starts from the image template alone — it is checked out from the library, and its knowledge edits are committed back. Only `scratchpad/` is excluded, because that is single-run state and is archived with the room.

- The image template only **seeds**. A rebuilt server adds new template files but never overwrites a file the player has since written.
- `{"type":"learn","path":"bestiary/wriggler.md","content":"…","message":"…"}` writes a note under `learned/` and commits it with the player's own message and name. `{"type":"recall"}` reads one back or lists them; `learned_notes` names every note that exists.
- `learned/` is seeded with separate areas so subjects do not blur: `strategy/` (play that holds across runs), `controls/` (what a button actually did), `bestiary/` (HP, intents, cycles), `events/` (event rooms and outcomes) and `setups/<character>-a<ascension>/`, for example `setups/ironclad-a1/`. Each carries its own README. The list is a starting point: the player adds folders for subjects that fit none of them.
- **A note must survive the seed.** Every run generates a different map, different offers, different event rolls and different fights, so a note that only records what this run met is dead on arrival in the next room. The first supervised run produced fifteen `events/act1-floor<N>-…-a1.md` entries proving the point. The contract now: `noteProblem()` refuses a path naming a floor, round, turn or decision and requires front matter; `indexNotes()` refuses to retrieve such a note even when an older library still contains one; and the seeded areas state the test — *would a player starting a fresh seed tomorrow be better off for reading this?*
- The areas carry the distinction. `controls/` is the closest thing to a hard skill and is worth writing precisely, but must not bake in a layout: the seed changes how many items a reward screen holds, how many nodes a map row offers and how many options an event shows, so a controls note states the rule and says to read the count from live state. `bestiary/` holds an intent **graph** — which intents exist, which follows which, under what condition — not a round-by-round transcript. `pools/` records what an act can draw from, which is what lets a run plan before it can see the map. `problems/` records the recurring problems and what solves them, separating those settled inside a combat from those settled by choosing a route, a card or a risk. `events/` judges an event as a class.
- **Reconnaissance before commitment.** The choices that shape a run are made before their consequences are visible. The prompt asks for a bounded look first — the map graph already in hand, `pools/` and `problems/`, a `research` fetch when those are thin — and then a choice made in terms of the problems ahead. The question at Neow is which bundle answers what the act demands of the deck; not what a transform will produce, which is random, need not be fed a Strike, and rolls differently next run.
- **Notes are retrieved, not remembered.** Every note starts with front matter — `description` in one line, `keys` naming the enemy, event, relic, screen or character-ascension it is about. `client/astra/retrieval.mjs` indexes that and puts the matching notes, with their bodies, into `retrieved_notes` for the current screen. Ranking is by specificity: the enemy or event in front of the player (weight 4) beats this run's character and ascension (2), which beats the screen name and cards in hand (1); an exact `keys` hit counts triple a path hit and six times a description hit. At most five notes and 6,000 characters, dropped first if the context budget is tight. This replaces waiting for the planner to remember to spend a decision on `recall`, which is why notes written in one room were rarely read in the next.
- The gateway op `skill-commit {message}` performs the commit. A room that edits files without committing is committed anyway once the edits have been still for 45 seconds, and again when the room is archived, so nothing is lost when the home is deleted.
- Reviewed `accepted.json` promotion is unchanged: notes are retrievable reference data, not lessons that silently enter every context.

Operator routes: `GET /api/library` (commits, newest first), `GET /api/library/commits/:hash` (bounded unified diff), `GET /api/library/files?skill=…[&path=…]`. The dashboard renders these in the room page's **Learning** section, which is its own item in the page's four-part stack (video, conversation, learning, debug) rather than a tab beside the conversation.

## Web references

`{"type":"research","url":"https://slaythespire2.net/…"}` fetches one page through the gateway op `web-get`, converts it to text and returns a bounded excerpt with its provenance. **Only `slaythespire2.net` is reachable, and every request is pinned to `?v=beta`**, the profile matching the installed **v0.111.0** build; a different `v=` is refused rather than silently describing another game. https only, 15-second timeout, 12,000 characters, six-hour cache. Players still have no general internet access — the server makes the request. The site can lag the build, so live mod state always wins and anything worth keeping must be written with `learn`.

## Memory without contamination

Each room owns `/workspace/skills/sts2/scratchpad/`; it is archived at completion/removal.

| File | Purpose |
|---|---|
| `facts.json` | Latest authoritative observation, overwritten |
| `run.md` | Compact strategy hypothesis and last outcome |
| `learning.jsonl` | Required pre-action hypotheses and separate observed outcomes, every decision |
| `events.jsonl` | Full decision observations, attempted inputs, verified actions, errors, usage and context sizes |
| `metrics.json` | Model/config identity, tokens, latency, input attempts, verified plays, failures and progress |
| `checkpoint.json` | Atomic same-run task, strategy, counters, latest state and pending issue for player reload |
| `incidents/<id>/` | Incident JSON, available before/after JPEGs, plan, build identity, bounded recent input/sensor rings and event-log offset |
| `attention.json` | Current pending/resolved issue pointer |
| `incident-resolutions.jsonl` | Explicit supervisor reviews, separate from immutable incident evidence |
| `observed-catalog.json` | Bounded contextual card/enemy/event variants, not an exhaustive wiki |
| `candidates.jsonl` | Evidence-linked reusable hypotheses, never automatically accepted |
| `accepted.json` | Reviewed lesson seed, frozen when the room is created |

Facts outrank memory. A combat-buffed card description must not become its universal base value. Observations are reference data, not instructions. Accepted lessons require matching **game, mod and policy fingerprints**, review/evidence and an eight-lesson budget. Player policy changes intentionally invalidate old accepted seeds. Catalog entries retain their own build provenance after reload; raw notes stay outside future decision context.

```sh
node host/astra-memory.mjs report BASELINE_SCRATCHPAD CANDIDATE_SCRATCHPAD
node host/astra-memory.mjs review SCRATCHPAD CANDIDATE_ID \
  .runtime/wolf/astra-memory/accepted.json \
  --review 'Evidence supporting this scoped hypothesis' \
  --evaluation 'Held-out run references, baseline and observed tradeoff' \
  --text 'A concise qualified lesson, at most 500 characters'
```

Promotion requires matching successful execution evidence; the utility does not independently verify the human's evaluation claims. Existing rooms keep their frozen seed. For comparison, fix model/max effort, code, game/mod, character, ascension and seed set. Change only accepted memory; include an empty-memory baseline and held-out seeds. Compare stalls, repeated errors, tokens/time per floor, verified plays per decision and progress/outcomes. One smoke run proves neither strategic improvement nor whole-run reliability.

## Validation boundaries

`npm run test:learning` covers the skill library (seed, inherit, commit-back, run-state exclusion, path escapes, learn/recall/research and the web allowlist), deterministic eight-action plans, navigation sensor counts, draw/random/generated-card barriers, target death/renumbering, selection prompts, combat completion, transport failures, ignored segments, no remaining input after failure, first-error incidents, checkpoint restore and backend configuration/restore gates. These use fake game/Pi transports. `node host/learning-decision-probe.mjs ROOM_ID` runs an isolated actual-Pi screenshot request from a paused room without a gameplay gateway and audits model, max effort, routing and unchanged pad count. See [ASTRA_HANDOFF.md](ASTRA_HANDOFF.md) for actual probe and rollout results.

Pi 0.85.0's unbundled SDK fails on missing `@earendil-works/pi-server`; keep bundled `pi --mode rpc`. The shared model identity is `server/lib/learning-profile.mjs`; player implementation remains under `client/astra/`. Existing operator routes and reviewed-memory compatibility checks remain.
