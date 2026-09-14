'use client'

// The dashboard is static (Vercel); it talks to the steambench server running
// next to the games (home machine) through a URL + token saved in this browser.

export type Settings = { backendUrl: string; token: string }

const KEY = 'steambench.settings'

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return { backendUrl: '', token: '' }
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) return { backendUrl: '', token: '', ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { backendUrl: '', token: '' }
}

export function saveSettings(s: Settings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

export function apiUrl(s: Settings, path: string, query: Record<string, string> = {}) {
  const u = new URL(normalizeUrl(s.backendUrl) + path)
  u.searchParams.set('token', s.token)
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v)
  return u.toString()
}

export function wsUrl(s: Settings, path: string) {
  const u = new URL(normalizeUrl(s.backendUrl) + path)
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
  u.searchParams.set('token', s.token)
  return u.toString()
}

export async function api<T>(s: Settings, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(normalizeUrl(s.backendUrl) + path, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${s.token}`, ...(init.headers || {}) },
  })
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { error: text }
  }
  if (!res.ok) {
    const err = (body as { error?: string } | null)?.error || `${res.status} ${res.statusText}`
    throw new Error(err)
  }
  return body as T
}

export type ActionEvent = {
  id: string
  t: number
  action: string
  params: Record<string, unknown>
  acknowledgement: 'dispatching' | 'received' | 'unknown'
  result: unknown
  verification: 'pending' | 'awaiting_verification' | 'verified' | 'failed' | 'unknown'
  verificationDetail?: string
}

/** One member of the playing team, as the player's runtime publishes it. */
export type AgentInfo = {
  id: string
  role: string
  label: string
  title?: string | null
  parent?: string | null
  status: 'open' | 'closed'
  openedAt?: number
  closedAt?: number | null
  decisions?: number
  outcome?: string | null
  summary?: string | null
}

/** One model call, billed to the member that made it. */
export type AgentTurn = {
  at: number
  role: string | null
  model: string | null
  /** The thinking level the call was made at, not a token count. */
  thinking: string | null
  stopReason: string | null
  latencyMs: number
  contextWindow: number | null
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  /** Reasoning tokens, part of output. */
  reasoning: number
  totalTokens: number
  /** What this turn occupied of the window: prompt, cache reads and output. */
  contextUsed: number
}

export type AgentTotals = {
  turns: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  reasoning: number
  totalTokens: number
  latencyMs: number
  /** The tightest single turn, which is what the window has to accommodate. */
  peakContextUsed: number
}

export type LaneUsage = { turns: AgentTurn[]; totals: AgentTotals; contextWindow: number | null }
/** Spend per lane id, as the server's ledger publishes it. */
export type UsageByLane = Record<string, LaneUsage>

const TOKEN_FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning', 'totalTokens'] as const
/** Matches the server ledger, so a live turn and a reconnect agree. */
const MAX_TURNS_PER_LANE = 200
const emptyTotals = (): AgentTotals => ({ turns: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0, latencyMs: 0, peakContextUsed: 0 })

/**
 * Fold one live turn into the lane ledger the snapshot seeded.
 *
 * Totals accumulate rather than being derived from `turns`, because turns roll
 * off once a lane is long-lived and a derived total would quietly shrink.
 */
export function addTurn(byLane: UsageByLane, lane: string, turn: AgentTurn): UsageByLane {
  const entry = byLane[lane]
  const totals = entry ? { ...entry.totals } : emptyTotals()
  totals.turns++
  for (const field of TOKEN_FIELDS) totals[field] += turn[field] || 0
  totals.latencyMs += turn.latencyMs || 0
  totals.peakContextUsed = Math.max(totals.peakContextUsed, turn.contextUsed || 0)
  return {
    ...byLane,
    [lane]: {
      turns: [...(entry?.turns || []), turn].slice(-MAX_TURNS_PER_LANE),
      totals,
      contextWindow: turn.contextWindow ?? entry?.contextWindow ?? null,
    },
  }
}

export type TranscriptItem = {
  id: string
  t: number
  /** Which member said it. Items from before the team split carry no lane. */
  agent?: string
  kind: 'user' | 'thinking' | 'text' | 'tool' | 'system'
  text?: string
  from?: string
  queued?: boolean
  toolCallId?: string
  toolName?: string
  args?: Record<string, unknown>
  result?: string
  isError?: boolean
  pending?: boolean
  done?: boolean
}

export type RoomSetup = {
  game: string
  gameName?: string
  player: { kind: 'builtin'; name?: string }
  task: { ascension: number; character: string; prompt?: string }
  /** Optional operator-provided seed-independent input for this room's artifact. */
  learningArtifact?: string
}

export type LearningEdit = {
  id: string
  at: number
  agent: string
  lane?: string
  role?: string | null
  decision?: number | null
  message: string
  sourcePath?: string | null
  /** Verified candidate IDs used by a run-end synthesis edit. */
  sourceCandidates?: string[]
  /** Runtime lane that compacted those candidates into the artifact. */
  synthesizedBy?: string | null
  operation?: string
  artifact: string
  beforeHash: string
  afterHash: string
  bytesBefore?: number
  bytesAfter?: number
  patch: string
}

export type LearningArtifactReport = {
  path: string
  input: { provided: boolean; hash: string; bytes: number; content?: string }
  output: { hash: string; bytes: number; edits: number; content?: string }
  /** Full edit entries are present on the room/archive artifact endpoint.
   * Live room summaries intentionally omit patches to stay small. */
  edits?: LearningEdit[]
  diff?: string
}

export type RunEntity = {
  id: string
  name: string
  kind: 'card' | 'relic' | 'potion'
  floor: number | null
  upgraded: boolean
  enchantment: string | null
  type: string | null
  rarity: string | null
  cost: string | number | null
  description: string | null
}

export type RunFloor = {
  floor: number
  nodeType: string
  title: string
  turns: number | null
  hp: number | null
  maxHp: number | null
  gold: number | null
  damage: number
  healed: number
  goldGained: number
  goldLost: number
  goldSpent: number
  cardsGained: RunEntity[]
  cardsRemoved: RunEntity[]
  cardsUpgraded: RunEntity[]
  relicsGained: RunEntity[]
  relicsRemoved: RunEntity[]
  potionsGained: RunEntity[]
  potionsUsed: RunEntity[]
  potionsDiscarded: RunEntity[]
  choices: string[]
}

export type RunHistoryView = {
  source: 'native-run' | 'sensor-history'
  result: string
  character: string
  ascension: number | null
  build: string | null
  gameMode: string | null
  seed: string | null
  startedAt: number | null
  durationSeconds: number | null
  hp: number | null
  maxHp: number | null
  gold: number | null
  killedBy: string | null
  deck: RunEntity[]
  relics: RunEntity[]
  potions: RunEntity[]
  badges: { name: string; rarity: string | null }[]
  acts: { name: string; floors: RunFloor[] }[]
}

/** One objective from the curriculum ladder, as the player's runtime writes it. */
export type Objective = {
  id: string
  text: string
  why?: string
  done_when?: string
  area?: string
  status: 'active' | 'completed' | 'failed' | 'abandoned'
  attempts?: number
  critiques?: string[]
  opened?: { room?: string | null; decision?: number; at?: number; act?: number | null; floor?: number | null; by?: string }
  closed?: { decision?: number; at?: number; reasoning?: string }
}

export type Curriculum = {
  active: Objective | null
  completed: number
  abandoned: number
}

export type RoomSummary = {
  id: string
  name: string
  stage: string
  detail: string
  createdAt: number
  setup: RoomSetup | null
  login: { personaName: string; steamId: string } | null
  loginQr: { url: string; at: number; reloads: number } | null
  loginReused: boolean
  sessionId: string | null
  finish: { result: string; summary: string; by: string; at: number; gameState?: Record<string, unknown> | null; disputed?: boolean } | null
  gameReady: boolean
  lobbyId: string | null
  roomContainer: string | null
  roomIp: string | null
  playerImage: string | null
  agentStatus: string
  requiresResume?: boolean
  attention?: { id: string; error: string; path: string; decision: number; at: string; status: string } | null
  /** One room-scoped learning artifact; full content is available from its endpoint. */
  learningArtifact?: LearningArtifactReport | null
  curriculum?: Curriculum | null
  frames: number
  lastFrameAt: number
  media: { ready: boolean; codecs: string; fragments: number; bytes: number; audioReady: boolean; audioCodecs: string; audioFragments: number; width: number; height: number } | null
  lastAction: ActionEvent | null
  actionCount: number
  lastState: Record<string, unknown> | null
  log: string[]
}

export type Meta = {
  savedLogin: { savedAt: number | null } | null
  games: { key: string; appid: string; name: string }[]
  characters: string[]
  builtinPlayer: { name: string; model: string; reasoning: string; configured: boolean; ready: boolean; reason?: string | null }
  maxRooms: number
  observerSlots: number
  /** Reference sites the player may fetch, and the persistent strategy guides. */
  referenceHosts?: string[]
  librarySkills?: string[]
}

export type LibraryGame = {
  key: string
  appid: string
  name: string
  supported: boolean
  owned: boolean | null
  install: { present: boolean; installed: boolean; stateFlags: number | null }
}

export const STAGE_LABELS: Record<string, string> = {
  creating: 'creating room',
  login: 'sign in to Steam',
  setup: 'choose game, player, task',
  installing: 'installing',
  launching: 'launching game',
  playing: 'playing',
  finished: 'finished',
  deleting: 'closing',
  deleted: 'closed',
  error: 'error',
}

export const STAGE_COLORS: Record<string, string> = {
  playing: 'bg-emerald-500',
  login: 'bg-amber-500',
  setup: 'bg-sky-500',
  installing: 'bg-violet-500',
  launching: 'bg-violet-500',
  finished: 'bg-neutral-500',
  error: 'bg-red-500',
  deleting: 'bg-neutral-400',
}
