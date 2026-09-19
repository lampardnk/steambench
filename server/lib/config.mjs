// Parse and validate the server's environment before any runtime integration
// (Wolf, the gateway, or room cleanup) is started. Keeping this separate from
// bin/server.mjs makes configuration behavior testable without opening ports
// or touching a live room.
import path from 'node:path';
import { PROFILE as learningProfile, SYSTEM_ONE } from './learning-profile.mjs';

const PORT_MIN = 1;
const PORT_MAX = 65535;
const MEDIA_PORT_MIN = 1024;
// RoomManager probes [base, base + 902] while allocating its three media
// ports. Leave the whole probe range inside the valid TCP/UDP port space.
const MEDIA_PORT_MAX = PORT_MAX - 902;
const DEFAULT_BUFFER_CAPS = 'video/x-raw(memory:CUDAMemory)';

export const CONFIG_LIMITS = Object.freeze({
  port: { min: PORT_MIN, max: PORT_MAX },
  gatewayPort: { min: PORT_MIN, max: PORT_MAX },
  wolfPingPort: { min: PORT_MIN, max: PORT_MAX },
  roomWidth: { min: 320, max: 7680, integer: true, even: true },
  roomHeight: { min: 240, max: 7680, integer: true, even: true },
  roomFps: { min: 1, max: 240 },
  streamWidth: { min: 160, max: 7680, integer: true, even: true },
  streamHeight: { min: 120, max: 7680, integer: true, even: true },
  streamFps: { min: 1, max: 120 },
  streamQuality: { min: 1, max: 100, integer: true },
  streamBitrateKbps: { min: 100, max: 100000, integer: true },
  stillsFps: { min: 0.1, max: 60 },
  fragmentMs: { min: 10, max: 60000, integer: true },
  audioBitrate: { min: 16, max: 10000, integer: true },
  portBase: { min: MEDIA_PORT_MIN, max: MEDIA_PORT_MAX, integer: true },
  maxRooms: { min: 1, max: 64, integer: true },
  finishGraceS: { min: 0, max: 86400 },
});

const DEFAULTS = Object.freeze({
  port: 8787,
  gatewayPort: 28771,
  wolfVideoPingPort: 58100,
  wolfAudioPingPort: 58200,
  roomWidth: 1280,
  roomHeight: 720,
  roomFps: 60,
  streamWidth: 1280,
  streamHeight: 720,
  streamFps: 30,
  streamQuality: 80,
  streamBitrateKbps: 4000,
  stillsFps: 2,
  fragmentMs: 500,
  audioBitrate: 128,
  portBase: 39000,
  maxRooms: 4,
  finishGraceS: 90,
});

function configError(name, message) {
  return new Error(`invalid configuration ${name}: ${message}`);
}

function stringValue(env, name, fallback, { allowEmpty = false, maxLength = 4096 } = {}) {
  const raw = env[name];
  const value = raw === undefined ? fallback : String(raw);
  if (value === undefined || value === null) throw configError(name, 'must not be empty');
  if (!allowEmpty && !value.trim()) throw configError(name, 'must not be empty');
  if (value.length > maxLength) throw configError(name, `must be at most ${maxLength} characters`);
  return value;
}

function numberValue(env, name, fallback, limits) {
  const raw = env[name];
  if (raw === undefined) return fallback;
  const text = String(raw).trim();
  if (!text) throw configError(name, 'must be a finite number, not an empty value');
  const value = Number(text);
  if (!Number.isFinite(value)) throw configError(name, 'must be a finite number');
  if (limits.integer && !Number.isInteger(value)) throw configError(name, 'must be an integer');
  if (value < limits.min || value > limits.max) throw configError(name, `must be between ${limits.min} and ${limits.max}`);
  if (limits.even && value % 2 !== 0) throw configError(name, 'must be an even number');
  return value;
}

function portValue(env, name, fallback, limits = CONFIG_LIMITS.port) {
  return numberValue(env, name, fallback, { ...limits, integer: true });
}

function endpointValue(env, name, fallback) {
  const value = stringValue(env, name, fallback, { maxLength: 512 }).trim();
  const separator = value.lastIndexOf(':');
  if (separator <= 0 || separator === value.length - 1) throw configError(name, 'must be HOST:PORT');
  const host = value.slice(0, separator).trim();
  const port = Number(value.slice(separator + 1));
  if (!host || /\s/.test(host) || !Number.isInteger(port) || port < PORT_MIN || port > PORT_MAX) {
    throw configError(name, 'must use a port between 1 and 65535');
  }
  return value;
}

function relativePathValue(env, name, fallback) {
  const value = stringValue(env, name, fallback, { maxLength: 256 }).trim();
  if (path.isAbsolute(value) || value.split(/[\\/]+/).includes('..')) {
    throw configError(name, 'must be a relative path without .. segments');
  }
  return value;
}

/**
 * Load the server configuration from an environment-like object.
 *
 * `here` is the server/bin directory, supplied by the entrypoint so tests can
 * use a temporary path without importing or launching the server itself.
 */
export function loadServerConfig({ env = process.env, here, log = () => {} } = {}) {
  if (!here) throw new Error('server configuration requires its entrypoint directory');

  const token = stringValue(env, 'STEAMBENCH_TOKEN', undefined, { maxLength: 4096 }).trim();
  const hostRuntimeDir = stringValue(env, 'STEAMBENCH_HOST_RUNTIME_DIR', '/etc/wolf');
  const gatewayPort = portValue(env, 'STEAMBENCH_GATEWAY_PORT', DEFAULTS.gatewayPort);
  const port = portValue(env, 'PORT', DEFAULTS.port);
  const portBase = numberValue(env, 'STEAMBENCH_PORT_BASE', DEFAULTS.portBase, CONFIG_LIMITS.portBase);
  const mediaPortEnd = portBase + 902;
  for (const [name, value] of [['PORT', port], ['STEAMBENCH_GATEWAY_PORT', gatewayPort]]) {
    if (value >= portBase && value <= mediaPortEnd) {
      throw configError(name, `port ${value} overlaps the room media allocation range ${portBase}-${mediaPortEnd}`);
    }
  }

  const wolfVideoPingPort = portValue(env, 'WOLF_VIDEO_PING_PORT', DEFAULTS.wolfVideoPingPort, CONFIG_LIMITS.wolfPingPort);
  const wolfAudioPingPort = portValue(env, 'WOLF_AUDIO_PING_PORT', DEFAULTS.wolfAudioPingPort, CONFIG_LIMITS.wolfPingPort);
  const fixedPorts = [
    ['PORT', port],
    ['STEAMBENCH_GATEWAY_PORT', gatewayPort],
    ['WOLF_VIDEO_PING_PORT', wolfVideoPingPort],
    ['WOLF_AUDIO_PING_PORT', wolfAudioPingPort],
  ];
  for (let index = 0; index < fixedPorts.length; index++) {
    const [name, value] = fixedPorts[index];
    const conflict = fixedPorts.slice(0, index).find(([, prior]) => prior === value);
    if (conflict) throw configError(name, `port ${value} must differ from ${conflict[0]}`);
  }
  for (const [name, value] of [['WOLF_VIDEO_PING_PORT', wolfVideoPingPort], ['WOLF_AUDIO_PING_PORT', wolfAudioPingPort]]) {
    if (value >= portBase && value <= mediaPortEnd) {
      throw configError(name, `port ${value} overlaps the room media allocation range ${portBase}-${mediaPortEnd}`);
    }
  }

  const cfg = {
    log,
    wolfSocket: stringValue(env, 'WOLF_SOCKET_PATH', '/etc/wolf/wolf.sock'),
    wolfConfigFile: stringValue(env, 'WOLF_CFG_FILE', '/etc/wolf/cfg/config.toml'),
    wolfContainer: stringValue(env, 'WOLF_CONTAINER', 'steambench-wolf'),
    runtimeDir: stringValue(env, 'STEAMBENCH_RUNTIME_DIR', '/etc/wolf'),
    hostRuntimeDir,
    roomsDir: stringValue(env, 'STEAMBENCH_ROOMS_DIR', '/etc/wolf/rooms'),
    roomsRel: relativePathValue(env, 'STEAMBENCH_ROOMS_REL', 'rooms'),
    // Docker resolves bind mounts on the host, so player containers need the
    // host path rather than the path visible inside the server container.
    hostRoomsDir: stringValue(env, 'STEAMBENCH_HOST_ROOMS_DIR', path.join(hostRuntimeDir, 'rooms')),
    historyDir: stringValue(env, 'STEAMBENCH_HISTORY_DIR', '/etc/steambench/history'),
    loginTemplateDir: stringValue(env, 'STEAMBENCH_LOGIN_TEMPLATE', '/etc/wolf/steam-login'),
    cacheDir: stringValue(env, 'STEAMBENCH_CACHE_DIR', '/etc/wolf/cache'),
    mediaDir: stringValue(env, 'STEAMBENCH_MEDIA_DIR', '/etc/wolf/media'),
    hostMediaDir: stringValue(env, 'STEAMBENCH_HOST_MEDIA_DIR', path.join(hostRuntimeDir, 'media')),
    skillsDir: stringValue(env, 'STEAMBENCH_SKILLS_SRC', path.join(here, '..', 'skills')),
    modDir: stringValue(env, 'STEAMBENCH_MOD_DIR', '/opt/sts2mcp'),
    hostSteam: stringValue(env, 'STEAMBENCH_HOST_STEAM', '/host/steam'),
    hostSteamOriginalPath: stringValue(env, 'STEAMBENCH_HOST_STEAM_PATH', '', { allowEmpty: true }),
    hostSts2: stringValue(env, 'STEAMBENCH_HOST_STS2', '/host/sts2'),
    roomImage: stringValue(env, 'STEAMBENCH_ROOM_IMAGE', 'ghcr.io/games-on-whales/steam:edge'),
    roomExtraEnv: stringValue(env, 'STEAMBENCH_ROOM_ENV', '', { allowEmpty: true, maxLength: 16384 }).split(';').map((s) => s.trim()).filter(Boolean),
    learningImage: learningProfile.image,
    learningProfile,
    learningKey: env[learningProfile.apiKeyEnv] ? String(env[learningProfile.apiKeyEnv]) : '',
    // Optional by design. Absent, the player never consults the System One
    // model and every decision takes the planner path it always took, so this
    // is deliberately not part of learningReadiness.
    systemOneKey: env[SYSTEM_ONE.apiKeyEnv] ? String(env[SYSTEM_ONE.apiKeyEnv]) : '',
    gatewayForAgents: endpointValue(env, 'STEAMBENCH_GATEWAY_FOR_AGENTS', `host.docker.internal:${gatewayPort}`),
    renderNode: stringValue(env, 'WOLF_RENDER_NODE', '/dev/dri/renderD128'),
    bufferCaps: stringValue(env, 'WOLF_VIDEO_BUFFER_CAPS', DEFAULT_BUFFER_CAPS),
    roomWidth: numberValue(env, 'STEAMBENCH_ROOM_WIDTH', DEFAULTS.roomWidth, CONFIG_LIMITS.roomWidth),
    roomHeight: numberValue(env, 'STEAMBENCH_ROOM_HEIGHT', DEFAULTS.roomHeight, CONFIG_LIMITS.roomHeight),
    roomFps: numberValue(env, 'STEAMBENCH_ROOM_FPS', DEFAULTS.roomFps, CONFIG_LIMITS.roomFps),
    streamWidth: numberValue(env, 'STEAMBENCH_STREAM_WIDTH', DEFAULTS.streamWidth, CONFIG_LIMITS.streamWidth),
    streamHeight: numberValue(env, 'STEAMBENCH_STREAM_HEIGHT', DEFAULTS.streamHeight, CONFIG_LIMITS.streamHeight),
    streamFps: numberValue(env, 'STEAMBENCH_STREAM_FPS', DEFAULTS.streamFps, CONFIG_LIMITS.streamFps),
    streamQuality: numberValue(env, 'STEAMBENCH_STREAM_QUALITY', DEFAULTS.streamQuality, CONFIG_LIMITS.streamQuality),
    streamBitrateKbps: numberValue(env, 'STEAMBENCH_STREAM_BITRATE', DEFAULTS.streamBitrateKbps, CONFIG_LIMITS.streamBitrateKbps),
    stillsFps: numberValue(env, 'STEAMBENCH_STILLS_FPS', DEFAULTS.stillsFps, CONFIG_LIMITS.stillsFps),
    fragmentMs: numberValue(env, 'STEAMBENCH_FRAGMENT_MS', DEFAULTS.fragmentMs, CONFIG_LIMITS.fragmentMs),
    audioBitrate: numberValue(env, 'STEAMBENCH_AUDIO_BITRATE', DEFAULTS.audioBitrate, CONFIG_LIMITS.audioBitrate),
    portBase,
    maxRooms: numberValue(env, 'STEAMBENCH_MAX_ROOMS', DEFAULTS.maxRooms, CONFIG_LIMITS.maxRooms),
    finishGraceS: numberValue(env, 'STEAMBENCH_FINISH_GRACE_S', DEFAULTS.finishGraceS, CONFIG_LIMITS.finishGraceS),
  };

  // These values are read directly by wolf.js. They are returned as well so
  // diagnostics can report the configuration that passed this startup gate.
  cfg.wolfVideoPingPort = wolfVideoPingPort;
  cfg.wolfAudioPingPort = wolfAudioPingPort;
  return { ...cfg, token, port, gatewayPort };
}
