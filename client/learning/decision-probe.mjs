// Exercises the real Pi RPC stream, inspecting the outgoing request via a local proxy.
// Only the exact free model is allowed. No executor/gateway is imported.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { Planner } from './planner.mjs';
import { PROFILE } from './profile.mjs';
const report = { at: Date.now(), profile: PROFILE.checkpointVersion, model: PROFILE.model, baseUrl: PROFILE.baseUrl, ready: false, capabilities: { streaming: false, json: false }, requests: [], gameplayActions: 0 };
const proxy = http.createServer(async (request, response) => {
  try {
    assert.equal(request.headers.authorization === `Bearer ${process.env[PROFILE.apiKeyEnv]}`, true, `Pi must forward ${PROFILE.apiKeyEnv} exactly`);
    let body = '';
    for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body);
    assert.equal(payload.model, PROFILE.model);
    assert.equal(payload.stream, true);
    assert.equal(payload.provider, undefined);
    // Assert the effective level rather than its OpenAI-compatible wire shape;
    // this catches any client-side clamp before a room is allowed to start.
    const wanted = PROFILE.reasoning && PROFILE.reasoning !== 'default' ? PROFILE.reasoning : undefined;
    const carried = payload.reasoning && typeof payload.reasoning === 'object' ? payload.reasoning.effort : payload.reasoning_effort;
    assert.equal(Boolean(payload.reasoning) && Boolean(payload.reasoning_effort), false, 'one shape only, never both');
    assert.equal(carried, wanted, `the reasoning level on the wire must be ${wanted}`);
    assert.ok(payload.max_tokens > 0 && payload.max_tokens <= PROFILE.maxTokens);
    assert.ok(report.requests.length < 2, 'no automatic retries');
    const audit = { model: payload.model, stream: payload.stream, maxTokens: payload.max_tokens, reasoningEffort: carried ?? null, image: payload.messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url')) };
    report.requests.push(audit);
    const upstream = await fetch(`${PROFILE.baseUrl}/chat/completions`, { method: 'POST', headers: { Authorization: request.headers.authorization, 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(PROFILE.plannerDeadlineMs - 5000) });
    audit.status = upstream.status;
    response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
    for await (const chunk of upstream.body) response.write(chunk);
    response.end();
  } catch (error) {
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: { message: error.message } }));
  }
});
await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
const file = '/home/node/.pi/agent/models.json';
const config = JSON.parse(fs.readFileSync(file));
config.providers[PROFILE.provider].baseUrl = `http://127.0.0.1:${proxy.address().port}/v1`;
fs.writeFileSync(file, JSON.stringify(config));
let chunks = 0;
const planner = new Planner({ emit: event => { if (event.assistantMessageEvent?.type === 'text_delta') chunks++; }, record: () => {} });
try {
  const plain = await planner.ask({ role: 'probe', prompt: 'probe.txt', context: { probe: 'text' }, stream: true });
  assert.equal(plain.ok, true);
  report.capabilities.json = true;
  report.capabilities.streaming = chunks > 0;
  assert.ok(chunks > 0, 'Pi must expose text stream chunks');
  report.ready = true;
} catch (error) {
  report.error = error.message.replaceAll(process.env[PROFILE.apiKeyEnv] || 'NO_KEY', '[redacted]').slice(0, 1000);
  process.exitCode = 1;
} finally {
  console.log(JSON.stringify(report));
  proxy.closeAllConnections(); proxy.close();
}
