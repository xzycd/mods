import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-hud',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const

test('a fresh session with no readings still draws the band', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Button', key: 'more' })).toBeTruthy()
  await ui.unmount()
})

test('a hidden band leaves a way back', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'more' })
  await ui.press({ key: 'hide' })
  expect(await ui.find({ type: 'Button', key: 'more' })).toBeFalsy()
  await ui.press({ key: 'show' })
  expect(await ui.find({ type: 'Button', key: 'more' })).toBeTruthy()
  await ui.unmount()
})
