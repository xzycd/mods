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
  on('store.set', () => ({ value: undefined }))
  on('clock.after', () => ({ value: undefined }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'pet' })
  await ui.press({ key: 'pet' })
  expect((await ui.find({ type: 'Button', key: 'pet' }))?.text).toBe('♥ 2')
  expect(String((await ui.find({ type: 'Svg' }))?.props.alt)).toMatch(/^Mochi, love: /)
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
