# Graph Report - mock-resturant-app  (2026-11-13)

## Corpus Check
- 30 files · ~8,671 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 141 nodes · 307 edges · 11 communities (9 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `26ef83ff`
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
1. `ChaosService` - 19 edges
2. `ListingsStore` - 15 edges
3. `AdminController` - 12 edges
4. `parseEnv()` - 9 edges
5. `setupSwagger()` - 9 edges
6. `buildDataSourceOptions()` - 7 edges
7. `ListingsController` - 7 edges
8. `HealthController` - 6 edges
9. `buildOpenApiDocument()` - 6 edges
10. `Listing` - 6 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --calls--> `apiDocs()`  [INFERRED]
  .claude/worktrees/restaurant-availability-setup-a0a981/src/api/main.ts → .claude/worktrees/restaurant-availability-setup-a0a981/src/api/api.docs.ts
- `bootstrap()` --calls--> `setupSwagger()`  [INFERRED]
  .claude/worktrees/restaurant-availability-setup-a0a981/src/api/main.ts → .claude/worktrees/restaurant-availability-setup-a0a981/src/common/swagger.ts
- `migrate()` --calls--> `parseEnv()`  [INFERRED]
  .claude/worktrees/restaurant-availability-setup-a0a981/src/database/migrate.ts → .claude/worktrees/restaurant-availability-setup-a0a981/src/common/env.ts
- `documentFor()` --calls--> `buildOpenApiDocument()`  [INFERRED]
  .claude/worktrees/restaurant-availability-setup-a0a981/test/openapi.spec.ts → .claude/worktrees/restaurant-availability-setup-a0a981/src/common/swagger.ts
- `bootstrap()` --calls--> `setupSwagger()`  [INFERRED]
  .claude/worktrees/restaurant-availability-setup-a0a981/src/platform-mock/main.ts → .claude/worktrees/restaurant-availability-setup-a0a981/src/common/swagger.ts

## Communities (11 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (6): buildSeed(), everyDay(), slot(), ListingsStore, MockHealthController, PlatformMockModule

### Community 1 - "Community 1"
Cohesion: 0.23
Nodes (9): apiDocs(), ApiModule, bootstrap(), buildOpenApiDocument(), setupSwagger(), bootstrap(), platformMockDocs(), documentFor() (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.22
Nodes (6): parseEnv(), buildDataSourceOptions(), DatabaseModule, migrate(), HealthController, healthSchema()

### Community 3 - "Community 3"
Cohesion: 0.28
Nodes (7): json(), malformedListingsBodies(), malformedStatusBodies(), pick(), ListingsController, daySlots(), localTime()

### Community 5 - "Community 5"
Cohesion: 0.31
Nodes (3): Listing, StatusCheck, InitialSchema1794441600000

### Community 6 - "Community 6"
Cohesion: 0.27
Nodes (3): AppController, AppModule, AppService

### Community 8 - "Community 8"
Cohesion: 0.67
Nodes (4): controllersOf(), join(), nestRoutes(), postmanRoutes()

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ChaosService` connect `Community 4` to `Community 0`, `Community 3`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **Why does `parseEnv()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Why does `AdminController` connect `Community 7` to `Community 0`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `setupSwagger()` (e.g. with `bootstrap()` and `bootstrap()`) actually correct?**
  _`setupSwagger()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._