import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { PROFILE } from '../server/lib/learning-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2];
assert.match(id || '', /^[a-f0-9]{8}$/, 'usage: node host/learning-decision-probe.mjs ROOM_ID');
const token = process.env.STEAMBENCH_TOKEN || parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8')).STEAMBENCH_TOKEN;
const base = process.env.STEAMBENCH_BACKEND_URL || 'http://127.0.0.1:8787';
async function read(suffix, binary = false) {
  const response = await fetch(`${base}/api/rooms/${id}${suffix}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`room read failed: HTTP ${response.status}`);
  return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
}
const status = await read('/player/status');
assert.equal(status.agentStatus, 'idle', 'preserve an idle room while probing');
const directory = fs.mkdtempSync(path.join(root, '.runtime/wolf/learning/luna-probe-'));
fs.chmodSync(directory, 0o755); // contains game observations only; no key or backend token
const state = JSON.parse((await read('/sts2?path=/api/v1/singleplayer&format=json')).body);
const checkpoint = JSON.parse(fs.readFileSync(path.join(root, '.runtime/wolf/rooms', id, 'skills/sts2/scratchpad/checkpoint.json')));
fs.writeFileSync(path.join(directory, 'context.json'), JSON.stringify({ state, checkpoint: { taskText: checkpoint.taskText, freshRunVerified: checkpoint.freshRunVerified, strategy: checkpoint.strategy, lastResult: checkpoint.lastResult } }));
fs.writeFileSync(path.join(directory, 'frame.jpg'), await read('/frame.jpg', true));
const key = process.env.STEAMBENCH_LEARNING_OPENROUTER_API_KEY || fs.readFileSync(path.join(root, '.runtime/wolf/learning/openrouter.key'), 'utf8').trim();
const child = spawn('docker', ['run', '--rm', '-e', 'OPENROUTER_API_KEY', '--mount', `type=bind,src=${directory},dst=/probe,readonly`, '--entrypoint', 'node', PROFILE.image, '/opt/steambench/client/astra/decision-probe.mjs'], {
  env: { ...process.env, DOCKER_CONTEXT: 'default', OPENROUTER_API_KEY: key }, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; process.stdout.write(chunk); });
child.stderr.on('data', chunk => process.stderr.write(chunk));
const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
fs.writeFileSync(path.join(directory, 'result.jsonl'), output);
const after = await read('/player/status');
assert.equal(after.padCount, status.padCount, 'probe must send zero inputs');
assert.equal(after.agentStatus, 'idle');
assert.deepEqual(after.attention, status.attention);
console.log(JSON.stringify({ evidenceDirectory: directory, roomPreserved: true, padCount: after.padCount }));
process.exitCode = code || 0;
