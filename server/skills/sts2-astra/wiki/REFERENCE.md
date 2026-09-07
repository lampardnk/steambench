# Versioned factual knowledge

Use this installed STS2 build's observed card descriptions, can_play flags, enemy intents, and statuses. Do not import an STS1 bestiary or character list.

The runtime maintains an observed catalog of card/enemy/event variants in scratchpad, with decision evidence and build identity. It does not mix buffed hand descriptions into permanent base card facts. The current decision receives current hand/mechanics, compact permanent-deck counts, and discard details when selection effects make them relevant, not a full compendium.
Draw-pile order is not a known future draw sequence. Do not assume random outcomes.
Keep verified mechanics separate from strategy hypotheses. Candidate strategy lessons require evaluation on held-out runs before acceptance.

The planner's standalone `lookup` action queries the existing read-only STS2MCP `/api/v1/wiki` endpoint for cards/relics (maximum five results, 6000 result characters). Results are fuzzy matches from the active profile's discovered cards/relics, not the complete catalog. It does not support monster/event searches. Current modified hand text and intents outrank base wiki values. A live read-only Bash lookup through the player gateway was verified on 2026-09-06.

External reference: https://slaythespire2.net/?v=beta, with encounter lists at `/monster?v=beta` and `/event?v=beta`. `client/astra/references.json` bundles seven small source-labelled extracts for initial Underdocks monsters, Soul Fysh, Abyssal Baths and Sunken Treasury; only matching names/IDs enter context (maximum three entries). Coverage is partial, not an exhaustive bestiary/event library. Retrieved 2026-09-06; extracted pages display 2026-06-18, so installed-build compatibility is unverified. Never infer hidden event outcomes or override current intent/options with reference predictions. Expand by fetching the actual relevant beta page, retaining provenance and uncertainty rather than copying whole pages into each prompt.

Baseline strategy: find lethal, otherwise limit avoidable damage while advancing the fight. Use potions before a lethal threat. Favor cards that fix a current deck weakness; skipping is valid. Reserve extended comparison for consequential route, shop, and boss decisions rather than ordinary button execution.
