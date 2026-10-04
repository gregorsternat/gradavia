# Verification status

This document records observed evidence, not intended capabilities.

## Foundation verification (before raw ingestion)

Observed locally on 2026-10-03 (Asia/Shanghai), using the pinned toolchain.
The schema and data state in this historical table describes the foundation
milestone; raw ingestion evidence is recorded separately below.

| Check                                | Evidence                                                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Locked setup and doctor              | `just setup`, `just doctor` passed; Node 24.21.0, pnpm 11.21.0, Rust 1.98.1, just 1.58.0                                                                                             |
| TypeScript, formatting, lint, Clippy | `just check` passed                                                                                                                                                                  |
| Unit and architecture tests          | 6 Vitest cases, 4 boundary regression cases, 5 Rust tests passed                                                                                                                     |
| PostgreSQL 18                        | Disposable local container: Node and SQLx connectivity, migration apply, idempotency, and transaction rollback passed                                                                |
| Drizzle generation                   | `just db-generate` reports zero tables and no changes; no business migration created                                                                                                 |
| Development Neon                     | `just db-check` passed with Neon HTTP and SQLx; branch contains no tables; compute suspension verified at 300 seconds                                                                |
| Browser tests                        | 12 development and 10 production cases passed; 2 production gallery interaction cases intentionally skipped; gallery 404 explicitly verified                                         |
| Visual review                        | Real Chromium screenshots reviewed at 1440px and 390px, light and dark; chart axis contrast corrected                                                                                |
| Failure artifacts                    | Hydration regression reproduced, screenshot/video/trace retained, then test passed after the fix                                                                                     |
| GitHub Actions                       | [CI run 37066016490](https://github.com/gregorsternat/gradavia/actions/runs/37066016490) passed on Linux at `6857523`; `verification-1` diagnostics archive uploaded (472,695 bytes) |

Local tests, CI, merge, and deployment are separate states.

Local diagnostics live under `.artifacts`: browser reports and server logs,
database results/logs, `hydration-regression` for the reproduced failure, and
`output/playwright` for the visual review. They are intentionally ignored by Git.
The CI workflow uploads its own diagnostics even on failure.

## Raw ingestion verification

Observed locally on 2026-10-03 with the pinned toolchain:

- `just verify` passed, including credential-free builds and the existing browser
  suite: 12 development and 10 production cases, with two expected skips.
- `just check-ingest`: formatting, Clippy and 16 Rust tests passed.
- `just test-db`: PostgreSQL 18, real Drizzle migrations applied twice, all 14
  source shapes round-tripped through SQLx COPY, and a 10,017-row HTTP export
  loaded successfully.
- Database cases cover exact numeric precision, leading-zero identifiers,
  missing/null/masked values, duplicate source rows, idempotent replay, current
  pointer retention, concurrent locks, interrupted attempts and rollback after
  a failure in a later COPY batch, and publication of a reverted source snapshot
  without copying its rows again.
- Offline cases cover order-independent identity, source revisions, rate limits,
  truncated HTTP bodies, corrupted archives, schema drift and invalid JSON.
- A 76-second export survives PostgreSQL's 70-second idle-session timeout through
  periodic keepalive queries. SQLx 0.9 includes the TLS bulk-transfer deadlock fix.
- A local diagnostics write failure cannot turn a committed import into a
  reported import failure.
- `just db-migrate` and `just db-check` passed on isolated Neon development branch
  `development-raw-ingestion-cc59` (`br-wild-surf-b13o7v3x`).

The full live collection contains 14 releases and 357,164 records. SQL checks
match each source and campaign to its retained manifest. A complete repeat took
312.25 seconds and returned `unchanged` for all 14 sources. Independent SQL checks
confirmed no new records or releases, unchanged current pointers and campaign
counts, and no running attempts. Storage and timing are recorded in the
[execution plan](exec-plans/completed/raw-ingestion.md).
Diagnostics and source archives were retained in the original ingestion checkout
at that milestone. The current observatory checkout does not include that
`.data/raw` tree; archive inventory and backup are tracked as OPS-002.

## Formation explorer verification (before Rust API extraction)

Observed locally on 2026-10-04 (Asia/Shanghai):

- `just verify` passed: formatting, lint, types, architecture/docs checks,
  Clippy, 13 TypeScript unit cases, four architecture regression cases, the
  existing Rust suite, PostgreSQL 18 integration and a credential-free build.
- The database suite now verifies the real formation SQL: accents/case, literal
  wildcard and injection-like input, combined filters, historical labels and
  absent fields, duplicate preservation, stable pagination and bounds, and a
  current-release switch between campaign discovery and row retrieval.
- Playwright passed 22 development cases, 20 production cases with two expected
  gallery skips, and four production empty/unconfigured cases. These cover
  desktop/mobile, URL sharing/history, search/filter/campaign changes, keyboard,
  reduced motion, themes, accessibility scans and retry state preservation.
- Browser fixtures are explicitly injected and labeled; they use no credentials
  or external source access. Production empty/unconfigured scenarios verify
  that real-data failures never fall back to synthetic formations.
- Real Neon reads on `development-formation-explorer-fdf3` matched independent
  SQL counts for all eight campaigns: 10,697 (2018), 11,577 (2019), 12,760 (2020),
  13,396 (2021), 13,644 (2022), 13,869 (2023), 14,079 (2024), 14,252 (2025).
  Each response returned 25 rows. The `ecole paris` search matched 209 records in
  2025 without requiring accented input.
- Real Chromium screenshots were reviewed at 1440px and 390px; mobile light/dark,
  keyboard search submission and the filter disclosure were exercised against
  the live branch. SQL and UI use the retained source release, not the live MESR API.

Evidence: `.artifacts/verify.log`, `.artifacts/database/result.json`,
`.artifacts/formations-live.json`, browser reports in separate development,
production, unconfigured and empty directories, and screenshots/CLI snapshots in
`.artifacts/output/playwright/`. No remote CI, merge or deployment is claimed for
the formation explorer.

## Rust read API verification

Observed locally on 2026-10-04 (Asia/Shanghai), using the pinned toolchain:

- `just verify` passed: formatting, lint, types, architecture/docs checks, Clippy,
  11 Vitest cases, six Node boundary/environment cases, 23 Rust cases, PostgreSQL 18
  integration and credential-free builds of both services.
- PostgreSQL 18 tests exercise the real Rust HTTP service and validate responses
  with the frontend's Zod contract. They cover all eight campaign shapes, search,
  combined filters, pagination, duplicate identity, absent/whitespace-only values,
  historical labels, safe links and sanitized error responses. A controlled
  publication race confirms that rows, counts and facets use the captured release;
  the following request sees the new release.
- Browser tests use the actual API against a disposable database seeded only by
  the harness. The application contains no fixture reader, switch or fallback.
  Separate production scenarios cover no configuration, an empty database and an
  unavailable database, including loading and retry behavior. Playwright passed
  22 development, 20 production and six production state cases; two development-only
  gallery cases were intentionally skipped in production.
- Retry assertions now respect the bounded API/client deadlines. The keyboard
  test waits for streamed results before setting focus; ten focused repetitions
  passed across desktop and mobile after reproducing its loading race.
- Live API responses on `development-formation-explorer-fdf3` matched independent
  SQL for every campaign: 10,697 (2018), 11,577 (2019), 12,760 (2020), 13,396 (2021),
  13,644 (2022), 13,869 (2023), 14,079 (2024), 14,252 (2025), with 25 rows per page.
  The accent-insensitive `ecole paris` search returned 209 records in 2025.
- Real Chromium views were inspected at 1440px and 390px through Next.js and the
  Rust API. Keyboard search, mobile filter disclosure and light/dark themes passed.
  The worktree retains its isolated populated Neon branch and ignored, mode-600
  `.env.local`; the web supervisor strips database credentials from Next.js.
- After restarting `just dev`, liveness, database readiness, the formation endpoint
  and the website returned HTTP 200. The API and rendered page showed the real
  2025 campaign with 14,252 records; the API returned 25 rows.

Evidence: `.artifacts/verify-rust-api.log`, `.artifacts/database/result.json`,
`.artifacts/rust-api-live.json`, `.artifacts/rust-api-final-smoke.json`, browser
reports for all five scenarios and
`rust-api-*.png` in `.artifacts/output/playwright/`. Reproduced failures are kept in
`.artifacts/rust-api-retry-regression/` and `.artifacts/rust-api-keyboard-regression/`;
focused regression logs are retained alongside them.

No remote CI, merge or deployment was performed for this API extraction. API
hosting, network exposure, production database roles and monitoring remain
separate work in [technical debt](exec-plans/tech-debt.md).

## Complete observatory verification

Observed locally on 2026-10-04 (Asia/Shanghai):

- Source-aware indicators, overview, regional exploration, immutable detail,
  qualified history, same-campaign comparison, browser-local favorites and
  2025 specialty destinations are implemented behind the existing Rust/Next.js
  boundary. beUI controls, Tremor charts and Motion transitions share the new shell.
- Independent SQL reconciliation on the existing populated development branch
  matched the 2025 API totals: 14,252 formation rows, 4,058 identified establishments,
  769,351 places, 13,502,385 cumulative formation applications and 660,752 admitted.
  These application counts are not unique people.
- The source inventory returned all 14 published datasets and 357,164 retained
  rows. The 2025 specialties source contains 75 national rows, 5,475 group rows and
  11,661 formation rows. Reviewed count fields were complete and their ordering
  consistent; overlapping groups and levels are never added into a national total.
- Live read-only measurements after query optimization: overview 4.24 seconds on
  its initial request and 1.36 seconds cached, first request for another campaign
  2.12 seconds, formation detail 2.72 seconds. These are observations from this
  network/session, not a production latency guarantee. Cache keys are revalidated
  against current source pointers on every request.
- The original root environment points to an empty development branch. Live review
  explicitly selects the populated `development-formation-explorer-fdf3` branch
  using the explicit datasource setting (now `GRADAVIA_DATA_ENV_FILE`); no existing
  environment file or remote data was modified. The development supervisor strips
  that path and database credentials from Next.js.
- Real Chromium views were reviewed at 1440×1000 and 390×844 in light and dark
  themes. Live journeys covered campaign selection, search/card views, detail
  and keyboard history tabs, comparison, favorite persistence, specialty pair
  search/drill-down, territory filtering, source definitions and the command
  palette. Mobile document width remained within the viewport. No browser
  warnings or errors were captured during these journeys.
- Visual review corrected cramped sorting controls, oversized mobile comparison
  and specialty cards, territorial control wrapping and English source-family
  labels. Contrast, hydration and immediate keyboard checks passed 20 focused
  desktop/mobile repetitions with unchanged keyboard assertions.
- Final `just verify` passed on the completed implementation: formatting, lint,
  TypeScript, architecture/documentation checks, Clippy, 30 Vitest cases, seven
  Node boundary/environment cases, 28 Rust cases, PostgreSQL 18 integration and
  credential-free builds. The explicitly database-backed Rust case runs in the
  integration phase rather than the ordinary unit invocation.
- Playwright passed 54 development cases, 52 production cases and six production
  state cases (unconfigured, empty and unavailable). Two development-only gallery
  interaction cases were intentionally skipped in production; its HTTP 404 is
  tested separately. Coverage includes rapid search/sort/view transitions,
  shared comparison additions and successive removals, exports, persistence,
  keyboard access, reduced motion, themes and accessibility scans.

Evidence: `.artifacts/data-review/reconciliation.json`,
`.artifacts/data-review/live-profile-final.json`,
`.artifacts/backend-verification/database/result.json`,
`.artifacts/observatory-visual/review.json`, screenshots in
`.artifacts/observatory-visual/` and
`.artifacts/verify-observatory-delivery.log`. Reproduced failures and their traces
remain under `.artifacts/observatory-regressions/` and
`.artifacts/ui-foundation-regressions/`. Local verification, remote CI, merge and
public deployment remain separate states; no remote CI, merge or deployment was
performed for this milestone.

## PR #10 CI regression repair (2026-10-04)

The first remote [verification run](https://github.com/gregorsternat/gradavia/actions/runs/37183463982)
failed four development browser cases. Its traces identified visible tooltip
content outside landmarks, specialty text entry before hydration completed,
and a first detail-route compilation taking 5.3 seconds against a five-second
assertion budget. All preceding checks had passed.

- Portalled tooltips now have a named complementary landmark while keeping
  their tooltip role and trigger description. The accessibility test explicitly
  opens the theme tooltip before scanning the page.
- Combobox input remains disabled until hydration completes. A regression test
  gates JavaScript downloads, then verifies clean text entry and keyboard
  selection after releasing the gate on desktop and mobile.
- Development assertions allow 15 seconds for on-demand route compilation.
  Production assertions keep their five-second budget; retries remain disabled.
- The affected journeys passed 24 focused desktop/mobile repetitions with
  `CI=true` and two workers.
- Full `just verify` also passed with `CI=true`: all static/unit/database/build
  checks, 56 development browser cases, 54 production cases and six production
  state cases. Two development-gallery cases remain intentionally skipped in
  production.

Evidence: `.artifacts/pr10-ci-failure.log`, downloaded CI screenshots/traces and
server logs in `.artifacts/pr10-ci/`, and
`.artifacts/pr10-focused-fixed.log` and `.artifacts/pr10-verify.log`.

## Scope and limitations

- Formation detail, numerical indicators, same-campaign comparison, favorites,
  national/regional exploration and 2025 specialties are now implemented.
  Apprenticeship exploration, older specialty methodology and import scheduling
  remain deferred. Historical source links may point to current fiches or be
  unavailable; Gradavia does not reconstruct them.
- Builds and CI do not contact Neon or public datasets.
- No remote CI run, merge or deployment is claimed for the raw ingestion changes.
- Automated accessibility scans complement keyboard and visual review; they do
  not prove full screen-reader accessibility.
- Mobile browser tests use Chromium device emulation; Safari and Firefox have
  not been verified in this milestone.
- Documentation checks cover entry points and links, not semantic accuracy.
- Cloudflare preparation and the subsequent public release are recorded below.
  Manual data refresh, uptime alerts and freshness policies remain operational work.

## Landing page (2026-10-05)

- `/` is a distinct public landing page; `/observatoire` retains the existing
  overview. Valid legacy `/?campagne=YYYY` links preserve their selected campaign
  through a redirect. The wordmark returns to the new homepage.
- The homepage uses the existing beUI primitives, Tremor AreaChart and Motion
  with shared monochrome themes. Its preview reads the Rust API, preserves
  source/campaign/coverage and renders exact headline values immediately.
  Loading is inert; empty/unavailable data uses a useful search/navigation panel
  without invented metrics. Missing formation types are not turned into invalid
  search filters.
- `CI=true E2E_PORT=3250 mise exec -- just verify` passed: formatting, lint,
  types, architecture/docs, Clippy, unit tests, disposable PostgreSQL 18 contracts
  and credential-free builds. Browser coverage passed 70 development cases,
  68 production cases and 12 production state cases. Two development-gallery
  cases are intentionally skipped in production; its HTTP 404 remains covered.
- New browser journeys cover the standalone homepage, return navigation, legacy
  campaigns, accented GET search, exact preview data and coverage, keyboard
  metric/FAQ controls, skip link, reduced motion, both themes and 320px layouts.
  Accessibility scans cover the open source disclosure and visible theme tooltip.
  The initial run found a missing chart role and an ambiguous test selector;
  both were corrected. A later contrast test sampled a tooltip's entrance
  opacity; it now waits for its fully visible state before scanning. All ten
  repeated contrast cases passed. Landing/specialty journeys also passed 44
  focused repetitions; an initial specialty warning did not recur.
- Manual in-app Chromium review used the configured live read API with desktop
  and mobile viewports in both themes. Mobile refinements included full FAQ
  wrapping, inset keyboard focus, compact source attribution and a denser metric
  layout. No data import, migration or remote environment change was needed.

Evidence: `.artifacts/landing/verify-final.log`, `focused.log`,
`contrast-check.log`, and screenshots under `.artifacts/landing/`. Initial failure
traces are retained in its `initial-browser-failures/` and
`tooltip-transition-failure/` directories. The core content, links and native
search are server-rendered; enhanced preview/accordion interactions require
JavaScript. Full screen-reader, Safari/Firefox, remote CI and deployment have
not been verified for this change.

### Scroll entrance refinement (2026-10-05)

- Hero lines, copy and actions enter in sequence. Search columns, utility links,
  entry cards, source columns and the closing CTA reveal separately on scroll.
  The numeric preview enters as one surface without counting through false values.
- Entrances run once, preserve visible server-rendered/no-JavaScript content,
  and finish immediately for reduced motion and keyboard interactions.
- The first verification exposed lost pointer clicks when focus reset a moving
  target's position. Immediate focus handling now follows keyboard-visible focus,
  and its final position is retained after blur. The existing preview/table and
  route tests caught both the initial focus jump and the subsequent blur jump.
- All 18 focused desktop/mobile landing cases passed after correction. Coverage
  includes actual opacity/transform before and after scrolling, once-only
  entrances, focus-before-scroll recovery, reduced motion and native navigation
  and search with JavaScript disabled. Static contrast scans use reduced motion.
- Manual in-app browser inspection confirmed staggered desktop/mobile entrances
  and a visible keyboard focus after the search form appears.
- The final application code passed `just verify` through static checks, unit
  tests, PostgreSQL 18 contracts, credential-free builds, 74 development browser
  cases and 72 production browser cases (two intended gallery skips). The final
  state scan sampled an entrance fade; its test-only contrast setup was aligned
  with the reduced-motion scans above. All 12 production state cases then passed
  in a focused rerun, for 158 successful browser cases across the final runs.

Evidence: `.artifacts/landing/verify-motion-final.log`, `motion-states-final.log`,
`motion-focused-final.log`, `scroll-mobile.png`, `scroll-final.png`, and the
retained first-run traces under `motion-pointer-failure/`.

## Gradavia rename verification (2026-10-05)

- `CI=true E2E_PORT=3410 mise exec -- just verify` passed with the pinned
  toolchain: static checks, Clippy, 30 Vitest cases, seven Node boundary/environment
  cases, 28 Rust cases, PostgreSQL 18 integration and credential-free builds.
- Playwright passed 76 development, 74 production and 12 production-state cases.
  The two development-only gallery cases remain intentionally skipped in
  production. Legacy browser selections survive the rename; new empty selections
  take precedence, so removed favorites and comparisons do not reappear.
- Golden archive fingerprint and advisory-lock values preserve compatibility
  with the previous importer. No database migration or source reimport is needed.
- Real Chromium review at 1440×1000 and 390×844 verified the renamed landing,
  title metadata, wordmark and app navigation, including the command palette and
  mobile menu. The preview uses the real services with labeled synthetic records
  in disposable PostgreSQL, not a live Neon dataset.
- GitHub repository ID `1402245426` is now `gregorsternat/gradavia`, and the local
  `origin` points to its new URL. Neon project `morning-firefly-45046041` reports
  the name `gradavia`; only its display name was updated.

Evidence: `.artifacts/rename-gradavia/verify.log`, `.artifacts/database/result.json`,
`.artifacts/rename-gradavia/repository-{before,after}.json`,
`.artifacts/rename-gradavia/neon-project.json`, browser reports and screenshots in
`.artifacts/output/playwright/rename-gradavia/`. See the
[completed plan](exec-plans/completed/rename-gradavia.md) for compatibility decisions.
These observations do not assert a merge or deployment.

## Cloudflare preparation (2026-10-05)

- `CI=true E2E_PORT=3360 just verify` passed: static checks, Rust/TypeScript
  suites, PostgreSQL 18 contracts including real reader-role permission checks,
  credential-free builds, 76 development browser cases, 74 production cases and
  12 production state cases. Two development-gallery cases were expected skips.
- OpenNext 1.20.8 builds the pinned Next.js 16.3.8 application. Final web and API
  Worker dry runs passed with Wrangler 4.147.0. The web bundle is approximately
  2,426 KiB gzip; the private API Worker is approximately 13.55 KiB gzip.
- The Linux/amd64 image builds from digest-pinned Docker Official Images via
  public ECR. Docker Hub authentication was unreachable locally; no machine
  network configuration was changed. The runtime uses UID/GID 10001:10001.
  Local liveness returned 200; unavailable database cases returned sanitized 503.
- The same container successfully read the existing Neon development branch
  over TLS. All six health/product endpoints returned 200. The current 2025
  formation release contains 14,252 records; overview reports 4,058 identified
  establishments and eight historical campaigns. The current inventory has 13
  published sources and 199,655 rows, unlike earlier milestone snapshots. The
  cartography source has no publication and an import remains marked running.
- Live Neon CLI inspection maps that populated endpoint to `development`
  (`br-hidden-grass-b1z6hk64`), not `production`. The default production root is
  `br-tiny-leaf-b1dh585q`; its data has not been verified. No production database
  role, copied branch, import or credential was created during preparation.
- Actual workerd preview returned health 200, gallery 404 and a canonical 308
  preserving encoded queries. Real Chromium at 1440×1000 and 390×844 verified
  keyboard search, skip link, light/dark theme persistence and no horizontal
  overflow or console errors. This web preview intentionally had no API binding;
  it verifies the honest unavailable state, not the complete deployed data path.
- Runtime review found and fixed three adapter-specific issues: an unsupported
  future compatibility date, a serialized theme script broken by function-name
  helpers, and encoded query corruption in the adapter's canonical redirect.
  The configuration pins the installed runtime date, disables `keep_names`, and
  handles the canonical redirect before OpenNext. Focused regression checks pass.
- An independent read-only review found a new production-secret environment key
  reaching local web processes. The supervisor, standalone dev/build commands and
  regression key list now strip it; follow-up review found no remaining blockers.

Evidence: `.artifacts/cloudflare/verify.log`, `web-smoke.md`,
`web-dry-run-final.log`, `api-dry-run-final.log`, `api-image-build.log`,
`api-image-smoke.json`, `api-live-smoke.json`, and browser screenshots under
`.artifacts/output/playwright/cloudflare/`.

At the end of preparation, Workers Paid and renewed Wrangler authentication were
still required. Local checks alone did not establish public availability. These
prerequisites and the live release were subsequently completed below.

## Cloudflare public release (2026-10-05)

- The owner activated Workers Paid and renewed Wrangler OAuth. Cloudflare reports
  both custom domains on `gradavia-web`, with workers.dev and preview URLs
  disabled for both Workers. `gradavia-api` has no public route. Final versions:
  API `0e5e59c6-62c3-49a5-9940-45ed4a363c47`, web
  `ea72f0af-50f3-4a22-8700-c1d2edb29d69`.
- The empty default Neon production root and populated development branch were
  preserved. A normal independent `gradavia-production` branch was created from
  development, with matching release pointers, fingerprints, campaigns and
  counts: 14 registered datasets, 13 published releases and 199,655 raw records.
  Compute is fixed at 0.25 CU, with 300-second suspension. The copied ingestion
  journal does not indicate a production importer; cartography remains unpublished.
- The dedicated `gradavia_api` login read published data over the pooled TLS
  connection. A harmless write was rejected with PostgreSQL 42501 even inside a
  read-write transaction. Effective grants cover SELECT on the three source
  tables, without ownership, administrative attributes or role memberships.
  Only the reader credential remains in ignored local configuration; the
  temporary administrator environment was removed after provisioning.
- The first live web version exposed that workerd rejects `redirect: "error"`
  during Request construction. An actual runtime reproduction isolated it.
  The corrected service-binding path uses `manual` and rejects every 3xx before
  reading its body, with bounded, sanitized diagnostic stages. Regression tests
  cover refusal to follow redirects and omission of raw error names/messages.
- Final `CI=true E2E_PORT=3360 mise exec -- just verify` passed after the fix:
  formatting, lint, types, architecture/docs, Clippy, 49 Vitest cases, seven Node
  cases, Rust tests, PostgreSQL 18 contracts and credential-free builds. Browser
  suites passed 76 development, 74 production and 12 production-state cases;
  two development-gallery cases were intentionally skipped in production.
- Public HTTPS returned health 200 and gallery 404. The `www` canonical 308
  preserved the encoded path/query. Actual private API traffic appeared in the
  Cloudflare tail and the corrected site rendered published data end to end.
- Real Chromium at 1440×1000 and 390×844 verified 2025 overview aggregates:
  14,252 formations, 4,058 establishments, 769,351 places, 13,502,385 cumulative
  applications and 660,752 admitted. Accented search returned 789 results for
  `école`, and a real formation detail displayed its source and indicators.
- Keyboard selection and reload preserved the mathematics/SES specialty pair and
  its values; the CPGE ECG drilldown showed eight formation categories. Mobile
  homepage and specialties showed real data, retained the selected theme and had
  no horizontal overflow. Skip-link and mobile-dialog focus behavior passed.
  Browser console checks found no errors or warnings.
- A final independent read-only implementation review found no remaining blockers.

Evidence: `.artifacts/cloudflare/verify-release.log`, `production-database.json`,
`api-deploy.log`, `web-deploy-fixed.log`, `remote-routing.json`,
`remote-bindings.json`, `request-runtime.json`, `public-formations-fixed.html`,
`live-web-smoke.md`, and screenshots under
`.artifacts/output/playwright/cloudflare-live/.playwright-cli/`.

This verifies the public Cloudflare-to-Neon path; it does not claim remote CI,
a merge, cross-browser/load testing or automated ingestion. Container idle
shutdown is configured to ten minutes but was not timed in production. The
one-instance limit is not a monetary cap. See the
[completed plan](exec-plans/completed/cloudflare-deployment.md) and
[deployment guide](deployment.md) for operations and remaining limits.

## Landing search alignment and footer (2026-10-05)

- Removed the homepage footer tagline. The search field now sets its 48px
  height on the bordered container; the native input fills its inner height
  instead of overflowing the previous 44px container.
- Real Chromium review at 1440×1000 and 390×844 confirmed centered placeholder
  and entered text, with a measured input/container center offset of zero.
  Both widths also passed Tab/Enter search submission and footer inspection.
- `CI=true E2E_PORT=3451 mise exec -- just verify` passed static checks, unit
  tests, PostgreSQL 18 integration and credential-free builds. Its browser
  server initially hit the manual inspection server's Next.js checkout lock.
  After stopping that server, `just test-e2e` passed all remaining checks:
  76 development, 74 production and 12 production-state browser cases, with
  two intended development-gallery skips in production.

Evidence: `.artifacts/landing-alignment/verify.log`, `browser-rerun.log`, and
screenshots in `.artifacts/landing-alignment/output/playwright/`.
No remote CI or deployment was performed.

## Continuous deployment preparation (2026-10-05)

- The CI workflow now gates production publication on full verification of a main
  push. Pull requests cannot deploy. Verification is grouped by main SHA so old
  reruns cannot cancel a newer revision; production jobs queue without cancelling
  an active API/web pair and check the current main SHA before publishing.
- Both releases are built before mutation. The API publishes before the prebuilt
  web Worker. Only that publishing step receives `CLOUDFLARE_API_TOKEN`; the
  runtime database credential stays in Cloudflare. GitHub secret metadata confirms
  that the owner supplied the token; its value was not read or logged.
- The live public smoke passed with 14,252 formations, a real formation detail and
  provenance, health 200, canonical 308 preserving the query, and gallery 404.
  It retries bounded propagation/cold starts and records sanitized diagnostics.
- Two earlier main CI failures (runs `37220586933` and `37221950500`) were isolated
  to pre-hydration keyboard/click actions in existing browser tests. Trace
  snapshots showed chart placeholders before the action and SVGs afterward. The
  affected tests now await the client-rendered charts, following the suite's
  existing convention, without fixed sleeps, retries or product changes.
- Final `CI=true E2E_PORT=3360 mise exec -- just verify` passed: static checks,
  Rust/TypeScript suites, PostgreSQL 18 contracts, credential-free builds, 76
  development browser cases, 74 production cases and 12 state cases. Two
  development-gallery cases were intentionally skipped in production.
- Independent static review found no blockers. Focused Prettier, ESLint and diff
  checks passed. Actionlint 1.7.12 requires a narrowly scoped ignore for the newer
  `queue` key; its remaining checks pass. The queue syntax is supported by the
  [current GitHub workflow reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idconcurrency).

Evidence: `.artifacts/cloudflare-ci/verify.log`, prior failure logs/traces under
`.artifacts/cloudflare-ci/run-*`, and `.artifacts/cloudflare/smoke/result.json`.
These are pre-merge checks; actual CI, merge and production release outcomes are
recorded by the repository's [GitHub Actions runs](https://github.com/gregorsternat/gradavia/actions/workflows/ci.yml).
A stored secret or local smoke does not establish a successful GitHub deployment.
