# AGENTS.md

This repository is a Node.js/Express leave management application.

## Main goal

Keep the community edition useful and clean, while separating commercial open-core functionality into the external premium module.

## Repositories

* Community/core repository: `AlexeyLavrentev/timeoff`
* Premium module repository is expected as a sibling directory: `../timeoff-premium`

## Rules for agents

* Do not move premium source code into the public/community repository.
* Do not commit secrets, private keys, generated licenses, `.env`, database files, or local test artifacts.
* Keep changes small and reviewable.
* Prefer minimal, explicit feature gates over broad rewrites.
* Community edition must still start and pass tests without the premium module.
* Commercial mode must fail clearly when the premium module or license is required but missing.
* Development-only feature flags must not become the production licensing path.
* Update documentation whenever behavior, configuration, Docker Compose usage, or feature availability changes.

## Useful commands

```bash
npm install
npm test
npm run db-update
docker compose config
docker compose -f docker-compose.yml -f docker-compose.commercial.yml config
```

## Important files

* `README.md`
* `.env.example`
* `Dockerfile`
* `docker-compose.yml`
* `docker-compose.commercial.yml`
* `docker-compose.premium-dev.yml`
* `config/app.json`
* `config/app.redis.json`
* `lib/**`
* `routes/**`
* `views/**`
* `docs/**`
* `package.json`

