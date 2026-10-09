# Arc copy buttons

## Objective and scope

Add Arc as a source-owned UI registry alongside beUI and replace the site's
clipboard actions with the official free `copy-button`. Preserve copied URLs,
captured source versions, explicit note-sharing consent and manual-copy recovery.
List duplication remains a separate local-storage action.

## Decisions

- Install the official registry source and its foundation/motion dependencies.
- Keep the existing monochrome themes and offline system-font stack. Isolate
  foundation styles from existing beUI controls and map shared semantic tokens.
- Localize copy feedback in French and retain keyboard/reduced-motion support.
- Resolve browser URLs after hydration, with no browser reads in server render.

## Steps

- [x] Inspect official source, current actions and existing sharing journeys.
- [x] Install Arc, integrate tokens and replace all clipboard actions.
- [x] Update provenance, design conventions and focused behavioral coverage.
- [x] Run `just verify`, inspect desktop/mobile and keyboard behavior, record evidence.

## Acceptance criteria

- All clipboard writes use Arc's shared copy feedback.
- Success/failure confirms in place with an accessible French announcement.
- Analysis/evolution links retain captured releases; list links exclude notes by
  default and refuse an oversized annotated URL.
- Both themes, reduced motion and narrow screens remain usable.

## Verification and remaining limits

On 2026-10-09 (Asia/Shanghai), the local diff against `d8acc7a` passed:

```sh
WRANGLER_SEND_METRICS=false CI=true E2E_PORT=3566 mise exec -- just verify
```

Formatting, lint, types, architecture/docs checks, Clippy, 115 TypeScript cases,
Node/Rust suites, disposable PostgreSQL 18 contracts and credential-free builds
passed. Chromium passed 139 development and 137 production executions, plus six
in each of the unconfigured, empty and unavailable production states: 294 passed,
eight intended exclusions. Browser fixtures assert no unexpected client console
or runtime errors. Production server logs also contain early destination-stream
closures during the run; these did not fail the browser assertions.

The new/extended journeys verify the actual clipboard contents after keyboard
activation and route/hash changes, stable layout width, persistent/selectable
manual recovery after a denied clipboard write, captured analysis/evolution
source versions, and both note-sharing consent states. Reduced-motion browser
journeys and both-theme axe checks remain passing.

Real in-app-browser inspection covered 390, 768, 1024 and 1440 widths, light/dark,
keyboard activation, 44px copy controls and no horizontal page overflow. Saved
screenshots include `.artifacts/arc-copy/desktop-light.jpg`, `mobile-light.jpg`
and `dark-{390,768,1024,1440}.jpg`. Browser error-state captures are under
`.artifacts/browser-development/results` and `browser-production/results`.

Earlier attempts are preserved separately: the first browser harness lacked the
fresh checkout's API binary; `just test-db` prepared it and passed. A focused
width assertion sampled the press transform rather than layout width; the fixed
assertion measures `offsetWidth` with an explicit button type. The first full
check caught the missing type annotation. The final full run above passes.
Evidence: `.artifacts/arc-copy/{prepare-browser,focused-browser,focused-retry,
verify-initial-check,verify}.log`. The temporary manual browser, server and
its disposable PostgreSQL container were cleaned up.

No dependency versions changed; both lockfiles are unchanged. No remote CI,
merge, deployment or live dataset audit is established by these local checks.
Existing Safari/Firefox and manual screen-reader limits remain UI-001 in
[technical debt](../tech-debt.md).

## Arc review

The checklist below applies to changed copy controls and their integration.
Unrelated page layouts, charts, overlays and logo regions are outside this audit.
Checked items passed where applicable. The following intentional integration
exceptions are retained:

- The existing system-font stack replaces the skill's Geist/Inter default, in
  accordance with the repository's offline design contract.
- The application exposes a monochrome accent only. Both product themes were
  inspected; there is no second product accent to review.
- Upstream foundation palette/unused gradient definitions are preserved. Local
  styles use semantic tokens. Official component blur, stroke animations and
  deliberate timing presets are retained; the new recovery UI adds no motion.
- Foundation loading happens once through the root stylesheet's lower-priority
  CSS layer, with theme bridging and focus rules scoped to Arc copy controls.

```
Arc review:
Type and copy
- [x] Sentence case everywhere; no all caps, no uppercase transforms
- [x] No eyebrow or overline text above any heading
- [x] No em dashes; headings have no trailing period
- [x] Only weights 400 and 500; sizes from --text-* tokens
- [x] Buttons are verb plus object (a bare verb only where the object is named right beside it); errors say how to fix; claims are true
- [x] Changing or aligned numbers use tabular-nums

Color and surfaces
- [x] Only semantic tokens; no raw hex, ramp values, or Tailwind colors
- [x] Accent only on active, selected, progress, or the emphasized data
- [x] Status colors only for real status, always with a label
- [x] No decorative gradients, glows, or colored shadows in components
- [x] Third-party logos in their real brand colors
- [x] Shadows only on floating layers; cards rest on a 1px border
- [x] No icons in rounded tiles; no nested decorative cards

Layout
- [x] One page container; blocks fill their column with no double gutter
- [x] Heading, cards, and table share the same left edge
- [x] Sibling cards align (same top and height) with a real gap or shared dividers
- [x] Nested radii are concentric (inner = outer - padding)
- [x] Spacing on the 4px grid: 16px inside a group, 24px between regions, 32 to 48px between sections of a long form; page padding 24 to 32px; marketing sections 64 to 120px
- [x] Wide tables scroll inside their card

Components
- [x] Every region uses an existing Arc item where one fits (components.md)
- [x] The choice matches "when to use" (tabs vs segmented control, dialog vs drawer vs sheet, switch vs checkbox)
- [x] Only documented props; no restyled internals
- [x] One primary button per surface (a `button` without `variant` renders primary)
- [x] No Pro source reconstructed

States
- [x] Loading (skeleton in final layout), empty (one next step), error (inline, with retry), success (in place), disabled (explained)
- [x] Long names and values wrap or truncate with the full value reachable

Motion
- [x] Tokens from components/arc/lib/motion-tokens; no hand-tuned durations without reason
- [x] Only transform and opacity animate (size only on a spring when it is the information)
- [x] State indicators land without overshoot; bounce only for playful moments
- [x] One continuous movement per interaction; exits faster than entrances
- [x] A reduced motion branch for every animation

React correctness
- [x] First render is server-safe: no window, localStorage, Date.now, Math.random, or locale-dependent output
- [x] Animated elements keep stable keys and are not remounted on state change
- [x] Changing values reserve their width; nothing jumps

Accessibility
- [x] No focus rings on pointer focus and no hand-made rings; keyboard focus shows Arc's shared `:focus-visible` ring (tune with `--focus-outline` tokens)
- [x] Real buttons, links, labels, headings in order, landmarks
- [x] Icon-only controls have specific names
- [x] Overlays trap and return focus and close on Escape
- [x] State never shown by color alone; async status announced

Responsive
- [x] Checked at 390, 768, 1024, 1440 (if you cannot render, read the CSS for fixed widths, missing min-width: 0, and unwrapped rows); no sideways page scroll
- [x] Touch targets at least 44px; hover content reachable by tap or focus
- [x] Both themes and two accents (neutral and one hue) read correctly

```
