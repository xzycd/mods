import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'pocket-pet',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const

const petAlt = async (ui: { find: (q: { type: string }) => Promise<{ props: Record<string, unknown> } | undefined> }) =>
  String((await ui.find({ type: 'Svg' }))?.props.alt)

test('a peckish Mochi can be fed and eats', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'mochi' } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.after', () => ({ value: undefined }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Button', key: 'feed' })).toBeTruthy()
  await ui.press({ key: 'feed' })
  expect(await petAlt(ui)).toMatch(/^[A-Z][a-z]+, eating: /)
  expect(await ui.find({ type: 'Button', key: 'feed' })).toBeFalsy()
  await ui.unmount()
})

test('a busy turn shimmers a thinking verb on the desktop', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop', props: { ...BAND.props, isWorking: true } })
  expect(await petAlt(ui)).toMatch(/^Mochi, busy: [a-z]+…$/)
  await ui.unmount()
})

test('a failed tool startles Mochi', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('tool.call', () => ({ result: {}, isError: true }))
  on('clock.after', () => ({ value: undefined }))
  await $.tool.call({ tool: 'Bash', command: 'false' })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await petAlt(ui)).toMatch(/^Mochi, oops: /)
  await ui.unmount()
})
