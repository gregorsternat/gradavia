# Historical clipboard integration evidence

These observations describe the former clipboard integration, removed on
2026-10-12. They do not describe current source, licenses or runtime behavior.
Current restoration evidence is in [quality status](../quality.md#native-copy-button-restoration-2026-10-12).

## Arc copy-button validation

On 2026-10-09 (Asia/Shanghai), the Arc integration diff against `d8acc7a` passed
`WRANGLER_SEND_METRICS=false CI=true E2E_PORT=3566 mise exec -- just verify`:
formatting, lint, types, architecture/docs, Clippy, 115 TypeScript cases, Node/Rust
suites, disposable PostgreSQL 18 contracts and credential-free builds. Chromium
passed 139 development, 137 production and six cases in each of the three
production data states (294 executions, eight intended exclusions).

Clipboard journeys verify keyboard activation, URL/hash changes, source-version
preservation, note-sharing consent, stable button width and persistent manual
recovery after a denied clipboard write. Real-browser review covered light/dark,
390/768/1024/1440 widths, 44px copy targets and no horizontal page overflow.
Reduced-motion and both-theme accessibility journeys remain passing. Arc source,
MIT notices and integration patches are recorded in the third-party sources recorded at `cf822e3`.
No dependency versions or lockfiles changed.

Evidence and initial corrected failures are recorded in the
[completed plan](../exec-plans/completed/arc-copy-buttons.md), with the final log at
`.artifacts/arc-copy/verify.log`. These local fixture checks do not establish
remote CI, merge, deployment or live data availability. Existing UI-001 limits
remain in [technical debt](../exec-plans/tech-debt.md).

### PR #32 merge repair

On 2026-10-09 (Asia/Shanghai), merging `main` at `53d135f` into `66abf68`
retained Arc clipboard actions and the workspace's scoped navigation/hash.
Explicit share paths now use the existing canonical workspace URL conversion.
`mise exec -- just check` passed. A focused development Chromium run at
`E2E_PORT=3574` passed 14 desktop/mobile executions covering clipboard keyboard
activation/recovery, source versions, note consent, History and shared-list retry.
Desktop analysis and mobile copy-error screenshots were inspected. The first run
failed both evolution cases on the missing `onglet` parameter; the canonical URL
fix passes the same checks. Logs: `.artifacts/pr32-conflicts/focused.log` and
`final-focused.log`. The full suite and production browser runs were not repeated
for this conflict repair; remote CI and deployment remain separate.

### PR #32 CI clock repair

The [CI run for `5727b50`](https://github.com/gregorsternat/gradavia/actions/runs/37899976219)
failed the desktop clipboard-recovery case: feedback returned to `idle`.
The test installed Playwright's clock after creating native feedback timers;
a local Chromium reproduction confirmed that clearing such a timer after clock
installation did not cancel it. The test now installs the clock before navigation,
following the [Clock API ordering requirement](https://playwright.dev/docs/clock).

On 2026-10-09 (Asia/Shanghai), the corrected case passed five repetitions per
desktop/mobile project in both development and production (20 executions total,
no retries). `mise exec -- just build`, focused ESLint/formatting and documentation
checks passed. Evidence: `.artifacts/pr32-ci/{github-failure,focused-development,focused-production,build}.log`.
This is focused local validation; the full CI result remains separate.

### PR #32 stale clipboard completion follow-up

The [CI run for `c5c21d7`](https://github.com/gregorsternat/gradavia/actions/runs/37905115181)
failed the desktop development copy-recovery case: after a rejected clipboard
write, feedback remained `idle`. The hook now ignores clipboard completions and
feedback timers from older copy operations. A browser regression defers one
successful write, starts a newer rejected write, then resolves the old write and
checks that the error remains visible. The focused Chromium case passed five
repetitions per desktop/mobile project (10 executions). Type, lint, formatting
and documentation checks passed locally. Evidence:
`.artifacts/pr32-ci/copy-race-retry-dev/`. The next remote CI run remains the
merge gate.

The next [CI run](https://github.com/gregorsternat/gradavia/actions/runs/37908000074)
passed 174 browser cases but failed a newly added mobile assertion that waited
for `data-copy-state="copied"` after the Space-key clipboard write. The clipboard
content and keyboard activation succeeded; the earlier Enter assertion already
checks visible copied feedback. Removed the redundant state assertion while
retaining the stale-write regression and keyboard clipboard check.
