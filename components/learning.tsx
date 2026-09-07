'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, type Curriculum, type Objective, type Settings } from '@/lib/backend'

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
const VIEWS = { objectives: 'objectives', commits: 'history', files: 'current notes' } as const
type View = keyof typeof VIEWS

export function Learning({ settings, curriculum, refreshKey }: { settings: Settings; curriculum?: Curriculum | null; refreshKey?: string | number }) {
  const [data, setData] = useState<LibraryResponse | null>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>(curriculum ? 'objectives' : 'commits')

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
          {(Object.keys(VIEWS) as View[])
            .filter((tab) => tab !== 'objectives' || curriculum)
            .map((tab) => (
              <button
                key={tab}
                onClick={() => setView(tab)}
                className={`rounded px-2 py-0.5 ${view === tab ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {VIEWS[tab]}
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
      {view === 'objectives' && <Objectives curriculum={curriculum} />}
      {view === 'commits' && <CommitList settings={settings} commits={data?.commits || []} />}
      {view === 'files' && <FileBrowser settings={settings} skill={data?.skills[0]} />}
    </div>
  )
}

const AREA_TONE: Record<string, string> = {
  strategy: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  controls: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  bestiary: 'bg-red-500/15 text-red-700 dark:text-red-300',
  events: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  setups: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
}

/**
 * The curriculum ladder: what the player is working towards, and what a critic
 * has already decided about earlier objectives. This is the part of learning you
 * cannot see in a diff, because it is the reason the diffs exist.
 */
function Objectives({ curriculum }: { curriculum?: Curriculum | null }) {
  if (!curriculum) return <p className="text-xs text-muted-foreground">No objective ladder yet. It appears once the player is in a run.</p>
  const { active, recent, completed, failed } = curriculum
  const history = recent.filter((item) => item.id !== active?.id)
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-background p-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">working towards</div>
        {active ? (
          <>
            <p className="mt-1 font-medium">{active.text}</p>
            {active.why && <p className="mt-1 text-xs text-muted-foreground">{active.why}</p>}
            {active.done_when && (
              <p className="mt-1 text-xs">
                <span className="text-muted-foreground">done when: </span>
                {active.done_when}
              </p>
            )}
            {Boolean(active.critiques?.length) && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                critique after {active.attempts} failed check{active.attempts === 1 ? '' : 's'}: {active.critiques?.at(-1)}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Nothing open. The curriculum proposes the next objective on the player&apos;s next decision.</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {completed} completed · {failed} abandoned. A separate critic decides which; the player never closes its own objective.
      </p>
      {history.length > 0 && (
        <ol className="space-y-1">
          {history.map((item) => (
            <ObjectiveRow key={item.id} objective={item} />
          ))}
        </ol>
      )}
    </div>
  )
}

function ObjectiveRow({ objective }: { objective: Objective }) {
  const done = objective.status === 'completed'
  return (
    <li className="rounded-md border border-border bg-card px-3 py-2 text-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={done ? 'text-emerald-600' : 'text-muted-foreground'}>{done ? '✓' : '✕'}</span>
        <span className={done ? '' : 'text-muted-foreground'}>{objective.text}</span>
        {objective.area && <span className={`rounded px-1.5 py-0.5 text-[11px] ${AREA_TONE[objective.area] || 'bg-muted'}`}>{objective.area}</span>}
      </div>
      {objective.closed?.reasoning && <p className="mt-1 text-xs text-muted-foreground">{objective.closed.reasoning}</p>}
      {!done && Boolean(objective.critiques?.length) && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{objective.critiques?.at(-1)}</p>
      )}
      {objective.opened?.floor != null && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          opened act {objective.opened.act ?? '?'}, floor {objective.opened.floor}
          {objective.opened.room ? ` · room ${objective.opened.room}` : ''}
        </p>
      )}
    </li>
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
