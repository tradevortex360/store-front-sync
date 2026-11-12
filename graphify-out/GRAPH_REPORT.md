# Graph Report - restaurant-availability-setup-a0a981  (2026-11-12)

## Corpus Check
- 24 files · ~5,626 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 98 nodes · 164 edges · 10 communities (8 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bb9a534a`
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

## God Nodes (most connected - your core abstractions)
1. `ChaosService` - 14 edges
2. `ListingsStore` - 11 edges
3. `AdminController` - 10 edges
4. `parseEnv()` - 5 edges
5. `ListingsController` - 5 edges
6. `AppController` - 5 edges
7. `AppService` - 5 edges
8. `HealthController` - 4 edges
9. `buildDataSourceOptions()` - 4 edges
10. `InitialSchema1794441600000` - 4 edges

## Surprising Connections (you probably didn't know these)
- `migrate()` --calls--> `parseEnv()`  [INFERRED]
  src/database/migrate.ts → src/common/env.ts
- `migrate()` --calls--> `buildDataSourceOptions()`  [INFERRED]
  src/database/migrate.ts → src/database/data-source.ts

## Communities (10 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (4): buildSeed(), ListingsStore, MockHealthController, PlatformMockModule

### Community 1 - "Community 1"
Cohesion: 0.21
Nodes (6): ApiModule, parseEnv(), buildDataSourceOptions(), DatabaseModule, migrate(), HealthController

### Community 3 - "Community 3"
Cohesion: 0.27
Nodes (3): AppController, AppModule, AppService

### Community 4 - "Community 4"
Cohesion: 0.42
Nodes (5): json(), malformedListingsBodies(), malformedStatusBodies(), pick(), ListingsController

### Community 5 - "Community 5"
Cohesion: 0.36
Nodes (3): Listing, StatusCheck, InitialSchema1794441600000

### Community 7 - "Community 7"
Cohesion: 0.6
Nodes (3): controllersOf(), join(), nestRoutes()

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ChaosService` connect `Community 2` to `Community 0`, `Community 4`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._
- **Why does `AdminController` connect `Community 6` to `Community 0`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Why does `ListingsStore` connect `Community 0` to `Community 4`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._