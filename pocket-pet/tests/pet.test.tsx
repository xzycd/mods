import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'pocket-pet',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const

test('Mochi draws beside what is beneath, on every surface', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>beneath</Text>
  })

  for (const surface of ['desktop', 'terminal', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /beneath/ }))?.text).toBe('beneath')
    expect(await ui.find({ type: 'Button', key: 'pet' })).toBeTruthy()
    await ui.unmount()
  }
})

test('petting counts and turns Mochi to love', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('clock.after', () => ({ value: undefined }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'pet' })
  await ui.press({ key: 'pet' })
  expect((await ui.find({ type: 'Button', key: 'pet' }))?.text).toBe('♥ 2')
  expect(String((await ui.find({ type: 'Svg' }))?.props.alt)).toMatch(/^Mochi, love: /)
  await ui.unmount()
})

test('petting counts on from pets given in other sessions', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('store.get', (_, e) => ({ value: e.key === 'pets' ? 40 : undefined }))
  on('store.set', () => ({ value: undefined }))
  on('clock.after', () => ({ value: undefined }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'pet' })
  expect((await ui.find({ type: 'Button', key: 'pet' }))?.text).toBe('♥ 41')
  await ui.unmount()
})

test('a busy turn shows the busy face on the terminal', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: { ...BAND.props, isWorking: true } })
  expect((await ui.find({ type: 'Text', text: /ᴗ•́/ }))?.text).toContain('و')
  await ui.unmount()
})

test('a press on the pet counts, and a level 10 pet can be reborn with a star', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const store = new Map<string, unknown>([['turns', 300]])
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('clock.after', () => ({ value: undefined }))

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'tap' })
  expect((await ui.find({ type: 'Button', key: 'pet' }))?.text).toBe('♥ 1')
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('>LV11<')
  await ui.press({ key: 'more' })
  await ui.press({ key: 'rebirth' })
  expect(store.get('base')).toBe(300)
  expect(store.get('stars')).toBe(1)
  expect(store.get('dry')).toBe(6)
  const source = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect(source).toContain('>LV1<')
  expect(source).toContain('★<')
  expect(source).toContain('matrix(0.84 0 0 0.84')
  expect(await ui.find({ type: 'Button', key: 'rebirth' })).toBeFalsy()
  await ui.unmount()
})
