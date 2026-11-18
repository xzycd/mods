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

test('calm gauges fold into one strip; an early burst or a passed reset raises no alarm', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  await $.session.measure({
    context: { tokens: 40000, window: 200000, percent: 20 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 4, resetsAt: new Date(Date.now() + 295 * 60e3).toISOString() },
      { kind: 'seven_day', percentUsed: 95, resetsAt: new Date(Date.now() - 60e3).toISOString() },
    ],
    changed: ['context', 'rateLimits'],
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const strip = await ui.find({ type: 'Svg' })
  expect(strip?.props.height).toBe(24)
  expect(String(strip?.props.alt)).toContain('5-hour limit: 96% left')
  expect(String(strip?.props.alt)).toContain('Weekly limit: 100% left')
  await ui.press({ key: 'more' })
  const open = JSON.stringify(await ui.find({ type: 'Box' }))
  expect(open).not.toContain('"height":24')
  expect(open).toContain('Lifetime tokens')
  expect(open).not.toContain('DRY')
  await ui.unmount()
})

test('a press on the drawing opens and closes the card, and the strip keeps its sheen on the clock', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  await $.session.measure({
    context: { tokens: 48000, window: 200000, percent: 24 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 8, resetsAt: new Date(Date.now() + 169 * 60e3).toISOString() }],
    changed: ['context', 'rateLimits'],
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const dock = await ui.find({ type: 'Svg' })
  expect(dock?.props.height).toBe(24)
  expect(String(dock?.props.source)).toMatch(/hud-s-\S+ 6s ease-in-out -\d+(\.\d+)?s infinite/)
  expect(String(dock?.props.source)).toContain('url(#hud-r)')
  expect(String(dock?.props.source)).not.toContain('url(#hud-g)')
  expect(String(dock?.props.source)).not.toContain('<path d="M')
  expect(await ui.find({ type: 'Button', text: '⋯' })).toBeFalsy()

  await ui.press({ key: 'more' })
  const card = await ui.find({ type: 'Svg' })
  expect(Number(card?.props.height)).toBeGreaterThan(24)
  expect(String(card?.props.source)).toContain('% left')
  expect(String(card?.props.source)).toContain('% used')
  expect(String(card?.props.alt)).toContain('even pace would leave')
  expect(await ui.find({ type: 'Button', key: 'more-1' })).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: 'close ×' })).toBeFalsy()

  await ui.press({ key: 'more' })
  expect((await ui.find({ type: 'Svg' }))?.props.height).toBe(24)
  await ui.unmount()
})
