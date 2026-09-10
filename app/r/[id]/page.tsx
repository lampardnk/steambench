'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { api, apiUrl, wsUrl, STAGE_LABELS, type AgentInfo, type LibraryGame, type Meta, type PadEvent, type RoomSummary, type TranscriptItem } from '@/lib/backend'
import { SettingsBar, useSettings } from '@/components/settings-bar'
import { ControllerView } from '@/components/controller'
import { GameView } from '@/components/game-view'
import { SteamLogin } from '@/components/steam-login'
import { Transcript } from '@/components/transcript'
import { Learning } from '@/components/learning'

type WsMessage =
  | { type: 'snapshot'; room: RoomSummary; transcript: TranscriptItem[]; agents: AgentInfo[]; padHistory: PadEvent[]; log: string[] }
  | { type: 'item'; item: TranscriptItem }
  | { type: 'agents'; agents: AgentInfo[] }
  | { type: 'delta'; id: string; kind: string; agent?: string; delta: string }
  | { type: 'agent_status'; status: string; requiresResume?: boolean; attention?: RoomSummary['attention'] }
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
  const [agents, setAgents] = useState<AgentInfo[]>([])
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
          setAgents(msg.agents || [])
          setPads(msg.padHistory)
          setLog(msg.log)
        } else if (msg.type === 'agents') {
          setAgents(msg.agents || [])
        } else if (msg.type === 'agent_status') {
          setRoom((prev) => prev ? { ...prev, agentStatus: msg.status, requiresResume: msg.requiresResume, attention: msg.attention } : prev)
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
            if (i < 0) return [...prev, { id: msg.id, t: Date.now(), agent: msg.agent, kind: msg.kind as TranscriptItem['kind'], text: msg.delta }]
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

  const reply = async (message: string) => {
    if (!room) return false
    setError('')
    try {
      if (room.attention || room.requiresResume) {
        await api(settings, `/api/rooms/${room.id}/player/resume`, {
          method: 'POST',
          body: JSON.stringify({ issueId: room.attention?.id, message }),
        })
      } else {
        if (wsRef.current?.readyState !== WebSocket.OPEN) throw new Error('Disconnected; your message has not been sent.')
        send({ type: 'chat', message })
      }
      return true
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
      return false
    }
  }

  const remove = async () => {
    if (!room || !confirm('Delete this room? Its history is archived first.')) return
    await api(settings, `/api/rooms/${room.id}`, { method: 'DELETE' })
    window.location.href = '/'
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <SettingsBar settings={settings} onChange={setSettings} status={room ? `${room.name} · ${STAGE_LABELS[room.stage] || room.stage}` : connected ? 'connected' : 'connecting…'} />
      <div className="mx-auto w-full max-w-6xl px-4 py-4">
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
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

            {/* One column, four things: what the room looks like, what is being
                said to and by the player, what it has learned, and everything
                you only open when something is wrong. */}
            <div className="flex flex-col gap-4">
              <section>
                <GameView settings={settings} room={room} />
                {room.stage === 'login' && <div className="mt-3"><SteamLogin room={room} /></div>}
                {room.stage === 'setup' && <div className="mt-3"><SetupForm settings={settings} room={room} onDone={(r) => setRoom(r)} /></div>}
                {room.stage === 'finished' && room.finish && (
                  <div className="mt-3 rounded-md border border-border bg-card p-3 text-sm">
                    <div className="font-medium">Run {room.finish.result}</div>
                    <p className="text-muted-foreground">{room.finish.summary}</p>
                    {room.finish.disputed && (
                      <p className="mt-1 text-warning">
                        The game still showed a run in progress when the player reported a loss, so this result may be wrong.
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">The room is archived and will close automatically. See it later under history.</p>
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-sm font-medium text-foreground">Conversation</span>
                  <span>· player: {room.setup?.player.name || 'not chosen'}</span>
                  <span>· {room.agentStatus}</span>
                  <div className="flex-1" />
                  {room.agentStatus === 'running' && (
                    <button onClick={() => send({ type: 'abort' })} className="rounded border border-border px-1.5 py-0.5 hover:bg-muted">
                      abort turn
                    </button>
                  )}
                </div>
                {room.attention && (
                  <div role="alert" className="mb-3 rounded border border-warning/50 bg-warning/10 p-3 text-sm">
                    <strong>Paused for supervisor review</strong>
                    <p className="mt-1">{room.attention.error}</p>
                    <p className="mt-1 text-xs">
                      Incident {room.attention.id} · decision {room.attention.decision}. Evidence is preserved and no game input is sent until you answer.
                      Replying below resumes the player with your message as the review.
                    </p>
                  </div>
                )}
                <Transcript items={items} agents={agents} />
                <ChatBox
                  attention={Boolean(room.attention || room.requiresResume)}
                  disabled={!['playing', 'finished'].includes(room.stage) || room.agentStatus === 'stopped' || (Boolean(room.attention || room.requiresResume) && room.agentStatus !== 'idle')}
                  onSend={reply}
                />
              </section>

              <section className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-sm font-medium text-foreground">Learning</span>
                  {room.lastLibraryCommit && (
                    <span title={room.lastLibraryCommit.message}>
                      · latest commit <span className="font-mono">{room.lastLibraryCommit.hash.slice(0, 7)}</span>
                    </span>
                  )}
                </div>
                <Learning
                  settings={settings}
                  roomId={room.id}
                  curriculum={room.curriculum}
                  refreshKey={`${room.lastLibraryCommit?.hash || ''}:${room.curriculum?.active?.id || ''}`}
                />
              </section>

              <details className="rounded-lg border border-border bg-card">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
                  Debug <span className="font-normal text-muted-foreground">· room data, log, controller and health</span>
                </summary>
                <div className="flex flex-col gap-3 border-t border-border p-3">
                  <RoomInfo room={room} log={log} />
                  <ControllerView last={pads[pads.length - 1] || room.lastPad} history={pads} />
                  <HealthPanel settings={settings} room={room} />
                </div>
              </details>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function SetupForm({ settings, room, onDone }: { settings: ReturnType<typeof useSettings>[0]; room: RoomSummary; onDone: (r: RoomSummary) => void }) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [library, setLibrary] = useState<LibraryGame[]>([])
  const [game, setGame] = useState('sts2')
  const [character, setCharacter] = useState('Ironclad')
  const [ascension, setAscension] = useState(1)
  const [prompt, setPrompt] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [m, l] = await Promise.all([api<Meta>(settings, '/api/meta'), api<{ games: LibraryGame[] }>(settings, `/api/rooms/${room.id}/library`)]);
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
        body: JSON.stringify({ game, player: { kind: 'builtin' }, task: { character, ascension, prompt } }),
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
            {(meta?.characters || ['Ironclad']).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Ascension (0–20)</span>
          <input type="number" min={0} max={20} value={ascension} onChange={(e) => setAscension(Number(e.target.value))} className="rounded-md border border-border bg-background px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Player</span>
          <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs">
            {meta ? `${meta.builtinPlayer.name} · ${meta.builtinPlayer.model}` : 'loading player identity…'}
          </div>
        </label>
      </div>
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Extra instructions for the player (optional)</span>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} className="rounded-md border border-border bg-background px-2 py-1" placeholder="e.g. prefer a Strength build; skip shops" />
      </label>
      {err && <p className="mt-2 text-destructive">{err}</p>}
      <button disabled={busy} onClick={submit} className="mt-3 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-50">
        Install and start
      </button>
    </div>
  )
}

function ChatBox({ disabled, attention, onSend }: { disabled: boolean; attention: boolean; onSend: (m: string) => Promise<boolean> }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const submit = async () => {
    if (!text.trim() || disabled || sending) return
    setSending(true)
    try {
      if (await onSend(text.trim())) setText('')
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="mt-2 flex w-full gap-2">
      <input
        disabled={disabled || sending}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={
          disabled
            ? 'chat opens once the player is running'
            : attention
              ? 'Answer the player: your reply is recorded as the review and resumes it'
              : 'Message the player (delivered between its turns)'
        }
        className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
      />
      <button disabled={disabled || sending} onClick={submit} className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
        {attention ? 'reply and resume' : 'send'}
      </button>
    </div>
  )
}

type Health = { ok: boolean; stage: string; checks: { name: string; ok: boolean; detail: string }[] }

function HealthPanel({ settings, room }: { settings: ReturnType<typeof useSettings>[0]; room: RoomSummary }) {
  const [health, setHealth] = useState<Health | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const run = useCallback(async () => {
    setBusy(true)
    setErr('')
    try {
      setHealth(await api<Health>(settings, `/api/rooms/${room.id}/health`))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [settings, room.id])

  const retry = async () => {
    setBusy(true)
    try {
      await api(settings, `/api/rooms/${room.id}/retry`, { method: 'POST' })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-medium">Health</span>
        {health && <span className={health.ok ? 'text-success' : 'text-warning'}>{health.ok ? 'all good' : 'needs attention'}</span>}
        <div className="flex-1" />
        {(room.stage === 'error' || room.stage === 'launching') && (
          <button disabled={busy} onClick={retry} className="rounded border border-border px-1.5 py-0.5 hover:bg-muted disabled:opacity-50">
            retry launch
          </button>
        )}
        <button disabled={busy} onClick={run} className="rounded border border-border px-1.5 py-0.5 hover:bg-muted disabled:opacity-50">
          {busy ? 'checking…' : 'check'}
        </button>
      </div>
      {err && <p className="mt-1 text-destructive">{err}</p>}
      {health && (
        <ul className="mt-2 space-y-0.5">
          {health.checks.map((c) => (
            <li key={c.name} className="flex gap-2">
              <span className={c.ok ? 'text-success' : 'text-destructive'}>{c.ok ? '✓' : '✗'}</span>
              <span className="w-28 shrink-0 text-muted-foreground">{c.name}</span>
              <span className="break-all">{c.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RoomInfo({ room, log }: { room: RoomSummary; log: string[] }) {
  const s = room.lastState || {}
  return (
    <div className="rounded-md border border-border p-3 text-xs">
      <div className="font-medium">Room data</div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">game state</dt>
        <dd className="font-mono">
          {room.lastState
            ? [
                s.state_type ?? '?',
                s.character ? `${s.character}` : null,
                s.floor != null ? `act ${s.act ?? '?'} floor ${s.floor}` : null,
                s.ascension != null ? `A${s.ascension}` : null,
                s.hp != null ? `HP ${s.hp}/${s.max_hp ?? '?'}` : null,
                s.gold != null ? `${s.gold} gold` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : room.gameReady
              ? 'mod reachable'
              : 'game not reachable yet'}
        </dd>
        <dt className="text-muted-foreground">task</dt>
        <dd>{room.setup ? `${room.setup.gameName} · ${room.setup.task.character} · Ascension ${room.setup.task.ascension}` : '—'}</dd>
        <dt className="text-muted-foreground">player image</dt>
        <dd className="font-mono">{room.playerImage || '—'}</dd>
        <dt className="text-muted-foreground">room</dt>
        <dd className="font-mono break-all">{room.roomContainer || '—'} {room.roomIp ? `(${room.roomIp})` : ''}</dd>
        <dt className="text-muted-foreground">lobby</dt>
        <dd className="font-mono break-all">{room.lobbyId || '—'}</dd>
        <dt className="text-muted-foreground">stream</dt>
        <dd>
          {room.media?.ready
            ? `${room.media.codecs} · ${room.media.fragments} fragments · ${(room.media.bytes / 1024 / 1024).toFixed(1)} MB${room.media.audioReady ? ` · audio ${room.media.audioCodecs}` : ' · no audio yet'}`
            : `${room.frames} still frames, live stream not ready`}
        </dd>
      </dl>
      <div className="mt-2 text-muted-foreground">log</div>
      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-background p-2 font-mono text-[11px]">{log.slice(-80).join('\n')}</pre>
    </div>
  )
}
