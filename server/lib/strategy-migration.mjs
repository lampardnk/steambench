import fs from 'node:fs';
import path from 'node:path';

export const DIARY_PATH = /(?:^|[/_-])(?:floor|round|turn|decision|seed)-?\d/i;
const destinations = { bestiary: 'act1/normal', pools: 'meta_strategy/map', problems: 'meta_strategy/playbook', strategy: 'meta_strategy/playbook', events: 'act1/unknown', setups: 'meta_strategy/deck_archetypes' };

/** Versioned, additive migration. Removed paths cannot be seeded back by an old template. */
export function migrateStrategy(root, skill) {
  const base = path.join(root, skill);
  if (!fs.existsSync(base)) return;
  const marker = path.join(base, '.strategy-version');
  const router = path.join(base, 'SKILL.md');
  if (!fs.existsSync(marker) && fs.existsSync(router)) {
    const content = fs.readFileSync(router, 'utf8');
    if (/learned\/|wiki\/|sts2_state|sts2_wiki/.test(content)) fs.unlinkSync(router);
  }
  const audit = path.join(root, '.objectives', skill);
  const oldLedger = path.join(base, 'learned/curriculum.json');
  if (fs.existsSync(oldLedger)) {
    fs.mkdirSync(audit, { recursive: true });
    const destination = path.join(audit, 'history.json');
    const incoming = JSON.parse(fs.readFileSync(oldLedger, 'utf8'));
    let existing = { objectives: [] };
    try { existing = JSON.parse(fs.readFileSync(destination, 'utf8')); } catch { }
    const byId = new Map((existing.objectives || []).map(item => [item.id, item]));
    for (const item of incoming.objectives || []) if (!byId.has(item.id)) byId.set(item.id, item);
    fs.writeFileSync(destination, JSON.stringify({ version: 1, objectives: [...byId.values()] }, null, 2));
  }
  const move = (source, relative) => {
    if (!fs.existsSync(source)) return;
    if (fs.statSync(source).isDirectory()) {
      for (const name of fs.readdirSync(source)) move(path.join(source, name), `${relative}/${name}`);
      return;
    }
    if (!relative.endsWith('.md') || /(?:^|\/)README\.md$/i.test(relative) || DIARY_PATH.test(relative)) return;
    let target;
    if (relative.startsWith('learned/')) {
      const [, area, ...rest] = relative.split('/');
      if (!destinations[area]) return;
      target = `ironclad/a1/${destinations[area]}/${rest.join('/').toLowerCase()}`;
    } else if (relative.startsWith('controls/')) return;
    else if (relative === 'wiki/BASICS.md') target = 'ironclad/a1/meta_strategy/mechanics/legacy-basics.md';
    else if (relative === 'wiki/CHARACTERS.md') target = 'characters/legacy-characters.md';
    else return; // old provider/tool scaffolding is intentionally retired
    const dest = path.join(base, target);
    let content = fs.readFileSync(source, 'utf8');
    if (!content.startsWith('---\n')) content = `---\ndescription: Migrated ${path.basename(target, '.md')} observations; verify against live state\nkeys: ${path.basename(target, '.md').replaceAll('-', ', ')}\n---\n\n${content}`;
    // Preserve collisions explicitly; never overwrite either independently authored note.
    if (fs.existsSync(dest) && fs.readFileSync(dest, 'utf8') !== content) {
      const legacy = dest.replace(/\.md$/, '-legacy.md');
      fs.mkdirSync(path.dirname(legacy), { recursive: true });
      if (!fs.existsSync(legacy)) fs.writeFileSync(legacy, content);
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content);
    }
  };
  for (const old of ['learned', 'controls', 'wiki']) {
    move(path.join(base, old), old);
    fs.rmSync(path.join(base, old), { recursive: true, force: true });
  }
  // Historical diary files sometimes already lived outside learned/.
  const prune = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'scratchpad') prune(file);
      else if (entry.isFile() && DIARY_PATH.test(path.relative(base, file))) fs.unlinkSync(file);
    }
  };
  prune(base);
  fs.writeFileSync(path.join(base, '.strategy-version'), '3\n');
}
