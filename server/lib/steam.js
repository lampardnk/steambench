// Steam-side helpers for a room: login detection, library/ownership lookup,
// install state, all by reading files in the room's home (mounted as /home/retro).
import fs from 'node:fs';
import path from 'node:path';

// The GOW steam image keeps Steam's data in ~/.steam/steam (config, steamapps,
// userdata, local.vdf), not directly in ~/.steam. Everything that reads or
// seeds a room's Steam state goes through steamRoot().
const ROOT_CANDIDATES = ['.steam/steam', '.steam', '.local/share/Steam', '.steam/debian-installation'];
export const DEFAULT_STEAM_ROOT_REL = ROOT_CANDIDATES[0];
export const ROOM_STEAM_ROOT = '/home/retro/.steam/steam';

/** Resolve a room home to the directory Steam actually uses. */
export function steamRoot(home) {
  for (const rel of ROOT_CANDIDATES) {
    const dir = path.join(home, rel);
    if (fs.existsSync(path.join(dir, 'config', 'loginusers.vdf')) || fs.existsSync(path.join(dir, 'steamapps', 'libraryfolders.vdf'))) return dir;
  }
  return path.join(home, DEFAULT_STEAM_ROOT_REL);
}

/** Games steambench knows how to drive (mod, controls, skill). */
export const SUPPORTED_GAMES = {
  sts2: { appid: '2868840', name: 'Slay the Spire 2', installdir: 'Slay the Spire 2', skill: 'sts2', modPort: 15526 },
};

/** Tiny Valve KeyValues (VDF) parser: returns nested objects of strings. */
export function parseVdf(text) {
  const tokens = [];
  const re = /"((?:\\.|[^"\\])*)"|([{}])|\/\/[^\n]*/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) tokens.push({ s: m[1].replace(/\\(.)/g, '$1') });
    else if (m[2]) tokens.push({ b: m[2] });
  }
  let i = 0;
  function obj() {
    const out = {};
    while (i < tokens.length) {
      const t = tokens[i++];
      if (t.b === '}') return out;
      if (t.s === undefined) continue;
      const next = tokens[i];
      if (next?.b === '{') { i++; out[t.s] = obj(); }
      else if (next?.s !== undefined) { i++; out[t.s] = next.s; }
    }
    return out;
  }
  return obj();
}

function readVdf(file) {
  try { return parseVdf(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** Returns {steamId, accountName, personaName} when a user has logged in inside the room, else null. */
export function loggedInUser(home) {
  const v = readVdf(path.join(steamRoot(home), 'config', 'loginusers.vdf'));
  const users = v?.users;
  if (!users) return null;
  for (const [steamId, u] of Object.entries(users)) {
    if (typeof u !== 'object') continue;
    if (u.MostRecent === '1' || Object.keys(users).length === 1) {
      return { steamId, accountName: u.AccountName || '', personaName: u.PersonaName || '' };
    }
  }
  return null;
}

/** Best-effort set of owned app ids from the user's localconfig.vdf (apps the client knows about). */
export function knownAppIds(home, steamId) {
  const ids = new Set();
  const dir = path.join(steamRoot(home), 'userdata');
  const candidates = steamId ? [accountIdFromSteam64(steamId), steamId] : safeReaddir(dir);
  for (const id of candidates) {
    const v = readVdf(path.join(dir, String(id), 'config', 'localconfig.vdf'));
    const apps = v?.UserLocalConfigStore?.Software?.Valve?.Steam?.apps || v?.UserLocalConfigStore?.Software?.Valve?.Steam?.Apps;
    if (apps) for (const k of Object.keys(apps)) ids.add(k);
  }
  return ids;
}

function accountIdFromSteam64(steamId) {
  try { return (BigInt(steamId) - 76561197960265728n).toString(); } catch { return steamId; }
}
function safeReaddir(d) { try { return fs.readdirSync(d); } catch { return []; } }

/** Install state of an app in the room's default library. */
export function installState(home, appid) {
  const v = readVdf(path.join(steamRoot(home), 'steamapps', `appmanifest_${appid}.acf`));
  const s = v?.AppState;
  if (!s) return { present: false, installed: false, stateFlags: null };
  const flags = Number(s.StateFlags || 0);
  return { present: true, installed: flags === 4, stateFlags: flags, bytesToDownload: Number(s.BytesToDownload || 0), bytesDownloaded: Number(s.BytesDownloaded || 0), installdir: s.installdir, name: s.name };
}

export function libraryView(home) {
  const user = loggedInUser(home);
  const known = user ? knownAppIds(home, user.steamId) : new Set();
  return Object.entries(SUPPORTED_GAMES).map(([key, g]) => ({
    key, appid: g.appid, name: g.name, supported: true,
    owned: known.size ? known.has(g.appid) : null, // null = unknown (not logged in / no localconfig yet)
    install: installState(home, g.appid),
  }));
}
