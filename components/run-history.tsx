'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { RunEntity, RunFloor, RunHistoryView } from '@/lib/backend'

const WIKI = 'https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Main'
const CODEX_API = 'https://spire-codex.com/api'
const CDN = 'https://cdn.spire-codex.com'

type CatalogEntry = {
  id: string
  name?: string
  description?: string
  type?: string
  rarity?: string
  color?: string
  image_url?: string | null
}

type Catalog = {
  cards: Record<string, CatalogEntry>
  relics: Record<string, CatalogEntry>
  potions: Record<string, CatalogEntry>
}

const EMPTY_CATALOG: Catalog = { cards: {}, relics: {}, potions: {} }
const NODE = {
  ancient: { label: 'Ancient', asset: 'event', tone: 'ring-violet-300/60' },
  monster: { label: 'Monster', asset: 'monster', tone: 'ring-slate-300/50' },
  elite: { label: 'Elite', asset: 'elite', tone: 'ring-amber-300/70' },
  boss: { label: 'Boss', asset: 'monster', tone: 'ring-red-400/80' },
  rest_site: { label: 'Rest site', asset: 'rest_site', tone: 'ring-orange-300/60' },
  shop: { label: 'Merchant', asset: 'shop', tone: 'ring-cyan-300/60' },
  treasure: { label: 'Treasure', asset: 'treasure', tone: 'ring-yellow-300/70' },
  event: { label: 'Event', asset: 'event', tone: 'ring-fuchsia-300/60' },
  unknown: { label: 'Unknown', asset: 'event', tone: 'ring-fuchsia-300/60' },
} as const

const CHARACTER_COLOR: Record<string, string> = {
  ironclad: '#dc4b38',
  silent: '#75c64f',
  defect: '#4bb9ef',
  necrobinder: '#d467ef',
  regent: '#ec8a32',
}

const CARD_POOL_COLOR: Record<string, string> = {
  ironclad: '#d62000',
  silent: '#5ebd00',
  defect: '#3eb3ed',
  necrobinder: '#cd4eed',
  regent: '#e36600',
  colorless: '#a3a3a3',
  event: '#a3a3a3',
  curse: '#585b61',
  quest: '#24476a',
  status: '#f8fafc',
  token: '#f8fafc',
}

const CARD_RARITY_COLOR: Record<string, string> = {
  basic: '#9c9c9c',
  starter: '#9c9c9c',
  common: '#9c9c9c',
  uncommon: '#64ffff',
  rare: '#ffda36',
  curse: '#e669ff',
  event: '#13be1a',
  ancient: '#13be1a',
  quest: '#f46836',
  status: '#9c9c9c',
  token: '#9c9c9c',
}

function cleanId(value: string) {
  return value.split('.').at(-1)?.toLowerCase() || ''
}

function slug(value: string) {
  return cleanId(value)
    .replaceAll(' ', '_')
    .replace(/^the_/, '')
    .replace(/[^a-z0-9_]/g, '')
}

function cdnPath(path: string | null | undefined) {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${CDN}${path.replace('/static/images', '')}`
}

function duration(seconds: number | null) {
  if (seconds == null) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remaining = Math.floor(seconds % 60)
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${minutes}:${String(remaining).padStart(2, '0')}`
}

function wikiLink(content: ReactNode, className = '', label?: string) {
  return (
    <a
      href={WIKI}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className={`rounded-sm underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
    >
      {content}
    </a>
  )
}

function catalogMap(rows: CatalogEntry[]) {
  return Object.fromEntries(rows.map((row) => [row.id.toLowerCase(), row]))
}

function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG)
  useEffect(() => {
    const controller = new AbortController()
    Promise.all(
      ['cards', 'relics', 'potions'].map(async (kind) => {
        const response = await fetch(`${CODEX_API}/${kind}?lang=eng`, { signal: controller.signal })
        if (!response.ok) throw new Error(`${kind} catalog unavailable`)
        return catalogMap((await response.json()) as CatalogEntry[])
      }),
    )
      .then(([cards, relics, potions]) => setCatalog({ cards, relics, potions }))
      .catch(() => {})
    return () => controller.abort()
  }, [])
  return catalog
}

function GameImage({
  sources,
  alt,
  className,
  width,
  height,
  fallback,
}: {
  sources: Array<string | null | undefined>
  alt: string
  className: string
  width: number
  height: number
  fallback?: ReactNode
}) {
  const usable = sources.filter((source): source is string => Boolean(source))
  const key = usable.join('|')
  const [failed, setFailed] = useState(0)
  useEffect(() => setFailed(0), [key])
  if (!usable[failed]) return fallback ?? null
  return (
    <Image
      unoptimized
      src={usable[failed]}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setFailed((index) => index + 1)}
    />
  )
}

function cardMeta(entity: RunEntity, catalog: Catalog) {
  return catalog.cards[cleanId(entity.id)] || null
}

function entityMeta(entity: RunEntity, catalog: Catalog) {
  const entries = entity.kind === 'card' ? catalog.cards : entity.kind === 'relic' ? catalog.relics : catalog.potions
  return entries[cleanId(entity.id)] || null
}

function maskStyle(source: string, color: string): CSSProperties {
  return {
    backgroundColor: color,
    WebkitMaskImage: `url(${source})`,
    maskImage: `url(${source})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  }
}

function TinyCard({ entity, catalog, character }: { entity: RunEntity; catalog: Catalog; character: string }) {
  const meta = cardMeta(entity, catalog)
  const pool = (meta?.color || character).toLowerCase()
  const rarity = (entity.rarity || meta?.rarity || '').toLowerCase()
  const type = (entity.type || meta?.type || '').toLowerCase()
  const shape = type === 'attack' ? 'attack' : type === 'power' ? 'power' : type ? 'skill' : null
  const base = `${CDN}/ui/run_history_card`
  return (
    <span aria-hidden="true" className="relative inline-block size-6 shrink-0">
      <span
        className="absolute inset-0"
        style={maskStyle(`${base}/card_back.png`, CARD_POOL_COLOR[pool] || '#a3a3a3')}
      />
      <Image
        unoptimized
        src={`${base}/desc_box.png`}
        alt=""
        width={24}
        height={24}
        className="absolute inset-0 size-6 object-contain opacity-25"
      />
      {shape && (
        <>
          <Image
            unoptimized
            src={`${base}/${shape}_portrait_shadow.png`}
            alt=""
            width={24}
            height={24}
            className="absolute inset-0 size-6 object-contain"
          />
          <Image
            unoptimized
            src={`${base}/${shape}_portrait.png`}
            alt=""
            width={24}
            height={24}
            className="absolute inset-0 size-6 object-contain sepia-[.15]"
          />
        </>
      )}
      <Image
        unoptimized
        src={`${base}/banner_shadow.png`}
        alt=""
        width={24}
        height={24}
        className="absolute inset-0 size-6 object-contain opacity-60"
      />
      <span
        className="absolute inset-0"
        style={maskStyle(`${base}/banner.png`, CARD_RARITY_COLOR[rarity] || '#cbd5e1')}
      />
    </span>
  )
}

function fullCardSources(entity: RunEntity) {
  const id = slug(entity.id)
  if (!id) return []
  const upgraded = entity.upgraded ? '_upg' : ''
  const plain = `${CDN}/cards-full/stable/${id}${upgraded}.webp`
  return entity.enchantment
    ? [`${CDN}/cards-full/stable/ench/${slug(entity.enchantment)}/${id}${upgraded}.webp`, plain]
    : [plain]
}

function cardLabel(entity: RunEntity, prefix = '') {
  return `${prefix}${entity.name}${entity.upgraded && !entity.name.endsWith('+') ? '+' : ''}`
}

function CardLink({
  entity,
  catalog,
  character,
  prefix = '',
  compact = false,
}: {
  entity: RunEntity
  catalog: Catalog
  character: string
  prefix?: string
  compact?: boolean
}) {
  const meta = cardMeta(entity, catalog)
  const label = cardLabel(entity, prefix)
  const tone = entity.enchantment
    ? 'text-fuchsia-600 dark:text-fuchsia-300'
    : entity.upgraded
      ? 'text-emerald-600 dark:text-emerald-300'
      : 'text-foreground'
  return (
    <span className="group/card relative inline-flex min-w-0">
      {wikiLink(
        <>
          <TinyCard entity={entity} catalog={catalog} character={character} />
          <span className="truncate">{label}</span>
        </>,
        `flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-xs transition-colors hover:bg-muted ${tone} ${compact ? 'border border-border bg-background pr-2' : ''}`,
        `Open the Slay the Spire 2 wiki for ${label}`,
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-50 hidden w-40 -translate-x-1/2 drop-shadow-2xl group-hover/card:block group-focus-within/card:block"
      >
        <GameImage
          sources={fullCardSources(entity)}
          alt={`${label} card`}
          width={400}
          height={520}
          className="h-auto w-40"
        />
        {meta?.description && <span className="sr-only">{meta.description}</span>}
      </span>
    </span>
  )
}

function entityImage(entity: RunEntity, meta: CatalogEntry | null) {
  return cdnPath(meta?.image_url) || `${CDN}/${entity.kind === 'relic' ? 'relics' : 'potions'}/${slug(entity.id)}.webp`
}

function EntityIcon({ entity, catalog, size = 'size-9' }: { entity: RunEntity; catalog: Catalog; size?: string }) {
  const meta = entityMeta(entity, catalog)
  const description = entity.description || meta?.description
  return (
    <span className="group/entity relative inline-flex">
      {wikiLink(
        <GameImage
          sources={[entityImage(entity, meta)]}
          alt={entity.name}
          width={48}
          height={48}
          className={`${size} object-contain p-0.5`}
          fallback={
            <span className={`flex ${size} items-center justify-center text-[9px] text-amber-100`}>
              {slug(entity.id).slice(0, 3).toUpperCase()}
            </span>
          }
        />,
        'rounded-md bg-black/25 transition hover:bg-white/10 focus-visible:outline-amber-200',
        `Open the Slay the Spire 2 wiki for ${entity.name}`,
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-50 hidden w-56 -translate-x-1/2 rounded-lg border border-white/15 bg-slate-950/95 p-3 shadow-2xl group-hover/entity:block group-focus-within/entity:block"
      >
        <span className="flex items-center gap-2">
          <GameImage
            sources={[entityImage(entity, meta)]}
            alt=""
            width={40}
            height={40}
            className="size-10 object-contain"
          />
          <span>
            <span className="block text-xs font-semibold text-slate-100">{entity.name}</span>
            <span className="block text-[10px] text-amber-200">
              {entity.rarity || meta?.rarity || entity.kind}
              {entity.floor != null ? ` · Floor ${entity.floor}` : ''}
            </span>
          </span>
        </span>
        {description && <span className="mt-2 block text-[10px] leading-relaxed text-slate-300">{description}</span>}
      </span>
    </span>
  )
}

function Delta({ value, kind }: { value: number; kind: 'damage' | 'heal' | 'gold' | 'spent' }) {
  if (!value) return null
  const styles =
    kind === 'damage'
      ? 'text-red-300'
      : kind === 'heal'
        ? 'text-emerald-300'
        : kind === 'gold'
          ? 'text-yellow-200'
          : 'text-amber-300'
  return (
    <span className={styles}>
      {kind === 'damage' || kind === 'spent' ? '−' : '+'}
      {value}
      {kind === 'gold' || kind === 'spent' ? 'g' : ' HP'}
    </span>
  )
}

function PlainEntityList({
  label,
  entities,
  removed = false,
}: {
  label: string
  entities: RunEntity[]
  removed?: boolean
}) {
  if (!entities.length) return null
  return (
    <div>
      <span className="text-slate-500">{label} </span>
      <span className={removed ? 'text-red-300' : 'text-emerald-300'}>
        {entities.map((entity) => `${removed ? '−' : '+'}${entity.name}`).join(', ')}
      </span>
    </div>
  )
}

function nodeSources(floor: RunFloor) {
  const node = NODE[floor.nodeType as keyof typeof NODE] || NODE.unknown
  const specific =
    floor.nodeType === 'boss' || floor.nodeType === 'ancient' ? `${CDN}/ui/run_history/${slug(floor.title)}.webp` : null
  return [specific, `${CDN}/ui/run_history/${node.asset}.webp`]
}

function MapNode({ floor }: { floor: RunFloor }) {
  const node = NODE[floor.nodeType as keyof typeof NODE] || NODE.unknown
  return (
    <span className="group/node relative inline-flex">
      {wikiLink(
        <>
          <GameImage
            sources={nodeSources(floor)}
            alt=""
            width={40}
            height={40}
            className="size-8 object-contain p-0.5"
            fallback={<span className="text-sm">?</span>}
          />
          <span className="sr-only">
            Floor {floor.floor}: {floor.title || node.label}
          </span>
        </>,
        `flex size-8 items-center justify-center rounded-md bg-black/30 ring-1 ${node.tone} transition hover:-translate-y-0.5 hover:bg-white/10 hover:ring-2`,
        `Floor ${floor.floor}, ${floor.title || node.label}. Open the Slay the Spire 2 wiki`,
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+0.55rem)] left-1/2 z-50 hidden w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-white/15 bg-slate-950/95 p-3 shadow-2xl group-hover/node:block group-focus-within/node:block"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold text-slate-100">{floor.title || node.label}</span>
          <span className="shrink-0 font-mono text-[10px] text-slate-400">F{floor.floor}</span>
        </span>
        <span className="mt-1 block text-[10px] text-slate-400">
          {node.label}
          {floor.turns != null ? ` · ${floor.turns} turns` : ''}
        </span>
        <span className="mt-1.5 flex flex-wrap gap-x-2 text-[10px] text-slate-300">
          {floor.hp != null && (
            <span>
              ♥ {floor.hp}/{floor.maxHp ?? '?'}
            </span>
          )}
          {floor.gold != null && <span>● {floor.gold}g</span>}
          <Delta value={floor.damage} kind="damage" />
          <Delta value={floor.healed} kind="heal" />
          <Delta value={floor.goldGained} kind="gold" />
          <Delta value={floor.goldSpent + floor.goldLost} kind="spent" />
        </span>
        <span className="mt-1.5 block space-y-0.5 text-[10px]">
          <PlainEntityList label="Cards" entities={floor.cardsGained} />
          <PlainEntityList label="Removed" entities={floor.cardsRemoved} removed />
          <PlainEntityList label="Upgraded" entities={floor.cardsUpgraded} />
          <PlainEntityList label="Relics" entities={floor.relicsGained} />
          <PlainEntityList label="Potions" entities={floor.potionsGained} />
          {floor.choices.length > 0 && <span className="block italic text-slate-300">{floor.choices.join(' · ')}</span>}
        </span>
      </span>
    </span>
  )
}

function TopStat({
  icon,
  alt,
  children,
  tone = 'text-slate-100',
}: {
  icon: string
  alt: string
  children: ReactNode
  tone?: string
}) {
  return (
    <span className={`flex items-center gap-1.5 text-xs font-semibold sm:text-sm ${tone}`}>
      <Image
        unoptimized
        src={`${CDN}/ui/top_bar/${icon}`}
        alt={alt}
        width={22}
        height={22}
        className="size-5 object-contain"
      />
      {children}
    </span>
  )
}

function stackCards(deck: RunEntity[], catalog: Catalog) {
  const stacked = new Map<string, { entity: RunEntity; count: number }>()
  for (const entity of deck) {
    const key = `${entity.id}:${entity.upgraded}:${entity.enchantment || ''}`
    const current = stacked.get(key)
    if (current) current.count++
    else stacked.set(key, { entity, count: 1 })
  }
  const rarityScore: Record<string, number> = {
    rare: 5,
    uncommon: 4,
    common: 3,
    starter: 1,
    basic: 1,
    curse: 0,
    status: 0,
  }
  return [...stacked.values()].sort((a, b) => {
    const aRarity = (a.entity.rarity || cardMeta(a.entity, catalog)?.rarity || '').toLowerCase()
    const bRarity = (b.entity.rarity || cardMeta(b.entity, catalog)?.rarity || '').toLowerCase()
    return (rarityScore[bRarity] ?? 2) - (rarityScore[aRarity] ?? 2) || a.entity.name.localeCompare(b.entity.name)
  })
}

function DetailedFloor({ floor, catalog, character }: { floor: RunFloor; catalog: Catalog; character: string }) {
  const node = NODE[floor.nodeType as keyof typeof NODE] || NODE.unknown
  const changes =
    floor.cardsGained.length +
    floor.cardsRemoved.length +
    floor.cardsUpgraded.length +
    floor.relicsGained.length +
    floor.relicsRemoved.length +
    floor.potionsGained.length +
    floor.potionsUsed.length +
    floor.potionsDiscarded.length +
    floor.choices.length
  return (
    <details className="group/floor border-b border-white/10 last:border-0">
      <summary className="grid cursor-pointer list-none grid-cols-[2.25rem_4.25rem_minmax(0,1fr)_auto] items-center gap-2 py-2 text-xs marker:hidden">
        <span className="font-mono text-slate-500">{floor.floor}</span>
        <span className="font-medium text-amber-200">{node.label}</span>
        <span className="truncate text-slate-200">{floor.title}</span>
        <span className="flex gap-2 text-[10px] text-slate-400">
          {floor.turns != null && <span>{floor.turns}T</span>}
          {floor.hp != null && (
            <span>
              ♥ {floor.hp}/{floor.maxHp ?? '?'}
            </span>
          )}
          <span aria-hidden="true" className="transition-transform group-open/floor:rotate-90">
            ›
          </span>
        </span>
      </summary>
      <div className="space-y-2 pb-3 pl-9 text-[11px]">
        <div className="flex flex-wrap gap-x-3">
          <Delta value={floor.damage} kind="damage" />
          <Delta value={floor.healed} kind="heal" />
          <Delta value={floor.goldGained} kind="gold" />
          <Delta value={floor.goldSpent + floor.goldLost} kind="spent" />
        </div>
        {floor.cardsGained.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-slate-500">Cards</span>
            {floor.cardsGained.map((entity, i) => (
              <CardLink
                key={`${entity.id}-${i}`}
                entity={entity}
                catalog={catalog}
                character={character}
                prefix="+ "
                compact
              />
            ))}
          </div>
        )}
        <PlainEntityList label="Removed" entities={floor.cardsRemoved} removed />
        <PlainEntityList label="Upgraded" entities={floor.cardsUpgraded} />
        <PlainEntityList label="Relics" entities={floor.relicsGained} />
        <PlainEntityList label="Lost relics" entities={floor.relicsRemoved} removed />
        <PlainEntityList label="Potions" entities={floor.potionsGained} />
        <PlainEntityList label="Used" entities={floor.potionsUsed} removed />
        <PlainEntityList label="Discarded" entities={floor.potionsDiscarded} removed />
        {floor.choices.length > 0 && <p className="italic text-slate-300">{floor.choices.join(' · ')}</p>}
        {changes === 0 && <p className="text-slate-500">No recorded inventory changes.</p>}
      </div>
    </details>
  )
}

export function NativeRunHistory({ run }: { run: RunHistoryView }) {
  const catalog = useCatalog()
  const character = slug(run.character)
  const characterColor = CHARACTER_COLOR[character] || '#d5b56f'
  const cards = useMemo(() => stackCards(run.deck, catalog), [run.deck, catalog])
  const resultTone =
    run.result === 'won' ? 'text-emerald-400' : run.result === 'lost' ? 'text-red-400' : 'text-amber-300'
  const quote =
    run.result === 'won'
      ? `${run.character} ascended.`
      : run.result === 'abandoned'
        ? 'The journey ended.'
        : run.killedBy
          ? `${run.character} fell to ${run.killedBy}.`
          : `${run.character} fell.`
  const totalFloors = run.acts.reduce((sum, act) => sum + act.floors.length, 0)
  const potionSlots = Math.max(3, run.potions.length)
  return (
    <section className="text-foreground">
      <div
        className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-transparent px-4 py-3"
        style={{ borderColor: `color-mix(in srgb, ${characterColor} 50%, transparent)` }}
      >
        <h2 className="flex items-baseline gap-3 font-serif text-xl font-semibold">
          <span className={resultTone}>
            {run.result === 'won' ? 'Victory' : run.result === 'lost' ? 'Defeat' : 'Abandoned'}
          </span>
          {wikiLink(
            run.character || 'Unknown character',
            'text-base font-normal',
            `Open the Slay the Spire 2 wiki for ${run.character}`,
          )}
        </h2>
        <span className="text-xs text-muted-foreground">Ascension {run.ascension ?? 0}</span>
      </div>

      <div
        className="rounded-xl border bg-transparent p-4 shadow-xl sm:p-5"
        style={{ borderColor: `color-mix(in srgb, ${characterColor} 45%, transparent)` }}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3">
          {wikiLink(
            <GameImage
              sources={[`${CDN}/characters/character_icon_${character}.webp`]}
              alt={run.character}
              width={40}
              height={40}
              className="size-10 rounded-full border-2 object-cover"
              fallback={
                <span className="flex size-10 items-center justify-center rounded-full border text-xs">
                  {run.character.slice(0, 1)}
                </span>
              }
            />,
            'shrink-0',
            `Open the Slay the Spire 2 wiki for ${run.character}`,
          )}
          <TopStat icon="top_bar_heart.webp" alt="Health" tone={run.hp === 0 ? 'text-red-400' : 'text-red-300'}>
            {run.hp ?? '?'}/{run.maxHp ?? '?'}
          </TopStat>
          <TopStat icon="top_bar_gold.webp" alt="Gold" tone="text-amber-300">
            {run.gold ?? '—'}
          </TopStat>
          <span
            className="flex items-center gap-1"
            aria-label={`${run.potions.length} potions in ${potionSlots} slots`}
          >
            {Array.from({ length: potionSlots }, (_, index) =>
              run.potions[index] ? (
                <EntityIcon key={index} entity={run.potions[index]} catalog={catalog} size="size-5" />
              ) : (
                <span key={index} className="size-5 rounded-sm border border-dashed border-border" />
              ),
            )}
          </span>
          <TopStat icon="top_bar_map.webp" alt="Floors">
            {totalFloors}
          </TopStat>
          <TopStat icon="timer_icon.webp" alt="Duration">
            {duration(run.durationSeconds)}
          </TopStat>
          {(run.ascension ?? 0) > 0 && (
            <TopStat icon="top_bar_ascension.webp" alt="Ascension" tone="text-amber-300">
              A{run.ascension}
            </TopStat>
          )}
          <span className="w-full text-left text-[10px] leading-tight text-muted-foreground sm:ml-auto sm:w-auto sm:text-right">
            {run.startedAt && <time className="block">{new Date(run.startedAt).toLocaleString()}</time>}
            {run.seed && (
              <span className="block">
                Seed · <span className="font-mono text-foreground">{run.seed}</span>
              </span>
            )}
            <span className="block">
              {run.gameMode || 'Standard'}
              {run.build ? ` · ${run.build}` : ''}
            </span>
          </span>
        </div>

        <p className="my-4 font-serif text-sm italic text-muted-foreground">“{quote}”</p>
        <div className="mb-5 space-y-2" aria-label="Run path">
          {run.acts.map((act, index) => (
            <div
              key={`${act.name}-${index}`}
              className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[7rem_minmax(0,1fr)]"
            >
              <h3 className="truncate font-serif text-xs text-muted-foreground">{act.name}</h3>
              <div className="flex flex-wrap gap-1.5">
                {act.floors.map((floor) => (
                  <MapNode key={floor.floor} floor={floor} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <h3 className="mb-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Relics ({run.relics.length})</span>
          </h3>
          <div className="flex flex-wrap gap-1">
            {run.relics.map((entity, index) => (
              <EntityIcon key={`${entity.id}-${index}`} entity={entity} catalog={catalog} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Cards ({run.deck.length})</span>
          </h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map(({ entity, count }, index) => (
              <CardLink
                key={`${entity.id}-${entity.upgraded}-${entity.enchantment}-${index}`}
                entity={{ ...entity, name: `${count > 1 ? `${count}× ` : ''}${entity.name}` }}
                catalog={catalog}
                character={character}
              />
            ))}
          </div>
        </div>
        {run.badges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {run.badges.map((badge) => (
              <span
                key={`${badge.name}-${badge.rarity}`}
                className="rounded border border-amber-300/20 bg-amber-300/5 px-2 py-0.5 text-[10px] text-amber-200"
              >
                {badge.name}
                {badge.rarity ? ` · ${badge.rarity}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      <details className="group/details mt-3 rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-muted-foreground marker:hidden hover:text-foreground">
          <span aria-hidden="true" className="transition-transform group-open/details:rotate-90">
            ›
          </span>
          <span>
            Show detailed history{' '}
            <span className="text-xs">(deck list, relic acquisition floors, floor-by-floor stats)</span>
          </span>
        </summary>
        <div className="space-y-4 border-t border-border p-4">
          <section>
            <h3 className="mb-2 text-sm font-semibold">Final deck ({run.deck.length})</h3>
            <div className="flex flex-wrap gap-1">
              {run.deck.map((entity, index) => (
                <CardLink
                  key={`${entity.id}-${index}`}
                  entity={entity}
                  catalog={catalog}
                  character={character}
                  compact
                />
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Relics ({run.relics.length})</h3>
            <div className="flex flex-wrap gap-1.5">
              {run.relics.map((entity, index) => (
                <span
                  key={`${entity.id}-${index}`}
                  className="inline-flex items-center gap-1.5 rounded border border-border bg-background py-1 pl-1 pr-2 text-xs"
                >
                  <EntityIcon entity={entity} catalog={catalog} size="size-7" />
                  <span>
                    {wikiLink(entity.name, 'text-amber-600 dark:text-amber-300')}
                    {entity.floor != null && <span className="ml-1 text-muted-foreground">F{entity.floor}</span>}
                  </span>
                </span>
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Floor history</h3>
            {run.acts.map((act, index) => (
              <div key={`${act.name}-${index}`}>
                <h4 className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {act.name}
                </h4>
                {act.floors.map((floor) => (
                  <DetailedFloor key={floor.floor} floor={floor} catalog={catalog} character={character} />
                ))}
              </div>
            ))}
          </section>
          <p className="text-[10px] text-muted-foreground">
            Source:{' '}
            {run.source === 'native-run'
              ? 'native .run file'
              : 'verified sensor reconstruction; unavailable fields are not inferred'}
            .
          </p>
        </div>
      </details>
    </section>
  )
}
