# Page-specific loading skeletons

## Outcome

All 18 workspace panels select a feature-owned skeleton from the requested
route, family and representation. Server streaming, first client data reads and
lazy tool imports share these compositions. Forms, cards, maps, charts and tables
retain their responsive structure. Existing content remains mounted during
refreshes, with a layout-neutral accent instead of visible loading copy.

Deferred homepage previews, formation profiles, maps and favorite hydration use
local placeholders. Network card batches append decorative placeholders; table
rows share the new reflection. Local synchronous reveals add no delay. Error,
empty, retry, source and caching behavior remains unchanged.

## Implementation decisions

- Shared original CSS primitives support both themes, reduced motion and hidden
  panels without JavaScript animation or new dependencies.
- Loading regions expose French accessible status; placeholders are decorative
  and never receive keyboard focus.
- Route-local Suspense and no-JavaScript handling are retained. Detail routes
  retain their pre-stream not-found decisions.
- Public APIs, schema, dependency manifests and lockfiles are unchanged.

## Verification (2026-10-16, Asia/Shanghai)

Local diff against `9dbdc08`, using disposable PostgreSQL 18 fixture data:

- `CI=true WRANGLER_SEND_METRICS=false mise exec -- just verify` passed checks,
  TypeScript/Node/Rust unit suites. Final evidence: `.artifacts/skeletons/verify-final.log`.
- `CI=true E2E_PORT=3650 WRANGLER_SEND_METRICS=false mise exec -- just test-smoke`
  passed the credential-free build and all 16 production smoke executions.
  Evidence: `.artifacts/skeletons/smoke-final.log`.
- The first development regression run passed 100 cases, skipped 12 opt-in slow
  server cases, and failed four new apprenticeship cases because the test tried
  to activate the already-selected tab instead of switching family. Corrected
  family interactions and six delayed server deep links then passed all 16
  desktop/mobile cases with `E2E_API_DELAY_MS=1200`.
  Evidence: `.artifacts/skeletons/focused.log` and `slow-and-followup.log`.
- All 54 focused production cases passed: 18 panel skeletons on desktop/mobile,
  retained refresh results, delayed modules, incremental cards, retry, map and
  insights activation, true detail 404s and native no-JavaScript navigation.
  Evidence: `.artifacts/skeletons/production-focused.log`.
- Six additional production visual cases cover map, budget and territories in
  both themes at both widths, including static reduced motion and active CSS
  reflections. Evidence: `.artifacts/skeletons/themes.log` and `themes/`.
- Real Chromium screenshots were inspected at desktop and emulated mobile
  widths; keyboard activation retains focus and no horizontal overflow appeared.
  The analysis page was additionally inspected through Playwright CLI.
  Evidence: `.artifacts/skeletons/analysis-desktop.png`, `production/` and `themes/`.

No live-data audit, physical-device validation, Safari/Firefox run, manual
screen-reader audit, remote CI result, merge or deployment is established.
