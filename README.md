# mods

Two Claude Code mods for the band above the prompt.

`usage-hud` puts four small gauges above the prompt: 5-hour limit, weekly limit, prompt-cache countdown and context used. A limit gauge shows what's left and the time to reset, with a white tick where you'd be at an even pace. A gauge turns red and blinks when a limit drops under 15%, when you're on track to run out before it resets, when the cache has under two minutes left, or when context passes 80%. `⋯` opens pace, projected run-dry time, session cache totals, hit rate and cost, plus buttons for the cache TTL and compaction.

`pocket-pet` is Mochi, a small pink cat that sits beside the gauges. Mochi watches while Claude works, cheers when a turn finishes, falls asleep after ten idle minutes and worries when limits or context get tight. Click `♥` to pet it. The count is kept across sessions.

Both draw as SVG on the desktop app and fall back to plain text in the terminal.

## Install

At the prompt of a terminal session:

```
/plugin install usage-hud --marketplace xzycd/mods
/plugin install pocket-pet --marketplace xzycd/mods
```

From a shell:

```bash
claude plugin install usage-hud --marketplace xzycd/mods
claude plugin install pocket-pet --marketplace xzycd/mods
```

In the desktop app, where `/plugin` doesn't run: click + next to the prompt box, then Plugins, Add marketplace with `xzycd/mods`, then Add plugin.

Answer `y` to add the marketplace, then pick the user scope so the mods load in every session.

## Commands

- `/hud` hides or shows the gauges.
- `/hud ttl 5` or `/hud ttl 60` sets the cache countdown to match your cache TTL. The default is 60 minutes.

## Tests

```bash
claude plugin test usage-hud
claude plugin test pocket-pet
```
