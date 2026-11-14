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
const seed = atom({ plugin: 'pocket-pet', key: 'seed' } as const, 0)
const project = atom({ plugin: 'pocket-pet', key: 'project' } as const, '')
const isHidden = atom({ plugin: 'pocket-pet', key: 'isHidden' } as const, false)
const theme = atom({ plugin: 'pocket-pet', key: 'theme' } as const, 'black')
const isOpen = atom({ plugin: 'pocket-pet', key: 'isOpen' } as const, false)
const bornAt = atom({ plugin: 'pocket-pet', key: 'bornAt' } as const, 0)
const cause = atom({ plugin: 'pocket-pet', key: 'cause' } as const, '')
const base = atom({ plugin: 'pocket-pet', key: 'base' } as const, 0)
const stars = atom({ plugin: 'pocket-pet', key: 'stars' } as const, 0)
const isTappable = atom({ plugin: 'pocket-pet', key: 'isTappable' } as const, true)

const HAPPY_MS = 8000
const LOVE_MS = 4000
const EAT_MS = 3500
const OOPS_MS = 6000
const BURST_MS = 20e3
const DIZZY_AT = 5
const BORED_MS = 60e3
const SLEEP_MS = 3 * 60e3
const FULL_MS = 4 * 3600e3
const LONG_TURN_MS = 90e3
const VISIT_EVERY_MS = 20 * 60e3
const VISIT_MS = 4 * 60e3
const SETTLE_MS = 5 * 60e3
const YARD = 34

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
  idle: [
    'hi, I’m {name}',
    'ready when you are',
    'just vibing',
    'say something nice',
    'what are we building?',
    'I kept your seat warm',
    'psst. over here',
    'the cursor looks tasty',
    'poke me, I dare you',
    'no bugs in sight',
  ],
  busy: ['on it…', 'watching the tools', 'thinking hard', 'ooh, progress', 'shh, it’s working', 'reading every line', 'holding my breath', 'almost, almost'],
  dizzy: ['so many tools', 'wheee…', 'head spinning', 'tool storm!', 'which way is up?', 'one at a time, please'],
  happy: ['done! nice one', 'that went well', 'yay', 'another one shipped', 'clean landing', 'high paw!', 'we did that', 'green all the way'],
  proud: ['look at us go', 'on a streak!', 'nailed it', 'proud of us', 'frame this one', 'tell everyone', 'that was a big one'],
  sad: ['aw, it stopped', 'that stung a bit', 'we’ll get it', 'try again?', 'I still believe in us', 'deep breath', 'next one lands'],
  oops: ['oops, a tool failed', 'eek!', 'that didn’t work', 'shake it off', 'I saw nothing', 'not our fault. maybe', 'ow, my pixels'],
  love: ['hehe ♥', 'more pets please', 'you’re my favourite', 'purr', 'right there ♥', 'best human', 'I’m keeping count', 'again, again'],
  eating: ['nom nom', 'yummy', 'thank you!', 'crunch crunch', 'rice is life', 'saving a bite for later'],
  hungry: ['tummy rumbles', 'snack please?', 'feed me?', 'so hungry…', 'I’d trade a bug for rice', 'is that food? no…', 'running on empty'],
  bored: ['hmm…', 'anything to do?', 'counting pixels', 'tap tap tap', 'I’ll go for a walk', 'your move', 'rearranged my yard', 'still here'],
  sleepy: ['zzz…', 'nap time', 'wake me with a prompt', 'dreaming of tokens', 'five more minutes', 'mmf… commits…'],
  worried: ['limits are low…', 'context is getting full', 'maybe compact?', 'go easy on me', 'pace yourself', 'short prompts, please'],
}

const EVIL_LINES: Record<Mood, string[]> = {
  idle: [
    'I am {name}. kneel',
    'final boss, at rest',
    'plotting quietly',
    'your code amuses me',
    'I see your cursor, mortal',
    'approach. slowly',
    'the throne is warm',
    'bring me a worthy bug',
  ],
  busy: ['burning through it…', 'the tools obey', 'scorching bugs', 'mwahaha, progress', 'none shall compile but us', 'the logs tremble'],
  dizzy: ['chaos! I love it', 'MORE TOOLS', 'tool storm, yes', 'drunk on power', 'the world spins for me'],
  happy: ['victory is ours', 'another one falls', 'flawless', 'boss fight won', 'as foretold', 'loot acquired'],
  proud: ['bow to the streak', 'unstoppable', 'legends, us', 'fear our velocity', 'carve it in stone', 'the realm grows'],
  sad: ['retreat… for now', 'we strike again', 'a minor setback', 'revenge later', 'I allowed that', 'regroup, mortal'],
  oops: ['the tool betrayed us', 'grr!', 'who dares fail me', 'it will pay', 'insolent exit code', 'a traitor in the shell'],
  love: ['…fine. more pets', 'tell no one ♥', 'purr. ahem. roar', 'acceptable tribute', 'you may continue', 'do not stop. I mean it'],
  eating: ['tribute accepted', 'crunch', 'more offerings', 'delicious', 'a feast fit for me'],
  hungry: ['feed me, mortal', 'I hunger', 'snacks or chaos', 'tribute is due', 'my fire burns low', 'rice. now'],
  bored: ['entertain me', 'so… quiet', 'sharpening claws', 'no challengers?', 'pacing my lair', 'I could burn something'],
  sleepy: ['zzz… conquering…', 'dreaming of fire', 'do not wake me', 'zzz…', 'guarding the hoard… zzz'],
  worried: ['limits close in…', 'context runs thin', 'compact, or perish', 'tread carefully', 'spend tokens wisely'],
}

const TIPS = [
  'one small commit at a time',
  'drink some water ♥',
  'stuck? explain it to me',
  'read the error twice',
  'done beats perfect',
  'small wins add up',
  'stretch your shoulders',
  'blink, rest your eyes',
  'plan first, then prompt',
  'ship it, polish later',
  'name things for future you',
  'a short walk fixes bugs',
  'write the test you fear',
  'commit before the big edit',
  'one question per prompt',
  'paste the real error',
  'unclench your jaw',
  'say what done looks like',
]

const EVIL_TIPS = [
  'bugs fear the committed',
  'crush one task. then next',
  'hydrate, mortal',
  'no mercy for flaky tests',
  'feed me shipped features',
  'the deadline bows to us',
  'rest now. conquer later',
  'read the stack trace',
  'burn the dead code',
  'one more commit. obey.',
]

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

const HEARTS_PER_XP = 5

const xpOf = (turnCount: number, petCount: number, spent = 0) => Math.max(0, turnCount + Math.floor(petCount / HEARTS_PER_XP) - spent)

const levelOf = (turnCount: number, petCount: number, spent = 0) => Math.floor(Math.sqrt(xpOf(turnCount, petCount, spent) / 3)) + 1

const REBIRTH_AT = 10
const STAGES = [
  { from: 1, word: 'baby', scale: 0.84 },
  { from: 5, word: 'young', scale: 0.93 },
  { from: REBIRTH_AT, word: 'grown', scale: 1 },
  { from: 20, word: 'elder', scale: 1 },
]
const GROWN = 2
const stageOf = (level: number) => STAGES.filter(s => level >= s.from).length - 1

const progressOf = (turnCount: number, petCount: number, spent = 0) => {
  const level = levelOf(turnCount, petCount, spent)
  const from = 3 * (level - 1) ** 2
  const to = 3 * level ** 2
  const xp = xpOf(turnCount, petCount, spent)
  return { level, xp: xp - from, span: to - from, share: (xp - from) / (to - from), heartsToXp: HEARTS_PER_XP - (petCount % HEARTS_PER_XP) }
}

type Moment = { hour: number; streak: number; turnCount: number; petCount: number; spent: number }

const momentLines = ({ hour, streak: run, turnCount, petCount, spent }: Moment, isEvil: boolean) => {
  const { level, xp, span, heartsToXp } = progressOf(turnCount, petCount, spent)
  const lines = [`${heartsToXp} more ♥ for 1 xp`, `${span - xp} xp to level ${level + 1}`]
  if (run >= 2) lines.push(isEvil ? `${run} victories in a row` : `${run} turns in a row!`)
  if (hour >= 23 || hour < 5) lines.push(isEvil ? 'even bosses sleep. go' : 'it’s late. sleep soon?')
  else if (hour < 10) lines.push(isEvil ? 'dawn. we conquer' : 'good morning ♥')
  else if (hour >= 12 && hour < 14) lines.push(isEvil ? 'feast time, mortal' : 'lunch yet?')
  else if (hour >= 17 && hour < 20) lines.push(isEvil ? 'one last raid today' : 'last push of the day')
  if (turnCount > 0 && turnCount % 50 === 0) lines.push(`${turnCount} turns together`)
  return lines
}

const INK = '#2B2140'
const OPEN = `<ellipse cx="25" cy="31" rx="2.7" ry="3.5" fill="${INK}"/><ellipse cx="39" cy="31" rx="2.7" ry="3.5" fill="${INK}"/><circle cx="26" cy="29.6" r="1" fill="#fff"/><circle cx="40" cy="29.6" r="1" fill="#fff"/><circle cx="24.2" cy="32.6" r=".5" fill="#fff" opacity=".8"/><circle cx="38.2" cy="32.6" r=".5" fill="#fff" opacity=".8"/>`
const ARCS = `<path d="M22 32 Q25 27.5 28 32 M36 32 Q39 27.5 42 32" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`
const SPIRAL = (cx: number) =>
  `<path class="spin" d="M${cx} 31 m-.8 0 a.8 .8 0 1 1 1.6 0 a1.6 1.6 0 1 1 -3.2 0 a2.4 2.4 0 1 1 4.8 0 a3.2 3.2 0 1 1 -6.4 0" stroke="${INK}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`
const STAR = (x: number, y: number, s: number, color: string, cls: string) =>
  `<path class="${cls}" d="M${x} ${y} l${1.4 * s} ${3.2 * s} ${3.2 * s} ${1.4 * s} ${-3.2 * s} ${1.4 * s} ${-1.4 * s} ${3.2 * s} ${-1.4 * s} ${-3.2 * s} ${-3.2 * s} ${-1.4 * s} ${3.2 * s} ${-1.4 * s}z" fill="${color}"/>`
const RICE = (x: number, y: number) =>
  `<path d="M${x} ${y - 6} Q${x + 1.4} ${y - 6} ${x + 5.6} ${y + 1.6} Q${x + 6.2} ${y + 3.6} ${x + 4} ${y + 3.6} H${x - 4} Q${x - 6.2} ${y + 3.6} ${x - 5.6} ${y + 1.6} Q${x - 1.4} ${y - 6} ${x} ${y - 6}Z" fill="#FFFDF7" stroke="rgba(43,33,64,.3)" stroke-width=".8"/><rect x="${x - 2.6}" y="${y - 0.4}" width="5.2" height="4" rx=".6" fill="#2E3B2C"/>`

const EDGE = `stroke="rgba(43,33,64,.28)" stroke-width="1"`
const mirror = (s: string) => `${s}<g transform="matrix(-1 0 0 1 64 0)">${s}</g>`

type Palette = {
  light: string
  mid: string
  deep: string
  ear: string
  inner: string
  cheek: string
  accent: string
  glow: string
  trim: string
  ink?: string
  rim?: string
}

const PALETTES: Palette[] = [
  { light: '#FFF6FA', mid: '#FFD9E8', deep: '#FFB3D0', ear: '#FFC9DD', inner: '#FF9EC4', cheek: '#FF8FB3', accent: '#FF6FA5', glow: '#FFE3EE', trim: '#7CC8FF' },
  { light: '#FAFFF2', mid: '#E1F3C8', deep: '#B8DE8E', ear: '#D2ECB0', inner: '#9CCB62', cheek: '#FF9FA8', accent: '#A6E36B', glow: '#EEFFDC', trim: '#FF6F91' },
  { light: '#FAF7FF', mid: '#E5DCFF', deep: '#C2B1F7', ear: '#D8CDFF', inner: '#A994F0', cheek: '#FF9FC8', accent: '#B49BFF', glow: '#EEE6FF', trim: '#FFD166' },
  { light: '#FFF8F2', mid: '#FFE1CE', deep: '#FFBF98', ear: '#FFD3B7', inner: '#FFA174', cheek: '#FF8C7A', accent: '#FFA05E', glow: '#FFEADC', trim: '#5DB8FF' },
  { light: '#F5FBFF', mid: '#D5ECFF', deep: '#A2D1FA', ear: '#C4E3FF', inner: '#86BFF0', cheek: '#FF9FB8', accent: '#6CC0FF', glow: '#DDF1FF', trim: '#FF6F91' },
  { light: '#FFFEF3', mid: '#FFF3C2', deep: '#FFE07E', ear: '#FFEDA6', inner: '#F5C94A', cheek: '#FFA08A', accent: '#FFD84D', glow: '#FFF7D6', trim: '#8E7CFF' },
  { light: '#FFFFFF', mid: '#F6F1EA', deep: '#E3D9CC', ear: '#EFE7DC', inner: '#F3B8C4', cheek: '#FF9FB0', accent: '#F0DFC2', glow: '#FFF6E8', trim: '#FF6F91' },
  { light: '#F2FFFB', mid: '#CFF5EA', deep: '#96E2CE', ear: '#BAEEDF', inner: '#6CD1B7', cheek: '#FF9FB0', accent: '#5FE3C2', glow: '#DAFFF5', trim: '#A98BFF' },
]

type Drift = { chance: number; period: number; span: number; depth: number }

const DRIFTS: Partial<Record<Mood, Drift>> = {
  idle: { chance: 92, period: 14, span: 46, depth: 0.1 },
  bored: { chance: 100, period: 14, span: 52, depth: 0.08 },
  busy: { chance: 78, period: 9, span: 30, depth: 0.14 },
  hungry: { chance: 70, period: 16, span: 40, depth: 0.12 },
}
const GONE: Drift = { chance: 100, period: 12, span: 42, depth: 0.07 }
const DOZE = '.veil{animation:doze 5s ease-in-out infinite}@keyframes doze{0%,100%{opacity:1}50%{opacity:.5}}'

const driftCss = ({ period, span, depth }: Drift, whim: number, tint: string) => {
  const from = 8 + ((whim >>> 8) % (84 - span))
  const ramp = Math.min(12, span * 0.3)
  const here = `0%,${from}%,${from + span}%,100%`
  const away = `${(from + ramp).toFixed(1)}%,${(from + span - ramp).toFixed(1)}%`
  const run = (name: string) => `animation:${name} ${period}s ease-in-out infinite`
  return `.veil{${run('veil')};transform-origin:32px 34px}.dusk{${run('dusk')}}.spirit{${run('spirit')}}.lip{${run('lip')}}@keyframes veil{${here}{opacity:1;transform:none;filter:none}${away}{opacity:${depth};transform:translateY(-1.4px) scale(1.04);filter:blur(.9px)}}@keyframes dusk{${here}{opacity:1}${away}{opacity:.25}}@keyframes spirit{${here}{opacity:0}${away}{opacity:1}}@keyframes lip{${away}{stroke:${tint}}}`
}

type Kind = {
  word: string
  ears: (p: Palette) => string
  tail: (p: Palette) => string
  wings?: (p: Palette) => string
  face?: (p: Palette, mood: Mood) => string
  aura?: (mood: Mood) => string
  back?: (p: Palette) => string
  defs?: (p: Palette) => string
  css?: (mood: Mood) => string
  eyes?: (p: Palette, mood: Mood) => string
  mouth?: (p: Palette, mood: Mood) => string | undefined
  react?: string
  drifts?: Partial<Record<Mood, Drift>>
}

const NEAR = '.z:hover~.pet'
const ON_FACE = '.zc:hover~.pet'

const KINDS: Kind[] = [
  {
    word: 'cat',
    ears: p =>
      mirror(
        `<path d="M17.5 20 Q14.5 9.5 18 8.2 Q21.5 7.4 28 14.5 Z" fill="${p.ear}" ${EDGE}/><path d="M19.2 11.6 Q19.6 10.2 21 11 L24.6 14.4 L20.4 16.4 Z" fill="${p.inner}" opacity=".7"/>`,
      ),
    tail: p =>
      `<path d="M50 45 Q59.5 44 58.5 35 Q58 30.5 54.5 31.5" stroke="rgba(43,33,64,.28)" stroke-width="4.6" fill="none" stroke-linecap="round"/><path d="M50 45 Q59.5 44 58.5 35 Q58 30.5 54.5 31.5" stroke="${p.ear}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    react: `${NEAR} .wag{animation-duration:.4s}`,
  },
  {
    word: 'bunny',
    ears: p =>
      mirror(
        `<ellipse cx="22.5" cy="9.8" rx="4.2" ry="9.4" transform="rotate(-14 22.5 9.8)" fill="${p.ear}" ${EDGE}/><ellipse cx="22.8" cy="10.8" rx="2" ry="6.4" transform="rotate(-14 22.8 10.8)" fill="${p.inner}" opacity=".7"/>`,
      ),
    tail: () => `<circle cx="54.6" cy="44.4" r="3.8" fill="#FFFDF7" ${EDGE}/>`,
    react: `${NEAR} .ears{transform:translateY(-2.8px)}`,
  },
  {
    word: 'bear',
    ears: p =>
      mirror(
        `<circle cx="18.5" cy="17" r="6" fill="${p.ear}" ${EDGE}/><circle cx="18.8" cy="17.4" r="3.2" fill="${p.inner}" opacity=".7"/>`,
      ),
    tail: p => `<circle cx="54" cy="45.5" r="3" fill="${p.ear}" ${EDGE}/>`,
    react: `${NEAR} .ears{animation:wiggle .45s ease-in-out infinite;transform-origin:32px 22px}@keyframes wiggle{0%,100%{transform:translateY(-1px) rotate(-3deg)}50%{transform:translateY(-1px) rotate(3deg)}}`,
  },
  {
    word: 'fox',
    ears: p =>
      mirror(
        `<path d="M16 22 Q12.5 7 16.5 4.2 Q19.5 3.2 29 14 Z" fill="${p.ear}" ${EDGE}/><path d="M16.9 7.6 Q17.3 5.4 19 6.2 L22.4 9.6 Q19 10.2 17.2 11.2 Z" fill="${INK}" opacity=".5"/><path d="M18.4 13 Q18.6 11.6 20 12.2 L25.2 15 L19.6 18 Z" fill="${p.inner}" opacity=".7"/>`,
      ),
    tail: p =>
      `<path d="M48.5 46 Q61 47.5 60.5 36.5 Q60 29.5 55 28 Q57.5 37 48.5 40.5 Z" fill="${p.ear}" ${EDGE}/><path d="M55 28 Q59.6 29.4 60.4 34.4 Q57.6 33 56.3 31 Z" fill="#FFFDF7"/>`,
    react: `${NEAR} .swish{transform:rotate(-20deg)}${NEAR} .ears{transform:translateY(-2px)}`,
  },
]

const NEW_KINDS: Kind[] = [
  {
    word: 'axolotl',
    ears: p =>
      mirror(
        `<g fill="${p.inner}" ${EDGE} stroke-linejoin="round"><path d="M14 24 Q6 20 5 13.6 Q10.6 15.6 16 20 Z"/><path d="M12.6 29.4 Q4 28.4 2 22.8 Q8 22.8 13.2 25.8 Z"/><path d="M12.2 34.4 Q5 36.4 2.6 32.4 Q8 30.4 12.4 30.8 Z"/></g>`,
      ),
    tail: p => `<path d="M48.6 46.4 Q60 46.6 61.4 36.6 Q55.6 38.6 49.6 41 Z" fill="${p.ear}" ${EDGE} stroke-linejoin="round"/>`,
    react: `${NEAR} .ears{animation:wiggle .5s ease-in-out infinite;transform-origin:32px 26px}@keyframes wiggle{0%,100%{transform:scale(1.04,1)}50%{transform:scale(.97,1)}}`,
  },
  {
    word: 'chick',
    ears: p =>
      `<path d="M32 13.4 Q28.6 6.4 30.6 3.6 Q32.4 6.6 33 9 Q34.6 4.6 37.6 4.6 Q36.4 10 34 13.4 Z" fill="${p.ear}" ${EDGE} stroke-linejoin="round"/>`,
    tail: p => `<path d="M50.6 43.6 Q59.6 41.6 59.6 35.6 Q55 36.8 51.6 39.4 Z" fill="${p.ear}" ${EDGE} stroke-linejoin="round"/>`,
    wings: p => mirror(`<g class="flap"><ellipse cx="10.6" cy="36" rx="3.6" ry="5.8" transform="rotate(16 10.6 36)" fill="${p.ear}" ${EDGE}/></g>`),
    mouth: (_, mood) =>
      `<path class="${mood === 'eating' ? 'chew' : ''}" d="M29.2 36.2 Q32 34.6 34.8 36.2 Q32 40.8 29.2 36.2 Z" fill="#FFB23E" stroke="#D98A1E" stroke-width=".7" stroke-linejoin="round"/>`,
    react: `${NEAR} .flap{animation:flap .16s ease-in-out infinite alternate}`,
  },
  {
    word: 'bee',
    ears: p =>
      mirror(
        `<path d="M27.4 13.6 Q24.6 7.4 21.4 5.8" stroke="rgba(43,33,64,.55)" stroke-width="1.1" fill="none" stroke-linecap="round"/><circle cx="20.8" cy="5.4" r="1.8" fill="${p.inner}" ${EDGE}/>`,
      ),
    tail: () => `<path d="M51.6 43.6 L58.8 46.2 L52.2 48 Z" fill="${INK}" opacity=".6"/>`,
    wings: () =>
      mirror(`<g class="flap"><ellipse cx="9.6" cy="25.6" rx="5.4" ry="7.6" transform="rotate(-24 9.6 25.6)" fill="#fff" opacity=".72" ${EDGE}/></g>`),
    face: () =>
      `<g stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".3"><path d="M13.6 42.4 Q32 46.6 50.4 42.4"/><path d="M17.4 46.8 Q32 50 46.6 46.8"/></g>`,
    react: `${NEAR} .flap{animation:flap .12s ease-in-out infinite alternate}`,
  },
]

const MARKS: ((p: Palette) => string)[] = [
  () => '',
  p =>
    `<path d="M28.6 15.4 L29.6 19 M32 14.4 V18.6 M35.4 15.4 L34.4 19" stroke="${p.inner}" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>`,
  p =>
    `<g fill="${p.inner}" opacity=".5"><circle cx="20.5" cy="25.5" r="2.2"/><circle cx="43.6" cy="22.6" r="1.6"/><circle cx="46.8" cy="27.6" r="1.1"/></g>`,
  p => `<ellipse cx="43" cy="22" rx="7" ry="5.4" transform="rotate(28 43 22)" fill="${p.inner}" opacity=".35"/>`,
]

const WEAR: ((p: Palette) => string)[] = [
  () => '',
  p =>
    `<g fill="${p.trim}" stroke="rgba(43,33,64,.3)" stroke-width=".8" stroke-linejoin="round"><path d="M44.5 15.5 l-5.2 -3.6 q-1 3.6 0 7.2z M44.5 15.5 l5.2 -3.6 q1 3.6 0 7.2z"/><circle cx="44.5" cy="15.5" r="1.7"/></g>`,
  p =>
    `<g transform="translate(20 16.5)"><g fill="${p.trim}"><circle cy="-2.2" r="1.7"/><circle cx="2.1" cy="-.7" r="1.7"/><circle cx="1.3" cy="1.8" r="1.7"/><circle cx="-1.3" cy="1.8" r="1.7"/><circle cx="-2.1" cy="-.7" r="1.7"/></g><circle r="1.3" fill="#FFD166"/></g>`,
  () =>
    `<path d="M32 12.5 Q31.6 9 33 6.6" stroke="#5E9E4A" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M33 7 Q36.8 3.8 39.6 6 Q36.6 9.6 33 7 Z" fill="#8BD46E" stroke="#5E9E4A" stroke-width=".8"/>`,
]

const EMBER: Palette = {
  light: '#5A4E62',
  mid: '#2B2431',
  deep: '#121015',
  ear: '#451620',
  inner: '#E8323E',
  cheek: '#B02A38',
  accent: '#FF3B3B',
  glow: '#FFB0A6',
  trim: '#FFB23E',
  ink: '#FF453A',
  rim: '#8E1F2A',
}

const GLARES = new Set<Mood>(['idle', 'busy', 'happy', 'proud', 'eating'])
const FANG = new Set<Mood>(['idle', 'busy', 'love', 'proud', 'bored'])
const BLAZING = new Set<Mood>(['busy', 'dizzy', 'happy', 'proud'])

const DRAGON: Kind = {
  word: 'dragon',
  ears: p =>
    `${mirror(`<path d="M20.6 18 Q12.4 13.4 13.4 2.8 Q18.6 9.4 27.4 13 Z" fill="${p.deep}" stroke="${p.rim}" stroke-width="1" stroke-linejoin="round"/><path d="M13.4 2.8 Q14.8 6.6 17.6 9.4 Q15 9.6 13.7 8.2 Q13.1 5.6 13.4 2.8 Z" fill="${p.inner}"/>`)}<path d="M29 12.9 Q30 9.4 32 7.2 Q34 9.4 35 12.9 Z" fill="${p.inner}" stroke="${p.rim}" stroke-width=".8" stroke-linejoin="round"/>`,
  tail: p =>
    `<path d="M49 45.5 Q61 47 60 37" stroke="${p.rim}" stroke-width="5.2" fill="none" stroke-linecap="round"/><path d="M49 45.5 Q61 47 60 37" stroke="${p.mid}" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M60 38.4 L55.6 34.2 L59.8 27.4 L64 34.2 Z" fill="${p.inner}" stroke="${p.rim}" stroke-width=".9" stroke-linejoin="round"/>`,
  wings: p =>
    mirror(
      `<g class="flap"><path d="M14.5 32 Q4 29 1.5 17 Q5.4 19.6 7.6 18 Q8.4 22.4 11.2 22.6 Q11 18.6 14.8 17.4 Z" fill="${p.ear}" stroke="${p.rim}" stroke-width="1" stroke-linejoin="round"/><path d="M13.6 30 Q7 26 4.4 19.6 M13.8 29 Q10.4 25.6 9.6 21.4" stroke="${p.inner}" stroke-width=".7" fill="none" opacity=".7"/></g>`,
    ),
  face: (p, mood) =>
    `<g stroke="${p.inner}" stroke-width="1" fill="none" opacity=".6" stroke-linecap="round"><path d="M26 44 Q32 45.4 38 44"/><path d="M26.6 46.8 Q32 48.2 37.4 46.8"/></g>${FANG.has(mood) ? '<path d="M29.4 37.6 l.9 2.1 l.9 -2.1 Z M32.8 37.6 l.9 2.1 l.9 -2.1 Z" fill="#fff"/>' : ''}`,
  aura: mood =>
    BLAZING.has(mood)
      ? '<circle class="float" cx="12" cy="22" r="1" fill="#FF5A36"/><circle class="float t2" cx="52" cy="20" r=".9" fill="#FFB23E"/><circle class="float slow" cx="46" cy="9" r=".7" fill="#FF5A36"/>'
      : '',
  defs: () => iris('#FFE7A0', '#FF5A2E', '#8A0F1C'),
  css: () => PUPIL_CSS,
  eyes: (p, mood) =>
    `${gaze(p, mood)}${GLARES.has(mood) ? `<path d="M18.2 23.4 H29.8 V29 L18.2 25.4 Z M45.8 23.4 H34.2 V29 L45.8 25.4 Z" fill="${p.mid}"/><path d="M18.2 25.4 L29.8 29 M45.8 25.4 L34.2 29" stroke="${p.ink}" stroke-width="1.3" stroke-linecap="round"/>` : ''}`,
  react: `${NEAR} .flap{animation:flap .14s ease-in-out infinite alternate}${NEAR} .rage{animation-duration:.5s}${NEAR} .pupil{animation:none;transform:scaleX(.55)}`,
}

const BOSS = 'AUDA'

type Leg = [from: number, to: number, x: number]
type Roam = { period: number; hop: number; legs: Leg[] }
type Quirk = { word: string; tempo: number; fidget: string; roam: Roam; lines: string[] }

const BOUNCY: Quirk = {
  word: 'bouncy',
  tempo: 0.8,
  fidget: '0%,78%,100%{transform:none}82%{transform:scale(1.1,.86)}88%{transform:translateY(-4.5px) scale(.93,1.09)}94%{transform:scale(1.07,.92)}',
  roam: { period: 20, hop: 4.6, legs: [[30, 40, 0.3], [48, 54, 0.8], [60, 68, 0.1], [80, 90, 1]] },
  lines: ['boing', 'can’t sit still', 'race you to the cursor'],
}
const SHY: Quirk = {
  word: 'shy',
  tempo: 1.15,
  fidget: '0%,60%,100%{transform:none}68%,88%{transform:translateX(-2.4px) rotate(-7deg)}',
  roam: { period: 30, hop: 1.8, legs: [[20, 30, 0], [84, 92, 1]] },
  lines: ['…hi', 'don’t look, I’m blushing', 'I’ll wait over here'],
}
const DROWSY: Quirk = {
  word: 'drowsy',
  tempo: 1.4,
  fidget: '0%,55%,100%{transform:none}85%{transform:translateY(1.6px) rotate(6deg)}89%{transform:translateY(-.6px) rotate(-2deg)}',
  roam: { period: 26, hop: 2.2, legs: [[34, 44, 0], [78, 88, 1]] },
  lines: ['yawn', 'resting my eyes', 'soft keyboard sounds…'],
}
const ZOOMY: Quirk = {
  word: 'zoomy',
  tempo: 0.65,
  fidget: '0%,80%,100%{transform:none}84%,92%{transform:translateX(-3px) skewX(6deg)}88%,96%{transform:translateX(3px) skewX(-6deg)}',
  roam: { period: 16, hop: 1.6, legs: [[40, 44, 0], [50, 54, 1], [60, 64, 0], [84, 88, 1]] },
  lines: ['zoom!', 'one more lap', 'too fast to debug'],
}
const NOSY: Quirk = {
  word: 'nosy',
  tempo: 1,
  fidget: '0%,58%,100%{transform:none}66%,76%{transform:rotate(9deg)}84%,92%{transform:rotate(-7deg)}',
  roam: { period: 24, hop: 2.2, legs: [[26, 32, 0.6], [40, 46, 0.2], [56, 62, 0.75], [70, 76, 0], [86, 94, 1]] },
  lines: ['what’s in that file?', 'ooh, a diff', 'sniff sniff'],
}
const SMUG: Quirk = {
  word: 'smug',
  tempo: 1.1,
  fidget: '0%,66%,100%{transform:none}74%,90%{transform:translateY(-1px) scale(1.07,1.05) rotate(-3deg)}',
  roam: { period: 28, hop: 2.2, legs: [[30, 36, 0.5], [46, 52, 0], [72, 82, 1]] },
  lines: ['I knew it would work', 'flawless, like me', 'you’re welcome'],
}
const QUIRKS = [BOUNCY, SHY, DROWSY, ZOOMY, NOSY, SMUG]

const FACES: ((p: Palette) => string)[] = [
  () => '',
  () => mirror(`<path d="M12.6 34.6 L18 35.6 M12.8 38.6 L18 38" stroke="${INK}" stroke-width=".7" stroke-linecap="round" opacity=".45"/>`),
  p => mirror(`<g fill="${p.inner}" opacity=".7"><circle cx="16.6" cy="33.6" r=".65"/><circle cx="19.2" cy="32.6" r=".65"/><circle cx="21.6" cy="33.8" r=".65"/></g>`),
  () => `<circle cx="45" cy="34.4" r=".85" fill="${INK}" opacity=".55"/>`,
]
const BUILDS = ['', '', 'matrix(1.07 0 0 1 -2.24 0)', 'matrix(.92 0 0 .92 2.56 4)']

const NAMES =['Mochi', 'Tofu', 'Bao', 'Yuzu', 'Nori', 'Miso', 'Kiwi', 'Pip', 'Dango', 'Boba', 'Udon', 'Momo', 'Kumo', 'Sumi', 'Natto', 'Ume']

type Rare = { badge: string; title: string; lines: Record<Mood, string[]>; tips: string[]; border: string; plate: string }

const BOSS_RARE: Rare = { badge: 'BOSS', title: 'final boss', lines: EVIL_LINES, tips: EVIL_TIPS, border: '#4A1418', plate: '#2A0C10' }

type Look = {
  name: string
  palette: Palette
  kind: Kind
  marks: string
  wear: string
  isEvil: boolean
  quirk: Quirk
  face: string
  build: string
  rare?: Rare
}

const AUDA: Look = { name: BOSS, palette: EMBER, kind: DRAGON, marks: '', wear: '', isEvil: true, quirk: SMUG, face: '', build: '', rare: BOSS_RARE }

const SLIT: Partial<Record<Mood, number>> = { busy: 0.9, worried: 1, bored: 1.7, proud: 2.1, sad: 2.4, happy: 2.8, eating: 2.8, love: 3.2, hungry: 3.2 }

const gaze = (p: Palette, mood: Mood) => {
  const glow = p.ink ?? INK
  if (mood === 'sleepy') return `<path d="M19.6 31 Q24 35 28.4 31 M35.6 31 Q40 35 44.4 31" stroke="${glow}" stroke-width="2" fill="none" stroke-linecap="round"/>`
  if (mood === 'dizzy') return `${SPIRAL(24)}${SPIRAL(40)}`.replaceAll(INK, glow)
  if (mood === 'oops') return EYES.oops.replaceAll(INK, glow)
  const rx = SLIT[mood] ?? 1.4
  const eye = (cx: number) =>
    `<ellipse cx="${cx}" cy="30.4" rx="4.7" ry="5.3" fill="url(#iris)" stroke="${p.deep}" stroke-width=".9"/><g class="look"><ellipse class="pupil" cx="${cx}" cy="30.6" rx="${rx}" ry="4.1" fill="#04060A"/><circle cx="${cx + 1.7}" cy="28" r="1.25" fill="#fff"/><circle cx="${cx - 1.5}" cy="32.8" r=".6" fill="#fff" opacity=".8"/></g>`
  const lid =
    mood === 'bored'
      ? `<path d="M18.6 29.4 Q24 23.4 29.4 29.4 Z M34.6 29.4 Q40 23.4 45.4 29.4 Z" fill="${p.mid}"/><path d="M18.8 29.4 H29.2 M34.8 29.4 H45.2" stroke="${p.deep}" stroke-width=".9" stroke-linecap="round"/>`
      : mood === 'sad'
        ? `<path d="M18.6 26 L27 23.6 M45.4 26 L37 23.6" stroke="${glow}" stroke-width="1.4" stroke-linecap="round"/>`
        : mood === 'worried'
          ? `<path d="M18.6 23.4 L27 25.4 M45.4 23.4 L37 25.4" stroke="${glow}" stroke-width="1.4" stroke-linecap="round"/>`
          : ''
  return `<g class="${mood === 'busy' ? 'glance' : 'blink'}">${eye(24)}${eye(40)}</g>${lid}`
}

const iris = (inner: string, mid: string, outer: string) =>
  `<radialGradient id="iris" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="${inner}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${outer}"/></radialGradient>`

const halo = () => `<ellipse cx="32" cy="35" rx="29" ry="21" fill="url(#rage)" opacity=".4"/>`

const PUPIL_CSS = '.pupil{animation:pupil 5.5s ease-in-out infinite;transform-box:fill-box;transform-origin:center;transition:transform .2s ease-out}@keyframes pupil{0%,70%,100%{transform:scaleX(1)}80%,90%{transform:scaleX(1.9)}}'

const NIGHT: Palette = {
  light: '#566070',
  mid: '#20252E',
  deep: '#0A0C11',
  ear: '#1A1E26',
  inner: '#7C8AA0',
  cheek: '#3A4454',
  accent: '#8CF04A',
  glow: '#DCFFBE',
  trim: '#8CF04A',
  ink: '#8CF04A',
  rim: '#3C4656',
}

const NIGHT_DRAGON: Kind = {
  word: 'night dragon',
  ears: p =>
    `${mirror(`<g class="twitch"><path d="M19 21 Q9.5 15.5 9 6.5 Q16.5 8.5 25.5 15.5 Z" fill="${p.ear}" stroke="${p.rim}" stroke-width="1" stroke-linejoin="round"/><path d="M12.4 9.6 Q16.6 12 20.6 16.4" stroke="${p.light}" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".7"/></g><path d="M25 13.6 Q24.4 8.6 27 6.4 Q29 9.4 29.6 12.4 Z" fill="${p.ear}" stroke="${p.rim}" stroke-width=".9" stroke-linejoin="round"/>`)}`,
  tail: p =>
    `<path d="M49 45.5 Q61 47 60 37" stroke="${p.rim}" stroke-width="5.2" fill="none" stroke-linecap="round"/><path d="M49 45.5 Q61 47 60 37" stroke="${p.mid}" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M60 38 Q55 33 59.6 27.6 Q64.6 33 60 38 Z" fill="${p.ear}" stroke="${p.rim}" stroke-width=".9" stroke-linejoin="round"/>`,
  wings: p =>
    mirror(
      `<g class="flap"><path d="M14.5 32 Q4 29 1.5 17 Q5.4 19.6 7.6 18 Q8.4 22.4 11.2 22.6 Q11 18.6 14.8 17.4 Z" fill="${p.ear}" stroke="${p.rim}" stroke-width="1" stroke-linejoin="round"/><path d="M13.6 30 Q7 26 4.4 19.6 M13.8 29 Q10.4 25.6 9.6 21.4" stroke="${p.light}" stroke-width=".7" fill="none" opacity=".6"/></g>`,
    ),
  face: p =>
    `<g fill="${p.light}" opacity=".5"><ellipse cx="32" cy="18.6" rx="1.7" ry="1"/><ellipse cx="28" cy="20.6" rx="1.4" ry=".9"/><ellipse cx="36" cy="20.6" rx="1.4" ry=".9"/><ellipse cx="32" cy="22.6" rx="1.2" ry=".8"/></g><circle cx="30.4" cy="35.6" r=".55" fill="${p.deep}"/><circle cx="33.6" cy="35.6" r=".55" fill="${p.deep}"/>`,
  back: halo,
  defs: () => iris('#E9FF9A', '#86E63C', '#1F7A2A'),
  css: () =>
    `${PUPIL_CSS}.twitch{animation:twitch 6.5s ease-in-out infinite;transform-origin:20px 20px}@keyframes twitch{0%,84%,100%{transform:rotate(0)}88%{transform:rotate(-9deg)}92%{transform:rotate(4deg)}}`,
  eyes: gaze,
  react: `${NEAR} .pupil{animation:none;transform:scaleX(2.3)}${NEAR} .twitch{animation:none;transform:rotate(-8deg)}`,
}

const SMOKE: Palette = {
  light: '#A3ABBE',
  mid: '#667085',
  deep: '#363C4B',
  ear: '#5A6377',
  inner: '#35E0D0',
  cheek: '#35E0D0',
  accent: '#35E0D0',
  glow: '#CFFFF9',
  trim: '#35E0D0',
  ink: '#35E0D0',
  rim: '#262B37',
}

const GRINS = new Set<Mood>(['idle', 'busy', 'dizzy', 'happy', 'proud', 'love', 'eating', 'bored'])

const GRIN_CAT: Kind = {
  word: 'grinning cat',
  ears: p =>
    mirror(
      `<path d="M16.5 21 Q12 8 15.6 6 Q19.6 5.4 28.6 14.6 Z" fill="${p.ear}" stroke="${p.rim}" stroke-width="1" stroke-linejoin="round"/><path d="M17.4 9.6 Q17.8 8 19.4 8.8 L24.4 13.6 L19.4 16.6 Z" fill="${p.inner}" opacity=".8"/>`,
    ),
  tail: p =>
    `<path d="M50 45 Q61 44 59.6 33 Q59 27.6 54.4 29" stroke="${p.rim}" stroke-width="5.6" fill="none" stroke-linecap="round"/><path d="M50 45 Q61 44 59.6 33 Q59 27.6 54.4 29" stroke="${p.ear}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M50 45 Q61 44 59.6 33 Q59 27.6 54.4 29" stroke="${p.inner}" stroke-width="4" fill="none" stroke-dasharray="2.2 3.6" stroke-dashoffset="-2"/>`,
  back: halo,
  defs: () => iris('#E4FFFB', '#35E0D0', '#0E7F86'),
  css: () => PUPIL_CSS,
  eyes: gaze,
  mouth: (p, mood) =>
    GRINS.has(mood)
      ? `<g class="grin"><g class="${mood === 'eating' ? 'chew' : ''}"><path d="M20.4 36.6 Q32 47.4 43.6 36.6 Q32 40.6 20.4 36.6 Z" fill="#F4FFFD" stroke="${p.deep}" stroke-width=".9" stroke-linejoin="round"/><path d="M24.6 38.3 V40.5 M28.2 39.3 V42.5 M32 39.6 V43.4 M35.8 39.3 V42.5 M39.4 38.3 V40.5" stroke="${p.deep}" stroke-width=".7"/><path d="M19.4 35.6 Q20 37 21.6 37.2 M44.6 35.6 Q44 37 42.4 37.2" stroke="${p.deep}" stroke-width=".9" fill="none" stroke-linecap="round"/></g></g>`
      : undefined,
  drifts: { idle: GONE, bored: GONE, sleepy: GONE },
  react: `.grin{transform-box:fill-box;transform-origin:center;transition:transform .2s cubic-bezier(.3,1.8,.5,1)}${NEAR} .grin{transform:scale(1.12)}`,
}

const STRIPES = (p: Palette) =>
  `<g stroke="${p.inner}" stroke-width="1.7" fill="none" stroke-linecap="round" opacity=".85"><path d="M28.4 13.6 L29.4 18.4 M32 12.8 V18.6 M35.6 13.6 L34.6 18.4"/><path d="M12.6 31 Q15.6 31.6 17.4 33.4 M12 36 Q15 36 16.8 37.6 M51.4 31 Q48.4 31.6 46.6 33.4 M52 36 Q49 36 47.2 37.6"/></g>`

const quiet = (lines: Partial<Record<Mood, string[]>>): Record<Mood, string[]> => ({ ...LINES, ...lines })

const NYX: Look = {
  name: 'NYX',
  palette: NIGHT,
  kind: NIGHT_DRAGON,
  marks: '',
  wear: '',
  isEvil: false,
  quirk: NOSY,
  face: '',
  build: '',
  rare: {
    badge: 'RARE',
    title: 'night dragon',
    border: '#24401A',
    plate: '#0F1F0B',
    tips: TIPS,
    lines: quiet({
      idle: ['{name} is watching', 'quiet as night', 'eyes on your code', 'chirp?'],
      busy: ['tracking it…', 'pupils narrowed', 'on the hunt', 'gliding through'],
      dizzy: ['too many tools!', 'barrel roll…', 'whoa, turbulence', 'spinning out'],
      happy: ['happy tail thump', 'good flight', 'landed it', 'purr-growl'],
      proud: ['wings out, chin up', 'we soar', 'best flight yet', 'streak in the sky'],
      love: ['big eyes ♥', 'scratch the chin', 'rolls over', 'more, please'],
      eating: ['fish? nom', 'gulp', 'crunch', 'saved you half'],
      hungry: ['pupils huge… fish?', 'tummy growl', 'feed the dragon', 'so empty'],
      sleepy: ['curled up, zzz', 'tail over nose', 'dreaming of clouds', 'zzz…'],
    }),
  },
}

const WISP: Look = {
  name: 'WISP',
  palette: SMOKE,
  kind: GRIN_CAT,
  marks: STRIPES(SMOKE),
  wear: '',
  isEvil: false,
  quirk: SHY,
  face: '',
  build: '',
  rare: {
    badge: 'RARE',
    title: 'grinning cat',
    border: '#12403D',
    plate: '#08201F',
    tips: TIPS,
    lines: quiet({
      idle: ['{name} grins at you', 'now you see me', 'which way? any way', 'just a grin, really'],
      busy: ['curiouser…', 'watching it unfold', 'grinning at the logs', 'oh, this is good'],
      dizzy: ['we’re all mad here', 'round and round', 'delightful chaos', 'tools, tools, tools'],
      happy: ['told you so', 'grin widens', 'splendid', 'that’ll do nicely'],
      proud: ['a grin without a bug', 'quite the streak', 'smugly yours', 'purrfectly done'],
      love: ['purrrr', 'behind the ears', 'don’t stop', 'grin, grin ♥'],
      bored: ['fading out…', 'only the grin stays', 'half here', 'wake me, or don’t'],
      sleepy: ['gone but the grin', 'zzz…', 'vanishing nap', 'dreaming sideways'],
    }),
  },
}

const lookOf = (n: number): Look => {
  const guest = NEW_KINDS[Math.floor(n / 2 ** 32) - 1]
  let rest = n >>> 0
  const take = <T,>(list: T[]) => {
    const picked = list[rest % list.length] as T
    rest = Math.floor(rest / list.length)
    return picked
  }
  const palette = take(PALETTES)
  const kind = take(KINDS)
  const marks = take(MARKS)(palette)
  const wear = take(WEAR)(palette)
  const name = take(NAMES)
  if (rest % 8 === EVIL) return AUDA
  if (rest % 64 === NIGHT_AT) return NYX
  if (rest % 64 === GRIN_AT) return WISP
  const trait = hashOf(`trait:${n >>> 0}`)
  return {
    name,
    palette,
    kind: guest ?? kind,
    marks,
    wear,
    isEvil: false,
    quirk: QUIRKS[trait % QUIRKS.length] ?? NOSY,
    face: (FACES[(trait >>> 4) % FACES.length] ?? FACES[0])?.(palette) ?? '',
    build: BUILDS[(trait >>> 8) % BUILDS.length] ?? '',
  }
}

type Slot = 'boss' | 'night' | 'grin'
const RARES: [Slot, Look][] = [
  ['boss', AUDA],
  ['boss', AUDA],
  ['night', NYX],
  ['grin', WISP],
]

const rollRare = (dry: number, current: Look) => {
  if (Math.random() >= Math.min(1, 0.16 + dry * 0.14)) return undefined
  const pool = RARES.filter(([, look]) => !isSameLook(look, current))
  return pool[Math.floor(Math.random() * pool.length)]?.[0]
}

const visitOf = (t: number, born: number, key: string, current: Look) => {
  if (!born || t - born < SETTLE_MS || t % VISIT_EVERY_MS >= VISIT_MS) return undefined
  const roll = hashOf(`${key}:${Math.floor(t / VISIT_EVERY_MS)}`)
  if (roll % 4 !== 0) return undefined
  const pool = RARES.filter(([, look]) => !isSameLook(look, current))
  return pool[(roll >>> 8) % pool.length]
}

const VISIT_LINES = ['just visiting', 'nice place, {home}', 'press keep and I stay', 'only passing through']

const kindOf = (look: Look) => look.rare?.title ?? `${look.quirk.word} ${look.kind.word}`

const LOOKS = PALETTES.length * KINDS.length * MARKS.length * WEAR.length * NAMES.length
const EVIL = 7
const NIGHT_AT = 3
const GRIN_AT = 5
const SLOTS: Record<Slot, readonly [number, number]> = { boss: [8, EVIL], night: [64, NIGHT_AT], grin: [64, GRIN_AT] }
const SUMMON = new Map<string, Slot>([
  ['boss', 'boss'],
  ['evil', 'boss'],
  ['night', 'night'],
  ['grin', 'grin'],
])

const isSameLook = (a: Look, b: Look) =>
  a.name === b.name && a.kind === b.kind && a.palette === b.palette && a.marks === b.marks && a.wear === b.wear

const randomSeed = (rare?: Slot) => {
  const low = Math.floor(Math.random() * LOOKS)
  const high = Math.floor(Math.random() * 64)
  const kin = Math.random() < 0.45 ? 2 ** 32 * (1 + Math.floor(Math.random() * NEW_KINDS.length)) : 0
  if (!rare) return kin + (low + LOOKS * high || 1)
  const [every, at] = SLOTS[rare]
  return low + LOOKS * (at + every * (high % 8))
}

const hashOf = (text: string) => {
  let h = 0x811c9dc5
  for (const ch of text) h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 0x01000193)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

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

const shimmerLines = (verbs: string[], y: number, width: number, glow: string) => {
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
    defs: `<linearGradient id="sh" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="44" y2="0"><stop offset="0" stop-color="#8E8E96"/><stop offset=".42" stop-color="#8E8E96"/><stop offset=".5" stop-color="${glow}"/><stop offset=".58" stop-color="#8E8E96"/><stop offset="1" stop-color="#8E8E96"/><animateTransform attributeName="gradientTransform" type="translate" from="-44 0" to="${width} 0" dur="1.7s" repeatCount="indefinite"/></linearGradient><style>${keys}@media (prefers-reduced-motion:reduce){.v{animation:none!important;opacity:0}.v0{opacity:1}}</style>`,
    texts,
  }
}

type Skin = { fill: string; edge: string; text: string; dim: string; off: string }

const SKINS: Record<string, Skin> = {
  black: { fill: '#000000', edge: '#232327', text: '#F2F2F2', dim: '#77777D', off: '#1F1F23' },
  slate: { fill: '#11151C', edge: '#2A3140', text: '#EEF2F8', dim: '#7C8698', off: '#232A36' },
  plum: { fill: '#170F22', edge: '#372650', text: '#F4EEFB', dim: '#8C7BA6', off: '#2A1D3D' },
  forest: { fill: '#0B1710', edge: '#1F3A29', text: '#ECF7EF', dim: '#73907C', off: '#18291E' },
  ocean: { fill: '#07161F', edge: '#17384B', text: '#EAF5FB', dim: '#6F8D9E', off: '#12293A' },
  ember: { fill: '#1C0D0A', edge: '#46211A', text: '#FBEFEA', dim: '#A07F74', off: '#321812' },
}
const SKIN_NAMES = Object.keys(SKINS)
const BLACK = SKINS.black as Skin
const skinOf = (name: string) => SKINS[name] ?? BLACK

type Say = { line?: string; verbs?: string[]; stars: number; level: number; share: number; fullness: number; look: Look; skin: Skin }

const bubble = ({ line, verbs, stars: reborn, level, share, fullness, look, skin }: Say) => {
  const { accent, glow } = look.palette
  const label = `${look.name.toUpperCase()}${'★'.repeat(Math.min(reborn, 3))}`
  const levelX = Math.round(20 + label.length * 5.8)
  const longest = verbs ? Math.max(...verbs.map(v => v.length + 1)) : (line ?? '').length
  const badgeX = levelX + `LV${level}`.length * 5.5 + 4
  const width = Math.ceil(Math.max(22 + Math.max(longest, 5) * 5.4, look.rare ? badgeX + 25 + 40 : 112))
  const badge = look.rare
    ? `<rect x="${badgeX}" y="7.4" width="25" height="9.2" rx="2.2" fill="${look.rare.plate}" stroke="${accent}" stroke-width=".6"/><text x="${badgeX + 3.4}" y="14.4" font-size="6" font-weight="700" letter-spacing="1" fill="${glow}">${look.rare.badge}</text>`
    : ''
  const pips = Array.from({ length: 5 }, (_, i) => {
    const isLit = fullness > i * 20 + 4
    return `<rect x="${width - 9 - (5 - i) * 4.6 + 1}" y="9" width="3.4" height="3.4" rx=".8" fill="${isLit ? accent : skin.off}"/>`
  }).join('')
  const track = width - 24
  const xp = `<rect x="14" y="33.6" width="${track}" height="1.6" rx=".8" fill="${skin.off}"/><rect x="14" y="33.6" width="${(track * Math.max(0.04, Math.min(1, share))).toFixed(1)}" height="1.6" rx=".8" fill="${accent}"/>`
  const body = verbs ? shimmerLines(verbs, 28.5, width, glow) : null
  return {
    width,
    defs: body?.defs ?? '',
    body: `<g font-family="${MONO}"><path d="M11.5 .5 H${width - 7.5} a7 7 0 0 1 7 7 V32.5 a7 7 0 0 1 -7 7 H11.5 a7 7 0 0 1 -7 -7 V24 L.5 20 L4.5 16 V7.5 a7 7 0 0 1 7 -7 Z" fill="${skin.fill}" stroke="${look.rare?.border ?? skin.edge}"/><text x="14" y="15" font-size="7.5" letter-spacing="1.3" fill="${accent}">${label}</text><text x="${levelX}" y="15" font-size="7.5" letter-spacing="1" fill="${skin.dim}">LV${level}</text>${badge}${pips}${body ? body.texts : `<text x="14" y="28.5" font-size="9" fill="${skin.text}">${escape(line ?? '')}</text>`}${xp}</g>`,
  }
}

const TRACKED = new Set<Mood>(['idle', 'busy', 'happy', 'proud', 'sad', 'love', 'eating', 'hungry', 'bored', 'worried'])
const NUZZLES = new Set<Mood>(['idle', 'busy', 'sad', 'hungry', 'bored', 'worried'])
const HEART = (x: number, y: number, s: number, color: string) =>
  `<path d="M${x} ${y} l${-3 * s} ${-3 * s} a${1.8 * s} ${1.8 * s} 0 0 1 ${3 * s} ${-2 * s} a${1.8 * s} ${1.8 * s} 0 0 1 ${3 * s} ${2 * s}z" fill="${color}"/>`

const pet = (mood: Mood, { palette: p, kind, marks, wear, isEvil, quirk, face, build }: Look, whim = 0, stage = GROWN) => {
  const grow = STAGES[stage]?.scale ?? 1
  const isElder = stage > GROWN
  const isFrantic = mood === 'busy' || mood === 'dizzy'
  const isCalm = mood === 'sleepy' || mood === 'bored'
  const isLeaping = mood === 'happy' || mood === 'love' || mood === 'proud'
  const tick = isFrantic ? (isEvil ? 0.5 : 0.9) : isCalm ? 3.6 : isLeaping || mood === 'eating' ? 0.7 : 2.4
  const speed = `${(tick * quirk.tempo).toFixed(2)}s`
  const lift = isLeaping || (isEvil && isFrantic) ? -4 : mood === 'sleepy' || mood === 'sad' ? -0.6 : -1.6
  const flap = isCalm ? '' : isFrantic ? '.16s' : tick === 0.7 ? '.24s' : '.5s'
  const isFidgety = mood === 'idle' || mood === 'bored'
  const ink = p.ink ?? INK
  const wrap = mood === 'worried' || mood === 'oops' ? 'shake' : mood === 'dizzy' ? 'wobble' : isFidgety ? 'fid' : ''
  const mouth = MOUTH[mood]
  const isTracked = TRACKED.has(mood)
  const eyes = kind.eyes?.(p, mood) ?? `<g class="look">${EYES[mood].replaceAll(INK, ink)}</g>`
  const squint = kind.eyes
    ? `<path d="M19.6 32 Q24 26.6 28.4 32 M35.6 32 Q40 26.6 44.4 32" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`
    : ARCS.replaceAll(INK, ink)
  const nuzzle = NUZZLES.has(mood) ? `<g class="nz">${squint}</g>` : ''
  const pace = { ...DRIFTS, ...kind.drifts }[mood]
  const drift = pace && whim > 0 && whim % 100 < pace.chance ? pace : undefined
  const spirit = drift && !kind.eyes ? `<g class="spirit"><g class="look">${EYES[mood].replaceAll(INK, p.accent)}</g></g>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" class="pet" viewBox="0 0 64 56" width="46" height="40">
<defs>
<radialGradient id="body" cx="40%" cy="32%" r="75%"><stop offset="0" stop-color="${p.light}"/><stop offset=".55" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.deep}"/></radialGradient>
<radialGradient id="rage"><stop offset="0" stop-color="${p.accent}" stop-opacity=".55"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/></radialGradient>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
${kind.defs?.(p) ?? ''}
<style>
.bob{animation:bob ${speed} ease-in-out infinite;transform-origin:32px 50px}
.wag{animation:wag ${speed} ease-in-out infinite;transform-origin:50px 45px}
.flap{animation:${flap ? `flap ${flap} ease-in-out infinite alternate` : 'none'};transform-origin:14px 30px}
.shadow{animation:shadow ${speed} ease-in-out infinite;transform-origin:32px 52px}
.rage{animation:rage ${speed} ease-in-out infinite;transform-origin:32px 36px}
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
.flick{animation:flick ${(6.5 * quirk.tempo).toFixed(1)}s ease-in-out infinite;transform-origin:32px 22px}
@keyframes flick{0%,90%,100%{transform:none}93%{transform:rotate(-4deg) translateY(-.8px)}96%{transform:rotate(3deg)}}
${isFidgety ? `.fid{animation:fid ${(9 * quirk.tempo).toFixed(1)}s ease-in-out infinite;transform-origin:32px 50px}@keyframes fid{${quirk.fidget}}` : ''}
@keyframes kick{from{transform:none}to{transform:translateY(-1.8px)}}
@keyframes dangle{from{transform:scale(.95,1.07) rotate(-5deg)}to{transform:scale(.95,1.07) rotate(5deg)}}
@keyframes wag{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
@keyframes flap{from{transform:rotate(14deg)}to{transform:rotate(-16deg)}}
@keyframes rage{0%,100%{transform:scale(.9);opacity:${mood === 'sleepy' ? '.2' : '.5'}}50%{transform:scale(1.06);opacity:${mood === 'sleepy' ? '.3' : '.9'}}}
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
${kind.css?.(mood) ?? ''}
${drift ? driftCss(drift, whim, p.accent) : mood === 'sleepy' && whim > 0 ? DOZE : ''}
.spirit{opacity:0}
.lean{transform:rotate(var(--tilt,0deg));transform-origin:32px 50px;transition:transform .3s cubic-bezier(.3,1.5,.5,1)}
.squash{transform-origin:32px 50px;transition:transform .45s cubic-bezier(.2,2.2,.4,1)}
.ears,.swish{transition:transform .25s cubic-bezier(.3,1.8,.5,1)}
.swish{transform-origin:50px 45px}
.cheek,.eyes,.nz{transition:opacity .14s}
.nz{opacity:0}
.tap{opacity:0;transform:translateY(-12px);transition:opacity .9s ease-in .2s,transform 1.1s ease-out}
${isTracked ? '.look{transform:translate(var(--lx,0px),var(--ly,0px));transition:transform .16s ease-out}' : ''}
${NEAR} .ears{transform:translateY(-1.3px)}
${NEAR} .swish{transform:rotate(-12deg)}
${NEAR} .cheek{opacity:.9}
${NEAR} :is(.veil,.dusk,.spirit,.lip){animation:none}
${nuzzle ? `${ON_FACE} .nz{opacity:1}${ON_FACE} .eyes{opacity:0}` : ''}
.walk:active .squash{transform-origin:32px 12px;animation:dangle .45s ease-in-out infinite alternate}
.walk:active .f1{animation:kick .22s ease-in-out infinite alternate}
.walk:active .f2{animation:kick .22s ease-in-out -.22s infinite alternate}
.walk:active .tap{opacity:1;transform:none;transition-duration:.05s;transition-delay:0s}
${kind.react ?? ''}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</defs>
${isEvil || isElder ? '<ellipse class="rage" cx="32" cy="36" rx="30" ry="22" fill="url(#rage)"/>' : ''}
${isElder ? STAR(7, 8, 0.6, p.accent, 'twinkle t2') : ''}
${kind.back?.(p) ?? ''}
<g class="dusk"><ellipse class="shadow" cx="32" cy="52" rx="17" ry="2.6" fill="${INK}"/></g>
<g${grow < 1 ? ` transform="matrix(${grow} 0 0 ${grow} ${+(32 * (1 - grow)).toFixed(2)} ${+(50 * (1 - grow)).toFixed(2)})"` : ''}><g${build ? ` transform="${build}"` : ''}><g class="bob"><g class="lean"><g class="squash"><g class="${wrap}">
<g class="veil">
${kind.wings?.(p) ?? ''}
<g class="swish"><g class="wag">${kind.tail(p)}</g></g>
<g class="ears"><g class="flick">${kind.ears(p)}</g></g>
<path d="M11 39 C11 22 21 12 32 12 C43 12 53 22 53 39 C53 47 46 50.5 32 50.5 C18 50.5 11 47 11 39 Z" fill="url(#body)" stroke="${p.rim ?? 'rgba(43,33,64,.28)'}" stroke-width="1.1"/>
<ellipse cx="32" cy="43.6" rx="9.5" ry="5.2" fill="${p.ink ? p.inner : '#fff'}" opacity="${p.ink ? '.22' : '.3'}"/>
<ellipse cx="23" cy="20" rx="5" ry="2.6" fill="#fff" opacity="${p.ink ? '.4' : '.7'}" transform="rotate(-24 23 20)"/>
${marks}
${mirror(`<ellipse class="cheek" cx="19.5" cy="37" rx="3.6" ry="2.1" fill="${p.cheek}" opacity="${mood === 'sad' || mood === 'hungry' ? '.3' : '.55'}"/>`)}
<ellipse class="foot f1" cx="24.5" cy="49.8" rx="4.4" ry="2.3" fill="${p.ear}" ${EDGE}/><ellipse class="foot f2" cx="39.5" cy="49.8" rx="4.4" ry="2.3" fill="${p.ear}" ${EDGE}/>
${wear}
${face}
${kind.face?.(p, mood) ?? ''}
</g>
<g${p.ink ? ' filter="url(#glow)"' : ''}><g class="eyes">${eyes}${spirit}</g>${nuzzle}</g>
${kind.mouth?.(p, mood) ?? `<path class="${mouth.cls ?? 'lip'}" d="${mouth.d}" stroke="${ink}" stroke-width="1.4" fill="${mouth.fill ?? 'none'}" stroke-linecap="round" stroke-linejoin="round"/>`}
</g></g></g></g></g></g>
${EXTRA[mood]}
${kind.aura?.(mood) ?? ''}
<g class="tap">${HEART(13, 15, 1, p.ink ?? '#FF6FA5')}${HEART(52, 11, 0.8, p.ink ? p.trim : '#FF9EC4')}${HEART(33, 7, 0.6, p.ink ?? '#FF6FA5')}</g>
</svg>`
}

const PET_W = 46
const COL_W = 12
const REACH = 22
const COLS = [-REACH, -2, 15, 31, 48, PET_W + REACH]
const ROWS = [0, 13, 29, 40]
const ROAMS = new Set<Mood>(['idle', 'bored', 'hungry', 'happy', 'proud'])

const zones = () => {
  const rects: string[] = []
  const rules: string[] = []
  for (let r = 0; r < ROWS.length - 1; r++) {
    for (let c = 0; c < COLS.length - 1; c++) {
      const isFace = r === 1 && c === 2
      const x = COLS[c] ?? 0
      const y = ROWS[r] ?? 0
      rects.push(`<rect class="z${isFace ? ' zc' : ''} z${r}${c}" x="${x}" y="${y}" width="${(COLS[c + 1] ?? 0) - x}" height="${(ROWS[r + 1] ?? 0) - y}"/>`)
      if (!isFace) rules.push(`.z${r}${c}:hover~.pet{--lx:${((c - 2) * 0.9).toFixed(1)}px;--ly:${((r - 1) * 0.9).toFixed(1)}px;--tilt:${(c - 2) * 2.5}deg}`)
    }
  }
  return { rects: rects.join(''), rules: rules.join('') }
}

const ZONES = zones()

const pct = (n: number) => `${+n.toFixed(2)}%`

const roamCss = ({ period, hop, legs }: Roam) => {
  const at = (x: number) => `transform:translateX(${+(x * YARD).toFixed(1)}px)`
  const walk = [`0%,100%{${at(1)}}`]
  const hops = ['0%,100%{transform:none}']
  const left = ['0%,100%{transform:none}']
  const right = ['0%,100%{transform:none}']
  let x = 1
  for (const [from, to, target] of legs) {
    const heading = target < x ? -1 : 1
    const steps = Math.max(2, Math.round((Math.abs(target - x) * YARD) / 6))
    const span = (to - from) / steps
    const lands = Array.from({ length: steps + 1 }, (_, i) => pct(from + i * span)).join(',')
    const peaks = Array.from({ length: steps }, (_, i) => pct(from + (i + 0.5) * span))
    walk.push(`${pct(from)}{${at(x)}}${pct(to)}{${at(target)}}`)
    hops.push(`${lands}{transform:none}${peaks.join(',')}{transform:translateY(${-hop}px) rotate(${heading * 3}deg)}`)
    left.push(`${lands}{transform:none}${peaks.filter((_, i) => i % 2 === 0).join(',')}{transform:translateY(-1.8px)}`)
    right.push(`${lands}{transform:none}${peaks.filter((_, i) => i % 2 === 1).join(',')}{transform:translateY(-1.8px)}`)
    x = target
  }
  const run = (name: string, ease: string) => `animation:${name} ${period}s ${ease} infinite`
  return `.walk{${run('stroll', 'ease-in-out')}}.hop{${run('hop', 'linear')};transform-origin:${PET_W / 2}px 38px}.f1{${run('stepl', 'linear')}}.f2{${run('stepr', 'linear')}}.walk:hover,.walk:hover :is(.hop,.foot){animation-play-state:paused}@keyframes stroll{${walk.join('')}}@keyframes hop{${hops.join('')}}@keyframes stepl{${left.join('')}}@keyframes stepr{${right.join('')}}`
}

const scene = (mood: Mood, look: Look, say: ReturnType<typeof bubble>, whim: number, stage: number) => {
  const width = YARD + PET_W + say.width
  const cols = Array.from({ length: Math.ceil(width / COL_W) }, (_, i) => i)
  const carried = cols.map(i => `.c:active.c${i}:hover .carry:not(:has(.z:hover)){transform:translateX(${i * COL_W + COL_W / 2 - YARD - PET_W / 2}px)}`).join('')
  const lanes = cols.map(i => `<g class="c c${i}"><rect class="cr" x="${i * COL_W}" y="0" width="${COL_W}" height="40"/>`).join('')
  return {
    width,
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 40" width="${width}" height="40"><defs>${say.defs}<style>.z{fill:transparent;pointer-events:all;cursor:grab}.cr{fill:transparent;pointer-events:none}.pet,.say{pointer-events:none}.walk{transform:translateX(${YARD}px)}.carry{transition:transform .9s cubic-bezier(.5,0,.3,1.3) 1.6s}.c:active .cr{pointer-events:all;cursor:grabbing}.c:active .z{pointer-events:none}.c:active .carry{transition:transform .12s ease-out}.c:active :is(.walk,.hop){animation:none}${carried}${ZONES.rules}${ROAMS.has(mood) ? roamCss(look.quirk.roam) : ''}@media (prefers-reduced-motion:reduce){.walk,.hop,.foot{animation:none!important}}</style></defs><g class="say" transform="translate(${YARD + PET_W} 0)">${say.body}</g>${lanes}<g class="carry"><g class="walk"><g class="hop">${ZONES.rects}${pet(mood, look, whim, stage)}</g></g></g>${'</g>'.repeat(cols.length)}</svg>`,
  }
}

const KEYFRAMES = /@keyframes ([\w-]+)\{(?:[^{}]*\{[^{}]*\})*\}/g

// The app inlines every Svg into one document, where ids, class rules and keyframes are shared by all of them.
const scoped = (source: string) => {
  const tag = hashOf(source).toString(36)
  const moves = new Set<string>()
  return source
    .replace('<svg ', `<svg class="s${tag}" `)
    .replace(/<style>([\s\S]*?)<\/style>/g, (_, css: string) => {
      const frames = css.match(KEYFRAMES) ?? []
      for (const [, name = ''] of css.matchAll(KEYFRAMES)) moves.add(name)
      return `<style>${frames.join('')}.s${tag}{${css.replace(KEYFRAMES, '')}}</style>`
    })
    .replace(/(@keyframes |animation:)([\w-]+)/g, (all, lead: string, name: string) => (moves.has(name) ? `${lead}${name}-${tag}` : all))
    .replace(/ id="([\w-]+)"/g, ` id="$1-${tag}"`)
    .replace(/url\(#([\w-]+)\)/g, `url(#$1-${tag})`)
}

type Sheet = { look: Look; turnCount: number; petCount: number; spent: number; stars: number; full: number; streak: number; skin: Skin }

const STATS = /level \d+ · (\d+) turns seen · (\d+) pets · (\d+)% full · streak (\d+)$/

const card = ({ look, turnCount, petCount, spent, stars: reborn, full, streak: run, skin }: Sheet) => {
  const { accent, glow } = look.palette
  const { level, xp, span, share, heartsToXp } = progressOf(turnCount, petCount, spent)
  const name = `${look.name.toUpperCase()}${'★'.repeat(Math.min(reborn, 3))}`
  const portrait = pet(full < 20 ? 'hungry' : 'idle', look, 0, stageOf(level)).replace('width="46" height="40"', 'x="12" y="10" width="92" height="80"')
  const tiles = [
    ['TURNS', String(turnCount)],
    ['HEARTS', String(petCount)],
    ['STREAK', String(run)],
    ['FULL', `${full}%`],
  ]
    .map(
      ([label, value], i) =>
        `<g transform="translate(${118 + i * 58} 62)"><rect width="52" height="28" rx="5" fill="${skin.off}"/><text x="7" y="10.5" font-size="6" letter-spacing="1.1" fill="${skin.dim}">${label}</text><text x="7" y="22.5" font-size="11" font-weight="600" fill="${skin.text}">${value}</text></g>`,
    )
    .join('')
  const badge = look.rare
    ? `<rect x="${124 + name.length * 9.6}" y="11" width="30" height="11" rx="2.6" fill="${look.rare.plate}" stroke="${accent}" stroke-width=".6"/><text x="${128.4 + name.length * 9.6}" y="19.2" font-size="7" font-weight="700" letter-spacing="1.1" fill="${glow}">${look.rare.badge}</text>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 364 100" width="364" height="100"><rect x=".5" y=".5" width="363" height="99" rx="10" fill="${skin.fill}" stroke="${look.rare?.border ?? skin.edge}"/><rect x="8" y="8" width="100" height="84" rx="7" fill="${skin.off}" opacity=".55"/>${portrait}<g font-family="${MONO}"><text x="118" y="21" font-size="13" font-weight="700" letter-spacing="2" fill="${accent}">${name}</text>${badge}<text x="346" y="21" font-size="13" font-weight="700" text-anchor="end" fill="${skin.text}">LV ${level}</text><text x="118" y="33" font-size="7.5" letter-spacing=".6" fill="${skin.dim}">${escape(`${STAGES[stageOf(level)]?.word ?? ''} ${kindOf(look)}`)}</text><rect x="118" y="40" width="228" height="5" rx="2.5" fill="${skin.off}"/><rect x="118" y="40" width="${(228 * Math.max(0.03, share)).toFixed(1)}" height="5" rx="2.5" fill="${accent}"/><text x="118" y="55" font-size="7" fill="${skin.dim}">${xp}/${span} xp to level ${level + 1}</text><text x="346" y="55" font-size="7" text-anchor="end" fill="${skin.dim}">${heartsToXp} ♥ to next xp</text>${tiles}</g></svg>`
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

const causeOf = (limits: readonly SessionRateLimit[], contextPercent: number | undefined) => {
  const worst = [...limits].sort((a, b) => b.percentUsed - a.percentUsed)[0]
  if (worst && worst.percentUsed >= 85) return `${worst.kind === 'five_hour' ? '5h' : 'weekly'} limit ${Math.round(worst.percentUsed)}% used`
  return (contextPercent ?? 0) >= 85 ? `context ${Math.round(contextPercent ?? 0)}% full` : ''
}

const cheerLevel = ($: EngineInterface, look: Look, before: number, after: number) => {
  if (after <= before) return
  const stage = STAGES[stageOf(after)]
  if (stageOf(after) > stageOf(before) && stage) $.ui.toast(`${look.name} evolved into ${stage.word === 'elder' ? 'an' : 'a'} ${stage.word} ${look.kind.word} ✦`)
  else $.ui.toast(look.isEvil ? `${BOSS} grows stronger · level ${after} ✦` : `${look.name} reached level ${after} ✦`)
}

const swap = async ($: EngineInterface, rare?: Slot) => {
  const current = lookOf(await read($, seed))
  const dry = rare ? 0 : await kept($, 'dry')
  const pick = rare ?? rollRare(dry, current)
  let fresh = randomSeed(pick)
  if (rare && isSameLook(lookOf(fresh), current)) return current.isEvil ? `${BOSS} already rules this project.` : `${current.name} is already here.`
  while (isSameLook(lookOf(fresh), current) || (!pick && lookOf(fresh).rare)) fresh = randomSeed(pick)
  await update($, seed, () => fresh)
  await $.store.set(await read($, project), fresh)
  if (!rare) await $.store.set('dry', pick ? 0 : dry + 1)
  await update($, isHidden, () => false)
  await $.store.set('hidden', false)
  const look = lookOf(fresh)
  if (look.isEvil) return `${BOSS}, the final boss, now rules this project.`
  return look.rare ? `${look.name}, the ${look.rare.title}, has moved in.` : `Meet ${look.name}, this project’s new ${look.kind.word}.`
}

const reskin = async ($: EngineInterface, pick?: string) => {
  const chosen = pick ?? SKIN_NAMES[(SKIN_NAMES.indexOf(await read($, theme)) + 1) % SKIN_NAMES.length] ?? 'black'
  if (!(chosen in SKINS)) return `No theme called ${pick}. Try ${SKIN_NAMES.join(', ')}.`
  await update($, theme, () => chosen)
  await $.store.set('theme', chosen)
  return `Bubble theme: ${chosen}. Others: ${SKIN_NAMES.filter(n => n !== chosen).join(', ')}.`
}

const hide = async ($: EngineInterface, hidden: boolean) => {
  await update($, isHidden, () => hidden)
  await $.store.set('hidden', hidden)
  return hidden ? 'Pet hidden. /mochi hide brings it back.' : 'Pet shown.'
}

const titleOf = (look: Look) => (look.rare ? `${look.name} · ${look.rare.title}` : look.name)

const stored = async ($: EngineInterface, key: string) => Number(await $.store.get(key)) || 0

const kept = async ($: EngineInterface, key: string) => {
  try {
    return await stored($, key)
  } catch {
    // A band that cannot reach the store still draws, from the session's own counts.
    return 0
  }
}

const sync = async ($: EngineInterface) => {
  const storedPets = await stored($, 'pets')
  await update($, pets, n => Math.max(n, storedPets))
  const storedTurns = await stored($, 'turns')
  await update($, turns, n => Math.max(n, storedTurns))
  const storedFed = await stored($, 'fedAt')
  await update($, fedAt, n => Math.max(n, storedFed) || Date.now() - FULL_MS / 2)
  const hidden = (await $.store.get('hidden')) === true
  await update($, isHidden, () => hidden)
  const skin = await $.store.get('theme')
  if (typeof skin === 'string' && skin in SKINS) await update($, theme, () => skin)
  const storedBase = await stored($, 'base')
  await update($, base, n => Math.max(n, storedBase))
  const storedStars = await stored($, 'stars')
  await update($, stars, n => Math.max(n, storedStars))
  const tappable = (await $.store.get('tap')) !== false
  await update($, isTappable, () => tappable)
}

const rebirth = async ($: EngineInterface) => {
  const turnCount = Math.max(await read($, turns), await kept($, 'turns'))
  const petCount = Math.max(await read($, pets), await kept($, 'pets'))
  const level = levelOf(turnCount, petCount, await read($, base))
  if (level < REBIRTH_AT) return `Rebirth opens at level ${REBIRTH_AT}. This pet is level ${level}.`
  const spent = xpOf(turnCount, petCount)
  const reborn = await update($, stars, n => n + 1)
  await update($, base, () => spent)
  await $.store.set('base', spent)
  await $.store.set('stars', reborn)
  await $.store.set('dry', 6)
  return `${lookOf(await read($, seed)).name} is reborn as a baby and wears ${'★'.repeat(Math.min(reborn, 3))}. The next new pet is a rare one.`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const key = `look:${hashOf(e.cwd).toString(36)}`
    const rolled = await stored($, key)
    await update($, project, () => key)
    await update($, seed, () => rolled || hashOf(e.cwd))
    await update($, bornAt, n => n || Date.now())
    await sync($)
    const run = await stored($, 'streak')
    await update($, streak, n => n || run)
    await poke($)
    await $.command.register({
      name: 'mochi',
      description:
        'Show your pet’s stats; reroll gives this project a new pet; boss, night and grin summon the rare ones; theme recolours its bubble; hide hides it. The ⋯ beside the pet does the same without typing',
      argumentHint: '[reroll | boss | night | grin | rebirth | tap | theme [name] | hide]',
    })
    $.clock.every(30e3, async () => {
      await sync($)
      await update($, now, () => Date.now())
    })

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
      await $.store.set('streak', 0)
      await pulse($, 'sad', HAPPY_MS)
      return next(e)
    }
    const petCount = await read($, pets)
    const spent = await read($, base)
    const before = levelOf(await read($, turns), petCount, spent)
    const storedTurns = await stored($, 'turns')
    const total = await update($, turns, n => Math.max(n, storedTurns) + 1)
    await $.store.set('turns', total)
    const run = await update($, streak, n => n + 1)
    await $.store.set('streak', run)
    cheerLevel($, lookOf(await read($, seed)), before, levelOf(total, petCount, spent))
    await pulse($, run % 5 === 0 || e.durationMs >= LONG_TURN_MS ? 'proud' : 'done', HAPPY_MS)

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const why = causeOf(e.rateLimits, e.context.percent)
    if (why !== (await read($, cause))) await update($, cause, () => why)
    if ((why !== '') !== (await read($, isWorried))) await update($, isWorried, () => why !== '')

    return next(e)
  })

  on('command.run', { command: 'mochi' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'hide' || arg === 'show') return { text: await hide($, arg === 'hide' ? !(await read($, isHidden)) : false) }
    const [verb, pick] = arg.split(/\s+/)
    if (verb === 'theme') return { text: await reskin($, pick) }
    if (arg === 'rebirth') return { text: await rebirth($) }
    if (arg === 'tap') {
      const tappable = await update($, isTappable, x => !x)
      await $.store.set('tap', tappable)
      return { text: tappable ? 'A press on the pet counts as a pet.' : 'Presses on the pet are only drawn. ♥ counts.' }
    }
    const rare = SUMMON.get(arg)
    if (arg === 'reroll' || rare) return { text: await swap($, rare) }
    const t = Date.now()
    const petCount = Math.max(await read($, pets), await stored($, 'pets'))
    const turnCount = Math.max(await read($, turns), await stored($, 'turns'))
    const full = Math.round(fullnessOf(t, await read($, fedAt)))
    return {
      text: `${titleOf(lookOf(await read($, seed)))} · level ${levelOf(turnCount, petCount, await read($, base))} · ${turnCount} turns seen · ${petCount} pets · ${full}% full · streak ${await read($, streak)}`,
    }
  })

  on('ui.render', { component: 'CommandOutput', props: { command: 'mochi' } }, async ($, e, next) => {
    const look = lookOf(await read($, seed))
    const found = e.props.isErrored || e.props.args.trim() ? null : STATS.exec(e.props.text)
    if (!found || !e.props.text.startsWith(titleOf(look))) return next(e)
    const [turnCount = 0, petCount = 0, full = 0, run = 0] = found.slice(1).map(Number)
    const spent = await read($, base)
    const { level, xp, span, share, heartsToXp } = progressOf(turnCount, petCount, spent)

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      const lit = Math.round(share * 24)
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text color={look.palette.accent} bold>
              {look.name.toUpperCase()}
            </Text>
            <Text dimColor>{`${STAGES[stageOf(level)]?.word ?? ''} ${kindOf(look)}`}</Text>
            <Text bold>{`LV ${level}`}</Text>
          </Box>
          <Box flexDirection="row" gap={1}>
            <Text color={look.palette.accent}>{'━'.repeat(lit)}</Text>
            <Text dimColor>{'━'.repeat(24 - lit)}</Text>
            <Text dimColor>{`${xp}/${span} xp · ${heartsToXp} ♥ to next xp`}</Text>
          </Box>
          <Text dimColor>{`${turnCount} turns · ♥ ${petCount} · streak ${run} · ${full}% full`}</Text>
        </Box>
      )
    }

    const { Svg } = $.ui.resolve(e)
    return (
      <Svg
        source={scoped(card({ look, turnCount, petCount, spent, stars: await read($, stars), full, streak: run, skin: skinOf(await read($, theme)) }))}
        alt={e.props.text}
        width={364}
        height={100}
      />
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey || (await read($, isHidden))) return below

    const t = (await read($, now)) || Date.now()
    const b = await read($, beat)
    const fed = Math.max(await read($, fedAt), await kept($, 'fedAt'))
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
    const home = lookOf(await read($, seed))
    const guest = visitOf(t, await read($, bornAt), await read($, project), home)
    const look = guest?.[1] ?? home
    const verbs = verbsFrom(Math.floor(b.at / 1000))
    const count = Math.max(await read($, pets), await kept($, 'pets'))
    const turnCount = Math.max(await read($, turns), await kept($, 'turns'))
    const spent = await read($, base)
    const { level, share } = progressOf(turnCount, count, spent)
    const spoken = (look.rare?.lines ?? LINES)[mood]
    const isResting = mood === 'idle' || mood === 'bored'
    const lines =
      guest && isResting
        ? VISIT_LINES
        : mood === 'idle'
          ? [
              ...spoken,
              ...(look.rare ? [] : look.quirk.lines),
              ...momentLines({ hour: new Date(t).getHours(), streak: await read($, streak), turnCount, petCount: count, spent }, look.isEvil),
            ]
          : spoken
    const tips = look.rare?.tips ?? TIPS
    const slot = Math.floor(t / 45e3)
    const isTip = isResting && !guest && slot % 2 === 1
    const why = mood === 'worried' && slot % 2 === 0 ? await read($, cause) : ''
    const line = isThinking
      ? `${verbs[0]}…`
      : isTip
        ? (tips[hashOf(String(slot)) % tips.length] ?? '')
        : why || (lines[Math.floor(t / 90e3) % lines.length] ?? '').replace('{name}', look.name).replace('{home}', home.name)
    const isPeckish = fullness < 70

    const onPet = async () => {
      const storedPets = await stored($, 'pets')
      const total = await update($, pets, n => Math.max(n, storedPets) + 1)
      await $.store.set('pets', total)
      cheerLevel($, look, levelOf(await read($, turns), total - 1, spent), levelOf(await read($, turns), total, spent))
      await poke($)
      await pulse($, 'love', LOVE_MS)
      if (total % 25 === 0) $.ui.toast(look.isEvil ? `${BOSS} has tolerated ${total} pets ♥` : `${look.name} has been petted ${total} times ♥`)
    }

    const onFeed = async () => {
      const at = Date.now()
      await update($, fedAt, () => at)
      await $.store.set('fedAt', at)
      await poke($)
      await pulse($, 'fed', EAT_MS)
    }

    const say = (text: string) => {
      $.ui.toast(text)
    }
    const { Box, Button } = $.ui.resolve(e)
    const more = (
      <Button key="more" plain dimColor onPress={() => void update($, isOpen, x => !x)}>
        {(await read($, isOpen)) ? '×' : '⋯'}
      </Button>
    )
    const keep = guest ? (
      <Button key="keep" plain onPress={async () => say(await swap($, guest[0]))}>
        keep
      </Button>
    ) : null
    const menu = (await read($, isOpen)) ? (
      <Box key="menu" flexDirection="row" gap={1}>
        <Button key="reroll" plain dimColor onPress={async () => say(await swap($))}>
          new pet
        </Button>
        {[...new Map(RARES).entries()].map(([slot, rare]) => (
          <Button key={slot} plain dimColor onPress={async () => say(await swap($, slot))}>
            {rare.name}
          </Button>
        ))}
        <Button key="theme" plain dimColor onPress={async () => say(await reskin($))}>
          theme
        </Button>
        {level >= REBIRTH_AT ? (
          <Button key="rebirth" plain dimColor onPress={async () => say(await rebirth($))}>
            rebirth
          </Button>
        ) : null}
        <Button key="hide" plain dimColor onPress={async () => say(await hide($, true))}>
          hide
        </Button>
      </Box>
    ) : null

    if (e.surface === 'terminal') {
      const { Text } = $.ui.resolve(e)
      const spoken = isThinking ? `${VERBS[Math.floor(t / 3000) % VERBS.length]}…` : line
      return (
        <Box flexDirection="column">
          {below}
          <Box key="mochi" flexDirection="row" gap={1}>
            <Text color={look.palette.accent} hover={{ bold: true, color: look.palette.glow }}>
              {FACE[mood]}
            </Text>
            <Text dimColor italic={isThinking}>
              {spoken}
            </Text>
            <Text dimColor>{look.rare ? `lv${level} ${look.rare.badge.toLowerCase()}` : `lv${level}`}</Text>
            <Button key="pet" plain dimColor onPress={onPet}>
              {`♥ ${count}`}
            </Button>
            {isPeckish ? (
              <Button key="feed" plain dimColor onPress={onFeed}>
                feed
              </Button>
            ) : null}
            {keep}
            {more}
            {menu}
          </Box>
        </Box>
      )
    }

    const { Svg } = $.ui.resolve(e)
    const drawn = scene(
      mood,
      look,
      bubble({ line, verbs: isThinking ? verbs : undefined, stars: guest ? 0 : await read($, stars), level, share, fullness, look, skin: skinOf(await read($, theme)) }),
      hashOf(`${look.name}:${slot}`) || 1,
      guest ? GROWN : stageOf(level),
    )
    return (
      <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap">
        {below}
        <Box key="mochi" flexDirection="row" alignItems="center" gap={0}>
          <Box key="stage">
            <Svg source={scoped(drawn.source)} alt={`${titleOf(look)}, ${mood}: ${line}`} width={drawn.width} height={40} isInteractive />
            {(await read($, isTappable)) ? (
              <Box position="absolute" top={0} left={5}>
                <Button key="tap" plain onPress={onPet}>
                  {'\u2800\u2800\u2800\u2800'}
                </Button>
              </Box>
            ) : null}
          </Box>
          <Button key="pet" plain dimColor onPress={onPet}>
            {`♥ ${count}`}
          </Button>
          {isPeckish ? (
            <Button key="feed" plain dimColor onPress={onFeed}>
              feed
            </Button>
          ) : null}
          {keep}
          {more}
          {menu}
        </Box>
      </Box>
    )
  })
}
