FROM node:20-bullseye-slim AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python-is-python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund \
  && npm cache clean --force

FROM deps AS build

COPY scss ./scss
COPY public ./public
RUN npm run compile-sass \
  && npm prune --omit=dev

FROM node:20-bullseye-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public/css/style.css ./public/css/style.css
COPY package.json package-lock.json* ./
COPY app.js ./
COPY bin ./bin
COPY config ./config
COPY lib ./lib
COPY locales ./locales
COPY migrations ./migrations
COPY public ./public
COPY views ./views

RUN chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const http=require('http');const req=http.get('http://127.0.0.1:3000/',res=>{process.exit(res.statusCode>=200&&res.statusCode<500?0:1)});req.on('error',()=>process.exit(1));req.setTimeout(3000,()=>{req.destroy();process.exit(1)});"

CMD ["node", "bin/wwww"]
