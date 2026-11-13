import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptOrigin, Register, SessionUsage } from 'claude-code'

import type { ContextView, Held, LastCall, Limit, Snapshot, Tallies, Totals } from '../types'

const snapshot = atom({ plugin: 'usage-hud', key: 'snapshot' } as const, null, { shape: 'snapshot-1' })
const lastCall = atom({ plugin: 'usage-hud', key: 'lastCall' } as const, null, { shape: 'last-1' })
const totals = atom({ plugin: 'usage-hud', key: 'totals' } as const, { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 }, { shape: 'totals-2' })
const lifetime = atom({ plugin: 'usage-hud', key: 'lifetime' } as const, { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 }, { shape: 'lifetime-2' })
const sessionBase = atom({ plugin: 'usage-hud', key: 'sessionBase' } as const, { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 }, { shape: 'session-base-1' })
const atScan = atom({ plugin: 'usage-hud', key: 'atScan' } as const, { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 }, { shape: 'atscan-1' })
const contextView = atom({ plugin: 'usage-hud', key: 'contextView' } as const, null, { shape: 'context-view-1' })
const held = atom({ plugin: 'usage-hud', key: 'held' } as const, { key: '', at: 0, isPassed: false, band: 0 }, { shape: 'held-1' })
const now = atom({ plugin: 'usage-hud', key: 'now' } as const, 0)
const isHidden = atom({ plugin: 'usage-hud', key: 'isHidden' } as const, false)
const isExpanded = atom({ plugin: 'usage-hud', key: 'isExpanded' } as const, false)
const isGuarded = atom({ plugin: 'usage-hud', key: 'isGuarded' } as const, true)
const ttlMinutes = atom({ plugin: 'usage-hud', key: 'ttlMinutes' } as const, 0)
const ttlSeen = atom({ plugin: 'usage-hud', key: 'ttlSeen' } as const, 0)
const sessionId = atom({ plugin: 'usage-hud', key: 'sessionId' } as const, '')
const theme = atom({ plugin: 'usage-hud', key: 'theme' } as const, 'ember')

type Theme = {
  name: string
  ink: string
  edge: string
  off: string
  accent: string
  head: string
  deep: string
  alarm: string
  text: string
  mute: string
}

const EMBER: Theme = {
  name: 'ember',
  ink: '#0B0B0C',
  edge: '#232327',
  off: '#26262A',
  accent: '#FF2E2E',
  head: '#FF6A5C',
  deep: '#6B1A1A',
  alarm: '#FF2E2E',
  text: '#F2F2F2',
  mute: '#77777D',
}

const THEMES: Theme[] = [
  EMBER,
  { name: 'ice', ink: '#0A0D12', edge: '#1E2633', off: '#1F2734', accent: '#3DA9FF', head: '#9AD8FF', deep: '#16405F', alarm: '#FF5A5A', text: '#EEF5FF', mute: '#6F7C8F' },
  { name: 'mint', ink: '#0A0F0D', edge: '#1D2A24', off: '#1E2A25', accent: '#22D17C', head: '#93F2C4', deep: '#105234', alarm: '#FF5A5A', text: '#EFFBF5', mute: '#6E8279' },
  { name: 'gold', ink: '#0F0D09', edge: '#2B2619', off: '#2A251A', accent: '#FFB21F', head: '#FFDD92', deep: '#614309', alarm: '#FF5A4A', text: '#FFF8EA', mute: '#857C68' },
  { name: 'violet', ink: '#0D0B12', edge: '#262036', off: '#262036', accent: '#A273FF', head: '#D3BDFF', deep: '#3D2775', alarm: '#FF5A7A', text: '#F5F0FF', mute: '#7D768F' },
  { name: 'mono', ink: '#0B0B0C', edge: '#2A2A2E', off: '#26262A', accent: '#D9D9DE', head: '#FFFFFF', deep: '#4A4A50', alarm: '#FF4D4D', text: '#F2F2F2', mute: '#77777D' },
]

const themeOf = (name: string) => THEMES.find(x => x.name === name) ?? EMBER

const MONO = `ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace`
const TILE_W = 108
const TILE_H = 40

const WINDOW_MS: Record<string, number> = { five_hour: 5 * 3600e3, seven_day: 7 * 86400e3 }

const HOLD_MS = 120e3
const COLD_MIN = 20e3
const BANDS = [85, 70, 50]
const GUARDED: ReadonlySet<PromptOrigin['kind']> = new Set(['composer', 'bridge', 'sdk', 'unclassified'])

const toSnapshot = (u: Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'>): Snapshot => ({
  limits: u.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
  contextTokens: u.context.tokens,
  contextWindow: u.context.window,
  contextPercent: u.context.percent,
  usd: u.cost?.usd,
})

const compact = (n: number): string =>
  n >= 1e9 ? `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k` : `${n}`

const asTotals = (v: unknown): Totals | null => {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const keys = ['cacheRead', 'cacheWrite', 'input', 'output'] as const
  if (!keys.every(k => typeof o[k] === 'number' && Number.isFinite(o[k]))) return null
  return { cacheRead: o.cacheRead as number, cacheWrite: o.cacheWrite as number, input: o.input as number, output: o.output as number }
}

const ZERO: Totals = { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 }

const plus = (a: Totals, b: Totals): Totals => ({
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite: a.cacheWrite + b.cacheWrite,
  input: a.input + b.input,
  output: a.output + b.output,
})

const minus = (a: Totals, b: Totals): Totals => ({
  cacheRead: Math.max(0, a.cacheRead - b.cacheRead),
  cacheWrite: Math.max(0, a.cacheWrite - b.cacheWrite),
  input: Math.max(0, a.input - b.input),
  output: Math.max(0, a.output - b.output),
})

const asTallies = (v: unknown): Tallies => {
  const out: Tallies = {}
  if (typeof v !== 'object' || v === null) return out
  for (const [path, f] of Object.entries(v as Record<string, { size?: unknown; mtimeMs?: unknown; t?: unknown; lastId?: unknown; lastAt?: unknown }>)) {
    const t = asTotals(f?.t)
    if (!t || typeof f.size !== 'number' || typeof f.mtimeMs !== 'number') continue
    out[path] = {
      size: f.size,
      mtimeMs: f.mtimeMs,
      t,
      ...(typeof f.lastId === 'string' ? { lastId: f.lastId } : {}),
      ...(typeof f.lastAt === 'string' ? { lastAt: f.lastAt } : {}),
    }
  }
  return out
}

const sumTallies = (all: Tallies) => Object.values(all).reduce((a, f) => plus(a, f.t), ZERO)

const sumSession = (all: Tallies, id: string) =>
  id
    ? Object.entries(all)
        .filter(([path]) => path.endsWith(`/${id}.jsonl`) || path.includes(`/${id}/`))
        .reduce((a, [, f]) => plus(a, f.t), ZERO)
    : ZERO

type Reply = {
  type?: string
  timestamp?: string
  message?: {
    id?: string
    usage?: Partial<Record<'input_tokens' | 'cache_creation_input_tokens' | 'cache_read_input_tokens' | 'output_tokens', number>> & {
      cache_creation?: Partial<Record<'ephemeral_5m_input_tokens' | 'ephemeral_1h_input_tokens', number>>
    }
  }
}

type Tally = { t: Totals; seen: Set<string>; lastId?: string; lastAt?: string; floor?: string; ttl: number }

// A reply with several content blocks is written once per block, each line carrying the same usage.
// A rewind can write older replies again further down; in appended bytes those sit before `floor`.
const tallyLines = (text: string, k: Tally) => {
  for (const line of text.split('\n')) {
    if (!line.includes('"usage":{')) continue
    let o: Reply
    try {
      o = JSON.parse(line) as Reply
    } catch {
      continue
    }
    const m = o.message
    if (o.type !== 'assistant' || !m?.usage || typeof m.id !== 'string' || k.seen.has(m.id)) continue
    const at = o.timestamp ?? ''
    if (k.floor && at && at < k.floor) continue
    k.seen.add(m.id)
    k.lastId = m.id
    if (at > (k.lastAt ?? '')) k.lastAt = at
    k.t.cacheRead += m.usage.cache_read_input_tokens ?? 0
    k.t.cacheWrite += m.usage.cache_creation_input_tokens ?? 0
    k.t.input += m.usage.input_tokens ?? 0
    k.t.output += m.usage.output_tokens ?? 0
    const made = m.usage.cache_creation
    if ((made?.ephemeral_1h_input_tokens ?? 0) > 0) k.ttl = 60
    else if ((made?.ephemeral_5m_input_tokens ?? 0) > 0) k.ttl = 5
  }
}

const USAGE_LINES = `tail -c +"$1" "$3" | head -c "$2" | grep -F '"usage":{'`

// Only the bytes a transcript grew by since the last scan are read, so a long session costs what it added.
const tallyRange = async ($: EngineInterface, path: string, from: number, length: number, k: Tally) => {
  let rest = ''
  for await (const piece of $.process.spawn({ argv: ['sh', '-c', USAGE_LINES, 'sh', String(from + 1), String(length), path] })) {
    if (piece.stream !== 'stdout') continue
    const text = rest + piece.text
    const cut = text.lastIndexOf('\n')
    tallyLines(text.slice(0, cut + 1), k)
    rest = text.slice(cut + 1)
  }
  tallyLines(rest, k)
}

const transcripts = async ($: EngineInterface, dir: string, depth = 0): Promise<{ path: string; size: number; mtimeMs: number }[]> => {
  const entries = await $.fs.list(dir).catch(() => [])
  const found: { path: string; size: number; mtimeMs: number }[] = []
  for (const e of entries) {
    const path = `${dir}/${e.name}`
    if (e.kind === 'file' && e.name.endsWith('.jsonl')) found.push({ path, size: e.size, mtimeMs: e.mtimeMs })
    else if (e.kind === 'dir' && depth < 5) found.push(...(await transcripts($, path, depth + 1)))
  }
  return found
}

let isScanning = false
let scannedAt = 0

const scan = async ($: EngineInterface) => {
  if (isScanning || Date.now() - scannedAt < 10e3) return
  isScanning = true
  try {
    const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
    const base = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${home}/.claude`
    const before = await read($, totals)
    const id = await read($, sessionId)
    const kept = asTallies(await $.store.get('lifetimeFiles'))
    let ttl = 0
    let fresh = 0
    for (const f of await transcripts($, `${base}/projects`)) {
      const was = kept[f.path]
      if (was && was.size === f.size && was.mtimeMs === f.mtimeMs) continue
      const grew = was && f.size > was.size ? was : undefined
      const from = grew?.size ?? 0
      const k: Tally = {
        t: { ...(grew?.t ?? ZERO) },
        seen: new Set(grew?.lastId ? [grew.lastId] : []),
        lastId: grew?.lastId,
        lastAt: grew?.lastAt,
        floor: grew?.lastAt,
        ttl: 0,
      }
      try {
        await tallyRange($, f.path, from, f.size - from, k)
      } catch {
        continue
      }
      kept[f.path] = {
        size: f.size,
        mtimeMs: f.mtimeMs,
        t: k.t,
        ...(k.lastId ? { lastId: k.lastId } : {}),
        ...(k.lastAt ? { lastAt: k.lastAt } : {}),
      }
      if (k.ttl && id && f.path.endsWith(`/${id}.jsonl`)) ttl = k.ttl
      fresh += 1
      if (fresh % 25 === 0) await $.store.set('lifetimeFiles', kept)
    }
    if (fresh > 0) await $.store.set('lifetimeFiles', kept)
    if (ttl) await update($, ttlSeen, () => ttl)
    await update($, atScan, () => before)
    await update($, lifetime, () => sumTallies(kept))
    await update($, sessionBase, () => sumSession(kept, id))
  } finally {
    isScanning = false
    scannedAt = Date.now()
  }
}

const span = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const countdown = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

const BLINK = `<style>.hud-b{animation:hud-b 1s steps(2,start) infinite}@keyframes hud-b{to{opacity:.3}}@media (prefers-reduced-motion:reduce){.hud-b{animation:none}}</style>`

type Tile = {
  label: string
  meta: string
  value: string
  unit?: string
  fill: number
  marker?: number
  isAlarm?: boolean
  isEmpty?: boolean
}

const tile = (th: Theme, { label, meta, value, unit, fill, marker, isAlarm, isEmpty }: Tile) => {
  const x0 = 8
  const bar = TILE_W - 16
  const n = 20
  const gap = 1.2
  const w = (bar - gap * (n - 1)) / n
  const lit = isEmpty ? 0 : Math.round(clamp01(fill) * n)
  const lead = isAlarm ? th.alarm : th.accent
  const segs = Array.from({ length: n }, (_, i) => {
    const color = i >= lit ? th.off : i === lit - 1 ? th.head : lead
    return `<rect x="${(x0 + i * (w + gap)).toFixed(2)}" y="32" width="${w.toFixed(2)}" height="3" rx=".6" fill="${color}"/>`
  }).join('')
  const tick =
    marker === undefined || isEmpty
      ? ''
      : `<rect x="${(x0 + clamp01(marker) * bar - 0.6).toFixed(2)}" y="30" width="1.2" height="7" fill="${th.text}"/>`
  const ink = isEmpty ? th.mute : isAlarm ? th.alarm : th.text
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE_W} ${TILE_H}" width="${TILE_W}" height="${TILE_H}">${BLINK}<g font-family="${MONO}" style="font-variant-numeric:tabular-nums"><rect x=".5" y=".5" width="${TILE_W - 1}" height="${TILE_H - 1}" rx="7" fill="${th.ink}" stroke="${isAlarm ? th.alarm : th.edge}" stroke-opacity="${isAlarm ? 0.55 : 1}"/><rect class="${isAlarm ? 'hud-b' : ''}" x="8" y="7.5" width="3" height="3" fill="${isEmpty ? th.off : lead}"/><text x="15" y="11" font-size="7.5" letter-spacing="1.3" fill="${th.mute}">${label}</text><text x="${TILE_W - 8}" y="11" font-size="7.5" text-anchor="end" fill="${th.mute}">${meta}</text><text class="${isAlarm ? 'hud-b' : ''}" x="8" y="26" font-size="14" font-weight="600" fill="${ink}">${value}${unit ? `<tspan font-size="8" fill="${th.mute}" dx="1">${unit}</tspan>` : ''}</text>${segs}${tick}</g></svg>`
}

type Readout = { key: string; value: string; note?: string; isAlarm?: boolean }

const strip = (th: Theme, items: Readout[]) => {
  const ch = 5.5
  const pad = 10
  const sep = 16
  let x = pad
  const parts = items.map((r, i) => {
    const out: string[] = []
    if (i > 0) {
      out.push(`<rect x="${(x - sep / 2).toFixed(1)}" y="7" width="1" height="10" fill="${th.edge}"/>`)
    }
    out.push(`<text x="${x.toFixed(1)}" y="15.5" fill="${th.mute}">${r.key}</text>`)
    x += (r.key.length + 1) * ch
    out.push(`<text x="${x.toFixed(1)}" y="15.5" fill="${r.isAlarm ? th.alarm : th.text}">${r.value}</text>`)
    x += r.value.length * ch
    if (r.note) {
      x += ch
      out.push(`<text x="${x.toFixed(1)}" y="15.5" fill="${th.mute}">${r.note}</text>`)
      x += r.note.length * ch
    }
    x += sep
    return out.join('')
  })
  const width = Math.ceil(x - sep + pad)
  return {
    width,
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 24" width="${width}" height="24"><g font-family="${MONO}" font-size="8.5" letter-spacing=".3" style="font-variant-numeric:tabular-nums"><rect x=".5" y=".5" width="${width - 1}" height="23" rx="7" fill="${th.ink}" stroke="${th.edge}"/>${parts.join('')}</g></svg>`,
  }
}

type Part = { key: string; label: string; n: number; color: string; note: string }

const stackBar = (th: Theme, label: string, value: string, parts: Part[], scale: number) => {
  const ch = 5.5
  const totalX = 10 + 1.5 * ch + 8 * 6.7 + 6
  const barX = totalX + 6 * ch + 8
  const n = 40
  const gap = 1
  const barW = 160
  const w = (barW - gap * (n - 1)) / n
  let filled = 0
  const owner = parts.map(p => {
    const from = filled
    filled += scale ? (p.n / scale) * n : 0
    return { ...p, from, to: filled }
  })
  const segs = Array.from({ length: n }, (_, i) => {
    const mid = i + 0.5
    const hit = owner.find(p => mid >= p.from && mid < p.to)
    return `<rect x="${(barX + i * (w + gap)).toFixed(2)}" y="9" width="${w.toFixed(2)}" height="6" rx=".6" fill="${hit?.color ?? th.off}"/>`
  }).join('')
  let x = barX + barW + 12
  const legend = parts
    .map(p => {
      const out = `<rect x="${x.toFixed(1)}" y="9" width="5" height="6" rx="1" fill="${p.color}"/><text x="${(x + 8).toFixed(1)}" y="15.5" fill="${th.mute}">${p.key}</text><text x="${(x + 8 + (p.key.length + 1) * ch).toFixed(1)}" y="15.5" fill="${th.text}">${p.note}</text>`
      x += 8 + (p.key.length + 1 + p.note.length) * ch + 10
      return out
    })
    .join('')
  const width = Math.ceil(x)
  return {
    width,
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 24" width="${width}" height="24"><g font-family="${MONO}" font-size="8.5" letter-spacing=".3" style="font-variant-numeric:tabular-nums"><rect x=".5" y=".5" width="${width - 1}" height="23" rx="7" fill="${th.ink}" stroke="${th.edge}"/><rect x="10" y="10.5" width="3" height="3" fill="${th.accent}"/><text x="${10 + 1.5 * ch}" y="15.5" fill="${th.mute}" letter-spacing="1.2">${label}</text><text x="${totalX.toFixed(1)}" y="15.5" fill="${th.text}" font-weight="600">${value}</text>${segs}${legend}</g></svg>`,
  }
}

const tokenBar = (th: Theme, t: Totals, label: string, name: string) => {
  const parts = [
    { key: 'R', label: 'cache read', n: t.cacheRead, color: th.deep },
    { key: 'W', label: 'cache write', n: t.cacheWrite, color: th.accent },
    { key: 'I', label: 'input', n: t.input, color: th.head },
    { key: 'O', label: 'output', n: t.output, color: th.text },
  ]
  const total = parts.reduce((a, p) => a + p.n, 0)
  const bar = stackBar(th, label, compact(total), parts.map(p => ({ ...p, note: `${total ? Math.round((p.n / total) * 100) : 0}%` })), total)
  return { ...bar, alt: `${name} tokens ${compact(total)}: ${parts.map(p => `${p.label} ${compact(p.n)}`).join(', ')}` }
}

const SHORT: Record<string, string> = {
  'System prompt': 'SYS',
  'System tools': 'TOOLS',
  'MCP tools': 'MCP',
  'Memory files': 'MEMORY',
  'Custom agents': 'AGENTS',
  Messages: 'CHAT',
}

const contextBar = (th: Theme, v: ContextView) => {
  const ranked = [...v.parts].sort((a, b) => b.tokens - a.tokens)
  const rest = ranked.slice(3).reduce((a, p) => a + p.tokens, 0)
  const shown = rest ? [...ranked.slice(0, 3), { name: 'Other', tokens: rest }] : ranked.slice(0, 3)
  const colors = [th.accent, th.head, th.deep, th.mute]
  const parts = shown.map((p, i) => ({
    key: SHORT[p.name] ?? (p.name.split(' ')[0] ?? p.name).toUpperCase(),
    label: p.name,
    n: p.tokens,
    color: colors[i] ?? th.mute,
    note: compact(p.tokens),
  }))
  const bar = stackBar(th, 'CONTEXT', compact(v.total), parts, v.max)
  return { ...bar, alt: `Context ${compact(v.total)} of ${compact(v.max)}, re-read on every step: ${parts.map(p => `${p.label} ${compact(p.n)}`).join(', ')}` }
}

const short = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}D${h}H`
  if (h > 0) return `${h}H${String(m).padStart(2, '0')}`
  return `${m}M`
}

const pace = (l: Limit, t: number) => {
  const total = WINDOW_MS[l.kind]
  if (!total || !l.resetsAt) return null
  const reset = Date.parse(l.resetsAt)
  const elapsed = Math.max(60e3, total - (reset - t))
  const ratio = l.percentUsed / 100 / (elapsed / total)
  const rate = l.percentUsed / elapsed
  const out = rate > 0 ? t + (100 - l.percentUsed) / rate : Infinity
  return { ratio, out, reset, isShort: out < reset }
}

const refresh = async ($: EngineInterface) => {
  const u = await $.session.usage()
  await update($, snapshot, () => toSnapshot(u))
}

const refreshContext = async ($: EngineInterface) => {
  const b = (await $.session.usage({ breakdown: 'summary' })).context.breakdown
  if (!b) return
  const parts = b.categories.filter(c => c.kind === 'used' && c.tokens > 0).map(c => ({ name: c.name, tokens: c.tokens }))
  await update($, contextView, () => ({ parts, total: b.totalTokens, max: b.rawMaxTokens }))
}

const ttlMsOf = async ($: EngineInterface) => ((await read($, ttlMinutes)) || (await read($, ttlSeen)) || 60) * 60000

const contextOf = (snap: Snapshot | null) => {
  const tokens = snap?.contextTokens ?? 0
  const pct = snap?.contextPercent ?? (snap?.contextWindow ? (tokens / snap.contextWindow) * 100 : 0)
  return { tokens, pct }
}

const loadPrefs = async ($: EngineInterface) => {
  const ttl = await $.store.get('ttl')
  const minutes = ttl === 5 || ttl === 60 ? ttl : 0
  if ((await read($, ttlMinutes)) !== minutes) await update($, ttlMinutes, () => minutes)
  const isOn = (await $.store.get('guard')) !== false
  if ((await read($, isGuarded)) !== isOn) await update($, isGuarded, () => isOn)
  const stored = await $.store.get('theme')
  const name = typeof stored === 'string' ? themeOf(stored).name : EMBER.name
  if ((await read($, theme)) !== name) await update($, theme, () => name)
}

const setTtl = async ($: EngineInterface, minutes: number) => {
  await update($, ttlMinutes, () => minutes)
  await $.store.set('ttl', minutes || 'auto')
}

const setGuard = async ($: EngineInterface, isOn: boolean) => {
  await update($, isGuarded, () => isOn)
  await $.store.set('guard', isOn)
}

const setTheme = async ($: EngineInterface, name: string) => {
  await update($, theme, () => name)
  await $.store.set('theme', name)
}

const nextTheme = (name: string) => THEMES[(THEMES.findIndex(x => x.name === name) + 1) % THEMES.length] ?? EMBER

type Risk = { key: string; text: string }

const OUT = 'Press Enter to send it anyway, or compact first. /hud guard off turns this off.'

const riskOf = async ($: EngineInterface, acked: number): Promise<{ risk: Risk | null; band: number }> => {
  const call = await read($, lastCall)
  const { tokens, pct } = contextOf(await read($, snapshot))
  const band = BANDS.find(b => pct >= b) ?? 0
  const t = Date.now()
  const ttl = await ttlMsOf($)
  if (call && t > call.at + ttl && tokens >= COLD_MIN) {
    return {
      band,
      risk: {
        key: `cold:${call.at}`,
        text: `Held: the prompt cache expired ${span(t - call.at - ttl)} ago, so this message would write all ${compact(tokens)} tokens of context to the cache again. ${OUT}`,
      },
    }
  }
  if (band > acked) {
    return {
      band,
      risk: {
        key: `heavy:${band}`,
        text: `Held: context is ${Math.round(pct)}% full, so every step of the reply re-reads ${compact(tokens)} tokens from the cache. ${OUT}`,
      },
    }
  }
  return { band, risk: null }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'hud',
      description: 'Toggle the usage HUD; /hud guard, /hud theme and /hud ttl change it',
      argumentHint: '[guard on|off | theme <name> | ttl 5|60|auto]',
    })
    const id = await $.session.id().catch(() => '')
    await update($, sessionId, () => id)
    await loadPrefs($)
    const kept = asTallies(await $.store.get('lifetimeFiles'))
    const sum = await read($, totals)
    await update($, lifetime, () => sumTallies(kept))
    await update($, sessionBase, () => sumSession(kept, id))
    await update($, atScan, () => sum)
    void scan($).catch(() => undefined)
    $.clock.every(60e3, () => scan($).catch(() => undefined))
    $.clock.every(30e3, () => loadPrefs($).catch(() => undefined))
    await refresh($)
    void refreshContext($).catch(() => undefined)
    await update($, now, () => Date.now())

    let quietFor = 0
    $.clock.every(1000, async () => {
      const call = await read($, lastCall)
      const ttl = await ttlMsOf($)
      const t = Date.now()
      const isWarm = call !== null && call.at + ttl > t - 1000
      quietFor += 1
      if (isWarm || quietFor >= 30) {
        quietFor = 0
        await update($, now, () => t)
      }
    })

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const sentAt = Date.now()
    const r = yield* next(e)
    if (!r.usage) return r
    const u = r.usage
    await update($, totals, s =>
      plus(s, {
        cacheRead: u.cache_read_input_tokens,
        cacheWrite: u.cache_creation_input_tokens,
        input: u.input_tokens,
        output: u.output_tokens,
      }),
    )
    if (e.agentId === undefined) {
      const call: LastCall = {
        at: sentAt,
        cacheRead: u.cache_read_input_tokens,
        cacheWrite: u.cache_creation_input_tokens,
        input: u.input_tokens,
      }
      const tokens = call.cacheRead + call.cacheWrite + call.input
      await update($, lastCall, () => call)
      await update($, snapshot, s =>
        s ? { ...s, contextTokens: tokens, contextPercent: s.contextWindow ? Math.round((tokens / s.contextWindow) * 100) : s.contextPercent } : s,
      )
      await update($, now, () => Date.now())
    }

    return r
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      void scan($).catch(() => undefined)
      void refreshContext($).catch(() => undefined)
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await update($, snapshot, () => toSnapshot(e))

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta || e.attachments?.length || !GUARDED.has(e.origin.kind) || !(await read($, isGuarded))) return next(e)
    const h = await read($, held)
    const { risk, band } = await riskOf($, h.band)
    if (!risk) {
      if (band < h.band) await update($, held, x => ({ ...x, band }))
      return next(e)
    }
    const t = Date.now()
    if (h.key === risk.key && (h.isPassed || t - h.at < HOLD_MS)) {
      await update($, held, x => ({ ...x, isPassed: true, band: Math.max(x.band, band) }))
      return next(e)
    }
    const box = await $.prompt.fill({ text: e.text })
    if (!box.isFilled) return next(e)
    await update($, held, x => ({ ...x, key: risk.key, at: t, isPassed: false }))
    $.clock.after(150, async () => {
      if (!(await $.prompt.read()).text) await $.prompt.fill({ text: e.text })
    })
    return { drop: risk.text }
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'hud' }, async ($, e) => {
    const [word = '', arg = ''] = e.args.trim().split(/\s+/)
    if (word === 'ttl') {
      const minutes = arg === 'auto' ? 0 : Number(arg)
      if (minutes !== 0 && minutes !== 5 && minutes !== 60) return { text: 'Usage HUD: /hud ttl takes 5, 60 or auto.' }
      await setTtl($, minutes)
      await update($, isHidden, () => false)
      return { text: minutes ? `Usage HUD: cache TTL set to ${minutes} minutes.` : 'Usage HUD: cache TTL follows what the session writes, 5 or 60 minutes.' }
    }
    if (word === 'guard') {
      const isOn = arg === 'on' ? true : arg === 'off' ? false : !(await read($, isGuarded))
      await setGuard($, isOn)
      return {
        text: isOn
          ? 'Cache guard on: a prompt is held once when the cache has gone cold or context passes 50%, 70% or 85%. Enter again sends it.'
          : 'Cache guard off.',
      }
    }
    if (word === 'theme') {
      const picked = arg ? THEMES.find(x => x.name === arg) : nextTheme(await read($, theme))
      if (!picked) return { text: `Usage HUD themes: ${THEMES.map(x => x.name).join(', ')}.` }
      await setTheme($, picked.name)
      return { text: `Usage HUD theme: ${picked.name}.` }
    }
    if (word) return { text: 'Usage HUD: /hud shows or hides it; /hud guard on|off, /hud theme <name> and /hud ttl 5|60|auto change it.' }
    const hidden = await update($, isHidden, h => !h)
    return { text: hidden ? 'Usage HUD hidden. /hud brings it back.' : 'Usage HUD shown.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below
    if (await read($, isHidden)) {
      const { Box, Button } = $.ui.resolve(e)
      return (
        <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap">
          {below}
          <Button key="show" plain dimColor onPress={() => update($, isHidden, () => false)}>
            usage ▸
          </Button>
        </Box>
      )
    }

    const th = themeOf(await read($, theme))
    const snap = await read($, snapshot)
    const call = await read($, lastCall)
    const sum = await read($, totals)
    const fromScan = minus(sum, await read($, atScan))
    const session = plus(await read($, sessionBase), fromScan)
    const t = (await read($, now)) || Date.now()
    const ttlMin = await read($, ttlMinutes)
    const ttlMs = await ttlMsOf($)
    const expanded = await read($, isExpanded)
    const isOn = await read($, isGuarded)

    const limits = snap?.limits ?? []
    const five = limits.find(l => l.kind === 'five_hour')
    const week = limits.find(l => l.kind === 'seven_day')
    const cacheLeft = call ? call.at + ttlMs - t : 0
    const isWarm = cacheLeft > 0
    const isCooling = isWarm && cacheLeft < 120e3
    const hit = call ? call.cacheRead / Math.max(1, call.cacheRead + call.cacheWrite + call.input) : 0
    const sumPrompt = session.cacheRead + session.cacheWrite + session.input
    const sumHit = sumPrompt ? session.cacheRead / sumPrompt : 0
    const ctx = contextOf(snap)
    const ctxPct = Math.round(ctx.pct)
    const isCtxHigh = ctxPct >= 80

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      const bar = (pct: number) => {
        const lit = Math.round(clamp01(pct / 100) * 8)
        return '▰'.repeat(lit) + '▱'.repeat(8 - lit)
      }
      const lim = (name: string, l: Limit | undefined) => {
        const rest = l ? 100 - l.percentUsed : 0
        return (
          <Text>
            <Text dimColor>{name} </Text>
            <Text color={l ? (rest <= 15 ? th.alarm : th.accent) : 'subtle'}>{bar(rest)}</Text>
            <Text bold={rest <= 15}> {l ? `${Math.round(rest)}%` : '—'}</Text>
            {l?.resetsAt ? <Text dimColor> {span(Date.parse(l.resetsAt) - t)}</Text> : null}
          </Text>
        )
      }
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={2} flexWrap="wrap">
            {lim('5h', five)}
            {lim('wk', week)}
            <Text>
              <Text dimColor>cache </Text>
              <Text color={isCooling ? th.alarm : undefined} bold={isCooling}>
                {call ? (isWarm ? countdown(cacheLeft) : 'cold') : '—'}
              </Text>
            </Text>
            <Text>
              <Text dimColor>read </Text>
              <Text>{call ? compact(call.cacheRead) : '—'}</Text>
            </Text>
            <Text>
              <Text dimColor>ctx </Text>
              <Text color={isCtxHigh ? th.alarm : undefined}>{ctxPct}%</Text>
            </Text>
            {isOn ? <Text dimColor>guard</Text> : null}
          </Box>
          {below}
        </Box>
      )
    }

    const { Box, Button, Svg } = $.ui.resolve(e)

    const limitTile = (label: string, name: string, l: Limit | undefined) => {
      if (!l) {
        return { source: tile(th, { label, meta: '', value: '—', fill: 0, isEmpty: true }), alt: `${name}: no reading yet` }
      }
      const left = Math.max(0, 100 - l.percentUsed)
      const total = WINDOW_MS[l.kind]
      const reset = l.resetsAt ? Date.parse(l.resetsAt) : undefined
      const p = pace(l, t)
      return {
        source: tile(th, {
          label,
          meta: reset ? short(reset - t) : '',
          value: `${Math.round(left)}`,
          unit: '%',
          fill: left / 100,
          marker: reset && total ? (reset - t) / total : undefined,
          isAlarm: left <= 15 || Boolean(p?.isShort),
        }),
        alt: `${name}: ${Math.round(left)}% left${reset ? `, resets in ${span(reset - t)}` : ''}`,
      }
    }

    const tiles = [
      limitTile('5H', '5-hour limit', five),
      limitTile('WEEK', 'Weekly limit', week),
      {
        source: tile(th, {
          label: isOn ? 'CACHE ◆' : 'CACHE',
          meta: call ? compact(call.cacheRead) : `${ttlMs / 60000}M`,
          value: call ? (isWarm ? countdown(cacheLeft) : 'COLD') : '—',
          fill: isWarm ? cacheLeft / ttlMs : 0,
          isAlarm: isCooling,
          isEmpty: !isWarm,
        }),
        alt: call
          ? `Cache ${isWarm ? `warm for ${countdown(cacheLeft)}` : 'cold'}, last read ${compact(call.cacheRead)} tokens${isOn ? ', guard on' : ''}`
          : 'Cache: no reply yet',
      },
      {
        source: tile(th, {
          label: 'CTX',
          meta: compact(ctx.tokens),
          value: `${ctxPct}`,
          unit: '%',
          fill: ctx.pct / 100,
          isAlarm: isCtxHigh,
          isEmpty: !snap,
        }),
        alt: `Context ${ctxPct}% used, ${compact(ctx.tokens)} of ${compact(snap?.contextWindow ?? 0)} tokens`,
      },
    ]

    const readout = (key: string, l: Limit | undefined): Readout | null => {
      const p = l && pace(l, t)
      if (!p) return null
      return {
        key,
        value: `${p.ratio.toFixed(1)}× PACE`,
        note: p.isShort ? `DRY ${hhmm(p.out)}` : `RESET ${hhmm(p.reset)}`,
        isAlarm: p.isShort,
      }
    }

    const details = strip(
      th,
      [
        readout('5H', five),
        readout('WK', week),
        { key: 'Σ CACHE', value: compact(session.cacheRead), note: `${Math.round(sumHit * 100)}%` },
        call ? { key: 'HIT', value: `${Math.round(hit * 100)}%` } : null,
        snap ? { key: 'CTX', value: `${compact(ctx.tokens)}/${compact(snap.contextWindow)}` } : null,
        snap?.usd === undefined ? null : { key: 'COST', value: `$${snap.usd.toFixed(2)}` },
      ].filter((r): r is Readout => r !== null),
    )

    const tokens = tokenBar(th, session, 'SESSION', 'Session')
    const allTokens = tokenBar(th, plus(await read($, lifetime), fromScan), 'LIFETIME', 'Lifetime')
    const view = await read($, contextView)
    const window = view ? contextBar(th, view) : null

    const onMore = async () => {
      const isOpen = await update($, isExpanded, x => !x)
      if (isOpen) void refreshContext($).catch(() => undefined)
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap">
          {below}
          {tiles.map(x => (
            <Svg source={x.source} alt={x.alt} width={TILE_W} height={TILE_H} />
          ))}
          <Button key="more" plain dimColor onPress={onMore}>
            {expanded ? '×' : '⋯'}
          </Button>
        </Box>
        {expanded ? <Svg source={tokens.source} alt={tokens.alt} width={tokens.width} height={24} /> : null}
        {expanded ? <Svg source={allTokens.source} alt={allTokens.alt} width={allTokens.width} height={24} /> : null}
        {expanded && window ? <Svg source={window.source} alt={window.alt} width={window.width} height={24} /> : null}
        {expanded ? (
          <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap">
            <Svg source={details.source} alt="Pace and session cache details" width={details.width} height={24} />
            <Button key="ttl5" variant={ttlMin === 5 ? 'primary' : 'secondary'} onPress={() => setTtl($, 5)}>
              5m
            </Button>
            <Button key="ttl60" variant={ttlMin === 60 ? 'primary' : 'secondary'} onPress={() => setTtl($, 60)}>
              1h
            </Button>
            <Button key="ttlAuto" variant={ttlMin === 0 ? 'primary' : 'secondary'} onPress={() => setTtl($, 0)}>
              auto
            </Button>
            <Button key="guard" variant={isOn ? 'primary' : 'secondary'} onPress={() => setGuard($, !isOn)}>
              {isOn ? 'guard on' : 'guard off'}
            </Button>
            {ctxPct >= 50 ? (
              <Button key="compact" variant="primary" onPress={() => void $.session.compact()}>
                Compact
              </Button>
            ) : null}
            <Button key="theme" plain dimColor onPress={() => setTheme($, nextTheme(th.name).name)}>
              {`${th.name} ▸`}
            </Button>
            <Button key="hide" plain dimColor onPress={() => update($, isHidden, () => true)}>
              hide
            </Button>
          </Box>
        ) : null}
      </Box>
    )
  }).catch(async ($, e, next) => {
    const below = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" alignItems="center" gap={2} flexWrap="wrap">
        <Text color={EMBER.alarm}>usage HUD could not draw: {next.error.message ?? next.error.kind}</Text>
        {below}
      </Box>
    )
  })
}
