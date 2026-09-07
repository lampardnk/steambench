'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, STAGE_COLORS, STAGE_LABELS, type Meta, type RoomSummary } from '@/lib/backend'
import { SettingsBar, useSettings } from '@/components/settings-bar'
import { Learning } from '@/components/learning'

export default function Page() {
  const [settings, setSettings, loaded] = useSettings()
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const configured = Boolean(settings.backendUrl && settings.token)

  const refresh = useCallback(async () => {
    if (!configured) return
    try {
      const [r, m] = await Promise.all([api<{ rooms: RoomSummary[] }>(settings, '/api/rooms'), api<Meta>(settings, '/api/meta')])
      setRooms(r.rooms)
      setMeta(m)
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [settings, configured])

  useEffect(() => {
    if (!loaded) return
    refresh()
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [refresh, loaded])

  const create = async () => {
    setBusy(true)
    try {
      const room = await api<RoomSummary>(settings, '/api/rooms', { method: 'POST', body: JSON.stringify({}) })
      window.location.href = `/r/${room.id}`
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this room? Its history is archived first.')) return
    setBusy(true)
    try {
      await api(settings, `/api/rooms/${id}`, { method: 'DELETE' })
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const forgetLogin = async () => {
    if (!confirm('Forget the saved Steam login? The next room will ask you to sign in again.')) return
    await api(settings, '/api/login', { method: 'DELETE' })
    await refresh()
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <SettingsBar settings={settings} onChange={setSettings} status={configured ? (error ? `offline: ${error}` : `${rooms.length} room(s)`) : 'not configured'} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Rooms</h1>
          <a href="/history" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            history
          </a>
          <div className="flex-1" />
          <button disabled={!configured || busy} onClick={create} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
            + New room
          </button>
        </div>
        {!configured && <p className="text-sm text-muted-foreground">Enter the server URL and token above to connect.</p>}
        {configured && meta && (
          <p className="mb-4 text-xs text-muted-foreground">
            {meta.savedLogin ? (
              <>
                Steam login saved{meta.savedLogin.savedAt ? ` ${new Date(meta.savedLogin.savedAt).toLocaleDateString()}` : ''}; new rooms start signed in.{' '}
                <button onClick={forgetLogin} className="underline underline-offset-4 hover:text-destructive">
                  forget it
                </button>
              </>
            ) : (
              'No Steam login saved yet. The first room will show a QR code to sign in; after that every room reuses it.'
            )}
          </p>
        )}
        <ul className="grid gap-3 sm:grid-cols-2">
          {rooms.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className={`inline-block size-2 rounded-full ${STAGE_COLORS[r.stage] || 'bg-sky-400'}`} />
                <a href={`/r/${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </a>
                <span className="text-xs text-muted-foreground">{r.setup ? `${r.setup.gameName} · ${r.setup.task.character} A${r.setup.task.ascension}` : 'not set up'}</span>
                <div className="flex-1" />
                <button onClick={() => remove(r.id)} className="rounded-md border border-border px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10">
                  delete
                </button>
              </div>
              <p className="mt-2 text-sm">
                <span className="font-medium">{STAGE_LABELS[r.stage] || r.stage}</span>
                {r.detail && <span className="text-muted-foreground"> · {r.detail}</span>}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.login ? `Steam: ${r.login.personaName || r.login.steamId}` : 'Steam: not signed in'} · player {r.agentStatus} · {r.padCount} inputs
              </p>
              <a href={`/r/${r.id}`} className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline">
                open →
              </a>
            </li>
          ))}
        </ul>
        {configured && rooms.length === 0 && !error && <p className="text-sm text-muted-foreground">No rooms. Create one: it starts Steam in an isolated room and asks you to sign in.</p>}
        {configured && (
          <section className="mt-8">
            {/* The skill library is not tied to a room: it is what every future
                room starts from, so it belongs here as well. */}
            <h2 className="mb-2 text-sm font-semibold tracking-tight">What the players have learned</h2>
            <Learning settings={settings} />
          </section>
        )}
      </div>
    </main>
  )
}
