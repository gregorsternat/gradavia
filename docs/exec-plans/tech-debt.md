# Technical debt and deferred decisions

This is a register of limits and triggers, not a prioritized roadmap. The owner
chooses the next task; a trigger identifies when a constraint must be revisited.

| ID       | Work                                                                                                                                               | Trigger                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| DATA-002 | Validate longitudinal cohort comparability beyond conservative source-identifier and label continuity; APB remains separate                        | Any claim about like-for-like longitudinal change                                                      |
| DATA-003 | Review historical specialty definitions and cross-family equivalence beyond separate apprenticeship exploration                                    | Expansion beyond the reviewed 2025 specialty population or any claim of aligned admission procedures   |
| DATA-004 | Integrate and validate Onisep, InserSup/InserJeunes, campus services, official events and transport data                                           | Implementing deferred enrichments listed in the feature coverage register                              |
| UI-002   | Export raster/Parquet and hosted embeds with explicit data/version contracts                                                                       | Demand beyond current reproducible CSV, JSON and standalone SVG exports                                |
| PERF-001 | Replace bounded full-atlas transfers with indexed server queries if campaigns grow past 30,000 records                                             | Dataset cap, measured memory pressure or unacceptable latency; never silently sample                   |
| DB-001   | Separate ingestion and migration roles; the production runtime reader is already provisioned                                                       | Before automating production migrations or ingestion                                                   |
| TOOL-001 | Upgrade ESLint 9 after Next.js plugin peers support ESLint 10                                                                                      | Compatible release available                                                                           |
| UI-001   | Manual screen-reader and Safari/Firefox verification of composite controls, virtual tables and chart equivalents                                   | Before claiming broader browser and assistive-technology support                                       |
| OPS-001  | Production monitoring, ingestion scheduling and freshness policy                                                                                   | Before expanding beyond the initial public launch                                                      |
| OPS-002  | Inventory and back up raw ingestion archives outside their original worktree                                                                       | Before retiring an ingestion checkout or enabling scheduled refresh                                    |
| SEO-001  | Verify Search Console ownership, submit the sitemap and record indexing/search-performance baselines; assess field performance and API cold starts | After publishing the search-discovery changes; requires property access and actual production evidence |

Raw ingestion resolves DATA-001 with immutable archive and multiset replay
contracts and atomic releases. Source-aware metrics and exploration are now
implemented. Remote archival, retention cleanup, authentication and background
jobs remain deferred. Populated databases and local archives were verified in
earlier milestones;
that evidence does not establish current branch contents or an archive backup.
New worktrees do not automatically receive the original `.data/raw` tree.
