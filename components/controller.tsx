'use client'

import type { PadEvent } from '@/lib/backend'

// View-only Xbox pad: highlights whatever the player pressed most recently.
export function ControllerView({ last, history }: { last: PadEvent | null; history: PadEvent[] }) {
  const active = last && Date.now() - last.t < 1500 ? last.button : ''
  const on = (name: string) => (active === name ? 'fill-emerald-500 stroke-emerald-700' : 'fill-muted stroke-border')
  const label = (e: PadEvent) => {
    if (e.kind === 'dpad') return `dpad ${e.button}${e.presses && e.presses > 1 ? ` ×${e.presses}` : ''}`
    if (e.kind === 'stick') return `${e.button} stick (${e.x?.toFixed(1)}, ${e.y?.toFixed(1)})`
    return `${e.button}${e.hold_ms && e.hold_ms !== 80 ? ` ${e.hold_ms}ms` : ''}`
  }
  return (
    <div className="flex flex-col gap-3">
      <svg viewBox="0 0 300 180" className="w-full max-w-sm" aria-label="virtual controller">
        <rect x="10" y="30" width="280" height="120" rx="40" className="fill-card stroke-border" />
        {/* bumpers / triggers */}
        <rect x="40" y="8" width="60" height="16" rx="6" className={on('lb')} />
        <rect x="200" y="8" width="60" height="16" rx="6" className={on('rb')} />
        <rect x="55" y="0" width="30" height="7" rx="3" className={on('lt')} />
        <rect x="215" y="0" width="30" height="7" rx="3" className={on('rt')} />
        {/* left stick */}
        <circle cx="60" cy="75" r="18" className={on('left') + ' ' + on('ls')} />
        {/* d-pad */}
        <rect x="88" y="105" width="14" height="14" className={on('up')} />
        <rect x="88" y="135" width="14" height="14" className={on('down')} />
        <rect x="73" y="120" width="14" height="14" className={on('left')} />
        <rect x="103" y="120" width="14" height="14" className={on('right')} />
        {/* center */}
        <circle cx="125" cy="75" r="7" className={on('back')} />
        <circle cx="150" cy="70" r="9" className={on('guide')} />
        <circle cx="175" cy="75" r="7" className={on('start')} />
        {/* right stick */}
        <circle cx="190" cy="125" r="16" className={on('right') + ' ' + on('rs')} />
        {/* face buttons */}
        <circle cx="240" cy="55" r="10" className={on('y')} />
        <text x="240" y="59" textAnchor="middle" className="fill-foreground text-[10px] font-bold">Y</text>
        <circle cx="240" cy="95" r="10" className={on('a')} />
        <text x="240" y="99" textAnchor="middle" className="fill-foreground text-[10px] font-bold">A</text>
        <circle cx="220" cy="75" r="10" className={on('x')} />
        <text x="220" y="79" textAnchor="middle" className="fill-foreground text-[10px] font-bold">X</text>
        <circle cx="260" cy="75" r="10" className={on('b')} />
        <text x="260" y="79" textAnchor="middle" className="fill-foreground text-[10px] font-bold">B</text>
      </svg>
      <div className="text-xs text-muted-foreground">
        last input: <span className="font-mono text-foreground">{last ? label(last) : '—'}</span>
      </div>
      <ol className="max-h-56 overflow-y-auto rounded-md border border-border bg-background p-2 font-mono text-xs">
        {history
          .slice()
          .reverse()
          .slice(0, 60)
          .map((e, i) => (
            <li key={`${e.t}-${i}`} className="flex gap-2 py-0.5">
              <span className="text-muted-foreground">{new Date(e.t).toLocaleTimeString()}</span>
              <span>{label(e)}</span>
            </li>
          ))}
        {history.length === 0 && <li className="text-muted-foreground">no inputs yet</li>}
      </ol>
    </div>
  )
}
