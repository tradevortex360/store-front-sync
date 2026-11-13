import type { SwaggerSetup } from '../common/swagger.js';

export const apiDocs = (
  serverUrl: string,
  platformMockUrl: string,
): SwaggerSetup => ({
  title: 'store-front-sync api',
  serverUrl,
  description: `The store-front-sync API. It serves the results of the availability checks: whether each restaurant is actually orderable on the delivery platform during its opening hours.

### How the pieces fit

1. **platform-mock** (port 4000) plays the external delivery platform.
2. **worker** polls it every \`CHECK_INTERVAL_SECONDS\`. For each listing it compares the platform status with the opening hours and inserts one row into \`availability_checks\` per comparison, match or mismatch, with the time it asked (\`checked_at\`) and the time it compared (\`compared_at\`). Rows are never updated. Failed status requests are only logged.
3. **api** (this service, port 3000) reads from PostgreSQL. \`GET /mismatches\` returns the stored mismatches.

### One place for all docs

Use the **spec selector at the top** of this page to switch between this API and the platform-mock (also served on its own at ${platformMockUrl}/docs). Raw OpenAPI documents: \`/docs-json\` on each service.`,
  tags: [
    {
      name: 'Health',
      description: 'Readiness of the API and its database.',
    },
    {
      name: 'Mismatches',
      description:
        'Times the platform status contradicted the opening hours, as found by the worker.',
    },
  ],
  alsoShow: [{ name: 'platform-mock', url: `${platformMockUrl}/docs-json` }],
});
