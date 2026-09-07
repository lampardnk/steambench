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

export const MAX_RETRIEVED = 5;
export const RETRIEVAL_BUDGET = 6000;
const MAX_NOTE_IN_CONTEXT = 2500;
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'is', 'it', 'this', 'that', 'md', 'readme', 'learned', 'note', 'notes']);

const words = (text) => String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9'-]{1,}/g) || [];
const terms = (text) => words(text).filter(word => !STOP.has(word));

/** Front matter is optional: a note without it is still indexed by path and heading. */
export function parseNote(relative, text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  const head = {};
  if (match) {
    for (const line of match[1].split('\n')) {
      const pair = /^([a-z_]+):\s*(.*)$/i.exec(line.trim());
      if (pair) head[pair[1].toLowerCase()] = pair[2].trim();
    }
  }
  const body = match ? text.slice(match[0].length) : text;
  const heading = /^#\s+(.+)$/m.exec(body)?.[1] || '';
  const description = head.description || heading || relative;
  const declared = (head.keys || '').split(/[,;]/).map(key => key.trim().toLowerCase()).filter(Boolean);
  const area = relative.split('/')[0];
  return {
    path: relative,
    area,
    description: description.slice(0, 200),
    keys: declared,
    // Path segments are always keys: bestiary/wriggler.md is about a wriggler
    // whether or not anyone wrote front matter.
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
const MOMENT_IN_PATH = /(?:^|[/_-])(?:floor|round|turn|decision)-?\d/;

/** Index every learned note. Cheap enough to redo whenever a note is written. */
export function indexNotes(skillDir) {
  const base = path.join(skillDir || '', 'learned');
  const index = [];
  const walk = (relative) => {
    for (const entry of fs.readdirSync(path.join(base, relative), { withFileTypes: true })) {
      const next = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { walk(next); continue; }
      if (!entry.isFile() || !next.endsWith('.md') || /(^|\/)README\.md$/.test(next) || MOMENT_IN_PATH.test(next)) continue;
      try {
        const stat = fs.statSync(path.join(base, next));
        if (stat.size > 64000) continue;
        index.push({ ...parseNote(next, fs.readFileSync(path.join(base, next), 'utf8')), bytes: stat.size });
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
  for (const enemy of state?.battle?.enemies || []) add(SUBJECT, enemy.name);
  add(SUBJECT, state?.event?.name || state?.event?.event_name);
  const character = state?.run?.character || state?.player?.character;
  const ascension = state?.run?.ascension;
  add(SETUP, character);
  // setups/ironclad-a1 is the note folder for exactly this run.
  const short = terms(character).at(-1);
  if (short && ascension != null) weights.set(`${short}-a${ascension}`, SETUP);
  add(CONTEXT, state?.state_type);
  add(CONTEXT, state?.menu_screen);
  for (const relic of (state?.relics || []).slice(0, 12)) add(CONTEXT, relic.name);
  for (const card of (state?.player?.hand || []).slice(0, 12)) add(CONTEXT, card.name);
  add(CONTEXT, objective?.text);
  return { weights, area: objective?.area || null };
}

function score(note, { weights, area }) {
  let total = 0;
  const hits = new Set();
  for (const [term, weight] of weights) {
    const points = note.keys.includes(term) ? 3 : note.pathTerms.includes(term) ? 2 : note.descriptionTerms.includes(term) ? 1 : 0;
    if (!points) continue;
    total += weight * points;
    hits.add(term);
  }
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
export function retrieve(skillDir, index, state, objective, { limit = MAX_RETRIEVED, budget = RETRIEVAL_BUDGET } = {}) {
  const wanted = situationTerms(state, objective);
  if (!wanted.weights.size) return [];
  const ranked = index
    .map(note => ({ note, ...score(note, wanted) }))
    .filter(item => item.total > 0)
    .sort((a, b) => b.total - a.total || a.note.bytes - b.note.bytes)
    .slice(0, limit);
  const out = [];
  let spent = 0;
  for (const { note, total, hits } of ranked) {
    let content;
    try { content = fs.readFileSync(path.join(skillDir, 'learned', note.path), 'utf8'); }
    catch { continue; }
    const room = Math.max(0, Math.min(MAX_NOTE_IN_CONTEXT, budget - spent));
    if (room < 200) break;
    const truncated = content.length > room;
    out.push({ path: note.path, description: note.description, matched: hits.slice(0, 6), relevance: total, truncated, content: content.slice(0, room) });
    spent += Math.min(content.length, room);
  }
  return out;
}
