# store-front-sync

Checks whether restaurant listings on delivery platforms are actually available
during their opening hours. This is the **foundation**: a mock delivery
platform, PostgreSQL with automatic migrations, and an API with a health check.
The worker and the availability/mismatch logic come next.

## Run it

```bash
docker compose up --build
```

That's it. No `.env` is needed; every setting has a default (see `.env.example`).

| Service         | URL                     | What it is                                            |
| --------------- | ----------------------- | ----------------------------------------------------- |
| `api`           | http://localhost:3000   | `GET /health` → `200` when the API and DB are up      |
| `platform-mock` | http://localhost:4000   | Fake delivery platform (Uber Eats / Wolt-style)       |
| `db`            | `localhost:5432`        | PostgreSQL 17 (`app` / `app`, db `store_front_sync`)  |
| `migrate`       | –                       | One-shot: applies migrations, then exits              |

Data lives in the named volume `pgdata`, so it survives `docker compose down`
followed by `docker compose up`. Only `docker compose down -v` wipes it.

### Local development (without Docker for the apps)

```bash
pnpm install
docker compose up -d db
DATABASE_URL=postgres://app:app@localhost:5432/store_front_sync pnpm migrate
DATABASE_URL=postgres://app:app@localhost:5432/store_front_sync pnpm start:api
pnpm start:platform-mock
pnpm test && pnpm test:e2e
```

## API documentation (Swagger)

**http://localhost:3000/docs** is the single place for all API docs. Use the
**"Select a definition"** dropdown at the top to switch between the `api` and the
`platform-mock`. Each operation has a description, parameters, request and response
schemas with examples, and its error cases. "Try it out" sends real requests.

| Service         | Swagger UI                 | Raw OpenAPI 3 document          |
| --------------- | -------------------------- | ------------------------------- |
| `api`           | http://localhost:3000/docs | http://localhost:3000/docs-json |
| `platform-mock` | http://localhost:4000/docs | http://localhost:4000/docs-json |

The docs are generated from the code with `@nestjs/swagger`. Request bodies come from
the same Zod schemas that validate them, so the docs can't drift from the validation.
`test/openapi.spec.ts` fails if an operation has no summary, description, tag or
documented response.

## Postman collection

[`postman/store-front-sync.postman_collection.json`](postman/store-front-sync.postman_collection.json)
covers every endpoint, and each request has assertions. Import it into Postman, or run it
from the CLI against the running stack:

```bash
pnpm test:postman
```

Base URLs are collection variables (`apiBaseUrl`, `mockBaseUrl`, `listingId`).

**Process:** every endpoint change must update the collection in the same change.
`test/postman-collection.spec.ts`, which runs as part of `pnpm test`, reads every route
from the Nest controllers and fails if one is missing from the collection. See
[CLAUDE.md](CLAUDE.md) for the full checklist.

## platform-mock

### Public API (what the worker polls)

- `GET /listings` returns 5 listings: `id, name, timezone, listingUrl, openingHours`.
  `openingHours` has keys `mon`–`sun`, each a list of `{ open: "HH:mm", close: "HH:mm" }` in local time.
- `GET /listings/:id/status` returns `{ "status": "OPEN" | "CLOSED" | "PAUSED" }`, or `404` for an unknown id.

The listings are picked to cover the awkward cases on purpose:

| id            | Name                      | Timezone         | Why it's interesting                       | Seeded status |
| ------------- | ------------------------- | ---------------- | ------------------------------------------ | ------------- |
| `lst_ber_001` | Curry Kontor Berlin-Mitte | Europe/Berlin    | Lunch + dinner split shift, closed Sunday  | OPEN          |
| `lst_vie_002` | Schnitzelhaus Neubau      | Europe/Vienna    | Closed Monday                              | OPEN          |
| `lst_hel_003` | Pho Kallio                | Europe/Helsinki  | Fri/Sat open until 02:00 (past midnight)   | OPEN          |
| `lst_ams_004` | Nachtkebab De Pijp        | Europe/Amsterdam | 18:00–04:00 every day                      | CLOSED        |
| `lst_lon_005` | Bagel Corner Shoreditch   | Europe/London    | Breakfast/lunch only                       | PAUSED        |

A `close` earlier than `open` means the slot runs past midnight into the next day.

Statuses are **static** and only change when you set them through the admin
API. The mock deliberately doesn't apply opening hours itself, so every mismatch
is one you staged, and the real time logic lives in our code, not in the mock.

### Making it misbehave (admin API)

The admin endpoints are never affected by chaos, so you can always undo things.

```bash
# Inspect current chaos config + statuses
curl localhost:4000/admin/state

# Slow down every endpoint by 5 s (good for testing timeouts)
curl -X PUT localhost:4000/admin/chaos -H 'content-type: application/json' -d '{"latencyMs":5000}'

# 30% of requests fail with HTTP 502, 20% return 200 with a malformed body
curl -X PUT localhost:4000/admin/chaos -H 'content-type: application/json' \
  -d '{"errorRate":0.3,"errorStatus":502,"malformedRate":0.2}'

# Only one listing's status endpoint misbehaves
curl -X PUT localhost:4000/admin/chaos/listings/lst_hel_003 -H 'content-type: application/json' -d '{"malformedRate":1}'
curl -X DELETE localhost:4000/admin/chaos/listings/lst_hel_003

# Stage a mismatch: Berlin shows PAUSED during opening hours
curl -X PUT localhost:4000/admin/listings/lst_ber_001/status -H 'content-type: application/json' -d '{"status":"PAUSED"}'

# Back to startup defaults and seeded statuses
curl -X POST localhost:4000/admin/reset
```

A chaos rule is `{ latencyMs, errorRate, errorStatus, malformedRate }`, and every field is
optional in a `PUT`. Defaults apply to all endpoints, and a per-listing override applies on
top for that listing's status endpoint. You can also set startup defaults with
`CHAOS_LATENCY_MS`, `CHAOS_ERROR_RATE` and `CHAOS_MALFORMED_RATE`.

Malformed bodies are realistic contract breaks: `{"status":"open"}`, unknown enum
values, renamed fields, wrong types, truncated JSON, an HTML error page served as
JSON, an empty body. On `/listings` they include an invalid IANA timezone, times like
`25:99`, free-text hours, missing ids, a wrapped array and `null`.

## Database

Migrations are hand-written SQL in `src/database/migrations`, run by the `migrate`
service before `api` starts (`depends_on: service_completed_successfully`).
`synchronize` is off.

- `listings`: the platform's listings as last seen (opening hours as `jsonb`).
- `status_checks`: append-only, one row per check: `listing_id, checked_at, outcome,
  status, http_status, latency_ms, error`. `outcome` is one of `ok | timeout |
  http_error | network_error | invalid_payload`, and `status` is set only when
  `outcome = 'ok'` (enforced by a CHECK constraint). It's indexed on
  `(listing_id, checked_at)`.

## Main choices

- **NestJS + TypeORM, one codebase, three entry points** (`dist/api/main.js`,
  `dist/platform-mock/main.js`, `dist/database/migrate.js`), **one Docker image**.
  Compose picks the entry point per service. The worker will be a fourth entry point
  on the same image. This is simpler than a Nest monorepo and still keeps the mock
  a separate service, because it stands in for an external system.
- **Migrations as a one-shot compose service** rather than on app boot, so the API
  (and later several workers) never race each other to migrate.
- **Failed checks get stored too.** "We couldn't tell" (timeout, 5xx, garbage) is
  different from "it was CLOSED". Mixing them up would either hide outages or raise
  false alarms, so the schema keeps them apart from day one.
- **Mock chaos is runtime-controlled** through an admin API (plus env defaults), so
  failures can be switched on and off during a live demo without restarts.
- **Config is validated with Zod at startup.** Bad env vars fail fast with a readable
  message.

## Not done yet

- `worker`: polls each listing every `CHECK_INTERVAL_SECONDS` and writes `status_checks`.
  The compose file has a placeholder comment for it.
- The availability / mismatch logic and the API endpoints for it.

## Time spent and tools

- Roughly **X h** _(fill in)_.
- AI tools: **Claude Code** (Claude Opus) for planning, scaffolding and writing code
  and tests, reviewed and steered by hand.
