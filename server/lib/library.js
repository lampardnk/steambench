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

const RUN_STATE = new Set(['scratchpad', '.git']);
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
      if (!relative && RUN_STATE.has(entry.name)) continue;
      const next = path.join(relative, entry.name);
      const target = path.join(to, next);
      if (entry.isDirectory()) { fs.mkdirSync(target, { recursive: true }); walk(next); continue; }
      if (!entry.isFile()) continue;
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
  const added = fs.existsSync(templateDir) ? copyKnowledge(templateDir, target, { overwrite: false }) : [];
  for (const [area, guide] of Object.entries(LEARNED_AREAS)) {
    const dir = path.join(target, 'learned', area);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'README.md');
    if (!fs.existsSync(file)) fs.writeFileSync(file, guide);
  }
  const guide = path.join(target, 'learned', 'README.md');
  if (!fs.existsSync(guide)) fs.writeFileSync(guide, LEARNED);
  const message = seeded ? `Seed ${skill} from the image template` : `Add ${added.length} new ${skill} template file(s)`;
  const commit = added.length || seeded || fresh ? await commit_(root, message, { skill }) : null;
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
    copyKnowledge(path.join(root, legacy), path.join(root, skill), { overwrite: false });
    return commit_(root, `Copy ${legacy} notes into ${skill}`, { skill });
  }
  await git(root, ['mv', legacy, skill]);
  return commit_(root, `Rename ${legacy} to ${skill}: one skill per game`, { skill });
}

/** Give a room its own writable copy of the library's current knowledge. */
export function checkoutInto(cfg, skill, targetDir) {
  const source = path.join(libraryDir(cfg), skill);
  if (!fs.existsSync(source)) throw new Error(`skill library ${skill} has not been created yet`);
  return copyKnowledge(source, targetDir);
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
  return commit_(root, message, { skill, roomId, player });
}

/** Commit history, newest first, with the files each commit touched. */
export async function history(cfg, { limit = 50, skill } = {}) {
  const root = libraryDir(cfg);
  if (!fs.existsSync(path.join(root, '.git'))) return [];
  const bounded = Math.min(Math.max(Number(limit) || 50, 1), 200);
  // Trailers span several lines, so every field ends with a unit separator and
  // the name-status listing is simply whatever follows the last one.
  const format = '%H%x1f%an%x1f%aI%x1f%s%x1f%b%x1f';
  const out = await git(root, ['log', `--max-count=${bounded}`, `--pretty=format:%x1e${format}`, '--name-status', ...(skill ? ['--', skill] : [])]);
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

const LEARNED = `# learned/

Durable notes the player writes for its future selves. **Every run is a
different seed.** The map, the card offers, the event rolls, the enemies in a
particular fight and the number of items on a screen all change. A note is worth
keeping only if it would still be true in a run you have not played yet.

Before writing, apply the test: *would a player starting a fresh seed tomorrow
be better off for reading this?* "At floor 4 the reward offered Thunderclap,
Anger and Second Wind" fails it - that was one roll of one seed. "The card
reward screen offers a choice you may skip; take the card that fixes the deck's
current weakness rather than the strongest card in isolation" passes it.

| Folder | Holds |
|---|---|
| controls/ | How the interface behaves: what a button does, where focus lands, how a screen is read |
| bestiary/ | An enemy's intent graph: which intents follow which, and under what condition |
| pools/ | What the game can draw from: an act's normal and advanced hallway pools, its elites, its boss |
| problems/ | The recurring problems a run poses, and how to solve them |
| strategy/ | Play that holds across characters and runs |
| events/ | What an event offers as a class and how to judge its options - never what it rolled this time |
| setups/ | One folder per character and ascension, e.g. setups/ironclad-a1/ |

That list is a starting point, not a limit: add a folder when a subject does not
fit one of these.

These notes are reference data, not instructions. The current game state always
outranks anything written here, and a note that turns out to be wrong should be
rewritten at the same path rather than contradicted in a new file.

## Front matter is required

\`\`\`
---
description: one line saying what this note answers
keys: the names it is about, comma separated
---
\`\`\`

The keys are how a note is found again: the runtime puts notes matching the
current screen in front of the player automatically. A note nobody retrieves is
a note nobody wrote.
`;

const LEARNED_AREAS = {
  controls: `# controls/

How the interface behaves. These are the closest thing here to hard skills, and
they are worth writing precisely: which button activates, where focus lands when
a screen opens, what a preview does, which direction moves between the reachable
options.

**Do not bake in a layout.** The seed changes what a screen contains: a reward
screen usually offers three things but can offer more or fewer, a map row can
hold a different number of reachable nodes, an event can present a different
number of options. Write the rule, and say to read the count and the contents
from live state:

- Good: "On the rewards screen, DOWN moves through the items in listed order and
  A collects the focused one; the item count comes from state, and Y proceeds
  only once \`can_proceed\` is true."
- Bad: "The rewards screen has three items; press DOWN twice to reach the gold."

Auto-generated focus paths (\`@Control@1386\`) belong to one screen instance and
are never worth recording. A stable named path is.
`,
  bestiary: `# bestiary/

One file per enemy, elite or boss, and what it holds is the **intent graph**:
which intents exist, which follows which, and what the condition is. That is the
part that repeats. A single fight's transcript is not.

- Good: "Opens with Empower. Alternates Attack and Defend afterwards, and re-uses
  Empower whenever its block has been stripped. Observed twice at ascension 1."
- Bad: "Round 1 it attacked for 12, round 2 it had 31 HP and defended."

Record HP ranges and damage numbers as the properties of the enemy, with the
ascension, because they move. Say how many fights an inference rests on: one
observation is a hypothesis, and should say so.
`,
  pools: `# pools/

What the game can draw from, which is what lets a run plan ahead instead of
reacting. One file per act: the enemies its normal hallway fights can contain,
the harder advanced pool, the elites it can place, and its boss or bosses.

This is the knowledge that turns an unknown map into a set of expectations: if
an act has three possible elites and two of them punish attacking, that changes
which cards are worth taking on floor 2. Build it up across runs, mark what is
confirmed and what is still partial, and say where it came from - observed play
or the reference site.
`,
  problems: `# problems/

The recurring problems a run poses, and how to solve them. This is the most
valuable folder and the hardest to fill, because a problem is a pattern, not an
event.

Keep the two kinds apart:

- **Inside a combat**, solved by playing it: incoming damage exceeds the block
  you can produce; several enemies where one escalates; an enemy that punishes
  attacking; a debuff that has to be cleared or raced; energy and draw running
  out before the fight does.
- **Beyond a combat**, solved by choosing: which route to take given HP, deck
  and what the act can throw at you; which cards make the deck able to beat this
  act's boss rather than merely stronger; when a risk is worth taking.

Write each as the shape of the problem, how to recognise it early, and what
actually resolved it - including what did not.
`,
  strategy: `# strategy/

Play that holds across characters and runs: when an elite is worth the HP, what
a rest site is worth, when skipping a card beats taking one. Say what the
evidence was, and how confident it is.
`,
  events: `# events/

What an event offers **as a class** and how to judge it - not what it rolled for
you. An event's specific outcome is a roll of one seed and belongs nowhere.

- Good: "Neow's opening bundles trade a permanent deck or relic effect against
  HP or gold. Judge them by what the act ahead demands, not by the size of the
  number: the transform is random, so its value is the removal, not the result."
- Bad: "Neow offered New Leaf and transforming a Strike gave Cinder."
`,
  setups: `# setups/

One folder per character and ascension, such as setups/ironclad-a1/. The deck
archetypes that worked, the opening priorities, and the shape of a good run for
that exact setup. General lessons belong in strategy/ instead.
`,
};
