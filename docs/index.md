# Documentation

Use this index to find the source of truth for each concern.

Start with [product scope](product.md) and [architecture](../ARCHITECTURE.md).
Use [repository workflow](harness.md) for change/verification practices and
[quality status](quality.md) for current coverage. Historical results are retained
in the [verification archive](quality/history-through-2026-10-07.md); they are not
an assertion about the current deployment or database contents.

| Document                                            | Purpose                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| [Architecture](../ARCHITECTURE.md)                  | Module boundaries and runtime interfaces                               |
| [Product](product.md)                               | Audience, supported journeys and on-demand product direction           |
| [Repository workflow](harness.md)                   | Context ownership, executable guardrails and documentation maintenance |
| [Development](development.md)                       | Setup, environments, migration and test procedures                     |
| [Deployment](deployment.md)                         | Cloudflare runtime, credentials, release checks and operations         |
| [Search discovery](seo.md)                          | Canonical URLs, sitemaps, indexation policy and Search Console rollout |
| [Design system](design-system.md)                   | Visual and accessibility conventions                                   |
| [Data contract](data-contract.md)                   | Source provenance and statistical meaning                              |
| [Analysis methodology](analysis-methodology.md)     | Cohorts, chart aggregation, missingness and reproducible analysis      |
| [Feature coverage](feature-coverage.md)             | Individual delivery decisions for the 80 requested capabilities        |
| [Enrichment feasibility](enrichment-feasibility.md) | Reviewed external sources and unresolved matching requirements         |
| [Read API](api.md)                                  | Rust HTTP contract, service configuration and failure semantics        |
| [Raw ingestion](ingestion.md)                       | Sources, commands, archives and recovery                               |
| [Decisions](decisions.md)                           | Technical choices and tradeoffs                                        |
| [Quality](quality.md)                               | Verification evidence and limitations                                  |
| [Third-party sources](third-party.md)               | Vendored components, licenses and changes                              |
| [Execution plans](exec-plans/index.md)              | Active/completed plans and technical debt                              |

Repository documentation is versioned with code. `just check` checks entry
points, local link targets, top-level index membership and AGENTS length offline.
Anchor validity, semantic accuracy and external references still require review.
