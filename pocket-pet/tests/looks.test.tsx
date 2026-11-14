import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'pocket-pet',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const

type Mounted = { find: (q: { type: string }) => Promise<{ props: Record<string, unknown> } | undefined> }

const petSvg = async (ui: Mounted) => {
  const svg = await ui.find({ type: 'Svg' })
  return { alt: String(svg?.props.alt), source: String(svg?.props.source) }
}

test('each project gets its own pet, and keeps it', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'mochi' } }))
  on('store.get', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))

  const looks = []
  for (const cwd of ['/work/shop', '/work/api', '/work/shop']) {
    await $.session.start({ cwd, surface: 'desktop', isInteractive: true })
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    looks.push(await petSvg(ui))
    await ui.unmount()
  }
  expect(looks[0]?.source).not.toBe(looks[1]?.source)
  expect(looks[2]).toEqual(looks[0])
})

test('/mochi reroll gives this project a new pet and stores it', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'mochi' } }))
  on('store.get', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))
  const saved: Record<string, unknown> = {}
  on('store.set', (_, e) => {
    saved[e.key] = e.value
    return { value: undefined }
  })
  await $.session.start({ cwd: '/work/shop', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const before = await petSvg(ui)
  const { text } = await $.command.run({
    command: 'mochi',
    args: 'reroll',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })
  expect(text).toMatch(/^(Meet [A-Z][a-z]+, this project’s new (cat|bunny|bear|fox)|AUDA, the final boss, now rules this project|(NYX|WISP), the (night dragon|grinning cat), has moved in)\.$/)
  expect(Object.keys(saved).filter(k => k.startsWith('look:'))).toHaveLength(1)
  expect(await petSvg(ui)).not.toEqual(before)
  expect(JSON.stringify(await ui.find({ type: 'Box' }))).not.toMatch(/\\"[a-z-]+=\\"/)
  await ui.unmount()
})

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const

test('/mochi boss summons AUDA, the final boss', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'mochi' } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))
  await $.session.start({ cwd: '/work/api', surface: 'desktop', isInteractive: true })

  const { text } = await $.command.run({ command: 'mochi', args: 'boss', ...RUN })
  expect(text).toBe('AUDA, the final boss, now rules this project.')
  const again = await $.command.run({ command: 'mochi', args: 'boss', ...RUN })
  expect(again.text).toBe('AUDA already rules this project.')
  const stats = await $.command.run({ command: 'mochi', args: '', ...RUN })
  expect(stats.text).toMatch(/^AUDA · final boss · level \d+ · /)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop', props: { ...BAND.props, isWorking: true } })
  const { alt, source } = await petSvg(ui)
  expect(alt).toMatch(/^AUDA · final boss, busy: /)
  expect(source).toContain('class="flap"')
  expect(source).toContain('class="rage"')
  expect(source).toContain('#FF453A')
  expect(JSON.stringify(await ui.find({ type: 'Box' }))).toContain('>BOSS<')
  await ui.unmount()
})

test('/mochi night and grin summon the two rare pets', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'mochi' } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))
  await $.session.start({ cwd: '/work/api', surface: 'desktop', isInteractive: true })

  const night = await $.command.run({ command: 'mochi', args: 'night', ...RUN })
  expect(night.text).toBe('NYX, the night dragon, has moved in.')
  expect((await $.command.run({ command: 'mochi', args: 'night', ...RUN })).text).toBe('NYX is already here.')
  const dragon = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const nyx = await petSvg(dragon)
  expect(nyx.alt).toMatch(/^NYX · night dragon, /)
  expect(nyx.source).toContain('id="iris-')
  expect(nyx.source).toContain('class="twitch"')
  expect(nyx.source).toContain('class="pupil"')
  expect(JSON.stringify(await dragon.find({ type: 'Box' }))).toContain('>RARE<')
  await dragon.unmount()

  const grin = await $.command.run({ command: 'mochi', args: 'grin', ...RUN })
  expect(grin.text).toBe('WISP, the grinning cat, has moved in.')
  const stats = await $.command.run({ command: 'mochi', args: '', ...RUN })
  expect(stats.text).toMatch(/^WISP · grinning cat · level \d+ · /)
  const cat = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const wisp = await petSvg(cat)
  expect(wisp.source).toContain('#35E0D0')
  expect(wisp.source).toContain('@keyframes veil')
  expect(wisp.source).not.toBe(nyx.source)
  await cat.unmount()
})

test('/mochi hide hides the pet until asked again', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>beneath</Text>
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'mochi' } }))
  const store = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('clock.every', () => ({ value: undefined }))
  await $.session.start({ cwd: '/work/shop', surface: 'desktop', isInteractive: true })

  expect((await $.command.run({ command: 'mochi', args: 'hide', ...RUN })).text).toMatch(/^Pet hidden/)
  let ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Button', key: 'pet' })).toBeFalsy()
  expect((await ui.find({ type: 'Text', text: /beneath/ }))?.text).toBe('beneath')
  await ui.unmount()

  await $.command.run({ command: 'mochi', args: 'hide', ...RUN })
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Button', key: 'pet' })).toBeTruthy()
  await ui.unmount()
})

test('⋯ opens a menu that swaps the pet without a command', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'mochi' } }))
  on('store.get', () => ({ value: undefined }))
  const saved: Record<string, unknown> = {}
  on('store.set', (_, e) => {
    saved[e.key] = e.value
    return { value: undefined }
  })
  on('clock.every', () => ({ value: undefined }))
  await $.session.start({ cwd: '/work/shop', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Button', key: 'reroll' })).toBeFalsy()
    await ui.press({ key: 'more' })
    for (const key of ['reroll', 'boss', 'night', 'grin', 'theme', 'hide']) expect(await ui.find({ type: 'Button', key })).toBeTruthy()
    await ui.press({ key: 'more' })
    expect(await ui.find({ type: 'Button', key: 'reroll' })).toBeFalsy()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'more' })
  await ui.press({ key: 'night' })
  expect((await petSvg(ui)).alt).toMatch(/^NYX · night dragon, /)
  await ui.press({ key: 'reroll' })
  expect((await petSvg(ui)).alt).not.toMatch(/^NYX/)
  expect(typeof saved.dry).toBe('number')
  await ui.press({ key: 'theme' })
  expect(saved.theme).toBe('slate')
  await ui.unmount()
})
