// Exercises the real Pi RPC stream, inspecting the outgoing request via a local proxy.
// Only the exact free model is allowed. No executor/gateway is imported.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { Planner } from './planner.mjs';
import zlib from 'node:zlib';
import { PROFILE } from './profile.mjs';

/** A solid square PNG, built here so no fixture image ships with the probe. */
function swatch(size, [red, green, blue]) {
  const pixel = Buffer.from([red, green, blue]);
  const row = Buffer.concat([Buffer.from([0]), ...Array.from({ length: size }, () => pixel)]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const crc32 = buffer => { let value = ~0; for (const byte of buffer) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (0xEDB88320 & -(value & 1)); } return (~value) >>> 0; };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const report = { at: Date.now(), profile: PROFILE.checkpointVersion, model: PROFILE.model, baseUrl: PROFILE.baseUrl, ready: false, capabilities: { streaming: false, json: false, image: false }, requests: [], gameplayInputs: 0 };
const proxy = http.createServer(async (request, response) => {
  try {
    assert.equal(request.headers.authorization === `Bearer ${process.env[PROFILE.apiKeyEnv]}`, true, `Pi must forward ${PROFILE.apiKeyEnv} exactly`);
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
  // A generated 64x64 red swatch; no gameplay screenshot or personal data. It
  // used to be a single red pixel, which gpt-5.6-luna called yellow - fairly,
  // since one pixel survives almost no encoding. The probe is asking whether
  // the actuator can read a screenshot, so it has to show it something with an
  // area.
  const image = { mime_type: 'image/png', data_base64: swatch(64, [220, 20, 20]).toString('base64') };
  const vision = await planner.ask({ role: 'probe', prompt: 'probe.txt', context: { probe: 'image' }, image });
  assert.equal(vision.ok, true);
  assert.equal(vision.color.toLowerCase(), 'red');
  report.capabilities.image = true;
  report.ready = true;
} catch (error) {
  report.error = error.message.replaceAll(process.env[PROFILE.apiKeyEnv] || 'NO_KEY', '[redacted]').slice(0, 1000);
  process.exitCode = 1;
} finally {
  console.log(JSON.stringify(report));
  proxy.closeAllConnections(); proxy.close();
}
