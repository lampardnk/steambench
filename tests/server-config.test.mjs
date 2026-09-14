import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { loadServerConfig } from '../server/lib/config.mjs';

const here = new URL('../server/bin/', import.meta.url).pathname;
const root = path.resolve(path.dirname(here), '..');
const environment = (overrides = {}) => ({ STEAMBENCH_TOKEN: 'test-token', ...overrides });
const load = (overrides = {}) => loadServerConfig({ env: environment(overrides), here });

test('server configuration supplies stable defaults and derived paths', () => {
  const cfg = load();
  assert.equal(cfg.token, 'test-token');
  assert.equal(cfg.port, 8787);
  assert.equal(cfg.gatewayPort, 28771);
  assert.equal(cfg.roomWidth, 1280);
  assert.equal(cfg.roomHeight, 720);
  assert.equal(cfg.streamFps, 30);
  assert.equal(cfg.portBase, 39000);
  assert.equal(cfg.gatewayForAgents, 'host.docker.internal:28771');
  assert.equal(cfg.hostRoomsDir, '/etc/wolf/rooms');
  assert.equal(cfg.hostMediaDir, '/etc/wolf/media');
});

test('agent gateway default follows a custom server gateway port', () => {
  const cfg = load({ STEAMBENCH_GATEWAY_PORT: '28881' });
  assert.equal(cfg.gatewayForAgents, 'host.docker.internal:28881');
});

test('numeric settings reject missing, non-finite, fractional, and out-of-range values', () => {
  for (const [name, value] of [
    ['PORT', 'NaN'],
    ['STEAMBENCH_GATEWAY_PORT', '65536'],
    ['STEAMBENCH_ROOM_WIDTH', '1279'],
    ['STEAMBENCH_ROOM_HEIGHT', '239'],
    ['STEAMBENCH_STREAM_FPS', 'Infinity'],
    ['STEAMBENCH_STREAM_QUALITY', '80.5'],
    ['STEAMBENCH_STREAM_BITRATE', '0'],
    ['STEAMBENCH_STILLS_FPS', ''],
    ['STEAMBENCH_FRAGMENT_MS', '2.5'],
    ['STEAMBENCH_AUDIO_BITRATE', '-1'],
    ['STEAMBENCH_MAX_ROOMS', '1.5'],
    ['STEAMBENCH_FINISH_GRACE_S', '-1'],
  ]) {
    assert.throws(() => load({ [name]: value }), new RegExp(`invalid configuration ${name}`), name);
  }
});

test('media pool remains inside the port range and cannot collide with listeners', () => {
  assert.throws(() => load({ STEAMBENCH_PORT_BASE: '64634' }), /STEAMBENCH_PORT_BASE/);
  assert.throws(() => load({ STEAMBENCH_PORT_BASE: '28700', PORT: '28701' }), /PORT.*overlaps/);
  assert.throws(() => load({ STEAMBENCH_PORT_BASE: '28700', STEAMBENCH_GATEWAY_PORT: '28701' }), /STEAMBENCH_GATEWAY_PORT.*overlaps/);
  assert.throws(() => load({ WOLF_VIDEO_PING_PORT: '58100', WOLF_AUDIO_PING_PORT: '58100' }), /WOLF_AUDIO_PING_PORT.*differ/);
  assert.throws(() => load({ PORT: '28771' }), /PORT|STEAMBENCH_GATEWAY_PORT/);
  assert.throws(() => load({ WOLF_VIDEO_PING_PORT: '8787' }), /WOLF_VIDEO_PING_PORT.*PORT/);
});

test('endpoint and path settings reject malformed values before startup', () => {
  assert.throws(() => load({ STEAMBENCH_GATEWAY_FOR_AGENTS: 'host-only' }), /STEAMBENCH_GATEWAY_FOR_AGENTS.*HOST:PORT/);
  assert.throws(() => load({ STEAMBENCH_GATEWAY_FOR_AGENTS: 'host:0' }), /STEAMBENCH_GATEWAY_FOR_AGENTS.*port/);
  assert.throws(() => load({ STEAMBENCH_ROOMS_REL: '../rooms' }), /STEAMBENCH_ROOMS_REL.*relative path/);
  assert.throws(() => load({ STEAMBENCH_TOKEN: '   ' }), /STEAMBENCH_TOKEN/);
  assert.throws(() => loadServerConfig({ env: {}, here }), /STEAMBENCH_TOKEN/);
});

test('the server entrypoint exits on configuration errors before opening listeners', () => {
  const result = spawnSync(process.execPath, ['server/bin/server.mjs'], {
    cwd: root,
    env: { ...process.env, STEAMBENCH_TOKEN: 'test-token', STEAMBENCH_STREAM_FPS: 'NaN' },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /invalid configuration STEAMBENCH_STREAM_FPS/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /server listening|gateway listening/);
});
