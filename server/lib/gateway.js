// JSON-line TCP gateway for agent containers: one request line per
// connection, one response line back (same wire format as host/process_gateway.py).
// The per-instance token routes each agent to its own room.
import net from 'node:net';
import deadlines from './gateway-deadlines.cjs';

const {
  SERVER_OPERATION_TIMEOUTS_MS,
  DEFAULT_SERVER_TIMEOUT_MS,
} = deadlines;

export const MAX_REQUEST = 64 * 1024;
export const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
// This only covers an idle client that has not sent a complete request. Once a
// request line is parsed, the operation-specific deadline takes over.
export const REQUEST_IDLE_TIMEOUT_MS = 10_000;
export const OPERATION_TIMEOUTS_MS = SERVER_OPERATION_TIMEOUTS_MS;

export class GatewayError extends Error {
  constructor(code, message, details) { super(message); this.name = 'GatewayError'; this.code = code; this.details = details; }
}

export function operationTimeoutMs(operation, overrides = OPERATION_TIMEOUTS_MS) {
  const value = overrides?.[operation] ?? DEFAULT_SERVER_TIMEOUT_MS;
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`invalid gateway timeout for ${operation || 'unknown operation'}`);
  return Math.floor(value);
}

function timeoutError(operation, timeoutMs) {
  return new GatewayError('timeout', `${operation || 'gateway operation'} timed out after ${timeoutMs} ms`);
}

function requestWithSignal(request, signal) {
  const contextual = { ...request };
  // Keep the signal out of logs/JSON and preserve the existing gatewayOp
  // request shape. Rooms that support cancellation can read request.signal;
  // all operations also receive it in the explicit third argument.
  Object.defineProperty(contextual, 'signal', { value: signal, enumerable: false, configurable: true });
  return contextual;
}

function errorPayload(error) {
  const code = error?.code && typeof error.code === 'string' ? error.code : 'gateway_error';
  return { code, message: error?.message || 'gateway request failed', ...(error?.details ? { details: error.details } : {}) };
}

/**
 * Start the one-request-per-connection gateway.
 *
 * `operationTimeouts` is injectable for tests and local callers that have a
 * narrower operation implementation. Production values come from the shared
 * deadline table, whose inner operation budgets are shorter than these outer
 * server budgets (and shorter still than the client budgets).
 */
export function startGateway({
  host = '0.0.0.0',
  port = 28771,
  resolveInstance,
  log = console.log,
  operationTimeouts = OPERATION_TIMEOUTS_MS,
  requestIdleTimeoutMs = REQUEST_IDLE_TIMEOUT_MS,
  maxRequestBytes = MAX_REQUEST,
  maxResponseBytes = MAX_RESPONSE_BYTES,
}) {
  // Current clients delimit the request with a newline and keep their write
  // side open while awaiting the response. allowHalfOpen also preserves the
  // older client contract, which half-closes after that newline.
  const server = net.createServer({ allowHalfOpen: true }, (socket) => {
    let data = Buffer.alloc(0);
    let parsed = false;
    let done = false;
    let abandoned = false;
    let operationTimer = null;
    const controller = new AbortController();

    const abort = (reason) => {
      if (!controller.signal.aborted) controller.abort(reason);
    };

    const abandon = () => {
      if (done) return;
      abandoned = true;
      done = true;
      if (operationTimer) clearTimeout(operationTimer);
      abort(new GatewayError('client_disconnected', 'gateway client disconnected'));
      socket.destroy();
    };

    const reply = (obj) => {
      if (done || abandoned || socket.destroyed) return false;
      let wire;
      try { wire = JSON.stringify(obj); }
      catch (error) {
        wire = JSON.stringify({ ok: false, error: { code: 'response_error', message: `could not encode gateway response: ${error.message}` } });
      }
      if (Buffer.byteLength(wire, 'utf8') + 1 > maxResponseBytes) {
        wire = JSON.stringify({ ok: false, error: { code: 'response_too_large', message: `gateway response exceeds ${maxResponseBytes} bytes` } });
      }
      done = true;
      if (operationTimer) { clearTimeout(operationTimer); operationTimer = null; }
      try { socket.end(`${wire}\n`); }
      catch { socket.destroy(); }
      return true;
    };

    const timeoutBeforeRequest = () => {
      abort(new GatewayError('timeout', 'gateway request was not received in time'));
      reply({ ok: false, error: { code: 'timeout', message: 'request timed out' } });
    };
    socket.setTimeout(requestIdleTimeoutMs, timeoutBeforeRequest);
    socket.once('close', abandon);
    // Older clients half-close after the newline and still expect a response;
    // allowHalfOpen keeps that protocol compatible. A reset/error or a close
    // before our reply is the abandonment signal for cancellable reads.
    socket.on('end', () => { if (!parsed) abandon(); });
    socket.on('error', abandon);

    socket.on('data', (chunk) => {
      if (done || abandoned || parsed) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      data = Buffer.concat([data, bytes]);
      if (data.length > maxRequestBytes) {
        abort(new GatewayError('too_large', 'request too large'));
        return reply({ ok: false, error: { code: 'too_large', message: 'request too large' } });
      }
      const newline = data.indexOf(0x0a);
      if (newline < 0) return;
      parsed = true;
      socket.pause();
      socket.setTimeout(0);

      let request;
      try { request = JSON.parse(data.subarray(0, newline).toString('utf8')); }
      catch { return reply({ ok: false, error: { code: 'invalid_json', message: 'request must be a JSON object' } }); }
      if (!request || typeof request !== 'object' || Array.isArray(request)) {
        return reply({ ok: false, error: { code: 'invalid_json', message: 'request must be a JSON object' } });
      }

      const operation = String(request.op || '');
      let timeoutMs;
      try { timeoutMs = operationTimeoutMs(operation, operationTimeouts); }
      catch (error) { return reply({ ok: false, error: errorPayload(error) }); }
      operationTimer = setTimeout(() => {
        abort(timeoutError(operation, timeoutMs));
        reply({ ok: false, error: { code: 'timeout', message: `request timed out after ${timeoutMs} ms` } });
      }, timeoutMs);

      // Promise.resolve().then() captures both a synchronous resolveInstance
      // failure and an async gatewayOp. The rejection handler remains attached
      // even if the client disconnects while the operation is still unwinding.
      const work = Promise.resolve().then(() => {
        const instance = resolveInstance(request.token);
        if (!instance) throw new GatewayError('unauthorized', 'A valid gateway token is required');
        return instance.gatewayOp(operation, requestWithSignal(request, controller.signal), { signal: controller.signal });
      });
      work.then((result) => {
        if (done || abandoned || controller.signal.aborted) return;
        reply({ ok: true, result });
      }, (error) => {
        if (done || abandoned || controller.signal.aborted) return;
        reply({ ok: false, error: errorPayload(error) });
      });
    });
  });
  server.listen(port, host, () => log(`gateway listening on ${host}:${port}`));
  return server;
}
