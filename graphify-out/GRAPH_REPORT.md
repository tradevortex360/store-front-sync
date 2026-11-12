# Graph Report - restaurant-availability-setup-a0a981  (2026-11-13)

## Corpus Check
- 30 files · ~8,671 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 113 nodes · 195 edges · 11 communities (9 shown, 2 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `02b48f7f`
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

## God Nodes (most connected - your core abstractions)
1. `ChaosService` - 14 edges
2. `ListingsStore` - 11 edges
3. `AdminController` - 10 edges
4. `setupSwagger()` - 6 edges
5. `parseEnv()` - 5 edges
6. `ListingsController` - 5 edges
7. `AppController` - 5 edges
8. `AppService` - 5 edges
9. `HealthController` - 4 edges
10. `buildOpenApiDocument()` - 4 edges

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

## Communities (11 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (4): buildSeed(), ListingsStore, MockHealthController, PlatformMockModule

### Community 1 - "Community 1"
Cohesion: 0.22
Nodes (6): ApiModule, parseEnv(), buildDataSourceOptions(), DatabaseModule, migrate(), HealthController

### Community 2 - "Community 2"
Cohesion: 0.29
Nodes (7): apiDocs(), bootstrap(), buildOpenApiDocument(), setupSwagger(), bootstrap(), platformMockDocs(), documentFor()

### Community 3 - "Community 3"
Cohesion: 0.28
Nodes (5): json(), malformedListingsBodies(), malformedStatusBodies(), pick(), ListingsController

### Community 5 - "Community 5"
Cohesion: 0.27
Nodes (3): AppController, AppModule, AppService

### Community 6 - "Community 6"
Cohesion: 0.36
Nodes (3): Listing, StatusCheck, InitialSchema1794441600000

### Community 8 - "Community 8"
Cohesion: 0.6
Nodes (3): controllersOf(), join(), nestRoutes()

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ChaosService` connect `Community 4` to `Community 0`, `Community 3`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Why does `AdminController` connect `Community 7` to `Community 0`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Why does `ListingsStore` connect `Community 0` to `Community 3`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `setupSwagger()` (e.g. with `bootstrap()` and `bootstrap()`) actually correct?**
  _`setupSwagger()` has 2 INFERRED edges - model-reasoned connections that need verification._