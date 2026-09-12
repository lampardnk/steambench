'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentInfo, TranscriptItem, UsageByLane } from '@/lib/backend'
import { TotalsBar, TurnLedger } from '@/components/agent-usage'

const DEFAULT_LANE = 'room'
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

/** Colour by role, so a lane is recognisable before its name is read. */
const ROLE_TONE: Record<string, string> = {
  room: 'bg-muted text-muted-foreground',
  strategist: 'bg-primary/15 text-primary',
  combat: 'bg-destructive/15 text-destructive',
  curriculum: 'bg-warning/15 text-warning',
  critic: 'bg-warning/15 text-warning',
}

const laneOf = (item: TranscriptItem) => item.agent || DEFAULT_LANE
const isRetired = (lane: AgentInfo) => lane.status === 'closed'

/**
 * The team's chat. Each member speaks in its own lane and you read one at a
 * time: a strategist deciding a route and an encounter agent deciding a turn
 * are different conversations, and interleaving them was how the single
 * transcript became unreadable the moment there was more than one speaker.
 *
 * Encounter agents are per-fight, so by the end of a run the roster is mostly
 * agents that have finished. They are kept, because a fight's reasoning is
 * worth re-reading, but they are moved out of the way of whoever is playing.
 */
export function Transcript({ items, agents = [], usage = {} }: { items: TranscriptItem[]; agents?: AgentInfo[]; usage?: UsageByLane }) {
  const [selected, setSelected] = useState<string>(DEFAULT_LANE)
  const [pinned, setPinned] = useState(false)

  // Lanes the roster names, plus any lane that spoke or spent without being
  // announced, so nothing can go missing because the roster lagged it.
  const lanes = useMemo(() => {
    const seen = new Map<string, AgentInfo>()
    for (const agent of agents) seen.set(agent.id, agent)
    const infer = (id: string) => {
      if (!seen.has(id)) seen.set(id, { id, role: id.startsWith('combat') ? 'combat' : id, label: id, status: 'open' })
    }
    for (const item of items) infer(laneOf(item))
    for (const id of Object.keys(usage)) infer(id)
    return [...seen.values()]
  }, [agents, items, usage])

  const counts = useMemo(() => {
    const tally = new Map<string, number>()
    for (const item of items) tally.set(laneOf(item), (tally.get(laneOf(item)) || 0) + 1)
    return tally
  }, [items])

  const latest = useMemo(() => (items.length ? laneOf(items[items.length - 1]) : DEFAULT_LANE), [items])

  // Newest first: a finished fight is most interesting right after it ends.
  const { playing, retired } = useMemo(() => ({
    playing: lanes.filter((lane) => !isRetired(lane)),
    retired: lanes.filter(isRetired).sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0)),
  }), [lanes])

  // Follow whoever is talking, until you choose someone yourself.
  useEffect(() => {
    if (!pinned) setSelected(latest)
  }, [latest, pinned])

  const active = lanes.some((lane) => lane.id === selected) ? selected : DEFAULT_LANE
  const shown = items.filter((item) => laneOf(item) === active)
  const current = lanes.find((lane) => lane.id === active)
  const pick = (id: string) => { setSelected(id); setPinned(true) }

  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-[14rem_minmax(0,1fr)]">
      <nav aria-label="Agents" className="min-w-0 rounded-md border border-border bg-card p-1">
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">playing</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setPinned(!pinned)}
            aria-pressed={pinned}
            title={pinned ? 'Following your selection' : 'Following whoever is speaking'}
            className={`rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted ${FOCUS}`}
          >
            {pinned ? 'pinned' : 'auto'}
          </button>
        </div>
        <LaneList lanes={playing} active={active} latest={latest} counts={counts} onPick={pick} />
        {retired.length > 0 && (
          <details className="mt-1 border-t border-border pt-1" open={playing.length === 0}>
            <summary className={`cursor-pointer select-none rounded px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:bg-muted ${FOCUS}`}>
              finished · {retired.length}
            </summary>
            <LaneList lanes={retired} active={active} latest={latest} counts={counts} onPick={pick} />
          </details>
        )}
      </nav>
      <Lane items={shown} agent={current} usage={usage[active]} />
    </div>
  )
}

function LaneList({ lanes, active, latest, counts, onPick }: { lanes: AgentInfo[]; active: string; latest: string; counts: Map<string, number>; onPick: (id: string) => void }) {
  if (!lanes.length) return <p className="px-2 py-1.5 text-[11px] text-muted-foreground">No agents here yet.</p>
  return (
    <ul className="max-h-[26rem] space-y-0.5 overflow-y-auto">
      {lanes.map((lane) => (
        <li key={lane.id}>
          <button
            type="button"
            onClick={() => onPick(lane.id)}
            aria-current={lane.id === active ? 'true' : undefined}
            title={lane.title || lane.label}
            className={`block w-full rounded px-2 py-1.5 text-left ${FOCUS} ${lane.id === active ? 'bg-primary/10' : 'hover:bg-muted'}`}
          >
            <span className="flex items-center gap-1.5">
              <span className={`inline-block shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase ${ROLE_TONE[lane.role] || 'bg-muted text-muted-foreground'}`}>{lane.role.slice(0, 4)}</span>
              <span className={`min-w-0 flex-1 truncate text-xs ${isRetired(lane) ? 'text-muted-foreground' : 'font-medium'}`}>{lane.label}</span>
              {lane.id === latest && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="speaking" />}
              <span className="shrink-0 text-[10px] text-muted-foreground">{counts.get(lane.id) || 0}</span>
            </span>
            {lane.title && <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{lane.title}</span>}
            {lane.outcome && <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{lane.outcome}{lane.summary ? ` · ${lane.summary}` : ''}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

function Lane({ items, agent, usage }: { items: TranscriptItem[]; agent?: AgentInfo; usage?: UsageByLane[string] }) {
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
    <div className="min-w-0 space-y-2">
      {agent && (
        <div className="flex flex-wrap items-baseline gap-2 px-1">
          <span className="text-sm font-medium">{agent.label}</span>
          {agent.title && <span className="text-xs text-muted-foreground">{agent.title}</span>}
          {isRetired(agent) && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">finished{agent.outcome ? ` · ${agent.outcome}` : ''}</span>}
          {typeof agent.decisions === 'number' && agent.decisions > 0 && <span className="text-[10px] text-muted-foreground">{agent.decisions} decision{agent.decisions === 1 ? '' : 's'}</span>}
        </div>
      )}
      <TotalsBar usage={usage} />
      <TurnLedger usage={usage} />
      <div ref={ref} onScroll={onScroll} className="h-[28rem] overflow-y-auto rounded-md border border-border bg-background p-3 text-sm">
        {items.length === 0 && <p className="text-muted-foreground">{agent && isRetired(agent) ? 'This agent finished without saying anything here.' : 'Nothing in this lane yet.'}</p>}
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
