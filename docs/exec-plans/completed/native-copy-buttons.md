# Native copy buttons

## Objective and scope

Restore the previous beUI copy controls and remove the vendored clipboard
library, its registry, global styles and license. Preserve canonical workspace
URLs, captured source versions and explicit consent for sharing private notes.

## Steps

- [x] Restore beUI sharing controls and their French success/error feedback.
- [x] Remove unused vendored source, registry configuration and theme tokens.
- [x] Update clipboard journeys and current architecture/design/provenance docs.
- [x] Run `just verify`, focused browser journeys and desktop/mobile inspection.

## Acceptance criteria

- Sharing uses the existing beUI secondary button with the copy/check icon.
- Keyboard copying and denied clipboard access remain understandable.
- Analysis/evolution URLs preserve source versions and canonical tab destinations.
- Lists exclude notes by default and expose a manual share link after copying.
- The removed library has no remaining source imports, registry or global styles.

## Verification

On 2026-10-12 (Asia/Shanghai), the diff against `0ac4ec4` passed:

- `WRANGLER_SEND_METRICS=false CI=true mise exec -- just verify`: formatting,
  lint, types, architecture/docs, Clippy, 115 TypeScript cases and Node/Rust suites.
- `WRANGLER_SEND_METRICS=false CI=true mise exec -- just build`: credential-free
  Next.js production build and locked Cargo workspace build.
- Focused Chromium journeys in development (`E2E_PORT=3608`) and production
  (`E2E_PORT=3610`): 14 desktop/mobile executions per runtime, 28 passed total.
  They cover keyboard copying, route/hash changes, stale clipboard completions,
  denied access, source versions, comparison sharing, note consent, both-theme
  accessibility and reduced motion.

Real Chromium inspection at 1440×960 and 390×844 confirmed the beUI appearance,
visible keyboard focus, Enter activation and light/dark readability. The mobile
page content width equals its 390px viewport. Screenshots and command logs are
under `.artifacts/native-copy/`; browser reports remain under
`.artifacts/browser-{development,production}/`.

No dependency versions or lockfiles changed. The exhaustive suite, remote CI,
deployment and live source data were not checked. Existing Safari/Firefox and
manual screen-reader limits remain in [technical debt](../tech-debt.md).
