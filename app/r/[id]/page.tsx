'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { api, apiUrl, wsUrl, STAGE_LABELS, type LibraryGame, type Meta, type PadEvent, type RoomSummary, type TranscriptItem } from '@/lib/backend'
import { SettingsBar, useSettings } from '@/components/settings-bar'
import { ControllerView } from '@/components/controller'
import { SteamLogin } from '@/components/steam-login'
import { Transcript } from '@/components/transcript'

type WsMessage =
  | { type: 'snapshot'; room: RoomSummary; transcript: TranscriptItem[]; padHistory: PadEvent[]; log: string[] }
  | { type: 'item'; item: TranscriptItem }
  | { type: 'delta'; id: string; kind: string; delta: string }
  | { type: 'agent_status'; status: string }
  | { type: 'pad'; event: PadEvent }
  | { type: 'room'; room: RoomSummary }
  | { type: 'log'; line: string }
  | { type: 'error'; message: string }

export default function RoomPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [settings, setSettings, loaded] = useSettings()
  const configured = Boolean(settings.backendUrl && settings.token)
  const [room, setRoom] = useState<RoomSummary | null>(null)
  const [items, setItems] = useState<TranscriptItem[]>([])
  const [pads, setPads] = useState<PadEvent[]>([])
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!loaded || !configured || !id) return
    let closed = false
    let ws: WebSocket
    let retry: ReturnType<typeof setTimeout>
    const connect = () => {
      ws = new WebSocket(wsUrl(settings, `/api/rooms/${id}/ws`))
      wsRef.current = ws
      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        if (!closed) retry = setTimeout(connect, 2000)
      }
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as WsMessage
        if (msg.type === 'snapshot') {
          setRoom(msg.room)
          setItems(msg.transcript)
          setPads(msg.padHistory)
          setLog(msg.log)
        } else if (msg.type === 'item') {
          setItems((prev) => {
            const i = prev.findIndex((x) => x.id === msg.item.id)
            if (i >= 0) {
              const next = prev.slice()
              next[i] = msg.item
              return next
            }
            return [...prev, msg.item].slice(-400)
          })
        } else if (msg.type === 'delta') {
          setItems((prev) => {
            const i = prev.findIndex((x) => x.id === msg.id)
            if (i < 0) return [...prev, { id: msg.id, t: Date.now(), kind: msg.kind as TranscriptItem['kind'], text: msg.delta }]
            const next = prev.slice()
            next[i] = { ...next[i], text: (next[i].text || '') + msg.delta }
            return next
          })
        } else if (msg.type === 'pad') {
          setPads((prev) => [...prev, msg.event].slice(-300))
        } else if (msg.type === 'room') {
          setRoom(msg.room)
        } else if (msg.type === 'log') {
          setLog((prev) => [...prev, msg.line].slice(-500))
        } else if (msg.type === 'error') {
          setError(msg.message)
        }
      }
    }
    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      ws?.close()
    }
  }, [loaded, configured, id, settings])

  const send = (obj: object) => wsRef.current?.readyState === WebSocket.OPEN && wsRef.current.send(JSON.stringify(obj))

  const remove = async () => {
    if (!room || !confirm('Delete this room? Its history is archived first.')) return
    await api(settings, `/api/rooms/${room.id}`, { method: 'DELETE' })
    window.location.href = '/'
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <SettingsBar settings={settings} onChange={setSettings} status={room ? `${room.name} · ${STAGE_LABELS[room.stage] || room.stage}` : connected ? 'connected' : 'connecting…'} />
      <div className="mx-auto max-w-7xl px-4 py-4">
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        {!room && <p className="text-sm text-muted-foreground">{configured ? 'Loading room…' : 'Configure the server URL and token first.'}</p>}
        {room && (
          <>
            <header className="mb-3 flex flex-wrap items-center gap-3">
              <a href="/" className="text-sm text-muted-foreground hover:underline">
                ← rooms
              </a>
              <h1 className="text-lg font-semibold">{room.name}</h1>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{STAGE_LABELS[room.stage] || room.stage}</span>
              <span className="text-sm text-muted-foreground">{room.detail}</span>
              <div className="flex-1" />
              <button onClick={remove} className="rounded-md border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                delete room
              </button>
            </header>

            <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
              <section className="flex flex-col gap-3">
                <GameView settings={settings} room={room} />
                {room.stage === 'login' && <SteamLogin room={room} />}
                {room.stage === 'setup' && <SetupForm settings={settings} room={room} onDone={(r) => setRoom(r)} />}
                {room.stage === 'finished' && room.finish && (
                  <div className="rounded-md border border-border bg-card p-3 text-sm">
                    <div className="font-medium">Run {room.finish.result}</div>
                    <p className="text-muted-foreground">{room.finish.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">The room is archived and will close automatically. See it later under history.</p>
                  </div>
                )}
                <ControllerView last={pads[pads.length - 1] || room.lastPad} history={pads} />
              </section>
              <section className="flex flex-col gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>player: {room.setup?.player.name || 'not chosen'}</span>
                    <span>· {room.agentStatus}</span>
                    {room.agentStatus === 'running' && (
                      <button onClick={() => send({ type: 'abort' })} className="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-muted">
                        abort turn
                      </button>
                    )}
                  </div>
                  <Transcript items={items} />
                  <ChatBox disabled={!['playing', 'finished'].includes(room.stage) || room.agentStatus === 'stopped'} onSend={(m) => send({ type: 'chat', message: m })} />
                </div>
                <RoomInfo room={room} log={log} />
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function GameView({ settings, room }: { settings: ReturnType<typeof useSettings>[0]; room: RoomSummary }) {
  const [mode, setMode] = useState<'stream' | 'poll'>('stream')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (mode !== 'poll') return
    const t = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [mode])
  const src = mode === 'stream' ? apiUrl(settings, `/api/rooms/${room.id}/stream.mjpg`) : apiUrl(settings, `/api/rooms/${room.id}/frame.jpg`, { t: String(tick) })
  return (
    <div className="rounded-lg border border-border bg-black">
      <div className="aspect-video w-full overflow-hidden rounded-t-lg">
        {room.frames > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="game stream" className="h-full w-full object-contain" onError={() => setMode('poll')} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">waiting for the first frame…</div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs text-neutral-300">
        <audio controls preload="none" className="h-8" src={apiUrl(settings, `/api/rooms/${room.id}/audio.mp3`)} />
        <span>{room.frames} frames</span>
        <button onClick={() => setMode(mode === 'stream' ? 'poll' : 'stream')} className="rounded border border-neutral-600 px-1.5 py-0.5 hover:bg-neutral-800">
          video: {mode === 'stream' ? 'live (mjpeg)' : 'snapshots (1/s)'}
        </button>
      </div>
    </div>
  )
}

function SetupForm({ settings, room, onDone }: { settings: ReturnType<typeof useSettings>[0]; room: RoomSummary; onDone: (r: RoomSummary) => void }) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [library, setLibrary] = useState<LibraryGame[]>([])
  const [game, setGame] = useState('sts2')
  const [playerKind, setPlayerKind] = useState<'builtin' | 'dockerfile'>('builtin')
  const [dockerfile, setDockerfile] = useState(DEFAULT_DOCKERFILE)
  const [character, setCharacter] = useState('Ironclad')
  const [ascension, setAscension] = useState(1)
  const [prompt, setPrompt] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [m, l] = await Promise.all([api<Meta>(settings, '/api/meta'), api<{ games: LibraryGame[] }>(settings, `/api/rooms/${room.id}/library`)])
      setMeta(m)
      setLibrary(l.games)
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [settings, room.id])
  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    setBusy(true)
    setErr('')
    try {
      await api(settings, `/api/rooms/${room.id}/setup`, {
        method: 'POST',
        body: JSON.stringify({ game, player: playerKind === 'builtin' ? { kind: 'builtin' } : { kind: 'dockerfile', dockerfile, name: 'custom Dockerfile' }, task: { character, ascension, prompt } }),
      })
      onDone({ ...room, stage: 'installing' })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-4 text-sm">
      <div className="mb-3 font-medium">Set up the run{room.login ? ` · signed in as ${room.login.personaName || room.login.steamId}` : ''}</div>
      {room.loginReused && <p className="mb-2 text-xs text-muted-foreground">This room reused the saved Steam login, so no sign-in was needed.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Game (your library, filtered to what steambench supports)</span>
          <select value={game} onChange={(e) => setGame(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1">
            {(library.length ? library : meta?.games.map((g) => ({ ...g, supported: true, owned: null, install: { present: false, installed: false, stateFlags: null } })) || []).map((g) => (
              <option key={g.key} value={g.key}>
                {g.name}
                {g.owned === false ? ' (not in library)' : ''}
                {g.install?.installed ? ' · ready' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Character</span>
          <select value={character} onChange={(e) => setCharacter(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1">
            {(meta?.characters || ['Ironclad']).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Ascension (0–20)</span>
          <input type="number" min={0} max={20} value={ascension} onChange={(e) => setAscension(Number(e.target.value))} className="rounded-md border border-border bg-background px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Player</span>
          <select value={playerKind} onChange={(e) => setPlayerKind(e.target.value as 'builtin' | 'dockerfile')} className="rounded-md border border-border bg-background px-2 py-1">
            <option value="builtin">{meta?.builtinPlayer.name || 'steambench-pi (Pi + Nemotron)'}</option>
            <option value="dockerfile">custom Dockerfile</option>
          </select>
        </label>
      </div>
      {playerKind === 'dockerfile' && (
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            Dockerfile (built without a context). Contract: with STEAMBENCH_PLAYER_MODE=rpc the container must speak Pi&apos;s JSONL RPC on stdin/stdout and use the
            STEAMBENCH_PROCESS_GATEWAY/STEAMBENCH_PROCESS_TOKEN gateway; skills are mounted at /workspace/skills.
          </span>
          <textarea value={dockerfile} onChange={(e) => setDockerfile(e.target.value)} rows={12} className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs" />
        </label>
      )}
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Extra instructions for the player (optional)</span>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} className="rounded-md border border-border bg-background px-2 py-1" placeholder="e.g. prefer a Strength build; skip shops" />
      </label>
      {err && <p className="mt-2 text-red-600">{err}</p>}
      <button disabled={busy} onClick={submit} className="mt-3 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-50">
        Install and start
      </button>
    </div>
  )
}

function ChatBox({ disabled, onSend }: { disabled: boolean; onSend: (m: string) => void }) {
  const [text, setText] = useState('')
  const submit = () => {
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }
  return (
    <div className="mt-2 flex gap-2">
      <input
        disabled={disabled}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={disabled ? 'chat opens once the player is running' : 'Message the player (delivered between its turns)'}
        className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
      />
      <button disabled={disabled} onClick={submit} className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50">
        send
      </button>
    </div>
  )
}

function RoomInfo({ room, log }: { room: RoomSummary; log: string[] }) {
  const s = room.lastState || {}
  return (
    <details className="rounded-md border border-border bg-card p-3 text-xs" open>
      <summary className="cursor-pointer select-none font-medium">Room data</summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">game state</dt>
        <dd className="font-mono">
          {room.lastState ? `${s.state_type ?? '?'} · floor ${s.floor ?? '?'} · HP ${s.hp ?? '?'}/${s.max_hp ?? '?'} · gold ${s.gold ?? '?'}` : room.gameReady ? 'mod reachable' : 'game not reachable yet'}
        </dd>
        <dt className="text-muted-foreground">task</dt>
        <dd>{room.setup ? `${room.setup.gameName} · ${room.setup.task.character} · Ascension ${room.setup.task.ascension}` : '—'}</dd>
        <dt className="text-muted-foreground">player image</dt>
        <dd className="font-mono">{room.playerImage || '—'}</dd>
        <dt className="text-muted-foreground">room</dt>
        <dd className="font-mono break-all">{room.roomContainer || '—'} {room.roomIp ? `(${room.roomIp})` : ''}</dd>
        <dt className="text-muted-foreground">lobby</dt>
        <dd className="font-mono break-all">{room.lobbyId || '—'}</dd>
        <dt className="text-muted-foreground">video / audio</dt>
        <dd>{room.frames} frames · {(room.audioBytes / 1024).toFixed(0)} KB audio</dd>
      </dl>
      <div className="mt-2 text-muted-foreground">log</div>
      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-background p-2 font-mono text-[11px]">{log.slice(-80).join('\n')}</pre>
    </details>
  )
}

const DEFAULT_DOCKERFILE = `# Reference player. Contract:
#  - env STEAMBENCH_PROCESS_GATEWAY (host:port) + STEAMBENCH_PROCESS_TOKEN: JSON-line gateway
#    with ops sts2-get, screenshot, pad-press, pad-dpad, pad-stick, pad-neutral, pad-status, room-finish
#  - env STEAMBENCH_PLAYER_MODE=rpc: speak Pi's JSONL RPC (https://pi.dev/docs/latest/rpc) on stdin/stdout
#  - skills are mounted read/write at /workspace/skills (keep notes only in <skill>/scratchpad/)
FROM steambench-pi
# Example customisation: a different OpenRouter model for the reasoning step.
ENV STEAMBENCH_MODEL=nvidia/nemotron-3-super-120b-a12b:free
`
