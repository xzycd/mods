export type Beat = {
  kind: 'done' | 'love' | 'none' | 'fed' | 'oops' | 'sad' | 'proud'
  at: number
}

export type Burst = { n: number; at: number }

declare module 'claude-code' {
  interface PluginState {
    'pocket-pet': {
      beat: Shaped<Beat>
      burst: Shaped<Burst>
      lastActive: number
      isWorried: boolean
      pets: number
      turns: number
      streak: number
      fedAt: number
      now: number
    }
  }
}
