import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_ACTIONS } from '../client/learning/state.mjs';
import { STS2_ACTION_SCHEMAS } from '../server/lib/sts2-actions.js';

assert.deepEqual([...GAME_ACTIONS].sort(), Object.keys(STS2_ACTION_SCHEMAS).sort(), 'player and gateway action surfaces stay identical');
const tracked = ['client/learning/player.mjs', 'client/learning/executor.mjs', 'client/learning/state.mjs', 'client/learning/strategist.txt', 'client/learning/combat.txt', 'server/lib/rooms.js', 'server/lib/wolf.js', 'host/process_gateway.py', 'docker-compose.yml'].map(file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')).join('\n');
assert.doesNotMatch(tracked, /pad-(?:press|dpad|stick|neutral|status)|\/dev\/uinput|controllers_override|encodeController|target_label/);
assert.match(tracked, /sts2-action/);
console.log(JSON.stringify({ result: 'passed', semanticActions: GAME_ACTIONS.size, gameplayActionsDispatched: 0 }));
