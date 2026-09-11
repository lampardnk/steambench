'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, type ActionEvent, type AgentInfo, type RoomSummary, type TranscriptItem } from '@/lib/backend'
import { ActionAudit } from '@/components/action-audit'
import { SettingsBar, useSettings } from '@/components/settings-bar'
import { Transcript } from '@/components/transcript'

type Entry = RoomSummary & { dir: string; reason: string; archivedAt: number; transcriptItems: number }
type Detail = { room: Entry; transcript: TranscriptItem[]; agents?: AgentInfo[]; actionHistory: ActionEvent[]; scratchpad: { name: string; text: string | null }[]; gameLog: string | null }

export default function HistoryPage() {
  const [settings, setSettings, loaded] = useSettings()
  const configured = Boolean(settings.backendUrl && settings.token)
  const [entries, setEntries] = useState<Entry[]>([])
  const [open, setOpen] = useState<Detail | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!configured) return
    try {
      const r = await api<{ history: Entry[] }>(settings, '/api/history')
      setEntries(r.history)
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [settings, configured])
  useEffect(() => {
    if (loaded) load()
  }, [loaded, load])

  const show = async (dir: string) => {
    try {
      setOpen(await api<Detail>(settings, `/api/history/${encodeURIComponent(dir)}`))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <SettingsBar settings={settings} onChange={setSettings} status={`${entries.length} archived room(s)`} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <a href="/" className="text-sm text-muted-foreground hover:underline">
            ← rooms
          </a>
          <h1 className="text-xl font-semibold tracking-tight">History</h1>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <li key={e.dir}>
                <button onClick={() => show(e.dir)} className={`w-full rounded-md border border-border p-3 text-left text-sm hover:bg-muted ${open?.room.dir === e.dir ? 'bg-muted' : 'bg-card'}`}>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.archivedAt).toLocaleString()} · {e.setup ? `${e.setup.task.character} A${e.setup.task.ascension}` : 'no task'} · {e.finish ? `run ${e.finish.result}` : e.reason} · {e.actionCount || 0} actions
                  </div>
                </button>
              </li>
            ))}
            {entries.length === 0 && <li className="text-sm text-muted-foreground">Nothing archived yet.</li>}
          </ul>
          {open && (
            <div className="flex flex-col gap-3">
              <div className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="font-medium">{open.room.name}</div>
                {open.room.finish && (
                  <p className="text-muted-foreground">
                    {open.room.finish.result}: {open.room.finish.summary}
                  </p>
                )}
                {open.room.lastState && <p className="font-mono text-xs">{JSON.stringify(open.room.lastState)}</p>}
              </div>
              <Transcript items={open.transcript} agents={open.agents} />
              <ActionAudit history={open.actionHistory || []} />
              {open.scratchpad.length > 0 && (
                <details className="rounded-md border border-border bg-card p-3 text-xs">
                  <summary className="cursor-pointer font-medium">scratchpad</summary>
                  {open.scratchpad.map((f) => (
                    <div key={f.name} className="mt-2">
                      <div className="font-mono">{f.name}</div>
                      <pre className="whitespace-pre-wrap">{f.text}</pre>
                    </div>
                  ))}
                </details>
              )}
              <details className="rounded-md border border-border bg-card p-3 text-xs">
                <summary className="cursor-pointer font-medium">room log</summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{open.room.log?.join('\n')}</pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
