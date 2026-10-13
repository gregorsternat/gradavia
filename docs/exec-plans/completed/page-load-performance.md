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

## Local verification

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

## Publication and live verification

PR [#44](https://github.com/gregorsternat/gradavia/pull/44) passed remote
[verification](https://github.com/gregorsternat/gradavia/actions/runs/38446293456)
at `aa2f900` and merged as `dec5704` on 2026-10-13 at 18:31 UTC.
The [main pipeline](https://github.com/gregorsternat/gradavia/actions/runs/38447518391)
passed verification, Cloudflare release validation, API-first publication and
the public data/routing smoke. API version `ed4a126e-8b5c-43ab-b513-92f4efe6e024`
was published at 18:43:15 UTC, followed by web version
`cb7b6c81-7c02-4e7b-ac91-672147ddf447` at 18:43:43 UTC, both at 100% traffic.

The Containers API then reported the actual running instance in `dub02/WEUR`,
replacing its previous `lax13/WNAM` placement. Application version 20 has the
WEUR constraint and preserves maximum one instance, 0.25 vCPU, 1 GiB memory
and 4 GB disk. The ten-minute sleep and Neon configuration were not changed;
no storage service was added. This establishes unchanged provisioned capacity,
not a forecast of usage-based billing.

Live desktop/mobile Chromium journeys passed map activation with Enter, browser
history and formation profiles, with no horizontal overflow. Each profile tab
made zero insight requests before activation and exactly one on activation.
Native keyboard navigation from the formation directory to a detail also passed
with JavaScript disabled on both widths; an unknown formation returned HTTP 404.

## Five-run production comparison

Requests used the same client/network, URLs and unthrottled Chromium viewport
(1440×960) before and after. The initial post-publication curl responses identified
the NRT Cloudflare location. Timings below are seconds; each before/warm value is
the median of five sequential requests. Every measured response was HTTP 200.
The detail is the same source-pinned formation throughout:
`1930a15e-f868-4e0b-8518-5a6e81e5e498:11439`.

| Request          | Before TTFB | First after publication | Warm TTFB | Reduction | Warm complete response |
| ---------------- | ----------: | ----------------------: | --------: | --------: | ---------------------: |
| Formations       |       4.395 |                   1.536 |     0.546 |     87.6% |                  0.619 |
| Formation detail |       6.452 |                   2.734 |     1.208 |     81.3% |                  1.267 |
| Observatory      |       1.925 |                   1.039 |     0.523 |     72.9% |                  0.614 |
| List data        |       3.487 |                   0.580 |     0.482 |     86.2% |                  0.483 |
| Map data         |       2.958 |                   2.409 |     1.044 |     64.7% |                  1.473 |

List data uses `/api/workspace/formations`. Map data uses
`/api/workspace/carte?campagne=2025&tri=name&famille=parcoursup`.
The warm median TTFB reduction exceeds the 50% target on all five requests.

Separate Chromium navigations distinguish first contentful paint (FCP) from the
visible main heading after data arrives. The latter is a reproducible proxy for
primary content readiness, not a measurement of every interaction or chart.
The post-change selector excludes hidden streamed headings; both runs wait for
the same visible primary heading.

| Page             | Before FCP | Warm FCP | Before visible content | Warm visible content |
| ---------------- | ---------: | -------: | ---------------------: | -------------------: |
| Formations       |      3.200 |    0.204 |                  3.247 |                0.384 |
| Formation detail |      6.832 |    0.184 |                  6.869 |                0.204 |
| Observatory      |      1.484 |    0.156 |                  1.535 |                0.350 |

Raw samples, comparison scripts, publication inventory and screenshots are retained
in `.artifacts/performance`: `before.json`, `after-first.json`, `after.json`,
`before-browser.log`, `after-browser.log`, `comparison.json`, `deployment.json`,
`main-ci.json`, `production-browser.log` and `production-native.log`.

## Limits and rollback

The first post-publication pass primes the new named cache, then the five measured
passes reuse it. This is not five independently purged cold-cache measurements:
public traffic can prime entries, and list/data requests share a cache entry.
No production-wide purge was performed. Unit tests establish strict expiry at
900 seconds, while the slow-response browser tests establish progressive display.
These local-network measurements are not French-user field Core Web Vitals or
post-idle cold-start measurements. Full-atlas transfer size, SQL redesign and
server pagination remain [PERF-001](../tech-debt.md).

The live no-JavaScript check also exposed a pre-existing presentation limit:
`NumberTicker` includes the correct server-rendered screen-reader text but its
visual digit rolls stay at zero without JavaScript. That unchanged component is
tracked as UI-003; the native-navigation pass does not establish visual metric
parity or interactive-chart functionality without JavaScript.

Previous active Worker versions were verified before publication: API
`b36c4994-7ca0-4e38-baf3-7e214c246214` and web
`08f65c04-df0b-42ea-b1f5-11d11454115a`. Roll back those Workers if required;
reverting container placement additionally requires redeploying its configuration.
No rollback was needed.
