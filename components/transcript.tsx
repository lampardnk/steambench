'use client'

import { useEffect, useRef } from 'react'
import type { TranscriptItem } from '@/lib/backend'

export function Transcript({ items }: { items: TranscriptItem[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  useEffect(() => {
    const el = ref.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [items])
  const onScroll = () => {
    const el = ref.current
    if (!el) return
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }
  return (
    <div ref={ref} onScroll={onScroll} className="h-[28rem] overflow-y-auto rounded-md border border-border bg-background p-3 text-sm">
      {items.length === 0 && <p className="text-muted-foreground">The player has not said anything yet.</p>}
      {items.map((it) => (
        <Item key={it.id} item={it} />
      ))}
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
      <details className={`my-1 rounded-md border px-3 py-1 text-xs ${item.isError ? 'border-red-300 bg-red-50' : 'border-border bg-muted/40'}`}>
        <summary className="cursor-pointer select-none font-mono">
          {item.pending ? '⏳' : item.isError ? '✖' : '✓'} {item.toolName}
          <span className="text-muted-foreground"> {args.length > 120 ? args.slice(0, 120) + '…' : args}</span>
        </summary>
        {item.result && <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{item.result}</pre>}
      </details>
    )
  }
  if (item.kind === 'system') {
    return <div className="my-1 text-xs text-amber-700">⚠ {item.text}</div>
  }
  return <div className="my-2 whitespace-pre-wrap">{item.text}</div>
}
