'use client'

import type { AgentTotals, AgentTurn, LaneUsage } from '@/lib/backend'

/**
 * What a member of the team spent: per turn, and over its whole life.
 *
 * Every call is a fresh session, so a turn's context figure is what that one
 * turn occupied, never a conversation creeping towards a limit. The total a
 * lane reports is therefore its tightest single turn, not a running sum -
 * summing them would invent pressure the window never felt.
 */

const NBSP = ' '

export function formatTokens(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value < 1000) return String(Math.round(value))
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`
  return `${(value / 1_000_000).toFixed(2)}M`
}

export function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m${NBSP}${Math.round(seconds % 60)}s`
  return `${Math.floor(minutes / 60)}h${NBSP}${minutes % 60}m`
}

/** Output tokens per second of wall clock. Blank when there is no clock to divide by. */
export function tokensPerSecond(output: number, latencyMs: number) {
  if (!latencyMs || !output) return null
  return (output / (latencyMs / 1000))
}

/** Percentage of the window still free. Null when the window size is unknown. */
export function contextLeft(used: number, window: number | null | undefined) {
  if (!window || window <= 0) return null
  return Math.max(0, Math.min(100, (1 - used / window) * 100))
}

const percent = (value: number | null) => (value == null ? '—' : `${value >= 99.95 ? value.toFixed(2) : value.toFixed(1)}%`)
const rate = (value: number | null) => (value == null ? '—' : `${value.toFixed(value < 10 ? 1 : 0)}/s`)

/** Below ten percent free, the number is the story. */
const contextTone = (left: number | null) => (left == null ? 'text-muted-foreground' : left < 10 ? 'text-destructive' : left < 25 ? 'text-warning' : '')

function Stat({ label, value, title, tone = '' }: { label: string; value: string; title?: string; tone?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`truncate font-mono text-xs tabular-nums ${tone}`}>{value}</div>
    </div>
  )
}

/** The lane's whole life, shown above its conversation. */
export function TotalsBar({ usage }: { usage: LaneUsage | undefined }) {
  const totals: AgentTotals | undefined = usage?.totals
  if (!totals?.turns) return <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">No model calls billed to this agent yet.</p>
  const left = contextLeft(totals.peakContextUsed, usage?.contextWindow)
  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-2 rounded-md border border-border bg-muted/30 px-3 py-2 sm:grid-cols-8">
      <Stat label="turns" value={String(totals.turns)} />
      <Stat label="ctx left" value={percent(left)} tone={contextTone(left)} title={`Tightest turn used ${totals.peakContextUsed.toLocaleString()} of ${usage?.contextWindow?.toLocaleString() ?? 'an unknown'} tokens`} />
      <Stat label="in" value={formatTokens(totals.input)} title={`${totals.input.toLocaleString()} prompt tokens`} />
      <Stat label="out" value={formatTokens(totals.output)} title={`${totals.output.toLocaleString()} completion tokens`} />
      <Stat label="cache" value={formatTokens(totals.cacheRead)} title={`${totals.cacheRead.toLocaleString()} read, ${totals.cacheWrite.toLocaleString()} written`} />
      <Stat label="reasoning" value={formatTokens(totals.reasoning)} title={`${totals.reasoning.toLocaleString()} reasoning tokens, part of output`} />
      <Stat label="tok/s" value={rate(tokensPerSecond(totals.output, totals.latencyMs))} title="Output tokens per second of model time" />
      <Stat label="elapsed" value={formatDuration(totals.latencyMs)} title="Total time this agent spent inside the model" />
    </div>
  )
}

const HEADINGS = ['#', 'ctx left', 'in', 'out', 'cache', 'reasoning', 'tok/s', 'elapsed']

/** Every turn the lane took, newest last, as one scannable ledger. */
export function TurnLedger({ usage }: { usage: LaneUsage | undefined }) {
  const turns = usage?.turns || []
  if (!turns.length) return null
  return (
    <details className="rounded-md border border-border bg-card">
      <summary className="cursor-pointer select-none px-3 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {turns.length} turn{turns.length === 1 ? '' : 's'}
        <span className="text-muted-foreground"> · what each decision cost</span>
      </summary>
      <div className="max-h-64 overflow-auto border-t border-border">
        <table className="w-full text-left font-mono text-[11px] tabular-nums">
          <thead className="sticky top-0 bg-card">
            <tr className="text-[9px] uppercase tracking-wide text-muted-foreground">
              {HEADINGS.map((heading) => <th key={heading} scope="col" className="px-2 py-1 font-normal">{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {turns.map((turn, index) => <TurnRow key={`${turn.at}-${index}`} turn={turn} index={index} total={turns.length} />)}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function TurnRow({ turn, index, total }: { turn: AgentTurn; index: number; total: number }) {
  const left = contextLeft(turn.contextUsed, turn.contextWindow)
  // Turns roll off the front once a lane is long-lived, so number from the end:
  // the last row is always the latest turn, whatever has been trimmed.
  const number = index + 1 - total
  const failed = turn.stopReason && turn.stopReason !== 'stop'
  return (
    <tr className={`border-t border-border/50 ${failed ? 'bg-destructive/5' : ''}`} title={`${new Date(turn.at).toLocaleTimeString()}${turn.thinking ? ` · thinking ${turn.thinking}` : ''}${failed ? ` · stopped: ${turn.stopReason}` : ''}`}>
      <td className="px-2 py-1 text-muted-foreground">{number === 0 ? 'last' : number}</td>
      <td className={`px-2 py-1 ${contextTone(left)}`}>{percent(left)}</td>
      <td className="px-2 py-1">{formatTokens(turn.input)}</td>
      <td className="px-2 py-1">{formatTokens(turn.output)}</td>
      <td className="px-2 py-1 text-muted-foreground">{formatTokens(turn.cacheRead)}</td>
      <td className="px-2 py-1">{formatTokens(turn.reasoning)}</td>
      <td className="px-2 py-1">{rate(tokensPerSecond(turn.output, turn.latencyMs))}</td>
      <td className="px-2 py-1">{formatDuration(turn.latencyMs)}</td>
    </tr>
  )
}
