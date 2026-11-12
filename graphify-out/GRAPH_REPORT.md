# Graph Report - mock-resturant-app  (2026-11-12)

## Corpus Check
- 8 files · ~1,603 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 15 nodes · 21 edges · 5 communities (2 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]

## God Nodes (most connected - your core abstractions)
1. `AppController` - 5 edges
2. `AppService` - 5 edges
3. `AppModule` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities (5 total, 3 thin omitted)

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppController` connect `Community 2` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.245) - this node is a cross-community bridge._
- **Why does `AppService` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.135) - this node is a cross-community bridge._