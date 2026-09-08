// Exercises the real Pi RPC stream, inspecting the outgoing request via a local proxy.
// Only the exact free model is allowed. No executor/gateway is imported.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { Planner } from './planner.mjs';
import { PROFILE } from './profile.mjs';
const report = { at: Date.now(), profile: PROFILE.checkpointVersion, model: PROFILE.model, baseUrl: PROFILE.baseUrl, ready: false, capabilities: { streaming: false, json: false, image: false }, requests: [], gameplayInputs: 0 };
const proxy = http.createServer(async (request, response) => {
  try {
    assert.equal(request.headers.authorization === `Bearer ${process.env.ORCA_KEY}`, true, 'Pi must forward ORCA_KEY exactly');
    let body = '';
    for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body);
    assert.equal(payload.model, PROFILE.model);
    assert.equal(payload.stream, true);
    assert.equal(payload.reasoning, undefined);
    assert.equal(payload.reasoning_effort, undefined);
    assert.equal(payload.provider, undefined);
    assert.ok(payload.max_tokens > 0 && payload.max_tokens <= PROFILE.maxTokens);
    assert.ok(report.requests.length < 2, 'no automatic retries');
    const audit = { model: payload.model, stream: payload.stream, maxTokens: payload.max_tokens, image: payload.messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url')) };
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
config.providers.orcarouter.baseUrl = `http://127.0.0.1:${proxy.address().port}/v1`;
fs.writeFileSync(file, JSON.stringify(config));
let chunks = 0;
const planner = new Planner({ emit: event => { if (event.assistantMessageEvent?.type === 'text_delta') chunks++; }, record: () => {} });
try {
  const plain = await planner.ask({ role: 'probe', prompt: 'probe.txt', context: { probe: 'text' }, stream: true });
  assert.equal(plain.ok, true);
  report.capabilities.json = true;
  report.capabilities.streaming = chunks > 0;
  assert.ok(chunks > 0, 'Pi must expose text stream chunks');
  // Generated red 1x1 PNG; no gameplay screenshot or personal data.
  const image = { mime_type: 'image/png', data_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC' };
  const vision = await planner.ask({ role: 'probe', prompt: 'probe.txt', context: { probe: 'image' }, image });
  assert.equal(vision.ok, true);
  assert.equal(vision.color.toLowerCase(), 'red');
  report.capabilities.image = true;
  report.ready = true;
} catch (error) {
  report.error = error.message.replaceAll(process.env.ORCA_KEY || 'NO_KEY', '[redacted]').slice(0, 1000);
  process.exitCode = 1;
} finally {
  console.log(JSON.stringify(report));
  proxy.closeAllConnections(); proxy.close();
}
