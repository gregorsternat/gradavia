# Verification status

Reviewed on 2026-10-07 (Asia/Shanghai) against checkout `9f99df9`.
This page summarizes coverage and outstanding limits. Detailed past results live
in the [historical verification log](quality/history-through-2026-10-07.md).
A checked-in implementation, a local pass, remote CI, publication and production
health are separate observations; none establishes Google indexing or freshness.

## Current coverage

| Area                      | Executable evidence                                                                                                              | Remaining limit                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Architecture              | Import graph and Cargo dependency checks in `just check`; regression cases under `scripts/tests`                                 | Does not prove all side effects or statistical semantics                                                |
| Documentation             | Required entry points, local link targets, top-level document indexing and the 110-line AGENTS limit in `scripts/check-docs.mjs` | No anchor, external-link, semantic freshness or full nested-index validation                            |
| Domain and HTTP contracts | TypeScript/Rust unit tests and `just test-db` against real Drizzle migrations and the Rust binary on disposable PostgreSQL 18    | Synthetic records establish behavior, not current official source coverage                              |
| Browser journeys          | Chromium desktop/mobile in development and production; separate unconfigured, empty and unavailable production cases             | Safari, Firefox and manual screen-reader coverage remain UI-001                                         |
| Search discovery          | Metadata, crawler HTML, no-JavaScript formation navigation, sitemaps and unavailable-source cases                                | Search Console ownership, processing and search-performance evidence remain SEO-001                     |
| Cloudflare delivery       | OpenNext build, Worker dry runs and image build; main-only deployment after verification; public data smoke                      | `just verify` does not run `just cf-check` or the public smoke; publication can precede a failing smoke |
| Ingestion and provenance  | Archive/replay, source-shape, transaction and concurrency checks                                                                 | Imports are manual; live source/schema drift and remote archive backup need separate checks             |
| UI and local preparation  | Browser tests cover navigation, hydration readiness, chart equivalents, lists, sharing and storage failures                      | Historical visual review is scoped to the recorded change, not a fresh audit of every screen            |

See [repository workflow](harness.md) for commands and maintenance rules,
[development](development.md) for isolation, and [technical debt](exec-plans/tech-debt.md)
for follow-up triggers.

## Evidence at this refresh

The checkout includes the SEO foundation, the shared G mark, the palette input
focus correction, browser-readiness fixes and removal of the sidebar BÊTA badge.
These are established by source and local Git history through `9f99df9`, not by
assuming every recent main commit has reached production.

The archived 2026-10-07 landing-readiness and branding checks record full local
verification with 131 development, 129 production and 18 data-state browser
executions passing, with eight intended exclusions. Those counts belong to
those runs; they are not a result for this documentation change.

At the initial read-only GitHub inspection, main
[run 37628801351](https://github.com/gregorsternat/gradavia/actions/runs/37628801351)
for `9f99df9` was still running. A run's successful verification alone is not
proof that the publish and smoke steps executed; inspect those exact steps when
reporting release state. The preceding completed
[run 37610391926](https://github.com/gregorsternat/gradavia/actions/runs/37610391926)
at `7d2bcd5` was checked directly: verification, current-main selection, API/web
publication and public data smoke all succeeded. This establishes that release's
outcome, not the current runtime health or publication of subsequent commits.
No live Neon inventory or production data refresh was performed for this update.

### Documentation refresh validation

On 2026-10-07, `WRANGLER_SEND_METRICS=false CI=true E2E_PORT=3528 mise exec -- just verify`
passed in worktree `862e` for the documentation diff on `9f99df9`: formatting,
lint, types, architecture/docs, Clippy, 104 TypeScript cases, Node/Rust suites,
disposable PostgreSQL 18 contracts and credential-free builds. Chromium passed
131 development, 129 production and six cases in each of the three production
data states (278 executions, eight intended exclusions).

Evidence: `.artifacts/docs-refresh/verify.log`. Final documentation formatting,
local links/fragments and `git diff --check` passed. The historical log was checked
against the original: only its introduction and relocated relative links changed.
Application code, workflows and lockfiles are unchanged. No new manual visual
review, Cloudflare build or deployment was performed for this documentation-only
change. See the [completed plan](exec-plans/completed/documentation-refresh.md).

## Reading and adding evidence

- Keep this page a current summary. Put detailed investigations and historical
  run narratives in linked files under `docs/quality/` or a completed plan.
- Record the date/timezone, tested revision or local diff, environment, command,
  result, exclusions and evidence location. Never replace a failed run with an
  undifferentiated later success.
- `.artifacts/` is ignored and local to a checkout; CI artifacts expire after
  seven days. A path records where evidence was produced, not durable access.
  Preserve the useful conclusion and public run link in versioned documentation.
- Dataset totals must name the source release/campaign and observation context.
  Old totals are not assertions about the current configured Neon branch.
- Use the [historical log](quality/history-through-2026-10-07.md) for foundation,
  ingestion, observatory, deployment, expanded exploration, SEO and UI evidence.
  Recheck the relevant path before promoting historical evidence to current status.
