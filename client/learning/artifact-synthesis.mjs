import fs from 'node:fs';
import path from 'node:path';
import { MAX_LEARNING_EDIT, MAX_LEARNING_MESSAGE, readArtifact } from '../../server/lib/learning-artifact.mjs';
import { VERSION, digest } from './state.mjs';

const MAX_CANDIDATE_FILE_BYTES = 16 * 1024 * 1024;
const MAX_CANDIDATES = 256;
const MAX_CANDIDATE_TEXT_BYTES = 128 * 1024;
const MAX_SYNTHESIS_EDITS = 32;

function candidateFile(directory) {
  return path.join(directory, 'candidates.jsonl');
}

function sameCompatibility(candidate, build) {
  return candidate?.version === VERSION && build && digest(candidate.compatibility) === digest(build);
}

function fullyVerified(candidate) {
  return !candidate?.error && Array.isArray(candidate?.verifiedActions) && candidate.verifiedActions.length > 0
    && candidate.verifiedActions.every(item => item?.verified === true);
}

/**
 * Return only model-authored candidates whose associated action batch reached
 * verified postconditions. The runtime makes no strategic judgment here: it
 * enforces provenance and bounds, then lets the synthesis model decide what is
 * reusable and seed-independent.
 */
export function verifiedLearningCandidates(directory, build) {
  const file = candidateFile(directory);
  if (!fs.existsSync(file)) return [];
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > MAX_CANDIDATE_FILE_BYTES) throw new Error('learning candidate log exceeds its synthesis bound');

  const parsed = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  const seen = new Set();
  const candidates = [];
  let textBytes = 0;
  for (const candidate of parsed) {
    const text = typeof candidate.text === 'string' ? candidate.text.trim() : '';
    const agent = typeof candidate.agent === 'string' ? candidate.agent.trim() : '';
    const id = typeof candidate.id === 'string' ? candidate.id : '';
    if (candidate.status !== 'candidate' || !id || !agent || !text || text.length > 600
        || !sameCompatibility(candidate, build) || !fullyVerified(candidate)) continue;
    const identity = `${id}:${agent}`;
    if (seen.has(identity)) continue;
    const bytes = Buffer.byteLength(text, 'utf8');
    if (candidates.length >= MAX_CANDIDATES || textBytes + bytes > MAX_CANDIDATE_TEXT_BYTES) break;
    seen.add(identity);
    textBytes += bytes;
    candidates.push({
      id,
      agent: agent.slice(0, 120),
      decision: Number.isInteger(candidate.decision) ? candidate.decision : null,
      text,
      verified_actions: candidate.verifiedActions.map(item => ({
        type: item?.action?.type || null,
        verified: true,
        barrier: typeof item?.barrier === 'string' ? item.barrier.slice(0, 200) : null,
      })),
    });
  }
  return candidates;
}

export function synthesisContext(skillDir, candidates) {
  return {
    current_learning_artifact: readArtifact(skillDir),
    verified_candidates: candidates,
  };
}

/** Validate source attribution and output bounds before any artifact write. */
export function validateSynthesis(answer, candidates) {
  if (!answer || !Array.isArray(answer.edits)) throw new Error('artifact synthesis must return an edits array');
  if (answer.edits.length > MAX_SYNTHESIS_EDITS) throw new Error(`artifact synthesis may return at most ${MAX_SYNTHESIS_EDITS} edits`);
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const used = new Set();
  return answer.edits.map((edit, index) => {
    const agent = typeof edit?.agent === 'string' ? edit.agent.trim() : '';
    const message = typeof edit?.message === 'string' ? edit.message.trim() : '';
    const content = typeof edit?.content === 'string' ? edit.content.trim() : '';
    const ids = Array.isArray(edit?.candidate_ids) ? [...new Set(edit.candidate_ids)] : [];
    if (!agent || !content || message.length < 3 || message.length > MAX_LEARNING_MESSAGE || Buffer.byteLength(content, 'utf8') > MAX_LEARNING_EDIT || ids.length === 0) {
      throw new Error(`artifact synthesis edit ${index + 1} has invalid agent, sources, message or content`);
    }
    for (const id of ids) {
      const candidate = byId.get(id);
      if (!candidate || candidate.agent !== agent || used.has(id)) throw new Error(`artifact synthesis edit ${index + 1} has invalid candidate attribution`);
      used.add(id);
    }
    return { agent, message, content, candidateIds: ids };
  });
}

export function roleForCandidateAgent(agent) {
  if (agent === 'strategist') return 'strategist';
  if (/^combat-/.test(agent)) return 'combat';
  return 'synthesis';
}
