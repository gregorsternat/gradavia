# Persistent workspace tabs

## Objective

Keep each primary destination mounted while switching its tools. Load only the
requested panel initially, preserve local panel state, and retain shareable URLs,
server rendering, source semantics and historical links.

## Decisions

- Six workspaces retain their existing root paths. `onglet` selects a panel;
  `famille` selects the formations population. Legacy tools redirect permanently.
- Server rendering and a bounded same-origin read facade share feature loaders.
  The browser never addresses the private Rust API directly.
- Visited panels and their latest data remain in memory until leaving the space.
  The active URL is authoritative; inactive panels cannot navigate or read it.
- Formation readers stay distinct. Only compatible filters cross representations;
  view-specific filters remain available when returning.
- Preserve indexation per tool, native links, accessible keyboard activation,
  local-storage boundaries, immutable source identities and missing-value states.

## Implementation

- Added one route/panel registry used by workspace rendering, navigation groups,
  command destinations, canonical links, legacy redirects and metadata.
- Extracted modality/evolution compositions into server-only panel loaders and
  exposed the bounded same-origin GET facade. No Rust/schema contract changed.
- Added scoped History navigation, per-panel query/draft state, retained mounted
  views, deduplicated reads, shared overview/source payloads and stale-response
  guards. Failed reads remain retryable without clearing other tools.
- Kept both formation readers, compatible criteria transfer, explicit inactive
  criteria, archived map identities and pagination when defaults are implicit.
- Added manual keyboard activation, native anchor destinations, a stable beUI
  panel host, paused hidden animations and retained chart/map dimensions.
- Redirected legacy routes before streaming and removed workspace loading
  boundaries that concealed the initial panel when JavaScript was disabled.
- Added browser coverage for all workspace tool pairs, local drafts/notes,
  pagination/scroll, map camera, cached returns, history, redirects/fragments,
  slow/stale responses, failure recovery, SEO and native no-JavaScript links.

## Verification and limits

Completed on 2026-10-08 (Asia/Shanghai). The implementation started from main
including merged PR #29 (`d8acc7a`). Final validation covered the local diff on
checkpoint `e0ce3a3`.

`CI=true E2E_PORT=3540 mise exec -- just verify` passed: formatting, lint, types,
architecture/documentation checks, Clippy, 115 TypeScript tests, Node/Rust suites,
disposable PostgreSQL 18 contracts and a credential-free production build.
Chromium passed 165 development, 163 production and 18 production data-state
executions (346 total, eight intended exclusions).

Browser coverage includes every tool pair, native history, direct links,
no-JavaScript rendering, redirects/fragments, metadata, selection privacy,
retained pagination/scroll and map camera, hidden chart dimensions, delayed and
obsolete requests, retry recovery and lazy JavaScript downloads. The Budget
bundle is absent on initial Favoris load and downloaded on first activation.

The initial full run after separating tool bundles exposed ten development
readiness failures. Controls now expose disabled state until hydration, and
keyboard tests wait for that observable state. All fourteen targeted follow-up
executions passed before the final full run. Evidence is in
`.artifacts/workspace-tabs/verify.log`, `readiness.log`, `code-loading.log` and
`verification-notes.md`; earlier diagnostic runs remain in the same directory.

Manual Chromium inspection covered the desktop territory view, mobile quiz and
analysis tabs, horizontal tab scrolling and keyboard activation. Screenshots and
CLI traces are retained under `.artifacts/workspace-tabs`.

This work does not add global persistence, unify the formation readers, change
published data, or publish the application. Remote CI and deployment are separate
from local fixture verification.

## PR #31 review follow-up

The review of `8aeef8b` identified three reproduced regressions: inactive
favorites print CSS blanked Budget output, shared-list retries refreshed only
server props while the retained entry stayed stale, and representation links
replaced an explicitly requested campaign with an earlier payload's campaign.

- Mount global print styles only while their favorites/budget panel is active.
- Route scoped `refresh()` through the existing entry invalidation/read facade.
  Standalone views retain Next refresh behavior; inactive panels cannot refresh.
- Use source campaign/version defaults only for an unchanged loaded context and
  only when the corresponding parameter is absent.

All three browser regressions failed on both desktop and mobile before the fixes,
then passed (six executions). Budget print screenshots were visually inspected at
both widths. Evidence is under `.artifacts/workspace-review` (`before.log`,
`before-results`, `focused.log`, `focused-results`). The first full run then
exposed ten failures in local-favorite synchronization because the new retry
callback changed router identity on every workspace render. The callback is now
stable and all sixteen targeted favorite/share/regression executions pass
(`stable-refresh.log`); the failed full-run evidence is retained in
`verify-before-stable-refresh.log` and `unstable-refresh-results`. A second full
run exposed two existing tests activating native links before hydration, bypassing
the intended facade interception or keyboard listener. Network traces confirm
document navigation. These tests now wait for enabled controls; all four targeted
executions pass (`readiness.log`, with failures retained in
`verify-before-readiness.log` and `readiness-results`). The skip-link/theme test
also waits for client readiness before its first keyboard action; its preceding
failure is retained in `verify-before-skip-readiness.log`. The same native-link
fallback affected the project cache test (`verify-before-tab-readiness.log`).
Workspace interaction tests now share an opening helper that waits for roving
keyboard focus to initialize; no-JavaScript tests retain native navigation.

On 2026-10-09 (Asia/Shanghai), final `CI=true E2E_PORT=3540 mise exec -- just verify`
passed for the local diff on `8aeef8b`: all code/documentation checks, 115 TypeScript
tests, Node/Rust suites, PostgreSQL 18 contracts and the production build. Chromium
passed 171 development, 169 production and 18 production data-state executions
(358 total, eight intended exclusions). Final evidence: `.artifacts/workspace-review/verify.log`.
Remote CI and publication are separate from this local result.

## PR #31 CI follow-up

CI run `37806978985` on `8f08c19` failed three development browser executions:
rapid comparison removals on desktop/mobile and saved theme restoration on desktop.
The previous local pass did not establish remote reliability.

Comparison actions received the last loaded IDs while a newer read was pending.
A second removal could therefore reintroduce the first removed formation. The
panel now receives current requested IDs and filters retained results before
rendering cards, charts, tables and exports. Theme radios use the existing
client-ready guard so they cannot accept a click before hydration restores the
saved preference and attaches event handlers.

The shared-comparison journey now holds the first removal response until the
second has completed, checks immediate removal and verifies that the late response
does not restore removed rows. A new theme journey holds JavaScript downloads,
checks disabled controls, then restores the saved theme and switches to the system
preference. Both regressions failed on desktop/mobile before the fixes (four
executions); eight focused comparison, theme and keyboard executions then passed.
Evidence: `.artifacts/ci-workspace/before.log` and `focused.log`, with isolated
browser traces beneath `before/` and `focused/`. Manual Chromium inspection covered
the comparison after consecutive removals and theme keyboard controls at desktop
and mobile widths; screenshots are retained in the same evidence directory.

Final local `CI=true E2E_PORT=3540 mise exec -- just verify` passed on 2026-10-09
for the diff on `8f08c19`: all checks, unit/database suites, build and 362 Chromium
executions (173 development, 171 production, 18 data states; eight intended
exclusions). Evidence: `.artifacts/ci-workspace/verify.log`. A preliminary check
stopped at formatting because CLI snapshots were outside `.artifacts`; those
snapshots were moved and documentation formatted before the successful full run.
Remote CI and deployment remain separate observations.
