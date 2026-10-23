# 0002. Consolidate the chat's identity, style and memory

**Date**: 2026-10-23
**Status**: Accepted

## Summary

The chat feature's settings are grouped by type instead of by what they control, so the bot's identity, writing style and memory are spread across several tabs and contradict each other in places. This spec regroups every setting into tabs by purpose (Identity, Style, Replies, Memory, Internals), turns language, lowercase, emojis, reply length and message splitting into plain settings that write their own prompt lines, and merges the bot's "self lore" into one character sheet stored as rows in a new table with its own page. It also cuts features that didn't earn their keep (staying quiet, the opener retry, the judge switch, random self lore) and resets all chat settings, since the existing data is throwaway.

## Requirements

**User stories**:
- As an admin, I want each setting in the one tab that matches what it controls, so that I can find what changes a behaviour without reading every tab.
- As an admin, I want language, lowercase, emojis, reply length and message splitting set in one place, so that the prompt can never say the opposite of a setting.
- As an admin, I want one character sheet that holds everything about the bot's life, so that it can't have a brother in one place and be an only child in another.
- As an admin, I want to see which parts of the sheet I wrote, which it made up, and which it learned in chat, and lock what I want kept.
- As a chatter, I want the bot to remember what it said about its own life, and to tell new stories without retelling old ones unless someone asks.

**Acceptance criteria**:
- **AC-1**: The settings page shows the tabs Identity, Style, Replies, Memory, Music, Commands and Internals, in that order, and no Chat, Channels, Personality or Character tab. Every setting sits in exactly the tab the *Settings layout* table below gives it.
- **AC-2**: The reply system prompt has a `## Style` section built only from the Style settings (see *Prompt layout*). Nothing else in the reply system prompt or the per reply notes mentions language, lowercase, emojis or how many lines to write. The updater and filler prompts are out of scope here; they may name the language to write the sheet and lore in.
- **AC-3**: With `style.language` empty, the Style section says to write in the language most of the chat is in. With it set (say `Norwegian`), it says to always write in Norwegian, and nothing in the prompt says to match the chat's language.
- **AC-4**: With `lowercaseReplies` on, the prompt says to write in lowercase and sent replies are lowercased in code. With it off, the prompt says nothing about case and replies keep their case. `stripEmojis` behaves the same way for emojis.
- **AC-5**: `replyLength` is a dropdown with `short`, `normal` and `long`, and each choice writes its own line into the Style section (texts in *Prompt layout*).
- **AC-6**: For each reply, with chance `multiMessageChance` the note after the last message allows up to `maxMessages` lines. Otherwise, and always when `maxMessages` is 1, it asks for one line and any extra lines are joined into one message. This is the only place the line count is stated.
- **AC-7**: The character sheet is stored in `character_entries`. The prompt's `## Who you are` section lists every field except stories, with `quirksShown` quirks picked at random per reply (0 shows all).
- **AC-8**: With `makeUpBlanks` on, any field that has no rows and isn't locked is made up in the background (source `filled`), including 2 to 4 stories, written in `style.language` (or the main language of the chat when that's empty). A field you empty gets made up again on the next reply. A locked empty field stays empty.
- **AC-9**: With `learnFromChat` on, after a sent reply (outcome `reply`, not a fallback) containing a word from `selfWords`, the character updater runs in the background. This applies to conversation starters too. Only one character job (fill or update) runs per server at a time in the bot, and a trigger that arrives while one is running is skipped.
- **AC-10**: The updater returns explicit actions (add, replace an id, remove an id) and saves only those backed by at least `characterEvidenceWords` words quoted from the bot's own lines, with source `chat`. It never changes or removes a locked item, never removes a `manual` item, and never touches a locked field. Each dropped action is logged with the reason (locked, manual, no evidence, over the cap, bad id, empty or too long).
- **AC-11**: Text fields hold at most 1 row, list fields at most 6, stories at most 20. When a new story would pass 20, the unlocked story with the oldest `coalesce(usedAt, createdAt)` is removed. If every story is locked, the new story is dropped and logged.
- **AC-12**: Stories never go in the prompt unless what people wrote in the chat matches them, locked or not, and whatever `loreEnabled` is. At most `storiesShown` matched stories (0 means none) go under `## Stories you've told`, with the stories guidance. Each one shown gets `usedAt` set to now after the reply is sent, never while building a prompt.
- **AC-13**: The Character page lists the 10 fields as sections, each item with its source badge (yours, made up, learned) and lock, plus a lock on each field. Logged in viewers can read it. Only admins can add, edit, delete or lock, and the server rejects adds past a field's cap.
- **AC-14**: Lore only means server lore: `lore_entries` has no `kind` column, the Lore page has no self/server split, the lore updater only writes server lore, and `loreRandomFill` and `selfLoreGuidance` no longer exist.
- **AC-15**: The bot answers every message it's triggered by, apart from the existing "the last reply already read it" skip, and it starts typing as soon as it knows it will answer. No skip marker, skip note or quiet typing delay remains, and the `quiet` outcome is gone: a reply that is empty after styling (emojis only, say) sends `fallbackReply` instead.
- **AC-16**: Best of n has one setting, `candidates` (1 turns it off). The judge runs whenever 2 or more candidates make the shortlist. The repeated opener note and its retry are gone, and the repetition score still penalises repeated openers.
- **AC-17**: Conversation starters keep `starterChannelIds`, `starterQuietMs` and `starterMaxPerDay` as settings. The hours (10 to 23) and the 10% chance per check are code constants.
- **AC-18**: Prompt presets can only be saved and loaded for `identity.persona`. No other prompt field shows preset controls.
- **AC-19**: After the migration, the old `chat`, `channels`, `personality` and `character` settings rows, all self lore and all prompt presets are gone, and the bot and dashboard run on the new defaults without errors.
- **AC-20**: `apps/bot/src/scripts/test-prompt.ts` and the README describe the new layout, and the test prompt script prints the same prompt the bot builds, without writing anything (no `usedAt`, no character updates).

## Decision

**Chosen option**: Option 3: consolidate, with the character as its own table

Regroup every chat setting into Identity, Style, Replies, Memory and Internals. Generate the style lines from settings, merge self lore into a row based character sheet with a separate updater, and reset the old data.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

### Settings layout

Modules are `guild_settings.module` values and dashboard tabs, in this order. **(a)** marks an advanced setting.

| Module (tab) | Settings |
|---|---|
| `identity` (Identity) | `persona` (prompt, presets), `behaviour` (prompt), `makeUpBlanks`, `learnFromChat`, `quirksShown` (a), `storiesShown` (a), `selfWords` (a, list), `characterEvidenceWords` (a) |
| `style` (Style) | `language`, `replyLength` (select), `lowercaseReplies`, `stripEmojis`, `maxMessages`, `multiMessageChance`, `styleNotes` (textarea), `followUpTypingMs` (a) |
| `replies` (Replies) | `aiChannelIds`, `randomReplyChannelIds`, `starterChannelIds`, `replyToMentionsAnywhere`, `randomReplyChance`, `starterQuietMs`, `starterMaxPerDay`, `model`, `temperature`, `candidates`, `fallbackReply`, `contentFilterReply`, `notHereReply`, and advanced: `historyLimit`, `laterLimit`, `threadLimit`, `maxImages`, `imageMaxAgeMs`, `maxReplyTokens`, `turnWaitLimitMs`, `timeZone` |
| `memory` (Memory) | `profilesEnabled`, `loreEnabled`, `loreShown`, `loreCooldownReplies`, and advanced: `profileUpdateEvery`, `profileEvidenceWords`, `loreUpdateEvery`, `loreMaxEntries`, `loreMaxNewPerUpdate`, `loreKeyWordLength`, `loreNoteWordLength`, `loreRareWordLimit`, `loreEvidenceWords`, `loreUpdateContext` |
| `music` (Music) | today's settings, plus `musicChannelIds` |
| `commands` (Commands) | unchanged |
| `internals` (Internals) | `characterGuidance`, `storiesGuidance`, `peopleGuidance`, `serverLoreGuidance`, `fillInstructions`, `characterInstructions`, `profileInstructions`, `loreInstructions`, `judgeInstructions`, `starterNote`, `answeringMarker`, `replyLabel` |

Moved settings keep today's values, bounds and descriptions unless listed here. `persona` = today's `persona`. `behaviour` = today's `rules` with its first sentence changed to "Match the tone of the chat." (the language part moves to Style).

**New settings** (every one needs a `meta()` description; bounds are zod rules):

| Setting | Default | Bounds | Description |
|---|---|---|---|
| `makeUpBlanks` | true | boolean | Make up any empty, unlocked field of the character sheet in the background, so it's there from the next reply. Empty a field to have it made up again |
| `learnFromChat` | true | boolean | Save what it says about its own life to the character sheet, after replies where it talks about itself |
| `storiesShown` | 2 | int 0..5 | Most of its told stories that go in the prompt when the chat matches them (0 for none) |
| `selfWords` | `me, my, mine, myself, i'm, im, i've, ive, jeg, meg, min, mitt, mine, selv` | list of strings | Words that mean it talked about itself, which sets off the character updater. Add the right ones if it chats in another language |
| `characterEvidenceWords` | 3 | int 1..20 | Fewest words a character update must quote from its own messages, or it's dropped |
| `replyLength` | `short` | enum `short`, `normal`, `long` | How long its replies are |
| `styleNotes` | empty | string (textarea) | Anything else about how it writes, added at the end of the style rules |
| `storiesGuidance` | "Things that happened to you that you've already told people about. Only go into one if someone asks about it or brings it up; never retell one on your own." | string (prompt) | How the model should use stories it has told, above them |
| `characterInstructions` | see *Character updater* | string (prompt) | Instructions for the model that saves what it says about its own life to the character sheet |

**Changed texts**:
- `characterGuidance` = today's text plus "You can make up new things about your life when it fits, as long as nothing contradicts this."
- `loreInstructions` and `profileInstructions` are reworded to describe only server lore and notes (no self kind), with the bot's own life "kept elsewhere".
- `fillInstructions` is updated for the 10 fields and asks for 2 to 4 stories. "Write in English" becomes "Write in {language}", where `{language}` is `style.language` or "the main language spoken there".
- `language` description: "Language it always writes in, like Norwegian. Its character sheet is written in it too. Empty to match the chat".
- `loreEnabled` description: "Keep server lore (running jokes and shared history) and show it to the model".
- `loreEvidenceWords` description: "Fewest words a lore update must quote from the chat to back it up".

**Removed settings**:
- From the old chat module: `judgeCandidates`, `openerMemory`, `openerRepeatLimit`, `skipMaxWords`, `quietTypingMs`, `starterFromHour`, `starterToHour`, `starterChance`, `loreRandomFill`.
- From personality: `rules` (now `behaviour`), `format` (now generated), `selfLoreGuidance`, `repeatedOpenerNote`, `oneLineNote`, `skipNote`, `skipMarker`.
- The whole `character` and `channels` modules.

**New code constants**:
- `OPENER_MEMORY = 5` and `OPENER_HABIT_LIMIT = 2` (the repetition score only).
- `STARTER_FROM_HOUR = 10`, `STARTER_TO_HOUR = 23`, `STARTER_CHANCE = 0.1`.
- The one line and several lines note texts.
- The transcript format line.
- The character caps (below).

### Prompt layout

The system prompt is built in this order. Empty sections are left out.

1. `identity.persona`
2. `## Who you are`: `characterGuidance`, then the sheet without stories (text fields as `- Work: …`, lists as nested items, quirks sampled)
3. `identity.behaviour`
4. `## Context`: name, server, channel, current time (no language line any more)
5. `## People in the chat`: `peopleGuidance` + notes (unchanged)
6. `## Stories you've told`: `storiesGuidance` + matched stories, only when any matched
7. `## Server lore`: `serverLoreGuidance` + matched entries
8. `## Style`, generated in this order:
   - Constant: `Chat messages are shown as "Name: text". Reply with only your message, no name prefix. No headings or bullet lists.`
   - Language: empty → `Write in the language most of the chat is in, even when the last message is short or has an English word in it.` Set → `Always write in {language}, whatever language a message is in.`
   - `lowercaseReplies` on → `Write in all lowercase.`
   - `stripEmojis` on → `Never use emojis.`
   - Length: `short` → `Keep it short: often just a few words.` `normal` → `Keep it to a sentence or two.` `long` → `Write a few sentences when you have something to say, less when you don't.`
   - `styleNotes`, if set.

`buildInstructions` takes an option `{ style: false }` that leaves the `## Style` section out, for callers that don't write chat messages (the voice feature on `test/voice`).

The per reply line count goes in the note after the last message, as `oneLineNote` does today. One line: `write just one line this time.` Several: `you may write up to {maxMessages} short lines this time; each line is sent as its own message.`

### Data model

**`character_entries`** (new)

| Column | Type | Rule |
|---|---|---|
| `id` | serial | primary key |
| `guildId` | text | required |
| `field` | text | required, one of the 10 field names below |
| `text` | text | required, 1 to `CHARACTER_TEXT_MAX` (300) characters; the updater and filler are told at most 40 words |
| `locked` | boolean | required, default false |
| `source` | text | required: `manual`, `filled` or `chat` |
| `usedAt` | timestamp | nullable, set when a story is matched into a prompt |
| `createdAt`, `updatedAt` | timestamp | required, default now |

Index on `(guildId, field)`.

**`character_fields`** (new): `guildId` text, `field` text, `locked` boolean (default false), `updatedAt`. Primary key `(guildId, field)`. A missing row means unlocked.

Rows are always listed in `createdAt, id` order, on the page and in the prompt.

**Field definitions** are a shared constant in `packages/db/src/character.ts`, exported on a db free subpath `@klyndre/db/character` (add `"./character"` to the package's `exports`, like `./lore`), so the web client bundle never imports `pg`. The bot and the dashboard both use it:

| Field | Kind | Cap | Description (also used by the filler) |
|---|---|---|---|
| `basics` | text | 1 | Age, gender, what they look like |
| `home` | text | 1 | Where they live, who with, and where they grew up |
| `work` | text | 1 | Job or school, and what they think of it |
| `routine` | text | 1 | A normal week: when they work, sleep, train, game and go out |
| `family` | list | 6 | Family, with names |
| `friends` | list | 6 | Friends and love life outside this server, with names |
| `interests` | list | 6 | Hobbies, favourite music, games, shows and food, and what they know a lot about |
| `opinions` | list | 6 | Hot takes, pet peeves and things they can't stand |
| `quirks` | list | 6 | Habits, and things they say now and then |
| `stories` | list | 20 | Things that happened to them, stories they can tell |

**`lore_entries`** (changed): drop `kind`. The unique index becomes `(guildId, lower(key))`. `loreKinds`/`LoreKind` go away.

**`prompt_presets`** (unchanged shape): only `kind = 'persona'` is used from now on.

**`guild_settings`** (unchanged shape): new module names as in *Settings layout*.

### Character filler

It's today's `fillBlanks`, now reading and writing rows:
- **Blank** means a field with no rows whose `character_fields.locked` is not true.
- **Inputs:** the bot name (from the chat context), `replies.timeZone`, `style.language` (falling back to "the main language spoken there"), and the filled fields as known context.
- **Output:** the 5 sketch step is kept. Text fields come back as one string, lists as 2 to 4 items (stories included), written in the `{language}` above. Empty items and items over `CHARACTER_TEXT_MAX` are dropped and logged. Rows are inserted with `source = 'filled'`, never past a field's cap, under the write lock below.

### Character updater

- **Trigger:** after a reply is sent with outcome `reply` (in the handler and in starters), when `learnFromChat` is on and the reply contains a word from `selfWords`. Word check: lowercase the reply, turn `’` into `'`, split on whitespace, and trim anything that isn't a letter, digit or apostrophe from each end.
- **One at a time:** a per server in memory job set, shared with the filler, so only one character job runs at a time in the bot. A trigger that arrives while a job runs is skipped; the next self talk reply reads the chat again, so nothing is lost for good.
- **Call:** `replies.model`, temperature 0, structured output, `internals.characterInstructions` as instructions.
- **Input:** the history messages the handler already built, plus the sent reply, as a transcript with the bot's lines marked (same as the lore updater), and the current sheet with each item's id, field, source and locked flag and each field's lock.
- **Output schema:** a list of actions, each with `evidence`:
  - `{ op: "add", field, text }`
  - `{ op: "replace", id, text }`
  - `{ op: "remove", id }`
- **Applying the actions** (inside the write lock, against the rows read again there):
  1. Drop any action without enough evidence.
  2. Drop any action on a locked field or a locked item, any `remove` of a `manual` item, and any `id` that isn't a row of this server read in the snapshot the model was shown.
  3. Drop an `add` or `replace` whose text is empty or over `CHARACTER_TEXT_MAX`.
  4. `add` to a text field that already has its row becomes a `replace` of that row.
  5. `add` to a full list field is dropped, except for stories, which run the eviction (AC-11).
  6. `replace` keeps the row's `createdAt`, and sets `source = 'chat'`.
  7. Log every applied and dropped action.
- **Evidence:** the same check the lore updater uses for self lore today, against the bot's own lines only, with `characterEvidenceWords`.
- **`characterInstructions` default:**

  > You keep the character sheet for a chat bot that plays a regular member of a Discord server. The chat is a transcript: every line starts with who wrote it, and the bot's own lines are marked (bot).
  > Save only lasting things the bot's own lines say about its own life: family, friends, home, work, routine, interests, opinions, habits, and things that happened to it (stories). What other people say about themselves, or about the bot, is never a fact about the bot unless the bot's own lines go along with it.
  > Skip anything already on the sheet, even when said again in other words. Skip what the bot denies, jokes it clearly doesn't mean, and nonsense it says to dodge a question.
  > For every action, copy the bot's words it's based on into evidence, exactly as written. Use add for something new, replace to change an item by its id (keeping what still holds), and remove only when the bot's lines clearly contradict an item. Never touch items marked locked or fields marked locked.
  > A story is one thing that happened, told in at most 40 words. Every other item is at most 40 words. Write in the language the sheet is already in.
  > Return only actions for things that are new or changed. If nothing is, return an empty list.

### Story matching

A new `pickStories(guildId, humanText)` sits beside `pickLore`, and is called from `handler.ts`, `starters.ts` and `test-prompt.ts`. Its result travels with the lore bundle into `buildInstructions`.
- **Ranking:** stories go through the same ranking as lore. A story has no key, so every word of its text counts as a note word under the `loreNoteWordLength`/`loreRareWordLimit` rules, and the rare word count is taken over stories only.
- **What it doesn't do:** none of lore's "locked entries always shown" or cooldown rules apply. It ignores `loreEnabled`, and returns nothing when `storiesShown` is 0.
- **Input and limit:** matching runs against `humanText` (only what people wrote) and takes at most `storiesShown`.
- **`usedAt`:** set on the stories shown by a step after the reply is sent (beside `noteUsage`), so building a prompt never writes. The test prompt script never calls it.

### API surface (dashboard server functions)

All functions take `guildId` and run `assertBotInGuild`. Every query by id also filters by `guildId`.

| Function | Auth | Inputs | Output | Errors |
|---|---|---|---|---|
| `getCharacter` | logged in | `guildId` | fields (definition, locked, items with id, text, locked, source) | |
| `addCharacterEntry` | admin | `field`, `text`, `locked` | entry | field unknown; field full (`"family is full (6)"`) |
| `updateCharacterEntry` | admin | `id`, `text`, `locked` | entry | not found |
| `deleteCharacterEntry` | admin | `id` | ok | not found |
| `setCharacterFieldLocked` | admin | `field`, `locked` | ok (upsert) | field unknown |

Entries added on the page get `source = 'manual'`. Editing changes `source` to `manual` only when the text changes, so locking or unlocking keeps the badge. Text is trimmed and must be 1 to `CHARACTER_TEXT_MAX` characters. Each field section on the page says that a lock keeps an item as written, but a locked story still only shows when the chat matches it (unlike locked lore, which is always in the prompt). Lore server functions drop the `kind` input.

### Write lock

Every write to `character_entries` or `character_fields` (server functions, filler, updater, story eviction) runs in one transaction that first takes `pg_advisory_xact_lock(hashtext('character:' || guildId))`. Inside it, it reads the field's rows again, checks caps and locks against those rows, and writes. This makes count then insert safe and keeps an admin's edit from being lost to an updater that read the sheet before the model call. It also covers the test prompt script's `fillCharacter`, which runs outside the bot's in memory job set. `usedAt` updates don't need the lock.

### Value sourcing

| Action | Value | Source |
|---|---|---|
| Build prompt | Style lines | the `style` module settings |
| Build prompt | Per reply line count note | roll against `style.multiMessageChance`, `style.maxMessages` |
| Build prompt | Sheet | `character_entries` for the guild, minus stories, quirks sampled by `identity.quirksShown` |
| Build prompt | Matched stories | `character_entries` (field `stories`) ranked against `humanText` from `buildHistory` |
| Fill blanks | Time zone, language, name | `replies.timeZone`, `style.language`, `chatContext.botName` |
| Fill blanks | Which fields are blank | no rows in `character_entries` and `character_fields.locked` not true |
| Update character | Whether to run | reply outcome is `reply`, reply words ∩ `identity.selfWords`, `identity.learnFromChat` |
| Update character | Model, temperature | `replies.model`, 0 |
| Update character | Which rows an id may name | the snapshot shown to the model, read again inside the write lock |
| Update character | Bot's own lines for evidence | assistant messages in the handler's history plus the sent reply |
| Update character | Caps | the shared field definitions |
| Evict story | Which story | unlocked story with the smallest `coalesce(usedAt, createdAt)` |
| Character page | Source badge | `character_entries.source` |
| Character page | Field lock | `character_fields.locked`, false when no row |

### Key invariants

- A locked item or locked field is never changed, removed or filled by the bot. Only an admin changes it.
- The bot never removes a `manual` item. It may only replace it (with evidence), and only if it isn't locked.
- A field never holds more rows than its cap. The server functions, the filler and the updater all enforce this inside the write lock.
- Building a prompt never writes to the database.
- Stories never reach the prompt unless they're matched.
- Nothing outside the generated Style section states language, case, emojis, length or line count.
- Bare `i` is left out of `selfWords` because it means "in" in Norwegian and would trigger the updater on nearly every Norwegian reply. Lowercased English "I" is caught through `i'm`/`i've`/`me`/`my` in most self talk.

### Security model

Same as the Lore and Profiles pages: logged in users (`viewer` or `admin`) can read, only `admin` can write, and every request is scoped to a guild the bot is in. No new secrets and no personal data beyond what notes already hold.

### Observability

Console logs with a `[character]` prefix:
- fields filled
- each update applied (`~ family: …`, `+ story: …`)
- each change dropped, with the reason
- each story evicted
- a job skipped because another is running

### Configuration required

No new environment variables.

### Critical test scenarios

- Set language to Norwegian, build a prompt with `test-prompt`, and check it states Norwegian once and nowhere says to match the chat. **AC-2**, **AC-3**
- Turn lowercase off, then check the prompt has no lowercase line and a reply keeps its capitals. **AC-4**
- Lock `family`, have the bot say "my brother Ola" in chat, and check the change is dropped and logged and family is unchanged. **AC-10**
- Add a `manual` friend, have the updater return `remove` for it, and check it stays. **AC-10**
- Start an updater call, add an admin item before it returns, and check the admin item survives. **AC-10**, **AC-13**
- Fill `stories` with 20 unlocked stories, learn a 21st, and check the least recently used one is removed. Then lock all 20 and check the 21st is dropped. **AC-11**
- Send a message that doesn't mention any story, and check the prompt has no stories section. Then, with a story saved about crashing a sailboat at Hvaler, send "remember when you crashed that sailboat at hvaler", and check it shows and `usedAt` updates only after the reply is sent. **AC-12**
- Fire two self talk replies at once in one guild, and check that only one updater call runs. **AC-9**
- As a viewer, call `addCharacterEntry`, and check it's rejected. As an admin, add a 7th family item, and check it's rejected. **AC-13**
- Delete every filled `work` row, and check it's made up again on the next reply. Then lock the empty field, and check it stays empty. **AC-8**
- Run the migration on a database with self lore and old settings, and check the bot starts, the settings page shows the new tabs, and the Lore page shows only server lore. **AC-1**, **AC-14**, **AC-19**

## Build plan

There's no build approach on record (no `AGENTS.md`, no scope), so this assumes end to end slices. Dropping `kind` and the old modules breaks their callers at once, so typecheck only holds again from the end of task 4 (bot) and task 3 (dashboard). Run `pnpm typecheck` at the end of each task from task 4 on.

1. **Data.** Add `packages/db/src/character.ts` (field definitions, `CHARACTER_TEXT_MAX`) on the `./character` export, the `character_entries` and `character_fields` schemas, and the `lore_entries` change. Generate one migration with `drizzle-kit generate`, then hand edit it so these deletes come **first**, before any `DROP INDEX`/`DROP COLUMN`:
   - delete self lore rows
   - delete the `guild_settings` rows for `chat`, `channels`, `personality` and `character`
   - delete all `prompt_presets`

   Dev uses `drizzle-kit push --force`, which skips hand edits, so reset the dev database (`pnpm db:down`, remove the volume, `pnpm dev`) instead of pushing over old data. Satisfies **AC-11**, **AC-14**, **AC-19**.
2. **Config.** Rewrite `packages/config` defaults and schemas into the `identity`, `style`, `replies`, `memory`, `internals` modules (plus `musicChannelIds` in `music`), in the tab order from *Settings layout*. Remove the removed settings, and add the new settings with their bounds and descriptions. Satisfies **AC-1**, **AC-16**, **AC-17**.
3. **Dashboard settings form.**
   - Add a `select` field kind for zod enums (`replyLength`).
   - Set the default tab in `routes/_authed/guilds/$guildId/settings/index.tsx` to `identity`.
   - Set `promptKinds` in `features/prompts/lib/prompt-kinds.ts` to `["persona"]`. `isPromptKind` already gates the preset bar and `kindInput` the server functions.

   Satisfies **AC-1**, **AC-5**, **AC-18**.
4. **Bot settings and cuts.**
   - Point every `getSettings` call at the new modules, including `music/access.ts` (`channels` to `music`).
   - Remove staying quiet (`canSkip`, `mayStayQuiet`, `isSkip`, the quiet typing delay, the `quiet` outcome), always type as soon as the bot will answer, and send `fallbackReply` when a reply is empty after styling.
   - Remove the opener note and retry, use the opener constants in scoring, and run the judge whenever 2 or more candidates make the shortlist.
   - Move the starter hours and chance to constants.

   Satisfies **AC-15**, **AC-16**, **AC-17**.
5. **Prompt rebuild.**
   - Rebuild `prompt.ts` in the *Prompt layout* order, with the `{ style: false }` option.
   - Generate the Style section and the per reply line note (one line whenever the rolled count is 1, including `maxMessages` 1), and drop the language line from Context.
   - Keep `styleReply` enforcing lowercase and emojis from `style`.

   Satisfies **AC-2** to **AC-6**.
6. **Character from rows.** Load the sheet from `character_entries` in `createdAt, id` order, render `## Who you are` without stories, and sample quirks. Move the filler to rows with field locks, caps, the write lock, the `{language}` rule, and stories. Satisfies **AC-7**, **AC-8**.
7. **Character updater.** Add the self word trigger (handler and starters, outcome `reply` only), the shared per server job set, the `characterInstructions` call, and the action rules, evidence check, write lock and eviction, with `[character]` logs. Satisfies **AC-9**, **AC-10**, **AC-11**.
8. **Story matching.** Add `pickStories` beside `pickLore` (handler, starters, test script), generalise the lore ranking so it takes stories, add the `## Stories you've told` section, and set `usedAt` after sending. Satisfies **AC-12**.
9. **Lore to server only.** Remove `kind` from the lore code, the updater schema and prompt, `selectLore` (no random self fill) and the Lore page and server functions. Stop passing the character sheet to the lore updater (`lore.ts`, the "never save as self lore" block). Satisfies **AC-14**.
10. **Character page.** Add the route `guilds/$guildId/character` and its entry in the page nav in `routes/_authed/guilds/$guildId/route.tsx`, beside Lore and Profiles. Include the server functions in the API table, sections per field with the lock note, source badges, item and field locks, add/edit/delete, and the cap error. Satisfies **AC-13**.
11. **Docs and script.** Update `apps/bot/src/scripts/test-prompt.ts` (new outcomes, `pickStories`, no writes) and the README (tabs, character, stories, no staying quiet). Satisfies **AC-20**.

## Migration plan

- **Strategy:** a single deploy. Data is reset rather than moved: the engineer confirmed every existing row is throwaway.
- **Phases:** one migration (build plan task 1), deployed together with the code. `migrate` runs before `bot` and `web` start (as `docker-compose.yml` already does).
- **Rollback:** reverting the commit doesn't bring back the deleted settings, self lore or presets. Since they're throwaway, a rollback is: restore the previous image, then restore a database backup taken before the deploy if the old data is wanted at all.
- **Risks:**
  - A server that tuned prompts loses them. This is accepted.
  - The hand edited migration has to run its deletes before the `kind` drop and index change, or the unique index creation can fail on duplicate keys across the old kinds.
  - `drizzle-kit push` (dev) skips the hand edited deletes, so dev needs a reset rather than a push.

## Consequences

**Positive**:
- Each behaviour is controlled from one tab, and settings and prompt can no longer contradict each other on language, case, emojis or length.
- The bot's life lives in one place, you can see what it invented and lock it, and it stops retelling stories.
- About 15 settings and 6 prompt texts disappear, which also removes the staying quiet and opener retry code paths.

**Negative / tradeoffs**:
- More model calls per reply. Best of n stays at up to 4 calls, and the character updater now runs after most replies where it talks about itself (on top of the lore and notes updaters every N replies). Expect roughly one extra call on most replies.
- Without staying quiet, it answers "ok" and "ye" in AI channels, which can drag conversations past their end.
- A new table and page to maintain, where a settings module would have reused the generic form.
- Keeping the lore and chat tuning knobs as advanced settings leaves a long Advanced list in Replies and Memory.
- `selfWords` is language specific. A server chatting in another language needs it edited, or the updater rarely runs.

**Neutral**:
- All servers start from defaults after the deploy.
- `docs/specs/_root/0001-lore` stays the record for server lore; its self lore half is superseded by this spec.

## Follow-up

- [ ] After a week of real use, check the `[character]` logs for how often the updater runs, and whether its skipped jobs lose details. If the call count hurts, move it to every N replies like lore.
- [ ] Watch whether answering every "ok" in AI channels feels wrong. If so, revisit staying quiet with a simpler rule than the old marker.
- [ ] Rebase `test/voice` after this lands. Its `voice/prompt.ts` reads `getSettings("chat")` and `selectLore` (expecting random self fill), and leans on the "chat format rules above" text. Move it to the new modules and call `buildInstructions(..., { style: false })` so lowercase and one line rules don't leak into speech.
- [ ] `/sync` should pick up the new module layout in any context files.
