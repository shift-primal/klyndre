# Verify: lore · spec 0001 · updated 2026-10-05
_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] As an admin, open a server → Lore. Expect `Self` and `Server` tabs with counts, a search box, `Add` and `Delete all unlocked`. → AC-12
- [ ] On an empty tab, expect the empty state ("No lore about its own life yet…"). → AC-12
- [ ] Add a `self` entry `Arne`, notes "fetteren min, rørlegger i Bergen", locked off. Expect it in the list with its updated time. → AC-13
- [ ] Add `arne` in the same tab. Expect the error `"arne" already exists in self lore`. Add `arne` in the Server tab and expect it to work. → AC-14, AC-10
- [ ] Try an 81 character key or empty notes. Expect Save / Add entry to stay disabled. → AC-14
- [ ] Edit Arne's notes, then Discard, then edit and Save. Expect the new notes and a newer updated time. Save with no real change and expect the time to stay the same. → AC-13
- [ ] Lock an entry, then use `Delete all unlocked` and confirm. Expect only the locked entry to remain. → AC-13
- [ ] Search "rørlegger". Expect only entries with that word in key or notes. → AC-12
- [ ] Sign in as a non admin (viewer). Expect the same tabs and search, but no Add, Delete or edit fields. → AC-12, AC-13
- [ ] Settings → Chat: expect the eleven `Lore …` fields. Settings → Personality: expect `Self lore guidance`, `Server lore guidance`, `Lore instructions`. Save a `Lore instructions` preset and load it back. → AC-15

## In Discord (bot running, `loreEnabled` on)

- [ ] With unlocked `self` entry `Arne`, write "hva gjør Arne nå?". Expect the prompt to have `## Your life` with the guidance and `- Arne: …`, and the reply to be about him. → AC-1
- [ ] Have the bot mention Arne on its own, then write about something else. Expect Arne not to be selected in the next prompt. → AC-2
- [ ] Lock an entry the chat isn't about. Expect it in every prompt. After a reply that uses one of its words, expect it gone for the next `loreCooldownReplies` replies in that channel, but back at once if someone names it. → AC-3
- [ ] Set `loreRandomFill` to 2 with several unlocked self entries. Expect 2 unmatched self entries added and no server entries. → AC-4
- [ ] Turn `loreEnabled` off. Expect no lore sections and no `[lore]` log lines. With it on and nothing matching, expect no lore sections either. → AC-5
- [ ] Chat for `loreUpdateEvery` replies in which the bot makes up a detail. Expect `[lore] +` in the bot log and the entry on the web page. → AC-6
- [ ] Let the bot invent "fetteren", then ask what he's called. Expect `[lore] > self/fetteren → Arne`, one row, same id. → AC-6, AC-10
- [ ] Set `loreMaxEntries` low (like 3). After the next update, expect `[lore] evicted …` for the stalest unlocked entries and locked ones kept. → AC-9
- [ ] Temporarily set `chat.model` to an invalid id. At the next update, expect `[lore]` in the error log, the reply still sent, and no lore changes. Put the model back. → AC-11
- [ ] Reach the update count in two channels of one server at once. Expect one run; the other channel runs on its next reply. → AC-11

## Commands

- [ ] `pnpm typecheck` → passes in all four packages
- [ ] `npx biome check apps packages` → no errors
- [ ] `docker exec klyndre-dev-db-1 psql -U postgres -d klyndre -c '\d lore_entries'` → table present, unique index `lore_entries_guild_kind_key` on `("guildId", kind, lower(key))` → AC-10

## Value sourcing

- [ ] Text matched: a chatter named Arne writing "hei" doesn't select the `Arne` entry (the name prefix isn't in `humanText`). → AC-1, AC-2
- [ ] Markers: a notes word used by 3 or more entries' notes doesn't match any of them; a word used by one entry does. Key words of 3+ letters match. → AC-1
- [ ] Score: an entry matching both its key and a rare notes word ranks above one matching only a notes word. → AC-1
- [ ] Cooldown: lives in memory per channel. Restart the bot and expect a resting locked entry back at once. → AC-3
- [ ] Limits and guidance: change `loreShown`, `selfLoreGuidance`, `serverLoreGuidance` on the web and expect the next prompt to follow them. → AC-1, AC-15
- [ ] Reply text: when the bot stays quiet (empty reply), expect no cooldown change and no update count. → AC-3, AC-6
- [ ] Updater timing and busy lock: in memory, per channel count and per guild lock. → AC-6, AC-11
- [ ] Updater chat: it sees the reply just sent (the `fetteren → Arne` case only works because of that). → AC-6
- [ ] Known lore: with more than `loreUpdateContext` entries, the updater prompt lists the rest under `other keys`. → AC-6
- [ ] Caps: `loreMaxNewPerUpdate` and `loreMaxEntries` from the web settings are respected. → AC-8, AC-9
- [ ] Eviction order: by `updatedAt`, oldest first, unlocked only. → AC-9
- [ ] Web read only: decided by `session.user.role !== "admin"`, and a direct `createLore` call as a viewer fails with `Forbidden`. → AC-13
- [ ] Guild scope: `updateLore` with an id from another server fails with "That entry no longer exists"; `deleteLore` with it does nothing. → AC-14

## Acceptance criteria coverage

- AC-1 Discord step 1, value sourcing · AC-2 Discord step 2, value sourcing · AC-3 Discord step 3 · AC-4 Discord step 4 · AC-5 Discord step 5 · AC-6 Discord steps 6 and 7 · AC-7 checked in the build script (locked by key and by `replaces`) · AC-8 value sourcing caps · AC-9 Discord step 8 · AC-10 UI step 4, Discord step 7, DB command · AC-11 Discord steps 9 and 10 · AC-12 UI steps 1, 2, 8, 9 · AC-13 UI steps 3, 6, 7, 9 · AC-14 UI steps 4, 5, value sourcing guild scope · AC-15 UI step 10
