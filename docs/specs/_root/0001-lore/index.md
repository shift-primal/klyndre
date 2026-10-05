# 0001. Lore: the bot's own life and the server's running jokes

**Date**: 2026-10-05
**Status**: Accepted

## Summary

The bot gets a memory for two kinds of lore per server: its own made up life (friends, family, job) and things the group shares (running jokes, recurring topics). Relevant entries go into the prompt, a background updater learns new ones from chat, and admins manage everything on a web page like profiles. The design is shaped by what went wrong in guttasjefen, where lore snowballed and the bot kept bringing up the same things. So matching only counts what humans say, always on entries cool down after use, and the updater is strict and capped.

## Requirements

**User stories**:
- As a chatter, I want the bot to remember what it said about its own life, so that its cousin Arne is still its cousin next week.
- As a chatter, I want the bot to get our running jokes when we bring them up, so that it feels like part of the group.
- As a chatter, I don't want the bot to keep steering every chat back to the same few facts or jokes.
- As an admin, I want to write seed lore by hand that the bot always knows and never rewrites.
- As an admin, I want to see, fix and delete what the bot learned, from the web app.

**Scope**:
- In: one `lore_entries` table per guild with `self` and `server` kinds, prompt selection, background updater, web page, settings.
- Out: a Discord `lore` command (the web page replaces it), embeddings or vector search, facts about individual people (that is profiles), and `/reset` (it leaves lore alone, since lore isn't per user).

**Acceptance criteria**:
- **AC-1**: With `loreEnabled` on, an entry whose key words or rare note words appear in a human message in the history window is put in the prompt under its kind's section (`## Your life` for `self`, `## Server lore` for `server`), with that kind's guidance text above the entries. At most `loreShown` matched entries are included, highest score first.
- **AC-2**: The bot's own messages never count toward matching. An entry that only the bot has mentioned in the window is not selected by relevance.
- **AC-3**: Locked entries are in the prompt even when nothing matches them, except an unmatched locked entry that one of the bot's replies in that channel used within the last `loreCooldownReplies` replies. An entry a human just mentioned is always eligible, cooldown or not ("what about your cousin Arne?" → "so what's he up to?" keeps working).
- **AC-4**: Up to `loreRandomFill` (default 0) unmatched, unlocked `self` entries are added at random, following the same cooldown rule. `server` entries are never added at random.
- **AC-5**: When no entries are selected, no lore section or guidance appears in the prompt. With `loreEnabled` off, there are no lore sections and the updater never runs.
- **AC-6**: Every `loreUpdateEvery` replies in a channel, the updater runs on that window's history plus the reply the bot just sent. New keys are inserted. An existing key is updated only when its notes text actually changed (otherwise `updatedAt` stays the same). A change with `replaces` renames the old entry.
- **AC-7**: The updater never creates, changes, renames or deletes a locked entry, and it deletes nothing except the old key in a rename.
- **AC-8**: A single updater run inserts at most `loreMaxNewPerUpdate` new keys. Extra new keys are dropped and logged.
- **AC-9**: After each updater run, the guild has at most `loreMaxEntries` unlocked entries. Any extras are deleted, oldest `updatedAt` first. Locked entries are never evicted.
- **AC-10**: A key is unique per guild, kind and case insensitive key. When the updater writes `arne`, it updates the existing `Arne`.
- **AC-11**: When the updater fails (model error, invalid output), it logs the error and changes nothing, and the reply already sent is unaffected. Two runs never overlap for the same guild. A run skipped because another was in progress is retried on the channel's next reply.
- **AC-12**: Any signed in user can open a Lore page for a guild, with `Self` and `Server` tabs, a search over key and notes, and for each entry its key, notes, locked state and last update time. An empty tab shows an empty state message.
- **AC-13**: An admin can create an entry (kind, key, notes, locked), edit an entry's key, notes and locked state, delete one entry, and use "Delete all unlocked" in the current tab after a confirm. For everyone else the page is read only, and the server rejects their mutations.
- **AC-14**: Key is trimmed, 1 to 80 characters. Notes are trimmed, 1 to 1000 characters. Creating or renaming to a key that already exists in that guild and kind shows a clear error. Editing or deleting by an id that belongs to another guild fails.
- **AC-15**: Every lore tunable is a setting in `@klyndre/config`, shows up in the web settings form, and `loreInstructions` can be saved as a prompt preset.

## Decision

**Chosen option**: Option 2: one table with a `kind` column, plus guards against loops.

Lore is a per guild table of `self` and `server` entries, selected by keyword relevance against human messages only, with locked seed entries on a per channel cooldown when unprompted, learned by a separate, strict, capped updater every N replies, and managed on a web page.

Decisions made at write time (each with the runner up):
- **Rare word markers without a stop word list.** Note words of 5 or more letters count as markers only when they appear in fewer than 3 entries' notes in this guild's lore. This needs no word list and works in any language. Key words (3 or more letters) count double. Runner up: a configurable ignored words setting (one more setting to keep up to date).
- **Human text comes from Discord, not by parsing prompt lines.** `buildHistory` also returns `humanText`: the `cleanContent` of every non bot message in the window, without the `Name:` prefix. Otherwise a chatter named Arne would match the cousin Arne on every message they send. Runner up: strip the prefix from model messages (fragile, and picks up the answering marker).
- **A reply "uses" an entry** when any of that entry's markers appear in the reply text. Runner up: ask the model to report which entries it used (an extra structured field on every reply).
- **Cooldown and reply counters live in memory**, per channel, like the profiles counters. A restart clears them, which only means an entry can show up one cooldown early. Runner up: a DB column (a write on most replies, for no real gain).
- **Updater output is structured** (AI SDK `Output.object` with zod, like profiles): `{ changes: [{ kind, key, notes, replaces? }] }`. There is no null delete, and `replaces` is the only way to remove a key. Runner up: the old free JSON map with null values (it needed `parseJsonObject` and allowed any delete).
- **The updater sees part of the lore, not all of it**: entries scored against the whole window (bot replies included, since this is for recognising, not prompting), top 20 with full notes, plus every locked entry and a list of the other keys. Runner up: send all entries in full (up to about 200 × 40 words on every run).
- **Writes use select then write** in one transaction, not `onConflictDoUpdate`, because the unique index is on `lower(key)`. The per guild lock stops the bot racing itself, and a clash with a web edit fails on the unique index and gets logged.
- **Kind can't be changed after creation**. An admin who wants to switch it deletes the entry and creates it again. Runner up: a kind select in the edit form (more UI for something that rarely happens).
- **No pagination** on the list. It's limited by `loreMaxEntries` plus the locked entries, and loaded once like profiles.
- **Default prompt text is in English**, like the other defaults, and the updater writes notes in the chat's language.

**Implementation skills**: `shadcn` (the web page uses the existing `tabs`, `switch`, `item`, `textarea`, `input`, `button`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

`lore_entries` (`packages/db/src/schema/lore-entries.ts`, exported from `schema/index.ts`)

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | serial | no | PK |
| `guildId` | text | no | |
| `kind` | text | no | `"self"` or `"server"` (checked in zod, same text style as `prompt_presets.kind`) |
| `key` | text | no | 1 to 80 chars, a name (`Arne`) or short label (`the cousin`) |
| `notes` | text | no | 1 to 1000 chars |
| `locked` | boolean | no | default `false` |
| `createdAt` | timestamp | no | default now |
| `updatedAt` | timestamp | no | default now |

- Unique index `lore_entries_guild_kind_key` on `(guildId, kind, lower(key))`. Because `guildId` comes first, it also handles loading by guild.
- No FKs (there's no guilds table, same as `profiles`).

**State transitions**: there's no status column. An entry's life: created (by the updater, or by an admin) → updated (notes changed) → renamed (updater `replaces`, or an admin key edit) → evicted (unlocked only, updater over the cap) or deleted (admin). `locked` can be switched either way by an admin at any time.

**Bot internals** (`apps/bot/src/features/chat/lore.ts`):

| Function | Inputs | Output | Notes |
|---|---|---|---|
| `loadLore(guildId)` | guild id | all entries | one query per reply, no cache (same as profiles) |
| `selectLore(entries, humanText, channelId, settings)` | loaded entries, human text, channel | `{ self: Entry[], server: Entry[], unprompted: Entry[] }` | matched (score > 0, top `loreShown`) + unmatched locked not on cooldown + `loreRandomFill` random unlocked self not on cooldown |
| `noteUsage(channelId, unprompted, reply)` | the unprompted entries that were shown, the sent reply | none | decrements this channel's cooldowns by 1, then puts each unprompted entry whose markers appear in the reply on cooldown for `loreCooldownReplies` |
| `maybeUpdateLore(message, history, reply)` | trigger message, window history, sent reply | none | the counter, per guild lock, model call, and applying the changes |

`words(text)` goes in `apps/bot/src/lib/utils/text.ts`: lowercase, split on anything that isn't `\p{L}` or `\p{N}`, returns a `Set<string>`.

**Prompt rendering** (`prompt.ts`): two optional sections after `## People in the chat` and before `## Format`:

```
## Your life
<selfLoreGuidance>

- <key>: <notes>

## Server lore
<serverLoreGuidance>

- <key>: <notes>
```

A section is left out when it has no entries.

**Updater apply rules** (in one transaction, in this order):
1. Drop changes with an empty key or notes, a key over 80 chars, or notes over 1000 chars.
2. Drop any change whose key, or whose `replaces`, matches a locked entry of the same kind (case insensitive).
3. A change with a `replaces` that exists: if the new key already exists, update it and delete the old row. Otherwise update the old row's key and notes (it keeps its id). A rename doesn't count as new.
4. A change whose key exists (and no `replaces`): update only when the trimmed notes differ, and set `updatedAt`.
5. Everything else is new. Insert the first `loreMaxNewPerUpdate` of them and log the rest as dropped.
6. Count unlocked entries for the guild. If there are more than `loreMaxEntries`, delete the oldest by `updatedAt` until it's at the cap.
7. Log each change: `[lore] + self/Arne: ...`, `[lore] ~ ...`, `[lore] > fetteren → Arne`, `[lore] evicted ...`, `[lore] dropped ...`.

**API surface** (TanStack Start server functions, `apps/web/src/features/lore/server/lore.functions.ts`):

| Function | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `listLore` | GET | `guildId` | all entries for the guild, ordered by kind, then `lower(key)` | `authMiddleware` + `assertBotInGuild` | bot not in guild |
| `createLore` | POST | `guildId`, `kind` (`self`\|`server`), `key` (1..80), `notes` (1..1000), `locked` | the entry | `adminMiddleware` | "`<key>` already exists in `<kind>` lore" on unique clash, validation |
| `updateLore` | POST | `guildId`, `id`, `key`, `notes`, `locked` | the entry | `adminMiddleware` | "That entry no longer exists" (no row for `id` + `guildId`), key clash, validation |
| `deleteLore` | POST | `guildId`, `id` | none | `adminMiddleware` | none (deleting a missing row does nothing, like profiles) |
| `deleteUnlockedLore` | POST | `guildId`, `kind` | count deleted | `adminMiddleware` | none |

Every query that uses `id` also filters on `guildId`.

Web files follow the profiles feature: `lib/lore-queries.ts` (query key `["guilds", guildId, "lore"]`), `hooks/use-lore.ts`, `hooks/use-lore-actions.ts`, `components/lore-list.tsx` (tabs, search, create form, delete all unlocked), `components/lore-card.tsx` (draft editing like `profile-card.tsx`, plus a locked switch), route `routes/_authed/guilds/$guildId/lore/index.tsx`, and `"lore"` added to the nav list in `$guildId/route.tsx`.

**Settings** (`packages/config/src/defaults.ts` + `schemas.ts`; the settings form renders them automatically):

| Module | Key | Type | Default | Description |
|---|---|---|---|---|
| chat | `loreEnabled` | boolean | `true` | Keep lore (its own life and the server's running jokes) and show it to the model |
| chat | `loreShown` | int 0..30 | `6` | Most lore entries matched to the chat that go in the prompt |
| chat | `loreRandomFill` | int 0..10 | `0` | Random bits of its own life added to the prompt on top of the matched ones (0 for none) |
| chat | `loreCooldownReplies` | int ≥ 0 | `10` | Replies before lore it brought up unprompted can show up unprompted again (0 for no cooldown) |
| chat | `loreUpdateEvery` | int ≥ 1 | `5` | Replies in a channel between lore updates |
| chat | `loreMaxEntries` | int ≥ 1 | `200` | Most unlocked lore entries per server. The stalest ones are removed past this |
| chat | `loreMaxNewPerUpdate` | int ≥ 0 | `2` | Most new lore entries one update may add |
| personality | `loreInstructions` | string min 1, `prompt` widget | below | Instructions for the model that updates the lore |
| personality | `selfLoreGuidance` | string, `prompt` widget | below | How the model should use its own life, above those entries |
| personality | `serverLoreGuidance` | string, `prompt` widget | below | How the model should use server lore, above those entries |

Starting default text (tune it after seeing it in use):

`selfLoreGuidance`:
> Facts about your own life, from earlier chats. Stay consistent with them, and you can make up new details that fit. This is background, not material: don't bring it up unless someone asks or the chat is already about it, and don't repeat a detail you've already mentioned.

`serverLoreGuidance`:
> Running jokes and shared history in this server. Only reference them when the chat naturally touches them. Never force a callback, and don't repeat one you've already made.

`loreInstructions`:
> You keep the lore for a chat bot in a Discord server. There are two kinds:
> - self: the life the bot makes up for itself while chatting (friends, family, where it lives, its job, things it has done).
> - server: things the group shares (running jokes, recurring topics, events, places). Never facts about one person; those are kept elsewhere.
>
> Save only lasting, new information. For self: what the bot's replies say or confirm about its life, including things others claim that it goes along with. Not what it denies, not insults dressed up as answers, not nonsense it says to dodge a question. For server: a joke or topic that keeps coming back, not a single remark.
> Skip anything already known, even when it's said again in other words. Never save an entry again just because it came up.
>
> Use a name as the key when there is one, otherwise a short description ("the cousin"). Reuse existing keys exactly. When something listed under a description gets a name, save it under the name and set replaces to the old key. Write the full updated notes for every key you change, keeping what still holds, at most 40 words, in the chat's language.
> Return only entries that are new or changed. If nothing is, return an empty list.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| select lore | text to match against | `humanText` from `buildHistory`: `cleanContent` of non bot messages in the window |
| select lore | entry markers | derived: `words(key)` (3+ letters, weight 2) + `words(notes)` (5+ letters, in fewer than 3 entries' notes, weight 1) |
| select lore | score | derived: sum of the weights of markers found in `words(humanText)` |
| select lore | on cooldown? | in memory `Map<channelId, Map<entryId, repliesLeft>>` in `lore.ts` |
| select lore | limits | settings `loreShown`, `loreRandomFill`, `loreCooldownReplies` |
| render prompt | section guidance | settings `selfLoreGuidance`, `serverLoreGuidance` |
| note usage | the reply text | return value of `sendReply` (it now returns the sent text or `null`) |
| updater | when to run | in memory per channel reply counter in `lore.ts` + `loreUpdateEvery` |
| updater | busy? | in memory `Set<guildId>` in `lore.ts` |
| updater | chat it reads | `messages` from `buildHistory` + `{ role: "assistant", content: reply }` |
| updater | known lore shown to it | `loadLore` scored against all window text (bot included), top 20 + locked + other keys |
| updater | model | settings `chat.model`, through `chatModel` |
| updater | new key cap, entry cap | settings `loreMaxNewPerUpdate`, `loreMaxEntries` |
| eviction | which entry goes | `updatedAt` column, oldest first, `locked = false` only |
| web list | entries, updated time | `lore_entries` rows (`updatedAt`) |
| web | read only? | `session.user.role !== "admin"` (same as profiles) |
| web mutations | guild scope | `guildId` input, checked together with `id` in the `where` clause |

**Key invariants**:
- `(guildId, kind, lower(key))` is unique (enforced by the DB).
- The updater never writes or deletes a row with `locked = true` (enforced in the app, apply rule 2).
- After each updater run: unlocked entries per guild ≤ `loreMaxEntries`.
- A single updater run adds ≤ `loreMaxNewPerUpdate` new rows.
- Bot messages never add to a relevance score.
- `updatedAt` changes only when key or notes actually change (or `locked`, on a web edit).

**Security model**: lore is per guild bot content, not personal data, and individual facts are kept out by the updater instructions and AC boundary. Read access: any signed in web user, for guilds the bot is in (same as profiles). Write access: global `admin` role through `adminMiddleware`. Every write is scoped by `guildId`, so an id from another guild can't be edited. Lore text goes into prompts, so an admin could write instructions into an entry. That's accepted, since admins already control the whole persona.

**Configuration required**: no new env vars. The updater uses the existing `XAI_API_KEY`.

**Critical test scenarios**:
- Happy path: someone mentions "Arne", the `self` entry `Arne` shows up under `## Your life` with the guidance, and the bot's reply is about Arne. Verifies **AC-1**.
- Loop break: the bot mentions Arne on its own, and the next human message is about something else, so `Arne` isn't selected. Verifies **AC-2**.
- Cooldown: a locked entry is used in an unprompted reply, then is missing from the next `loreCooldownReplies` prompts in that channel. But a human saying its key brings it back right away. Verifies **AC-3**.
- Random fill: with `loreRandomFill = 2`, two unmatched unlocked self entries are added, and no server entries. Verifies **AC-4**.
- Disabled or empty: no lore sections, and no updater call. Verifies **AC-5**.
- Learn and rename: the bot makes up "fetteren" and is later asked his name ("arne"), so the updater writes `Arne` with `replaces: "fetteren"`. The result is one row, the same id, with the key `Arne`. Verifies **AC-6**, **AC-10**.
- Restating doesn't bump: the updater returns unchanged notes for an existing key, and `updatedAt` stays the same. Verifies **AC-6**.
- Locked is safe: the updater tries to change, or replace, a locked key, and the row stays the same. Verifies **AC-7**.
- Growth caps: the updater returns 5 new keys with the cap at 2, so 2 are inserted and 3 logged as dropped. At 200 unlocked entries, adding one evicts the stalest unlocked one, and never a locked one. Verifies **AC-8**, **AC-9**.
- Failure: the model throws, so it logs `[lore]`, no rows change, and the reply is already sent. Two channels in one guild reach their count at the same time, so one runs and the other retries on its next reply. Verifies **AC-11**.
- Web: a non admin sees the tabs and search with no edit controls, and a direct `createLore` call is rejected. An admin creates, edits, locks, deletes, and deletes all unlocked (locked entries survive). Verifies **AC-12**, **AC-13**.
- Validation: an 81 char key, empty notes, a duplicate `arne` next to `Arne`, and an `updateLore` with another guild's id all fail with clear errors. Verifies **AC-14**.
- Settings: the new fields appear in the chat and personality tabs, and a `loreInstructions` preset can be saved and applied. Verifies **AC-15**.

## Build plan

Build approach: none recorded, so this uses Tracer Bullet. First a thin thread from table to prompt that you can see working, then the learning loop, then the full web page.

**Slice 1: lore reaches the prompt (seeded by hand)**
1. Add `lore_entries` schema with the unique `lower(key)` index, export it, and run `pnpm --filter @klyndre/db push`. Satisfies **AC-10**
2. Add the chat `lore*` settings and the personality `loreInstructions` / `selfLoreGuidance` / `serverLoreGuidance` settings with descriptions and defaults. Satisfies **AC-15**
3. Add `words()` to `lib/utils/text.ts`. In `lore.ts`, add `loadLore`, markers, scoring and `selectLore` (matched + locked + random fill + cooldown lookup). Satisfies **AC-1**, **AC-3**, **AC-4**
4. Have `buildHistory` also return `humanText`, and render the two lore sections in `prompt.ts` (skipped when empty or disabled). Satisfies **AC-1**, **AC-2**, **AC-5**
5. Add a minimal web page: the `lore` route and nav link, `listLore` + `createLore`, and a plain list with a create form, so you can seed locked entries and watch them in prompts. Satisfies **AC-12**, **AC-13**

**Slice 2: the learning loop and loop guards**
6. Make `sendReply` return the sent text (`null` when nothing was sent). In `handler.ts`, call `noteUsage` and then `maybeUpdateLore` with the reply. Satisfies **AC-3**
7. Add `maybeUpdateLore`: the per channel counter, per guild lock, the known lore context, the structured output call, apply rules 1 to 7 in one transaction, and logging. Satisfies **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-11**

**Slice 3: complete the web page**
8. Add `updateLore`, `deleteLore` and `deleteUnlockedLore`. Add the `Self` / `Server` tabs, search, `lore-card.tsx` with draft editing and a locked switch, the delete all unlocked confirm, the read only mode, empty states, and readable unique clash errors. Satisfies **AC-12**, **AC-13**, **AC-14**
9. Add `loreInstructions` to `promptKinds`, so it can be saved as a preset. Satisfies **AC-15**

## Consequences

**Positive**:
- The persona stays consistent over time, and the bot can join in on server culture.
- The known causes of the guttasjefen spiral are each blocked: the bot's own mentions don't count, always on entries cool down, random fill is off, and the updater is strict and capped.
- Admins can see and fix everything, and hand written lore is safe from the updater.

**Negative / tradeoffs**:
- One extra model call every `loreUpdateEvery` replies per channel (on top of the profiles call).
- Keyword matching misses synonyms and paraphrases ("your cousin" won't match `Arne` unless the notes say cousin). That's accepted, since it's free and predictable.
- Matching only on human messages means the bot won't build on its own previous message unless someone answers about it. That's intended, but it can make a long ramble about its own life drop the thread.
- The cooldown and counters reset on restart.
- Lots of locked entries will bloat every prompt. The UI should make clear that locked means always in the prompt.
- Notes stay as text in the chat language, so a guild that switches language keeps old notes in the old language.

**Neutral**:
- `sendReply` changes its return type (from `void` to the sent text). That only affects its single caller.
- A new table is added with `drizzle-kit push` (the project doesn't use migration files).
- This is the first spec in the repo, and it creates `docs/specs/_root/`.

## Follow-up

- [ ] The profiles updater has the same blind spot this spec fixes for lore: it never sees the reply just sent. Consider passing the reply to `maybeUpdateNotes` too.
- [ ] Tick items 5 and 6 in `apps/bot/TODO.md` when this ships, and note that it covers part of item 13 (anti repetition) for lore.
- [ ] Item 9 (`scripts/test-prompt.ts`) would make tuning the lore guidance and selection much easier. Consider building it first, or soon after.
- [ ] There's no `AGENTS.md` yet. Running `/audit` would give later specs and `/develop` the project conventions this spec had to work out from the code.
