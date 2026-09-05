// JSON-line TCP gateway for agent containers: one request line per
// connection, one response line back (same wire format as host/process_gateway.py).
// The per-instance token routes each agent to its own room.
import net from 'node:net';

const MAX_REQUEST = 64 * 1024;

export class GatewayError extends Error {
  constructor(code, message, details) { super(message); this.code = code; this.details = details; }
}

export function startGateway({ host = '0.0.0.0', port = 28771, resolveInstance, log = console.log }) {
  const server = net.createServer((socket) => {
    let data = '';
    let done = false;
    const reply = (obj) => {
      if (done) return;
      done = true;
      socket.end(JSON.stringify(obj) + '\n');
    };
    socket.setTimeout(30000, () => reply({ ok: false, error: { code: 'timeout', message: 'request timed out' } }));
    socket.on('error', () => { /* client went away */ });
    socket.on('data', async (chunk) => {
      if (done) return;
      data += chunk.toString('utf8');
      if (data.length > MAX_REQUEST) return reply({ ok: false, error: { code: 'too_large', message: 'request too large' } });
      const nl = data.indexOf('\n');
      if (nl < 0) return;
      let request;
      try { request = JSON.parse(data.slice(0, nl)); } catch { return reply({ ok: false, error: { code: 'invalid_json', message: 'request must be a JSON object' } }); }
      try {
        const instance = resolveInstance(request?.token);
        if (!instance) throw new GatewayError('unauthorized', 'A valid gateway token is required');
        const result = await instance.gatewayOp(String(request.op || ''), request);
        reply({ ok: true, result });
      } catch (error) {
        const code = error.code && typeof error.code === 'string' ? error.code : 'gateway_error';
        reply({ ok: false, error: { code, message: error.message || 'gateway request failed', ...(error.details ? { details: error.details } : {}) } });
      }
    });
  });
  server.listen(port, host, () => log(`gateway listening on ${host}:${port}`));
  return server;
}
