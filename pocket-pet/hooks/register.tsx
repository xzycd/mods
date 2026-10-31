import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { Beat } from '../types'

const beat = atom({ plugin: 'pocket-pet', key: 'beat' } as const, { kind: 'none', at: 0 }, { shape: 'beat-1' })
const burst = atom({ plugin: 'pocket-pet', key: 'burst' } as const, { n: 0, at: 0 }, { shape: 'burst-1' })
const lastActive = atom({ plugin: 'pocket-pet', key: 'lastActive' } as const, 0)
const isWorried = atom({ plugin: 'pocket-pet', key: 'isWorried' } as const, false)
const pets = atom({ plugin: 'pocket-pet', key: 'pets' } as const, 0)
const turns = atom({ plugin: 'pocket-pet', key: 'turns' } as const, 0)
const streak = atom({ plugin: 'pocket-pet', key: 'streak' } as const, 0)
const fedAt = atom({ plugin: 'pocket-pet', key: 'fedAt' } as const, 0)
const now = atom({ plugin: 'pocket-pet', key: 'now' } as const, 0)

const HAPPY_MS = 8000
const LOVE_MS = 4000
const EAT_MS = 3500
const OOPS_MS = 6000
const BURST_MS = 20e3
const DIZZY_AT = 8
const BORED_MS = 3 * 60e3
const SLEEP_MS = 10 * 60e3
const FULL_MS = 4 * 3600e3
const LONG_TURN_MS = 90e3

type Mood =
  | 'idle'
  | 'busy'
  | 'dizzy'
  | 'happy'
  | 'proud'
  | 'sad'
  | 'oops'
  | 'love'
  | 'eating'
  | 'hungry'
  | 'bored'
  | 'sleepy'
  | 'worried'

const LINES: Record<Mood, string[]> = {
  idle: ['hi, I’m Mochi', 'ready when you are', 'just vibing', 'say something nice'],
  busy: ['on it…', 'watching the tools', 'thinking hard', 'ooh, progress'],
  dizzy: ['so many tools', 'wheee…', 'head spinning', 'tool storm!'],
  happy: ['done! nice one', 'that went well', 'yay', 'another one shipped'],
  proud: ['look at us go', 'on a streak!', 'nailed it', 'proud of us'],
  sad: ['aw, it stopped', 'that stung a bit', 'we’ll get it', 'try again?'],
  oops: ['oops, a tool failed', 'eek!', 'that didn’t work', 'shake it off'],
  love: ['hehe ♥', 'more pets please', 'you’re my favourite', 'purr'],
  eating: ['nom nom', 'yummy', 'thank you!', 'crunch crunch'],
  hungry: ['tummy rumbles', 'snack please?', 'feed me?', 'so hungry…'],
  bored: ['hmm…', 'anything to do?', 'counting pixels', 'tap tap tap'],
  sleepy: ['zzz…', 'nap time', 'wake me with a prompt', 'dreaming of tokens'],
  worried: ['limits are low…', 'context is getting full', 'maybe compact?', 'go easy on me'],
}

const VERBS = [
  'thinking',
  'vibing',
  'pondering',
  'noodling',
  'brewing',
  'scheming',
  'tinkering',
  'conjuring',
  'percolating',
  'untangling',
  'cooking',
  'musing',
]

const FACE: Record<Mood, string> = {
  idle: '(｡•ᴗ•｡)',
  busy: '(•̀ᴗ•́)و',
  dizzy: '(@_@)',
  happy: '(＾▽＾)',
  proud: '(⌐■_■)',
  sad: '(╥﹏╥)',
  oops: '(>_<)!',
  love: '(♡ᴗ♡)',
  eating: '(っ˘ڡ˘ς)',
  hungry: '(｡•́︿•̀｡)',
  bored: '(￣～￣)',
  sleepy: '(－_－) zZ',
  worried: '(;･_･)',
}

type Feel = {
  beat: Beat
  t: number
  active: number
  isWorking: boolean
  isWorried: boolean
  burst: { n: number; at: number }
  fullness: number
}

const moodOf = ({ beat: b, t, active, isWorking, isWorried: worried, burst: tools, fullness }: Feel): Mood => {
  const since = t - b.at
  if (b.kind === 'love' && since < LOVE_MS) return 'love'
  if (b.kind === 'fed' && since < EAT_MS) return 'eating'
  if (b.kind === 'oops' && since < OOPS_MS) return 'oops'
  if (isWorking) return tools.n >= DIZZY_AT && t - tools.at < BURST_MS ? 'dizzy' : 'busy'
  if (b.kind === 'sad' && since < HAPPY_MS) return 'sad'
  if (b.kind === 'proud' && since < HAPPY_MS) return 'proud'
  if (b.kind === 'done' && since < HAPPY_MS) return 'happy'
  if (worried) return 'worried'
  if (fullness < 20) return 'hungry'
  if (active && t - active > SLEEP_MS) return 'sleepy'
  if (active && t - active > BORED_MS) return 'bored'
  return 'idle'
}

const fullnessOf = (t: number, fed: number) => Math.max(0, Math.min(100, 100 - ((t - fed) / FULL_MS) * 100))

const levelOf = (turnCount: number, petCount: number) => Math.floor(Math.sqrt((turnCount + Math.floor(petCount / 5)) / 3)) + 1

const INK = '#2B2140'
const OPEN = `<ellipse cx="25" cy="31" rx="2.7" ry="3.5" fill="${INK}"/><ellipse cx="39" cy="31" rx="2.7" ry="3.5" fill="${INK}"/><circle cx="26" cy="29.6" r="1" fill="#fff"/><circle cx="40" cy="29.6" r="1" fill="#fff"/>`
const ARCS = `<path d="M22 32 Q25 27.5 28 32 M36 32 Q39 27.5 42 32" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`
const SPIRAL = (cx: number) =>
  `<path class="spin" d="M${cx} 31 m-.8 0 a.8 .8 0 1 1 1.6 0 a1.6 1.6 0 1 1 -3.2 0 a2.4 2.4 0 1 1 4.8 0 a3.2 3.2 0 1 1 -6.4 0" stroke="${INK}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`
const STAR = (x: number, y: number, s: number, color: string, cls: string) =>
  `<path class="${cls}" d="M${x} ${y} l${1.4 * s} ${3.2 * s} ${3.2 * s} ${1.4 * s} ${-3.2 * s} ${1.4 * s} ${-1.4 * s} ${3.2 * s} ${-1.4 * s} ${-3.2 * s} ${-3.2 * s} ${-1.4 * s} ${3.2 * s} ${-1.4 * s}z" fill="${color}"/>`
const RICE = (x: number, y: number) =>
  `<path d="M${x} ${y - 6} Q${x + 1.4} ${y - 6} ${x + 5.6} ${y + 1.6} Q${x + 6.2} ${y + 3.6} ${x + 4} ${y + 3.6} H${x - 4} Q${x - 6.2} ${y + 3.6} ${x - 5.6} ${y + 1.6} Q${x - 1.4} ${y - 6} ${x} ${y - 6}Z" fill="#FFFDF7" stroke="rgba(43,33,64,.3)" stroke-width=".8"/><rect x="${x - 2.6}" y="${y - 0.4}" width="5.2" height="4" rx=".6" fill="#2E3B2C"/>`

const EYES: Record<Mood, string> = {
  idle: `<g class="blink">${OPEN}</g>`,
  busy: `<g class="glance">${OPEN}</g>`,
  dizzy: `${SPIRAL(25)}${SPIRAL(39)}`,
  happy: ARCS,
  proud: ARCS,
  sad: `<ellipse cx="25" cy="31.5" rx="2.4" ry="3" fill="${INK}"/><ellipse cx="39" cy="31.5" rx="2.4" ry="3" fill="${INK}"/><circle cx="25.8" cy="30.4" r=".8" fill="#fff"/><circle cx="39.8" cy="30.4" r=".8" fill="#fff"/><path d="M21 27 L27 25.4 M43 27 L37 25.4" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`,
  oops: `<path d="M22.5 28.5 L27.5 31 L22.5 33.5 M41.5 28.5 L36.5 31 L41.5 33.5" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  love: `<path d="M25 34 l-3-3 a1.8 1.8 0 0 1 3-2 a1.8 1.8 0 0 1 3 2z M39 34 l-3-3 a1.8 1.8 0 0 1 3-2 a1.8 1.8 0 0 1 3 2z" fill="#FF4D8D"/>`,
  eating: ARCS,
  hungry: `<ellipse cx="25" cy="31" rx="3.3" ry="4" fill="${INK}"/><ellipse cx="39" cy="31" rx="3.3" ry="4" fill="${INK}"/><circle cx="26.2" cy="29.4" r="1.3" fill="#fff"/><circle cx="40.2" cy="29.4" r="1.3" fill="#fff"/><circle cx="24" cy="32.6" r=".6" fill="#fff"/><circle cx="38" cy="32.6" r=".6" fill="#fff"/>`,
  bored: `<path d="M22 30.5 H28 M36 30.5 H42" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><circle cx="27" cy="32" r="1.4" fill="${INK}"/><circle cx="41" cy="32" r="1.4" fill="${INK}"/>`,
  sleepy: `<path d="M22 31.5 Q25 34 28 31.5 M36 31.5 Q39 34 42 31.5" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  worried: `<ellipse cx="25" cy="31" rx="2.4" ry="3" fill="${INK}"/><ellipse cx="39" cy="31" rx="2.4" ry="3" fill="${INK}"/><path d="M21 25.5 L27 27 M43 25.5 L37 27" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
}

const MOUTH: Record<Mood, { d: string; fill?: string; cls?: string }> = {
  idle: { d: 'M29.5 37 Q31 38.8 32 37 Q33 38.8 34.5 37' },
  busy: { d: 'M30 37.5 Q32 38.5 34 37.5' },
  dizzy: { d: 'M28.4 38 q1.2 -1.6 2.4 0 t2.4 0 t2.4 0' },
  happy: { d: 'M28.5 36.5 Q32 41.5 35.5 36.5 Z', fill: '#FF6F91' },
  proud: { d: 'M28.5 36.5 Q32 40.5 35.5 36.5' },
  sad: { d: 'M29 39.5 Q32 36.6 35 39.5' },
  oops: { d: 'M32 36.4 a1.7 2 0 1 0 .01 0 Z', fill: '#FF6F91' },
  love: { d: 'M29.5 37 Q31 38.8 32 37 Q33 38.8 34.5 37' },
  eating: { d: 'M29.5 37 Q32 40 34.5 37 Z', fill: '#FF6F91', cls: 'chew' },
  hungry: { d: 'M30 37 Q32 40.6 34 37 Z', fill: '#FF6F91' },
  bored: { d: 'M30 38.2 H34' },
  sleepy: { d: 'M31 38 Q32 39 33 38' },
  worried: { d: 'M29.5 39 Q32 36.8 34.5 39' },
}

const EXTRA: Record<Mood, string> = {
  idle: '',
  busy: STAR(54, 12, 1, '#FFD166', 'twinkle'),
  dizzy: `<g class="orbit">${STAR(20, 6, 0.6, '#FFD166', '')}${STAR(42, 4, 0.5, '#7CE7FF', '')}</g>`,
  happy: `${STAR(54, 12, 1, '#FFD166', 'twinkle')}${STAR(9, 18, 0.72, '#7CE7FF', 'twinkle t2')}`,
  proud: `<path class="pop" d="M24.5 11 L26.5 4.5 L29.6 8.4 L32 3 L34.4 8.4 L37.5 4.5 L39.5 11 Z" fill="#FFD166" stroke="#D99A00" stroke-width=".8" stroke-linejoin="round"/><circle cx="32" cy="7.6" r="1" fill="#FF4D8D"/>${STAR(54, 14, 0.8, '#FFD166', 'twinkle')}`,
  sad: `<path class="drip" d="M22.5 35 q2 3.2 0 4.4 q-2 -1.2 0 -4.4z" fill="#7CC8FF"/>`,
  oops: `<text class="pop" x="50" y="18" font-size="13" font-weight="800" fill="#FF2E2E" font-family="system-ui">!</text>`,
  love: `<path class="float" d="M52 20 l-4-4 a2.4 2.4 0 0 1 4-2.8 a2.4 2.4 0 0 1 4 2.8z" fill="#FF6FA5"/><path class="float t2" d="M12 22 l-3-3 a1.8 1.8 0 0 1 3-2 a1.8 1.8 0 0 1 3 2z" fill="#FF9EC4"/>`,
  eating: `<g class="nib">${RICE(48, 41)}</g><circle class="float" cx="42" cy="40" r=".7" fill="#FFFDF7"/><circle class="float t2" cx="44" cy="43" r=".6" fill="#FFFDF7"/>`,
  hungry: `<g class="float slow">${RICE(54, 12)}</g><path class="shake" d="M8 40 q1.5 -1.5 3 0 q1.5 1.5 3 0 M50 44 q1.5 -1.5 3 0 q1.5 1.5 3 0" stroke="#B9AEF0" stroke-width="1" fill="none" stroke-linecap="round"/>`,
  bored: `<text class="float slow" x="48" y="18" font-size="9" font-weight="700" fill="#9B8FD9" font-family="system-ui">…</text>`,
  sleepy: `<text class="float" x="50" y="18" font-size="9" font-weight="700" fill="#9B8FD9" font-family="system-ui">z</text><text class="float t2" x="55" y="12" font-size="7" font-weight="700" fill="#B9AEF0" font-family="system-ui">z</text>`,
  worried: `<path class="drip" d="M47 20 q2.5 4 0 5.5 q-2.5-1.5 0-5.5z" fill="#7CC8FF"/>`,
}

const MONO = `ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace`

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

const verbsFrom = (seed: number, count = 6) =>
  Array.from({ length: count }, (_, i) => VERBS[(seed + i * 5) % VERBS.length] ?? 'thinking')

const shimmerLines = (verbs: string[], y: number, width: number) => {
  const slot = 2.2
  const total = verbs.length * slot
  const share = 100 / verbs.length
  const keys = `@keyframes cyc{0%{opacity:0;transform:translateY(3px)}${(share * 0.12).toFixed(2)}%{opacity:1;transform:none}${(share * 0.86).toFixed(2)}%{opacity:1;transform:none}${share.toFixed(2)}%{opacity:0;transform:translateY(-3px)}100%{opacity:0}}`
  const texts = verbs
    .map(
      (v, i) =>
        `<text class="v${i === 0 ? ' v0' : ''}" x="14" y="${y}" font-size="9" fill="url(#sh)" style="animation:cyc ${total}s linear ${(i * slot).toFixed(1)}s infinite both">${escape(v)}…</text>`,
    )
    .join('')
  return {
    defs: `<linearGradient id="sh" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="44" y2="0"><stop offset="0" stop-color="#8E8E96"/><stop offset=".42" stop-color="#8E8E96"/><stop offset=".5" stop-color="#FFE3EE"/><stop offset=".58" stop-color="#8E8E96"/><stop offset="1" stop-color="#8E8E96"/><animateTransform attributeName="gradientTransform" type="translate" from="-44 0" to="${width} 0" dur="1.7s" repeatCount="indefinite"/></linearGradient><style>${keys}@media (prefers-reduced-motion:reduce){.v{animation:none!important;opacity:0}.v0{opacity:1}}</style>`,
    texts,
  }
}

type Say = { line?: string; verbs?: string[]; level: number; fullness: number }

const bubble = ({ line, verbs, level, fullness }: Say) => {
  const longest = verbs ? Math.max(...verbs.map(v => v.length + 1)) : (line ?? '').length
  const width = Math.ceil(Math.max(22 + Math.max(longest, 5) * 5.4, 112))
  const pips = Array.from({ length: 5 }, (_, i) => {
    const isLit = fullness > i * 20 + 4
    return `<rect x="${width - 9 - (5 - i) * 4.6 + 1}" y="9" width="3.4" height="3.4" rx=".8" fill="${isLit ? '#FF6FA5' : '#26262A'}"/>`
  }).join('')
  const body = verbs ? shimmerLines(verbs, 29, width) : null
  return {
    width,
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 40" width="${width}" height="40"><defs>${body?.defs ?? ''}</defs><g font-family="${MONO}"><path d="M11.5 .5 H${width - 7.5} a7 7 0 0 1 7 7 V32.5 a7 7 0 0 1 -7 7 H11.5 a7 7 0 0 1 -7 -7 V24 L.5 20 L4.5 16 V7.5 a7 7 0 0 1 7 -7 Z" fill="#0B0B0C" stroke="#232327"/><text x="14" y="15" font-size="7.5" letter-spacing="1.3" fill="#FF6FA5">MOCHI</text><text x="48" y="15" font-size="7.5" letter-spacing="1" fill="#77777D">LV${level}</text>${pips}${body ? body.texts : `<text x="14" y="29" font-size="9" fill="#F2F2F2">${escape(line ?? '')}</text>`}</g></svg>`,
  }
}

const pet = (mood: Mood) => {
  const speed =
    mood === 'busy' || mood === 'dizzy'
      ? '0.9s'
      : mood === 'sleepy' || mood === 'bored'
        ? '3.6s'
        : mood === 'happy' || mood === 'love' || mood === 'proud' || mood === 'eating'
          ? '0.7s'
          : '2.4s'
  const lift =
    mood === 'happy' || mood === 'love' || mood === 'proud' ? -4 : mood === 'sleepy' || mood === 'sad' ? -0.6 : -1.6
  const wrap = mood === 'worried' || mood === 'oops' ? 'shake' : mood === 'dizzy' ? 'wobble' : ''
  const mouth = MOUTH[mood]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 56" width="46" height="40">
<defs>
<radialGradient id="body" cx="40%" cy="32%" r="75%"><stop offset="0" stop-color="#FFF6FA"/><stop offset=".55" stop-color="#FFD9E8"/><stop offset="1" stop-color="#FFB3D0"/></radialGradient>
<style>
.bob{animation:bob ${speed} ease-in-out infinite;transform-origin:32px 50px}
.shadow{animation:shadow ${speed} ease-in-out infinite;transform-origin:32px 52px}
.blink{animation:blink 4.2s infinite;transform-origin:32px 31px}
.glance{animation:glance 1.6s ease-in-out infinite}
.twinkle{animation:twinkle 1.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.float{animation:float 2s ease-out infinite}
.slow{animation-duration:3.2s}
.drip{animation:drip 1.4s ease-in infinite}
.t2{animation-delay:.6s}
.shake{animation:shake .5s ease-in-out infinite}
.wobble{animation:wobble 1.2s ease-in-out infinite;transform-origin:32px 40px}
.spin{animation:spin 1s linear infinite;transform-box:fill-box;transform-origin:center}
.orbit{animation:spin 2.4s linear infinite;transform-origin:32px 10px}
.pop{animation:pop .5s cubic-bezier(.2,1.6,.4,1) both;transform-box:fill-box;transform-origin:center bottom}
.chew{animation:chew .35s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.nib{animation:nib .7s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes bob{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(${lift}px) scale(.97,1.03)}}
@keyframes shadow{0%,100%{transform:scaleX(1);opacity:.22}50%{transform:scaleX(.82);opacity:.14}}
@keyframes blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes glance{0%,100%{transform:translateX(-1.4px)}50%{transform:translateX(1.4px)}}
@keyframes twinkle{0%,100%{transform:scale(.6);opacity:.4}50%{transform:scale(1.1);opacity:1}}
@keyframes float{0%{transform:translateY(4px);opacity:0}30%{opacity:1}100%{transform:translateY(-8px);opacity:0}}
@keyframes drip{0%{transform:translateY(0);opacity:1}100%{transform:translateY(6px);opacity:0}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-.8px)}75%{transform:translateX(.8px)}}
@keyframes wobble{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pop{0%{transform:scale(0);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes chew{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.4)}}
@keyframes nib{0%,100%{transform:rotate(-6deg) translateX(0)}50%{transform:rotate(4deg) translateX(-1.5px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
</defs>
<ellipse class="shadow" cx="32" cy="52" rx="17" ry="2.6" fill="${INK}"/>
<g class="bob"><g class="${wrap}">
<path d="M17.5 20 Q14.5 9.5 18 8.2 Q21.5 7.4 28 14.5 Z M46.5 20 Q49.5 9.5 46 8.2 Q42.5 7.4 36 14.5 Z" fill="#FFC9DD" stroke="rgba(43,33,64,.28)" stroke-width="1"/>
<path d="M19.2 11.6 Q19.6 10.2 21 11 L24.6 14.4 L20.4 16.4 Z M44.8 11.6 Q44.4 10.2 43 11 L39.4 14.4 L43.6 16.4 Z" fill="#FF9EC4" opacity=".7"/>
<path d="M11 39 C11 22 21 12 32 12 C43 12 53 22 53 39 C53 47 46 50.5 32 50.5 C18 50.5 11 47 11 39 Z" fill="url(#body)" stroke="rgba(43,33,64,.28)" stroke-width="1.1"/>
<ellipse cx="23" cy="20" rx="5" ry="2.6" fill="#fff" opacity=".7" transform="rotate(-24 23 20)"/>
<ellipse cx="19.5" cy="37" rx="3.6" ry="2.1" fill="#FF8FB3" opacity="${mood === 'sad' || mood === 'hungry' ? '.3' : '.55'}"/>
<ellipse cx="44.5" cy="37" rx="3.6" ry="2.1" fill="#FF8FB3" opacity="${mood === 'sad' || mood === 'hungry' ? '.3' : '.55'}"/>
${EYES[mood]}
<path class="${mouth.cls ?? ''}" d="${mouth.d}" stroke="${INK}" stroke-width="1.4" fill="${mouth.fill ?? 'none'}" stroke-linecap="round" stroke-linejoin="round"/>
</g></g>
${EXTRA[mood]}
</svg>`
}

const poke = async ($: EngineInterface) => {
  const t = Date.now()
  await update($, now, () => t)
  await update($, lastActive, () => t)
}

const later = ($: EngineInterface, ms: number) => {
  $.clock.after(ms + 50, () => update($, now, () => Date.now()))
}

const pulse = async ($: EngineInterface, kind: Beat['kind'], ms: number) => {
  const at = Date.now()
  await update($, beat, () => ({ kind, at }))
  await update($, now, () => at)
  later($, ms)
}

const isLow = (limits: readonly SessionRateLimit[], contextPercent: number | undefined) =>
  limits.some(l => l.percentUsed >= 85) || (contextPercent ?? 0) >= 85

const cheerLevel = ($: EngineInterface, before: number, after: number) => {
  if (after > before) $.ui.toast(`Mochi reached level ${after} ✦`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'mochi', description: 'Show Mochi’s level, mood stats and hunger' })
    const storedPets = Number(await $.store.get('pets'))
    if (storedPets > 0) await update($, pets, () => storedPets)
    const storedTurns = Number(await $.store.get('turns'))
    if (storedTurns > 0) await update($, turns, () => storedTurns)
    const storedFed = Number(await $.store.get('fedAt'))
    await update($, fedAt, () => (storedFed > 0 ? storedFed : Date.now() - FULL_MS / 2))
    await poke($)
    $.clock.every(30e3, () => update($, now, () => Date.now()))

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await poke($)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    try {
      const t = Date.now()
      await update($, burst, b => (t - b.at > BURST_MS ? { n: 1, at: t } : { n: b.n + 1, at: b.at }))
      await update($, lastActive, () => t)
      if (r.isError === true && e.agentId === undefined) await pulse($, 'oops', OOPS_MS)
      else await update($, now, () => t)
    } catch {
      // Mochi's bookkeeping never changes a tool's result.
    }

    return r
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    await poke($)
    if (e.isAborted || e.reason === 'error') {
      await update($, streak, () => 0)
      await pulse($, 'sad', HAPPY_MS)
      return next(e)
    }
    const petCount = await read($, pets)
    const before = levelOf(await read($, turns), petCount)
    const total = await update($, turns, n => n + 1)
    await $.store.set('turns', total)
    const run = await update($, streak, n => n + 1)
    cheerLevel($, before, levelOf(total, petCount))
    await pulse($, run % 5 === 0 || e.durationMs >= LONG_TURN_MS ? 'proud' : 'done', HAPPY_MS)

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const low = isLow(e.rateLimits, e.context.percent)
    if (low !== (await read($, isWorried))) await update($, isWorried, () => low)

    return next(e)
  })

  on('command.run', { command: 'mochi' }, async $ => {
    const t = Date.now()
    const petCount = await read($, pets)
    const turnCount = await read($, turns)
    const full = Math.round(fullnessOf(t, await read($, fedAt)))
    return {
      text: `Mochi · level ${levelOf(turnCount, petCount)} · ${turnCount} turns seen · ${petCount} pets · ${full}% full · streak ${await read($, streak)}`,
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below

    const t = (await read($, now)) || Date.now()
    const b = await read($, beat)
    const fed = await read($, fedAt)
    const fullness = fullnessOf(t, fed || t)
    const mood = moodOf({
      beat: b,
      t,
      active: await read($, lastActive),
      isWorking: e.props.isWorking,
      isWorried: await read($, isWorried),
      burst: await read($, burst),
      fullness,
    })
    const isThinking = mood === 'busy'
    const verbs = verbsFrom(Math.floor(b.at / 1000))
    const lines = LINES[mood]
    const line = isThinking ? `${verbs[0]}…` : (lines[Math.floor(t / 90e3) % lines.length] ?? '')
    const count = await read($, pets)
    const level = levelOf(await read($, turns), count)
    const isPeckish = fullness < 70

    const onPet = async () => {
      const total = await update($, pets, n => n + 1)
      await $.store.set('pets', total)
      cheerLevel($, levelOf(await read($, turns), total - 1), levelOf(await read($, turns), total))
      await poke($)
      await pulse($, 'love', LOVE_MS)
      if (total % 25 === 0) $.ui.toast(`Mochi has been petted ${total} times ♥`)
    }

    const onFeed = async () => {
      const at = Date.now()
      await update($, fedAt, () => at)
      await $.store.set('fedAt', at)
      await poke($)
      await pulse($, 'fed', EAT_MS)
    }

    if (e.surface === 'terminal') {
      const { Box, Text, Button } = $.ui.resolve(e)
      const spoken = isThinking ? `${VERBS[Math.floor(t / 3000) % VERBS.length]}…` : line
      return (
        <Box flexDirection="column">
          {below}
          <Box flexDirection="row" gap={1}>
            <Text color="#FF8FB3">{FACE[mood]}</Text>
            <Text dimColor italic={isThinking}>
              {spoken}
            </Text>
            <Text dimColor>lv{level}</Text>
            <Button key="pet" plain dimColor onPress={onPet}>
              {`♥ ${count}`}
            </Button>
            {isPeckish ? (
              <Button key="feed" plain dimColor onPress={onFeed}>
                feed
              </Button>
            ) : null}
          </Box>
        </Box>
      )
    }

    const { Box, Button, Svg } = $.ui.resolve(e)
    const say = bubble({ line, verbs: isThinking ? verbs : undefined, level, fullness })
    return (
      <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap">
        {below}
        <Box key="mochi" flexDirection="row" alignItems="center" gap={0}>
          <Svg source={pet(mood)} alt={`Mochi, ${mood}: ${line}`} width={46} height={40} />
          <Svg source={say.source} alt={`Level ${level}, ${Math.round(fullness)}% full. ${line}`} width={say.width} height={40} />
          <Button key="pet" plain dimColor onPress={onPet}>
            {`♥ ${count}`}
          </Button>
          {isPeckish ? (
            <Button key="feed" plain dimColor onPress={onFeed}>
              feed
            </Button>
          ) : null}
        </Box>
      </Box>
    )
  })
}
