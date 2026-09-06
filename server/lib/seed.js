// Seeds a room's home directory (mounted as /home/retro in the GOW steam
// container) with read-only copies of the installed game, its mod, and the
// game's user data from the host. Nothing on the host is modified.
//
// Steam credentials are never copied from the host: the client encrypts its
// stored refresh token per machine, so a host login is useless in a room. What
// does work is copying a login between rooms, because every room presents the
// same pinned hostname and machine-id (see rooms.js). The first successful
// login in any room is snapshotted with saveLoginTemplate() and replayed into
// every room after that, so signing in is a one-time step.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { steamRoot, ROOM_STEAM_ROOT } from './steam.js';
import { ensureGameCache, seedSteamHome, seedGame, cachePaths } from './cache.js';

export const STS2_APPID = '2868840';
export const STS2_INSTALLDIR = 'Slay the Spire 2';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}: ${err.trim()}`))));
  });
}

async function copyTree(src, dst, { exclude = [] } = {}) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true }).filter((e) => !exclude.includes(e.name));
  if (entries.length === 0) return true;
  // cp -a keeps mtimes/symlinks and is far faster than a JS copy for 2 GB of game files.
  await run('cp', ['-a', ...entries.map((e) => path.join(src, e.name)), dst + '/']);
  return true;
}

function rewriteFile(file, from, to) {
  if (!from || !fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes(from)) fs.writeFileSync(file, text.split(from).join(to));
}

/**
 * @param {object} o
 * @param {string} o.home              room home dir as seen by this process (Wolf mounts it at /home/retro)
 * @param {string} o.hostSteam         host Steam data dir as seen by this process (read only)
 * @param {string} [o.hostSteamOriginalPath] the same dir's path on the host, for rewriting absolute paths in .vdf files
 * @param {string} [o.hostSts2]        host ~/.local/share/SlayTheSpire2 as seen by this process (read only)
 * @param {string} [o.loginTemplate]   optional dir holding a previously saved Steam login (config/, userdata/, local.vdf)
 * @param {number} [o.sts2Port]        port the STS2MCP mod should listen on inside the room
 */
export async function seedRoomHome({ home, hostSteam, hostSteamOriginalPath, hostSts2, loginTemplate, cacheDir, sts2Port = 15526, uid = 1000, gid = 1000, log = () => {} }) {
  // Prefer the cached Steam directory (client, login and settings from a room
  // that already settled): it saves the bootstrap and the client self-update.
  const cachedSteam = cacheDir ? await seedSteamHome({ home, cacheDir, log }) : false;
  const steam = steamRoot(home);
  fs.mkdirSync(steam, { recursive: true });
  fs.mkdirSync(path.join(home, '.local', 'share'), { recursive: true });

  if (!cachedSteam && loginTemplate && fs.existsSync(loginTemplate)) {
    log('seed: saved steam login');
    await copyTree(loginTemplate, steam);
  }

  const apps = path.join(steam, 'steamapps');
  fs.mkdirSync(path.join(apps, 'common'), { recursive: true });
  fs.mkdirSync(path.join(apps, 'workshop', 'content'), { recursive: true });
  const manifest = path.join(hostSteam, 'steamapps', `appmanifest_${STS2_APPID}.acf`);
  if (!fs.existsSync(manifest)) throw new Error(`game not installed on host: ${manifest} missing`);
  fs.copyFileSync(manifest, path.join(apps, `appmanifest_${STS2_APPID}.acf`));
  const libFolders = path.join(hostSteam, 'steamapps', 'libraryfolders.vdf');
  if (fs.existsSync(libFolders)) fs.copyFileSync(libFolders, path.join(apps, 'libraryfolders.vdf'));
  if (cacheDir) {
    const gameCache = await ensureGameCache({ cacheDir, appid: STS2_APPID, hostGameDir: path.join(hostSteam, 'steamapps', 'common', STS2_INSTALLDIR), log });
    await seedGame({ gameCacheDir: gameCache, installDir: path.join(apps, 'common', STS2_INSTALLDIR), log });
  } else {
    log('seed: game files');
    await copyTree(path.join(hostSteam, 'steamapps', 'common', STS2_INSTALLDIR), path.join(apps, 'common', STS2_INSTALLDIR));
  }
  const ws = path.join(hostSteam, 'steamapps', 'workshop', `appworkshop_${STS2_APPID}.acf`);
  if (fs.existsSync(ws)) fs.copyFileSync(ws, path.join(apps, 'workshop', `appworkshop_${STS2_APPID}.acf`));
  await copyTree(path.join(hostSteam, 'steamapps', 'workshop', 'content', STS2_APPID), path.join(apps, 'workshop', 'content', STS2_APPID));

  // Steam stores absolute library paths; point them at the room's Steam root.
  rewriteFile(path.join(apps, 'libraryfolders.vdf'), hostSteamOriginalPath || hostSteam, ROOM_STEAM_ROOT);

  log('seed: game user data and mod config');
  if (hostSts2) await copyTree(hostSts2, path.join(home, '.local', 'share', 'SlayTheSpire2'), { exclude: ['shader_cache', 'logs', 'sentry', 'vulkan'] });
  const modsDir = path.join(apps, 'common', STS2_INSTALLDIR, 'mods');
  fs.mkdirSync(modsDir, { recursive: true });
  fs.writeFileSync(path.join(modsDir, 'STS2_MCP.conf'), JSON.stringify({ port: sts2Port }, null, 2) + '\n');

  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    log('seed: chown');
    await run('chown', ['-R', `${uid}:${gid}`, home]);
  }
  return home;
}

/**
 * Snapshot a logged-in room's Steam credentials so later rooms start signed in.
 * Copies the client's own encrypted token state (local.vdf ConnectCache,
 * config.vdf, loginusers.vdf, the ssfn machine-auth files) plus per-user config.
 */
export async function saveLoginTemplate({ home, templateDir, log = () => {} }) {
  const steam = steamRoot(home);
  if (!fs.existsSync(path.join(steam, 'config', 'loginusers.vdf'))) throw new Error('room has no Steam login to save');
  const tmp = templateDir + '.new';
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  log('saving steam login for future rooms');
  await copyTree(path.join(steam, 'config'), path.join(tmp, 'config'), { exclude: ['htmlcache', 'avatarcache', 'depotcache'] });
  await copyTree(path.join(steam, 'userdata'), path.join(tmp, 'userdata'));
  for (const f of fs.readdirSync(steam)) {
    if (f === 'local.vdf' || f === 'registry.vdf' || f.startsWith('ssfn')) {
      const src = path.join(steam, f);
      if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(tmp, f));
    }
  }
  fs.rmSync(templateDir, { recursive: true, force: true });
  fs.renameSync(tmp, templateDir);
  return templateDir;
}

/** Who the saved login belongs to, or null when there is none. */
export function loginTemplateInfo(templateDir) {
  if (!templateDir || !fs.existsSync(path.join(templateDir, 'config', 'loginusers.vdf'))) return null;
  let savedAt = null;
  try { savedAt = fs.statSync(path.join(templateDir, 'config', 'loginusers.vdf')).mtimeMs; } catch { /* ignore */ }
  return { savedAt };
}
