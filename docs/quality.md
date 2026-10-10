# Verification status

Reviewed on 2026-10-10 (Asia/Shanghai), including the local Cloudflare Free
candidate and PR #33 follow-ups. Earlier evidence below retains its tested revisions.
This page summarizes coverage and outstanding limits. Detailed past results live
in the [historical verification log](quality/history-through-2026-10-07.md).
A checked-in implementation, a local pass, remote CI, publication and production
health are separate observations; none establishes Google indexing or freshness.

## Current coverage

| Area                      | Executable evidence                                                                                                              | Remaining limit                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Architecture              | Import graph and Cargo dependency checks in `just check`; regression cases under `scripts/tests`                                 | Does not prove all side effects or statistical semantics                                                |
| Documentation             | Required entry points, local link targets, top-level document indexing and the 110-line AGENTS limit in `scripts/check-docs.mjs` | No anchor, external-link, semantic freshness or full nested-index validation                            |
| Domain and HTTP contracts | TypeScript/Rust unit tests and `just test-db` against real Drizzle migrations and the Rust binary on disposable PostgreSQL 18    | Synthetic records establish behavior, not current official source coverage                              |
| Browser journeys          | Chromium desktop/mobile in development and production; separate unconfigured, empty and unavailable production cases             | Safari, Firefox and manual screen-reader coverage remain UI-001                                         |
| Search discovery          | Metadata, crawler HTML, no-JavaScript formation navigation, sitemaps and unavailable-source cases                                | Search Console ownership, processing and search-performance evidence remain SEO-001                     |
| Cloudflare delivery       | OpenNext build, Worker dry runs and image build; main-only deployment after verification; public data smoke                      | `just verify` does not run `just cf-check` or the public smoke; publication can precede a failing smoke |
| Ingestion and provenance  | Archive/replay, source-shape, transaction and concurrency checks                                                                 | Imports are manual; live source/schema drift and remote archive backup need separate checks             |
| UI and local preparation  | Browser tests cover navigation, hydration readiness, chart equivalents, lists, sharing and storage failures                      | Historical visual review is scoped to the recorded change, not a fresh audit of every screen            |

## Cloudflare Free candidate validation (2026-10-09)

### PR #33 clipboard test synchronization (2026-10-10)

The [next CI run](https://github.com/gregorsternat/gradavia/actions/runs/38039679987)
successfully uploaded diagnostics but failed the desktop clipboard error case.
Its trace shows the search still pending during the Space-key copy and rejected
write; applying the response then replaces the keyed explorer and resets the
button. The test now waits for the search input to become enabled before testing
clipboard feedback on the resulting page. All error, recovery, keyboard and
stale-write assertions remain, with no added retries or arbitrary delay.

Ten repetitions per desktop/mobile project passed in both development and
production (40 executions). Focused lint and formatting also passed. Evidence:
`.artifacts/pr33-ci-latest-failure.log`, `.artifacts/pr33-ci-38039679987/`,
`.artifacts/pr33-ci-copy-dev.log` and `.artifacts/pr33-ci-copy-prod.log`.

### PR #33 diagnostics upload repair (2026-10-10)

GitHub run [37934353584](https://github.com/gregorsternat/gradavia/actions/runs/37934353584)
passed `just verify` and the 177 publication contracts, then failed to upload
diagnostics because publication filenames contain colons. The workflow now uploads
a tar archive created outside `.artifacts`, preserving those names and hidden logs.
Running the exact packaging step locally retained all 178 fixture files byte for
byte, including 78 colon-containing names, and handled an absent diagnostics
directory. `just test-publication` passed all 177 contracts again. Formatting and
actionlint passed with only its unsupported, pre-existing `concurrency.queue`
diagnostic filtered. The full suite was not repeated for this workflow-only fix.

Evidence: `.artifacts/pr33-ci-failure.log`,
`.artifacts/pr33-ci-publication-contracts.log` and
`.artifacts/pr33-ci-archive-check.log`. The subsequent run above confirms that
packaging and uploading the diagnostics both succeeded.

### PR #33 detail-link regression

On 2026-10-09, the review's apprenticeship/APB detail-link 404 was reproduced
for both HTML and RSC requests before the fix. Detail asset identities now ignore
query parameters, matching Next's ID-only source and campaign resolution. Catalog
filters remain distinct, and missing detail IDs still return 404. All 13 publication
unit cases passed. The browser regression opens both the analysis table and
selection links with the keyboard and reloads each detail URL.

`CI=true E2E_PORT=3587 mise exec -- just verify` passed: checks, 128 TypeScript
cases, Node/Rust suites, disposable PostgreSQL contracts, credential-free builds
and 378 Chromium executions (181 development, 179 production, 18 failure-state;
eight intended exclusions). A newly rendered 222-page fixture publication,
`c05bc839ec807ba8fb87`, also passed 18 focused desktop/mobile browser executions
under local workerd with the Wasm API. Direct requests verified identical 200
HTML/RSC bodies with or without detail query parameters and preserved missing-ID
404s. These checks include classic formation details, metadata, query indexing
and navigation without JavaScript.

Evidence: `.artifacts/pr33-detail-regression-before.log`,
`.artifacts/pr33-detail-regression-after.log`,
`.artifacts/pr33-detail-verify.log`, `.artifacts/pr33-detail-workerd-http.log`,
`.artifacts/pr33-detail-workerd-browser.log` and
`.artifacts/pr33-detail-publication/`. These are local fixture checks; they do not
establish remote CI success or production activation.

### Initial candidate verification

In the isolated `cloudflare-free` worktree on base `adc1f64`, `CI=true
E2E_PORT=3576 mise exec -- just verify` passed: formatting, lint, types,
architecture/docs, Clippy, 124 TypeScript cases, Node/Rust suites, disposable
PostgreSQL 18 contracts and credential-free builds. Chromium passed 175 development,
173 production and 18 production data-state cases (366 executions, eight intended
exclusions). A specialty drill-down race was reproduced first, then fixed with
the existing panel pending state and a delayed-response browser regression.

`just test-publication` passed 177 native SQL/publication HTTP comparisons,
including eight fixture campaigns, all fixture specialty groups, retained atlas
versions, malformed requests, missing identities and literal wildcard searches.
The portable Rust read model has three tests; nine TypeScript publication tests
cover version pinning, bounded archive reads, checksums, capacity, cache/HEAD/
conditional requests and activation evidence rejection.

The final publication harness captured 222 HTML/RSC page pairs, froze the runtime,
packed all assets, ran the actual Wasm API under local workerd with private service
bindings, checked every retained public dataset CSV/JSON/metadata export and passed
173 desktop/mobile Chromium cases (five intended exclusions). CSV checks compare
bytes to include the UTF-8 BOM. Every generated Worker deployment dry run passed;
the Wasm API is approximately 319 KiB compressed. The final code checks and focused
publication unit tests were repeated after publication identity/packaging repairs.
Manual browser inspection of the frozen fixture runtime covered desktop (1440 px)
and mobile (390 px), light/dark themes, the mobile drawer and opening/closing the
quick search with the keyboard. Screenshots are under `.artifacts/baseline/` with
the `free-*-final` prefix. No layout or product-copy redesign was introduced.

Evidence: `.artifacts/publication-verify-final.log`,
`.artifacts/publication-contracts-final.log`,
`.artifacts/publication-workerd-verified-final.log`,
`.artifacts/publication-verification/a677f438-7f55-4633-b9b5-61fc4e770dc9/`,
`.artifacts/publication-cloudflare-final.log` and
`.artifacts/publication-check-last.log`.

This does not establish production-scale CPU, memory, LCP, CLS, p95 latency,
publication duration/storage or a free subscription. Direct PostgreSQL sessions
to the explicitly selected production reader closed before a snapshot completed;
Cloudflare subscription inspection returned HTTP 403. No production routes,
obsolete resources or account plan were changed. The existing production runtime
remains active; the [execution plan](exec-plans/active/cloudflare-free.md) and
[publication operations](cloudflare-publications.md) retain the outstanding gates.

### PR #33 merge repair

On 2026-10-09 (Asia/Shanghai), merging `main` at `cf822e3` into `5a1c61b`
retained the Arc clipboard integration and the publication-specific workspace
loader, prerender shell, version pinning and specialty pending fix. `just check`,
14 focused publication/workspace unit cases and 20 development Chromium
desktop/mobile executions passed. Browser coverage includes clipboard recovery,
sharing, keyboard navigation, pending reads, persistent tabs and no-JavaScript
destinations; desktop/mobile screenshots were inspected. Evidence is under
`.artifacts/pr33-conflicts/`. The full suite, production publication and deployment
were not repeated for this merge repair; remote CI remains a separate check.

See [repository workflow](harness.md) for commands and maintenance rules,
[development](development.md) for isolation, and [technical debt](exec-plans/tech-debt.md)
for follow-up triggers.

## Evidence at this refresh

The updated base includes the SEO foundation, shared G mark, palette input focus
correction, browser-readiness fixes, removal of the sidebar BÊTA badge and the
chart-tooltip semantic-color correction. Source and local history establish these
changes through `cac11ff`; production state is recorded separately below.

The archived 2026-10-07 landing-readiness and branding checks record full local
verification with 131 development, 129 production and 18 data-state browser
executions passing, with eight intended exclusions. Those counts belong to
those runs; they are not a result for this documentation change.

At the initial read-only GitHub inspection, main
[run 37628801351](https://github.com/gregorsternat/gradavia/actions/runs/37628801351)
for `9f99df9` was still running. A run's successful verification alone is not
proof that the publish and smoke steps executed; inspect those exact steps when
reporting release state. The preceding completed
[run 37610391926](https://github.com/gregorsternat/gradavia/actions/runs/37610391926)
at `7d2bcd5` was checked directly: verification, current-main selection, API/web
publication and public data smoke all succeeded. This establishes that release's
outcome, not the current runtime health or publication of subsequent commits.
No live Neon inventory or production data refresh was performed for this update.

### Documentation refresh validation

On 2026-10-07, `WRANGLER_SEND_METRICS=false CI=true E2E_PORT=3528 mise exec -- just verify`
passed in worktree `862e` for the documentation diff on `9f99df9`: formatting,
lint, types, architecture/docs, Clippy, 104 TypeScript cases, Node/Rust suites,
disposable PostgreSQL 18 contracts and credential-free builds. Chromium passed
131 development, 129 production and six cases in each of the three production
data states (278 executions, eight intended exclusions).

The updated base also contains the chart-tooltip correction from `cac11ff`; its
original verification record is preserved in the [historical log](quality/history-through-2026-10-07.md#chart-tooltip-contrast-2026-10-07).

Evidence: `.artifacts/docs-refresh/verify.log`. Final documentation formatting,
local links/fragments and `git diff --check` passed. The historical log was checked
against the original: only its introduction and relocated relative links changed.
The documentation refresh introduced no application, workflow or lockfile
changes. The incoming base includes the separately reviewed chart-tooltip fix.
After integrating the `cac11ff` base, `mise exec -- just check` passed and
`E2E_PORT=3534 mise exec -- just test-browser tests/browser/observatory.spec.ts tests/browser/formations.spec.ts`
passed all 34 development Chromium cases, covering overview charts and formation
history in desktop/mobile. This was a focused post-merge check; the main workflow
for `cac11ff` was still running when last inspected. No new manual visual review,
Cloudflare build or deployment was performed for the documentation-only change. See the [completed plan](exec-plans/completed/documentation-refresh.md).

## Navigation simplification validation

On 2026-10-07 (Asia/Shanghai), the navigation diff against `6f14ab0` passed
`WRANGLER_SEND_METRICS=false CI=true E2E_PORT=3544 mise exec -- just verify`:
110 TypeScript tests, Node/Rust suites, disposable PostgreSQL 18 contracts,
credential-free builds, and 290 Chromium executions (137 development, 135
production and 18 production data-state cases; eight intended exclusions).

Real-browser inspection covered desktop/mobile, light/dark, keyboard section and
palette navigation, the mobile menu, favorites/comparison counts and the grouped
screens using synthetic fixtures. Earlier failures exposed missing palette aliases,
active-link prefetch interference with campaign metadata and a premature reload
in a new test; the final run passes after those repairs. Details, evidence paths
and remaining browser/source boundaries are in the
[completed plan](exec-plans/completed/navigation-simplification.md).
No live dataset audit, remote CI result, merge or deployment is established by
these local checks.

On 2026-10-08 (Asia/Shanghai), the PR review follow-up diff against `3f0a2fc`
passed the same full `just verify` command: 115 TypeScript cases and the same
290 Chromium executions, with eight intended exclusions. Regression tests
first reproduced the five missing palette aliases and the inactive List
location actions, then passed after their correction. Real-browser desktop/mobile
inspection confirmed the List/Map action visibility and all five palette queries,
including Ctrl+K and Escape. Evidence: `.artifacts/navigation-review/verify.log`
and the follow-up section of the completed plan above. No live data audit or
deployment was performed.

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
MIT notices and integration patches are recorded in [third-party sources](third-party.md).
No dependency versions or lockfiles changed.

Evidence and initial corrected failures are recorded in the
[completed plan](exec-plans/completed/arc-copy-buttons.md), with the final log at
`.artifacts/arc-copy/verify.log`. These local fixture checks do not establish
remote CI, merge, deployment or live data availability. Existing UI-001 limits
remain in [technical debt](exec-plans/tech-debt.md).

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

## GitHub repository link validation (2026-10-08)

On 2026-10-08 (Asia/Shanghai), `CI=true E2E_PORT=3542 mise exec -- just verify`
completed successfully with the repository-link diff on base `d8acc7a`: formatting, lint, types,
architecture/docs, Clippy, 115 TypeScript cases, Node/Rust suites, disposable
PostgreSQL 18 contracts and credential-free builds. Chromium passed 137 development,
135 production and six cases in each production data state (290 executions,
eight intended exclusions). Unrelated workspace-navigation changes were introduced
concurrently in this checkout after the checks/build began; this run does not
establish validation of their latest state. An initial typecheck rejected a Lucide
brand-icon import; the final implementation uses the source-owned Octicons SVG instead.
The web TypeScript check was repeated after those concurrent edits and passed;
evidence: `.artifacts/github-link/final-types.log`.

Real-browser inspection covered the homepage footer and expanded/collapsed
application sidebar at 1280×900, the mobile navigation at 390×844 and the homepage
footer at 320×740, in light/dark themes. The repository link has visible keyboard
focus, a French accessible name, a 40px target, the expected repository URL and
`target="_blank"` with `noopener noreferrer`. The narrow homepage had no horizontal
overflow. Evidence: `.artifacts/github-link/verify.log`, `desktop-page.jpg`,
`desktop-footer.jpg` and `mobile-footer.jpg` in the same directory.

The authenticated GitHub inspection found the destination private; the owner plans
to make it public. Anonymous access and publication of this diff remain unverified.
No deployment was performed.

## Persistent workspace validation (2026-10-08)

`CI=true E2E_PORT=3540 mise exec -- just verify` passed for the local workspace
navigation diff on `e0ce3a3`, based on merged PR #29: formatting, lint, types,
architecture/docs, Clippy, 115 TypeScript tests, Node/Rust suites, real disposable
PostgreSQL 18 contracts and credential-free builds. Chromium passed 165 development,
163 production and six cases in each of three production data states: 346
executions with eight intended exclusions.

The suite checks all workspace panel pairs, preserved state and map camera,
History traversal, deep links, legacy parameters/fragments, SSR without JavaScript,
SEO, keyboard access, request reuse, stale responses and failure recovery. Network
inspection confirms that Budget JavaScript is downloaded on first activation,
not with the initial Favoris page. The initial run after separating tool bundles
exposed ten readiness failures; these were fixed and the focused fourteen-case
follow-up and final full run passed. This final result supersedes those failed
attempts for the final code, without treating the earlier attempts as passes.

Real Chromium inspection covered desktop territories and mobile quiz/analysis,
scrollable tab bars, visible keyboard focus and activation. Evidence lives under
`.artifacts/workspace-tabs`: `verify.log`, `readiness.log`, `code-loading.log`,
`verification-notes.md`, `desktop-territoires.png`, `mobile-estimer.png` and
`mobile-analyse.png`. See the [completed plan](exec-plans/completed/persistent-workspaces.md)
for implementation scope. No production data, remote CI or publication was verified
by this work; Safari/Firefox and manual screen-reader limits remain UI-001.

## Workspace review corrections (2026-10-09)

`CI=true E2E_PORT=3540 mise exec -- just verify` passed for the local diff on
`8aeef8b`: code/documentation checks, 115 TypeScript tests, Node/Rust suites,
disposable PostgreSQL 18 contracts and credential-free production build. Chromium
passed 171 development, 169 production and 18 production data-state executions
(358 total, eight intended exclusions).

New browser tests reproduce and cover inactive print styles, shared-list retry
recovery without losing another panel's draft, and campaign changes during a
pending read followed by List/Map navigation. All six new executions failed before
the fixes and pass afterward. Desktop/mobile Chromium print screenshots were
visually inspected. Existing keyboard and workspace tests now await observable
client readiness when testing History navigation; native no-JavaScript journeys
remain separate.

Evidence: `.artifacts/workspace-review/verify.log`, targeted logs and print images
under `focused-results`. Earlier failures and their resolution are documented in
the [completed plan](exec-plans/completed/persistent-workspaces.md#pr-31-review-follow-up)
and retained alongside the final log. This is local validation; remote CI and
publication are not established by it.

## Reading and adding evidence

- Keep this page a current summary. Put detailed investigations and historical
  run narratives in linked files under `docs/quality/` or a completed plan.
- Record the date/timezone, tested revision or local diff, environment, command,
  result, exclusions and evidence location. Never replace a failed run with an
  undifferentiated later success.
- `.artifacts/` is ignored and local to a checkout; CI artifacts expire after
  seven days. A path records where evidence was produced, not durable access.
  Preserve the useful conclusion and public run link in versioned documentation.
- Dataset totals must name the source release/campaign and observation context.
  Old totals are not assertions about the current configured Neon branch.
- Use the [historical log](quality/history-through-2026-10-07.md) for foundation,
  ingestion, observatory, deployment, expanded exploration, SEO and UI evidence.
  Recheck the relevant path before promoting historical evidence to current status.

### PR #31 CI follow-up (2026-10-09)

[CI run 37806978985](https://github.com/gregorsternat/gradavia/actions/runs/37806978985)
failed three development browser executions on `8f08c19`: rapid comparison
removals on both widths and theme restoration on desktop. Controlled delayed
responses and JavaScript downloads reproduced both causes before the fixes.
Current comparison IDs now govern retained content and subsequent actions;
theme controls wait for client readiness. Eight focused executions passed after
the corrections, including keyboard operation.

The full local `CI=true E2E_PORT=3540 mise exec -- just verify` then passed:
formatting, lint, types, architecture/docs, Clippy, 115 TypeScript tests,
Node/Rust suites, disposable PostgreSQL 18 contracts and credential-free build.
Chromium passed 173 development, 171 production and 18 data-state executions
(362 total, eight intended exclusions). Evidence: `.artifacts/ci-workspace/verify.log`;
regression failures, focused results and desktop/mobile visual inspection are
retained in the same directory. A preliminary formatting check caught generated
CLI snapshots outside the ignored artifact directory; they were moved before the
successful full run. Remote CI and publication are not established by this local pass.
