# ─── Stage 1: Base ────────────────────────────────────────────
FROM node:22-alpine AS base

RUN apk add --no-cache dumb-init curl && \
    apk upgrade --no-cache

WORKDIR /app

# ─── Stage 2: Dependencies (production only) ─────────────────
FROM base AS deps

COPY package.json prisma.config.ts ./
COPY prisma/ ./prisma/

# Install without lock file so npm resolves platform-correct optional deps
RUN npm install --omit=dev --ignore-scripts && \
    npx prisma generate

# ─── Stage 3: Build ──────────────────────────────────────────
FROM base AS build

COPY package.json ./

# Install without lock file to get correct platform bindings (e.g. rollup linux-arm64-musl)
RUN npm install

COPY . .
RUN npx prisma generate && \
    npm run build

# ─── Stage 4: Production ─────────────────────────────────────
FROM base AS production

ENV NODE_ENV=production
ENV PORT=8080

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
COPY --from=build /app/server.js ./
COPY --from=build /app/server/ ./server/
COPY --from=build /app/prisma/ ./prisma/
COPY --from=build /app/prisma.config.ts ./

# Run as non-root user
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/up || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
