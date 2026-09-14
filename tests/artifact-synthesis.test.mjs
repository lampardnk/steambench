import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeArtifact } from '../server/lib/learning-artifact.mjs';
import { VERSION, digest } from '../client/learning/state.mjs';
import { roleForCandidateAgent, synthesisContext, validateSynthesis, verifiedLearningCandidates } from '../client/learning/artifact-synthesis.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'steambench-artifact-synthesis-'));
  const scratchpad = path.join(root, 'scratchpad');
  fs.mkdirSync(scratchpad, { recursive: true });
  initializeArtifact(root, 'Operator input.\n');
  return { root, scratchpad };
}

function candidate(build, overrides = {}) {
  const text = overrides.text || 'Use verified live state before committing an irreversible action.';
  return {
    id: overrides.id || digest(text), version: VERSION, compatibility: build,
    status: 'candidate', agent: 'strategist', text, decision: 4,
    verifiedActions: [{ action: { type: 'choose_map_node' }, verified: true, barrier: 'replan' }],
    ...overrides,
  };
}

test('final synthesis receives only candidates backed by fully verified compatible batches', () => {
  const { root, scratchpad } = fixture();
  const build = { game: 'game', mod: 'mod', policy: 'policy' };
  const rows = [
    candidate(build, { id: 'accepted' }),
    candidate(build, { id: 'execution-error', error: 'stale' }),
    candidate(build, { id: 'unverified', verifiedActions: [{ action: { type: 'proceed' }, verified: false }] }),
    candidate(build, { id: 'partial', verifiedActions: [{ action: { type: 'proceed' }, verified: true }, { action: { type: 'end_turn' }, verified: false }] }),
    candidate(build, { id: 'wrong-status', status: 'accepted' }),
    candidate(build, { id: 'too-long', text: 'x'.repeat(601) }),
    candidate({ ...build, policy: 'other' }, { id: 'wrong-build' }),
    candidate(build, { id: 'wrong-version', version: 'old' }),
  ];
  fs.writeFileSync(path.join(scratchpad, 'candidates.jsonl'), rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const verified = verifiedLearningCandidates(scratchpad, build);
  assert.deepEqual(verified.map(item => item.id), ['accepted']);
  assert.deepEqual(verified[0].verified_actions, [{ type: 'choose_map_node', verified: true, barrier: 'replan' }]);
  assert.equal(synthesisContext(root, verified).current_learning_artifact, 'Operator input.\n');
});

test('synthesis edits must cite verified candidates owned by the attributed agent', () => {
  const candidates = [
    { id: 's1', agent: 'strategist' },
    { id: 'c1', agent: 'combat-001-a1f2' },
  ];
  const edits = validateSynthesis({ edits: [
    { agent: 'strategist', candidate_ids: ['s1'], message: 'Verified routing lesson', content: 'Re-read the live map after every route mutation.' },
    { agent: 'combat-001-a1f2', candidate_ids: ['c1'], message: 'Verified combat lesson', content: 'Use observed intents and current resources for each turn.' },
  ] }, candidates);
  assert.deepEqual(edits.map(edit => [edit.agent, edit.candidateIds]), [['strategist', ['s1']], ['combat-001-a1f2', ['c1']]]);
  assert.equal(roleForCandidateAgent('combat-001-a1f2'), 'combat');
  assert.throws(() => validateSynthesis({ edits: [{ agent: 'strategist', candidate_ids: ['c1'], message: 'Wrong owner', content: 'text' }] }, candidates), /invalid candidate attribution/);
  assert.throws(() => validateSynthesis({ edits: [{ agent: 'strategist', candidate_ids: ['missing'], message: 'Unknown source', content: 'text' }] }, candidates), /invalid candidate attribution/);
});

test('the mandatory synthesis attempt occurs before room-finish and is failure-isolated', () => {
  const source = fs.readFileSync(new URL('../client/learning/player.mjs', import.meta.url), 'utf8');
  const call = source.indexOf('await finalizeLearningArtifact().catch');
  const finish = source.indexOf("gateway.call({ op: 'room-finish'");
  assert.ok(call > 0 && finish > call, 'artifact synthesis must be attempted before room-finish');
  assert.match(source.slice(call, finish), /Learning artifact synthesis failed safely/);
});
