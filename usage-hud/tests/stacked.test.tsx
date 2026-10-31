import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-hud',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const

test('the band keeps a pet-shaped tree from beneath', async ($, on) => {
  on('ui.render', async ($, e) => {
    if (e.surface === 'terminal') {
      const { Box } = $.ui.resolve(e)
      return <Box />
    }
    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const inner = <Box />
    return (
      <Box flexDirection="row" alignItems="center" gap={2} flexWrap="wrap">
        {inner}
        <Box key="mochi" flexDirection="row" alignItems="center" gap={1}>
          <Svg source='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4" width="4" height="4"/>' alt="pet" width={64} height={56} />
          <Box flexDirection="column">
            <Text bold color="#FF6FA5">Mochi</Text>
            <Button key="pet" plain dimColor onPress={() => {}}>{'pet ♥ 0'}</Button>
          </Box>
        </Box>
      </Box>
    )
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Button', key: 'more' })).toBeTruthy()
  expect(await ui.find({ type: 'Button', key: 'pet' })).toBeTruthy()
  await ui.unmount()
})
