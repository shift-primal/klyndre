# klyndre

A Discord bot that hangs out in your server like a regular member. It chats (backed by xAI's Grok), plays music in voice channels, and comes with a small web dashboard for changing its settings, personality, lore and notes on people per server.

- [How it works](#how-it-works)
- [Using the bot](#using-the-bot)
- [The dashboard](#the-dashboard)
- [Local setup](#local-setup)
- [Deploying](#deploying)
  - [How YouTube is played](#how-youtube-is-played)
  - [Streaming through a home connection](#streaming-through-a-home-connection)
- [Working on it](#working-on-it)

## How it works

It's a pnpm monorepo with two apps and two shared packages:

```
apps/
  bot/        discord.js bot: commands, chat, music
  web/        dashboard (TanStack Start + better-auth)
packages/
  db/         Drizzle schema, migrations, Postgres client
  config/     per-server settings: schemas, defaults, cache, live reload
```

Both apps talk to the same Postgres database. Settings are saved per server, in modules (`chat`, `channels`, `personality`, `commands`, `music`), and every field has a default in `packages/config/src/defaults.ts`. When the dashboard saves a setting, Postgres sends a `NOTIFY`, and the bot drops its cached copy and picks up the change right away, without a restart. Secrets like YouTube cookies work the same way.

The bot is made of **features** (`apps/bot/src/features`), each with its own commands and event handlers:

- **general**: `help` and `ping`.
- **chat**: decides when to reply, builds a prompt from the recent chat history, the server's lore and its notes on the people talking, and sends one reply at a time per channel. After replying it may update its notes on people and its lore in the background.
- **music**: a [discord-player](https://discord-player.js.org) queue per server. YouTube is the main source (through `discord-player-youtubei`, see [How YouTube is played](#how-youtube-is-played)). Spotify links are resolved through the Spotify API and played from YouTube. The next song in the queue starts loading 20 seconds before the current one ends, so songs follow each other without a gap.

Every command works both as a slash command (`/play`) and as a text command with the server's prefix (`-play`, by default).

## Using the bot

### Chat

The bot replies when:

- someone tags it (in any channel, unless _reply to mentions anywhere_ is off; then only in AI channels),
- someone writes in an **AI channel** (it answers every message there),
- someone writes in a **random-reply channel** (it answers now and then, 25% of messages by default).

None of these channels are set up out of the box, so add them under _Channels_ in the dashboard. When a message is short and the conversation seems over ("ok", "ye"), it can choose to stay quiet unless it was tagged.

It remembers things in two ways:

- **Profiles**: short notes on each person, from what they say.
- **Lore**: facts about its own made-up life (_self_) and the server's running jokes and shared history (_server_). Relevant entries go in the prompt when the chat touches on them.

Both are updated automatically and can be edited in the dashboard, where lore entries can also be locked so the bot never changes or prunes them. `-reset` makes it forget the chat history in that channel, plus its notes on you.

### Commands

`-help` lists everything, `-help music` shows one feature, `-help play` shows one command.

| Command                    | Aliases          | What it does                                                 |
| -------------------------- | ---------------- | ------------------------------------------------------------ |
| `help [topic]`             | `h`, `?`         | Help for a feature or command                                |
| `ping`                     |                  | Check that the bot is online                                 |
| `reset`                    |                  | Forget this channel's chat history and your notes            |
| `play <song>`              | `p`              | Add a song, link or playlist to the queue                    |
| `playnext <song>`          | `pn`             | Add a song right after the current one                       |
| `playnow <song>`           | `pnow`           | Skip to this song now, keeping the queue                     |
| `skip`                     | `n`, `next`      | Skip the current track                                       |
| `skipto <track>`           | `st`, `goto`     | Skip to a track in the queue                                 |
| `pause` / `resume`         | `res`            | Pause or resume                                              |
| `stop`                     | `s`, `dc`        | Stop, clear the queue and leave                              |
| `restore`                  | `undo`, `unstop` | Bring back the queue after a stop (within 30 min by default) |
| `queue`                    | `q`              | Show the queue                                               |
| `nowplaying`               | `np`, `playing`  | Show the current track                                       |
| `remove <track>`           | `rm`             | Remove a track from the queue                                |
| `move <track> <to>`        | `mv`             | Move a track to another spot                                 |
| `shuffle`                  | `shuff`          | Shuffle the queue                                            |
| `loop [off\|track\|queue]` | `repeat`         | Set the loop mode, or cycle through them                     |

Where a command takes a `<track>`, use its number from `queue` or part of its title. Music commands need you to be in the bot's voice channel, and if music channels are set in the dashboard, they only work there.

## The dashboard

Log in, pick a server the bot is in, and you get three pages:

- **Settings**: every setting module as a tab. _Personality_ holds the prompts (persona, rules, format and so on), which can be saved and loaded as presets.
- **Lore**: the bot's self and server lore.
- **Profiles**: its notes on people.

There is also a **Secrets** page for the YouTube cookies (see [YouTube cookies](#youtube-cookies)).

There's no sign-up. Accounts are created from the command line, and are either `viewer` (can look) or `admin` (can change things):

```sh
pnpm --filter @klyndre/web create:user you@example.com 'a-long-password' "Your name" --admin
```

## Local setup

### Requirements

- **Node 24**. Not 26: on Node 26 playback dies about a second into every track (see the note in `apps/bot/Dockerfile`).
- **pnpm 12.8.1** (`corepack enable` picks the version from `package.json`).
- **Docker**, for the development database.
- **ffmpeg** and **python3** on your `PATH`, for audio and yt-dlp.

### 1. Create the Discord application

Use a separate application for development, not the production bot's. Two processes logged in with the same token both get every message, so the local bot and the deployed one would both answer and both join voice.

1. Create a server of your own to test in, and copy its ID (turn on _Developer Mode_ under _Settings → Advanced_, then right-click the server → _Copy Server ID_).
2. Create an application at the [Discord developer portal](https://discord.com/developers/applications) (for example "klyndre dev") and add a bot to it.
3. Under _Bot_, turn on the **Message Content** intent (the chat feature and text commands need it).
4. Copy the bot token and the application (client) ID.
5. Invite the bot to the test server with the link in `discord_bot_install_link.txt`, replacing `CLIENT_ID` with yours. If you forget, `pnpm bot:register` and the bot both print the link.

### 2. Configure the environment

```sh
cp .env.example .env
```

| Variable                                           | Needed for                          |                                                                                                               |
| -------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                     | everything                          | The default points at the dev database from `docker-compose.dev.yml`                                          |
| `DISCORD_TOKEN`                                    | bot, web                            | Bot token. The dashboard uses it to list servers, channels and roles                                          |
| `DISCORD_CLIENT_ID`                                | registering commands                | Application ID                                                                                                |
| `DEV_GUILD_ID`                                     | development                         | Your test server's ID. Commands register there right away, and the bot won't start in other servers           |
| `XAI_API_KEY`                                      | bot                                 | From [console.x.ai](https://console.x.ai)                                                                     |
| `DP_SPOTIFY_CLIENT_ID`, `DP_SPOTIFY_CLIENT_SECRET` | Spotify links (optional)            | From the [Spotify developer dashboard](https://developer.spotify.com/dashboard)                               |
| `DEBUG_PLAYER`                                     | (optional)                          | `true` logs discord-player's debug output                                                                     |
| `YOUTUBE_PROXY`                                    | fast YouTube on a server (optional) | A proxy on a home connection, see [Streaming through a home connection](#streaming-through-a-home-connection) |
| `BETTER_AUTH_URL`                                  | web                                 | The URL you open the dashboard on                                                                             |
| `BETTER_AUTH_SECRET`                               | web                                 | Any long random string (`openssl rand -base64 32`)                                                            |

The web app also reads `apps/web/.env.local`, which is a good place for the two `BETTER_AUTH_*` values in development.

### 3. Install and run

```sh
pnpm install
pnpm bot:register   # register the slash commands (again whenever commands change)
pnpm dev
```

`pnpm dev` starts Postgres in Docker, pushes the schema to it, and runs the bot and the dashboard (on http://localhost:3000) in watch mode. Then create yourself a dashboard account with `create:user` (see [The dashboard](#the-dashboard)).

`pnpm db:down` stops the database.

### YouTube cookies

YouTube sometimes blocks the bot with a "sign in to confirm you're not a bot" check. Signing it in with cookies from a YouTube account fixes that, so it's best to use a throwaway account:

1. Export the cookies for youtube.com in Netscape `cookies.txt` format (for example with a "Get cookies.txt" browser extension).
2. Paste them into the **Secrets** page in the dashboard, or run:

   ```sh
   pnpm --filter @klyndre/bot set:secret youtube-cookies cookies.txt
   ```

The bot picks them up right away.

## Deploying

Every push to `main` builds three images with GitHub Actions and pushes them to GHCR:

- `klyndre-migrate`: runs the database migrations, then exits.
- `klyndre-bot`
- `klyndre-web`: the dashboard, on port 3000.

`docker-compose.yml` runs them together with Postgres, and is written for [Coolify](https://coolify.io), which generates the `SERVICE_*` values (database user, password and auth secret). Set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `XAI_API_KEY`, `BETTER_AUTH_URL` and optionally the Spotify variables and `YOUTUBE_PROXY`. On start, `migrate` runs once against the database, and `bot` and `web` start after it succeeds.

To create the first dashboard account in production, open a shell in the `web` container and run:

```sh
pnpm create:user you@example.com 'a-long-password' --admin
```

### How YouTube is played

YouTube treats a server's datacenter IP far more strictly than a home connection. From a server, the fast way of streaming gets no audio at all, and the only way that works is yt-dlp with cookies, which takes about 9 seconds a song (YouTube makes it wait out the video's ad before serving any audio). From a home connection, the fast way starts a song in about 0.1 seconds.

So for each song the bot tries, in order:

1. **home**: the fast way, through a proxy on a home connection. Only when `YOUTUBE_PROXY` is set.
2. **adaptive**: the fast way, straight from wherever the bot runs. Works when that's a home connection, such as in development.
3. **yt-dlp**, with the cookies: slow, but works from the server.
4. **sabr**: a last resort.

A way that fails twice in a row is tried last for the next 30 minutes, so a blocked way doesn't slow down every song. The log shows which way played each song and how long it took, for example `[music] home streamed "..." (140ms)`.

To see what works from a machine, run this in the `bot` container (or in `apps/bot` locally):

```sh
pnpm youtube:diag
```

It prints the machine's public IP (and the home connection's, when `YOUTUBE_PROXY` is set), which YouTube clients the fast way can stream from there, and a timeline of where yt-dlp spends its time.

### Streaming through a home connection

The bot keeps running on the server, and only its YouTube traffic goes through a machine at home. The two machines are connected with [Tailscale](https://tailscale.com), and the home machine runs a small HTTP proxy that only the server can reach. A song is about 4MB, so a normal home connection handles it easily.

When the home machine is off or unreachable, a song waits 3 seconds for it and then plays the slow way, and after two misses the bot stops trying home first for 30 minutes. So music keeps working, just slower to start.

**1. Tailscale on the server.** On the server itself, not in a container (containers reach Tailscale addresses through the host):

```sh
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale ip -4   # the server's Tailscale IP
```

**2. Tailscale and the proxy on the home machine.** On NixOS, add this to the configuration, with the server's Tailscale IP from step 1:

```nix
services.tailscale.enable = true;

services.tinyproxy = {
  enable = true;
  settings = {
    Listen = null; # every interface; the firewall below only opens it on Tailscale
    Port = 8888;
    Allow = [ "100.x.y.z" ]; # the server's Tailscale IP
  };
};
networking.firewall.interfaces.tailscale0.allowedTCPPorts = [ 8888 ];
```

Then:

```sh
sudo nixos-rebuild switch
sudo tailscale up
tailscale ip -4   # the home machine's Tailscale IP
```

The home machine has to stay on and awake, so turn off suspend on it if it has that.

**3. Point the bot at it.** In Coolify, set this on the bot and redeploy:

```
YOUTUBE_PROXY=http://<home machine's Tailscale IP>:8888
```

**4. Check it.** Run `pnpm youtube:diag` in the `bot` container. `home ip` should be the home connection's address, and the first block, _through the home proxy_, should say `VISIONOS ok`. Once songs play, the log says `[music] home streamed`.

## Working on it

```sh
pnpm typecheck                              # typecheck all packages
pnpm --filter @klyndre/web check            # biome lint + format check
pnpm --filter @klyndre/db studio            # browse the database
pnpm --filter @klyndre/bot test:prompt ...  # try the chat prompt outside Discord
pnpm --filter @klyndre/bot youtube:diag     # what YouTube streaming works from this machine
```

**Changing the schema.** In development, `pnpm dev` pushes the schema straight to the database. For production, generate a migration and commit it; the `migrate` image applies it on the next deploy:

```sh
pnpm db:generate
```

**Adding a setting.** Add its structure to `packages/config/src/schemas.ts` and its default and description to `defaults.ts`. The dashboard builds its form from those, so it shows up there automatically.

**Adding a command.** Write a `Command` (see `apps/bot/src/core/commands/types.ts`) in the feature's `commands/` folder, add it to that folder's `index.ts`, and run `pnpm bot:register`. Set `devOnly: true` to limit it to admins and the dev role from the _Commands_ settings.

**Prompt testing.** `test:prompt` generates a batch of replies for a message or a scenario file, using a server's real settings, lore and profiles, so you can see how a prompt change affects them without touching Discord. Run it without arguments for the options.
