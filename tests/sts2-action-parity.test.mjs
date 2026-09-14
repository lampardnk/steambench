import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STS2_ACTION_SCHEMAS } from '../server/lib/sts2-actions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function pythonActionFields() {
  const host = path.join(root, 'host');
  const source = [
    'import json, sys',
    `sys.path.insert(0, ${JSON.stringify(host)})`,
    'import process_gateway',
    'print(json.dumps({name: sorted(schema) for name, schema in process_gateway.STS2_ACTION_SCHEMAS.items()}))',
  ].join('; ');
  return JSON.parse(execFileSync('python3', ['-c', source], { cwd: root, encoding: 'utf8' }));
}

test('legacy host gateway keeps the exact server STS2 action and field contract', () => {
  const serverFields = Object.fromEntries(Object.entries(STS2_ACTION_SCHEMAS).map(([name, schema]) => [name, Object.keys(schema).sort()]));
  assert.deepEqual(pythonActionFields(), serverFields);
  assert.deepEqual(serverFields.shop_back, []);
});
