#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { parseGateway, endpointFromEnv, callGateway } = require(path.join(__dirname, "gateway_client.js"));

function usage() {
  console.log(`Usage: steambench-host [--socket PATH | --gateway HOST:PORT] OPERATION [ARGS...]

Read-only:
  list
  inspect PID
  log-files
  read-log LABEL/PATH [LINES]
  read-output PID [FD] [--consume]
  windows
  sts2-get PATH [KEY=VALUE...]        GET-only proxy to the STS2MCP mod API
  screenshot [PID] [WIDTH] [--out FILE]
  pad-status

Virtual Xbox pad:
  pad-press BUTTON [HOLD_MS]          a b x y lb rb back start guide ls rs lt rt
  pad-stick left|right X Y [HOLD_MS]  X/Y in -1..1, negative Y is up
  pad-dpad up|down|left|right [PRESSES] [INTERVAL_MS]
  pad-neutral

Window input (XSendEvent; ignored by the game, kept for other windows):
  window-key PID KEY [KEY...]
  window-type PID TEXT
  window-click PID BUTTON X Y

Process control:
  signal PID SIGNAL
  memory-maps PID
  memory-read PID ADDRESS LENGTH
  memory-write PID ADDRESS HEX
  ptrace-attach PID
  ptrace-detach PID
  ptrace-continue PID
  ptrace-peek PID ADDRESS
  ptrace-poke PID ADDRESS VALUE_HEX

The host gateway validates every PID against the Steam/STS2 allowlist.`);
}

function integer(value, label) {
  if (!/^\d+$/.test(value || "")) throw new Error(`${label} must be an integer`);
  return Number(value);
}

function number(value, label) {
  const parsed = Number(value);
  if (value === undefined || value === "" || Number.isNaN(parsed)) throw new Error(`${label} must be a number`);
  return parsed;
}

function requestFor(args) {
  const op = args.shift();
  if (!op || op === "help" || op === "--help" || op === "-h") {
    usage();
    process.exit(op ? 0 : 2);
  }
  switch (op) {
    case "list":
    case "log-files":
    case "windows":
    case "pad-status":
    case "pad-neutral":
      return { op };
    case "inspect":
      return { op, pid: integer(args.shift(), "PID") };
    case "read-log": {
      const logPath = args.shift();
      const lineArg = args.shift();
      return { op, path: logPath, lines: lineArg ? integer(lineArg, "LINES") : 80 };
    }
    case "read-output": {
      const pid = integer(args.shift(), "PID");
      let fd = 1;
      let consume = false;
      for (const arg of args) {
        if (arg === "--consume") consume = true;
        else fd = integer(arg, "FD");
      }
      return { op, pid, fd, consume };
    }
    case "sts2-get": {
      const apiPath = args.shift();
      if (!apiPath) throw new Error("sts2-get requires a PATH");
      const query = {};
      for (const arg of args) {
        const equals = arg.indexOf("=");
        if (equals <= 0) throw new Error(`query arguments must be KEY=VALUE, got ${arg}`);
        const key = arg.slice(0, equals);
        const value = arg.slice(equals + 1);
        query[key] = key === "limit" ? integer(value, "limit") : value;
      }
      return { op, path: apiPath, query };
    }
    case "screenshot": {
      const request = { op };
      const outIndex = args.indexOf("--out");
      if (outIndex >= 0) {
        request.__out = args[outIndex + 1];
        if (!request.__out) throw new Error("--out requires a file path");
        args.splice(outIndex, 2);
      }
      if (args.length) request.pid = integer(args.shift(), "PID");
      if (args.length) request.width = integer(args.shift(), "WIDTH");
      return request;
    }
    case "pad-press": {
      const button = args.shift();
      if (!button) throw new Error("pad-press requires a BUTTON");
      const request = { op, button };
      if (args.length) request.hold_ms = integer(args.shift(), "HOLD_MS");
      return request;
    }
    case "pad-stick": {
      const request = { op, stick: args.shift(), x: number(args.shift(), "X"), y: number(args.shift(), "Y") };
      if (args.length) request.hold_ms = integer(args.shift(), "HOLD_MS");
      return request;
    }
    case "pad-dpad": {
      const request = { op, direction: args.shift() };
      if (args.length) request.presses = integer(args.shift(), "PRESSES");
      if (args.length) request.interval_ms = integer(args.shift(), "INTERVAL_MS");
      return request;
    }
    case "window-key": {
      const pid = integer(args.shift(), "PID");
      if (!args.length) throw new Error("window-key requires at least one key");
      return { op, pid, keys: args };
    }
    case "window-type": {
      const pid = integer(args.shift(), "PID");
      const text = args.join(" ");
      if (!text) throw new Error("window-type requires text");
      return { op, pid, text };
    }
    case "window-click":
      return {
        op,
        pid: integer(args.shift(), "PID"),
        button: integer(args.shift(), "BUTTON"),
        x: integer(args.shift(), "X"),
        y: integer(args.shift(), "Y"),
      };
    case "signal":
      return { op, pid: integer(args.shift(), "PID"), signal: args.shift() };
    case "memory-read":
      return { op, pid: integer(args.shift(), "PID"), address: args.shift(), length: integer(args.shift(), "LENGTH") };
    case "memory-maps":
      return { op, pid: integer(args.shift(), "PID") };
    case "memory-write":
      return { op, pid: integer(args.shift(), "PID"), address: args.shift(), hex: args.shift() };
    case "ptrace-attach":
    case "ptrace-detach":
    case "ptrace-continue":
      return { op, pid: integer(args.shift(), "PID") };
    case "ptrace-peek":
      return { op, pid: integer(args.shift(), "PID"), address: args.shift() };
    case "ptrace-poke":
      return { op, pid: integer(args.shift(), "PID"), address: args.shift(), value_hex: args.shift() };
    default:
      throw new Error(`unknown operation: ${op}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let endpoint = endpointFromEnv();
  const gatewayIndex = args.indexOf("--gateway");
  if (gatewayIndex >= 0) {
    const value = args[gatewayIndex + 1];
    if (!value) throw new Error("--gateway requires HOST:PORT");
    endpoint = parseGateway(value);
    args.splice(gatewayIndex, 2);
  }
  const socketIndex = args.indexOf("--socket");
  if (socketIndex >= 0) {
    const socketPath = args[socketIndex + 1];
    if (!socketPath) throw new Error("--socket requires a path");
    endpoint = socketPath;
    args.splice(socketIndex, 2);
  }
  const request = requestFor(args);
  const outFile = request.__out;
  delete request.__out;
  const response = await callGateway(endpoint, request, { timeoutMs: request.op === "screenshot" ? 30000 : undefined });
  if (response.ok && request.op === "screenshot" && response.result && response.result.data_base64) {
    const image = Buffer.from(response.result.data_base64, "base64");
    if (outFile) fs.writeFileSync(outFile, image);
    response.result.data_base64 = outFile ? `written to ${outFile}` : `<${image.length} bytes omitted; use --out FILE>`;
  }
  console.log(JSON.stringify(response, null, 2));
  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`steambench-host: ${error.message}`);
  process.exitCode = 1;
});
