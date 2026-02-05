FROM node:20-bullseye-slim AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python-is-python3 \
    make \
    g++ \
    sqlite3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

FROM deps AS build

COPY scss ./scss
COPY public ./public
RUN npm run compile-sass \
  && npm prune --omit=dev

FROM node:20-bullseye-slim

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY . .
COPY --from=build /app/public/css/style.css ./public/css/style.css

EXPOSE 3000
CMD ["npm", "start"]
