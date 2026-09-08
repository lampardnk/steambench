// Skill retrieval.
//
// Voyager indexes each skill by the embedding of its description and pulls the
// top-5 for the current task. Without retrieval its performance plateaus: notes
// exist but nothing brings them back at the moment they matter.
//
// This player had the same plateau for a different reason. Its notes were
// listed by filename and could only be read by an explicit `recall`, which the
// planner had to remember to spend a decision on - so a note written in one
// room was rarely read in the next.
//
// The adaptation drops embeddings, which would need a second provider and a
// vector store for no gain here. The live situation is already structured: the
// mod names the enemies, the event, the screen, the character and the
// ascension. Matching those names against a note's declared keys is both
// cheaper and more precise than cosine similarity over prose, and it is
// deterministic, so the same screen always retrieves the same notes.
import fs from 'node:fs';
import path from 'node:path';

export const STAGED_NOTES = 'scratchpad.md';
export const MAX_RETRIEVED = 5;
export const RETRIEVAL_BUDGET = 32000;
// A note arrives the same size whether it was retrieved for the situation or
// recalled by name, so this matches executor's MAX_NOTE. The number comes from
// the corpus rather than a round guess: the act rosters a biome decision has to
// read whole are the largest notes there are (~12k), and they grow as entries
// are added. It stays at half the budget above, so one note still cannot fill
// the decision context on its own.
export const MAX_NOTE_IN_CONTEXT = 16000;
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'is', 'it', 'this', 'that', 'md', 'readme', 'learned', 'note', 'notes']);

const words = (text) => String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9'-]{1,}/g) || [];
const terms = (text) => words(text).filter(word => !STOP.has(word));

/** Front matter is optional: a note without it is still indexed by path and heading. */
export function parseNote(relative, text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  const head = {};
  if (match) {
    let folded = null;
    for (const line of match[1].split('\n')) {
      if (folded && /^\s+\S/.test(line)) {
        head[folded] += `${head[folded] ? ' ' : ''}${line.trim()}`;
        continue;
      }
      folded = null;
      const pair = /^([a-z_]+):\s*(.*)$/i.exec(line.trim());
      if (pair) {
        let val = pair[2].trim();
        if (/^[>|][-+]?$/.test(val)) {
          folded = pair[1].toLowerCase();
          head[folded] = '';
          continue;
        }
        if (val.startsWith('[') && val.endsWith(']')) {
          val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean).join(', ');
        }
        head[pair[1].toLowerCase()] = val;
      }
    }
  }
  const body = match ? text.slice(match[0].length) : text;
  const heading = /^#\s+(.+)$/m.exec(body)?.[1] || '';
  const description = head.description || head.summary || head.title || heading || relative;
  const rawKeys = [head.keys, head.tags, head.topic, head.category, head.character, head.act, head.ascension].filter(Boolean).join(', ');
  const declared = [...new Set(terms(rawKeys))];
  const parts = relative.split('/');
  const area = parts.length > 2 ? parts[2] : parts[0];
  return {
    path: relative,
    area,
    description: description.slice(0, 200),
    keys: declared,
    pathTerms: terms(relative.replace(/\.md$/, '').replace(/[/_-]/g, ' ')),
    descriptionTerms: terms(description),
    hasFrontMatter: Boolean(match),
  };
}

// Notes whose path names one moment of one run. New ones are refused when they
// are written, but a library can still hold older ones, and putting a diary of
// a seed nobody will play again in front of the planner is worse than putting
// nothing there. They stay on disk to be read or removed by hand; they are just
// never retrieved.
const MOMENT_IN_PATH = /(?:^|[/_-])(?:floor|round|turn|decision|seed)-?\d/;

/** Index every learned note. Cheap enough to redo whenever a note is written. */
export function indexNotes(skillDir) {
  const base = path.resolve(skillDir || '.');
  const index = [];
  const walk = (relative) => {
    for (const entry of fs.readdirSync(path.join(base, relative), { withFileTypes: true })) {
      const next = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { if (!['scratchpad', 'learned', '.git', '.objectives'].includes(entry.name)) walk(next); continue; }
      // scratchpad.md holds notes the player proposed but nobody has merged.
      // Indexing it would hand every later room exactly the unreviewed guesses
      // the staging file exists to keep out.
      if (next === STAGED_NOTES) continue;
      if (!entry.isFile() || !next.endsWith('.md') || MOMENT_IN_PATH.test(next)) continue;
      try {
        const stat = fs.statSync(path.join(base, next));
        if (stat.size > 64000) continue;
        const note = parseNote(next, fs.readFileSync(path.join(base, next), 'utf8'));
        if (/(^|\/)README\.md$/.test(next) && !note.hasFrontMatter) continue;
        index.push({ ...note, bytes: stat.size });
      } catch { /* a note that vanished mid-walk is simply not indexed */ }
    }
  };
  try { walk(''); } catch { return []; }
  return index;
}

/**
 * The names the current moment is about, with how specific each one is. The
 * enemy or event in front of the player identifies the moment; the character
 * and ascension identify the run and would otherwise drag the same setup notes
 * to the top of every screen.
 */
export function situationTerms(state, objective) {
  const weights = new Map();
  const add = (weight, text) => {
    for (const term of terms(text)) weights.set(term, Math.max(weights.get(term) || 0, weight));
  };
  const SUBJECT = 4;
  const SETUP = 2;
  const CONTEXT = 1;
  for (const enemy of state?.battle?.enemies || []) { add(8, enemy.name); for (const power of enemy.powers || []) add(5, `${power.name} ${power.description || ''}`); }
  for (const power of state?.player?.powers || []) add(5, `${power.name} ${power.description || ''}`);
  if (/neow/i.test(state?.event?.name || '')) add(6, 'neow route pools preparation');
  add(SUBJECT, state?.event?.name || state?.event?.event_name);
  const character = state?.run?.character || state?.player?.character;
  const ascension = state?.run?.ascension;
  add(SETUP, character);
  // setups/ironclad-a1 is the note folder for exactly this run.
  const short = terms(character).at(-1);
  if (short && ascension != null) weights.set(`${short}-a${ascension}`, SETUP);
  if (ascension != null) weights.set(`ascension-${ascension}`, SETUP);
  add(CONTEXT, state?.state_type);
  add(CONTEXT, state?.menu_screen);
  for (const relic of (state?.relics || []).slice(0, 12)) add(CONTEXT, relic.name);
  for (const card of (state?.player?.hand || []).slice(0, 12)) add(CONTEXT, card.name);
  add(CONTEXT, objective?.text);
  return { weights, area: objective?.area || null };
}

function score(note, { weights, area, generic = new Set() }) {
  let total = 0;
  const hits = new Set();
  let situational = false;
  for (const [term, weight] of weights) {
    const points = note.keys.includes(term) ? 3 : note.pathTerms.includes(term) ? 2 : note.descriptionTerms.includes(term) ? 1 : 0;
    if (!points) continue;
    total += weight * points;
    hits.add(term);
    if (!generic.has(term)) situational = true;
  }
  // Matching nothing but terms that match everything is not a match.
  if (!situational) return { total: 0, hits: [] };
  // A note about the area the objective is in is worth a nudge, never a match
  // on its own: an unrelated strategy note must not outrank the right enemy.
  if (area && note.area === area && total > 0) total += 1;
  return { total, hits: [...hits] };
}

/**
 * The notes worth putting in front of this decision. Returns their bodies,
 * bounded, so the planner reads what it knows without spending a decision on a
 * recall it has to remember to ask for.
 */
/**
 * A control note is what stops the same screen being re-derived every run, so on
 * a screen it comes first. NOT in a fight. Promoting it unconditionally handed
 * every slot to the UI: a control note carries the character and ascension in
 * its keys, which match any decision at all, so during a floor 7 elite fight the
 * five notes retrieved were about Neow bundles, the reward screen and the main
 * menu, and the bestiary note for the elite being fought never appeared. In
 * combat the enemy is the subject and ordinary relevance decides.
 */
const CONTROLS_NOTE = /(?:^|\/)controls\//;

/**
 * The controls notes, whatever the screen is.
 *
 * Retrieval scores a note against the terms the situation carries - enemy
 * names, the event, the character, the state type. CONTROLS.md carries none of
 * them, and it cannot: it is about the pad, not about any one screen. On the
 * Neow bundle screen the situation terms are "bundle" and "select", which
 * appear in no note's keys, so the one file describing how that screen works
 * scored zero and was never retrieved - and the actuator worked the screen
 * blind for fifty-five decisions and three supervisor pauses.
 *
 * Ranking control notes first (see retrieve) only reorders notes that already
 * matched. The pad's manual is not a match to be won; the pad always has it.
 */
export function controlManual(skillDir, index, { budget = MAX_NOTE_IN_CONTEXT } = {}) {
  const out = [];
  let spent = 0;
  for (const note of index.filter(item => CONTROLS_NOTE.test(item.path))) {
    let content;
    try { content = fs.readFileSync(path.join(skillDir, note.path), 'utf8'); }
    catch { continue; }
    const room = Math.max(0, budget - spent);
    if (room < 200) break;
    out.push({ path: note.path, description: note.description, matched: ['controls'], relevance: 0, truncated: content.length > room, content: content.slice(0, room) });
    spent += Math.min(content.length, room);
  }
  return out;
}

export function retrieve(skillDir, index, state, objective, { limit = MAX_RETRIEVED, budget = RETRIEVAL_BUDGET } = {}) {
  const wanted = situationTerms(state, objective);
  if (!wanted.weights.size) return [];
  const fighting = Boolean(state?.battle && Array.isArray(state?.player?.hand));
  const rank = item => (!fighting && CONTROLS_NOTE.test(item.note.path) ? 1 : 0);
  // A term carried by nearly every note identifies nothing. In a one-character
  // library every note is under ironclad/a1/ and says so in its keys, so
  // "ironclad" and "ascension-1" matched every decision ever made: during a
  // floor 7 elite fight the five notes retrieved were about Neow bundles, the
  // reward screen and the main menu. Such a term still weights a note that is
  // relevant for some other reason; it may not qualify one on its own. Measured
  // from the corpus rather than hardcoded, so it holds for whatever is in it.
  const matches = term => index.reduce((n, note) => n + (note.keys.includes(term) || note.pathTerms.includes(term) || note.descriptionTerms.includes(term) ? 1 : 0), 0);
  const generic = new Set([...wanted.weights.keys()].filter(term => index.length >= 3 && matches(term) > index.length / 2));
  const ranked = index
    .map(note => ({ note, ...score(note, { ...wanted, generic }) }))
    .filter(item => item.total > 0)
    .sort((a, b) => rank(b) - rank(a) || b.total - a.total || a.note.bytes - b.note.bytes)
    .slice(0, limit);
  const out = [];
  let spent = 0;
  for (const { note, total, hits } of ranked) {
    let content;
    try { content = fs.readFileSync(path.join(skillDir, note.path), 'utf8'); }
    catch { continue; }
    const room = Math.max(0, Math.min(MAX_NOTE_IN_CONTEXT, budget - spent));
    if (room < 200) break;
    const truncated = content.length > room;
    out.push({ path: note.path, description: note.description, matched: hits.slice(0, 6), relevance: total, truncated, content: content.slice(0, room) });
    spent += Math.min(content.length, room);
  }
  return out;
}
