# TODO

folder structure:

```
apps/bot/src/
  index.ts              entry: build client, register features, login, shutdown
  env.ts                secrets only (DISCORD_TOKEN, XAI_API_KEY, …)

  core/                 plumbing, knows nothing about chat or music
    client.ts           Client + intents
    feature.ts          the Feature interface (below)
    commands/
      types.ts          Command, CommandContext (today's types.ts)
      registry.ts       collects commands from all features
      dispatch.ts       prefix messages and slash → context → run
      slash.ts          toSlashJSON (today's lib/utils/slash.ts)
      guards.ts         dev role, music-channel check, in-voice check

  features/             one folder per thing the bot does
    general/            commands/ping.ts, help.ts
    chat/
      index.ts          Feature: registers the MessageCreate listener
      handler.ts        "should I reply here?" (channels + chat settings)
      history.ts        channel history → model messages
      prompt.ts         system prompt from persona + rules
      reply.ts          model call, cleanup, send
    music/
      index.ts          Feature: commands + player setup
      commands/         play, skip, stop, queue, pause, resume, nowplaying
      player.ts         discord-player + extractors
      access.ts         musicChannelIds and same-voice-channel checks
      announcements.ts  "now playing" messages
      ui/               queue embed, formatting

  lib/                  generic helpers, no Discord or feature knowledge
    fs.ts  text.ts  random.ts  time.ts
  scripts/register.ts   registers slash commands from the registry
```

## Features:

### General

- [ ] /help

### Chat

### Music

- [x] set up player
- [x] play
- [x] skip
- [x] stop
- [x] pause
- [x] resume
- [x] queue system
- [x] remove
- [x] now playing
- [x] shuffle
- [x] skip
- [x] skipto
- [x] playnow
- [x] playnext
- [ ] move / reorder queue
- [ ] undo / restart last queue on accidental /stop
