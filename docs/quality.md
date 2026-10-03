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

## Scope and limitations

- Frontend data exploration, derived indicators and import scheduling remain
  deferred. This milestone stores raw source releases only.
- Builds and CI do not contact Neon or public datasets.
- No remote CI run, merge or deployment is claimed for the raw ingestion changes.
- Automated accessibility scans complement keyboard and visual review; they do
  not prove full screen-reader accessibility.
- Mobile browser tests use Chromium device emulation; Safari and Firefox have
  not been verified in this milestone.
- Documentation checks cover entry points and links, not semantic accuracy.
- Cloudflare runtime and deployment remain unverified until the hosting milestone.
