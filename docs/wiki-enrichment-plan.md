# STS2 factual reference and runtime plan

Status: implementation in progress. The user approved execution by Luna agents at maximum reasoning, with batch fetching to reduce overhead without reducing factual coverage.

## Content contract

- Record mechanics, amounts, triggers, timing, conditions, exceptions, and observed interface behavior. Distinguish the installed build from the version documented by a source.
- Retain community wiki Notes and Interactions as observations, explicitly marked `[wiki-driven]` with the exact page URL and section. Paraphrase faithfully; a wiki attribution must come from an inspected page.
- Remove invented route, draft, purchase, upgrade, and combat prescriptions. General requests to calculate outcomes, assess risk/reward, and adapt remain allowed.
- Do not generate or inherit narrative run diaries or advice for the next seed. Operational checkpoints, current encounter state, and incident evidence remain run-local.
- Keep factual correction proposals outside retrieval and future-room checkouts until a human curates them.
- Unknown or conflicting mechanics remain labeled as such. Wiki descriptions do not establish that a semantic action is available or verified.

## Batches and ownership

| Batch | Files | Required coverage | Source map |
|---|---|---|---|
| Enemies | `ironclad/a1/act{1,2,3}/{normal,elite,boss}/`, Act 2/3 navigation | Every listed enemy; HP and ascension differences; move amounts and conditions; effect/status definitions; Notes/Interactions | `wiki-enemy-coverage.md` |
| Events | All act `unknown/`, `meta_strategy/unknown/`, `act1/ancient/NEOW.md` | Every local event; choices, eligibility, costs, outcomes, linked cards/relics, Notes/Interactions | `wiki-event-coverage.md` |
| Reference and prompts | Remaining `meta_strategy/`, ascension, characters, controls, guide indexes, role prompts and injected context text | Buffs, debuffs, statuses, keywords, mechanics, cards, relics, potions, map/shop/rest/reward facts; remove unsupported steering | `wiki-meta-prompt-coverage.md` |
| Runtime | Player, executor, retrieval, library synchronization and tests | Selection identities, explicit incident resume, factual retrieval, context capacity, no diary inheritance | Tests and final change review |

Source maps are implementation artifacts: workers must list exact inspected URLs for each edited file and identify unverified gaps. Start from the existing local citations and the STS2 wiki at `https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2`; follow referenced pages rather than treating the initial URL list as a limit.

Named priority cases: Hunter Killer's Tender, Exoskeleton's Hard to Kill, Inklet's Slippery, The Insatiable's Sandpit and Frantic Escape, Knowledge Demon's forced choices, and Queen's Chains of Binding/Bound. Coverage also extends to every other entry in the owned files.

## Injection checks

Inspect `planner.mjs`, every used role prompt, `player.mjs`, `context.mjs`, `retrieval.mjs`, `state.mjs` refinement messages, and the kickoff in `server/lib/rooms.js`. Preserve role projections and operational safeguards. Reusable facts must reach the appropriate role; the presence of a Markdown file alone does not establish retrieval.

The initial audit found the live sensor's `status` and `player.relics` fields were not used by retrieval, nested Notes/Interactions could be sliced out, and a 60 KB context guard removed or rejected source bodies. Runtime changes address these issues and scale reference capacity with the configured model.

## Verification and completion

1. Review every batch's file/URL map, factual changes, provenance, and unresolved conflicts.
2. Scan all injected files for invented strategic verdicts and diary instructions. Review matches in context; wiki observations and general calculation guidance are permitted.
3. Exercise actual sensor shapes, duplicate/renumbered hand selections, partially selected trays, nested source sections, and source bodies exceeding the former 60 KB cutoff.
4. Verify future rooms inherit neither narrative diaries nor unreviewed proposals, and template refreshes preserve separately curated factual files.
5. Run the learning suite and dashboard build; inspect the final diff and report any failed checks accurately.
6. Build runtime images as appropriate. Backend/Wolf restart remains separately restricted by AGENTS.md because active rooms are not restart-safe. Publish the dashboard only with deployment authorization; local build success is not a production deployment.

## Recovery already verified earlier in this session

Room `7a0d3990` incident `1788979759921-132` was caused by mutable hand-selection indices and mixed tray/hand navigation. The player was rebuilt and reloaded, explicitly resumed with the incident ID, and decision 133 resolved the selection by physical card identity. Subsequent combat progressed without another incident during that observation window. Current room health must be re-read after reconnecting; this record is not a claim about its present state.
