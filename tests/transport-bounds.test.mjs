import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { ReadableStream } from 'node:stream/web';
import { PiAgent, MAX_TEXT } from '../server/lib/agent.js';
import {
  MAX_BYTES,
  MAX_TEXT as MAX_WEB_TEXT,
  TIMEOUT_MS as WEB_TIMEOUT_MS,
  readBoundedResponse,
  webGet,
} from '../server/lib/web.js';
import {
  MAX_REQUEST,
  MAX_RESPONSE_BYTES,
  OPERATION_TIMEOUTS_MS,
  startGateway,
} from '../server/lib/gateway.js';

const require = createRequire(import.meta.url);
const {
  INNER_OPERATION_TIMEOUTS_MS,
  SERVER_OPERATION_TIMEOUTS_MS,
  CLIENT_OPERATION_TIMEOUTS_MS,
} = require('../server/lib/gateway-deadlines.cjs');
const { callGateway, GatewayError: ClientGatewayError } = require('../client/gateway_client.js');

function listen(server) {
  return new Promise((resolve, reject) => {
    if (server.listening) return resolve(server.address());
    const onError = (error) => { server.off('listening', onListening); reject(error); };
    const onListening = () => { server.off('error', onError); resolve(server.address()); };
    server.once('error', onError);
    server.once('listening', onListening);
  });
}

function close(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

test('gateway deadline hierarchy leaves room for each outer transport', () => {
  for (const [operation, inner] of Object.entries(INNER_OPERATION_TIMEOUTS_MS)) {
    assert.ok(SERVER_OPERATION_TIMEOUTS_MS[operation] > inner, operation);
    assert.ok(CLIENT_OPERATION_TIMEOUTS_MS[operation] > SERVER_OPERATION_TIMEOUTS_MS[operation], operation);
    assert.equal(OPERATION_TIMEOUTS_MS[operation], SERVER_OPERATION_TIMEOUTS_MS[operation], operation);
  }
  assert.ok(MAX_REQUEST > 0);
  assert.ok(MAX_RESPONSE_BYTES > MAX_REQUEST);
});

test('gateway applies an operation deadline and aborts the handler', async () => {
  let aborted = false;
  const server = startGateway({
    host: '127.0.0.1',
    port: 0,
    log: () => {},
    operationTimeouts: { slow: 25 },
    resolveInstance: () => ({
      gatewayOp: (_operation, request, context) => new Promise((_resolve, reject) => {
        assert.equal(request.signal, context.signal);
        assert.equal(Object.prototype.propertyIsEnumerable.call(request, 'signal'), false);
        context.signal.addEventListener('abort', () => { aborted = true; reject(new Error('stopped')); }, { once: true });
      }),
    }),
  });
  await listen(server);
  const address = server.address();
  const result = await callGateway({ host: address.address, port: address.port, label: 'deadline-fixture' }, { op: 'slow', token: 'fixture' }, { timeoutMs: 1000 });
  assert.deepEqual(result, { ok: false, error: { code: 'timeout', message: 'request timed out after 25 ms' } });
  assert.equal(aborted, true);
  await close(server);
});

test('gateway aborts an in-flight handler when its client disconnects', async () => {
  let started;
  let aborted = false;
  const server = startGateway({
    host: '127.0.0.1',
    port: 0,
    log: () => {},
    operationTimeouts: { slow: 5000 },
    resolveInstance: () => ({
      gatewayOp: (_operation, _request, { signal }) => {
        started = true;
        return new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('stopped')); }, { once: true }));
      },
    }),
  });
  await listen(server);
  const address = server.address();
  const socket = net.createConnection({ host: address.address, port: address.port });
  await once(socket, 'connect');
  socket.write('{"op":"slow","token":"fixture"}\n');
  await new Promise((resolve) => setTimeout(resolve, 10));
  const closed = once(socket, 'close');
  if (typeof socket.resetAndDestroy === 'function') socket.resetAndDestroy();
  else socket.destroy(new Error('fixture client disconnected'));
  await closed;
  for (let i = 0; i < 20 && !aborted; i++) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(started, true);
  assert.equal(aborted, true);
  await close(server);
});

test('gateway still replies to legacy clients that half-close after the request line', async () => {
  const server = startGateway({
    host: '127.0.0.1',
    port: 0,
    log: () => {},
    resolveInstance: () => ({ gatewayOp: async () => ({ compatible: true }) }),
  });
  await listen(server);
  const address = server.address();
  const socket = net.createConnection({ host: address.address, port: address.port });
  let wire = '';
  socket.setEncoding('utf8');
  socket.on('data', chunk => { wire += chunk; });
  await once(socket, 'connect');
  socket.end('{"op":"hello","token":"fixture"}\n');
  await once(socket, 'close');
  assert.deepEqual(JSON.parse(wire.trim()), { ok: true, result: { compatible: true } });
  await close(server);
});

test('client aborts and closes its socket without waiting for the gateway', async () => {
  const server = net.createServer((socket) => socket.on('data', () => {}));
  server.listen(0, '127.0.0.1');
  await listen(server);
  const address = server.address();
  const controller = new AbortController();
  const pending = callGateway({ host: address.address, port: address.port, label: 'abort-fixture' }, { op: 'hello' }, { timeoutMs: 1000, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error) => error instanceof ClientGatewayError || error.name === 'AbortError');
  await close(server);
});

test('bounded web reads count UTF-8 bytes and cancel an oversized stream', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('é'.repeat(Math.floor(MAX_BYTES / 2) + 1)));
    },
    cancel() { cancelled = true; },
  });
  await assert.rejects(
    () => readBoundedResponse({ body: stream, text: () => { throw new Error('text() should not be called'); } }),
    (error) => error.code === 'web_too_large',
  );
  assert.equal(cancelled, true);
});

test('webGet streams a bounded response and still returns small pages', async () => {
  const realFetch = globalThis.fetch;
  const realTimeout = AbortSignal.timeout;
  let textCalled = false;
  let seenSignal;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('<h1>bounded</h1><p>reference</p>'));
      controller.close();
    },
  });
  globalThis.fetch = async (_url, options) => {
    seenSignal = options.signal;
    return {
      ok: true,
      status: 200,
      url: 'https://slaythespire2.net/fixture?v=beta',
      headers: new Headers({ 'content-type': 'text/html' }),
      body,
      text: () => { textCalled = true; throw new Error('text() should not be called'); },
    };
  };
  try {
    const result = await webGet({ url: 'https://slaythespire2.net/fixture-stream?v=beta' });
    assert.equal(result.text, 'bounded\nreference');
    assert.equal(result.truncated, false);
    assert.equal(textCalled, false);
    assert.ok(seenSignal);
    assert.equal(WEB_TIMEOUT_MS, INNER_OPERATION_TIMEOUTS_MS['web-get']);
    assert.equal(MAX_WEB_TEXT, 12000);
  } finally {
    globalThis.fetch = realFetch;
    AbortSignal.timeout = realTimeout;
  }
});

test('live transcript deltas contain only text accepted by the server bound', () => {
  const agent = new PiAgent({ name: 'fixture-player', image: 'fixture-image', env: {} });
  const deltas = [];
  agent.on('delta', (delta) => deltas.push(delta));
  agent._appendDelta('text', 'a'.repeat(MAX_TEXT + 25), 'strategist');
  agent._appendDelta('text', 'b', 'strategist');
  const item = agent.transcript.find((entry) => entry.kind === 'text');
  assert.equal(item.text.length, MAX_TEXT);
  assert.equal(deltas[0].delta.length, MAX_TEXT);
  assert.equal(deltas[0].truncated, true);
  assert.equal(deltas[0].dropped, 25);
  assert.equal(deltas[1].delta, '');
  assert.equal(deltas[1].truncated, true);
  assert.equal(deltas[1].dropped, 1);
  let browserText = '';
  for (const delta of deltas) browserText += delta.delta;
  assert.equal(browserText, item.text, 'the browser delta reducer cannot exceed the persisted transcript');
});
