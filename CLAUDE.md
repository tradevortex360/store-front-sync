## Postman collection (required for every endpoint change)

`postman/store-front-sync.postman_collection.json` must cover every HTTP endpoint of every app (api, platform-mock, and later the worker if it exposes any).

Whenever you add, change, rename or remove an endpoint, in the same change:
1. Add or update its request in the collection, in the right folder (`api`, `platform-mock/Public`, `platform-mock/Admin`, …). Use `{{apiBaseUrl}}` / `{{mockBaseUrl}}` as host and Postman path variables (`:id`) for route params, matching the Nest route exactly.
2. Give it a `test` script asserting at least the status code, plus the key response fields. Add a request for the main error case (400/404) when there is one.
3. If a new app or base URL is introduced, add a collection variable and register its module in `APPS` in `test/postman-collection.spec.ts`.
4. Run `pnpm test` (the guard test fails on any route missing from the collection) and, with `docker compose up` running, `pnpm test:postman`.

Requests run top to bottom, and requests that change mock state must leave it clean (the Admin folder ends with `POST /admin/reset`).

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
