FROM node:26-slim

RUN npm install -g pnpm@12.8.1

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
RUN pnpm install --frozen-lockfile --filter @klyndre/db

COPY tsconfig.base.json ./
COPY packages/db ./packages/db

WORKDIR /app/packages/db
CMD ["pnpm", "migrate"]
