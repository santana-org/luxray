FROM node:20-alpine AS builder

RUN npm install -g pnpm@10.33.0
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src ./src
COPY tsconfig.json ./

RUN pnpm prisma generate
RUN pnpm run build

FROM node:20-alpine

ENV NODE_ENV=production
RUN npm install -g pnpm@10.33.0
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app
USER nodejs

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('ok')" || exit 1

CMD ["node", "dist/index.js"]

