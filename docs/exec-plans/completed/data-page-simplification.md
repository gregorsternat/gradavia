# Data page simplification

## Outcome

Completed on 2026-10-16 (Asia/Shanghai), as a local diff against `b23f5a7`.
Product screens focus on observations and actions. Optional source, definition,
coverage and methodology disclosures and definition tooltips are removed from
formation search/detail/profiles, atlas, comparisons, specialties, overview,
territories, analyses, evolutions, the quiz footer and the landing data preview.
The static list/map explanation is removed; actual inactive-filter feedback stays.
Données & méthode, technical downloads, map attribution and export metadata remain.
The landing introduction/FAQ and printable export dossier retain their own scope.

The redundant formation directory is replaced by the primary table's optional
nonvirtualized render path. All 25 paginated rows and native links render during
SSR, with the same fixed scroll viewport. Other tables remain virtualized.
No API contract, statistical calculation, schema, dependency or lockfile changed.

## Decisions

- Preserve campaign, units, necessary population labels, missing/suppressed/invalid
  states, continuity gaps, chart-value tooltips and accessible value tables.
- Replace technical coverage annotations with “Partiel” for incomplete numeric
  totals. Explicit analysis tools such as the quality view keep their observations.
- Keep filters, exports, saved views, outlier results and actions. Evolution's
  analysis links move out of the removed source disclosure into ordinary actions.
- Remove obsolete components/imports/props and adjust grids rather than hide
  explanatory content with CSS.

## Verification

All commands used the pinned runtimes through `mise exec -- just`.

- `verify` passed: formatting, lint, types, architecture/docs, Clippy, 130
  TypeScript tests, 11 Node tests and Rust suites. The opt-in database test remains
  ignored in this fast command as designed.
- `build` passed without live credentials.
- `test-browser` passed 122 executions in development and 122 in production,
  using `CI=true`, isolated ports 3568/3569 and disposable PostgreSQL 18 fixtures.
  Selected specs: formations, seo, observatory, specialties, landing, atlas,
  analysis, evolutions and selections. Retries were zero.
- Journeys cover all 25 native formation links and pagination without JavaScript,
  absent optional blocks, retained methodology, zeros/suppression, history,
  filters, comparison, favorites, notes, sharing and exports with provenance.
- Real Chromium inspection covered 1440×960 and 390×844, light/dark, reduced
  motion, formation detail/profile tabs and keyboard history activation. Formation,
  overview, analysis, specialty and evolution pages had no horizontal page overflow.
  Charts were checked after responsive measurement; an early screenshot caught a
  transient initial size and was recaptured after measuring the settled bounds.

Evidence is under `.artifacts/data-pages/`: `verify-final.log`, `build-final.log`,
`browser-development.log`, `browser-production.log`, `manual-layout-check.log`,
`manual-chart-check.log`, final screenshots and `final/` browser reports/traces.
The independent manual fixture server used port 3570.

## Earlier failures and corrections

An initial overlapping build/type-generation run failed on generated Next.js
files; subsequent verification ran separately. An initial browser run passed
105 cases and failed nine: eight obsolete text assertions and one development
router error during source edits. After updating assertions, a development run
passed 121 and failed the skip-link focus check before hydration. The keyboard
journey now waits for the existing filter readiness signal; no-JavaScript links
remain independently tested. The final 244 executions pass. CLI snapshots briefly
outside `.artifacts` failed formatting; they were relocated before final checks.
Those earlier logs and failure traces remain under `.artifacts/data-pages` and
`.artifacts/browser-development` rather than being counted as successful runs.

## Boundaries

This establishes local Chromium validation with synthetic fixtures only. No live
Neon read, exhaustive `verify-full`, Firefox/Safari, physical-device validation,
remote CI, commit, merge or deployment was performed. Existing broader browser
and operational limits remain in the technical-debt register; no new deferred
implementation work is introduced.
