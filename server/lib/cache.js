// Room caches. Creating a room used to mean copying the game (2 GB) and then
// letting Steam bootstrap and download its own ~500 MB client update, which is
// most of the minutes before a run starts. Both are the same for every room, so
// they are built once here and hardlinked into each new room.
//
// Hardlinks are safe for these trees because Steam replaces files rather than
// rewriting them in place, and the caches are ours: the user's real Steam
// library is only ever read, and only when first filling the game cache.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

/** Small, per-room mutable Steam state; copied rather than linked. */
const MUTABLE = ['config', 'userdata', 'local.vdf', 'registry.vdf', 'logs', 'appcache'];

function run(cmd, args, { timeoutMs = 30 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`${cmd} timed out`)); }, timeoutMs);
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('close', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.slice(0, 3).join(' ')} exited ${code}: ${err.trim().slice(0, 300)}`));
    });
  });
}

const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };

/** Copy a tree, sharing file contents through hardlinks where possible. */
export async function linkTree(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.rmSync(dst, { recursive: true, force: true });
  try {
    await run('cp', ['-al', src, dst]);
  } catch {
    // Different filesystem, or a link limit: fall back to a real copy.
    fs.rmSync(dst, { recursive: true, force: true });
    await run('cp', ['-a', src, dst]);
  }
}

/** Replace hardlinked entries with private copies so a room cannot write into the cache. */
async function privatise(dir, names) {
  for (const name of names) {
    const target = path.join(dir, name);
    if (!exists(target)) continue;
    const tmp = `${target}.private`;
    fs.rmSync(tmp, { recursive: true, force: true });
    await run('cp', ['-a', target, tmp]);
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(tmp, target);
  }
}

export function cachePaths(cacheDir, appid) {
  return { steamHome: path.join(cacheDir, 'steam-home'), game: path.join(cacheDir, `game-${appid}`) };
}

export function cacheInfo(cacheDir, appid) {
  const { steamHome, game } = cachePaths(cacheDir, appid);
  const stat = (p) => {
    if (!exists(p)) return null;
    try { return { at: fs.statSync(p).mtimeMs }; } catch { return { at: null }; }
  };
  return { steamHome: stat(steamHome), game: stat(game) };
}

/** Fill the game cache from the host library the first time it is needed. */
export async function ensureGameCache({ cacheDir, appid, hostGameDir, log = () => {} }) {
  const { game } = cachePaths(cacheDir, appid);
  if (exists(game)) return game;
  if (!exists(hostGameDir)) throw new Error(`game not installed on the host: ${hostGameDir}`);
  log('cache: copying the game from the host library (first room only)');
  const tmp = `${game}.new`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(game), { recursive: true });
  await run('cp', ['-a', hostGameDir, tmp]);
  fs.renameSync(tmp, game);
  log('cache: game cached');
  return game;
}

/**
 * Snapshot a settled room's Steam directory (client binaries it downloaded,
 * plus login and settings) so later rooms skip the bootstrap and update.
 */
export async function saveSteamHomeCache({ home, cacheDir, log = () => {} }) {
  const src = path.join(home, '.steam');
  if (!exists(src)) throw new Error('room has no .steam directory to cache');
  const { steamHome } = cachePaths(cacheDir, '');
  const tmp = `${steamHome}.new`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(steamHome), { recursive: true });
  // The game library is cached separately; never duplicate it here.
  await run('cp', ['-a', src, tmp]);
  for (const rel of ['steam/steamapps/common', 'steam/steamapps/workshop', 'steam/logs', 'steam/appcache/httpcache']) {
    fs.rmSync(path.join(tmp, rel), { recursive: true, force: true });
  }
  const old = `${steamHome}.old`;
  fs.rmSync(old, { recursive: true, force: true });
  if (exists(steamHome)) fs.renameSync(steamHome, old);
  fs.renameSync(tmp, steamHome);
  fs.rmSync(old, { recursive: true, force: true });
  log('cache: saved the Steam client and login for future rooms');
  return steamHome;
}

/** Lay a cached Steam directory into a new room, privatising what Steam writes. */
export async function seedSteamHome({ home, cacheDir, log = () => {} }) {
  const { steamHome } = cachePaths(cacheDir, '');
  if (!exists(steamHome)) return false;
  const dst = path.join(home, '.steam');
  log('seed: cached Steam client and login');
  await linkTree(steamHome, dst);
  await privatise(path.join(dst, 'steam'), MUTABLE);
  await privatise(dst, ['registry.vdf', 'steam.pid', 'steam.pipe']);
  return true;
}

/** Lay the cached game into a room's library. */
export async function seedGame({ gameCacheDir, installDir, log = () => {} }) {
  log('seed: game files (hardlinked from cache)');
  await linkTree(gameCacheDir, installDir);
  // The mod config differs per room, so it must not share the cache's copy.
  fs.rmSync(path.join(installDir, 'mods'), { recursive: true, force: true });
  fs.mkdirSync(path.join(installDir, 'mods'), { recursive: true });
  return installDir;
}

export function clearCache(cacheDir) {
  fs.rmSync(cacheDir, { recursive: true, force: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  return true;
}
