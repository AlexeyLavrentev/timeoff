FROM node:20-bullseye-slim AS base

WORKDIR /app

FROM base AS deps

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python-is-python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build

COPY scss ./scss
COPY public ./public
RUN npm run compile-sass

FROM deps AS development

ENV NODE_ENV=development

FROM base AS runtime

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --create-home appuser

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev \
  && npm cache clean --force

COPY --chown=appuser:nodejs app.js ./
COPY --chown=appuser:nodejs bin ./bin
COPY --chown=appuser:nodejs config ./config
COPY --chown=appuser:nodejs docker ./docker
COPY --chown=appuser:nodejs lib ./lib
COPY --chown=appuser:nodejs locales ./locales
COPY --chown=appuser:nodejs migrations ./migrations
COPY --chown=appuser:nodejs views ./views
COPY --from=build --chown=appuser:nodejs /app/public ./public
RUN chmod +x /app/docker/*.sh \
  && chown appuser:nodejs /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "require('http').get('http://127.0.0.1:3000/', (res) => { process.exit(res.statusCode >= 200 && res.statusCode < 500 ? 0 : 1); }).on('error', () => process.exit(1))"]

CMD ["/bin/sh", "./docker/entrypoint.sh"]
