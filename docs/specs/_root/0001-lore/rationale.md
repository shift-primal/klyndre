# 0001. Lore: rationale

The decision record behind [index.md](index.md). `/develop` doesn't need this file.

## Context

> ⚠️ Premise note: the hard part of lore isn't storing it, it's keeping it from taking over the bot. Guttasjefen's lore worked mechanically and still failed: it kept building up and the bot mentioned the same things over and over. A straight port would bring that failure back. So this spec treats the guards against loops as the main design problem, with the table and page as the easy part.

klyndre is a pnpm monorepo: `apps/bot` (discord.js, AI SDK on xAI Grok), `apps/web` (TanStack Start, shadcn, better auth), `packages/db` (Drizzle on Postgres, `drizzle-kit push`), and `packages/config` (per guild settings validated by zod, rendered automatically in the web settings form). The chat feature already has per guild profiles: notes on people, updated by a background model call every N replies, and editable on a web page. There's no `AGENTS.md` and no earlier spec. The conventions here come from reading the code.

The bot has no memory beyond the last `historyLimit` messages and the profiles. Anything it makes up about itself (a cousin, a job, a hometown) is forgotten within the hour, so it contradicts itself. It also has no idea of the server's shared culture (running jokes, recurring topics) unless they happen to be in the window.

Guttasjefen solved the first problem with a global key → notes table plus a hand written `lore.md`, picked by keyword relevance and updated by a model call after every reply. Reading its `lore.ts` shows why it spiralled: (1) relevance was scored against the whole transcript including the bot's own replies, so anything the bot said became more likely to be selected, and then said again; (2) the `meg` entry, all of `lore.md` and random fill were in every prompt, with no guidance that they were background; (3) the updater ran on every reply, was told to save everything, and had no cap. Each of those feeds the next.

There are also klyndre specific constraints. Everything is per guild (settings, persona, profiles). Tunables belong in `@klyndre/config` so the web app controls them, not as constants. `sendReply` currently returns nothing, so any learning from the bot's own reply needs that changed. The profiles updater only sees history from before the reply.

## Options considered

### Option 1: Port guttasjefen's lore as it was

Self lore only, scoped per guild instead of global, the same relevance scoring over the full transcript, `meg` plus random fill always included, and an update after every reply.

**Pros**:
- Proven code to copy, and the least design work.
- Learns every made up fact right away.

**Cons**:
- Brings back the exact snowballing and repetition that made it unusable.
- One extra model call per reply.
- No server culture at all.

### Option 2: One table with a `kind` column, plus guards against loops (chosen)

`self` and `server` entries in one per guild table. Matching only on human messages, locked seed entries that are always eligible but cool down after unprompted use, random fill off by default, and a strict updater every N replies that is capped per run and in total, can't touch locked rows, and only deletes through renames.

**Pros**:
- Blocks each cause of the old spiral.
- Covers both the persona's consistency and server culture with one table, one updater and one page.
- Every behaviour is a setting, so it can be tuned from the web app without a deploy.

**Cons**:
- More moving parts than a port (cooldown map, rename rules, caps).
- Keyword matching misses paraphrases.
- One updater prompt has to handle two quite different kinds well.

### Option 3: Two separate features (self lore and server lore)

Separate tables, updaters and pages, each with its own tuned prompt and cadence.

**Pros**:
- Each updater prompt can be focused, which likely gives better extraction quality.
- Each can be turned on and off separately.

**Cons**:
- Twice the schema, server functions, UI and settings for what is the same key → notes shape.
- Two model calls per update cycle.
- Shared guard logic would be duplicated or need a shared layer anyway.

### Option 4: Manual lore only

Admins write all lore on the web page, with no updater.

**Pros**:
- No extra model calls, and no risk of snowballing from learning.
- Fully curated.

**Cons**:
- The bot's made up details are never remembered, which was the main reason for lore.
- Server lore depends on an admin noticing and writing every joke down.
- Doesn't fix repetition at all, because always on entries can still be overused.

## Rationale

The engineer's main concern, based on what happened before, is that lore builds up and the bot repeats it. Option 1 fails that outright, and Option 4 gives up the learning that makes lore worth having while still not fixing the repetition. Option 2 goes after the three mechanisms that caused the spiral directly. Scoring only human messages breaks the self reinforcing loop, because an entry has to be brought up by a person to come back. The per channel cooldown on unprompted entries stops the always on seed from showing up in every message, and leaves direct questions alone (the engineer pointed out that a cooldown blocking "so what's Arne up to?" would feel broken, so matched entries skip it). Strict instructions, `loreMaxNewPerUpdate`, the `loreMaxEntries` eviction, and not bumping `updatedAt` on restatements together limit growth, and let stale entries age out instead of being kept fresh just by being mentioned.

One table with a `kind` column beats Option 3 because the two kinds have the same shape and lifecycle, and differ only in instructions and selection (server entries are never added at random). A single updater with a well specified two kind prompt costs half the calls, and the separate `selfLoreGuidance` and `serverLoreGuidance` settings still let each kind be shown differently. If extraction quality for one kind turns out poor in practice, splitting the updater prompt is a local change that doesn't need a schema change.

Following the profiles feature wherever possible (per guild keying, the updater every N replies with in memory counters, the structured output model call, the web page structure, the admin middleware) keeps the codebase consistent and cuts build time. The places it differs are deliberate: a serial id so admin renames work, a `lower(key)` unique index so the updater doesn't create case duplicates, a create form because lore can be hand written, and the updater seeing the reply just sent, because that's where self lore comes from.
