import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The one writable learning document a room owns.  The strategy tree is a
 * read-only baseline; this file is deliberately outside that tree's durable
 * notes so a room can never silently change what a later room inherits.
 */
export const LEARNING_ARTIFACT = 'learning.md';
export const LEARNING_EDITS = 'learning-edits.jsonl';
export const MAX_LEARNING_ARTIFACT = 64 * 1024;
export const MAX_LEARNING_EDIT = 8 * 1024;
export const MAX_LEARNING_MESSAGE = 200;
export const MAX_LEARNING_DIFF = 16 * 1024;
const utf8Bytes = value => Buffer.byteLength(String(value), 'utf8');

export function artifactFile(skillDir) {
  if (!skillDir) return null;
  return path.join(path.resolve(skillDir), LEARNING_ARTIFACT);
}

export function editsFile(skillDir) {
  if (!skillDir) return null;
  return path.join(path.resolve(skillDir), 'scratchpad', LEARNING_EDITS);
}

export function hashArtifact(content = '') {
  return crypto.createHash('sha256').update(String(content)).digest('hex');
}

/** Read the artifact without turning a missing file into an error. */
export function readArtifact(skillDir) {
  const file = artifactFile(skillDir);
  if (!file || !fs.existsSync(file)) return '';
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_LEARNING_ARTIFACT) return '';
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, text, 'utf8');
  fs.renameSync(temporary, file);
}

/** Initialize a room's artifact exactly once, including an optional operator input. */
export function initializeArtifact(skillDir, input = '') {
  if (typeof input !== 'string') throw new Error('learning artifact input must be text');
  if (utf8Bytes(input) > MAX_LEARNING_ARTIFACT) throw new Error(`learning artifact input must be at most ${MAX_LEARNING_ARTIFACT} UTF-8 bytes`);
  const file = artifactFile(skillDir);
  if (!file) throw new Error('learning artifact has no room directory');
  atomicWrite(file, input);
  return { path: LEARNING_ARTIFACT, content: input, hash: hashArtifact(input), bytes: Buffer.byteLength(input) };
}

function lines(text) {
  return String(text).split(/\r?\n/);
}

/**
 * Small, bounded line diff used in the room report and each edit record.  It is
 * intentionally not a patch applier: hashes and the resulting artifact are the
 * source of truth, while this is a readable explanation of the change.
 */
export function unifiedArtifactDiff(before = '', after = '', maximum = MAX_LEARNING_DIFF) {
  if (before === after) return '';
  const oldLines = lines(before);
  const newLines = lines(after);
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
  let suffix = 0;
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix
      && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix++;
  const oldStart = Math.max(0, prefix - 2);
  const newStart = Math.max(0, prefix - 2);
  const oldEnd = Math.min(oldLines.length - suffix + 2, oldLines.length);
  const newEnd = Math.min(newLines.length - suffix + 2, newLines.length);
  const patch = [
    `--- a/${LEARNING_ARTIFACT}`,
    `+++ b/${LEARNING_ARTIFACT}`,
    `@@ -${oldStart + 1},${Math.max(0, oldEnd - oldStart)} +${newStart + 1},${Math.max(0, newEnd - newStart)} @@`,
    ...oldLines.slice(oldStart, prefix).map(line => ` ${line}`),
    ...oldLines.slice(prefix, oldLines.length - suffix).map(line => `-${line}`),
    ...newLines.slice(prefix, newLines.length - suffix).map(line => `+${line}`),
    ...oldLines.slice(oldLines.length - suffix, oldEnd).map(line => ` ${line}`),
  ].join('\n') + '\n';
  return patch.length > maximum ? `${patch.slice(0, maximum)}\n[… diff truncated …]\n` : patch;
}

function editId({ at, agent, decision, afterHash }) {
  return hashArtifact(JSON.stringify({ at, agent, decision, afterHash })).slice(0, 16);
}

/**
 * Append one durable, seed-independent learning entry.  The operation is
 * append-only so a late combat lane cannot overwrite an earlier strategist or
 * operator entry.  The sidecar is run-local telemetry, not another learning
 * artifact, and records who changed the document and the exact before/after
 * hashes.
 */
export function appendArtifactEdit(skillDir, {
  content, message, agent = 'unknown', lane = null, role = null, decision = null,
  at = Date.now(), sourcePath = null, sourceCandidates = [], synthesizedBy = null,
} = {}) {
  if (typeof content !== 'string' || !content.trim() || utf8Bytes(content) > MAX_LEARNING_EDIT) throw new Error(`learning edit must be 1-${MAX_LEARNING_EDIT} UTF-8 bytes`);
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_LEARNING_MESSAGE) throw new Error(`learning edit message must be 1-${MAX_LEARNING_MESSAGE} characters`);
  const file = artifactFile(skillDir);
  if (!file) throw new Error('learning artifact has no room directory');
  const before = readArtifact(skillDir);
  const heading = `## ${message.trim()}`;
  // Legacy planners supplied a proposed guide path. Keep it as a non-semantic
  // comment for traceability while still writing only this one artifact.
  const provenance = sourcePath ? `\n<!-- proposed guide path: ${sourcePath} -->` : '';
  const entry = `${heading}${provenance}\n\n${content.trim()}\n`;
  const after = before.trim() ? `${before.replace(/\s+$/, '')}\n\n${entry}` : `${entry}`;
  if (utf8Bytes(after) > MAX_LEARNING_ARTIFACT) throw new Error(`learning artifact would exceed ${MAX_LEARNING_ARTIFACT} UTF-8 bytes`);
  atomicWrite(file, after);
  const beforeHash = hashArtifact(before);
  const afterHash = hashArtifact(after);
  const actor = String(agent || lane || 'unknown').slice(0, 120);
  const editLane = String(lane || agent || 'unknown').slice(0, 120);
  const candidateIds = Array.isArray(sourceCandidates)
    ? [...new Set(sourceCandidates.filter(id => typeof id === 'string' && id.length <= 128))].slice(0, 256)
    : [];
  const synthesizer = synthesizedBy ? String(synthesizedBy).slice(0, 120) : null;
  const edit = {
    id: editId({ at, agent: actor, lane: editLane, decision, afterHash }),
    at, agent: actor, lane: editLane, role: role ? String(role).slice(0, 40) : null,
    decision: Number.isInteger(decision) ? decision : null,
    message: message.trim().slice(0, MAX_LEARNING_MESSAGE),
    sourcePath: sourcePath || null,
    ...(candidateIds.length ? { sourceCandidates: candidateIds } : {}),
    ...(synthesizer ? { synthesizedBy: synthesizer } : {}),
    operation: 'append',
    artifact: LEARNING_ARTIFACT,
    beforeHash, afterHash,
    bytesBefore: Buffer.byteLength(before), bytesAfter: Buffer.byteLength(after),
    patch: unifiedArtifactDiff(before, after),
  };
  const log = editsFile(skillDir);
  fs.mkdirSync(path.dirname(log), { recursive: true });
  fs.appendFileSync(log, JSON.stringify(edit) + '\n', 'utf8');
  return { ...edit, content: after };
}

export function readArtifactEdits(skillDir) {
  const file = editsFile(skillDir);
  if (!file || !fs.existsSync(file)) return [];
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/** Build the clear input/output/edit report used by both live and archived APIs. */
export function artifactReport(skillDir, { input = '', includeContent = true, includeEdits = true, includeDiff = true } = {}) {
  const output = readArtifact(skillDir);
  const edits = readArtifactEdits(skillDir);
  const report = {
    path: LEARNING_ARTIFACT,
    input: { provided: Boolean(String(input).length), hash: hashArtifact(input), bytes: Buffer.byteLength(String(input)) },
    output: { hash: hashArtifact(output), bytes: Buffer.byteLength(output), edits: edits.length },
    ...(includeEdits ? { edits } : {}),
    ...(includeDiff ? { diff: unifiedArtifactDiff(input, output) } : {}),
  };
  if (includeContent) {
    report.input.content = String(input);
    report.output.content = output;
  }
  return report;
}
