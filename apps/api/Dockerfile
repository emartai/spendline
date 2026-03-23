FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/sdk-js/package.json packages/sdk-js/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @spendline/api build

RUN pnpm --filter @spendline/api deploy --prod /prod/api

FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup -S spendline && adduser -S spendline -G spendline

COPY --from=builder /prod/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json

USER spendline

EXPOSE 3001

CMD ["node", "dist/index.js"]
