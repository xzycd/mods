import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionUsage } from 'claude-code'

import type { LastCall, Limit, Snapshot, Totals } from '../types'

const snapshot = atom({ plugin: 'usage-hud', key: 'snapshot' } as const, null, { shape: 'snapshot-1' })
const lastCall = atom({ plugin: 'usage-hud', key: 'lastCall' } as const, null, { shape: 'last-1' })
const totals = atom({ plugin: 'usage-hud', key: 'totals' } as const, { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 }, { shape: 'totals-2' })
const now = atom({ plugin: 'usage-hud', key: 'now' } as const, 0)
const isHidden = atom({ plugin: 'usage-hud', key: 'isHidden' } as const, false)
const isExpanded = atom({ plugin: 'usage-hud', key: 'isExpanded' } as const, false)
const ttlMinutes = atom({ plugin: 'usage-hud', key: 'ttlMinutes' } as const, 60)

const HUD = {
  ink: '#0B0B0C',
  edge: '#232327',
  off: '#26262A',
  red: '#FF2E2E',
  head: '#FF6A5C',
  text: '#F2F2F2',
  mute: '#77777D',
}

const MONO = `ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace`
const TILE_W = 108
const TILE_H = 40

const WINDOW_MS: Record<string, number> = { five_hour: 5 * 3600e3, seven_day: 7 * 86400e3 }

const toSnapshot = (u: Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'>): Snapshot => ({
  limits: u.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
  contextTokens: u.context.tokens,
  contextWindow: u.context.window,
  contextPercent: u.context.percent,
  usd: u.cost?.usd,
})

const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k` : `${n}`

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

const BLINK = `<style>.b{animation:b 1s steps(2,start) infinite}@keyframes b{to{opacity:.3}}@media (prefers-reduced-motion:reduce){.b{animation:none}}</style>`

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

const tile = ({ label, meta, value, unit, fill, marker, isAlarm, isEmpty }: Tile) => {
  const x0 = 8
  const bar = TILE_W - 16
  const n = 20
  const gap = 1.2
  const w = (bar - gap * (n - 1)) / n
  const lit = isEmpty ? 0 : Math.round(clamp01(fill) * n)
  const segs = Array.from({ length: n }, (_, i) => {
    const color = i >= lit ? HUD.off : i === lit - 1 ? HUD.head : HUD.red
    return `<rect x="${(x0 + i * (w + gap)).toFixed(2)}" y="32" width="${w.toFixed(2)}" height="3" rx=".6" fill="${color}"/>`
  }).join('')
  const tick =
    marker === undefined || isEmpty
      ? ''
      : `<rect x="${(x0 + clamp01(marker) * bar - 0.6).toFixed(2)}" y="30" width="1.2" height="7" fill="${HUD.text}"/>`
  const ink = isEmpty ? HUD.mute : isAlarm ? HUD.red : HUD.text
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE_W} ${TILE_H}" width="${TILE_W}" height="${TILE_H}">${BLINK}<g font-family="${MONO}" style="font-variant-numeric:tabular-nums"><rect x=".5" y=".5" width="${TILE_W - 1}" height="${TILE_H - 1}" rx="7" fill="${HUD.ink}" stroke="${isAlarm ? HUD.red : HUD.edge}" stroke-opacity="${isAlarm ? 0.55 : 1}"/><rect class="${isAlarm ? 'b' : ''}" x="8" y="7.5" width="3" height="3" fill="${isEmpty ? HUD.off : HUD.red}"/><text x="15" y="11" font-size="7.5" letter-spacing="1.3" fill="${HUD.mute}">${label}</text><text x="${TILE_W - 8}" y="11" font-size="7.5" text-anchor="end" fill="${HUD.mute}">${meta}</text><text class="${isAlarm ? 'b' : ''}" x="8" y="26" font-size="14" font-weight="600" fill="${ink}">${value}${unit ? `<tspan font-size="8" fill="${HUD.mute}" dx="1">${unit}</tspan>` : ''}</text>${segs}${tick}</g></svg>`
}

type Readout = { key: string; value: string; note?: string; isAlarm?: boolean }

const strip = (items: Readout[]) => {
  const ch = 5.5
  const pad = 10
  const sep = 16
  let x = pad
  const parts = items.map((r, i) => {
    const out: string[] = []
    if (i > 0) {
      out.push(`<rect x="${(x - sep / 2).toFixed(1)}" y="7" width="1" height="10" fill="${HUD.edge}"/>`)
    }
    out.push(`<text x="${x.toFixed(1)}" y="15.5" fill="${HUD.mute}">${r.key}</text>`)
    x += (r.key.length + 1) * ch
    out.push(`<text x="${x.toFixed(1)}" y="15.5" fill="${r.isAlarm ? HUD.red : HUD.text}">${r.value}</text>`)
    x += r.value.length * ch
    if (r.note) {
      x += ch
      out.push(`<text x="${x.toFixed(1)}" y="15.5" fill="${HUD.mute}">${r.note}</text>`)
      x += r.note.length * ch
    }
    x += sep
    return out.join('')
  })
  const width = Math.ceil(x - sep + pad)
  return {
    width,
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 24" width="${width}" height="24"><g font-family="${MONO}" font-size="8.5" letter-spacing=".3" style="font-variant-numeric:tabular-nums"><rect x=".5" y=".5" width="${width - 1}" height="23" rx="7" fill="${HUD.ink}" stroke="${HUD.edge}"/>${parts.join('')}</g></svg>`,
  }
}

const tokenBar = (t: Totals) => {
  const parts = [
    { key: 'R', label: 'cache read', n: t.cacheRead, color: '#6B1A1A' },
    { key: 'W', label: 'cache write', n: t.cacheWrite, color: HUD.red },
    { key: 'I', label: 'input', n: t.input, color: HUD.head },
    { key: 'O', label: 'output', n: t.output, color: HUD.text },
  ]
  const total = parts.reduce((a, p) => a + p.n, 0)
  const ch = 5.5
  const totalX = 10 + 1.5 * ch + 6 * 6.7 + 6
  const barX = totalX + 6 * ch + 8
  const n = 40
  const gap = 1
  const barW = 160
  const w = (barW - gap * (n - 1)) / n
  let filled = 0
  const owner = parts.map(p => {
    const from = filled
    filled += total ? (p.n / total) * n : 0
    return { ...p, from, to: filled }
  })
  const segs = Array.from({ length: n }, (_, i) => {
    const mid = i + 0.5
    const hit = owner.find(p => mid >= p.from && mid < p.to)
    return `<rect x="${(barX + i * (w + gap)).toFixed(2)}" y="9" width="${w.toFixed(2)}" height="6" rx=".6" fill="${hit?.color ?? HUD.off}"/>`
  }).join('')
  let x = barX + barW + 12
  const legend = parts
    .map(p => {
      const pct = total ? Math.round((p.n / total) * 100) : 0
      const out = `<rect x="${x.toFixed(1)}" y="9" width="5" height="6" rx="1" fill="${p.color}"/><text x="${(x + 8).toFixed(1)}" y="15.5" fill="${HUD.mute}">${p.key}</text><text x="${(x + 8 + 2 * ch).toFixed(1)}" y="15.5" fill="${HUD.text}">${pct}%</text>`
      x += 8 + (2 + `${pct}%`.length) * ch + 10
      return out
    })
    .join('')
  const width = Math.ceil(x)
  return {
    width,
    alt: `Session tokens ${compact(total)}: ${parts.map(p => `${p.label} ${compact(p.n)}`).join(', ')}`,
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 24" width="${width}" height="24"><g font-family="${MONO}" font-size="8.5" letter-spacing=".3" style="font-variant-numeric:tabular-nums"><rect x=".5" y=".5" width="${width - 1}" height="23" rx="7" fill="${HUD.ink}" stroke="${HUD.edge}"/><rect x="10" y="10.5" width="3" height="3" fill="${HUD.red}"/><text x="${10 + 1.5 * ch}" y="15.5" fill="${HUD.mute}" letter-spacing="1.2">TOKENS</text><text x="${totalX.toFixed(1)}" y="15.5" fill="${HUD.text}" font-weight="600">${compact(total)}</text>${segs}${legend}</g></svg>`,
  }
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

const setTtl = async ($: EngineInterface, minutes: number) => {
  await update($, ttlMinutes, () => minutes)
  await $.store.set('ttlMinutes', minutes)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'hud',
      description: 'Toggle the usage HUD; /hud ttl 5 or /hud ttl 60 sets the cache TTL',
      argumentHint: '[ttl 5|60]',
    })
    const stored = Number(await $.store.get('ttlMinutes'))
    if (stored > 0) await update($, ttlMinutes, () => stored)
    await refresh($)
    await update($, now, () => Date.now())

    let quietFor = 0
    $.clock.every(1000, async () => {
      const call = await read($, lastCall)
      const ttl = (await read($, ttlMinutes)) * 60000
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
    const r = yield* next(e)
    if (!r.usage) return r
    const u = r.usage
    await update($, totals, s => ({
      cacheRead: s.cacheRead + u.cache_read_input_tokens,
      cacheWrite: s.cacheWrite + u.cache_creation_input_tokens,
      input: s.input + u.input_tokens,
      output: s.output + u.output_tokens,
    }))
    if (e.agentId === undefined) {
      const call: LastCall = {
        at: Date.now(),
        cacheRead: u.cache_read_input_tokens,
        cacheWrite: u.cache_creation_input_tokens,
        input: u.input_tokens,
      }
      await update($, lastCall, () => call)
      await update($, now, () => call.at)
    }

    return r
  })

  on('session.measure', async ($, e, next) => {
    await update($, snapshot, () => toSnapshot(e))

    return next(e)
  })

  on('command.run', { command: 'hud' }, async ($, e) => {
    const m = /^ttl\s+(\d+)$/.exec(e.args.trim())
    if (m) {
      const minutes = Number(m[1])
      await setTtl($, minutes)
      await update($, isHidden, () => false)
      return { text: `Usage HUD: cache TTL set to ${minutes} minutes.` }
    }
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

    const snap = await read($, snapshot)
    const call = await read($, lastCall)
    const sum = await read($, totals)
    const t = (await read($, now)) || Date.now()
    const ttlMin = await read($, ttlMinutes)
    const ttlMs = ttlMin * 60000
    const expanded = await read($, isExpanded)

    const limits = snap?.limits ?? []
    const five = limits.find(l => l.kind === 'five_hour')
    const week = limits.find(l => l.kind === 'seven_day')
    const cacheLeft = call ? call.at + ttlMs - t : 0
    const isWarm = cacheLeft > 0
    const isCooling = isWarm && cacheLeft < 120e3
    const hit = call ? call.cacheRead / Math.max(1, call.cacheRead + call.cacheWrite + call.input) : 0
    const sumPrompt = sum.cacheRead + sum.cacheWrite + sum.input
    const sumHit = sumPrompt ? sum.cacheRead / sumPrompt : 0
    const ctxPct = snap?.contextPercent ?? 0
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
            <Text color={l ? HUD.red : 'subtle'}>{bar(rest)}</Text>
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
              <Text color={isCooling ? HUD.red : undefined} bold={isCooling}>
                {call ? (isWarm ? countdown(cacheLeft) : 'cold') : '—'}
              </Text>
            </Text>
            <Text>
              <Text dimColor>read </Text>
              <Text>{call ? compact(call.cacheRead) : '—'}</Text>
            </Text>
            <Text>
              <Text dimColor>ctx </Text>
              <Text color={isCtxHigh ? HUD.red : undefined}>{ctxPct}%</Text>
            </Text>
          </Box>
          {below}
        </Box>
      )
    }

    const { Box, Button, Svg } = $.ui.resolve(e)

    const limitTile = (label: string, name: string, l: Limit | undefined) => {
      if (!l) {
        return { source: tile({ label, meta: '', value: '—', fill: 0, isEmpty: true }), alt: `${name}: no reading yet` }
      }
      const left = Math.max(0, 100 - l.percentUsed)
      const total = WINDOW_MS[l.kind]
      const reset = l.resetsAt ? Date.parse(l.resetsAt) : undefined
      const p = pace(l, t)
      return {
        source: tile({
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
        source: tile({
          label: 'CACHE',
          meta: call ? compact(call.cacheRead) : `${ttlMin}M`,
          value: call ? (isWarm ? countdown(cacheLeft) : 'COLD') : '—',
          fill: isWarm ? cacheLeft / ttlMs : 0,
          isAlarm: isCooling,
          isEmpty: !isWarm,
        }),
        alt: call
          ? `Cache ${isWarm ? `warm for ${countdown(cacheLeft)}` : 'cold'}, last read ${compact(call.cacheRead)} tokens`
          : 'Cache: no reply yet',
      },
      {
        source: tile({
          label: 'CTX',
          meta: compact(snap?.contextTokens ?? 0),
          value: `${ctxPct}`,
          unit: '%',
          fill: ctxPct / 100,
          isAlarm: isCtxHigh,
          isEmpty: !snap,
        }),
        alt: `Context ${ctxPct}% used, ${compact(snap?.contextTokens ?? 0)} of ${compact(snap?.contextWindow ?? 0)} tokens`,
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
      [
        readout('5H', five),
        readout('WK', week),
        { key: 'Σ CACHE', value: compact(sum.cacheRead), note: `${Math.round(sumHit * 100)}%` },
        call ? { key: 'HIT', value: `${Math.round(hit * 100)}%` } : null,
        snap ? { key: 'CTX', value: `${compact(snap.contextTokens ?? 0)}/${compact(snap.contextWindow)}` } : null,
        snap?.usd === undefined ? null : { key: 'COST', value: `$${snap.usd.toFixed(2)}` },
      ].filter((r): r is Readout => r !== null),
    )

    const tokens = tokenBar(sum)

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap">
          {below}
          {tiles.map(x => (
            <Svg source={x.source} alt={x.alt} width={TILE_W} height={TILE_H} />
          ))}
          <Button key="more" plain dimColor onPress={() => update($, isExpanded, x => !x)}>
            {expanded ? '×' : '⋯'}
          </Button>
        </Box>
        {expanded ? <Svg source={tokens.source} alt={tokens.alt} width={tokens.width} height={24} /> : null}
        {expanded ? (
          <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap">
            <Svg source={details.source} alt="Pace and session cache details" width={details.width} height={24} />
            <Button key="ttl5" variant={ttlMin === 5 ? 'primary' : 'secondary'} onPress={() => setTtl($, 5)}>
              5m
            </Button>
            <Button key="ttl60" variant={ttlMin === 60 ? 'primary' : 'secondary'} onPress={() => setTtl($, 60)}>
              1h
            </Button>
            {ctxPct >= 50 ? (
              <Button key="compact" variant="primary" onPress={() => void $.session.compact()}>
                Compact
              </Button>
            ) : null}
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
        <Text color={HUD.red}>usage HUD could not draw: {next.error.message ?? next.error.kind}</Text>
        {below}
      </Box>
    )
  })
}
