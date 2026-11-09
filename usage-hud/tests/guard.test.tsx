import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-hud',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const

const TYPED = { wait: false, origin: { kind: 'composer' } } as const

test('the guard holds a prompt once when context is heavy, then Enter sends it', async ($, on) => {
  const sent: string[] = []
  const filled: string[] = []
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  on('clock.after', () => ({ value: undefined }))
  await $.session.measure({ context: { tokens: 300000, window: 500000, percent: 60 }, rateLimits: [], changed: ['context'] })

  const first = await $.prompt.submit({ text: 'refactor the parser', ...TYPED })
  expect(first.drop).toContain('context is 60% full')
  expect(filled).toEqual(['refactor the parser'])
  expect(sent).toEqual([])

  const second = await $.prompt.submit({ text: 'refactor the parser', ...TYPED })
  expect(second.text).toBe('refactor the parser')
  const third = await $.prompt.submit({ text: 'and the lexer', ...TYPED })
  expect(third.text).toBe('and the lexer')
  expect(sent).toEqual(['refactor the parser', 'and the lexer'])

  await $.session.measure({ context: { tokens: 360000, window: 500000, percent: 72 }, rateLimits: [], changed: ['context'] })
  const fourth = await $.prompt.submit({ text: 'one more', ...TYPED })
  expect(fourth.drop).toContain('context is 72% full')
})

test('the guard never holds a prompt it cannot put back, or one a plugin sent', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('prompt.fill', () => ({ isFilled: false, text: '', cursor: 0 }))
  await $.session.measure({ context: { tokens: 300000, window: 500000, percent: 60 }, rateLimits: [], changed: ['context'] })

  expect((await $.prompt.submit({ text: 'typed', ...TYPED })).text).toBe('typed')
  expect((await $.prompt.submit({ text: 'queued', wait: false, origin: { kind: 'task-notification' } })).text).toBe('queued')
})

test('/hud guard off lets every prompt through', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('prompt.fill', (_, e) => ({ isFilled: true, text: e.text, cursor: e.text.length }))
  on('store.set', () => ({ value: undefined }))
  await $.session.measure({ context: { tokens: 450000, window: 500000, percent: 90 }, rateLimits: [], changed: ['context'] })

  const { text } = await $.command.run({ command: 'hud', args: 'guard off', ...RUN })
  expect(text).toBe('Cache guard off.')
  expect((await $.prompt.submit({ text: 'go', ...TYPED })).text).toBe('go')
})

test('/hud theme recolours the band and names the themes', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('store.set', () => ({ value: undefined }))
  const reset = new Date(Date.now() + 2 * 3600e3).toISOString()
  await $.session.measure({
    context: { tokens: 84000, window: 200000, percent: 42 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 30, resetsAt: reset }],
    changed: ['context', 'rateLimits'],
  })

  expect((await $.command.run({ command: 'hud', args: 'theme ice', ...RUN })).text).toBe('Usage HUD theme: ice.')
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const source = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect(source).toContain('#3DA9FF')
  expect(source).not.toContain('#FF2E2E')
  await ui.unmount()

  const { text } = await $.command.run({ command: 'hud', args: 'theme neon', ...RUN })
  expect(text).toBe('Usage HUD themes: ember, ice, mint, gold, violet, mono.')
})
