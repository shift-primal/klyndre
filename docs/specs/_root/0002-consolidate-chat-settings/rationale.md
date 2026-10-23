# 0002. Rationale: consolidate the chat's identity, style and memory

## Context

The chat feature (`apps/bot/src/features/chat`, settings in `packages/config`, pages in `apps/web`) grew one feature at a time, and each feature put its settings wherever its type fitted: numbers and switches in the `chat` module, text in `personality`, the character sheet in `character`, channel lists in `channels`. The `chat` module reached 45 settings covering reply triggers, conversation starters, images, repetition control, lore and notes. `personality` mixes the prompts that shape how the bot talks with prompts for internal machinery (updaters, the judge, markers) that almost nobody should touch.

The result is that no topic lives in one place. Notes on people are split across three places (switches in Chat, prompts in Personality, data on Profiles), and lore across three as well. The bot's own life is split twice: the character sheet holds who it is, while "self lore" holds what it made up while chatting. They have separate instructions and nothing keeps them consistent.

Several settings contradict prompt text:
- `chat.language` says always write in a language, while the `format` prompt says to match the chat's language and `rules` says to match the language too.
- The `lowercaseReplies` and `stripEmojis` switches can be turned off while `format` still says "all lowercase, no emojis".
- Four things control how many lines a reply has: `maxMessages`, `multiMessageChance`, `oneLineNote` and a paragraph in `format`.

The engineer reported the chat as "very messy, it's hard to understand what controls what".

All existing data (settings, character, lore, notes, presets) is throwaway, so the change carries no live data migration constraint. The forces are clarity for the one person tuning the bot, model call cost per reply (best of n already makes up to 4 calls), and keeping the prompt small enough that the bot doesn't recite everything it is given.

## Options considered

### Option 1: Fix in place

Move settings into clearer tabs and delete the prompt lines that contradict the switches, but keep the modules, the character sheet and self lore as they are.

**Pros**:
- Smallest change, no new tables or pages, low risk.

**Cons**:
- The bot's life stays in two stores that can disagree.
- Features that cost more than they help (staying quiet, the opener retry) stay.
- Renaming modules without rethinking them leaves the same overlap under new names.

### Option 2: Consolidate, character stays a settings module

Regroup settings by purpose and generate the style lines, as in the chosen option, but keep the character sheet in `guild_settings` and have a single updater rewrite its fields with `setSettings`. Locks would be a settings list.

**Pros**:
- Reuses the generic settings form and live reload, no new table or page.
- Least code for the merge.

**Cons**:
- There's no record of which items the bot invented and which an admin wrote.
- Locking works only per field.
- Stories, which can grow to 20, sit in one JSON array the updater must rewrite whole.

### Option 3: Consolidate, character as its own table (chosen)

As option 2, but every item on the sheet is a row with a source and a lock, field locks are a small table, and a Character page edits them. The updater edits rows.

**Pros**:
- Shows where each detail came from.
- Locks work per item and per field.
- Stories can be capped, evicted by last use, and matched one by one.

**Cons**:
- A new table pair, server functions and a custom page.
- The bot reads character rows on every reply instead of a cached settings module.

## Rationale

Option 3 answers the root cause. The confusion comes from topics being spread out and from two sources of truth (settings against prompt text, sheet against self lore), so the fix has to remove the second source in each pair rather than move it around. Generating the style lines from settings makes it impossible for the prompt to say the opposite of a switch. Merging self lore into the sheet gives the bot's life one store.

I recommended keeping the sheet as a settings module (option 2) for less code. The engineer chose rows, because seeing what the bot invented and locking single items matters more to them than the extra page. That's a sound trade: the stories requirement (make new ones, never retell unprompted) needs stories matched one by one with a last used time, which a JSON array handles badly. Reading the rows on each reply is a small indexed query per guild, cheaper than the model calls around it, so it needs no cache.

**Choices where the engineer went against my recommendation, recorded so the cost is accepted knowingly:**
- **The character updater runs whenever a reply talks about itself**, not every N replies. It catches details sooner, but adds a call to most replies. The per server single job guard keeps bursts in check, and the follow up asks for a check of the real call count.
- **Staying quiet is cut entirely** instead of reduced to one setting. The code gets simpler, but the bot will answer "ok". The follow up revisits it if it feels wrong.
- **Lore and chat tuning knobs stay as advanced settings** instead of constants. This keeps control for tuning, at the cost of a long advanced list.
- **Two identity prompts** (`persona` and `behaviour`) instead of one. That's reasonable: who it is gets swapped with presets, while how it chats tends to stay put.

Decisions I made without asking:
- **The judge** runs whenever 2 or more candidates make the shortlist. This drops a switch whose off state was just "candidates without the judge"; the runner up was keeping `judgeCandidates`.
- **The opener constants** (5 and 2) keep today's defaults, so scoring behaves the same.
- **Bare `i` is left out of `selfWords`** because in Norwegian it means "in". The runner up, keeping it, would trigger on nearly every Norwegian reply.
- **The transcript format line** ("Name: text", no prefix) is a constant, not a setting, because it describes how the code formats history and changing it would only break things.
- **Stories reuse the lore ranking** with all words as note words, rather than a new matcher, so tuning lore matching tunes stories too.
- **Field definitions live in `packages/db`** beside the lore limits, so the bot, the dashboard and the migration share one list.

Changes from the cross check (a fresh read of the draft), approved by the engineer:
- **The sheet is written in the chat's language**, not English. Story matching compares exact words with what people type, so an English story would never match a Norwegian chat.
- **The updater returns explicit actions** (add, replace, remove by id) instead of a field's full new list. With a full list, an item the model forgot to repeat would be deleted, and the evidence check only backs what is added, not what is left out. It also never removes an item an admin wrote.
- **Every character write takes a lock per server** (a Postgres advisory lock inside a transaction) and reads the rows again. Without it, an admin edit made while the updater waits on the model could be overwritten, and two writes could both pass a cap check. The in memory job set alone doesn't cover the dashboard or the test script, which run in other processes.
- **Building a prompt never writes.** `usedAt` is set after the reply is sent, so the test prompt script has no side effects.

## Settings inventory (before → after)

| Before (module.key) | After |
|---|---|
| chat.model, temperature, randomReplyChance, replyToMentionsAnywhere, candidates | replies |
| chat.historyLimit, laterLimit, threadLimit, maxImages, imageMaxAgeMs, maxReplyTokens, turnWaitLimitMs, timeZone | replies (advanced) |
| chat.starterQuietMs, starterMaxPerDay | replies |
| chat.starterFromHour, starterToHour, starterChance | constants |
| chat.maxMessages, multiMessageChance, lowercaseReplies, stripEmojis, language | style |
| chat.followUpTypingMs | style (advanced) |
| chat.quirksShown | identity (advanced) |
| chat.profilesEnabled, loreEnabled, loreShown, loreCooldownReplies | memory |
| chat.profileUpdateEvery, profileEvidenceWords, lore tuning (8) | memory (advanced) |
| chat.loreRandomFill | removed (no self lore) |
| chat.judgeCandidates | removed (judge runs at 2 or more) |
| chat.openerMemory, openerRepeatLimit | constants |
| chat.skipMaxWords, quietTypingMs | removed (staying quiet cut) |
| channels.aiChannelIds, randomReplyChannelIds, starterChannelIds | replies |
| channels.musicChannelIds | music |
| personality.persona | identity.persona |
| personality.rules | identity.behaviour |
| personality.format | generated Style section + style.styleNotes |
| personality.characterGuidance, peopleGuidance, serverLoreGuidance | internals |
| personality.selfLoreGuidance | removed |
| personality.profileInstructions, loreInstructions, judgeInstructions, starterNote, answeringMarker, replyLabel | internals |
| personality.repeatedOpenerNote, skipNote, skipMarker | removed |
| personality.oneLineNote | constant |
| personality.fallbackReply, contentFilterReply, notHereReply | replies |
| character.fillBlanks | identity.makeUpBlanks |
| character.fillInstructions | internals |
| character fields (13) | `character_entries` rows, 10 fields (tastes into interests, dislikes into opinions, weaknesses dropped) |
| lore_entries kind `self` | removed, merged into the character |
