# Verification status

This document records observed evidence, not intended capabilities.

## Foundation verification (before raw ingestion)

Observed locally on 2026-10-03 (Asia/Shanghai), using the pinned toolchain.
The schema and data state in this historical table describes the foundation
milestone; raw ingestion evidence is recorded separately below.

| Check                                | Evidence                                                                                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Locked setup and doctor              | `just setup`, `just doctor` passed; Node 24.21.0, pnpm 11.21.0, Rust 1.98.1, just 1.58.0                                                                                          |
| TypeScript, formatting, lint, Clippy | `just check` passed                                                                                                                                                               |
| Unit and architecture tests          | 6 Vitest cases, 4 boundary regression cases, 5 Rust tests passed                                                                                                                  |
| PostgreSQL 18                        | Disposable local container: Node and SQLx connectivity, migration apply, idempotency, and transaction rollback passed                                                             |
| Drizzle generation                   | `just db-generate` reports zero tables and no changes; no business migration created                                                                                              |
| Development Neon                     | `just db-check` passed with Neon HTTP and SQLx; branch contains no tables; compute suspension verified at 300 seconds                                                             |
| Browser tests                        | 12 development and 10 production cases passed; 2 production gallery interaction cases intentionally skipped; gallery 404 explicitly verified                                      |
| Visual review                        | Real Chromium screenshots reviewed at 1440px and 390px, light and dark; chart axis contrast corrected                                                                             |
| Failure artifacts                    | Hydration regression reproduced, screenshot/video/trace retained, then test passed after the fix                                                                                  |
| GitHub Actions                       | [CI run 37066016490](https://github.com/gregorsternat/orvio/actions/runs/37066016490) passed on Linux at `6857523`; `verification-1` diagnostics archive uploaded (472,695 bytes) |

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
Diagnostics remain in `.artifacts`; complete source archives remain in `.data/raw`.

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

## Scope and limitations

- Formation detail pages, numerical indicators, comparisons, apprenticeship
  exploration and import scheduling remain deferred. Historical source links may
  point to current fiches or be unavailable; Orvio does not reconstruct them.
- Builds and CI do not contact Neon or public datasets.
- No remote CI run, merge or deployment is claimed for the raw ingestion changes.
- Automated accessibility scans complement keyboard and visual review; they do
  not prove full screen-reader accessibility.
- Mobile browser tests use Chromium device emulation; Safari and Firefox have
  not been verified in this milestone.
- Documentation checks cover entry points and links, not semantic accuracy.
- Cloudflare runtime and deployment remain unverified until the hosting milestone.
