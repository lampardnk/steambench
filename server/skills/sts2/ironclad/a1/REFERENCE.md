---
description: Which sources are allowed, how much they can be trusted against the installed build, and the rule that live mod state outranks every reference.
character: ironclad
act: any
category: reference
ascension: a1
keys: [reference, sources, wiki, slaythespire2, wiki.gg, lookup, research, versioned, build, provenance, uncertainty]
sources: [slaythespire2.net, slaythespire.wiki.gg]
---

# Versioned factual knowledge

Use this installed STS2 build's observed card descriptions, can_play flags, enemy intents, and statuses. Do not import an STS1 bestiary or character list.

The runtime maintains an observed catalog of card/enemy/event variants in scratchpad, with decision evidence and build identity. It does not mix buffed hand descriptions into permanent base card facts. The current decision receives current hand/mechanics, compact permanent-deck counts, and discard details when selection effects make them relevant, not a full compendium.
Draw-pile order is not a known future draw sequence. Do not assume random outcomes.
Keep verified mechanics separate from strategy hypotheses. Candidate strategy lessons require evaluation on held-out runs before acceptance.

The planner's standalone `lookup` action queries the existing read-only STS2MCP `/api/v1/wiki` endpoint for cards/relics (maximum five results, 6000 result characters). Results are fuzzy matches from the active profile's discovered cards/relics, not the complete catalog. It does not support monster/event searches. Current modified hand text and intents outrank base wiki values. A live read-only Bash lookup through the player gateway was verified on 2026-09-06.

**Two external sources are reachable**, both through the server's allowlist, and nothing is bundled with the image — every page is fetched on demand with the standalone `research` action.

- `https://slaythespire2.net/?v=beta` — encounter lists at `/monster?v=beta` and `/event?v=beta`. Every fetch is pinned to `?v=beta`, the profile matching the installed v0.111.0 build.
- `https://slaythespire.wiki.gg/` — deeper on powers, exact status wording, stack types and event outcomes. Where the two disagree, record both rather than silently picking one; they have been observed to differ on damage values and on which pile a status card enters.

Both are community data that can lag the installed build. Never infer hidden event outcomes or override current intent/options with reference predictions. Expand by fetching the actual relevant beta page, retaining provenance and uncertainty rather than copying whole pages into each prompt.

Baseline strategy: find lethal, otherwise limit avoidable damage while advancing the fight. Use potions before a lethal threat. Favor cards that fix a current deck weakness; skipping is valid. Reserve extended comparison for consequential route, shop, and boss decisions rather than ordinary button execution.
