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

export type Tallies = Record<string, { size: number; mtimeMs: number; t: Totals }>

declare module 'claude-code' {
  interface PluginState {
    'usage-hud': {
      snapshot: Shaped<Snapshot | null>
      lastCall: Shaped<LastCall | null>
      totals: Shaped<Totals>
      lifetime: Shaped<Totals>
      atScan: Shaped<Totals>
      now: number
      isHidden: boolean
      isExpanded: boolean
      ttlMinutes: number
    }
  }
}
