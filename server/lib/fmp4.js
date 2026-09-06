// Relay for the room's fragmented-MP4 stream (H.264 + AAC produced by
// GStreamer's mp4mux). It reads one TCP connection from the room's pipeline,
// keeps the init segment (ftyp/moov) so a browser joining later can still
// start, and hands whole fragments to each viewer.
//
// This replaces the old MJPEG-plus-separate-MP3 pair: one stream, real video
// codec, audio in sync, and nothing for the browser to seek.
import fs from 'node:fs';
import net from 'node:net';
import { EventEmitter } from 'node:events';

const MAX_PENDING = 32 * 1024 * 1024;

/** Walk top-level MP4 boxes in `buf`, returning [{type, start, end}] for complete boxes. */
function boxes(buf) {
  const out = [];
  let off = 0;
  while (off + 8 <= buf.length) {
    const size = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    if (size < 8) break; // 0 = to end of file, 1 = 64-bit; neither appears in this stream
    if (off + size > buf.length) break;
    out.push({ type, start: off, end: off + size });
    off += size;
  }
  return out;
}

/** Build the browser codec string from the avcC box inside the init segment. */
function codecsFromInit(init) {
  const parts = [];
  const idx = init.indexOf(Buffer.from('avcC', 'latin1'));
  if (idx > 0 && idx + 8 <= init.length) {
    const hex = (n) => n.toString(16).padStart(2, '0');
    parts.push(`avc1.${hex(init[idx + 5])}${hex(init[idx + 6])}${hex(init[idx + 7])}`);
  }
  if (init.indexOf(Buffer.from('mp4a', 'latin1')) > 0) parts.push('mp4a.40.2');
  return parts.join(',');
}

export class Fmp4Relay extends EventEmitter {
  /**
   * Reads from a FIFO the room's pipeline writes to. A FIFO rather than a TCP
   * sink because mp4mux publishes no stream header: a reader that arrives after
   * the first fragment can never learn the init segment, so we open the pipe
   * before the pipeline starts and read it from its first byte.
   */
  constructor({ fifo }) {
    super();
    this.fifo = fifo;
    this.init = null;        // ftyp + moov
    this.codecs = '';
    this.pending = Buffer.alloc(0);
    this.fragments = 0;
    this.bytes = 0;
    this.lastFragmentAt = 0;
    this.stopped = false;
    this.socket = null;
    this.retryMs = 500;
  }

  start() { this.stopped = false; this._connect(); return this; }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    if (this.socket) { this.socket.destroy(); this.socket = null; }
  }

  _connect() {
    if (this.stopped) return;
    try {
      if (!fs.existsSync(this.fifo)) { this.timer = setTimeout(() => this._connect(), 500); return; }
      // O_RDWR keeps a writer on the pipe at all times, so an empty pipe reads
      // as "nothing yet" instead of end-of-file before the pipeline starts.
      const fd = fs.openSync(this.fifo, fs.constants.O_RDWR | fs.constants.O_NONBLOCK);
      // A net.Socket polls the pipe through libuv; fs.createReadStream cannot
      // read a non-blocking FIFO (it errors on EAGAIN and closes silently).
      const stream = new net.Socket({ fd, readable: true, writable: false });
      this.socket = stream;
      stream.on('data', (chunk) => this._onData(chunk));
      stream.on('error', (e) => this.emit('warn', `media pipe ${this.fifo}: ${e.message}`));
      stream.on('close', () => {
        if (this.stopped) return;
        this.socket = null;
        this.init = null;
        this.pending = Buffer.alloc(0);
        this.timer = setTimeout(() => this._connect(), 500);
      });
      stream.resume();
      this.emit('connected');
    } catch (e) {
      this.emit('warn', `media pipe ${this.fifo}: ${e.message}`);
      this.timer = setTimeout(() => this._connect(), 500);
    }
  }

  _onData(chunk) {
    this.bytes += chunk.length;
    this.pending = this.pending.length ? Buffer.concat([this.pending, chunk]) : chunk;
    if (this.pending.length > MAX_PENDING) { this.pending = Buffer.alloc(0); return; }

    const found = boxes(this.pending);
    if (!found.length) return;

    if (!this.init) {
      // Everything before the first moof is the init segment.
      const firstMoof = found.findIndex((b) => b.type === 'moof');
      if (firstMoof <= 0) return; // wait until we have at least one box plus a moof
      const init = Buffer.from(this.pending.subarray(0, found[firstMoof].start));
      this.init = init;
      this.codecs = codecsFromInit(init);
      this.pending = this.pending.subarray(found[firstMoof].start);
      this.emit('init', init, this.codecs);
      return this._onData(Buffer.alloc(0));
    }

    // Emit whole fragments: a moof and everything up to the next moof.
    let cut = 0;
    const local = boxes(this.pending);
    for (let i = 0; i < local.length; i++) {
      if (local[i].type !== 'moof') continue;
      let end = this.pending.length;
      for (let j = i + 1; j < local.length; j++) {
        if (local[j].type === 'moof') { end = local[j].start; break; }
        end = local[j].end;
      }
      const nextMoof = local.slice(i + 1).find((b) => b.type === 'moof');
      if (!nextMoof && local[local.length - 1].end !== this.pending.length) break;
      if (!nextMoof && !local.some((b) => b.type === 'mdat' && b.start > local[i].start)) break;
      const fragment = Buffer.from(this.pending.subarray(local[i].start, end));
      this.fragments += 1;
      this.lastFragmentAt = Date.now();
      this.emit('fragment', fragment);
      cut = end;
      if (!nextMoof) break;
    }
    if (cut > 0) this.pending = this.pending.subarray(cut);
  }
}
