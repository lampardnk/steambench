'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, type Curriculum, type Objective, type Settings } from '@/lib/backend'
import { Button } from '@/components/ui/button'

export type Commit = {
  hash: string
  author: string
  at: string
  subject: string
  room: string | null
  skill: string | null
  files: { status: string; path: string }[]
}
type FileList = { skill: string; files: { path: string; bytes: number }[] }
type FileText = { skill: string; path: string; text: string }
type HistoryPage = { commits?: Commit[]; objectives?: Objective[]; total?: number; nextOffset: number | null }
/** One UI problem an agent could not get past, and the answer that unstuck it. */
export type Rescue = {
  id: string
  at: number
  via: string | null
  answer: string | null
  problem: string | null
  decision: number | null
  agent: string | null
  screen: string | null
  floor: number | null
}
type RescuePage = { incidents: Rescue[]; total: number; nextOffset: number | null }

const STATUS_LABEL: Record<string, string> = { A: 'added', M: 'changed', D: 'removed', R: 'renamed' }
const VIEWS = { objectives: 'objectives', rescues: 'ui rescues', commits: 'history', files: 'current notes' } as const
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
type View = keyof typeof VIEWS

export function Learning({ settings, curriculum, refreshKey, roomId }: { settings: Settings; curriculum?: Curriculum | null; refreshKey?: string | number; roomId?: string }) {
  const [view, setView] = useState<View>(curriculum ? 'objectives' : 'commits')
  const [revision, setRevision] = useState(0)
  const refresh = `${refreshKey ?? ''}:${revision}`

  return (
    <div className="min-w-0 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="Learning views">
          {(Object.keys(VIEWS) as View[]).map((tab) => (
            <Button key={tab} variant="ghost" size="xs" aria-pressed={view === tab} onClick={() => setView(tab)} className={view === tab ? 'bg-muted font-medium' : 'text-muted-foreground'}>
              {VIEWS[tab]}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">The skill library persists across rooms.</p>
        <div className="flex-1" />
        <Button variant="outline" size="xs" onClick={() => setRevision((value) => value + 1)}>refresh</Button>
      </div>
      <div hidden={view !== 'objectives'}>
        {view === 'objectives' && <Objectives settings={settings} curriculum={curriculum} roomId={roomId} refreshKey={refresh} />}
      </div>
      <div hidden={view !== 'rescues'}>
        {view === 'rescues' && <Rescues settings={settings} roomId={roomId} refreshKey={refresh} />}
      </div>
      <div hidden={view !== 'commits'}>
        {view === 'commits' && <History settings={settings} endpoint="/api/library" kind="commits" title="Commit history" refreshKey={refresh} />}
      </div>
      {view === 'files' && <FileBrowser settings={settings} refreshKey={refresh} />}
    </div>
  )
}

function Objectives({ settings, curriculum, roomId, refreshKey }: { settings: Settings; curriculum?: Curriculum | null; roomId?: string; refreshKey: string }) {
  const active = curriculum?.active
  return (
    <div className="space-y-3">
      {curriculum && (
        <div className="border-l-2 border-primary bg-muted/40 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">working towards</div>
          {active ? (
            <>
              <p className="mt-1 break-words font-medium">{active.text}</p>
              {active.why && <p className="mt-1 text-xs text-muted-foreground">{active.why}</p>}
              {active.done_when && <p className="mt-1 text-xs"><span className="text-muted-foreground">done when: </span>{active.done_when}</p>}
              {Boolean(active.critiques?.length) && <p className="mt-1 text-xs text-warning">critique after {active.attempts} failed check{active.attempts === 1 ? '' : 's'}: {active.critiques?.at(-1)}</p>}
            </>
          ) : <p className="mt-1 text-xs text-muted-foreground">No open objective. The curriculum proposes the next one on the player&apos;s next decision.</p>}
        </div>
      )}
      {curriculum && <p className="text-xs text-muted-foreground"><span className="font-medium text-success">{curriculum.completed} completed</span> · <span className="font-medium text-warning">{curriculum.failed} abandoned</span>. A separate critic decides which.</p>}
      {/* Objectives belong to the room that played them: a ladder merged across
          rooms handed each new run a frontier from seeds that no longer exist. */}
      {roomId && <History key={roomId} settings={settings} endpoint={`/api/rooms/${encodeURIComponent(roomId)}/objectives`} kind="objectives" title="Objective history" refreshKey={refreshKey} />}
    </div>
  )
}

/**
 * Every UI problem this room stopped on, and what got it moving again.
 *
 * These are the run's real failures: an agent that could not resolve a screen
 * on its own and needed an operator. Read together they are the work list for
 * the control manual - each one either belongs in CONTROLS.md or is a bug.
 */
function Rescues({ settings, roomId, refreshKey }: { settings: Settings; roomId?: string; refreshKey: string }) {
  const [page, setPage] = useState<RescuePage | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!roomId) { setBusy(false); return }
    let current = true
    setBusy(true)
    setError('')
    api<RescuePage>(settings, `/api/rooms/${encodeURIComponent(roomId)}/incidents?limit=50`)
      .then((result) => { if (current) setPage(result) })
      .catch((err) => { if (current) setError((err as Error).message) })
      .finally(() => { if (current) setBusy(false) })
    return () => { current = false }
  }, [settings, roomId, refreshKey])

  if (!roomId) return <p className="p-2 text-xs text-muted-foreground">Open a room to see the UI problems it hit.</p>
  const items = page?.incidents || []
  return (
    <section className="min-w-0 rounded-md border border-border bg-card" aria-label="UI rescues">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2 text-xs">
        <span className="font-medium">{page?.total ?? 0} rescue{page?.total === 1 ? '' : 's'} this run</span>
        <span className="text-muted-foreground">Each one is a screen the agents could not resolve alone.</span>
      </div>
      <div aria-busy={busy} className="max-h-[32rem] overflow-auto p-2">
        {error ? <div role="alert" className="p-2 text-xs text-destructive">{error}</div>
          : busy ? <p role="status" className="p-2 text-xs text-muted-foreground">Loading rescues…</p>
            : items.length ? <ol className="space-y-1">{items.map((item) => <RescueRow key={item.id} rescue={item} />)}</ol>
              : <p className="p-2 text-xs text-muted-foreground">No rescues. The agents resolved every screen on their own.</p>}
      </div>
    </section>
  )
}

function RescueRow({ rescue }: { rescue: Rescue }) {
  const where = [rescue.screen, rescue.floor != null ? `floor ${rescue.floor}` : null, rescue.decision != null ? `decision ${rescue.decision}` : null].filter(Boolean).join(' · ')
  return (
    <li>
      <details className="rounded-md border border-l-2 border-warning/40 bg-warning/5">
        <summary className={`cursor-pointer rounded px-3 py-2 ${FOCUS}`}>
          <span className="break-words">{rescue.problem || 'Unrecorded problem'}</span>
          {where && <span className="ml-2 whitespace-nowrap text-xs text-muted-foreground">{where}</span>}
        </summary>
        <div className="space-y-2 border-t border-border px-3 py-2 text-xs">
          {rescue.agent && <p><span className="text-muted-foreground">The agent was trying to: </span>{rescue.agent}</p>}
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">what unstuck it</div>
            <p className="mt-0.5 whitespace-pre-wrap break-words">{rescue.answer || 'Resumed without an explanation.'}</p>
          </div>
          <p className="text-muted-foreground">{new Date(rescue.at).toLocaleString()}{rescue.via ? ` · ${rescue.via}` : ''}</p>
        </div>
      </details>
    </li>
  )
}

function History({ settings, endpoint, kind, title, refreshKey }: { settings: Settings; endpoint: string; kind: 'commits' | 'objectives'; title: string; refreshKey: string }) {
  const [offset, setOffset] = useState(0)
  const [size, setSize] = useState(10)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(true)
  const [compact, setCompact] = useState(true)
  const [page, setPage] = useState<HistoryPage | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let current = true
    setBusy(true)
    setError('')
    api<HistoryPage>(settings, `${endpoint}?limit=${size}&offset=${offset}${filter === 'all' ? '' : `&status=${filter}`}`)
      .then((result) => { if (current) setPage(result) })
      .catch((err) => { if (current) setError((err as Error).message) })
      .finally(() => { if (current) setBusy(false) })
    return () => { current = false }
  }, [settings, endpoint, size, offset, filter, refreshKey, retry])

  const count = page?.[kind]?.length || 0
  return (
    <section className="min-w-0 rounded-md border border-border bg-card" aria-label={title}>
      <div className="flex flex-wrap items-center gap-2 p-2">
        <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Collapse' : 'Expand'} {title.toLowerCase()}</Button>
        <span className="text-xs text-muted-foreground">{page?.total != null ? `${page.total} objectives` : 'newest first'}</span>
        <div className="flex-1" />
        {expanded && <Button variant="ghost" size="xs" aria-pressed={compact} onClick={() => setCompact(!compact)}>{compact ? 'Expand height' : 'Shrink height'}</Button>}
      </div>
      {expanded && (
        <div className="border-t border-border p-2">
          <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
            {kind === 'objectives' && <label className="flex items-center gap-2">Status
              <select aria-label="Objective status" className={`rounded border border-input bg-background px-2 py-1 ${FOCUS}`} value={filter} onChange={(event) => { setFilter(event.target.value); setOffset(0) }}>
                <option value="all">All outcomes</option><option value="completed">Completed</option><option value="abandoned">Abandoned</option>
              </select>
            </label>}
            <label className="flex items-center gap-2">Per page
              <select aria-label={`${title} page size`} className={`rounded border border-input bg-background px-2 py-1 ${FOCUS}`} value={size} onChange={(event) => { setSize(Number(event.target.value)); setOffset(0) }}>
                {[5, 10, 25, 50].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <div aria-busy={busy} className={compact ? 'max-h-64 overflow-auto' : 'max-h-[48rem] overflow-auto'}>
            {error ? <div role="alert" className="p-2 text-xs text-destructive">{error} <Button variant="outline" size="xs" onClick={() => setRetry((value) => value + 1)}>Retry</Button></div>
              : busy ? <p role="status" className="p-2 text-xs text-muted-foreground">Loading {title.toLowerCase()}…</p>
                : count ? <ol className="space-y-1" start={offset + 1}>
                  {kind === 'commits' ? page?.commits?.map((commit) => <CommitRow key={commit.hash} settings={settings} commit={commit} />) : page?.objectives?.map((objective) => <ObjectiveRow key={objective.id} objective={objective} />)}
                </ol> : <p className="p-2 text-xs text-muted-foreground">{offset ? 'No more entries. Go back to an earlier page.' : kind === 'commits' ? 'No commits yet. Notes appear here when a room saves what it learned.' : 'No matching objectives yet. Closed objectives will appear here after critic review.'}</p>}
          </div>
          <nav aria-label={`${title} pagination`} className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
            <Button variant="outline" size="xs" disabled={busy || offset === 0} onClick={() => setOffset(0)}>First</Button>
            <Button variant="outline" size="xs" disabled={busy || offset === 0} onClick={() => setOffset(Math.max(0, offset - size))}>Previous</Button>
            <span aria-live="polite" className="text-xs text-muted-foreground">Page {Math.floor(offset / size) + 1}{!busy && !error && count > 0 ? ` · ${offset + 1}–${offset + count}${page?.total != null ? ` of ${page.total}` : ''}` : ''}</span>
            <Button variant="outline" size="xs" disabled={busy || Boolean(error) || page?.nextOffset == null} onClick={() => { if (page?.nextOffset != null) setOffset(page.nextOffset) }}>Next</Button>
          </nav>
        </div>
      )}
    </section>
  )
}

function ObjectiveRow({ objective }: { objective: Objective }) {
  const done = objective.status === 'completed'
  const abandoned = objective.status === 'abandoned' || objective.status === 'failed'
  const tone = done ? 'border-success/40 bg-success/5' : abandoned ? 'border-warning/40 bg-warning/5' : 'border-border'
  return (
    <li>
      <details className={`rounded-md border border-l-2 ${tone}`}>
        <summary className={`cursor-pointer rounded px-3 py-2 ${FOCUS}`}>
          <span className={`mr-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${done ? 'bg-success/10 text-success' : abandoned ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}`}>{done ? 'Completed' : abandoned ? 'Abandoned' : 'Active'}</span>
          <span className="break-words">{objective.text}</span>
          {objective.area && <span className="ml-2 text-xs text-muted-foreground">{objective.area}</span>}
        </summary>
        <div className="space-y-1 border-t border-border px-3 py-2 text-xs">
          {objective.closed?.reasoning ? <p>{objective.closed.reasoning}</p> : <p className="text-muted-foreground">No closing reasoning recorded.</p>}
          {objective.done_when && <p><span className="text-muted-foreground">Done when: </span>{objective.done_when}</p>}
          {Boolean(objective.critiques?.length) && <p className="text-warning">{objective.critiques?.at(-1)}</p>}
          {objective.opened?.floor != null && <p className="text-muted-foreground">Opened act {objective.opened.act ?? '?'}, floor {objective.opened.floor}{objective.opened.room ? ` · room ${objective.opened.room}` : ''}</p>}
        </div>
      </details>
    </li>
  )
}

function CommitRow({ settings, commit }: { settings: Settings; commit: Commit }) {
  const [patch, setPatch] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const load = async () => {
    setBusy(true)
    setError('')
    try {
      const shown = await api<{ patch: string }>(settings, `/api/library/commits/${commit.hash}`)
      setPatch(shown.patch)
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <li>
      <details onToggle={(event) => { if (event.currentTarget.open && patch === null && !busy) void load() }} className="rounded-md border border-border bg-card">
        <summary className={`cursor-pointer select-none rounded px-3 py-2 ${FOCUS}`}>
          <span className="font-mono text-xs text-muted-foreground">{commit.hash.slice(0, 7)}</span>{' '}<span className="break-words font-medium">{commit.subject}</span>
          <div className="mt-1 text-xs text-muted-foreground">{commit.author} · {new Date(commit.at).toLocaleString()}{commit.room ? ` · room ${commit.room}` : ''} · {commit.files.length} file{commit.files.length === 1 ? '' : 's'}</div>
        </summary>
        <div className="border-t border-border px-3 py-2">
          <ul className="mb-2 space-y-1 text-xs">{commit.files.map((file) => <li key={file.path} className="flex gap-2"><span className="w-16 shrink-0 text-muted-foreground">{STATUS_LABEL[file.status] || file.status}</span><span className="break-all font-mono">{file.path}</span></li>)}</ul>
          {error && <p role="alert" className="text-xs text-destructive">{error} <Button variant="outline" size="xs" onClick={load} disabled={busy}>Retry diff</Button></p>}
          {busy && <p role="status" className="text-xs text-muted-foreground">Loading diff…</p>}
          {patch !== null && <Patch text={patch} />}
        </div>
      </details>
    </li>
  )
}

function Patch({ text }: { text: string }) {
  return <pre tabIndex={0} aria-label="Commit diff" className={`max-h-96 overflow-auto rounded bg-background p-2 font-mono text-xs leading-snug ${FOCUS}`}>
    {text.split('\n').map((line, index) => <div key={index} className={line.startsWith('+++') || line.startsWith('---') ? 'text-muted-foreground' : line.startsWith('+') ? 'text-success' : line.startsWith('-') ? 'text-destructive' : line.startsWith('@@') ? 'text-primary' : ''}>{line || ' '}</div>)}
  </pre>
}

type Directory = { directories: Map<string, Directory>; files: FileList['files'] }
function directoryTree(files: FileList['files']) {
  const root: Directory = { directories: new Map(), files: [] }
  for (const file of files) {
    const parts = file.path.split('/')
    let node = root
    for (const part of parts.slice(0, -1)) {
      if (!node.directories.has(part)) node.directories.set(part, { directories: new Map(), files: [] })
      node = node.directories.get(part)!
    }
    node.files.push(file)
  }
  return root
}

function DirectoryNodes({ node, selected, openFile }: { node: Directory; selected?: string; openFile: (path: string) => void }) {
  const entries: ReactNode[] = [...node.directories].sort(([a], [b]) => a.localeCompare(b)).map(([name, child]) => (
    <li key={`directory:${name}`}>
      <details>
        <summary className={`cursor-pointer rounded px-1 py-1 font-medium hover:bg-muted ${FOCUS}`}>{name}/</summary>
        <ul className="ml-3 border-l border-border pl-2"><DirectoryNodes node={child} selected={selected} openFile={openFile} /></ul>
      </details>
    </li>
  ))
  return <>{entries}{[...node.files].sort((a, b) => a.path.localeCompare(b.path)).map((file) => <li key={file.path}>
    <button type="button" onClick={() => openFile(file.path)} aria-current={selected === file.path ? 'true' : undefined} className={`block w-full rounded px-1 py-1 text-left hover:bg-muted ${FOCUS} ${selected === file.path ? 'bg-primary/10 font-medium text-primary' : ''}`} title={file.path}>
      <span className="block truncate">{file.path.split('/').at(-1)}</span>
    </button>
  </li>)}</>
}

function FileBrowser({ settings, refreshKey }: { settings: Settings; refreshKey: string }) {
  const [files, setFiles] = useState<FileList['files']>([])
  const [skill, setSkill] = useState('')
  const [selected, setSelected] = useState<FileText | null>(null)
  const [error, setError] = useState('')
  const [fileError, setFileError] = useState('')
  const [busy, setBusy] = useState(true)
  const [opening, setOpening] = useState('')
  const request = useRef(0)
  const tree = useMemo(() => directoryTree(files), [files])

  useEffect(() => {
    let current = true
    request.current++
    setOpening('')
    setFileError('')
    setBusy(true)
    setError('')
    const load = async () => {
      const library = await api<{ skills: string[] }>(settings, '/api/library?limit=1')
      const name = library.skills[0] || ''
      const list = name ? await api<FileList>(settings, `/api/library/files?skill=${encodeURIComponent(name)}`) : { files: [] }
      if (current) { setSkill(name); setFiles(list.files) }
    }
    load().catch((err) => { if (current) setError((err as Error).message) }).finally(() => { if (current) setBusy(false) })
    return () => { current = false; request.current++ }
  }, [settings, refreshKey])

  const openFile = async (path: string) => {
    const id = ++request.current
    setOpening(path)
    setFileError('')
    try {
      const file = await api<FileText>(settings, `/api/library/files?skill=${encodeURIComponent(skill)}&path=${encodeURIComponent(path)}`)
      if (id === request.current) setSelected(file)
    } catch (err) { if (id === request.current) setFileError((err as Error).message) }
    finally { if (id === request.current) setOpening('') }
  }

  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label="Skill directory" className="min-w-0 rounded-md border border-border bg-card p-2 text-xs">
        <p className="mb-2 font-medium">{skill || 'Skill library'} <span className="font-normal text-muted-foreground">· {files.length} files</span></p>
        {error ? <p role="alert" className="text-destructive">{error}. Use refresh to try again.</p> : busy ? <p role="status" className="text-muted-foreground">Loading directory…</p> : files.length ? <ul className="max-h-96 overflow-auto font-mono"><DirectoryNodes node={tree} selected={selected?.path} openFile={openFile} /></ul> : <p className="text-muted-foreground">No notes yet. A room saves reusable lessons here.</p>}
      </nav>
      <div className="min-w-0 rounded-md border border-border bg-card p-2" aria-busy={Boolean(opening)}>
        {opening && <p role="status" className="mb-2 break-all text-xs text-muted-foreground">Loading {opening}…</p>}
        {fileError && <p role="alert" className="mb-2 text-xs text-destructive">{fileError}. Select the file to try again.</p>}
        {selected ? <><div className="mb-2 break-all font-mono text-xs text-muted-foreground">{selected.path}</div><pre tabIndex={0} aria-label={`Contents of ${selected.path}`} className={`max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-xs ${FOCUS}`}>{selected.text}</pre></> : <p className="text-xs text-muted-foreground">Expand a directory, then pick a file to see what the next room will inherit.</p>}
      </div>
    </div>
  )
}
