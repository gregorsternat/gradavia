# Verification status

This document records observed evidence, not intended capabilities.

## Foundation verification

Observed locally on 2026-10-03 (Asia/Shanghai), using the pinned toolchain.

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

Update this table after executing the commands. Record failures and limitations
without treating local tests, CI, merge, or deployment as interchangeable.

Local diagnostics live under `.artifacts`: browser reports and server logs,
database results/logs, `hydration-regression` for the reproduced failure, and
`output/playwright` for the visual review. They are intentionally ignored by Git.
The CI workflow uploads its own diagnostics even on failure.

## Scope and limitations

- No real Parcoursup data has been imported or charted.
- No business schema, import schedule, or comparison methodology is implemented.
- Database integration covers synthetic migrations, idempotency and transaction
  failure; source quality tests belong to future ingestion.
- Builds and CI do not contact Neon or public datasets.
- Live Neon diagnostics are separate read-only development checks.
- Automated accessibility scans complement keyboard and visual review; they do
  not prove full screen-reader accessibility.
- Mobile browser tests use Chromium device emulation; Safari and Firefox have
  not been verified in this milestone.
- Documentation checks cover entry points and links, not semantic accuracy.
- Cloudflare runtime and deployment remain unverified until the hosting milestone.
