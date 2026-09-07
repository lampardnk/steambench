// No room, game, gateway, Docker socket, or host secret directory is mounted.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PROFILE } from '../server/lib/learning-profile.mjs';
if (!process.env.ORCA_KEY) throw new Error('ORCA_KEY must be present in the system environment');
const child = spawn('docker', ['run', '--rm', '--name', 'steambench-model-probe', '-e', 'ORCA_KEY', '--entrypoint', 'node', PROFILE.image, '/opt/steambench/client/learning/decision-probe.mjs'], {
  env: { ...process.env, DOCKER_CONTEXT: 'default' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => process.stderr.write(String(chunk).replaceAll(process.env.ORCA_KEY, '[redacted]')));
const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
const result = JSON.parse(output.trim().split('\n').at(-1));
const directory = path.resolve('.runtime/wolf/learning');
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'provider-readiness.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
process.exitCode = code || 0;
