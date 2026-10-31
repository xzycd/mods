import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

const beat = atom({ plugin: 'pocket-pet', key: 'beat' } as const, { kind: 'none', at: 0 }, { shape: 'beat-1' })
const lastActive = atom({ plugin: 'pocket-pet', key: 'lastActive' } as const, 0)
const isWorried = atom({ plugin: 'pocket-pet', key: 'isWorried' } as const, false)
const pets = atom({ plugin: 'pocket-pet', key: 'pets' } as const, 0)
const now = atom({ plugin: 'pocket-pet', key: 'now' } as const, 0)

const HAPPY_MS = 8000
const LOVE_MS = 4000
const SLEEP_MS = 10 * 60e3

type Mood = 'idle' | 'busy' | 'happy' | 'love' | 'sleepy' | 'worried'

const LINES: Record<Mood, string[]> = {
  idle: ['hi, I’m Mochi', 'ready when you are', 'just vibing', 'say something nice'],
  busy: ['on it…', 'watching the tools', 'thinking hard', 'ooh, progress'],
  happy: ['done! nice one', 'that went well', 'yay', 'another one shipped'],
  love: ['hehe ♥', 'more pets please', 'you’re my favourite', 'purr'],
  sleepy: ['zzz…', 'nap time', 'wake me with a prompt', 'dreaming of tokens'],
  worried: ['limits are low…', 'context is getting full', 'maybe compact?', 'go easy on me'],
}

const FACE: Record<Mood, string> = {
  idle: '(｡•ᴗ•｡)',
  busy: '(•̀ᴗ•́)و',
  happy: '(＾▽＾)',
  love: '(♡ᴗ♡)',
  sleepy: '(－_－) zZ',
  worried: '(;･_･)',
}

const moodOf = (
  b: { kind: string; at: number },
  t: number,
  active: number,
  isWorking: boolean,
  worried: boolean,
): Mood => {
  if (b.kind === 'love' && t - b.at < LOVE_MS) return 'love'
  if (isWorking) return 'busy'
  if (b.kind === 'done' && t - b.at < HAPPY_MS) return 'happy'
  if (worried) return 'worried'
  if (active && t - active > SLEEP_MS) return 'sleepy'
  return 'idle'
}

const EYES: Record<Mood, string> = {
  idle: `<g class="blink"><ellipse cx="25" cy="31" rx="2.7" ry="3.5" fill="#2B2140"/><ellipse cx="39" cy="31" rx="2.7" ry="3.5" fill="#2B2140"/><circle cx="26" cy="29.6" r="1" fill="#fff"/><circle cx="40" cy="29.6" r="1" fill="#fff"/></g>`,
  busy: `<g class="glance"><ellipse cx="25" cy="31" rx="2.7" ry="3.5" fill="#2B2140"/><ellipse cx="39" cy="31" rx="2.7" ry="3.5" fill="#2B2140"/><circle cx="26" cy="29.6" r="1" fill="#fff"/><circle cx="40" cy="29.6" r="1" fill="#fff"/></g>`,
  happy: `<path d="M22 32 Q25 27.5 28 32 M36 32 Q39 27.5 42 32" stroke="#2B2140" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  love: `<path d="M25 34 l-3-3 a1.8 1.8 0 0 1 3-2 a1.8 1.8 0 0 1 3 2z M39 34 l-3-3 a1.8 1.8 0 0 1 3-2 a1.8 1.8 0 0 1 3 2z" fill="#FF4D8D"/>`,
  sleepy: `<path d="M22 31.5 Q25 34 28 31.5 M36 31.5 Q39 34 42 31.5" stroke="#2B2140" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  worried: `<ellipse cx="25" cy="31" rx="2.4" ry="3" fill="#2B2140"/><ellipse cx="39" cy="31" rx="2.4" ry="3" fill="#2B2140"/><path d="M21 25.5 L27 27 M43 25.5 L37 27" stroke="#2B2140" stroke-width="1.6" stroke-linecap="round"/>`,
}

const MOUTH: Record<Mood, string> = {
  idle: 'M29.5 37 Q31 38.8 32 37 Q33 38.8 34.5 37',
  busy: 'M30 37.5 Q32 38.5 34 37.5',
  happy: 'M28.5 36.5 Q32 41.5 35.5 36.5 Z',
  love: 'M29.5 37 Q31 38.8 32 37 Q33 38.8 34.5 37',
  sleepy: 'M31 38 Q32 39 33 38',
  worried: 'M29.5 39 Q32 36.8 34.5 39',
}

const EXTRA: Record<Mood, string> = {
  idle: '',
  busy: `<path class="twinkle" d="M54 12 l1.4 3.2 3.2 1.4 -3.2 1.4 -1.4 3.2 -1.4-3.2 -3.2-1.4 3.2-1.4z" fill="#FFD166"/>`,
  happy: `<path class="twinkle" d="M54 12 l1.4 3.2 3.2 1.4 -3.2 1.4 -1.4 3.2 -1.4-3.2 -3.2-1.4 3.2-1.4z" fill="#FFD166"/><path class="twinkle t2" d="M9 18 l1 2.3 2.3 1 -2.3 1 -1 2.3 -1-2.3 -2.3-1 2.3-1z" fill="#7CE7FF"/>`,
  love: `<path class="float" d="M52 20 l-4-4 a2.4 2.4 0 0 1 4-2.8 a2.4 2.4 0 0 1 4 2.8z" fill="#FF6FA5"/><path class="float t2" d="M12 22 l-3-3 a1.8 1.8 0 0 1 3-2 a1.8 1.8 0 0 1 3 2z" fill="#FF9EC4"/>`,
  sleepy: `<text class="float" x="50" y="18" font-size="9" font-weight="700" fill="#9B8FD9" font-family="system-ui">z</text><text class="float t2" x="55" y="12" font-size="7" font-weight="700" fill="#B9AEF0" font-family="system-ui">z</text>`,
  worried: `<path class="drip" d="M47 20 q2.5 4 0 5.5 q-2.5-1.5 0-5.5z" fill="#7CC8FF"/>`,
}

const bubble = (line: string) => {
  const width = Math.ceil(22 + Math.max(line.length, 5) * 5.4)
  return {
    width,
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 40" width="${width}" height="40"><g font-family="ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace"><path d="M11.5 .5 H${width - 7.5} a7 7 0 0 1 7 7 V32.5 a7 7 0 0 1 -7 7 H11.5 a7 7 0 0 1 -7 -7 V24 L.5 20 L4.5 16 V7.5 a7 7 0 0 1 7 -7 Z" fill="#0B0B0C" stroke="#232327"/><text x="14" y="15" font-size="7.5" letter-spacing="1.3" fill="#FF6FA5">MOCHI</text><text x="14" y="29" font-size="9" fill="#F2F2F2">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></g></svg>`,
  }
}

const pet = (mood: Mood) => {
  const speed =
    mood === 'busy' ? '0.9s' : mood === 'sleepy' ? '3.6s' : mood === 'happy' || mood === 'love' ? '0.7s' : '2.4s'
  const lift = mood === 'happy' || mood === 'love' ? -4 : mood === 'sleepy' ? -0.6 : -1.6
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
.drip{animation:drip 1.4s ease-in infinite}
.t2{animation-delay:.6s}
.shake{animation:shake .5s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(${lift}px) scale(.97,1.03)}}
@keyframes shadow{0%,100%{transform:scaleX(1);opacity:.22}50%{transform:scaleX(.82);opacity:.14}}
@keyframes blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes glance{0%,100%{transform:translateX(-1.4px)}50%{transform:translateX(1.4px)}}
@keyframes twinkle{0%,100%{transform:scale(.6);opacity:.4}50%{transform:scale(1.1);opacity:1}}
@keyframes float{0%{transform:translateY(4px);opacity:0}30%{opacity:1}100%{transform:translateY(-8px);opacity:0}}
@keyframes drip{0%{transform:translateY(0);opacity:1}100%{transform:translateY(6px);opacity:0}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-.8px)}75%{transform:translateX(.8px)}}
</style>
</defs>
<ellipse class="shadow" cx="32" cy="52" rx="17" ry="2.6" fill="#2B2140"/>
<g class="bob"><g class="${mood === 'worried' ? 'shake' : ''}">
<path d="M17.5 20 Q14.5 9.5 18 8.2 Q21.5 7.4 28 14.5 Z M46.5 20 Q49.5 9.5 46 8.2 Q42.5 7.4 36 14.5 Z" fill="#FFC9DD" stroke="rgba(43,33,64,.28)" stroke-width="1"/>
<path d="M19.2 11.6 Q19.6 10.2 21 11 L24.6 14.4 L20.4 16.4 Z M44.8 11.6 Q44.4 10.2 43 11 L39.4 14.4 L43.6 16.4 Z" fill="#FF9EC4" opacity=".7"/>
<path d="M11 39 C11 22 21 12 32 12 C43 12 53 22 53 39 C53 47 46 50.5 32 50.5 C18 50.5 11 47 11 39 Z" fill="url(#body)" stroke="rgba(43,33,64,.28)" stroke-width="1.1"/>
<ellipse cx="23" cy="20" rx="5" ry="2.6" fill="#fff" opacity=".7" transform="rotate(-24 23 20)"/>
<ellipse cx="19.5" cy="37" rx="3.6" ry="2.1" fill="#FF8FB3" opacity=".55"/>
<ellipse cx="44.5" cy="37" rx="3.6" ry="2.1" fill="#FF8FB3" opacity=".55"/>
${EYES[mood]}
<path d="${MOUTH[mood]}" stroke="#2B2140" stroke-width="1.4" fill="${mood === 'happy' ? '#FF6F91' : 'none'}" stroke-linecap="round" stroke-linejoin="round"/>
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

const isLow = (limits: readonly SessionRateLimit[], contextPercent: number | undefined) =>
  limits.some(l => l.percentUsed >= 85) || (contextPercent ?? 0) >= 85

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const stored = Number(await $.store.get('pets'))
    if (stored > 0) await update($, pets, () => stored)
    await poke($)
    $.clock.every(30e3, () => update($, now, () => Date.now()))

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await poke($)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const t = Date.now()
    await update($, beat, () => ({ kind: 'done' as const, at: t }))
    await poke($)
    later($, HAPPY_MS)

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const low = isLow(e.rateLimits, e.context.percent)
    if (low !== (await read($, isWorried))) await update($, isWorried, () => low)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below

    const t = (await read($, now)) || Date.now()
    const mood = moodOf(await read($, beat), t, await read($, lastActive), e.props.isWorking, await read($, isWorried))
    const lines = LINES[mood]
    const line = lines[Math.floor(t / 90e3) % lines.length] ?? ''
    const count = await read($, pets)

    const onPet = async () => {
      const at = Date.now()
      await update($, beat, () => ({ kind: 'love' as const, at }))
      const total = await update($, pets, n => n + 1)
      await $.store.set('pets', total)
      await poke($)
      later($, LOVE_MS)
      if (total % 25 === 0) $.ui.toast(`Mochi has been petted ${total} times ♥`)
    }

    if (e.surface === 'terminal') {
      const { Box, Text, Button } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          {below}
          <Box flexDirection="row" gap={1}>
            <Text color="#FF8FB3">{FACE[mood]}</Text>
            <Text dimColor>{line}</Text>
            <Button key="pet" plain dimColor onPress={onPet}>
              {`♥ ${count}`}
            </Button>
          </Box>
        </Box>
      )
    }

    const { Box, Button, Svg } = $.ui.resolve(e)
    const say = bubble(line)
    return (
      <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap">
        {below}
        <Box key="mochi" flexDirection="row" alignItems="center" gap={0}>
          <Svg source={pet(mood)} alt={`Mochi, ${mood}: ${line}`} width={46} height={40} />
          <Svg source={say.source} alt={line} width={say.width} height={40} />
          <Button key="pet" plain dimColor onPress={onPet}>
            {`♥ ${count}`}
          </Button>
        </Box>
      </Box>
    )
  })
}
