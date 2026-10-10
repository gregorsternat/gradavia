# Cloudflare Free publication and performance

## Objective

Keep Next.js, existing French product screens, interactions, URLs and search
discovery while replacing the paid Container and request-time database/rendering
work with explicit immutable publications and a Rust/Wasm read Worker. Completion
requires verified production behavior and an effective Workers Free subscription;
local code, tests and deployment alone do not prove that outcome.

## Accepted decisions

- Preserve the current interface, history navigation, persistent panels, themes,
  keyboard access, print behavior and retained formation identities.
- Keep Next.js. Prerender public pages and their navigation payloads at publication.
- Neon remains the source of truth for offline publication; no database secret
  or SQL driver is delivered to a public Worker or browser.
- Prepare atlas, history, overview, specialties, detail enrichment, peers and
  search indexes before publication. Keep the previous complete publication if
  any preparation, validation or deployment step fails.
- Keep API response semantics, provenance and missing/suppressed/invalid values.
- Store validated public publication artifacts in versioned GitHub release assets.
- Partition static assets deterministically below 18,000 files per Worker and
  reject oversized files, excessive Workers/bindings or an incomplete manifest.
- Never enable paid overages automatically. Audit other account workloads before
  downgrading; do not remove unrelated resources.

## Implementation sequence

1. Record baseline behavior and performance, with cold and repeated journeys.
2. Implement the immutable publisher and Wasm search/read contracts. Prove one
   catalog-to-detail path before extending to every family and retained campaign.
3. Prerender the existing Next.js views and preserve query variants, metadata,
   RSC navigation, hydration and no-JavaScript crawlable paths.
4. Connect versioned static data to the existing workspace; remove full-atlas
   detail reads and redundant parsing, reads and main-thread calculations.
5. Add manifest validation, static sharding, staging, release-pointer switching,
   compatible rollback and version-pinned browser reads.
6. Run focused contracts, real PostgreSQL fixtures, browser parity, quota checks,
   `just verify`, and Cloudflare-specific build/runtime verification.
7. Publish only a complete verified release, smoke-test production, remove the
   obsolete Gradavia Container resources, and verify the account downgrade.

## Acceptance

- Visual parity at desktop/mobile widths in light/dark themes; all current
  interaction, SEO and no-JavaScript contracts remain covered.
- Search parity includes normalization, literal wildcard characters, filters,
  unavailable fields, stable ties, pagination and retained identities.
- Failed or concurrent publications never expose mixed/partial data. Missing or
  invalid artifacts fail closed without replacing the last good release.
- Measure CPU on Cloudflare, including cold cache: target p99 below 8 ms and no
  resource-limit errors; memory below 128 MiB. Local timing is not edge CPU proof.
- Controlled mobile targets: LCP <= 2.5 s, CLS <= 0.1, representative interaction
  response <= 200 ms; target at least 50% lower p95 for initially slow journeys.
- Generated assets and every involved Worker stay within the Free plan. Sharding
  does not multiply the account's dynamic request allowance.
- Verify all deployment and billing states independently. Neon, GitHub and domain
  costs are outside the Cloudflare Workers subscription objective.

## Progress and evidence

- 2026-10-09: isolated worktree from `adc1f64`; source checkout was clean.
- Native SQL/publication parity passed for 177 HTTP contracts across eight fixture
  campaigns. The Rust/Wasm bundle builds and runs in real local workerd.
- Prerendered 222 fixture pages and full RSC payloads, including campaign/paging,
  view variants, a query shell and the existing not-found page. Local workerd
  browser verification passed 173 tests with five intended exclusions.
- Packing accounts for asset bindings ignoring Range: bounded 256 KiB streaming
  slices for small objects and standalone streams for large objects. Private
  deployments, activation evidence gates and previous-release bindings are implemented.
- A repeatable native browser failure exposed a specialty drill-down race: changing
  the indicator before the group read completed could discard that group. Controls
  now use the existing workspace pending state; a delayed-response regression test
  covers the invariant without changing styling or copy.
- Read-only Neon inspection confirmed 199,655 source records across 13 releases.
  The production `gradavia_api` reader was selected in this isolated checkout;
  native PostgreSQL sessions close from this machine, so no production snapshot
  or full publication has completed. SQL through the Neon connector remains reachable.
- Read-only Cloudflare inventory found `gradavia-web`, `gradavia-api` and the
  unrelated `fen-tricount-china-preview` Worker. Subscription inspection returned
  HTTP 403 with the current OAuth token. No production routes, resource deletion,
  account plan or paid subscription were changed.
- `just verify` passed: 124 TypeScript cases, Node/Rust suites, PostgreSQL 18
  contracts, credential-free builds and 366 browser executions (175 development,
  173 production and 18 data-state cases; eight intended exclusions).
- The final local Cloudflare run verifies all retained dataset exports byte-for-byte
  for CSV and structurally for JSON/metadata, then passes the 173 browser cases.
  All five generated Worker configurations pass Wrangler deployment dry runs;
  the Wasm API bundle is approximately 319 KiB compressed, below the Free size limit.
- Executable bundles are frozen before rendering and participate in the document
  publication identity. Deployment validates their checksums and every shard.
  The saved activation receipt supports rollback without rebuilding old code.
- Keep this plan active until the production-scale publication, Cloudflare CPU/
  memory and controlled page-performance measurements, cutover, obsolete-resource
  cleanup and effective account downgrade have actually been verified.
- 2026-10-10: PR #33 merged as `1bde30a8`; main CI, the existing runtime deployment
  and the complete current-dataset production smoke passed. The production reader
  secret is configured. The manual publication workflow passed its contract and
  local workerd checks and started production snapshot/preparation; no immutable
  production candidate is activated yet.
- The Account Analytics Read token is configured in GitHub. Manual monitoring is
  available before cutover, while scheduled monitoring retains its runtime gate.
  Its first successful run measured 73,537 account requests over 24 hours.
  Authenticated billing access is available; Workers Paid remains active until
  publication validation and obsolete-resource cleanup are complete. See
  [quality status](../../quality.md) for the exact workflow evidence.
- Production preparation exposed repeated campaign scans in the existing history
  lookup. The first run was cancelled after more than 20 minutes without finishing
  its first detail campaign. Add the exact source-identity expression index through
  Drizzle, prove bounded work with a 20,000-row database regression, then rerun the
  real publication. Source values, duplicate semantics and public UI stay unchanged.
- The production mobile analysis baseline measured a 280 ms Event Timing sample
  when opening Quality with 14,252 formations (CPU throttled 4x). View and
  annotation changes recreated the filter configuration and invalidated all
  aggregations. Keep filtering memoized by its actual filter fields; retain
  aggregation results across presentation-only changes. Verify the same real-data
  journey again on the final candidate before claiming a performance improvement.
- A temporary Cloudflare client profile using real public production data sent
  960,158 Brotli bytes for the 10,169,567-byte analysis document. Offline Brotli
  quality 9 produces 685,378 bytes without changing its contents. Prepare optional
  encoded HTML/RSC representations above 128 KiB, store their references in the
  existing lookup, and negotiate them through the page Worker and gateway. Verify
  exact wire bytes, identity fallback, HEAD and conditional requests in workerd
  before measuring the final candidate. This diagnostic is not a production
  publication and must be removed after profiling.
