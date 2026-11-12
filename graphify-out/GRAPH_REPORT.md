# Graph Report - restaurant-availability-setup-a0a981  (2026-11-13)

## Corpus Check
- 41 files · ~13,034 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 168 nodes · 315 edges · 14 communities (11 shown, 3 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `77bd1917`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]

## God Nodes (most connected - your core abstractions)
1. `ChaosService` - 14 edges
2. `ListingsStore` - 11 edges
3. `AdminController` - 10 edges
4. `AvailabilityChecker` - 9 edges
5. `PlatformClient` - 9 edges
6. `parseEnv()` - 6 edges
7. `setupSwagger()` - 6 edges
8. `Listing` - 6 edges
9. `CheckScheduler` - 6 edges
10. `isWithinOpeningHours()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `documentFor()` --calls--> `buildOpenApiDocument()`  [INFERRED]
  test/openapi.spec.ts → src/common/swagger.ts
- `bootstrap()` --calls--> `apiDocs()`  [INFERRED]
  src/api/main.ts → src/api/api.docs.ts
- `bootstrap()` --calls--> `setupSwagger()`  [INFERRED]
  src/api/main.ts → src/common/swagger.ts
- `migrate()` --calls--> `parseEnv()`  [INFERRED]
  src/database/migrate.ts → src/common/env.ts
- `bootstrap()` --calls--> `setupSwagger()`  [INFERRED]
  src/platform-mock/main.ts → src/common/swagger.ts

## Communities (14 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.16
Nodes (6): Listing, Mismatch, StatusCheck, InitialSchema1794441600000, Mismatches1794528000000, PlatformRequestError

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (3): ChaosService, MockHealthController, PlatformMockModule

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (7): ApiModule, parseEnv(), buildDataSourceOptions(), DatabaseModule, migrate(), HealthController, WorkerModule

### Community 3 - "Community 3"
Cohesion: 0.29
Nodes (7): apiDocs(), bootstrap(), buildOpenApiDocument(), setupSwagger(), bootstrap(), platformMockDocs(), documentFor()

### Community 4 - "Community 4"
Cohesion: 0.28
Nodes (5): json(), malformedListingsBodies(), malformedStatusBodies(), pick(), ListingsController

### Community 6 - "Community 6"
Cohesion: 0.27
Nodes (6): detectMismatch(), formatterFor(), isValidTimezone(), isWithinOpeningHours(), localTimeAt(), previousDay()

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (3): AppController, AppModule, AppService

### Community 9 - "Community 9"
Cohesion: 0.27
Nodes (3): describe(), PlatformClient, truncate()

### Community 11 - "Community 11"
Cohesion: 0.6
Nodes (3): controllersOf(), join(), nestRoutes()

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ChaosService` connect `Community 1` to `Community 4`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `AdminController` connect `Community 10` to `Community 1`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `parseEnv()` connect `Community 2` to `Community 1`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._