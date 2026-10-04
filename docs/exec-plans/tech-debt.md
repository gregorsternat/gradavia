# Technical debt and deferred decisions

| ID         | Work                                                                                                                        | Trigger                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| DATA-002   | Validate longitudinal cohort comparability beyond conservative source-identifier and label continuity; APB remains separate | Any claim about like-for-like longitudinal change                                         |
| DATA-003   | Review historical specialty and apprenticeship definitions before adding comparable product journeys                        | Expansion beyond the reviewed 2025 specialty population and non-apprenticeship admissions |
| DEPLOY-001 | Website Workers adapter, Rust API host, network boundary, secrets and deployment checks                                     | Hosting milestone                                                                         |
| DB-001     | Separate least-privilege read, ingestion and migration roles                                                                | Before deployment; development currently uses the branch owner                            |
| TOOL-001   | Upgrade ESLint 9 after Next.js plugin peers support ESLint 10                                                               | Compatible release available                                                              |
| UI-001     | Manual screen-reader and Safari/Firefox verification of composite controls, virtual tables and chart equivalents            | Before broad public release                                                               |
| OPS-001    | Production monitoring, ingestion scheduling and freshness policy                                                            | Before public production use                                                              |
| OPS-002    | Inventory and back up raw ingestion archives outside their original worktree                                                | Before retiring an ingestion checkout or enabling scheduled refresh                       |

Raw ingestion resolves DATA-001 with immutable archive and multiset replay
contracts and atomic releases. Source-aware metrics and exploration are now
implemented. Remote archival, retention cleanup, authentication and background
jobs remain deferred. The populated database was verified during this milestone;
the current checkout does not contain the original `.data/raw` archive tree.
