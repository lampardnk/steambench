import { migrateStrategy, DIARY_PATH } from './strategy-migration.mjs';
// Persistent skill library. A room used to get a throwaway copy of the skill
// template and lose everything it wrote when the room was deleted; only the
// separately reviewed accepted.json survived. The library is one git repository
// that outlives every room, so what the player learns accumulates and each
// room's contribution is readable as an ordinary commit.
//
// Layout: <runtimeDir>/learning/library/<skill>/ mirrors what a room mounts at
// /workspace/skills/<skill>/, minus scratchpad/, which is per-run state and is
// archived with the room instead.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const RUN_STATE = new Set(['scratchpad', '.git', '.objectives']);
const AUTHOR = 'steambench library <library@steambench.local>';
const MAX_DIFF = 200000;

export function libraryDir(cfg) { return path.join(cfg.runtimeDir, 'learning', 'library'); }

function git(dir, args, { timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile('git', ['-C', dir, '-c', 'core.quotepath=false', ...args], { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`git ${args[0]}: ${String(stderr || error.message).trim().slice(0, 400)}`));
      else resolve(stdout);
    });
  });
}

/** Copy a tree, skipping per-run state and git metadata. */
function copyKnowledge(from, to, { overwrite = true } = {}) {
  const copied = [];
  const walk = (relative) => {
    const source = path.join(from, relative);
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      if (RUN_STATE.has(entry.name) || (!relative && ['learned', 'controls', 'wiki'].includes(entry.name))) continue;
      const next = path.join(relative, entry.name);
      const target = path.join(to, next);
      if (entry.isDirectory()) { fs.mkdirSync(target, { recursive: true }); walk(next); continue; }
      if (!entry.isFile() || DIARY_PATH.test(next)) continue;
      if (!overwrite && fs.existsSync(target)) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(from, next), target);
      copied.push(next);
    }
  };
  fs.mkdirSync(to, { recursive: true });
  walk('');
  return copied;
}

/**
 * Create the repository if it is missing and seed a skill from the image
 * template. Template files are only ever *added*: a later image must not
 * silently overwrite what the player has since written.
 */
export async function ensureSkill(cfg, skill, templateDir) {
  const root = libraryDir(cfg);
  const target = path.join(root, skill);
  fs.mkdirSync(root, { recursive: true });
  const fresh = !fs.existsSync(path.join(root, '.git'));
  if (fresh) {
    await git(root, ['init', '--quiet', '--initial-branch=main']);
    fs.writeFileSync(path.join(root, '.gitignore'), 'scratchpad/\n');
    fs.writeFileSync(path.join(root, 'README.md'), README);
  }
  await renameLegacy(root, skill);
  const seeded = !fs.existsSync(target);
  if (skill === 'sts2') migrateStrategy(root, skill);
  const added = fs.existsSync(templateDir) ? copyKnowledge(templateDir, target, { overwrite: false }) : [];
  const message = seeded ? `Seed ${skill} from the image template` : `Add ${added.length} new ${skill} template file(s)`;
  const commit = await commit_(root, message, { skill });
  return { dir: target, seeded, added, commit };
}

/**
 * The learning player used to have its own `<skill>-astra` tree. There is one
 * skill per game now, so an existing library is renamed in place rather than
 * left behind: `git mv` keeps every note and the history that produced it.
 */
async function renameLegacy(root, skill) {
  const legacy = `${skill}-astra`;
  if (skill.endsWith('-astra') || !fs.existsSync(path.join(root, legacy))) return null;
  if (fs.existsSync(path.join(root, skill))) {
    // Both trees exist, so a rename would collide. Fold the legacy notes in as
    // additions and leave the old tree alone for a human to look at.
    if (skill === 'sts2') migrateStrategy(root, legacy);
    copyKnowledge(path.join(root, legacy), path.join(root, skill), { overwrite: false });
    fs.rmSync(path.join(root, legacy), { recursive: true, force: true });
    return commit_(root, `Copy ${legacy} notes into ${skill}`, { skill });
  }
  await git(root, ['mv', legacy, skill]);
  return commit_(root, `Rename ${legacy} to ${skill}: one skill per game`, { skill });
}

/** Give a room its own writable copy of the library's current knowledge. */
export function checkoutInto(cfg, skill, targetDir) {
  const source = path.join(libraryDir(cfg), skill);
  if (!fs.existsSync(source)) throw new Error(`skill library ${skill} has not been created yet`);
  const copied = copyKnowledge(source, targetDir);
  const audit = path.join(libraryDir(cfg), '.objectives', skill, 'history.json');
  if (fs.existsSync(audit)) {
    fs.mkdirSync(path.join(targetDir, 'scratchpad'), { recursive: true });
    fs.copyFileSync(audit, path.join(targetDir, 'scratchpad', 'objectives.json'));
  }
  return copied;
}

async function commit_(root, message, { skill, roomId, player } = {}) {
  await git(root, ['add', '-A']);
  const staged = await git(root, ['status', '--porcelain']);
  if (!staged.trim()) return null;
  const trailer = [skill ? `Skill: ${skill}` : null, roomId ? `Room: ${roomId}` : null, player ? `Player: ${player}` : null].filter(Boolean).join('\n');
  await git(root, ['-c', `user.name=${player || 'steambench library'}`, '-c', 'user.email=library@steambench.local',
    'commit', '--quiet', '--author', player ? `${player} <player@steambench.local>` : AUTHOR,
    '-m', message.slice(0, 200), ...(trailer ? ['-m', trailer] : [])]);
  const hash = (await git(root, ['rev-parse', 'HEAD'])).trim();
  return hash.slice(0, 10);
}

/**
 * Fold a room's knowledge edits back into the library. Per-run scratchpad state
 * stays with the room's archive; only files the player meant to keep land here.
 */
export async function commitFromRoom(cfg, { skill, roomSkillDir, roomId, player, message }) {
  const root = libraryDir(cfg);
  const target = path.join(root, skill);
  if (!fs.existsSync(path.join(root, '.git')) || !fs.existsSync(roomSkillDir)) return null;
  copyKnowledge(roomSkillDir, target);
  const audit = path.join(roomSkillDir, 'scratchpad', 'objectives.json');
  if (fs.existsSync(audit)) {
    const dest = path.join(root, '.objectives', skill, 'history.json');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    let prior = { objectives: [] };
    try { prior = JSON.parse(fs.readFileSync(dest, 'utf8')); } catch { }
    const fresh = JSON.parse(fs.readFileSync(audit, 'utf8'));
    const items = new Map((prior.objectives || []).map(item => [item.id, item]));
    for (const item of fresh.objectives || []) {
      const old = items.get(item.id);
      if (!old || (item.closed?.at || item.opened?.at || 0) >= (old.closed?.at || old.opened?.at || 0)) items.set(item.id, item);
    }
    fs.writeFileSync(dest, JSON.stringify({ ...fresh, objectives: [...items.values()] }, null, 2));
  }
  return commit_(root, message, { skill, roomId, player });
}

/** Commit history, newest first, with the files each commit touched. */
export async function history(cfg, { limit = 10, offset = 0, skill } = {}) {
  const root = libraryDir(cfg);
  if (!fs.existsSync(path.join(root, '.git'))) return [];
  const bounded = Math.min(Math.max(Number(limit) || 10, 1), 100);
  // Trailers span several lines, so every field ends with a unit separator and
  // the name-status listing is simply whatever follows the last one.
  const format = '%H%x1f%an%x1f%aI%x1f%s%x1f%b%x1f';
  const out = await git(root, ['log', `--skip=${Math.min(100000, Math.max(0, Math.trunc(Number(offset) || 0)))}`, `--max-count=${bounded}`, `--pretty=format:%x1e${format}`, '--name-status', ...(skill ? ['--', skill] : [])]);
  return out.split('\x1e').filter(entry => entry.trim()).map(entry => {
    const [hash, author, at, subject, body, rest = ''] = entry.replace(/^\n+/, '').split('\x1f');
    const files = rest.split('\n').filter(Boolean).map(line => {
      const [status, ...names] = line.split('\t');
      return { status: status[0], path: names[names.length - 1] };
    });
    const trailers = Object.fromEntries((body || '').split('\n').map(line => line.split(/:\s*/, 2)).filter(pair => pair.length === 2));
    return { hash: hash.slice(0, 10), author, at, subject, files, room: trailers.Room || null, skill: trailers.Skill || null };
  });
}

/** One commit's unified diff, bounded so a large paste cannot flood the page. */
export async function diff(cfg, hash) {
  if (!/^[0-9a-f]{4,40}$/.test(String(hash || ''))) throw new Error('invalid commit');
  const root = libraryDir(cfg);
  const text = await git(root, ['show', '--patch', '--stat', '--format=%H%n%an%n%aI%n%s%n%b', hash]);
  return { hash: String(hash), truncated: text.length > MAX_DIFF, patch: text.slice(0, MAX_DIFF) };
}

/** The library's current files, for browsing what the next room will inherit. */
export function tree(cfg, skill) {
  const base = path.join(libraryDir(cfg), skill);
  const files = [];
  const walk = (relative) => {
    const dir = path.join(base, relative);
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (RUN_STATE.has(entry.name)) continue;
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (entry.isFile()) files.push({ path: next, bytes: fs.statSync(path.join(base, next)).size });
    }
  };
  walk('');
  return files;
}

export function readFile(cfg, skill, relative) {
  const base = path.join(libraryDir(cfg), skill);
  const target = path.resolve(base, relative || '');
  if (!target.startsWith(base + path.sep) || relative.split(path.sep).some(part => RUN_STATE.has(part))) throw new Error('path is outside the skill library');
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error('no such file');
  if (fs.statSync(target).size > MAX_DIFF) throw new Error('file is too large to display');
  return fs.readFileSync(target, 'utf8');
}

const README = `# steambench skill library

One git repository holding what the players know, kept across rooms. A room
starts from this content and folds its edits back when it ends, so every change
is an ordinary commit you can read.

Per-run state (\`scratchpad/\`) is deliberately not stored here: it belongs to a
single run and is archived with that room.
`;


export function pagination(params = {}) {
  return { limit: Math.min(100, Math.max(1, Math.trunc(Number(params.limit) || 10))), offset: Math.min(100000, Math.max(0, Math.trunc(Number(params.offset) || 0))) };
}

export async function historyPage(cfg, params = {}) {
  const { limit, offset } = pagination(params);
  const commits = await history(cfg, { ...params, limit: limit + 1, offset });
  // Fetch a lookahead separately at the maximum page size.
  const hasMore = commits.length > limit || (limit === 100 && (await history(cfg, { ...params, limit: 1, offset: offset + limit })).length > 0);
  return { commits: commits.slice(0, limit), limit, offset, nextOffset: hasMore ? offset + limit : null };
}

export function objectivePage(file, params = {}) {
  const { limit, offset } = pagination(params);
  let ledger = { objectives: [] };
  try { ledger = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { }
  const status = params.status === 'failed' ? 'abandoned' : params.status;
  const items = (ledger.objectives || []).map(item => ({ ...item, status: item.status === 'failed' ? 'abandoned' : item.status }))
    .filter(item => item.status !== 'active' && (!status || status === 'all' || item.status === status))
    .sort((a, b) => (b.closed?.at || 0) - (a.closed?.at || 0));
  return { objectives: items.slice(offset, offset + limit), total: items.length, limit, offset, nextOffset: offset + limit < items.length ? offset + limit : null };
}
