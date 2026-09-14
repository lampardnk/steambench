"use strict";

// Keep the deadline hierarchy in one place. The operation implementations are
// deliberately given the shortest budget; the gateway and its client each get
// time to finish framing and report a failure after an operation has stopped.
//
// sts2-get includes the three ten-second mod reads and the two 300 ms retry
// pauses currently used by Room._sts2Fetch. If that implementation changes,
// update this table before changing either outer transport budget.
const INNER_OPERATION_TIMEOUTS_MS = Object.freeze({
  hello: 1_000,
  "web-get": 15_000,
  "sts2-action": 10_000,
  "sts2-action-verify": 1_000,
  "sts2-get": 31_000,
  screenshot: 15_000,
  "skill-commit": 30_000,
  "room-finish": 45_000,
});

const SERVER_OPERATION_TIMEOUTS_MS = Object.freeze(Object.fromEntries(
  Object.entries(INNER_OPERATION_TIMEOUTS_MS).map(([operation, timeout]) => [operation, timeout + 5_000]),
));

const CLIENT_OPERATION_TIMEOUTS_MS = Object.freeze(Object.fromEntries(
  Object.entries(SERVER_OPERATION_TIMEOUTS_MS).map(([operation, timeout]) => [operation, timeout + 5_000]),
));

const DEFAULT_INNER_TIMEOUT_MS = 30_000;
const DEFAULT_SERVER_TIMEOUT_MS = DEFAULT_INNER_TIMEOUT_MS + 5_000;
const DEFAULT_CLIENT_TIMEOUT_MS = DEFAULT_SERVER_TIMEOUT_MS + 5_000;

module.exports = {
  INNER_OPERATION_TIMEOUTS_MS,
  SERVER_OPERATION_TIMEOUTS_MS,
  CLIENT_OPERATION_TIMEOUTS_MS,
  DEFAULT_INNER_TIMEOUT_MS,
  DEFAULT_SERVER_TIMEOUT_MS,
  DEFAULT_CLIENT_TIMEOUT_MS,
};
