"use strict";

// Shared client for the host process gateway: one JSON request line per
// connection, one JSON response line back. Used by the steambench-host CLI
// and by the Pi extension.

const net = require("node:net");

const DEFAULT_SOCKET = "/run/steambench/process.sock";
const DEFAULT_TIMEOUT_MS = 20000;

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

function callGateway(endpoint, request, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const connectOptions = typeof endpoint === "string" ? { path: endpoint } : endpoint;
    const label = typeof endpoint === "string" ? endpoint : endpoint.label;
    const wireRequest = process.env.STEAMBENCH_PROCESS_TOKEN
      ? { ...request, token: process.env.STEAMBENCH_PROCESS_TOKEN }
      : request;
    const socket = net.createConnection(connectOptions);
    let data = "";
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      callback(value);
    };
    const timer = setTimeout(() => finish(reject, new Error(`gateway request timed out after ${timeoutMs} ms`)), timeoutMs);
    socket.on("connect", () => socket.end(`${JSON.stringify(wireRequest)}\n`));
    socket.on("data", (chunk) => {
      data += chunk.toString("utf8");
      const newline = data.indexOf("\n");
      if (newline >= 0) {
        try {
          finish(resolve, JSON.parse(data.slice(0, newline)));
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

module.exports = { DEFAULT_SOCKET, DEFAULT_TIMEOUT_MS, GatewayError, parseGateway, endpointFromEnv, callGateway, call };
