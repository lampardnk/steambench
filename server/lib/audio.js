// Reads the MP3 stream Wolf's audio consumer serves over TCP and fans it out
// to any number of HTTP listeners (browsers play a chunked audio/mpeg stream natively).
import net from 'node:net';
import { EventEmitter } from 'node:events';

export class AudioRelay extends EventEmitter {
  constructor({ host = '127.0.0.1', port }) {
    super();
    this.host = host;
    this.port = port;
    this.stopped = false;
    this.socket = null;
    this.retryMs = 500;
    this.bytes = 0;
    this.listeners_ = new Set();
  }

  start() { this.stopped = false; this._connect(); return this; }
  stop() { this.stopped = true; clearTimeout(this.timer); this.socket?.destroy(); this.socket = null; for (const l of this.listeners_) l.end(); this.listeners_.clear(); }

  /** Attach an HTTP response (already has headers written). */
  attach(res) {
    this.listeners_.add(res);
    const done = () => this.listeners_.delete(res);
    res.on('close', done);
    res.on('error', done);
  }

  _connect() {
    if (this.stopped) return;
    const sock = net.connect(this.port, this.host);
    this.socket = sock;
    sock.on('connect', () => { this.retryMs = 500; });
    sock.on('data', (chunk) => {
      this.bytes += chunk.length;
      for (const l of this.listeners_) { if (!l.writableEnded) l.write(chunk); }
    });
    sock.on('error', () => { /* handled by close */ });
    sock.on('close', () => {
      if (this.stopped) return;
      this.socket = null;
      this.timer = setTimeout(() => this._connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 5000);
    });
  }
}
