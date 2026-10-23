# Verify: Consolidate chat settings · spec 0002 · updated 2026-10-23
_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Open a server's Settings page → tabs read Identity, Style, Replies, Memory, Music, Commands, Internals in that order, with no Chat, Channels, Personality or Character tab, and each setting sits in the tab the spec's *Settings layout* table gives it → AC-1
- [ ] With no `?tab=` in the URL, the Settings page opens on Identity → AC-1
- [ ] In Style, `Reply length` is a dropdown with Short, Normal and Long; pick one, save, reload, and it sticks → AC-5
- [ ] Only `Persona` (Identity) shows the preset bar; Behaviour and every Internals prompt have none → AC-18
- [ ] The page nav shows Settings, Character, Profiles, Lore. Character lists 10 sections (basics, home, work, routine, family, friends, interests, opinions, quirks, stories), each with a count against its cap, a field lock and the lock note; stories says a locked story only shows when the chat matches it → AC-13
- [ ] Each item shows Yours, Made up or Learned. Editing the text turns the badge into Yours; only toggling its lock keeps the badge → AC-13
- [ ] As a viewer, the Character page is read only (no Add, Delete, Save, and the locks are disabled) → AC-13
- [ ] As an admin, fill family to 6 items, then add a 7th: the Add button is disabled; calling `addCharacterEntry` directly fails with "family is full (6)" → AC-11, AC-13
- [ ] The Lore page has no Self/Server tabs, and adding, editing and "Delete all unlocked" work on server lore → AC-14
- [ ] In an AI channel, send "ok": the bot types right away and answers (no staying quiet) → AC-15
- [ ] Set `stripEmojis` on and get the model to answer with only emojis: the fallback reply is sent instead → AC-15
- [ ] Turn `lowercaseReplies` off, chat, and a reply keeps its capitals → AC-4
- [ ] Turn `learnFromChat` on, get the bot to say "my brother Ola is a plumber" in chat: the bot logs `[character] + family: …` and the item shows as Learned → AC-9, AC-10
- [ ] Lock `family`, get the bot to say something new about its family: the log shows `[character] dropped add to family: locked` and family is unchanged → AC-10
- [ ] Add a friend by hand, then get the bot to contradict it: if the updater returns `remove`, the log shows `dropped … manual` and the friend stays → AC-10
- [ ] Fire two self talk replies at once in one server: the log shows `[character] skipped update, another job is running` for one of them → AC-9
- [ ] With `makeUpBlanks` on, delete every `work` item, chat once: work is made up again (badge Made up) from the next reply. Then lock the empty `work` field, chat, and it stays empty → AC-8
- [ ] Set `style.language` to Norwegian, empty a few fields: the filled items are written in Norwegian → AC-8
- [ ] Save a story about crashing a sailboat at Hvaler; send "remember when you crashed that sailboat at hvaler": the story shows in the prompt and its `usedAt` is set only after the reply is sent. Send an unrelated message: no `## Stories you've told` section → AC-12
- [ ] With 20 unlocked stories, have the bot tell a 21st: the least recently used is removed (`[character] evicted story: …`). Lock all 20 and repeat: the new one is dropped with "every story is locked" → AC-11
- [ ] Set `storiesShown` to 0: no stories ever go in the prompt, even when matched → AC-12
- [ ] Set `candidates` to 3: the judge runs whenever 2 or more candidates make the shortlist; `candidates` 1 never calls it → AC-16
- [ ] Starters only fire between 10:00 and 23:00 in the chat time zone, with `starterChannelIds`, `starterQuietMs` and `starterMaxPerDay` still read from the Replies tab → AC-17

## Commands
- [ ] `pnpm typecheck` → every package passes → AC-19
- [ ] `pnpm --filter @klyndre/bot test:prompt "hei" --show-prompt -n 1` with `style.language` = Norwegian → the prompt names Norwegian once, under `## Style`, and never says to match the chat's language → AC-2, AC-3
- [ ] Same with `style.language` empty → the Style section says to write in the language most of the chat is in → AC-3
- [ ] Same with `lowercaseReplies` off → no "lowercase" anywhere in the prompt; with `stripEmojis` off → no emoji line → AC-4
- [ ] Same for each `replyLength` → the matching length line appears in `## Style` → AC-5
- [ ] In the printed prompt, nothing outside `## Style` mentions language, lowercase, emojis or line count; the history's last message ends with the one line or several lines note → AC-2, AC-6
- [ ] Set `maxMessages` to 1 → every run's note says "write just one line this time." and replies are one message → AC-6
- [ ] The prompt's `## Who you are` lists every filled field except stories, with `quirksShown` quirks (0 shows all) → AC-7
- [ ] After `test:prompt`, no story has a new `usedAt` and no `[character]` update ran (only blank fields may be made up) → AC-20
- [ ] On a copy of a database at migration 0000 with self lore, old settings rows and presets, run `pnpm db:migrate` → it applies, self lore and the `chat`, `channels`, `personality`, `character` rows and all presets are gone, `lore_entries` has no `kind`, and `character_entries` and `character_fields` exist → AC-14, AC-19
- [ ] Start the bot and the dashboard on that database → both run on the new defaults without errors → AC-19

## Value sourcing
- [ ] Style lines change when each `style` setting changes, and only then (toggle each one, rebuild the prompt) → Value sourcing: Style lines
- [ ] Line count note: over 20 runs with `multiMessageChance` 0.5 and `maxMessages` 3, roughly half say "up to 3 short lines" → Value sourcing: Per reply line count note
- [ ] Sheet: add an item on the Character page and it shows in the next prompt, in `createdAt` order → Value sourcing: Sheet
- [ ] Matched stories: a word from a story said by the bot itself (not by people) doesn't bring the story in → Value sourcing: Matched stories
- [ ] Fill blanks uses `replies.timeZone`, `style.language` and the bot's name: change the time zone to America/New_York, empty `home`, and the new home fits that zone → Value sourcing: Fill blanks
- [ ] Which fields are blank: a locked empty field is never filled; an unlocked empty one is → Value sourcing: Fill blanks
- [ ] Whether to run the updater: a fallback reply containing "my" doesn't trigger it; a normal reply with "jeg" does; `learnFromChat` off never does → Value sourcing: Update character
- [ ] Updater model is `replies.model`: change it and the `[character]` call uses the new model → Value sourcing: Model, temperature
- [ ] An admin item added while an updater call is in flight survives, and a `replace` on it is rejected as "bad id" → Value sourcing: Which rows an id may name
- [ ] Evidence comes from the bot's own lines: a fact quoted only from someone else's line is dropped with "no evidence" → Value sourcing: Bot's own lines for evidence
- [ ] Caps come from the shared field definitions: the page, the filler and the updater all stop at 1, 6 and 20 → Value sourcing: Caps
- [ ] Eviction picks the unlocked story with the oldest `coalesce(usedAt, createdAt)` → Value sourcing: Evict story
- [ ] Source badge and field lock on the page match `character_entries.source` and `character_fields.locked` (no row means unlocked) → Value sourcing: Character page

## Acceptance-criteria coverage
- AC-1: settings tabs steps, migration run · AC-2: test-prompt Style steps · AC-3: language steps · AC-4: lowercase and emoji steps · AC-5: reply length dropdown and prompt lines · AC-6: one line and several lines notes · AC-7: Who you are step · AC-8: fill and locked empty field steps · AC-9: self word trigger and one job at a time · AC-10: locked, manual, evidence and in flight admin item steps · AC-11: caps and eviction steps · AC-12: story matching, `storiesShown` 0 and `usedAt` steps · AC-13: Character page steps · AC-14: Lore page and migration steps · AC-15: always answers and empty after styling steps · AC-16: judge step · AC-17: starter step · AC-18: presets step · AC-19: migration and startup steps · AC-20: test-prompt no writes step
