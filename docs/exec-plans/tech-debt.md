# Technical debt and deferred decisions

| ID         | Work                                                                         | Trigger                                                        |
| ---------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| DATA-001   | Raw artifact storage/retention, replay keys, staging and atomic publication  | First import                                                   |
| DATA-002   | Formation continuity and cross-campaign cohort methodology                   | First longitudinal comparison                                  |
| DEPLOY-001 | Workers adapter, runtime bindings, caching, secrets and deployment checks    | Hosting milestone                                              |
| DB-001     | Separate least-privilege read, ingestion and migration roles                 | Before deployment; development currently uses the branch owner |
| TOOL-001   | Upgrade ESLint 9 after Next.js plugin peers support ESLint 10                | Compatible release available                                   |
| UI-001     | Validate real chart semantics, series distinction and screen-reader behavior | First product visualization                                    |
| OPS-001    | Production monitoring, ingestion scheduling and freshness reporting          | Before public production use                                   |

Authentication, APB, business tables, and background job infrastructure are
outside the foundation scope. Add them only for a concrete product requirement.
