FROM node:26-slim

RUN npm install -g pnpm@12.8.1

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
RUN pnpm install --frozen-lockfile --filter @klyndre/web...

COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/config ./packages/config
COPY apps/web ./apps/web
RUN pnpm --filter @klyndre/web build

# Single stage so `pnpm create:user` can run from a shell in this container
WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
