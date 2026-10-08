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
