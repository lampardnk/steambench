---
description: Procedures for debugging player failures, reading incidents, diagnosing sensor/focus mismatches, and performing safe supervisor recovery.
keys: debugging, incidents, supervisor, inspect, resume, reload, triage, errors, player, scratchpad
---

# Ironclad A1: Debugging & Supervisor Recovery Guide

This guide details the failure containment policy, incident inspection procedures, and safe supervisor recovery protocols.

---

## 1. Failure Containment & The First-Failure Gate

The player runtime enforces a strict **first-failure pause policy**:
1. **Immediate Halt:** On the first planner failure, provider timeout, or executor mismatch (e.g. unexpected focus transition, missing card instance), all input ceases immediately.
2. **Neutral Release:** The virtual pad is reset to neutral (`op: "pad-neutral"`).
3. **Evidence Capture:** An immutable incident bundle is captured under `scratchpad/incidents/<id>/`.
4. **Unresponsive Supervisor Invariant:** If the operator or supervisor does not intervene, the player MUST remain paused. It MUST NOT:
   - Blindly retry the failed input.
   - Spam controller buttons or guess alternate actions.
   - Change scenes, abandon runs, or restart the game process.

---

## 2. Incident Artifact Structure

When a failure occurs, the following files are saved in `scratchpad/incidents/<id>/`:

| File | Content & Purpose |
|---|---|
| `incident.json` | Complete metadata: error reason, model ID, planned action batch, and before/after sensor state diffs. |
| `before.jpg` | Visual capture of the game screen immediately before the planned batch began. |
| `after.jpg` | Visual capture of the game screen immediately after the failure/pause occurred. |
| `recent_sensors.json` | Ring buffer of the last 10 raw sensor states received from the game. |
| `recent_inputs.json` | Ring buffer of recent input requests dispatched to the gateway. |

The active unresolved incident ID is written to `scratchpad/attention.json`.

---

## 3. Operator Triage & Diagnostic Steps

*(Note: These commands are executed from the host environment by a human supervisor or operator script; the containerized player cannot run host shell commands).*

### Step 1: Inspect Incident Evidence
```sh
node host/learning-player.mjs inspect <ROOM_ID>
```
Review the reported error, the target element/action, and compare `before.jpg` against `after.jpg` to identify visual or focus misalignment.

### Step 2: Check Mod & Gateway State
Verify that the STS2 mod is responsive and returning valid JSON:
```sh
curl -fsS -H "Authorization: Bearer $STEAMBENCH_TOKEN" \
  "http://127.0.0.1:8787/api/rooms/<ROOM_ID>/sts2?path=/api/v1/singleplayer&format=json"
```

### Step 3: Check Focus Graph Alignment
Inspect `state.ui` in the returned JSON:
- Is `state.ui.focused_element` valid?
- Does the target control exist in `state.ui.elements[]`?
- Are neighbor mappings (`up`, `down`, `left`, `right`) consistent with the visual layout?

---

## 4. Recovery & Resume Protocols

### Standard Resume (After Review or Code Fix)
Once the cause of failure is understood (and any necessary code changes have been deployed), resume the player by acknowledging the incident:
```sh
node host/learning-player.mjs resume <ROOM_ID> \
  --issue <INCIDENT_ID> \
  --message "Identified focus mismatch on reward button; verified D-pad path."
```
*Note: Normal chat commands throw when an incident is pending. The explicit resume RPC is required to clear `attention` and resume gameplay.*

### Player Container Reload (Code Changes)
If player client code (`client/learning/`) was modified, rebuild the image and reload the player container without restarting the room or game:
```sh
# 1. Rebuild player image
DOCKER_CONTEXT=default docker build -f client/Dockerfile -t steambench-learning:latest .

# 2. Reload player container
node host/learning-player.mjs reload <ROOM_ID>

# 3. Resume with issue acknowledgement
node host/learning-player.mjs resume <ROOM_ID> --issue <INCIDENT_ID> --message "Reloaded player container with navigation fix."
```

---

## 5. Architectural Assessment: Mod & Sensor Upgrades

When evaluating future sensor improvements:

| Method | Status & Assessment |
|---|---|
| **In-Process C# / Harmony Patches (`host/learning/McpMod.Steambench.cs`)** | **Implemented & Primary.** Safe reflection access to Godot `SceneTree`, `Control.FindValidFocusNeighbor()`, and game state. Compiled cleanly in .NET 9 SDK container. |
| **Dynamic Assembly Hot-Reload** | **Unimplemented / Unsafe.** Godot / Mono runtime cannot safely unload and reload modified DLLs during active gameplay without game restarts. |
| **Direct Process Memory / `ptrace`** | **Rejected.** Fragile, violates container safety isolation, and risks crashing the Godot runtime. |
| **Passive Log Parsing (`godot.log`)** | **Implemented for Diagnostics.** Used by backend to detect fatal startup exceptions (`modLoadError`); not used for real-time actuation. |
