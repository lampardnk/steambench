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

export type PadEvent = {
  t: number
  kind: 'press' | 'dpad' | 'stick'
  button: string
  hold_ms?: number
  presses?: number
  interval_ms?: number
  x?: number
  y?: number
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
  failed: number
  recent: Objective[]
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
  /** Latest commit this room made to the persistent skill library. */
  lastLibraryCommit?: { hash: string; message: string; by: string; at: number } | null
  curriculum?: Curriculum | null
  frames: number
  lastFrameAt: number
  media: { ready: boolean; codecs: string; fragments: number; bytes: number; audioReady: boolean; audioCodecs: string; audioFragments: number; width: number; height: number } | null
  lastPad: PadEvent | null
  padCount: number
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
