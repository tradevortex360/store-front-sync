import type { SwaggerSetup } from '../common/swagger.js';

export const apiDocs = (
  serverUrl: string,
  platformMockUrl: string,
): SwaggerSetup => ({
  title: 'store-front-sync api',
  serverUrl,
  description: `The store-front-sync API. It will serve the results of the availability checks: whether each restaurant is actually orderable on the delivery platform during its opening hours.

**Status:** foundation only. Today it exposes the health check; the availability and mismatch endpoints come with the worker.

### How the pieces fit

1. **platform-mock** (port 4000) plays the external delivery platform.
2. **worker** (next) polls it every \`CHECK_INTERVAL_SECONDS\` and stores every check, failed ones included, in PostgreSQL.
3. **api** (this service, port 3000) reads from PostgreSQL.

### One place for all docs

Use the **spec selector at the top** of this page to switch between this API and the platform-mock (also served on its own at ${platformMockUrl}/docs). Raw OpenAPI documents: \`/docs-json\` on each service.`,
  tags: [
    {
      name: 'Health',
      description: 'Readiness of the API and its database.',
    },
  ],
  alsoShow: [{ name: 'platform-mock', url: `${platformMockUrl}/docs-json` }],
});
