# mods

Two Claude Code mods for the band above the prompt.

`usage-hud` puts four small gauges above the prompt: 5-hour limit, weekly limit, prompt-cache countdown and context used. A limit gauge shows what's left and the time to reset, with a white tick where you'd be at an even pace. A gauge turns red and blinks when a limit drops under 15%, when you're on track to run out before it resets, when the cache has under two minutes left, or when context passes 80%. `⋯` opens two token bars, one for this session and one for every Claude Code session on this computer, each split into cache reads, cache writes, fresh input and output. The lifetime bar is read from the session transcripts under `~/.claude/projects`; usage from other computers or from claude.ai chats isn't counted. Below the bars are pace, projected run-dry time, cache hit rate and cost, plus buttons for the cache TTL and compaction.

`pocket-pet` is Mochi, a small pink cat that sits beside the gauges. While Claude works, Mochi's speech bubble cycles through shimmering verbs such as thinking… and brewing…. Mochi has thirteen moods. It gets dizzy when tools fire in a burst, startled when a tool fails, sad when a turn is stopped, happy when one finishes and proud on every fifth turn in a row or after a long one. It also gets bored after three idle minutes and falls asleep after ten, and it worries when limits or context get tight.

Mochi levels up as it watches turns finish and gets petted. It gets hungry over about four hours. The pips in its bubble show how full it is, and a `feed` button appears when it's peckish. Click `♥` to pet it. Level, pets and hunger are kept across sessions.

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
- `/mochi` shows Mochi's level, turns seen, pets, hunger and current streak.

## Tests

```bash
claude plugin test usage-hud
claude plugin test pocket-pet
```
