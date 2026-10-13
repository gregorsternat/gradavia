# Page-load performance

## Objective and scope

Reduce server waiting time without increasing provisioned infrastructure. Preserve
the current appearance, public Rust API, source provenance, true detail 404s,
server-rendered primary content and keyboard/native navigation.

The approved scope is a WEUR placement constraint for the existing single basic
container, a strict 900-second named Cloudflare Cache API cache for validated public
reads, page-local Suspense for the six spaces, deferred formation insights and
concurrent code/data loading on tool activation. SQL redesign and atlas pagination
are out of scope. The container's ten-minute sleep and Neon capacity stay unchanged.

## Baseline and decisions

Initial production samples from the same client/network showed formation lists
waiting 4.5–5.2 seconds, details 6.4–6.6 seconds and overview 2.2–2.6 seconds before
the first response. The container was in lax13/WNAM while Neon was in Frankfurt.
The browser showed the map's view module and Leaflet loading after its data request.
These observations are diagnostic samples, not the final five-run comparison.

- Cache normalized API requests by endpoint, campaign, family, requested version
  and filters under a versioned namespace. Validate before writing and on reading.
  Never store empty, unavailable, invalid or not-found responses; cache failures
  fall back to the private API binding. Local development bypasses this cache.
- Use Cache API directly, without new storage bindings or automatic Workers Cache.
  Keep transport timeouts, response bounds and sanitized error reporting.
- Put Suspense inside workspace pages, not a shared layout/loading route, so a
  nested formation can still decide its HTTP 404 before streaming.
- Load insight code and its compact app-route response together only on activation.
  Pin the peer atlas to the enriched detail's campaign, family and release. Keep
  retries, per-visit retention and stale-response protection.
- Preload only activated tools, including Leaflet for maps. Preserve workspace
  deduplication, retained panels, history and disabled speculative link prefetch.

## Implementation and verification

1. Implement and test cache isolation, expiry, validation and failure fallback.
2. Add streamed workspace fallbacks and deferred insights with focused browser
   coverage for slow responses, retries, concurrent imports and retained state.
3. Exercise desktop/mobile navigation, direct URLs, metadata, no-JavaScript and 404s.
4. Run `just verify`, focused browser tests, `just test-smoke`, `just cf-check` and
   the database/other checks selected by CI. Record exact outcomes and limitations.
5. Publish the API then web through the existing main pipeline. Verify actual
   placement, data and five-run cold/warm measurements from the baseline client.
   Target at least 50% lower warm median waiting, measuring first display and data
   readiness separately. Keep prior Worker versions available for rollback.

## Evidence and remaining work

Implementation is complete. On 2026-10-14 (Asia/Shanghai), the local diff against
`0b76fc4` passed `just verify` (130 TypeScript cases, Node/Rust suites and all
format/type/import/documentation checks), `just test-db` on disposable PostgreSQL
18, a credential-free build and the Linux container image build.

Production Chromium passed 20 desktop/mobile performance and SEO executions with
an opt-in 1,200 ms upstream delay. They verify streamed placeholders, concurrent
Leaflet/insight imports, deferred atlas reads, retry/retention, real 404 responses
and source-pinned summaries. A final 84-case production regression run covers
formations, atlas, workspaces and SEO. Manual inspection at 1440×960 and 390×844
covered map/profile keyboard activation, browser history and overflow (none).

The initial runs exposed hidden streamed content without JavaScript and stale
body-level canonical metadata after a campaign change. Scoped no-script styling
and metadata reconciliation fix those regressions; the final runs above passed.
The native-heading assertion now targets visible accessible headings rather than
the hidden loading placeholder. Evidence, including unsuccessful diagnostic runs,
is retained under `.artifacts/performance` (`slow-final.log`, `regression.log`,
`verify-final.log`, `db.log`, screenshots and browser traces).

Five repeated baseline requests from the same client measured median TTFB of
4.395 s (Formations), 6.452 s (detail), 1.925 s (overview), 3.487 s (list data) and
2.958 s (map data). Separate five-run Chromium baselines record first contentful
paint and visible data readiness in `before-browser.log`; these are unthrottled
local-network observations, not French-user field metrics.

The final `just test-smoke` passed all 16 desktop/mobile executions. `just cf-check`
passed the OpenNext build, both Worker dry runs and the container image build;
the WEUR constraint is accepted by the pinned Wrangler schema. No dependency
versions or lockfiles changed. The exhaustive browser matrix was not requested.

Remote CI, publication, actual WEUR placement and after-publication measurements
remain to be recorded. Previous active Worker
versions were verified before publication: API `b36c4994-7ca0-4e38-baf3-7e214c246214`
and web `08f65c04-df0b-42ea-b1f5-11d11454115a`. Roll back those Workers if required;
reverting container placement additionally requires redeploying its configuration.
