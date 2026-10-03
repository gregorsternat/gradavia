# Technical debt and deferred decisions

| ID         | Work                                                                         | Trigger                                                        |
| ---------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| DATA-002   | Formation continuity and cross-campaign cohort methodology                   | First longitudinal comparison                                  |
| DEPLOY-001 | Workers adapter, runtime bindings, caching, secrets and deployment checks    | Hosting milestone                                              |
| DB-001     | Separate least-privilege read, ingestion and migration roles                 | Before deployment; development currently uses the branch owner |
| TOOL-001   | Upgrade ESLint 9 after Next.js plugin peers support ESLint 10                | Compatible release available                                   |
| UI-001     | Validate real chart semantics, series distinction and screen-reader behavior | First product visualization                                    |
| OPS-001    | Production monitoring, ingestion scheduling and freshness reporting          | Before public production use                                   |

Raw ingestion resolves DATA-001 with local immutable archives, multiset replay
identity and atomic releases. Remote archival, retention cleanup, analytics,
authentication and background jobs remain deferred. APB is collected separately;
its longitudinal comparability is still covered by DATA-002.
