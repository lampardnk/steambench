// Minimal client for the Wolf (games-on-whales) HTTP API over its unix socket.
// The observer session carries video/audio and the virtual mouse used for Steam
// QR interaction; gameplay actions go through STS2MCP.
import http from 'node:http';
import dgram from 'node:dgram';

export const WOLF_VIDEO_PING_PORT = Number(process.env.WOLF_VIDEO_PING_PORT || 58100);
export const WOLF_AUDIO_PING_PORT = Number(process.env.WOLF_AUDIO_PING_PORT || 58200);
export const WOLF_HOST = process.env.WOLF_HOST || '127.0.0.1';

export const DEFAULT_WOLF_SOCKET = process.env.WOLF_SOCKET_PATH || '/etc/wolf/wolf.sock';
export const NVIDIA_BUFFER_CAPS = 'video/x-raw(memory:CUDAMemory)';

// Moonlight control protocol constants (see wolf src/moonlight-protocol/moonlight/control.hpp).
const INPUT_DATA = 0x0206;
const INPUT_TYPE = {
  MOUSE_MOVE_ABS: 0x00000005, MOUSE_BUTTON_PRESS: 0x00000008, MOUSE_BUTTON_RELEASE: 0x00000009,
};
export const MOUSE_BUTTONS = { left: 1, middle: 2, right: 3 };
const ZERO16 = new Array(16).fill(0);

function inputHeader(type, payloadLen) {
  const b = Buffer.alloc(12);
  b.writeUInt16LE(INPUT_DATA, 0);
  b.writeUInt16LE(12 + payloadLen, 2);
  b.writeUInt32LE(payloadLen, 4);
  b.writeUInt32LE(type, 8);
  return b;
}

/**
 * Absolute mouse move. Wolf reads x/y/width/height as BIG endian and maps them
 * proportionally onto the session's display mode, so any consistent
 * width/height pair works as long as x/y are in the same space.
 */
export function encodeMouseMoveAbs({ x, y, width, height }) {
  const p = Buffer.alloc(10);
  p.writeInt16BE(clamp(x, 0, 32767), 0);
  p.writeInt16BE(clamp(y, 0, 32767), 2);
  p.writeInt16BE(0, 4); // unused
  p.writeInt16BE(clamp(width, 1, 32767), 6);
  p.writeInt16BE(clamp(height, 1, 32767), 8);
  return Buffer.concat([inputHeader(INPUT_TYPE.MOUSE_MOVE_ABS, p.length), p]).toString('hex').toUpperCase();
}

export function encodeMouseButton(button = 'left', press = true) {
  const p = Buffer.alloc(1);
  p.writeUInt8(MOUSE_BUTTONS[button] || 1, 0);
  return Buffer.concat([inputHeader(press ? INPUT_TYPE.MOUSE_BUTTON_PRESS : INPUT_TYPE.MOUSE_BUTTON_RELEASE, p.length), p]).toString('hex').toUpperCase();
}

function clamp(v, lo, hi) { v = Math.round(Number(v) || 0); return v < lo ? lo : v > hi ? hi : v; }

export class WolfClient {
  constructor(socketPath = DEFAULT_WOLF_SOCKET) { this.socketPath = socketPath; }

  request(method, path, body, { timeoutMs = 30000 } = {}) {
    const payload = body === undefined ? null : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = http.request({
        socketPath: this.socketPath, path: `/api/v1${path}`, method,
        headers: payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {},
        timeout: timeoutMs,
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch { /* not json */ }
          if (res.statusCode >= 400 || (json && json.success === false)) {
            const err = new Error(`wolf ${method} ${path} -> ${res.statusCode}: ${json?.error || text.slice(0, 300)}`);
            err.status = res.statusCode; err.body = json || text;
            reject(err);
          } else resolve(json ?? text);
        });
      });
      req.on('timeout', () => req.destroy(new Error(`wolf ${method} ${path} timed out`)));
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  listLobbies() { return this.request('GET', '/lobbies').then((r) => r.lobbies || []); }
  listSessions() { return this.request('GET', '/sessions').then((r) => r.sessions || []); }
  listApps() { return this.request('GET', '/apps').then((r) => r.apps || []); }

  /** Create a lobby (container + virtual display). Resolves to the lobby id once Wolf reports setup done. */
  async createLobby({ name, profileId = 'steambench', width, height, fps = 60, renderNode, bufferCaps, runnerStateFolder, runner, pin = null, stopWhenEveryoneLeaves = false }) {
    const body = {
      profile_id: profileId, name, icon_png_path: null, multi_user: true, pin,
      stop_when_everyone_leaves: stopWhenEveryoneLeaves,
      video_settings: { width, height, refresh_rate: fps, wayland_render_node: renderNode, runner_render_node: renderNode, video_producer_buffer_caps: bufferCaps },
      audio_settings: { channel_count: 2 },
      client_settings: { run_uid: 1000, run_gid: 1000 },
      runner_state_folder: runnerStateFolder,
      runner,
    };
    const res = await this.request('POST', '/lobbies/create', body, { timeoutMs: 40000 });
    return res.lobby_id;
  }

  stopLobby(lobbyId, pin = null) { return this.request('POST', '/lobbies/stop', { lobby_id: lobbyId, pin }); }
  joinLobby(lobbyId, sessionId, pin = null) { return this.request('POST', '/lobbies/join', { lobby_id: lobbyId, moonlight_session_id: String(sessionId), pin }); }
  leaveLobby(lobbyId, sessionId) { return this.request('POST', '/lobbies/leave', { lobby_id: lobbyId, moonlight_session_id: String(sessionId) }); }

  /** Add a headless stream session (dummy app: idle process + its own tiny compositor). */
  async addSession({ width = 640, height = 360, fps = 30, appId = null, clientId = null } = {}) {
    const body = {
      client_ip: '127.0.0.1', aes_key: '', aes_iv: '', rtsp_fake_ip: '127.0.0.1',
      video_width: width, video_height: height, video_refresh_rate: fps, audio_channel_count: 2,
    };
    if (appId) body.app_id = appId;
    if (clientId) body.client_id = String(clientId);
    const res = await this.request('POST', '/sessions/add', body);
    return String(res.session_id);
  }

  /** Start the session's video consumer with a custom GStreamer pipeline (our MJPEG tcpserversink). */
  startSession(sessionId, { width, height, fps = 60, gstPipeline, pingPort = 9999, audioPipeline = '', audioPingPort = 9998 }) {
    return this.request('POST', '/sessions/start', {
      session_id: String(sessionId),
      video_session: {
        display_mode: { width, height, refreshRate: fps }, gst_pipeline: gstPipeline, render_node: '',
        session_id: String(sessionId), port: pingPort, wait_for_ping: true, timeout_ms: 2147483647, packet_size: 1024,
        frames_with_invalid_ref_threshold: -1, fec_percentage: 20, min_required_fec_packets: 2,
        bitrate_kbps: 10000, slices_per_frame: 1, color_range: 'JPEG', color_space: 'BT601', client_ip: '127.0.0.1',
        rtp_secret_payload: ZERO16,
      },
      audio_session: {
        gst_pipeline: audioPipeline, session_id: String(sessionId), encrypt_audio: false, aes_key: '', aes_iv: '', wait_for_ping: true,
        port: audioPingPort, client_ip: '127.0.0.1', packet_duration: 5, rtp_secret_payload: ZERO16,
        audio_mode: { channels: 2, streams: 1, coupled_streams: 1, speakers: ['FRONT_LEFT', 'FRONT_RIGHT'], bitrate: 96000, sample_rate: 48000 },
      },
    });
  }

  /**
   * Wolf only starts a session's video pipeline after an RTP "ping" from the client.
   * The legacy 4-byte ping matches on source ip:port == the session's client_ip:port,
   * so bind the given local port, send PING to Wolf's video ping port, and close.
   */
  sendAudioPing(fromPort, opts = {}) { return this.sendVideoPing(fromPort, { toPort: WOLF_AUDIO_PING_PORT, ...opts }); }

  sendVideoPing(fromPort, { host = WOLF_HOST, toPort = WOLF_VIDEO_PING_PORT, attempts = 3 } = {}) {
    return new Promise((resolve, reject) => {
      const sock = dgram.createSocket('udp4');
      sock.on('error', (e) => { try { sock.close(); } catch { /* closed */ } reject(e); });
      sock.bind(fromPort, host, () => {
        let sent = 0;
        const tick = () => {
          sock.send(Buffer.from('PING'), toPort, host, (err) => {
            if (err) { sock.close(); return reject(err); }
            if (++sent >= attempts) { sock.close(); return resolve(); }
            setTimeout(tick, 150);
          });
        };
        tick();
      });
    });
  }

  stopSession(sessionId) { return this.request('POST', '/sessions/stop', { session_id: String(sessionId) }); }
  sendInput(sessionId, hex) { return this.request('POST', '/sessions/input', { session_id: String(sessionId), input_packet_hex: hex }, { timeoutMs: 5000 }); }
}

/** MJPEG consumer pipeline: scales on the GPU, downloads, throttles, encodes JPEG, serves multipart over TCP. */
export function mjpegPipeline({ port, outWidth = 960, outHeight = 540, fps = 5, quality = 80, host = '127.0.0.1' }) {
  return [
    'interpipesrc name=interpipesrc_{session_id}_video listen-to={session_id}_video is-live=true stream-sync=restart-ts max-bytes=0 max-buffers=1 leaky-type=downstream',
    'queue leaky=downstream max-size-buffers=1',
    'cudaconvertscale add-borders=true',
    `video/x-raw(memory:CUDAMemory), format=I420, width=${outWidth}, height=${outHeight}, pixel-aspect-ratio=1/1`,
    'cudadownload',
    'videorate drop-only=true',
    `video/x-raw, framerate=${fps}/1`,
    `jpegenc quality=${quality}`,
    'multipartmux boundary=steambench',
    `tcpserversink host=${host} port=${port} sync=false recover-policy=keyframe`,
  ].join(' ! ');
}

/** MP3 consumer pipeline for the room's audio, served over TCP for browsers (<audio src=...mp3>). */
export function mp3Pipeline({ port, bitrate = 128, host = '127.0.0.1' }) {
  return [
    'interpipesrc name=interpipesrc_{session_id}_audio listen-to={session_id}_audio is-live=true stream-sync=restart-ts max-bytes=0 max-buffers=3 block=false',
    'queue max-size-buffers=3 leaky=downstream',
    'audiorate', 'audioconvert', 'audioresample',
    `lamemp3enc target=bitrate bitrate=${bitrate} cbr=true`,
    `tcpserversink host=${host} port=${port} sync=false recover-policy=latest`,
  ].join(' ! ');
}

/**
 * Video half of a room's stream, for the session's own video pipeline.
 *
 * The interpipesrc keeps Wolf's naming (`interpipesrc_<session>_video`) and
 * listens to the session's own producer: Wolf repoints it at the lobby when the
 * session joins. Pointing it straight at the lobby never negotiates.
 *
 * Encoding is done on the CPU with x264: the NVENC elements cannot take frames
 * from this producer (they refuse to negotiate, having no share of the CUDA
 * context Wolf created for it), while downloading once and encoding with
 * x264enc works and costs little at 720p.
 *
 * Frames are rate-capped once, then split: fragmented MP4 for the browser, and
 * a slow JPEG branch for still frames (the player's screenshot tool, and the
 * fallback view for browsers without Media Source Extensions).
 */
export function roomVideoPipeline({
  width = 1280, height = 720, fps = 30, bitrateKbps = 4000,
  fmp4Fifo, jpegPort, jpegFps = 2, jpegQuality = 80, fragmentMs = 500, host = '127.0.0.1',
}) {
  const gop = Math.max(2, Math.round((fps * fragmentMs) / 1000));
  const source = [
    'interpipesrc name=interpipesrc_{session_id}_video listen-to={session_id}_video is-live=true stream-sync=restart-ts max-bytes=0 max-buffers=1 leaky-type=downstream',
    'queue leaky=downstream max-size-buffers=3',
    'cudaconvertscale add-borders=true',
    `video/x-raw(memory:CUDAMemory), format=I420, width=${width}, height=${height}, pixel-aspect-ratio=1/1`,
    'cudadownload',
    'videorate drop-only=true',
    `video/x-raw, framerate=${fps}/1`,
    'tee name=steambench_tee',
  ].join(' ! ');

  const encoded = [
    'steambench_tee.',
    'queue leaky=downstream max-size-buffers=4',
    'videoconvert',
    `x264enc speed-preset=veryfast tune=zerolatency bitrate=${bitrateKbps} key-int-max=${gop}`,
    'h264parse',
    'video/x-h264, stream-format=avc, alignment=au',
    `mp4mux fragment-duration=${fragmentMs} streamable=true`,
    `filesink location=${fmp4Fifo} sync=false buffer-mode=2 async=false`,
  ].join(' ! ');

  const stills = [
    'steambench_tee.',
    'queue leaky=downstream max-size-buffers=1',
    'videorate drop-only=true',
    `video/x-raw, framerate=${jpegFps}/1`,
    'videoconvert',
    `jpegenc quality=${jpegQuality}`,
    'multipartmux boundary=steambench',
    `tcpserversink host=${host} port=${jpegPort} sync=false recover-policy=keyframe`,
  ].join(' ! ');

  return [source, encoded, stills].join(' ');
}

/** Audio half: AAC in fragmented MP4, played as a second MSE track. */
export function roomAudioPipeline({ fmp4Fifo, bitrate = 128000, fragmentMs = 500 }) {
  return [
    'interpipesrc name=interpipesrc_{session_id}_audio listen-to={session_id}_audio is-live=true stream-sync=restart-ts max-bytes=0 max-buffers=3 leaky-type=downstream',
    'queue leaky=downstream max-size-buffers=16',
    'audiorate',
    'audioconvert',
    'audioresample',
    'audio/x-raw, format=S16LE',
    `fdkaacenc bitrate=${bitrate}`,
    'aacparse',
    `mp4mux fragment-duration=${fragmentMs} streamable=true`,
    `filesink location=${fmp4Fifo} sync=false buffer-mode=2 async=false`,
  ].join(' ! ');
}
