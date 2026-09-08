'use client'

import { useEffect, useState } from 'react'
import { loadSettings, saveSettings, type Settings } from '@/lib/backend'
import { ThemeToggle } from '@/components/theme'

export function useSettings(): [Settings, (s: Settings) => void, boolean] {
  const [settings, setSettings] = useState<Settings>({ backendUrl: '', token: '' })
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setSettings(loadSettings())
    setLoaded(true)
  }, [])
  const update = (s: Settings) => {
    setSettings(s)
    saveSettings(s)
  }
  return [settings, update, loaded]
}

export function SettingsBar({ settings, onChange, status }: { settings: Settings; onChange: (s: Settings) => void; status?: string }) {
  const [open, setOpen] = useState(!settings.backendUrl)
  useEffect(() => {
    if (!settings.backendUrl) setOpen(true)
  }, [settings.backendUrl])
  return (
    <div className="border-b border-border bg-card text-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <a href="/" className="font-semibold tracking-tight">
          steambench
        </a>
        <span className="text-muted-foreground">{status}</span>
        <div className="flex-1" />
        <ThemeToggle />
        <button className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted" onClick={() => setOpen(!open)}>
          {open ? 'hide settings' : 'settings'}
        </button>
      </div>
      {open && (
        <div className="mx-auto flex max-w-6xl flex-wrap items-end gap-3 px-4 pb-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            server URL (tunnel or LAN)
            <input
              className="w-80 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground"
              placeholder="https://xxxx.trycloudflare.com"
              value={settings.backendUrl}
              onChange={(e) => onChange({ ...settings, backendUrl: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            token (STEAMBENCH_TOKEN)
            <input
              className="w-80 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground"
              type="password"
              value={settings.token}
              onChange={(e) => onChange({ ...settings, token: e.target.value })}
            />
          </label>
          <p className="max-w-md text-xs text-muted-foreground">
            Saved in this browser only. Start the server with <code>docker compose up -d</code> and the tunnel with{' '}
            <code>docker compose --profile tunnel up -d tunnel</code>.
          </p>
        </div>
      )}
    </div>
  )
}
