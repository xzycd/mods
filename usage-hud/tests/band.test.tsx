import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-hud',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const

test('the band draws limits and expands on every surface', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const reset = new Date(Date.now() + 2 * 3600e3).toISOString()
  await $.session.measure({
    context: { tokens: 84000, window: 200000, percent: 62 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 30, resetsAt: reset },
      { kind: 'seven_day', percentUsed: 90, resetsAt: reset },
    ],
    cost: { usd: 2.48 },
    changed: ['context', 'rateLimits', 'cost'],
  })

  for (const surface of ['desktop', 'terminal', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    if (surface === 'terminal') {
      expect((await ui.find({ type: 'Text', text: /70%/ }))?.text).toContain('70%')
    } else {
      expect(String((await ui.find({ type: 'Svg' }))?.props.alt)).toContain('70% left')
    }
    if (surface === 'desktop') {
      await ui.press({ key: 'more' })
      expect(await ui.find({ type: 'Button', key: 'compact' })).toBeTruthy()
      expect(await ui.find({ type: 'Button', key: 'hide' })).toBeTruthy()
      expect(JSON.stringify(await ui.find({ type: 'Box' }))).toContain('Session tokens 0')
    }
    await ui.unmount()
  }
})
