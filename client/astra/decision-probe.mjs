// Isolated actual-Pi request audit. There is deliberately no executor or gateway.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { Planner } from './planner.mjs';
import { PROFILE } from './profile.mjs';
import { plannerState, stateId, validatePlan } from './state.mjs';
import { encounterReferences } from './references.mjs';

const { state, checkpoint } = JSON.parse(fs.readFileSync('/probe/context.json'));
const diagnostics = { requests: 0, providers: [], responseModels: [], gameplayInputs: 0 };
const proxy = http.createServer(async (request, response) => {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    const payload = JSON.parse(body);
    const imageCount = payload.messages.flatMap(message => Array.isArray(message.content) ? message.content : []).filter(part => part.type === 'image_url').length;
    diagnostics.requests++;
    assert.equal(diagnostics.requests, 1, 'no automatic request retries');
    assert.equal(payload.model, PROFILE.model);
    assert.equal(payload.reasoning?.effort, PROFILE.reasoning);
    assert.equal(imageCount, 1);
    assert.equal(payload.provider?.only, undefined);
    assert.equal(payload.provider?.order, undefined);
    assert.equal(payload.provider?.ignore, undefined);
    diagnostics.outgoing = { model: payload.model, reasoning: payload.reasoning, provider: payload.provider, imageCount, maxTokens: payload.max_tokens };
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { Authorization: request.headers.authorization, 'Content-Type': 'application/json' }, body,
      signal: AbortSignal.timeout(PROFILE.plannerDeadlineMs - 5000),
    });
    diagnostics.status = upstream.status;
    response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') });
    let pending = '';
    for await (const chunk of upstream.body) {
      response.write(chunk);
      pending += Buffer.from(chunk).toString();
      const lines = pending.split('\n');
      pending = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          for (const [key, value] of [['providers', event.provider], ['responseModels', event.model]]) {
            if (value && !diagnostics[key].includes(value)) diagnostics[key].push(value);
          }
        } catch { /* non-JSON keepalive */ }
      }
    }
    response.end();
  } catch (error) {
    diagnostics.proxyError = error.message;
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: { message: error.message } }));
  }
});
await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
const configFile = '/home/node/.pi/agent/models.json';
const config = JSON.parse(fs.readFileSync(configFile));
config.providers.openrouter.baseUrl = `http://127.0.0.1:${proxy.address().port}/v1`;
fs.writeFileSync(configFile, JSON.stringify(config));
const planner = new Planner({ emit: () => {}, record: event => { if (event.type === 'model_usage') diagnostics.usage = event; } });
try {
  const context = {
    task: checkpoint.taskText, fresh_run_verified: checkpoint.freshRunVerified,
    observation_id: stateId(state), state: plannerState(state, checkpoint.lastResult, checkpoint.strategy),
    strategy: checkpoint.strategy, last_result: checkpoint.lastResult, reference_data: encounterReferences(state),
    user_instructions: ['Choose a useful normal gameplay plan from this actual state. Actions are audited without execution.'],
  };
  const plan = validatePlan(await planner.decide(context, { data_base64: fs.readFileSync('/probe/frame.jpg').toString('base64') }), state);
  assert.equal(diagnostics.requests, 1);
  assert.equal(diagnostics.status, 200);
  console.log(JSON.stringify({ result: 'passed', ...diagnostics, plan }));
} catch (error) {
  console.log(JSON.stringify({ result: 'failed', ...diagnostics, error: error.message, planner: planner.lastDiagnostics }));
  process.exitCode = 1;
} finally {
  proxy.closeAllConnections();
  proxy.close();
}
