export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Snapshot = {
  limits: Limit[]
  contextTokens?: number
  contextWindow: number
  contextPercent?: number
  usd?: number
}

export type LastCall = {
  at: number
  cacheRead: number
  cacheWrite: number
  input: number
}

export type Totals = { cacheRead: number; cacheWrite: number; input: number; output: number }

export type Tallies = Record<string, { size: number; mtimeMs: number; t: Totals; lastId?: string; lastAt?: string }>

export type ContextView = { parts: { name: string; tokens: number }[]; total: number; max: number }

export type Held = { key: string; at: number; isPassed: boolean; band: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-hud': {
      snapshot: Shaped<Snapshot | null>
      lastCall: Shaped<LastCall | null>
      totals: Shaped<Totals>
      lifetime: Shaped<Totals>
      sessionBase: Shaped<Totals>
      atScan: Shaped<Totals>
      contextView: Shaped<ContextView | null>
      held: Shaped<Held>
      now: number
      isHidden: boolean
      isExpanded: boolean
      isGuarded: boolean
      ttlMinutes: number
      ttlSeen: number
      sessionId: string
      theme: string
    }
  }
}
