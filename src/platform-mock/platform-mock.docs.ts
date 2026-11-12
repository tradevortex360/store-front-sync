import type { SwaggerSetup } from '../common/swagger.js';

export const platformMockDocs = (serverUrl: string): SwaggerSetup => ({
  title: 'platform-mock',
  serverUrl,
  description: `A fake food-delivery platform (Uber Eats / Wolt style) that **stands in for the real external system** the worker will poll.

It has two parts:

- **Listings (public API):** what a real platform would expose. \`GET /listings\` gives each restaurant's timezone and weekly opening hours; \`GET /listings/{id}/status\` says whether customers currently see it as \`OPEN\`, \`CLOSED\` or \`PAUSED\`.
- **Admin (control plane):** not part of any real platform. It lets you make the public API misbehave on demand and stage status scenarios, at runtime, without restarts.

### Seed data

| id | Timezone | Why it's there | Seeded status |
| --- | --- | --- | --- |
| \`lst_ber_001\` | Europe/Berlin | Lunch + dinner split shift, closed Sunday | OPEN |
| \`lst_vie_002\` | Europe/Vienna | Closed Monday | OPEN |
| \`lst_hel_003\` | Europe/Helsinki | Fri/Sat open until 02:00 (past midnight) | OPEN |
| \`lst_ams_004\` | Europe/Amsterdam | 18:00–04:00 every day | CLOSED |
| \`lst_lon_005\` | Europe/London | Breakfast/lunch only | PAUSED |

Opening hours are local times in the listing's timezone. A \`close\` earlier than \`open\` means the slot runs past midnight.

### Statuses are static

The mock never applies opening hours itself. A status only changes through \`PUT /admin/listings/{id}/status\` or \`POST /admin/reset\`, so every mismatch is one you staged deliberately.

### Chaos

A chaos rule is \`{ latencyMs, errorRate, errorStatus, malformedRate }\`. The **default** rule applies to all public endpoints; a **per-listing override** applies on top for that listing's status endpoint. For each request the mock first waits \`latencyMs\`, then rolls once: with probability \`errorRate\` it answers \`errorStatus\`, with probability \`malformedRate\` it answers \`200\` with a contract-breaking body, otherwise it answers normally.

Admin and health endpoints are **never** affected, so you can always switch chaos off again. Startup defaults come from \`CHAOS_LATENCY_MS\`, \`CHAOS_ERROR_RATE\` and \`CHAOS_MALFORMED_RATE\`.`,
  tags: [
    {
      name: 'Listings',
      description:
        'Public platform API polled by the worker. Subject to chaos.',
    },
    {
      name: 'Admin',
      description:
        'Control plane: chaos rules and forced statuses. Never subject to chaos.',
    },
    { name: 'Health', description: 'Liveness for docker compose.' },
  ],
});
