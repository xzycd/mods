import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-hud',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const

const STORED = {
  '/h/.claude/projects/a/one.jsonl': { size: 10, mtimeMs: 1, t: { cacheRead: 1_000_000_000, cacheWrite: 60_000_000, input: 3_000_000, output: 4_000_000 } },
  '/h/.claude/projects/b/two.jsonl': { size: 20, mtimeMs: 2, t: { cacheRead: 200_000_000, cacheWrite: 30_000_000, input: 1_000_000, output: 2_000_000 } },
}

test('lifetime tokens add up every transcript tallied so far', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'hud' } }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/h' : undefined }))
  on('fs.list', () => ({ value: [] }))
  on('store.get', (_, e) => ({ value: e.key === 'lifetimeFiles' ? STORED : undefined }))
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
