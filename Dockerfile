FROM node:14-bullseye-slim AS base

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
RUN npm install --omit=dev

FROM node:14-bullseye-slim

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
