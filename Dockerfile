FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S kooka && adduser -S kooka -G kooka

COPY --from=builder --chown=kooka:kooka /app/.next/standalone ./
COPY --from=builder --chown=kooka:kooka /app/.next/static ./.next/static
COPY --from=builder --chown=kooka:kooka /app/public ./public
COPY --from=builder --chown=kooka:kooka /app/node_modules ./node_modules
COPY --from=builder --chown=kooka:kooka /app/package.json ./package.json
COPY --from=builder --chown=kooka:kooka /app/scripts ./scripts
COPY --from=builder --chown=kooka:kooka /app/database ./database
COPY --from=builder --chown=kooka:kooka /app/drizzle ./drizzle
COPY --from=builder --chown=kooka:kooka /app/src ./src

RUN mkdir -p /app/.data/private-files && chown -R kooka:kooka /app/.data

USER kooka

EXPOSE 3000

CMD ["node", "server.js"]
