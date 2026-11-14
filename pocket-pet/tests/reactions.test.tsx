import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'pocket-pet',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const

test('the pet follows a pointer that comes near it, and reacts to a press', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  const source = String(svg?.props.source)
  expect(svg?.props.isInteractive).toBe(true)
  expect(source).not.toContain('id="body"')
  expect(source).toMatch(/<style>@keyframes bob-(\w+)\{.*\.s\1\{/s)
  expect(source.match(/<rect class="z[ "]/g)).toHaveLength(15)
  expect(source).toContain('.z04:hover~.pet{--lx:1.8px;--ly:-0.9px;--tilt:5deg}')
  expect(source).toContain('.zc:hover~.pet .nz{opacity:1}')
  expect(source).toContain('.walk:active .squash')
  expect(source).toContain('@keyframes stroll')
  expect(source).not.toContain('scaleX(-1)')
  expect(source).toMatch(/\.c:active\.c3:hover \.carry:not\(:has\(\.z:hover\)\)\{transform:translateX\(-15px\)\}/)
  expect(source).toContain('class="foot f1"')
  expect(source).toMatch(/@keyframes fid-\w+\{/)
  await ui.unmount()

  const working = await $.ui.mount({ ...BAND, surface: 'desktop', props: { ...BAND.props, isWorking: true } })
  expect(String((await working.find({ type: 'Svg' }))?.props.source)).not.toContain('@keyframes stroll')
  await working.unmount()
})

test('hearts and turns from earlier sessions show before anything is pressed', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('store.get', (_, e) => ({ value: e.key === 'pets' ? 249 : e.key === 'turns' ? 146 : undefined }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Button', key: 'pet' }))?.text).toBe('♥ 249')
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('>LV9<')
  await ui.unmount()
})

test('/mochi theme recolours the bubble and keeps the choice', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const saved: Record<string, unknown> = {}
  on('store.get', (_, e) => ({ value: saved[e.key] }))
  on('store.set', (_, e) => {
    saved[e.key] = e.value
    return { value: undefined }
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('fill="#000000"')

  expect((await $.command.run({ command: 'mochi', args: 'theme plum', ...RUN })).text).toMatch(/^Bubble theme: plum\./)
  expect(saved.theme).toBe('plum')
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('fill="#170F22"')
  expect((await $.command.run({ command: 'mochi', args: 'theme', ...RUN })).text).toMatch(/^Bubble theme: forest\./)
  expect((await $.command.run({ command: 'mochi', args: 'theme neon', ...RUN })).text).toMatch(/^No theme called neon\./)
  await ui.unmount()
})

test('/mochi draws its stats as a card', async ($, on) => {
  on('store.get', () => ({ value: undefined }))
  const { text = '' } = await $.command.run({ command: 'mochi', args: '', ...RUN })
  expect(text).toMatch(/^Mochi · level 1 · 0 turns seen · 0 pets · \d+% full · streak 0$/)

  const row = { plugin: 'pocket-pet', component: 'CommandOutput', props: { command: 'mochi', args: '', text, isErrored: false } } as const
  const card = await $.ui.mount({ ...row, surface: 'desktop' })
  const svg = await card.find({ type: 'Svg' })
  expect(svg?.props.alt).toBe(text)
  expect(String(svg?.props.source)).toContain('>LV 1<')
  expect(String(svg?.props.source)).toContain('0/3 xp to level 2')
  await card.unmount()

  const plain = await $.ui.mount({ ...row, surface: 'terminal' })
  expect((await plain.find({ type: 'Text', text: /turns · ♥/ }))?.text).toMatch(/^0 turns · ♥ 0 · streak 0 · \d+% full$/)
  await plain.unmount()
})
