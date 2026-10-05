# TODO

## Features:

### General

- [x] /help (pages per feature and per command: -help music, -help play)

### Chat

- [x] hook up to grok
- [x] per channel busy (queue) (turns.ts)

## Next up (porting from guttasjefen, in priority order)

1. [x] image fallback: retry without images when one fails (expired discord urls), only send recent images · small
2. [x] fallback reply on error / content filter (sendReply currently sends nothing) · small
3. [ ] reply chain context: follow the replied-to message back past historyLimit (old replyChain()) · small-medium
4. [ ] answering marker: fetch history before the trigger message, mark it when newer messages piled up while queued · small
5. [ ] lore: db table, relevance pick for the prompt, update after replies, web page like profiles · medium
6. [ ] decide: bot's own made-up life (old lore.md + "meg") vs server topics/running jokes, or both with a kind column
7. [ ] prod deploy (only docker-compose.dev.yml exists) · small-medium
8. [x] core/commands/guards.ts (dev role check, `devOnly` on a command) · small
9. [ ] port scripts/test-prompt.ts for prompt testing outside discord · small-medium
10. [x] music: move / reorder queue · small
11. [x] music: undo / restart last queue on accidental /stop · small-medium
12. [x] /help pages per feature (-help music, -help chat) · small
13. [ ] anti-repetition: best-of-n + judge, reused word / opener filters (wait until it repeats itself, costs n calls) · medium
14. [ ] humour dials: taste distill + sliders in the web app · large
15. [ ] scenarios, (minigame, gives u a scenario, u have to answer, the bot judges your answer)

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
- [x] move / reorder queue
- [x] undo / restart last queue on accidental /stop (restore, window in music settings)
