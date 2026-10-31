import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-hud',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const

test('lifetime tokens carry over from earlier sessions', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'hud' } }))
  on('store.get', (_, e) => ({
    value: e.key === 'lifetime' ? { cacheRead: 1_200_000_000, cacheWrite: 90_000_000, input: 4_000_000, output: 6_000_000 } : undefined,
  }))
  on('store.set', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'more' })
  const tree = JSON.stringify(await ui.find({ type: 'Box' }))
  expect(tree).toContain('Session tokens 0')
  expect(tree).toContain('Lifetime tokens 1.3B')
  await ui.unmount()
})
