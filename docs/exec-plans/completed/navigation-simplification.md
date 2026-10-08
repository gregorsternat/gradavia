# Simplify application navigation

## Objective and scope

Expose five primary destinations: Formations, Spécialités du bac, Comparer,
Mon projet and Observatoire, with Données & méthode in the footer. Preserve all
existing routes, local selections, shared links and statistical boundaries.

## Decisions

- Keep `/favoris` as the entry to Mon projet; existing lists and preparation
  remain there, with Budget as a secondary destination.
- Use a labelled secondary section selector, avoiding stacked analysis tabs.
- Present List/Map as representations and apprenticeship as a separate scope.
  Transfer only compatible filters between paginated search and the atlas;
  document unsupported filters and the atlas release boundary visibly.
- Preserve legacy map family URLs, while exposing APB under methodology.
- Keep discovery in Observatoire and modality comparison under Comparer.

## Steps

1. Inspect current screens at desktop/mobile widths and route contracts.
2. Centralize navigation ownership and palette entries; add secondary navigation.
3. Add scope/view controls and conservative URL conversion, retaining atlas
   snapshot/filter context when switching apprenticeship representations.
4. Test route ownership, context conversion and browser journeys, then run
   `mise exec -- just verify` and manually inspect desktop/mobile and keyboard.
5. Update contracts/evidence, complete this plan, commit and create a PR.

## Acceptance and evidence

Implementation and local verification complete. The worktree began clean
from main `6f14ab0`.
Manual review uses the repository's disposable synthetic dataset harness, not
production data. Remote CI and deployment will be reported separately.

Intermediate checks found and repaired a missing legacy palette alias and
production metadata remaining on the previous campaign when new navigation
links prefetched the active search URL. Navigation prefetching is now disabled.
A new list/map test also needed to await the view transition before reloading.
The four targeted desktop/mobile production regressions pass after these fixes.
An initial focused run could not start beside the manual development server;
a subsequent run had one router-initialization error in the existing gallery
while editing. It did not recur in the complete development suites.
Logs and retained failure traces are under `.artifacts/navigation/`.

## Final verification (2026-10-07, Asia/Shanghai)

`WRANGLER_SEND_METRICS=false CI=true E2E_PORT=3544 mise exec -- just verify`
passed on the final application diff against `6f14ab0`: formatting, lint, types,
architecture/docs, Clippy, 110 TypeScript tests, Node/Rust suites, real migrations
and API/ingestion contracts on disposable PostgreSQL 18, and credential-free builds.
Chromium passed 137 development and 135 production cases, plus six cases in each
of the unconfigured, empty and unavailable production states: 290 passed
executions, with eight intended exclusions. Evidence: `.artifacts/navigation/verify.log`.

Real-browser inspection used the disposable fixture server on ports 3540/3542,
with 1200/1440-pixel desktop and 390-pixel mobile viewports. Inspected the original
sidebar/search, then final search, analysis, territories, archives, favorites,
apprenticeship and comparison in light/dark themes. Exercised the section selector
with Home/ArrowDown/Enter, command palette navigation, Escape dismissal, mobile
menu, and favorite/comparison actions and their sidebar counts. Screenshots and
CLI snapshots remain under `.artifacts/navigation/`; fixtures are explicitly
synthetic and do not establish live source coverage.

Intermediate failures remain in `focused-startup-failure.log`, `focused.log`,
`verify-palette-alias-failure.log` and `verify-production-failure.log`, with retained
traces in the same artifact directory. The focused production repair run passed
all four affected desktop/mobile cases before the final full verification.

## Remaining limits

Regular list/map readers intentionally differ in advanced filters and release
selection; the UI explains these boundaries. No source definitions, database
schema, API contracts, selection storage formats or dependencies changed. No new
navigation debt remains. Existing Safari/Firefox and manual screen-reader limits
remain UI-001 in the technical debt register. Remote CI and publication are
separate observations; this change does not merge or deploy itself.

## PR review follow-up (2026-10-08, Asia/Shanghai)

Both reported regressions were reproduced against `3f0a2fc`: location buttons
remained rendered without the map, and five historical palette queries lost
existing destinations. The fix gates location actions on the same map visibility
condition and restores the missing keywords. It introduces no new navigation or
localization behavior.

Regression tests use the real palette matcher for interests, saving, general-bac,
cities and statistics aliases, including both statistical destinations. The
existing desktop/mobile apprenticeship journey now asserts that a geolocated
record has no location button in List, regains it in Map, and loses it again
after returning to List and reloading. Before the fix, five unit cases and both
browser variants failed as expected.

The follow-up diff against `3f0a2fc` passed
`WRANGLER_SEND_METRICS=false CI=true E2E_PORT=3544 mise exec -- just verify`:
115 TypeScript cases, Node/Rust suites, disposable PostgreSQL 18 contracts,
credential-free builds and 290 Chromium executions (137 development, 135
production and 18 data-state cases; eight intended exclusions). Real-browser
inspection at 1440-pixel desktop and 390-pixel mobile widths confirmed the hidden
List actions and the available Map action. The palette was opened with Ctrl+K,
all five historical queries found their destinations, and Escape dismissed it.
Evidence is kept under `.artifacts/navigation-review/`, including `verify.log`
and before-fix failures. These synthetic fixtures do not establish live data
coverage; remote CI, merge and deployment remain separate observations.
