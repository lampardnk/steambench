// Reads the MJPEG stream Wolf's consumer pipeline serves over TCP
// (multipartmux ! tcpserversink) and keeps the latest JPEG frame.
import net from 'node:net';
import { EventEmitter } from 'node:events';

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);
const MAX_BUFFER = 8 * 1024 * 1024;

export class MjpegReader extends EventEmitter {
  constructor({ host = '127.0.0.1', port }) {
    super();
    this.host = host;
    this.port = port;
    this.latest = null;
    this.latestAt = 0;
    this.frames = 0;
    this.stopped = false;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.retryMs = 500;
  }

  start() { this.stopped = false; this._connect(); return this; }

  stop() {
    this.stopped = true;
    if (this.socket) { this.socket.destroy(); this.socket = null; }
    clearTimeout(this.timer);
  }

  _connect() {
    if (this.stopped) return;
    const sock = net.connect(this.port, this.host);
    this.socket = sock;
    sock.on('connect', () => { this.retryMs = 500; this.emit('connected'); });
    sock.on('data', (chunk) => this._onData(chunk));
    const retry = () => {
      if (this.stopped) return;
      this.socket = null;
      this.timer = setTimeout(() => this._connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 5000);
    };
    sock.on('error', () => { /* handled by close */ });
    sock.on('close', retry);
  }

  _onData(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    for (;;) {
      const start = this.buffer.indexOf(SOI);
      if (start < 0) { this.buffer = Buffer.alloc(0); return; }
      const end = this.buffer.indexOf(EOI, start + 2);
      if (end < 0) {
        if (start > 0) this.buffer = this.buffer.subarray(start);
        if (this.buffer.length > MAX_BUFFER) this.buffer = Buffer.alloc(0);
        return;
      }
      const frame = Buffer.from(this.buffer.subarray(start, end + 2));
      this.buffer = this.buffer.subarray(end + 2);
      this.latest = frame;
      this.latestAt = Date.now();
      this.frames += 1;
      this.emit('frame', frame);
    }
  }
}
