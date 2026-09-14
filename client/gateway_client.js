"use strict";

// Shared client for the host process gateway: one JSON request line per
// connection, one JSON response line back. Used by the steambench-host CLI
// and by the Pi extension.

const net = require("node:net");
const {
  CLIENT_OPERATION_TIMEOUTS_MS,
  DEFAULT_CLIENT_TIMEOUT_MS,
} = require("../server/lib/gateway-deadlines.cjs");

const DEFAULT_SOCKET = "/run/steambench/process.sock";
// This is the fallback for a newly added operation. Known operations use the
// explicit values in CLIENT_OPERATION_TIMEOUTS_MS below. Keep the fallback
// outside the server's default budget so an operation can finish cleanly.
const DEFAULT_TIMEOUT_MS = DEFAULT_CLIENT_TIMEOUT_MS;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

class GatewayError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "GatewayError";
    this.code = code;
    this.details = details;
  }
}

function parseGateway(value) {
  const separator = value.lastIndexOf(":");
  if (separator <= 0) throw new Error("gateway must be HOST:PORT");
  const host = value.slice(0, separator);
  const port = Number(value.slice(separator + 1));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("gateway port is invalid");
  return { host, port, label: value };
}

function endpointFromEnv() {
  const gateway = process.env.STEAMBENCH_PROCESS_GATEWAY;
  if (gateway) return parseGateway(gateway);
  return process.env.STEAMBENCH_PROCESS_SOCKET || DEFAULT_SOCKET;
}

function timeoutFor(request, options) {
  const requested = options.timeoutMs ?? CLIENT_OPERATION_TIMEOUTS_MS[request?.op] ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(requested) || requested <= 0) throw new RangeError("gateway timeout must be a positive finite number");
  return Math.floor(requested);
}

function abortError(signal) {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;
  return new GatewayError("aborted", "gateway request was aborted");
}

function callGateway(endpoint, request, options = {}) {
  let timeoutMs;
  try { timeoutMs = timeoutFor(request, options); }
  catch (error) { return Promise.reject(error); }

  const signal = options.signal;
  if (signal?.aborted) return Promise.reject(abortError(signal));

  return new Promise((resolve, reject) => {
    const connectOptions = typeof endpoint === "string" ? { path: endpoint } : endpoint;
    const label = typeof endpoint === "string" ? endpoint : endpoint?.label || `${endpoint?.host || "gateway"}:${endpoint?.port || "?"}`;
    const wireRequest = process.env.STEAMBENCH_PROCESS_TOKEN
      ? { ...(request || {}), token: process.env.STEAMBENCH_PROCESS_TOKEN }
      : request;
    const socket = net.createConnection(connectOptions);
    const chunks = [];
    let responseBytes = 0;
    let settled = false;
    let timer;
    let onAbort;
    const finish = (callback, value, reset = false) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (signal && onAbort) signal.removeEventListener("abort", onAbort);
      if (reset && typeof socket.resetAndDestroy === "function") socket.resetAndDestroy();
      else socket.destroy();
      callback(value);
    };

    timer = setTimeout(() => finish(reject, new GatewayError("timeout", `gateway request timed out after ${timeoutMs} ms`), true), timeoutMs);
    if (signal) {
      onAbort = () => finish(reject, abortError(signal), true);
      signal.addEventListener("abort", onAbort, { once: true });
    }

    socket.on("connect", () => {
      if (settled) return;
      // Keep the write side open until the response arrives. The server uses a
      // half-open connection so it can distinguish a client that destroys an
      // in-flight request from the normal request framing; the newline is the
      // protocol delimiter, not EOF.
      try { socket.write(`${JSON.stringify(wireRequest)}\n`); }
      catch (error) { finish(reject, error); }
    });
    socket.on("data", (chunk) => {
      if (settled) return;
      responseBytes += chunk.length;
      if (responseBytes > MAX_RESPONSE_BYTES) {
        return finish(reject, new GatewayError("response_too_large", `gateway response exceeds ${MAX_RESPONSE_BYTES} bytes`), true);
      }
      chunks.push(chunk);
      const data = Buffer.concat(chunks, responseBytes);
      const newline = data.indexOf(0x0a);
      if (newline >= 0) {
        try {
          finish(resolve, JSON.parse(data.subarray(0, newline).toString("utf8")));
        } catch (error) {
          finish(reject, error);
        }
      }
    });
    socket.on("error", (error) => finish(reject, error));
    socket.on("close", () => finish(reject, new Error(`gateway closed without a response at ${label}`)));
  });
}

// Convenience wrapper: resolves with `result`, throws GatewayError on `ok: false`.
async function call(request, options = {}) {
  const endpoint = options.endpoint || endpointFromEnv();
  const response = await callGateway(endpoint, request, options);
  if (!response || typeof response !== "object") throw new Error("gateway returned a malformed response");
  if (!response.ok) {
    const error = response.error || {};
    throw new GatewayError(error.code || "gateway_error", error.message || "gateway request failed", error.details);
  }
  return response.result;
}

module.exports = {
  DEFAULT_SOCKET,
  DEFAULT_TIMEOUT_MS,
  MAX_RESPONSE_BYTES,
  CLIENT_OPERATION_TIMEOUTS_MS,
  GatewayError,
  parseGateway,
  endpointFromEnv,
  callGateway,
  call,
};
