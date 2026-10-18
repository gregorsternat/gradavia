# Product scope simplification

## Objective

Remove the discovery quiz, manual budget calculator, weighted personal-priority
ranking, selection concentration notices and campaign playback. Preserve research
analysis, historical comparisons, exports, provenance and data access.

## Decisions

- Remove retired tools from navigation, metadata, loaders and client bundles.
- Redirect old budget URLs to favorites and quiz URLs to the observatory.
- Keep explicit map sorting, radius filters and selection distribution charts.
- Keep before/after and per-field historical charts and their exact tables.
- Leave existing browser-local budget storage untouched; no migration or deletion
  of personal browser data is necessary.
- Adapt shared workspace regression tests to surviving tools rather than losing
  coverage for history, drafts, lazy loading, retries, printing and keyboard use.

## Steps

1. Remove implementations and obsolete references; preserve legacy navigation.
2. Update focused regressions and current product/methodology documentation.
3. Run `just verify`, a credential-free build and relevant browser tests.
4. Inspect desktop/mobile rendering and keyboard behavior; inspect the final diff.

## Evidence

Completed on 2026-10-18 (Asia/Shanghai), local diff against `e32d976`.

- `mise exec -- just verify`: passed; 129 TypeScript cases and Node/Rust suites.
- `mise exec -- just build`: passed without live credentials.
- Production Chromium focused runs used `CI=true`, `E2E_PORT=3638`,
  `E2E_PRODUCTION=1`, `WRANGLER_SEND_METRICS=false` and
  `ARTIFACTS_DIR=.artifacts/simplification` with `just test-browser` for
  workspace, async-loading, atlas, evolutions, analysis, selections, shell and
  observatory specs. All 157 executions passed on desktop/mobile; five checks were intentionally
  skipped: three mobile-only cases on desktop and two development-only gallery
  cases.
- Browser evidence covers retired path/tab redirects, rejected API panels,
  command palette, keyboard activation, history/drafts/retries, deferred modules,
  favorites/notes/checklists/printing, maps and retained source-aware research
  exports. Existing research calculations and data contracts are unchanged.
- Visually inspected production screenshots of Favorites and Analysis at 1280px
  and 390px widths, plus the live before/after and per-field history views.
- Logs: `.artifacts/simplification-{verify,build,browser,docs}.log`.
  Screenshots/traces: `.artifacts/simplification/browser-production/`.
  Additional history screenshot: `.artifacts/product-scope-audit/04-evolution-simplified.png`.
- Initial checks caught a stale test variable and an unused import; both were
  corrected before the successful verification. Final documentation formatting
  was corrected separately and rechecked.

No dependencies, lockfiles, database schema or source definitions changed.
No remote CI, merge, deployment, live dataset audit, physical-device testing or
manual screen-reader validation was performed. Existing browser-engine and
assistive-technology limitations remain in UI-001; no new technical debt was added.
