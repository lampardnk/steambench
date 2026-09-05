// Thin wrappers around the docker CLI (the server image ships the static
// `docker` binary and talks to the engine through /var/run/docker.sock).
import { spawn } from 'node:child_process';

export function docker(args, { timeoutMs = 60000, input } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', args, { stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`docker ${args.slice(0, 2).join(' ')} timed out`)); }, timeoutMs);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`docker ${args.slice(0, 3).join(' ')} exited ${code}: ${err.trim().slice(0, 500)}`));
    });
    if (input !== undefined) { p.stdin.end(input); }
  });
}

/** Names of running containers whose name starts with `prefix`. */
export async function runningContainers(prefix = '') {
  const out = await docker(['ps', '--format', '{{.Names}}']);
  return out.split('\n').map((s) => s.trim()).filter((s) => s && s.startsWith(prefix));
}

export async function allContainers(prefix = '') {
  const out = await docker(['ps', '-a', '--format', '{{.Names}}']);
  return out.split('\n').map((s) => s.trim()).filter((s) => s && s.startsWith(prefix));
}

export async function containerIp(name) {
  const out = await docker(['inspect', '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}', name]);
  return out.trim().split(/\s+/).filter(Boolean)[0] || null;
}

export async function rmForce(name) {
  try { await docker(['rm', '-f', name]); return true; } catch { return false; }
}

export async function restart(name) { return docker(['restart', name], { timeoutMs: 120000 }); }

/** Run a command inside a container as a given user with extra env; resolves with stdout. */
export async function execIn(name, cmd, { user, env = {}, timeoutMs = 60000 } = {}) {
  const args = ['exec'];
  if (user) args.push('-u', String(user));
  for (const [k, v] of Object.entries(env)) args.push('-e', `${k}=${v}`);
  return docker([...args, name, ...cmd], { timeoutMs });
}

/** Run a detached command inside a container (docker exec -d). */
export async function execDetached(name, cmd) {
  return docker(['exec', '-d', name, ...cmd]);
}

/** Spawn `docker run ...` with stdin/stdout piped (for Pi's RPC mode). */
export function spawnRun(args) {
  return spawn('docker', ['run', ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
}
