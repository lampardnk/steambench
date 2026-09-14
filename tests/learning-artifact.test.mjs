import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  LEARNING_ARTIFACT,
  LEARNING_EDITS,
  appendArtifactEdit,
  artifactReport,
  hashArtifact,
  initializeArtifact,
  readArtifact,
  readArtifactEdits,
  MAX_LEARNING_ARTIFACT,
} from '../server/lib/learning-artifact.mjs';
import { Executor } from '../client/learning/executor.mjs';
import { noteProblem, stateId, validatePlan } from '../client/learning/state.mjs';

function roomDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'steambench-learning-artifact-'));
}

test('a room starts with one explicit artifact and records append edits by lane', () => {
  const dir = roomDir();
  initializeArtifact(dir, '');
  assert.equal(readArtifact(dir), '');

  const first = appendArtifactEdit(dir, { content: 'Prefer current live state over stale notes.', message: 'Live state first', agent: 'strategist', role: 'strategist', decision: 4, at: 100 });
  const second = appendArtifactEdit(dir, { content: 'End a turn only after checking intent and block.', message: 'Check intent before ending', agent: 'combat-001-a1f2', role: 'combat', decision: 9, at: 200 });

  assert.equal(first.artifact, LEARNING_ARTIFACT);
  assert.equal(first.beforeHash, hashArtifact(''));
  assert.equal(second.beforeHash, first.afterHash);
  assert.equal(readArtifactEdits(dir).length, 2);
  assert.match(readArtifact(dir), /Live state first/);
  assert.match(readArtifact(dir), /Check intent before ending/);
  assert.ok(fs.existsSync(path.join(dir, LEARNING_ARTIFACT)));
  assert.ok(fs.existsSync(path.join(dir, 'scratchpad', LEARNING_EDITS)));
  assert.equal(fs.readdirSync(dir).filter(name => name.endsWith('.md')).length, 1, 'edits never create per-note files');

  const report = artifactReport(dir, { input: '', includeContent: true });
  assert.equal(report.input.provided, false);
  assert.equal(report.output.edits, 2);
  assert.equal(report.output.content, readArtifact(dir));
  assert.match(report.diff, /\+.*Live state first/);
  assert.deepEqual(report.edits.map(edit => [edit.agent, edit.role, edit.decision]), [
    ['strategist', 'strategist', 4], ['combat-001-a1f2', 'combat', 9],
  ]);
});

test('artifact bounds count UTF-8 bytes and an unchanged artifact has no diff', () => {
  const dir = roomDir();
  assert.throws(() => initializeArtifact(dir, 'é'.repeat(MAX_LEARNING_ARTIFACT)), /UTF-8 bytes/);
  initializeArtifact(dir, 'same');
  assert.equal(artifactReport(dir, { input: 'same' }).diff, '');
});

test('operator input is preserved and a learn action writes only the room artifact', async () => {
  const dir = roomDir();
  initializeArtifact(dir, 'Operator rule: verify every mutation.\n');
  const state = { state_type: 'menu', menu_screen: 'main', options: ['singleplayer'], player: { hp: 80 } };
  const calls = [];
  const executor = new Executor({
    skillDir: dir,
    call: async (request) => {
      calls.push(request);
      if (request.op === 'sts2-get') return { body: JSON.stringify(state) };
      throw new Error(`unexpected ${request.op}`);
    },
  });
  executor.sleep = async () => {};
  const action = { type: 'learn', content: 'Use the fresh observation immediately before a semantic mutation.', message: 'Fresh observation gate' };
  const plan = { observation: stateId(state), summary: 'record reusable learning', note: 'fixture', actions: [action] };
  assert.equal(noteProblem(action), null);
  validatePlan(plan, state, { role: 'strategist' });
  const result = await executor.execute(plan, state, { agent: 'strategist', role: 'strategist', decision: 3 });
  assert.equal(result.error, undefined);
  assert.equal(result.completed[0].artifact, LEARNING_ARTIFACT);
  assert.equal(calls.filter(request => request.op === 'skill-commit').length, 0, 'learning does not auto-commit to the shared library');
  assert.match(readArtifact(dir), /Operator rule: verify every mutation/);
  assert.match(readArtifact(dir), /Fresh observation gate/);
  assert.equal(fs.readdirSync(dir).filter(name => name.endsWith('.md')).join(','), LEARNING_ARTIFACT);
});

test('legacy path metadata cannot escape the single artifact', async () => {
  const dir = roomDir();
  initializeArtifact(dir, '');
  const state = { state_type: 'menu', menu_screen: 'main', options: ['singleplayer'], player: { hp: 80 } };
  const calls = [];
  const executor = new Executor({ skillDir: dir, call: async request => { calls.push(request); if (request.op === 'sts2-get') return { body: JSON.stringify(state) }; throw new Error(`unexpected ${request.op}`); } });
  executor.sleep = async () => {};
  const action = { type: 'learn', path: 'ironclad/a1/meta_strategy/playbook/verification.md', content: '---\ndescription: verification\nkeys: verification\n---\nRead the live state.', message: 'Record verification' };
  const result = await executor.execute({ observation: stateId(state), summary: 'legacy fixture', note: 'fixture', actions: [action] }, state, { agent: 'combat-001-a1f2', role: 'combat', decision: 7 });
  assert.equal(result.error, undefined);
  assert.match(readArtifact(dir), /proposed guide path/);
  assert.ok(!fs.existsSync(path.join(dir, 'ironclad', 'a1', 'meta_strategy', 'playbook', 'verification.md')));
  assert.equal(calls.some(request => request.op === 'skill-commit'), false);
});
