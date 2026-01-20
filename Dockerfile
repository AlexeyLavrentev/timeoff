<<<<<<< ours
FROM node:12-bullseye-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ sqlite3 \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install
=======
FROM node:18-bullseye-slim AS base

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    sqlite3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm install --omit=dev

FROM node:18-bullseye-slim

ENV NODE_ENV=production

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY . .
>>>>>>> theirs

COPY . .
EXPOSE 3000
<<<<<<< ours
=======

>>>>>>> theirs
CMD ["npm", "start"]
