'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentInfo, TranscriptItem } from '@/lib/backend'

const DEFAULT_LANE = 'room'

/** Colour by role, so a lane is recognisable before its name is read. */
const ROLE_TONE: Record<string, string> = {
  room: 'bg-muted text-muted-foreground',
  strategist: 'bg-primary/15 text-primary',
  combat: 'bg-destructive/15 text-destructive',
  actuator: 'bg-success/15 text-success',
  curriculum: 'bg-warning/15 text-warning',
  critic: 'bg-warning/15 text-warning',
}

const laneOf = (item: TranscriptItem) => item.agent || DEFAULT_LANE

/**
 * The team's chat. Each member speaks in its own lane and you read one at a
 * time: a strategist deciding a route and an encounter agent deciding a turn
 * are different conversations, and interleaving them was how the single
 * transcript became unreadable the moment there was more than one speaker.
 */
export function Transcript({ items, agents = [] }: { items: TranscriptItem[]; agents?: AgentInfo[] }) {
  const [selected, setSelected] = useState<string>(DEFAULT_LANE)
  const [pinned, setPinned] = useState(false)

  // Lanes the roster names, plus any lane that spoke without being announced,
  // so nothing a player says can go missing because the roster lagged it.
  const lanes = useMemo(() => {
    const seen = new Map<string, AgentInfo>()
    for (const agent of agents) seen.set(agent.id, agent)
    for (const item of items) {
      const id = laneOf(item)
      if (!seen.has(id)) seen.set(id, { id, role: id.startsWith('combat') ? 'combat' : id, label: id, status: 'open' })
    }
    return [...seen.values()]
  }, [agents, items])

  const counts = useMemo(() => {
    const tally = new Map<string, number>()
    for (const item of items) tally.set(laneOf(item), (tally.get(laneOf(item)) || 0) + 1)
    return tally
  }, [items])

  const latest = useMemo(() => (items.length ? laneOf(items[items.length - 1]) : DEFAULT_LANE), [items])

  // Follow whoever is talking, until you choose someone yourself.
  useEffect(() => {
    if (!pinned) setSelected(latest)
  }, [latest, pinned])

  const active = lanes.some((lane) => lane.id === selected) ? selected : DEFAULT_LANE
  const shown = items.filter((item) => laneOf(item) === active)
  const current = lanes.find((lane) => lane.id === active)

  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label="Agents" className="min-w-0 rounded-md border border-border bg-card p-1">
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">team</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setPinned(!pinned)}
            aria-pressed={pinned}
            title={pinned ? 'Following your selection' : 'Following whoever is speaking'}
            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
          >
            {pinned ? 'pinned' : 'auto'}
          </button>
        </div>
        <ul className="max-h-[26rem] space-y-0.5 overflow-y-auto">
          {lanes.map((lane) => (
            <li key={lane.id}>
              <button
                type="button"
                onClick={() => { setSelected(lane.id); setPinned(true) }}
                aria-current={lane.id === active ? 'true' : undefined}
                title={lane.title || lane.label}
                className={`block w-full rounded px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${lane.id === active ? 'bg-primary/10' : 'hover:bg-muted'}`}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`inline-block shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase ${ROLE_TONE[lane.role] || 'bg-muted text-muted-foreground'}`}>{lane.role.slice(0, 4)}</span>
                  <span className={`min-w-0 flex-1 truncate text-xs ${lane.status === 'closed' ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'font-medium'}`}>{lane.label}</span>
                  {lane.id === latest && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="speaking" />}
                  <span className="shrink-0 text-[10px] text-muted-foreground">{counts.get(lane.id) || 0}</span>
                </span>
                {lane.title && <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{lane.title}</span>}
                {lane.outcome && <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{lane.outcome}{lane.summary ? ` · ${lane.summary}` : ''}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <Lane items={shown} agent={current} />
    </div>
  )
}

function Lane({ items, agent }: { items: TranscriptItem[]; agent?: AgentInfo }) {
  const ref = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  useEffect(() => {
    const el = ref.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [items])
  useEffect(() => { stick.current = true }, [agent?.id])
  const onScroll = () => {
    const el = ref.current
    if (!el) return
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }
  return (
    <div className="min-w-0">
      {agent && (
        <div className="mb-1 flex flex-wrap items-baseline gap-2 px-1">
          <span className="text-sm font-medium">{agent.label}</span>
          {agent.title && <span className="text-xs text-muted-foreground">{agent.title}</span>}
          {agent.status === 'closed' && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">closed{agent.outcome ? ` · ${agent.outcome}` : ''}</span>}
          {typeof agent.decisions === 'number' && agent.decisions > 0 && <span className="text-[10px] text-muted-foreground">{agent.decisions} decision{agent.decisions === 1 ? '' : 's'}</span>}
        </div>
      )}
      <div ref={ref} onScroll={onScroll} className="h-[28rem] overflow-y-auto rounded-md border border-border bg-background p-3 text-sm">
        {items.length === 0 && <p className="text-muted-foreground">{agent?.status === 'closed' ? 'This agent finished without saying anything here.' : 'Nothing in this lane yet.'}</p>}
        {items.map((it) => (
          <Item key={it.id} item={it} />
        ))}
      </div>
    </div>
  )
}

function Item({ item }: { item: TranscriptItem }) {
  if (item.kind === 'user') {
    return (
      <div className="my-2 rounded-md bg-primary/10 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.from === 'steambench' ? 'steambench (kickoff)' : 'you'}{item.queued ? ' · queued' : ''}</div>
        <div className="whitespace-pre-wrap">{item.text}</div>
      </div>
    )
  }
  if (item.kind === 'thinking') {
    return (
      <details className="my-1 rounded-md border border-dashed border-border px-3 py-1 text-xs text-muted-foreground" open={!item.done}>
        <summary className="cursor-pointer select-none">thinking{item.done ? '' : '…'}</summary>
        <div className="mt-1 whitespace-pre-wrap">{item.text}</div>
      </details>
    )
  }
  if (item.kind === 'tool') {
    const args = item.args ? JSON.stringify(item.args) : ''
    return (
      <details className={`my-1 rounded-md border px-3 py-1 text-xs ${item.isError ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-muted/40'}`}>
        <summary className="cursor-pointer select-none font-mono">
          {item.pending ? '⏳' : item.isError ? '✖' : '✓'} {item.toolName}
          <span className="text-muted-foreground"> {args.length > 120 ? args.slice(0, 120) + '…' : args}</span>
        </summary>
        {item.result && <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{item.result}</pre>}
      </details>
    )
  }
  if (item.kind === 'system') {
    return <div className="my-1 text-xs text-warning">⚠ {item.text}</div>
  }
  return <div className="my-2 whitespace-pre-wrap">{item.text}</div>
}
