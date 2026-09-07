'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, type Settings } from '@/lib/backend'

// What the players have learned, as commits. The skill library is one git
// repository that outlives every room, so a run's notes are readable here the
// same way any code change is: subject, author, files, diff.

export type Commit = {
  hash: string
  author: string
  at: string
  subject: string
  room: string | null
  skill: string | null
  files: { status: string; path: string }[]
}
type LibraryResponse = { skills: string[]; commits: Commit[] }
type FileList = { skill: string; files: { path: string; bytes: number }[] }
type FileText = { skill: string; path: string; text: string }

const STATUS_LABEL: Record<string, string> = { A: 'added', M: 'changed', D: 'removed', R: 'renamed' }

export function Learning({ settings, refreshKey }: { settings: Settings; refreshKey?: string | number }) {
  const [data, setData] = useState<LibraryResponse | null>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<'commits' | 'files'>('commits')

  const load = useCallback(async () => {
    try {
      setData(await api<LibraryResponse>(settings, '/api/library?limit=50'))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [settings])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  return (
    <div className="text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border p-0.5 text-xs">
          {(['commits', 'files'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`rounded px-2 py-0.5 ${view === tab ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab === 'commits' ? 'history' : 'current notes'}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          The skill library persists across rooms; every room inherits it and commits what it learned.
        </p>
        <div className="flex-1" />
        <button onClick={load} className="rounded border border-border px-1.5 py-0.5 text-xs hover:bg-muted">
          refresh
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {view === 'commits' ? <CommitList settings={settings} commits={data?.commits || []} /> : <FileBrowser settings={settings} skill={data?.skills[0]} />}
    </div>
  )
}

function CommitList({ settings, commits }: { settings: Settings; commits: Commit[] }) {
  if (!commits.length) {
    return <p className="text-xs text-muted-foreground">No commits yet. The library is created when a room installs its skills.</p>
  }
  return (
    <ol className="space-y-1">
      {commits.map((commit) => (
        <CommitRow key={commit.hash} settings={settings} commit={commit} />
      ))}
    </ol>
  )
}

function CommitRow({ settings, commit }: { settings: Settings; commit: Commit }) {
  const [patch, setPatch] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const open = async (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (!e.currentTarget.open || patch !== null || busy) return
    setBusy(true)
    try {
      const shown = await api<{ patch: string }>(settings, `/api/library/commits/${commit.hash}`)
      setPatch(shown.patch)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li>
      <details onToggle={open} className="rounded-md border border-border bg-card">
        <summary className="cursor-pointer select-none px-3 py-2">
          <span className="font-mono text-xs text-muted-foreground">{commit.hash.slice(0, 7)}</span>{' '}
          <span className="font-medium">{commit.subject}</span>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {commit.author} · {new Date(commit.at).toLocaleString()}
            {commit.room ? ` · room ${commit.room}` : ''} · {commit.files.length} file{commit.files.length === 1 ? '' : 's'}
          </div>
        </summary>
        <div className="border-t border-border px-3 py-2">
          <ul className="mb-2 space-y-0.5 text-xs">
            {commit.files.map((file) => (
              <li key={file.path} className="flex gap-2">
                <span className="w-16 shrink-0 text-muted-foreground">{STATUS_LABEL[file.status] || file.status}</span>
                <span className="break-all font-mono">{file.path}</span>
              </li>
            ))}
          </ul>
          {error && <p className="text-xs text-red-600">{error}</p>}
          {busy && <p className="text-xs text-muted-foreground">loading diff…</p>}
          {patch !== null && <Patch text={patch} />}
        </div>
      </details>
    </li>
  )
}

/** Minimal unified-diff colouring: added, removed, hunk headers. */
function Patch({ text }: { text: string }) {
  return (
    <pre className="max-h-96 overflow-auto rounded bg-background p-2 font-mono text-[11px] leading-snug">
      {text.split('\n').map((line, i) => (
        <div
          key={i}
          className={
            line.startsWith('+++') || line.startsWith('---')
              ? 'text-muted-foreground'
              : line.startsWith('+')
                ? 'text-emerald-600'
                : line.startsWith('-')
                  ? 'text-red-600'
                  : line.startsWith('@@')
                    ? 'text-sky-600'
                    : ''
          }
        >
          {line || ' '}
        </div>
      ))}
    </pre>
  )
}

function FileBrowser({ settings, skill }: { settings: Settings; skill?: string }) {
  const [files, setFiles] = useState<FileList['files']>([])
  const [selected, setSelected] = useState<FileText | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!skill) return
    api<FileList>(settings, `/api/library/files?skill=${encodeURIComponent(skill)}`)
      .then((r) => setFiles(r.files))
      .catch((e) => setError((e as Error).message))
  }, [settings, skill])

  const openFile = async (path: string) => {
    try {
      setSelected(await api<FileText>(settings, `/api/library/files?skill=${encodeURIComponent(skill || '')}&path=${encodeURIComponent(path)}`))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="grid gap-3 md:grid-cols-[16rem_1fr]">
      <ul className="max-h-96 space-y-0.5 overflow-auto rounded-md border border-border bg-card p-2 text-xs">
        {error && <li className="text-red-600">{error}</li>}
        {!files.length && !error && <li className="text-muted-foreground">nothing in the library yet</li>}
        {files.map((file) => (
          <li key={file.path}>
            <button
              onClick={() => openFile(file.path)}
              className={`w-full truncate rounded px-1 py-0.5 text-left font-mono hover:bg-muted ${selected?.path === file.path ? 'bg-muted' : ''}`}
              title={file.path}
            >
              {file.path}
            </button>
          </li>
        ))}
      </ul>
      <div className="rounded-md border border-border bg-card p-2">
        {selected ? (
          <>
            <div className="mb-1 font-mono text-xs text-muted-foreground">{selected.path}</div>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{selected.text}</pre>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Pick a file to see what the next room will inherit.</p>
        )}
      </div>
    </div>
  )
}
