'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { RunEntity, RunFloor, RunHistoryView } from '@/lib/backend'

const WIKI = 'https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Main'
const NODE = {
  ancient: { icon: '✦', label: 'Ancient', tone: 'border-violet-400/60 bg-violet-500/15 text-violet-200' },
  monster: { icon: '⚔', label: 'Monster', tone: 'border-slate-400/60 bg-slate-500/15 text-slate-100' },
  elite: { icon: '◆', label: 'Elite', tone: 'border-amber-400/70 bg-amber-500/20 text-amber-100' },
  boss: { icon: '♛', label: 'Boss', tone: 'border-red-400/70 bg-red-500/20 text-red-100' },
  rest_site: { icon: '♨', label: 'Rest site', tone: 'border-orange-400/60 bg-orange-500/15 text-orange-100' },
  shop: { icon: '¤', label: 'Merchant', tone: 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100' },
  treasure: { icon: '◇', label: 'Treasure', tone: 'border-yellow-300/60 bg-yellow-400/15 text-yellow-100' },
  unknown: { icon: '?', label: 'Unknown', tone: 'border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-100' },
} as const

function duration(seconds: number | null) {
  if (seconds == null) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remaining = Math.floor(seconds % 60)
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}` : `${minutes}:${String(remaining).padStart(2, '0')}`
}

function wikiLink(name: string, className = '') {
  return <a href={WIKI} target="_blank" rel="noreferrer" className={`underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}>{name}</a>
}

function cardImage(entity: RunEntity) {
  const id = entity.id.split('.').at(-1)?.toLowerCase()
  return id ? `https://cdn.spire-codex.com/cards-full/stable/${encodeURIComponent(id)}.webp` : null
}

function CardLink({ entity, prefix = '' }: { entity: RunEntity; prefix?: string }) {
  const [failed, setFailed] = useState(false)
  const image = cardImage(entity)
  const label = `${prefix}${entity.name}${entity.upgraded && !entity.name.endsWith('+') ? '+' : ''}`
  return (
    <span className="group relative inline-flex">
      {wikiLink(label, 'rounded border border-white/15 bg-white/8 px-2 py-1 text-sky-100')}
      {image && !failed && (
        <span role="tooltip" className="pointer-events-none invisible absolute bottom-[calc(100%+0.5rem)] left-1/2 z-50 w-56 -translate-x-1/2 rounded-lg border border-white/20 bg-slate-950/95 p-2 opacity-0 shadow-2xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          <Image unoptimized src={image} alt={`${entity.name} card`} width={250} height={350} className="h-auto w-full rounded" onError={() => setFailed(true)} />
          <span className="mt-1 block text-center text-[11px] text-slate-300">{entity.name}{entity.enchantment ? ` · ${entity.enchantment}` : ''}</span>
        </span>
      )}
    </span>
  )
}

function EntityList({ label, entities, cards = false, removed = false }: { label: string; entities: RunEntity[]; cards?: boolean; removed?: boolean }) {
  if (!entities.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-slate-400">{label}</span>
      {entities.map((entity, index) => cards
        ? <CardLink key={`${entity.id}-${index}`} entity={entity} prefix={removed ? '− ' : '+ '} />
        : <span key={`${entity.id}-${index}`} className={`rounded border border-white/15 bg-white/8 px-2 py-1 ${removed ? 'line-through text-red-200' : 'text-amber-100'}`}>{wikiLink(`${removed ? '− ' : '+ '}${entity.name}`)}</span>)}
    </div>
  )
}

function Delta({ value, kind }: { value: number; kind: 'damage' | 'heal' | 'gold' | 'spent' }) {
  if (!value) return null
  const styles = kind === 'damage' ? 'text-red-300' : kind === 'heal' ? 'text-emerald-300' : kind === 'gold' ? 'text-yellow-200' : 'text-amber-300'
  const sign = kind === 'damage' || kind === 'spent' ? '−' : '+'
  return <span className={styles}>{sign}{value}{kind === 'gold' || kind === 'spent' ? 'g' : ' HP'}</span>
}

function FloorNode({ floor }: { floor: RunFloor }) {
  const node = NODE[floor.nodeType as keyof typeof NODE] || NODE.unknown
  return (
    <li className="relative pb-3 pl-8 last:pb-0">
      <span className={`absolute left-0 top-1 flex size-6 items-center justify-center rounded-full border text-xs font-semibold shadow ${node.tone}`}>{node.icon}</span>
      <details className="group rounded-lg border border-white/10 bg-black/20 open:bg-black/35">
        <summary className="grid cursor-pointer list-none grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-xs marker:hidden">
          <span className="font-mono text-slate-400">F{floor.floor}</span>
          <span className="min-w-0 truncate font-medium text-slate-100">{wikiLink(floor.title || node.label)}</span>
          <span className="flex items-center gap-2 whitespace-nowrap text-[11px] text-slate-400">
            {floor.turns != null && <span>{floor.turns}T</span>}
            {floor.hp != null && <span className={floor.hp === 0 ? 'text-red-300' : ''}>♥ {floor.hp}/{floor.maxHp ?? '?'}</span>}
            {floor.gold != null && <span>¤ {floor.gold}</span>}
          </span>
        </summary>
        <div className="space-y-2 border-t border-white/10 px-3 py-2 text-[11px]">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-slate-400">{node.label}</span>
            <Delta value={floor.damage} kind="damage" />
            <Delta value={floor.healed} kind="heal" />
            <Delta value={floor.goldGained} kind="gold" />
            <Delta value={floor.goldSpent + floor.goldLost} kind="spent" />
          </div>
          <EntityList label="Cards" entities={floor.cardsGained} cards />
          <EntityList label="Removed" entities={floor.cardsRemoved} cards removed />
          <EntityList label="Upgraded" entities={floor.cardsUpgraded} cards />
          <EntityList label="Relics" entities={floor.relicsGained} />
          <EntityList label="Lost relics" entities={floor.relicsRemoved} removed />
          <EntityList label="Potions" entities={floor.potionsGained} />
          <EntityList label="Used" entities={floor.potionsUsed} removed />
          <EntityList label="Discarded" entities={floor.potionsDiscarded} removed />
          {floor.choices.length > 0 && <p className="text-slate-300">{floor.choices.join(' · ')}</p>}
        </div>
      </details>
    </li>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"><div className="text-[10px] uppercase tracking-widest text-slate-400">{label}</div><div className="mt-0.5 font-mono text-sm text-slate-100">{value}</div></div>
}

export function NativeRunHistory({ run }: { run: RunHistoryView }) {
  const resultTone = run.result === 'won' ? 'text-emerald-300' : run.result === 'lost' ? 'text-red-300' : 'text-amber-300'
  return (
    <section className="overflow-hidden rounded-xl border border-slate-500/40 bg-[radial-gradient(circle_at_top,#334155_0%,#172033_38%,#090d16_100%)] text-slate-100 shadow-xl">
      <div className="border-b border-white/10 bg-black/20 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${resultTone}`}>{run.result}</p>
            <h2 className="mt-1 text-2xl font-semibold">{wikiLink(run.character || 'Unknown character')}</h2>
            <p className="mt-1 text-xs text-slate-400">Ascension {run.ascension ?? 0} · {run.gameMode || 'Standard'} · {run.source === 'native-run' ? 'native .run' : 'verified sensor reconstruction'}</p>
          </div>
          {run.startedAt && <time className="text-xs text-slate-400">{new Date(run.startedAt).toLocaleString()}</time>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <Metric label="Health" value={`${run.hp ?? '?'}/${run.maxHp ?? '?'}`} />
          <Metric label="Gold" value={run.gold ?? '—'} />
          <Metric label="Floors" value={run.acts.reduce((sum, act) => sum + act.floors.length, 0)} />
          <Metric label="Time" value={duration(run.durationSeconds)} />
          <Metric label="Cards" value={run.deck.length} />
          <Metric label="Relics" value={run.relics.length} />
          <Metric label="Build" value={run.build || '—'} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          {run.seed && <span>Seed <span className="font-mono text-slate-200">{run.seed}</span></span>}
          {run.killedBy && run.result !== 'won' && <span>Ended by {wikiLink(run.killedBy, 'text-red-200')}</span>}
          {run.badges.map(badge => <span key={`${badge.name}-${badge.rarity}`} className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 text-amber-100">{badge.name}{badge.rarity ? ` · ${badge.rarity}` : ''}</span>)}
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Relics ({run.relics.length})</h3>
          <div className="flex flex-wrap gap-2">{run.relics.map((relic, index) => <span key={`${relic.id}-${index}`} className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-xs text-amber-100">{wikiLink(relic.name)}{relic.floor != null && <span className="ml-1 text-amber-200/50">F{relic.floor}</span>}</span>)}</div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Final deck ({run.deck.length})</h3>
          <div className="flex flex-wrap gap-2">{run.deck.map((card, index) => <CardLink key={`${card.id}-${index}`} entity={card} />)}</div>
        </div>
        {run.potions.length > 0 && <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Potions ({run.potions.length})</h3><div className="flex flex-wrap gap-2">{run.potions.map((potion, index) => <span key={`${potion.id}-${index}`} className="rounded-full border border-fuchsia-300/25 bg-fuchsia-300/10 px-2.5 py-1 text-xs text-fuchsia-100">{wikiLink(potion.name)}</span>)}</div></div>}
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Path history</h3>
          <div className="grid gap-4 xl:grid-cols-3">
            {run.acts.map((act, index) => <section key={`${act.name}-${index}`} className="rounded-xl border border-white/10 bg-white/4 p-3"><h4 className="mb-3 text-center font-medium text-slate-200">{act.name}</h4><ol className="relative before:absolute before:bottom-3 before:left-[0.7rem] before:top-3 before:w-px before:bg-white/15">{act.floors.map(floor => <FloorNode key={floor.floor} floor={floor} />)}</ol></section>)}
          </div>
        </div>
      </div>
    </section>
  )
}
