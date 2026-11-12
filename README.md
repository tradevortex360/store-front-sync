# store-front-sync

Checks whether restaurant listings on delivery platforms are actually available
during their opening hours. A **worker** polls a (mock) delivery platform on a fixed
interval, compares each listing's status with its opening hours, and stores every
check and every mismatch in PostgreSQL. An API exposes a health check.

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
| `worker`        | –                       | Checks every listing every `CHECK_INTERVAL_SECONDS`   |

Data lives in the named volume `pgdata`, so it survives `docker compose down`
followed by `docker compose up`. Only `docker compose down -v` wipes it.

### Local development (without Docker for the apps)

```bash
pnpm install
docker compose up -d db
DATABASE_URL=postgres://app:app@localhost:5432/store_front_sync pnpm migrate
DATABASE_URL=postgres://app:app@localhost:5432/store_front_sync pnpm start:api
pnpm start:platform-mock
DATABASE_URL=postgres://app:app@localhost:5432/store_front_sync CHECK_INTERVAL_SECONDS=10 pnpm start:worker
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

## worker

A background process with no HTTP port (`dist/worker/main.js`). Every
`CHECK_INTERVAL_SECONDS` (default `60`) it runs one **check round**:

1. `GET /listings`, then validate each listing (including a real IANA timezone and `HH:mm`
   times) and upsert it into `listings`. A listing that breaks the contract is skipped
   and logged. If the whole list is unusable, the round carries on with the
   **last known listings from the database**.
2. For every listing, concurrently, `GET /listings/:id/status` with a
   `REQUEST_TIMEOUT_MS` timeout (default `5000`).
3. Store one `status_checks` row per listing, failures included, with an outcome:
   `ok | timeout | http_error | network_error | invalid_payload`.
4. For a successful check, work out whether the listing **should** be open now from
   its opening hours in its own timezone, and compare that with the reported status:

   | Opening hours say | Platform says     | Result                          |
   | ----------------- | ----------------- | ------------------------------- |
   | open              | `OPEN`            | fine                            |
   | open              | `CLOSED`          | mismatch `closed_during_hours`  |
   | open              | `PAUSED`          | mismatch `paused_during_hours`  |
   | closed            | `OPEN`            | mismatch `open_outside_hours`   |
   | closed            | `CLOSED`/`PAUSED` | fine (nobody can order either way) |

   A mismatch is written to `mismatches` in the same transaction as its status check.
   **A failed check is never a mismatch**, because "couldn't tell" is not "closed".

Timing: the interval runs from the start of one round to the start of the next.
Rounds never overlap; if one takes longer than the interval, the next starts as soon as
it ends. On `SIGTERM` the worker finishes the current round, then exits.

Time logic (`src/worker/availability/opening-hours.ts`): slots are `[open, close)` in local
time. A `close` earlier than `open` runs past midnight, so Saturday 01:30 is covered
by Friday's `10:30–02:00`. `open == close` means 24 hours. Timezone and DST
conversion uses `Intl`, so no date library is needed.

Watch it work, with a shorter interval:

```bash
CHECK_INTERVAL_SECONDS=10 docker compose up -d --build
docker compose logs -f worker
# stage a mismatch (Berlin PAUSED during opening hours) and a timeout
curl -X PUT localhost:4000/admin/listings/lst_ber_001/status -H 'content-type: application/json' -d '{"status":"PAUSED"}'
curl -X PUT localhost:4000/admin/chaos/listings/lst_vie_002 -H 'content-type: application/json' -d '{"latencyMs":8000}'
docker compose exec db psql -U app -d store_front_sync   -c "select listing_id, kind, expected_open, actual_status, detected_at from mismatches order by id desc limit 10"
curl -X POST localhost:4000/admin/reset
```

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
- `mismatches`: append-only, one row per successful check that contradicts the
  opening hours: `listing_id, status_check_id (unique), detected_at, expected_open,
  actual_status, kind`. `kind` is one of `open_outside_hours | closed_during_hours |
  paused_during_hours`, and a CHECK constraint makes sure `kind`, `expected_open` and
  `actual_status` agree. It's indexed on `(listing_id, detected_at)`.

## Main choices

- **NestJS + TypeORM, one codebase, four entry points** (`dist/api/main.js`,
  `dist/platform-mock/main.js`, `dist/worker/main.js`, `dist/database/migrate.js`),
  **one Docker image**. Compose picks the entry point per service. The worker is a Nest
  application context with no HTTP server. This is simpler than a Nest monorepo and still keeps the mock
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

- **Mismatches point at the check that found them** instead of being free-floating
  events, so every alert can be traced to the raw HTTP result and latency behind it.
- **The platform is never trusted**: every body is validated with Zod and every
  request has a timeout. A broken listing or a dead list endpoint degrades one
  listing or falls back to stored data; it never stops the round.

## Not done yet

- API endpoints to read checks and mismatches (e.g. current availability per listing).
- Grouping consecutive mismatch rows into incidents (start/end), and alerting.
- Several workers in parallel would need a lock (e.g. `pg_try_advisory_lock`) per round.

## Time spent and tools

- Roughly **X h** _(fill in)_.
- AI tools: **Claude Code** (Claude Opus) for planning, scaffolding and writing code
  and tests, reviewed and steered by hand.
