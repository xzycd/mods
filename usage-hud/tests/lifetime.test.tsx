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

const reply = (id: string, at: string, read: number, ttl: '1h' | '5m', output = 50) =>
  JSON.stringify({
    type: 'assistant',
    timestamp: at,
    message: {
      id,
      usage: {
        input_tokens: 10,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: read,
        output_tokens: output,
        cache_creation: { ephemeral_1h_input_tokens: ttl === '1h' ? 100 : 0, ephemeral_5m_input_tokens: ttl === '5m' ? 100 : 0 },
      },
    },
  })

test('a scan reads only what a transcript grew by, and counts a rewound reply once', async ($, on) => {
  const path = '/h/.claude/projects/p/s1.jsonl'
  const ranges: string[] = []
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 's1' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('command.register', () => ({ value: { command: 'hud' } }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/h' : undefined }))
  on('fs.list', (_, e) =>
    e.path === '/h/.claude/projects'
      ? { value: [{ name: 'p', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }] }
      : e.path === '/h/.claude/projects/p'
        ? { value: [{ name: 's1.jsonl', kind: 'file', size: 250, mtimeMs: 9, isLink: false }] }
        : { value: [] },
  )
  on('store.get', (_, e) => ({
    value:
      e.key === 'lifetimeFiles'
        ? { [path]: { size: 100, mtimeMs: 5, t: { cacheRead: 1000, cacheWrite: 0, input: 0, output: 0 }, firstId: 'm0', lastId: 'm2', lastAt: '2026-11-09T10:00:00.000Z' } }
        : undefined,
  }))
  on('store.set', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))
  on('process.spawn', async function* (_, e) {
    ranges.push(`${e.argv[4]}+${e.argv[5]}`)
    yield {
      stream: 'stdout',
      text: `${reply('m1', '2026-11-09T09:00:00.000Z', 999999, '1h')}\n${reply('m3', '2026-11-09T10:05:00.000Z', 2000, '5m')}\n`,
    }
    return { value: { code: 0, signal: null } }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'more' })
  const tree = JSON.stringify(await ui.find({ type: 'Box' }))
  expect(ranges).toEqual(['101+150'])
  expect(tree).toContain('Lifetime tokens 3.2k')
  expect(tree).toContain('Session tokens 3.2k')
  expect(tree).toContain('5M')
  await ui.unmount()
})

test('a resumed transcript counts its copied replies once in lifetime, and a reply at its final output', async ($, on) => {
  const dir = '/h/.claude/projects/p'
  const ranges: string[] = []
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 's2' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('command.register', () => ({ value: { command: 'hud' } }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/h' : undefined }))
  on('fs.list', (_, e) =>
    e.path === '/h/.claude/projects'
      ? { value: [{ name: 'p', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }] }
      : e.path === dir
        ? {
            value: [
              { name: 'a.jsonl', kind: 'file', size: 300, mtimeMs: 5, isLink: false },
              { name: 's2.jsonl', kind: 'file', size: 400, mtimeMs: 9, isLink: false },
            ],
          }
        : { value: [] },
  )
  on('store.get', (_, e) => ({
    value:
      e.key === 'lifetimeFiles'
        ? { [`${dir}/a.jsonl`]: { size: 300, mtimeMs: 5, t: { cacheRead: 2000, cacheWrite: 200, input: 20, output: 100 }, firstId: 'x1', lastId: 'x2' } }
        : undefined,
  }))
  on('store.set', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))
  on('process.spawn', async function* (_, e) {
    ranges.push(`${e.argv[4]}+${e.argv[5]}`)
    const copied = [reply('x1', '2026-11-09T09:00:00.000Z', 1000, '1h'), reply('x2', '2026-11-09T09:01:00.000Z', 1000, '1h')]
    const own = [reply('y1', '2026-11-10T09:00:00.000Z', 5000, '1h', 1), reply('y1', '2026-11-10T09:00:01.000Z', 5000, '1h', 50)]
    yield { stream: 'stdout', text: `${[...copied, ...(e.argv[6]?.endsWith('/s2.jsonl') ? own : [])].join('\n')}\n` }
    return { value: { code: 0, signal: null } }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'more' })
  const tree = JSON.stringify(await ui.find({ type: 'Box' }))
  expect(ranges).toEqual(['1+400', '1+300', '1+400'])
  expect(tree).toContain('Session tokens 5.2k')
  expect(tree).toContain('Lifetime tokens 7.5k')
  await ui.unmount()
})

test('a rescanned original keeps the replies its resumed copy already subtracted', async ($, on) => {
  const dir = '/h/.claude/projects/p'
  const ranges: string[] = []
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 's2' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('command.register', () => ({ value: { command: 'hud' } }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/h' : undefined }))
  on('fs.list', (_, e) =>
    e.path === '/h/.claude/projects'
      ? { value: [{ name: 'p', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }] }
      : e.path === dir
        ? {
            value: [
              { name: 'a.jsonl', kind: 'file', size: 300, mtimeMs: 6, isLink: false },
              { name: 's2.jsonl', kind: 'file', size: 400, mtimeMs: 9, isLink: false },
            ],
          }
        : { value: [] },
  )
  const copied = { cacheRead: 2000, cacheWrite: 200, input: 20, output: 100 }
  on('store.get', (_, e) => ({
    value:
      e.key === 'lifetimeFiles'
        ? {
            [`${dir}/a.jsonl`]: { size: 300, mtimeMs: 5, t: copied, firstId: 'x1', lastId: 'x2' },
            [`${dir}/s2.jsonl`]: { size: 400, mtimeMs: 9, t: { cacheRead: 7000, cacheWrite: 300, input: 30, output: 150 }, dup: copied, firstId: 'x1', lastId: 'y1' },
          }
        : undefined,
  }))
  on('store.set', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))
  on('process.spawn', async function* (_, e) {
    ranges.push(`${e.argv[4]}+${e.argv[5]}`)
    yield { stream: 'stdout', text: `${reply('x1', '2026-11-09T09:00:00.000Z', 1000, '1h')}\n${reply('x2', '2026-11-09T09:01:00.000Z', 1000, '1h')}\n` }
    return { value: { code: 0, signal: null } }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'more' })
  const tree = JSON.stringify(await ui.find({ type: 'Box' }))
  expect(ranges).toEqual(['1+300'])
  expect(tree).toContain('Session tokens 5.2k')
  expect(tree).toContain('Lifetime tokens 7.5k')
  await ui.unmount()
})
