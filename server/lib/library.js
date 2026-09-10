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
// The one path a room may add to the library: notes it proposes for review.
export const STAGED_NOTES = 'scratchpad.md';
const TEMPLATE_PATHS = '.template-paths.json';
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

/** Every file already under a skill tree, as template-relative paths. */
function listNotes(dir) {
  const found = [];
  const walk = (relative) => {
    const base = path.join(dir, relative);
    if (!fs.existsSync(base)) return;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (RUN_STATE.has(entry.name)) continue;
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (entry.isFile()) found.push(next);
    }
  };
  walk('');
  return found;
}

/** Copy a tree, skipping per-run state and git metadata. */
function copyKnowledge(from, to, { overwrite = true, includeProposals = true } = {}) {
  const copied = [];
  const walk = (relative) => {
    const source = path.join(from, relative);
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      if (RUN_STATE.has(entry.name) || entry.name === TEMPLATE_PATHS || (!relative && ['learned', 'controls', 'wiki'].includes(entry.name))) continue;
      const next = path.join(relative, entry.name);
      const target = path.join(to, next);
      if (entry.isDirectory()) { fs.mkdirSync(target, { recursive: true }); walk(next); continue; }
      if (!entry.isFile() || DIARY_PATH.test(next) || (!includeProposals && next === STAGED_NOTES)) continue;
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
 * A path the template has dropped is dropped here too.
 *
 * The sync only ever added and overwrote, so a note the template stopped
 * shipping stayed in the library forever. Moving `act1/unknown/tea-master.md`
 * to `meta_strategy/` therefore left the pre-move copy behind and retrieval
 * served both, the stale one carrying the very verdicts the move removed. The
 * template is the authority for what the library serves, which has to include
 * what it no longer serves.
 *
 * Exempt: the room's staged proposals, migration markers and other dotfiles,
 * and the legacy `learned`/`controls`/`wiki` trees that
 * `copyKnowledge` deliberately never writes - pruning those would delete notes
 * the template was never asked to provide.
 */
const PRESERVED = new Set([STAGED_NOTES]);
function preserved(file) {
  const [top] = file.split(path.sep);
  return PRESERVED.has(file) || top.startsWith('.') || ['learned', 'controls', 'wiki'].includes(top);
}

/** Drop directories the prune emptied, deepest first, never the repository. */
function pruneEmptyDirs(root) {
  const walk = (relative) => {
    const base = path.join(root, relative);
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory() || RUN_STATE.has(entry.name)) continue;
      const next = path.join(relative, entry.name);
      walk(next);
      if (!fs.readdirSync(path.join(root, next)).length) fs.rmdirSync(path.join(root, next));
    }
  };
  if (fs.existsSync(root)) walk('');
}

/** Create the repository if it is missing and seed a skill from the image
 * template, which is the authority for every path it provides.
 *
 * Template files used to be only ever *added*, so that a newer image could not
 * overwrite what the player had since written. The player can no longer write
 * the library at all - it stages proposals into scratchpad.md and a human
 * merges them - so that protection now only preserved staleness: a library
 * seeded once kept its first copy of every template file forever, which is how
 * it ended up serving a CONTROLS.md with no front matter and biome rosters
 * missing their wiki.gg corrections. Curate templates in the repo; anything the
 * template does not provide is left untouched.
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
  const before = new Set(listNotes(target));
  // Only paths previously supplied by the template can become stale template
  // files. A curated factual note outside that set must survive a refresh.
  // Older libraries have no manifest; their first refresh retains the previous
  // pruning behavior, then subsequent refreshes have explicit ownership.
  let previouslyShipped = before;
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(target, TEMPLATE_PATHS), 'utf8'));
    if (Array.isArray(saved) && saved.every(file => typeof file === 'string')) previouslyShipped = new Set(saved);
  } catch { }
  const copied = fs.existsSync(templateDir) ? copyKnowledge(templateDir, target) : [];
  const added = copied.filter(file => !before.has(file));
  const shipped = new Set(copied);
  const dropped = [...before].filter(file => previouslyShipped.has(file) && !shipped.has(file) && !preserved(file));
  for (const file of dropped) fs.rmSync(path.join(target, file), { force: true });
  if (dropped.length) pruneEmptyDirs(target);
  fs.writeFileSync(path.join(target, TEMPLATE_PATHS), JSON.stringify([...shipped].sort(), null, 2) + '\n');
  const message = seeded ? `Seed ${skill} from the image template`
    : `Sync ${skill} with the image template (${added.length} added, ${copied.length - added.length} refreshed, ${dropped.length} dropped)`;
  const commit = await commit_(root, message, { skill });
  return { dir: target, seeded, added, dropped, commit };
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
  const copied = copyKnowledge(source, targetDir, { includeProposals: false });
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
 * Fold a room's staged notes back into the library. The player proposes notes
 * into scratchpad.md for a human to merge; nothing else it wrote leaves the room,
 * so the library only ever changes when a person changes it.
 */
export async function commitFromRoom(cfg, { skill, roomSkillDir, roomId, player, message }) {
  const root = libraryDir(cfg);
  const target = path.join(root, skill);
  if (!fs.existsSync(path.join(root, '.git')) || !fs.existsSync(roomSkillDir)) return null;
  // The ONE thing a room contributes. It used to copy its whole tree back, which
  // made every note it wrote a library fact the next room inherited, and undid
  // any curation done while it ran: five diary notes deleted at 07:43 were
  // restored byte-identical at 07:52 under a message saying the room had
  // "learned" them. The player now proposes into scratchpad.md and a human
  // merges; nothing else it touches leaves the room.
  const staged = path.join(roomSkillDir, STAGED_NOTES);
  if (fs.existsSync(staged)) fs.copyFileSync(staged, path.join(target, STAGED_NOTES));
  // The objective ladder is per-room and stays with the room: its own scratchpad
  // holds it while it runs and the room archive keeps it afterwards. Merging every
  // room's objectives into one library-wide ledger gave each new room a frontier
  // from runs it never played, on seeds that no longer exist.
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

/**
 * The UI problems a run hit and what got it moving again.
 *
 * Every operator rescue is already on disk - the incident holds what the agent
 * could not do, the resolution holds the answer it was given - but they sat in
 * two files nobody reads. Paired and listed, they are the work list for the
 * control manual: anything here is something the agents could not resolve on
 * their own, and each one either belongs in CONTROLS.md or is a runtime bug.
 */
export function incidentPage(dir, params = {}) {
  const { limit, offset } = pagination(params);
  let resolutions = [];
  try {
    resolutions = fs.readFileSync(path.join(dir, 'incident-resolutions.jsonl'), 'utf8')
      .split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  } catch { }
  const items = resolutions.map(entry => {
    let incident = null;
    try { incident = JSON.parse(fs.readFileSync(path.join(dir, 'incidents', entry.issueId, 'incident.json'), 'utf8')); } catch { }
    return {
      id: entry.issueId,
      at: entry.at,
      via: entry.via || null,
      answer: entry.message || null,
      problem: incident?.error || null,
      decision: incident?.decision ?? null,
      agent: incident?.plan?.summary || null,
      screen: incident?.after?.state_type || incident?.before?.state_type || null,
      floor: incident?.after?.run?.floor ?? incident?.before?.run?.floor ?? null,
    };
  }).sort((a, b) => (b.at || 0) - (a.at || 0));
  return { incidents: items.slice(offset, offset + limit), total: items.length, limit, offset, nextOffset: offset + limit < items.length ? offset + limit : null };
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
