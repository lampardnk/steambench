# Persistent skill library and the rebuilt dashboard — 2026-09-07

The backend was recreated with the user's approval after room `c448aff3` was marked **user-aborted** (not a loss) and archived to `.runtime/history/2026-09-07T07-36-50-524Z-c448aff3`: 12 scratchpad files, 167 transcript items, both incidents preserved. Current room: **`fe5bc1bb`**, Ironclad A1, running on the new code. `npm run test:learning` covers 29 batching cases plus the integration, backend and library fixtures.

## Skills now outlive rooms

`server/lib/library.js` keeps one git repository at `.runtime/wolf/learning/library/`. A room is checked out of it instead of copying the image template, and its knowledge edits are committed back while playing and again during `archive()`; only `scratchpad/` is excluded, because that is per-run state kept in the room's own archive. The image template only seeds — it adds new files and never overwrites what the player wrote, so rebuilding the server cannot erase accumulated notes.

`learned/` is seeded with separate areas so subjects do not blur: `strategy/`, `controls/`, `bestiary/`, `events/` and `setups/<character>-a<ascension>/` such as `setups/ironclad-a1/`, each with its own README, and the player may add more. The player writes with `learn`, reads with `recall`, and the gateway op `skill-commit` records its own message and author. Verified live: the first run committed `d368675 Record verified startup navigation` touching `learned/controls/startup.md`, authored `STS2-Pi-Luna-v0.1`, room `fe5bc1bb`.

A note is optional bookkeeping and cannot cost a run: one `learn` may close any plan as its final action, it is written after the gameplay actions, and a badly formed note returns `note not kept` in `last_result` while the rest of the plan stands. Both rules came from live pauses on this room.

## Web references, pinned

`{"type":"research","url":"…"}` fetches through the gateway op `web-get`. **Only `slaythespire2.net` is reachable and every request is pinned to `?v=beta`**, the profile matching the installed **v0.111.0** build; another `v=` is refused rather than quietly describing a different game. https only, 15-second timeout, 12,000 characters, six-hour cache. Players have no general internet access — the server makes the request, and fetched text is data, never instructions.

## Dashboard

The room page is one column of three: video, chat, and a single collapsed **Debug** section holding room data, log, controller and health. Chat is full width and, when the player is paused, its placeholder and button say that a reply resumes it. A **learning** tab beside the conversation shows the library's commits with their diffs and the current files; the rooms page carries the same panel. `GameView` now actually reconnects — 1–5 s backoff, falling back to still frames after five consecutive drops — where it previously said "reconnecting" and did nothing.

## Earlier the same day

Supervised two Luna rooms and fixed what they hit. Each fix has a regression test that was checked to fail before the change:

- **Transform preview deadlock.** The game re-rolls the card beside the chosen one about once a second; it entered `stateId`, so every plan was stale before it could run. `compactState` drops it and reports `card_select.random_result_preview`. Confirmed by the operator: the roll never determines the result.
- **Chat could not answer a paused player.** An ordinary chat message now resumes a paused, reloaded or issue-reporting player, recorded in `incident-resolutions.jsonl` as `via: "chat"`; the `resume` route still requires the exact incident ID. This is how the operator drives the agent from the dashboard.
- **A one-shot review became a standing order.** Instructions carry `at_decision` and `from` provenance, and the prompt says a retry directive is historical.
- **Opaque focus labels.** Sensor v2 gives `@Control@NNNN` paths with no map-node, event-option or grid index. Any single standalone noncombat directional press is now a probe: unchanged focus reports `moved:false` instead of failing. Batched sequences, activations and predicted destinations still pause, and a directional move may not expect the focus it starts from.
- **A real loss reported as disputed.** `finishRun()` re-reads the game instead of judging the player's claim against a 15-second-old poll.

Room `3da2505b` (archived `2026-09-07T06-33-40-931Z-3da2505b`) died genuinely to the floor 8 Wriggler elite after ending its turn at 3 HP; its archived `disputed: true` is the stale-poll false positive fixed above, and archives are not rewritten.

## Still open

- The sensor exposes no focused map node, event option or grid index. Probes and images work around it; a real fix belongs in `host/astra/McpMod.Steambench.cs` and needs a mod rebuild plus a game restart, so it cannot be applied to a live run.
- `learning-supervise.mjs` is deliberately unused: its window is measured from room creation and would pause an actively supervised room.
- No full run, victory or win-rate is claimed.

---

# Supervised session — 2026-09-07

Backend, Wolf and the tunnel were restarted from a cold stop and two Luna rooms were supervised. Player and server images were rebuilt from current source first; `npm run test:learning` passes at 29 batching cases plus the integration and backend fixtures. Every fix below was checked to fail its regression test before the change and pass after it.

Current room: **`c448aff3`**, `STS2-Pi-Luna-v0.1`, Ironclad A1. At the latest read it was act 1 / floor 4, 67/80 HP, 117 gold, **50 decisions, 108 inputs, 25 verified card plays, zero execution failures and zero incidents**, 1.14 completed actions per batch, 50 model requests averaging 12.2 s. That is a live snapshot, not a finished run: no full run, victory or reliability claim.

Tunnel URL changes on restart; read it from `docker logs steambench-tunnel`. `.runtime/wolf/learning/current-room.json` points at the live room.

## What was wrong and what changed

- **Transform preview deadlock.** On "Choose a card to Transform" the game re-rolls the card drawn beside the chosen one about once a second. It entered `stateId`, so every plan was stale before it could run and the third rebuild paused the room; zero inputs were ever sent. The operator confirmed the roll is animation and never determines the result. `compactState` now drops it and reports `card_select.random_result_preview`, keeping only the chosen card, and the prompt says Y confirms while B returns to the grid. Masking also removes a false positive: a no-op press on that screen used to look like progress.
- **Ordinary chat could not answer a paused player.** The operator's own chat reply was rejected with "use the explicit player/resume endpoint". Chat now resumes a paused, reloaded or issue-reporting player: `acknowledge()` is shared by both routes, writes `incident-resolutions.jsonl` with `via: "chat"` and `acknowledgedIssueId: null`, marks `attention.json` resolved and leaves the incident evidence untouched. The explicit route still requires the exact incident ID. The player's `report_issue` text already appears in the room chat, so a UI question now round-trips without the CLI.
- **A one-shot review became a standing order.** After the transform was confirmed, the player re-applied the same resume instruction and pressed Y twice more on the map, which only moved focus to the legend. Instructions now carry `at_decision` and `from` provenance (older string checkpoints are normalised on load) and the prompt states that a retry directive is historical: carry it out once, then verify against fresh state.
- **A directional move that predicts its own origin.** A two-step event plan set `expect.focus_path` equal to `from.focus_path`, spent two presses and could never verify. `validatePlan` now rejects that before any input.
- **Opaque focus labels, three separate pauses.** Sensor v2 gives `@Control@1386`-style paths with no map node, event option or grid index, so the player guessed. Added `{"type":"input","buttons":["left"],"probe":true}`: one standalone reversible noncombat press that reports `moved:false` instead of failing, which proves focus was already at that edge. The prompt also records that reachable map options share one row so left/right move between them while up/down do not, and that the focused grid item is the raised, enlarged one with a tooltip, not the leftmost.
- **A real loss reported as disputed.** `finishRun()` compared the player's claim against the 15-second poll. The player's own read after ending its turn returned `game_over`, but the 4-second-old snapshot still showed the elite, so a genuine death was flagged `disputed`. It now re-reads `/api/v1/singleplayer` before deciding and falls back to the last poll only if the mod is unreachable. This is a server change, applied by recreating the backend with zero rooms present.

## Room `3da2505b` — lost at the floor 8 elite

Archived to `.runtime/history/2026-09-07T06-33-40-931Z-3da2505b`. It reached act 1 / floor 8 with 114 decisions and 255 pad inputs, cleared three ordinary combats, a Wood Carvings transform and a rest site, then died to the Wriggler elite after ending its turn at 3 HP. The transcript records the executor's own `game_over` observation, so the loss is genuine and the archived `disputed: true` is the stale-poll false positive fixed above; archives are not rewritten. Four incidents were raised, each preserved and explicitly reviewed: the transform deadlock, the repeated map Y, the event `expect` mistake and the grid focus ambiguity.

## Still open

- The sensor exposes no focused map node, event option or grid index. `probe` works around it at one model decision per probe; a real fix belongs in `host/astra/McpMod.Steambench.cs` and needs a mod rebuild plus a game restart, so it cannot be applied to a live run.
- `learning-supervise.mjs` was deliberately not used: its window is measured from room creation and would pause an actively supervised room.
- Source remains uncommitted. The dashboard was not built or deployed. No full run, victory or win-rate is claimed.

---

# Clean shutdown — 2026-09-06T15:15:16.413Z

The user requested stopping everything before powering off the PC. All players were paused, current evidence copied and verified, and room `a0c1d4ec` marked **user-aborted** and removed. Final observed run: Ironclad A1, act 1/floor 4, 72/80 HP, 129 gold. This was an operator shutdown, not an in-game loss.

Archive: `.runtime/history/2026-09-06T14-51-32-462Z-a0c1d4ec`. It includes the normal room archive and a separate verified `shutdown-snapshot/` (29 files, including 24 scratchpad files; 149 transcript items and 96 pad entries). All 21 earlier archive directories remain. Latest notes, incidents and checkpoints are preserved.

**No live rooms or running steambench containers remain.** Backend, tunnel and Wolf were stopped and verified stopped. The earlier unattended-continuation authorization has been superseded by this shutdown request. Do not resume inference, recreate services or create another game until the user asks. No personal Steam/game files or unrelated host services were changed.

Private shutdown report: `.runtime/wolf/learning/shutdown.json`.

---

# Latest operator instruction — unattended continuation (2026-09-06 15:10 UTC)

The user authorized room `a0c1d4ec` to keep playing without an active coding supervisor and record potential issues for later review. Resumed successfully: agent `running`, no pending attention, continuing the same Luna/max Ironclad A1 run from floor 3. The earlier three-combat/15-minute supervised window is complete and **must not be reapplied to this continuation**. No supervision watcher is running. Do not start `learning-supervise.mjs` on this room: its expired creation-based deadline would pause it again.

The resume instruction tells Luna to record nonblocking concerns in evidence-linked notes/candidate lessons and keep playing. Existing execution/provider-error pauses remain; there is no unattended retry/repair loop or service waking Codex. Logs, metrics, notes and incidents stay in the room scratchpad and will be archived by normal completion/removal. No server, game or player-container restart was needed. The historical paused checkpoint below was superseded by this explicit user resume.

---

# Luna rollout — 2026-09-06

Current source and backend use `STS2-Pi-Luna-v0.1`, OpenRouter `openai/gpt-5.6-luna`, **max reasoning**, image `sts2-pi-luna:0.1` / `Dockerfile.luna`. No provider allowlist, exclusions or ordering. The existing protected learning key is unchanged. Internal `astra` names/checkpoint schema remain compatibility identifiers. This supersedes the historical checkpoints below.

- Actual isolated Pi screenshot decision against paused room `96c159dc` passed: one request, exact Luna/max, provider OpenAI, valid game-context plan, **19.300 seconds**, 7,503 total reported tokens including 1,860 reasoning tokens. Zero inputs; pad count stayed 9 and the original incident remained. Private evidence: `.runtime/wolf/learning/luna-probe-kTn38a/`. Pi zero cost fields are not billing evidence.
- Implemented eight semantic actions per plan, hand-navigation segments checked at their boundary, 1–12 UI directional presses per sequence, exact preconditions between UI actions, known startup transition checks, draw/random/generated/selection/target-death/scene barriers, and cancellation of all remaining input after an actual error. Navigation and a verified activation can share one model decision. Screenshots are fetched only for missing UI information and incident evidence. Notes remain per-batch hypotheses with per-action observed outcomes; reviewed-memory compatibility remains.
- `npm run test:learning` passed: 26 batching cases plus fake-Pi first-error/empty-output/transport/sensor/stale-image/checkpoint scenarios and backend restore/configuration gates. Fixture: 3 cards + end turn used one plan, 15 inputs, 11 sensor calls; 12 UI navigation presses + verified activation used 3 reads total. Dashboard build, syntax and whitespace checks and both image builds passed.
- Before removal, `96c159dc` was copied to `.runtime/history/2026-09-06T13-20-22-409Z-96c159dc/` and verified: 23 scratchpad files, 51 transcript items, 9 pad entries, incident, game log and last frame. `pre-removal-verification.json` holds checksums. Then it was marked user-aborted and deleted. All 20 earlier archive directories remain.
- Backend recreated at about **14:51 UTC** with zero rooms. `/api/meta` reports exact Luna/max and eight observer slots. Wolf and tunnel container IDs are unchanged; personal Steam/STS2 mounts remain read-only. No host game/mod/service changes.
- Fresh room **`a0c1d4ec`** created at about **14:51 UTC** for Ironclad A1. The original 15-minute supervision window ended at **15:06:33 UTC** with a confirmed operator pause. One combat completed; the second is in progress at floor 3, **66/80 HP**, 109 gold. Agent is idle, attention is null, fresh-run checkpoint is preserved, and there is no automatic resume. Do not restart the server/game or abandon this run to resume it.

Verified supervision results:

- Fresh startup was verified in the mod and checkpoint: Ironclad, A1, floor 1, 80 HP. The installed mod provides a full 66-node map plus reachable options and boss Waterfall Giant. `map.current_position` comes from visited coordinates; it is not UI focus. The installed v2 sensor exposes a generic focused node path but no focused-node coordinates. Current map observation was saved privately as `.runtime/wolf/learning/map-a0c1d4ec.json`. No sensor/game restart or mod action endpoint was used.
- Incident `1788706365581-2`: initial menu options appeared during planning; zero inputs were sent. Luna misread the stale replan as a failure. Player now exposes a separate no-input `replan` result and marks supervisor-reviewed historical errors. Tested, rebuilt and player-only reloaded/resumed.
- Incident `1788706539098-11`: one Down press at the first map did not change focus. Reviewed mod data plus the image showed the left travelable Monster was already highlighted; run position at Neow had been mistaken for focus. Prompt now distinguishes these. Explicit reviewed resume activated that observed node and reached floor 2; no repeated Down or blind recovery.
- First combat decision 14 successfully executed Dark Shackles, Bash, Strike and end turn from one model call (13.715 s model, 5.902 s executor, 8 inputs). Decision 15 stopped after a target died instead of running the remaining plan.
- Incident `1788706771848-16`: Strike completed, then correct hand navigation observed the played card's delayed discard-count update. Full incident diff showed only discard publication plus expected focus changes. Executor now waits for ordinary Attack/Skill discard/exhaust destination publication before proceeding; it still rejects HP/hand/target changes during navigation. Delayed/missing publication regression cases pass. Reloaded only the player and resumed the same game after explicit review.
- Map activation also now waits for the destination scene, because the earlier implementation accepted an intermediate map change and wasted a 37.579 s model decision that the stale guard discarded. Both transition-success and timeout/no-repeat fixtures pass.
- Incident `1788707002466-22`: reward focus reached the bottom/card reward after two successful Down presses, then another Down had no destination. The runtime had incorrectly omitted the image merely because a generic reward focus path existed. Restored images for ambiguous noncombat screens, while ordinary combat remains state-only; regression check passes. Reviewed screenshot showed the card reward already highlighted. Player-only reload and explicit resume opened/resolved that reward without another Down.
- Supervision deadline is tied to the original room creation (**15:06:32 UTC**), so the reloads and reviews do not restart the 15-minute allowance.

Final measurements, over this single supervised run (including startup, incidents and reviewed reloads):

| Measure | Observed |
|---|---:|
| Model requests | 30 |
| Median model response | 10.805 s |
| Median successful model + execution decision | 11.066 s |
| Combat model decisions | 7 |
| Combat median model response | 15.032 s |
| Completed combat actions / model decision | 2.0 |
| Verified card plays | 11 |
| Attempted button inputs | 54 |
| Total sensor reads | 171 |
| Screenshot fetches / images sent to model | 21 / 16 |
| Combat images sent to model | 0 |
| Reported total tokens | 137,614 |
| Reported output / reasoning tokens | 31,232 / 25,781 |

The overall median was below the 15-second target; the small combat sample was slightly above it. Whole-run throughput and three completed combats remain unverified: the fixed time cap stopped supervision during combat two. Across all UI and combat batches, 30 completed actions / 29 batches = 1.03; the overall batching benefit is limited by UI focus ambiguity and semantic boundaries. Four incidents were preserved and explicitly reviewed; three were executor failures and one was Luna's no-input help request. This is not an error-free or full-run reliability result. The final transition and pile-publication fixes were exercised live before pausing.

Private final report: `.runtime/wolf/learning/luna-final-validation.json`; supervision report: `.runtime/wolf/learning/supervision-a0c1d4ec-1788707066625.json`. Old-room `post-removal-verification.json` confirms all 26 non-frame evidence files matched their pre-removal hashes; the backend captured a newer final JPEG during removal. No historical archives were removed.

To continue later, inspect current status first and explicitly resume the operator-paused player with a reviewed message. There is no pending incident ID to acknowledge at this checkpoint. The `learning-supervise.mjs` allowance is tied to original room creation and has expired; its rerun does not grant another gameplay window. No full three-combat validation or victory is claimed.

Source remains uncommitted. Dashboard source built locally; current player labels are also served dynamically by the deployed backend metadata. No full run or victory is claimed.

---

# Astra v0.1 handoff — 2026-09-06

## Current checkpoint — restricted providers and faster UI executor

- Latest user request: inference providers **Baseten, Makora or Modal only**. `models.json` uses `provider.only: ["baseten", "makora", "modal"]`, priority `order: ["baseten", "modal", "makora"]`, required-parameter routing and exact GLM 5.3 Flash/max. No fallback outside the list. The old StreamLake-only pin overloaded and is superseded.
- Actual isolated Pi/image smoke passed via **BaseTen**, 4.3 seconds, 47 reasoning tokens; audited outgoing model/max/allowlist and returned provider. This is request compatibility evidence, not full-game latency. An earlier temporary unrestricted smoke reached DeepInfra; unrestricted routing was never resumed in the room and is not current policy.
- Built `Dockerfile.glm` and reloaded only player **`96c159dc`**. Verified exact scene hash `26c8bea9945351ec`, pending incident `1788701759306-13`, 13 decisions, 9 inputs, task hash, fresh-run verification and game/mod build identities remained unchanged. Explicitly reviewed/resumed the overload with the new routing/UI instructions. It resumed from floor 1 map, 80/80 HP and 99 gold, not a new run. Recheck status before acting.
- New UI policy: short low-risk hypotheses, act then inspect; up to four checked noncombat d-pad moves, separate activation, stop on semantic scene/gameplay changes. `scout` supplies bounded map joystick scrolling with explicit visual verification when JSON is unchanged. `lookup` reads card/relic STS2MCP wiki. Matching beta-site encounter snippets are bundled with provenance/version uncertainty; not a complete library. Ordinary combat and identified menu controls omit model images; repeated map navigation omits unchanged full graphs. Full observations and screenshots still preserve incident evidence.
- Offline UI bounds/batching/barrier/lookup/scout/reference/context fixtures passed, as did the earlier first-error/transport/stale-plan/checkpoint/resume suite, syntax checks and whitespace checks. Live joystick response and full-run performance are not yet verified. The pre-change baseline was about 6.4 minutes and 14.5k reasoning tokens for three right-focus moves.
- Server/Wolf/tunnel unchanged: start times 13:20:22 / 11:17:10 / 11:16:56 UTC. The source skill-template docs changed but are not automatically copied into existing room skills; active behavior comes from the reloaded player image's prompt/executor/reference files. No backend/sensor restart or dashboard deployment was performed.
- The first live request after reload paused at **`1788702728055-14`**, HTTP429 `upstream_provider_shared_pool`: `previous_errors` names Makora and Modal, final provider BaseTen. Zero model tokens/game inputs. After more than 90 seconds, the supervisor explicitly reviewed/resumed one cooldown retry. Recheck the current attention pointer; smoke success does not prove pool availability for subsequent requests.
- That cooldown retry hit **`1788703017690-15`**: the 180-second planner deadline, with zero assistant messages, text chunks or thinking characters received and zero attempted inputs. This does not prove the model spent the time reasoning; no provider stream arrived at Pi. The scene remains floor 1 map, 80/80 HP, 99 gold, total 9 inputs. Baseten-first ordering was then added for a no-game-input, actual-context provider diagnostic. Do not resolve this incident merely because the small smoke passed.

## Historical checkpoint — GLM-labelled room recreated with approval

- On 2026-09-06 at about 13:20 UTC, the user explicitly approved recreation. Pre-run room `ff985898` was cancelled, marked user-aborted (not lost), archived to `.runtime/history/2026-09-06T13-03-08-131Z-ff985898/`, and deleted. Both incident directories (`1788699873152-2`, `1788700087235-4`) were verified in the archive before deployment.
- Replacement room: **`96c159dc`**, `https://steambench.dev/r/96c159dc`, requested Ironclad A1. Room/player display name is `STS2-Pi-GLM-5.3-Flash-v0.1`; actual configured image is `sts2-pi-glm-5.3-flash:0.1`. Setup/startup logs now identify GLM rather than the internal `astra` compatibility kind. Check current status before sending input.
- At this historical checkpoint the player used exact `z-ai/glm-5.3-flash`, max reasoning, through **`streamlake` only**, after two isolated Pi/image probes passed. That route later overloaded and was replaced by the allowlist described in the current checkpoint. Cost metadata is not exact billing across current routes.
- Backend was recreated only after zero rooms/players were verified. The Docker name-release wait in `PiAgent.stop()` is now deployed. Wolf/tunnel were not restarted: their start times remained 11:17:10 and 11:16:56 UTC respectively, with unchanged restart counts.
- Image/server builds and syntax/whitespace checks passed. No complete GLM run or victory is claimed. Incident pause, evidence preservation and explicit supervisor resume remain enabled. Dashboard labels update from backend data; the new frontend pause banner remains unpushed/undeployed.
- The key remains in protected `.runtime/wolf/learning/openrouter.key`; do not print it. `.runtime/wolf/learning/current-room.json` points to the replacement room. Older checkpoints below are historical, not instructions to recreate another room.

## Historical checkpoint — first GLM deployment and supervised diagnostics

**This section supersedes the preparation and Astra-only notes below.** Recheck the current room before acting.

- User approved the migration. Old Astra room `3e143de5` was cancelled, marked user-aborted (not lost), archived to `.runtime/history/2026-09-06T12-08-57-530Z-3e143de5/`, and deleted. Zero rooms/players were verified before server recreation.
- Supervisor backend deployed at 13:03 UTC on 2026-09-06. Startup initially exposed a missing `node:fs` import for file-backed key loading; fixed before room creation. Wolf/tunnel start times and restart counts stayed unchanged.
- New room: `ff985898`, `STS2-Pi-Learn-v0.1`, requested Ironclad A1. It reached the main menu with GLM/max and sent one verified A to establish Singleplayer focus. A run has not yet reached floor 1 at this checkpoint.
- Provider issues pause immediately. Incident `1788699873152-2` captured an empty/zero-usage reply before any input; after review/reload the next valid decision established focus. Incident `1788700087235-4` captured another empty reply and is currently pending. No further game actions were sent while diagnosing it.
- New player diagnostics record bounded output/assistant metadata and provider response ID; final assistant text is used if streamed text deltas are missing. Missing content still pauses, never automatically retries. Direct provider-stream probes run outside the game and store restricted raw responses under `.runtime/wolf/learning/provider-diagnostics/`; these are not player actions or accepted lessons.
- **Live player-only reload verified:** scene fingerprint, game container/lobby/session, pad count, checkpoint task/decision/usage/issue, original incident and transcript were preserved; the replacement waited for explicit resume. First attempt hit Docker `--rm`/`rm -f` name-release race; after verifying removal, one retry succeeded without restarting the game or backend.
- Source now waits for exact player-container disappearance (15-second bound), with a passing simulated removal-race check. That server fix is built for the next maintenance window but **not deployed to this active room**. Current backend may need the same inspect-disappearance-then-retry procedure; never recreate it to fix a live player.
- The CLI supervisor is monitoring during this coding session. Unattended incidents remain paused; no service wakes Codex automatically. No full run or victory is claimed. Dashboard source is built but not pushed/deployed.
- Subsequent user request: remove stale Astra image/log branding. Source now uses `STS2-Pi-GLM-5.3-Flash-v0.1`, image `sts2-pi-glm-5.3-flash:0.1` and `Dockerfile.glm`; setup/startup logs identify the display name, image and exact model. Internal `astra` API/storage aliases and `STS2-Pi-Learn-v0.1` checkpoint identity intentionally remain compatible. Existing room labels are still the deployed backend's old values; permission to archive this pre-run room/recreate the backend was requested, not yet granted. Do not restart it to apply cosmetic changes without that approval.
- Two consecutive isolated Pi/image probes pinned to OpenRouter endpoint `streamlake` returned valid GLM/max plans (about 44 and 57 seconds), after an earlier unpinned successful stream also used StreamLake. No game inputs were sent by the probes. Pinning is a candidate mitigation for recurring empty routed replies, not proven whole-run reliability; it has not yet been applied to the live room.

## Preparation checkpoint — GLM built before deployment approval

**Historical preparation status.** Current design and commands: [ASTRA.md](ASTRA.md).

- User requested OpenRouter `z-ai/glm-5.3-flash`, **max reasoning**, learning-first notes and first-error supervisor escalation. Source implements `STS2-Pi-Learn-v0.1`; legacy `astra` directories/setup kind/image remain. Original Nemotron/key is unchanged.
- Supplied key is saved only in protected, gitignored `.runtime/wolf/learning/openrouter.key`. Never print it. Backend reads the mounted file or `STEAMBENCH_LEARNING_OPENROUTER_API_KEY`; no Experiential Labs credentials are needed by new source.
- Existing room `3e143de5` is still the **old Astra process**, idle/paused at Neow/floor 1, Ironclad A1, 80/80 HP, 11 pad inputs at the latest read-only check. Game/server/Wolf/tunnel were not restarted or modified during GLM preparation. Recheck rather than treating these values as permanent state.
- **Pending user decision:** approval to archive/replace this paused room to deploy the supervisor backend and start a GLM learning run has not been granted. Do not recreate the backend with the room present. The old process lacks a compatible learning checkpoint; the new reload route is for subsequent learning rooms.
- Direct OpenRouter smoke passed. Actual Pi/image audit exposed 404 strict-parameter routing; fixed `compat.supportsStore: false` and `maxTokensField: "max_tokens"`, retaining required-parameter routing/max effort. Actual streamed Pi/image request then passed with exact model/max and reasoning usage. That audit took about 17.8 seconds, not a gameplay performance measurement.
- Offline fake-gateway/Pi checks passed: zero-input report_issue; exactly one ignored/failed raw input before pause; provider error, bad sensor and stale image pause with evidence/no input; only two no-input stale-plan rebuilds; failed hand focus sends one direction; wrong issue ID/chat cannot resume; checkpoint restores task/counters/attention; explicit acknowledgement writes separate resolutions. Temporary fixture: `/tmp/learning-integration.mjs`.
- Backend reload stub checks passed: checkpoint/idle/concurrency gates; preservation of game/lobby/observer/home/state/pad history/transcript; no kickoff/cache refresh; restored-checkpoint handshake and explicit acknowledgement. **Not yet a live reload test.** Temporary fixture: `/tmp/learning-backend.mjs`.
- Every decision requires a note written as a pre-action hypothesis, with observed outcome recorded separately. Incidents capture available before/after JPEGs, states, plan, input attempts/sensors and build identity. `host/learning-player.mjs watch/inspect/reload/resume` and dashboard banner expose the operator loop.
- Watcher does not independently wake Codex. During an active coding session inspect/fix/reload/acknowledge; otherwise the player stays paused. No unattended autonomous repair is configured.
- Final player and server image builds, dashboard build, syntax and whitespace checks passed. Final player `--smoke` passed with GLM/max. A network-isolated actual-Pi HTTP 429 fixture confirmed exactly one provider request before failure, with no hidden retry. The new gateway also rejects further player inputs/room-finish while attention is pending; neutral releases and read-only evidence remain allowed.
- These images are **built, not deployed**. No live GLM gameplay, new-backend live reload, full three-act run or automatic victory completion has been verified. Source is uncommitted; dashboard not deployed; unrelated `research/` untouched.

Next approved runtime sequence: cancel old player → archive user-aborted room → verify zero rooms → apply **server only**, leaving Wolf/tunnel running → create learning room (`player.kind: "astra"`) → watch first issue → inspect/fix → rebuild/reload only player → verify preserved game → explicit resume with incident ID/review.

## Historical checkpoint — Astra provider quota reached

**Historical Astra-only behavior, not the current GLM supervision contract.** Normal-chat resume and old provider quota apply only to the old process.

- Current room at the 12:11 UTC check: `3e143de5`, server stage `playing`, player **idle/paused**, fresh Ironclad A1 at Neow, floor 1, 80/80 HP. Its game is preserved. Do not delete it or restart the server to resume inference.
- Blocker: Experiential Labs HTTP 429 `free_limit_reached`, **100,000 input tokens/hour** for this organization's free tier. The provider says reset is at the next hour: **2026-09-06 13:00 UTC / 21:00 Singapore**. No credit overflow/billing change was made. No automatic retry is running. After quota is available, send a normal chat message to resume; the parent retains task/startup/strategy state.
- The immediately preceding controller smoke room `ed35389d` was deliberately aborted and archived to `.runtime/history/2026-09-06T12-04-49-662Z-ed35389d/` before starting the final player image. It reached floor 3 with **18 verified card plays, zero executor failures**, 72 inputs and a **4.16-second median model response**. This is not a win-rate or whole-run result.
- Resolved and live-tested: self-target selection/confirmation; multi-enemy target navigation; deterministic multi-card batches. Resolved and offline-tested: draw/return-to-hand barriers, enemy death/ID-renumbering guard, compact deck/discard context and memory evidence/compatibility checks. Sensor v2 and player images built successfully.
- Actual outgoing Pi request audit confirmed exact model `gpt-6-astra`, `reasoning.effort: medium`, `store: false`; no model/effort substitution. API smoke and syntax/whitespace checks passed.
- Added observed card/enemy/event variant catalog, authoritative permanent deck, game/mod/policy fingerprints, reviewed frozen memory and `host/astra-memory.mjs report/review`. No lessons have been accepted automatically.
- Game-over win evidence now follows the game's history/victory-room fields; an actual full win and automatic completion remain untested. Ally-target cards, potions and special screens still use bounded screenshot navigation. The catalog is not an exhaustive wiki.
- Gameplay executor and sensor match the current room. A final metadata-only correction recognizes `event_id`/`event_name` in the observed catalog and is included in the rebuilt image for future rooms; the paused room retains the earlier catalog implementation and policy hash. Do not disrupt its game just to replace this metadata code. Source remains uncommitted; dashboard selector is built but not pushed/deployed. Unrelated `research/` files appeared during work and were left untouched.
- ILSpy `9.1.0.7988` worked with `.NET 9` plus `DOTNET_ROLL_FORWARD=Major`, in a disposable container with the game mounted read-only. Diagnostic decompilation is under `.runtime/astra-inspect/`; do not commit it. Inspection/audit containers have exited.

## Historical checkpoint before resuming

## Stopped safely

Work paused at the user's request. Room `b46dde22` was marked **aborted**, archived, and deleted after cancelling the player. No win/loss claimed. Backend reports zero rooms; no room/player containers remain. Server, Wolf, and tunnel were left running. No further model calls or gameplay should be started without the user resuming work.

Archive: `.runtime/history/2026-09-06T08-23-12-048Z-b46dde22/`. Includes transcript, pad history, scratchpad evidence/metrics, game log and last frame. Last server observation: Ironclad A1, act 1, floor 3, 78/80 HP. This is an aborted smoke run, not a completed performance evaluation. Earlier Nemotron room `abc4d307` was also archived/deleted.

All source changes are uncommitted. Original Nemotron player/image remains available. Dashboard changes are not pushed/deployed to Vercel.

## Implemented and tested

- New selectable player `STS2-Pi-Astra-v0.1`, setup kind `astra`, image `sts2-pi-astra:0.1`, built from `Dockerfile.astra` on top of `steambench-pi`.
- Experiential Labs Responses endpoint `https://api.experientiallabs.ai/v1`, exact model `gpt-6-astra`, medium reasoning only. `EXPLABS_API_KEY` was available in the exported shell environment, **not `.env`**. Future Compose recreation needs it exported again. Do not print credentials.
- Direct model/function roundtrip and the actual player `--smoke` passed. Provider downgraded strict function schemas; tested non-strict function calls worked. Reported zero cost is not evidence that usage is free.
- `client/astra/player.mjs` speaks the existing Pi JSONL RPC contract. A fresh bundled Pi subprocess/context is used for each bounded JSON plan. Context contains fresh authoritative state, short strategy, last result, bounded lessons/instructions, and a screenshot when needed.
- `executor.mjs` performs bounded controller inputs and state verification without a model call per button. Card actions use observed instance IDs. Draw/random/selection barriers and no-progress/stale-state checks exist, but need the fixes below.
- Separate read-only focus/card-ID sensor in `host/astra/McpMod.Steambench.cs`; `host/build_astra_mod.sh` builds `.runtime/sts2mcp/astra-out/`. It does not install into the personal host game. Astra rooms use this DLL; original rooms retain their original DLL path.
- Separate skills under `server/skills/sts2-astra/`, copied into each room as `skills/sts2`. Correct archived scratchpad path: `/workspace/skills/sts2/scratchpad`.
- Scratchpad: current facts, short run notes, append-only observations/actions/errors/usage, metrics, candidate lessons. Optional accepted lessons frozen from `.runtime/wolf/astra-memory/accepted.json` at creation; candidates are not automatically promoted.
- Image, mod, server and dashboard builds passed. Model smoke passed after the final planner rewrite. Earlier syntax checks, diff whitespace check, and ad hoc executor assertions passed. No full-run validation yet.

## Issues identified before resuming (historical)

1. **Self-target confirmation:** live Defend needed another A after selection. Current helper rejects this with `card did not leave hand; refusing an unverified second press`. The next decision then sees null focus and may fail `cannot establish hand focus`. Screenshot-guided recovery played it successfully, but wastes decisions. Expose `NPlayerHand.InCardPlay` and the selected/targeting identity, verify the selected card, then confirm only that known selection. Do not blindly double-A every card. Actual `hand_mode` was verified as `Play`; focus/card IDs worked when the hand had focus.
2. **Uncertainty barrier:** Neow's Fury says `Put up to 2 cards from your Discard Pile into your Hand`. Current `uncertainCard` regex misses this wording and continued a batch. Add recover/put/return-to-hand effects and test stopping before subsequent actions.
3. **Multi-enemy targeting:** play helper deliberately supports only one live enemy; other combat falls back to small screenshot-guided input batches. Add a read-only selected-enemy sensor and verified target navigation before general batching.
4. **Knowledge/memory:** accepted lessons currently check only agent VERSION, not game/mod build. Add build fingerprints, provenance and reviewed promotion/evaluation. Current wiki is policy, not a populated card/bestiary/event catalog. Preserve contextual variants rather than turning buffed card observations into universal facts. Parent currently drops full draw/discard/exhaust lists; add compact relevant retrieval for selection effects. Run-level deck composition is not yet authoritatively included.
5. **Completion:** base mod game-over state lacks an explicit victory flag. HP zero supports loss; other outcomes pause instead of guessing. Add authoritative victory evidence before claiming automatic completion of a winning run.
6. **Metrics:** compare equivalent seeds/character/ascension/build with frozen memory variants and held-out runs. Track inputs/decision, verified cards/decision, model latency/tokens/floor, retries, stalls and outcomes; one aborted smoke run cannot establish improvement.

The attempted sensor/regex edits immediately before the user's stop request **did not apply**. Source, images and live test used the original implementations described above.

## Debugging/build nuances

- Installed Pi 0.85.0's unbundled SDK imports missing `@earendil-works/pi-server`. Use the bundled `pi --mode rpc` subprocess in `planner.mjs`; the SDK approach failed even through direct core imports.
- Default latest `ilspycmd` installation failed with missing `DotnetToolSettings.xml` in the .NET 9 container. A version-pinned retry was interrupted; no new decompilation or sensor changes were completed. Temporary inspection containers are stopped. Avoid downloading/debugging this until work resumes.
- Rebuild player after `client/astra/` edits; rebuild mod separately after sensor edits; rebuild server after server/skill-template edits. Images do not hot-update existing containers. Server restart destroys in-memory rooms: never use it to apply a player fix to an active room.

```sh
DOCKER_CONTEXT=default docker build -f Dockerfile.astra -t sts2-pi-astra:0.1 .
DOCKER_CONTEXT=default docker run --rm -e EXPLABS_API_KEY sts2-pi-astra:0.1 --smoke
bash host/build_astra_mod.sh
DOCKER_CONTEXT=default docker compose build server
```

These commands build/test only. Applying the server or creating another room is a separate authorized runtime step. Preserve the archive for regression fixtures; do not publish its raw private data or `previous_work.txt`.
