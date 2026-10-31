export type Beat = { kind: 'done' | 'love' | 'none'; at: number }

declare module 'claude-code' {
  interface PluginState {
    'pocket-pet': {
      beat: Shaped<Beat>
      lastActive: number
      isWorried: boolean
      pets: number
      now: number
    }
  }
}
