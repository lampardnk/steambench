'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiUrl, wsUrl, type RoomSummary, type Settings } from '@/lib/backend'

// The room's picture and sound. The server sends fragmented MP4 over a
// WebSocket (video and audio as separate tracks), which Media Source
// Extensions feeds to one <video> element: no seek bar to drag, no second
// element to start by hand, and the two stay in sync. If MSE or the socket is
// unavailable we fall back to the still-frame MJPEG stream, which has no sound.
const TRACK = { videoInit: 0, audioInit: 1, videoFragment: 2, audioFragment: 3 } as const
const LIVE_SLACK_S = 1.5
const KEEP_BEHIND_S = 12

type Hello = { type: 'hello'; video: string; audio: string; width: number; height: number; fps: number }

/** Serialises appendBuffer calls, which a SourceBuffer requires. */
class Appender {
  private queue: Uint8Array[] = []
  private busy = false
  constructor(private buffer: SourceBuffer) {
    buffer.addEventListener('updateend', () => {
      this.busy = false
      this.flush()
    })
  }
  push(data: Uint8Array) {
    this.queue.push(data)
    this.flush()
  }
  private flush() {
    if (this.busy || !this.queue.length) return
    const next = this.queue.shift()!
    try {
      this.busy = true
      this.buffer.appendBuffer(next as unknown as BufferSource)
    } catch {
      this.busy = false
      this.queue.length = 0
    }
  }
  get updating() {
    return this.busy
  }
}

export function GameView({ settings, room }: { settings: Settings; room: RoomSummary }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [mode, setMode] = useState<'live' | 'stills'>('live')
  const [muted, setMuted] = useState(true)
  const [status, setStatus] = useState('connecting…')
  const [tick, setTick] = useState(0)
  // A dropped socket used to say "reconnecting…" and then never reconnect.
  // Bumping this rebuilds the MediaSource and the socket; after several failed
  // attempts we fall back to still frames rather than sitting on a dead player.
  const [attempt, setAttempt] = useState(0)
  const failures = useRef(0)

  const supported = typeof window !== 'undefined' && typeof window.MediaSource !== 'undefined'

  useEffect(() => {
    if (!supported) {
      setMode('stills')
      setStatus('this browser cannot play the live stream')
    }
  }, [supported])

  // Poll the still image when we are in fallback mode.
  useEffect(() => {
    if (mode !== 'stills') return
    const t = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [mode])

  const connect = useCallback(() => {
    const video = videoRef.current
    if (!video || !supported) return () => {}

    const ms = new MediaSource()
    video.src = URL.createObjectURL(ms)
    video.muted = true
    let ws: WebSocket | null = null
    let videoAppender: Appender | null = null
    let audioAppender: Appender | null = null
    let closed = false
    let hello: Hello | null = null
    let retry: ReturnType<typeof setTimeout> | undefined

    const addBuffers = () => {
      if (!hello || ms.readyState !== 'open') return
      try {
        if (!videoAppender && hello.video) {
          const sb = ms.addSourceBuffer(`video/mp4; codecs="${hello.video}"`)
          sb.mode = 'segments'
          videoAppender = new Appender(sb)
        }
        if (!audioAppender && hello.audio) {
          const sb = ms.addSourceBuffer(`audio/mp4; codecs="${hello.audio}"`)
          sb.mode = 'segments'
          audioAppender = new Appender(sb)
        }
      } catch (e) {
        setStatus(`stream not playable here (${(e as Error).message}); showing still frames`)
        setMode('stills')
      }
    }

    ms.addEventListener('sourceopen', () => {
      try {
        ms.duration = Number.POSITIVE_INFINITY
      } catch {
        /* some browsers reject an infinite duration; harmless */
      }
      addBuffers()
    })

    ws = new WebSocket(wsUrl(settings, `/api/rooms/${room.id}/media`))
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => setStatus('waiting for the first frames…')
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        hello = JSON.parse(ev.data) as Hello
        addBuffers()
        return
      }
      const bytes = new Uint8Array(ev.data as ArrayBuffer)
      const tag = bytes[0]
      const payload = bytes.subarray(1)
      addBuffers()
      if (tag === TRACK.videoInit || tag === TRACK.videoFragment) videoAppender?.push(payload)
      if (tag === TRACK.audioInit || tag === TRACK.audioFragment) audioAppender?.push(payload)
      if (tag === TRACK.videoInit) {
        failures.current = 0
        setStatus('')
        video.play().catch(() => setStatus('press play to start'))
      }
    }
    ws.onerror = () => setStatus('stream connection failed')
    ws.onclose = () => {
      if (closed) return
      failures.current += 1
      if (failures.current > 4) {
        setStatus('live stream keeps dropping; showing still frames')
        setMode('stills')
        return
      }
      const wait = Math.min(1000 * failures.current, 5000)
      setStatus(`stream disconnected, reconnecting in ${Math.round(wait / 1000)}s…`)
      retry = setTimeout(() => setAttempt((n) => n + 1), wait)
    }

    // Stay at the live edge and keep the buffer short.
    const keeper = setInterval(() => {
      if (!video.buffered.length) return
      const end = video.buffered.end(video.buffered.length - 1)
      if (end - video.currentTime > LIVE_SLACK_S) video.currentTime = end - 0.3
      const start = video.buffered.start(0)
      if (video.currentTime - start > KEEP_BEHIND_S * 2 && !videoAppender?.updating && ms.readyState === 'open') {
        for (const sb of Array.from(ms.sourceBuffers)) {
          if (!sb.updating) {
            try {
              sb.remove(start, video.currentTime - KEEP_BEHIND_S)
            } catch {
              /* the browser will drop old data on its own */
            }
          }
        }
      }
    }, 2000)

    return () => {
      closed = true
      clearTimeout(retry)
      clearInterval(keeper)
      try { ws?.close() } catch { /* already closed */ }
      try { if (ms.readyState === 'open') ms.endOfStream() } catch { /* not open */ }
      URL.revokeObjectURL(video.src)
      video.removeAttribute('src')
      video.load()
    }
  }, [settings, room.id, supported])

  useEffect(() => {
    if (mode !== 'live') return
    const cleanup = connect()
    return cleanup
    // `attempt` is the reconnect trigger: changing it tears the stream down and builds a new one.
  }, [connect, mode, attempt])

  /** Manual retry from stills, which also clears the failure count. */
  const backToLive = () => {
    failures.current = 0
    setStatus('connecting…')
    setMode('live')
    setAttempt((n) => n + 1)
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    const next = !muted
    video.muted = next
    setMuted(next)
    if (!next) video.play().catch(() => {})
  }

  const stillSrc = apiUrl(settings, `/api/rooms/${room.id}/frame.jpg`, { t: String(tick) })

  return (
    <div className="rounded-lg border border-border bg-black">
      <div className="relative aspect-video w-full overflow-hidden rounded-t-lg">
        {mode === 'live' ? (
          <video ref={videoRef} className="h-full w-full object-contain" playsInline autoPlay muted />
        ) : room.frames > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stillSrc} alt="game" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">waiting for the first frame…</div>
        )}
        {status && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-3 py-1 text-center text-xs text-neutral-200">{status}</div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs text-neutral-300">
        {mode === 'live' ? (
          <button onClick={toggleMute} className="rounded border border-neutral-600 px-2 py-1 hover:bg-neutral-800">
            {muted ? '🔇 unmute' : '🔊 mute'}
          </button>
        ) : (
          <span className="text-neutral-500">still frames only (no sound)</span>
        )}
        <button
          onClick={() => (mode === 'live' ? setMode('stills') : backToLive())}
          className="rounded border border-neutral-600 px-2 py-1 hover:bg-neutral-800"
          disabled={!supported && mode === 'stills'}
        >
          {mode === 'live' ? 'switch to still frames' : 'switch to live video'}
        </button>
        <span className="text-neutral-500">
          {room.media?.ready ? `${room.media.width}×${room.media.height} · ${room.media.codecs}` : `${room.frames} still frames`}
        </span>
      </div>
    </div>
  )
}
