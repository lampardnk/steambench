---
description: Procedures for diagnosing semantic action failures and performing safe supervisor recovery.
keys: debugging, incidents, supervisor, inspect, resume, reload, triage, errors, player, scratchpad, sts2mcp
---

# Ironclad A1: Debugging and supervisor recovery

## Failure containment

The player pauses on the first planner, provider, or post-dispatch executor
failure. It stops dispatching actions and records an incident under
`scratchpad/incidents/<id>/`. If the supervisor is unavailable, it remains
paused. It never retries a write whose outcome is unknown.

The incident JSON contains the planned semantic action batch, before and after
structured states, recent action requests, recent sensor observations, model
diagnostics, and the error. When video is available, `before.jpg` and
`after.jpg` accompany it. The active incident is also named in
`scratchpad/attention.json`.

## Read-only triage

From the host, inspect the incident:

```sh
node host/learning-player.mjs inspect <ROOM_ID>
```

Check that STS2MCP still answers structured GETs:

```sh
curl -fsS -H "Authorization: Bearer $STEAMBENCH_TOKEN" \
  "http://127.0.0.1:8787/api/rooms/<ROOM_ID>/sts2?path=/api/v1/singleplayer&format=json"
```

Compare the action's semantic identity with the observation immediately before
dispatch and the numeric index recorded in its `mcp` request. Then compare the
before and after states. A timeout or connection loss after dispatch is an
unknown result even if the action appears to have landed; it requires human
review and must not be replayed automatically.

## Resume after review

Only the explicit supervisor RPC clears the incident gate:

```sh
node host/learning-player.mjs resume <ROOM_ID> \
  --issue <INCIDENT_ID> \
  --message "Reviewed the STS2MCP acknowledgement and resulting state."
```

Normal chat remains blocked while an incident is pending.

If player code changed, rebuild and reload only the player container, preserving
the room and game, then acknowledge the same incident:

```sh
DOCKER_CONTEXT=default docker build -f client/Dockerfile -t steambench-learning:latest .
node host/learning-player.mjs reload <ROOM_ID>
node host/learning-player.mjs resume <ROOM_ID> \
  --issue <INCIDENT_ID> \
  --message "Reloaded the player with the reviewed semantic-action fix."
```

Do not restart the backend, Wolf, or the game to apply a player-only fix.

## Sensor-extension guidance

Prefer small structured additions to `host/learning/McpMod.Steambench.cs` when
semantic execution lacks an identity or state needed for safe validation. The
extension currently supplies stable card instances, selection identities,
encounter identity, pile membership, deck contents, build compatibility, and
victory state. Passive logs remain diagnostic only; direct process-memory
mutation and runtime assembly replacement are not recovery mechanisms.
