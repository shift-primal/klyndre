FROM node:26-slim

# ffmpeg for audio, python3 for yt-dlp; build tools as a fallback if @discordjs/opus has no prebuilt binary
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@12.8.1

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/bot/package.json ./apps/bot/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
RUN pnpm install --frozen-lockfile --filter @klyndre/bot...

COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/config ./packages/config
COPY apps/bot/tsconfig.json ./apps/bot/
COPY apps/bot/src ./apps/bot/src

WORKDIR /app/apps/bot

ENV NODE_ENV=production
CMD ["pnpm", "start"]
