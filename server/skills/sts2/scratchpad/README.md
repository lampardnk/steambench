# Scratchpad & Encounter Guide (Run-Local State)

`/workspace/skills/sts2/scratchpad/` contains ephemeral, per-run state. It is archived with the room upon completion/deletion and **never inherited across seeds**. Durable, seed-invariant knowledge belongs in `learned/` (or the persistent skill tree).

---

## 1. Scratchpad File Manifest

| File / Directory | Scope & Purpose | Lifecycle |
|---|---|---|
| `facts.json` | Authoritative observation snapshot of current game state. | Overwritten each decision. |
| `run.md` | Strategic hypothesis, deck plan, current route, and last verified outcome. | Updated periodically across floors. |
| `events.jsonl` | Append-only event log of observations, attempted inputs, verified actions, errors, and model token usage. | Appended each decision. |
| `metrics.json` | Cumulative decision count, wall time, verified plays, sensor readings, and execution overhead. | Updated each decision. |
| `curriculum.json` | Run-local objective ladder view. (Durable ladder stored in `learned/curriculum.json`). | Updated upon objective settlement. |
| `checkpoint.json` | Atomic run state (task, strategy, startup verification, counters, pending incident) used for player-only container reloads. | Restored on reload; saved periodically. |
| `incidents/<id>/` | Immutable incident directories capturing before/after states, sensor rings, screenshots, and plan data upon any failure. | Created on first failure. |
| `attention.json` | Pointer to the active unresolved incident requiring review. | Managed by supervisor/player. |
| `incident-resolutions.jsonl` | Journal of supervisor reviews, fix explanations, or chat replies that resumed an incident. | Appended on resume. |
| `observed-catalog.json` | Bounded catalog of card, enemy, and event variants observed during this run. | Appended during run. |
| `learning.jsonl` | Required pre-action hypotheses and separately recorded observed outcomes. | Appended each decision. |

---

## 2. In-Combat Encounter Scratchpad (`EncounterScratchpad`)

During combat encounters, `client/learning/encounter.mjs` reconstructs a structured combat model from authoritative STS2 mod state. It does not carry forward unverified assumptions or stale deck orders.

### Key Invariants
1. **Fresh State Authority:** Piles (hand, draw pile, discard pile, exhaust pile), powers, and enemy intents replace all earlier memory upon each observation.
2. **Draw Pile Order:** Draw pile cards are reported as a set/collection with instance IDs; **draw order is hidden and never predicted**.
3. **Combat IDs vs Display IDs:** Enemies are tracked strictly by immutable `combat_id`. Display IDs (e.g. `TOADPOLE_0`) renumber upon enemy deaths and must not be used for target binding.
4. **Damage & Restriction Tracking:** Power effects (e.g. Vulnerable, Weak, Strength, Intangible, Block, Damage Caps) are parsed for both player and enemies to compute actual incoming/outgoing damage.
5. **Verified Recent Effects:** Tracks up to the last 4 verified combat actions and their direct state deltas.

---

## 3. Ephemeral vs Durable Separation

- **Never Put in Scratchpad as Permanent Truth:** Single-seed map roll paths, individual RNG card roll results, or one-off turn transcripts.
- **When to Promote to `learned/`:**
  - An enemy's intent graph or attack rotation pattern (to `bestiary/`).
  - General card synergy or energy management rules (to `strategy/`).
  - UI control quirks, menu navigation topologies, or focus mechanics (to `controls/`).
