# Async tables

## Objective

Use the source-owned beUI async table across interactive data views. Replace
visible row pagination with incremental loading while retaining cards, native
no-JavaScript formation navigation, printable dossiers and chart alternatives.

## Decisions

- Network pages: 25 formations and 12 favorite details through the existing workspace facade.
- Local datasets: sort/filter the complete population, then reveal 25 rows; atlas cards use 20.
- Preserve loaded rows on failure, offer retry, reject obsolete or mixed-release pages.
- Keep private Rust and public dataset contracts unchanged.
- Preserve complete sharing identities, notes consent and print coverage.

## Steps

1. Compose existing beUI loading/virtualization with shared progress and retry controls.
2. Migrate formation, favorites and atlas cards, then all interactive tables.
3. Add behavioral regression coverage and update architecture/design/provenance evidence.
4. Run verification, targeted browser journeys and production smoke.

## Cache compatibility

Explicit workspace refreshes bypass and replace the cached formation batch using
an app-only request header. This prevents a release-change recovery from reading
the same stale first page again. Normal page reads retain the existing cache TTL.

## Evidence

Validated locally on 2026-10-14 in the `5acf` checkout:

- `just verify`: formatting, lint, types, architecture/documentation checks,
  Rust checks and unit suites, including 133 TypeScript cases.
- `just test-db`: disposable PostgreSQL 18 contracts, real migrations and reader
  privileges passed; no live development database was accessed.
- `just test-smoke`: credential-free production build and all 16 desktop/mobile
  smoke executions passed on the final application code.
- Production regression coverage: 134 executions passed in the broad run;
  the two hidden-panel cancellation cases passed after correcting the test to
  allow automatic continuation on return. All 136 selected desktop/mobile
  cases are validated across those runs. This covers formations, selections,
  analysis, evolution, atlas, observatory, specialties, workspaces and SEO.
- Added behavior checks exercise final-page accumulation, duplicate/invalid
  responses, release changes, forced cache refresh, failed batch retry, obsolete
  searches, hidden-panel aborts, globally sorted local batches, focus retention
  and complete shared-list printing/import.
- Browser inspection covered light/dark desktop/mobile tables and reduced motion;
  keyboard End loads the next batch and returning from the map retains all rows.
  Screenshots and traces remain under `.artifacts/`.

Evidence: `.artifacts/async-verify-final.log`, `.artifacts/async-smoke-final.log`,
`.artifacts/async-final.log`, `.artifacts/async-cancellation.log`, and
`.artifacts/manual-ui/`.

Earlier development runs exposed a delayed initial favorite read on mobile and
an unavailable shared-list presentation regression; both were corrected and
covered by subsequent passing production journeys. Test expectations were also
updated for cumulative counts and full-cohort sorting.

No dependency, lockfile, database schema or public Rust API change was needed.
Remote CI, merge and deployment are not part of this local validation.

## Table footer refinement

Following UI feedback, all async tables hide the manual load-more action. Their
focusable scroll regions still load batches on keyboard or pointer scrolling,
and errors retain an explicit retry action. Card grids also load automatically with no manual load-more
action, following the subsequent request to apply this behavior everywhere. Both specialty tables inherit the shared header typography instead of
forcing numeric column labels to 10px.

Validation: `just verify`, `just build`, and 16 targeted production browser cases
passed on desktop/mobile (async formations, analysis and specialties). The
development harness initially encountered the already-running local Next server;
the successful run used a separate production server on port 3634.

The card follow-up passed `just verify`, `just build` and eight targeted desktop/
mobile browser cases covering automatic card accumulation, retry, shared lists
and atlas navigation. Card footers were also inspected on the local development
server at desktop and mobile widths. Evidence: `.artifacts/cards-auto-*`.

## Automatic-loading audit

A three-batch browser matrix exposed a hidden-panel virtualization regression:
when ResizeObserver reported an empty visible range, both spacers disappeared.
The scroll extent collapsed, losing the position or triggering an extra batch on
reactivation. Retaining the full bottom spacer for an empty virtual range fixes
both symptoms without changing the data-loading contract.

`async-loading.spec.ts` now exercises 25 → 50 → 61 rows for specialties, inverse
specialties, territories, analysis and evolution using expanded synthetic browser
responses. It checks scroll-driven loading, keyboard End/Home, final row reachability,
absence of manual load controls and position retention across hidden panels.
The matrix also checks atlas cards (20 → 31) and shared favorites (12 → 24 → 31),
including distinct requested IDs. The 14 cases pass in desktop and mobile Chromium;
mobile uses the dark theme and the local-table matrix uses reduced motion.

Small history, comparison, profile and chart-alternative tables remain covered by
the existing family journeys; they fit in one batch with the fixture population.

After the fix, `just verify` and all 150 targeted production browser cases passed
in a single run (`.artifacts/auto-audit-final.log`). Live local-data checks also
confirmed 25 → 50 → 75 → 100 formations out of 14,252 in both table and card views,
with desktop/light and mobile/dark screenshots under `.artifacts/auto-audit-live-*`.
Mobile checks use Chromium emulation/responsive viewports, not a physical device.

The final `just test-smoke` production build and all 16 desktop/mobile smoke
journeys passed (`.artifacts/auto-audit-smoke.log`).
