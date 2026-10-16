# Verification status

Verification workflow reviewed on 2026-10-11 (Asia/Shanghai), with local
validation against `bc4da92`. Earlier evidence below retains its own tested revisions.
This page summarizes coverage and outstanding limits. Detailed past results live
in the [historical verification log](quality/history-through-2026-10-07.md).
A checked-in implementation, a local pass, remote CI, publication and production
health are separate observations; none establishes Google indexing or freshness.

## Observatory analysis simplification (2026-10-17)

The local diff against `b5606bd` removes the formation table and the findings/outlier
disclosure from Observatoire's analysis panel. Filters, chart value equivalents,
exports and saved views remain available. The scatter supports arrow/Home/End
selection with labelled values and a detail link below the chart.

`just verify` passed (133 TypeScript cases, 11 Node tests and Rust suites).
The analysis, observatory and workspace browser specs passed all 62 development
Chromium executions across desktop/mobile using disposable PostgreSQL fixtures.
Real browser inspection covered 1440×960 light and 390×844 dark, point selection
with the keyboard, removed sections and no horizontal page overflow.
Evidence is retained under `.artifacts/observatory-trim/`.

An initial type check caught unchecked point-array access, corrected before the
successful run. An initial browser run hit a concurrent development-server lock;
the successful run used a single server. The production build/browser suite,
remote CI, merge, deployment, physical devices and screen readers were not tested
for this change. API contracts, calculations, dependencies and lockfiles are unchanged.

### PR #50 merge repair (2026-10-17)

Integrated `main` at `830f086`, retaining the page skeletons and annotation-field
removal alongside the removed formation table and findings disclosure. The
analysis browser test now checks the retained cohort count after reload without
expecting either removed control. Both verification histories are preserved.
The analysis skeleton no longer reserves space for the removed formation table.

`just verify` passed (133 TypeScript cases plus Node/Rust suites). All 12 focused
development Chromium executions passed across the analysis journeys and delayed
analysis-panel skeleton on desktop/mobile. Evidence is retained under
`.artifacts/pr50-merge/`. The production build/browser suite and deployment were
not rerun for this repair; local success does not establish remote CI or merge.

## Analysis annotation input removal (2026-10-17)

The local diff against `b5606bd` removes the annotation input below the analysis
chart and its mention in saved-view copy. Existing annotated URLs and exports
remain compatible. `just verify` passed (133 TypeScript cases plus Node/Rust
suites), along with the credential-free `just build`. All 12 focused production
analysis browser executions passed on desktop/mobile, covering filters, saved
views, sharing, exports and keyboard navigation. Chromium visual inspection at
1440×960 and 390×844 confirmed the field is absent and the page does not overflow.

Evidence is under `.artifacts/remove-analysis-annotation/`. The initial browser
attempt preceded compilation of this fresh checkout's API binary; it failed
during harness startup before any browser test ran. The production run passed
after the build. These are local results; no remote CI or deployment was performed.

## Data page simplification (2026-10-16)

The local diff against `b23f5a7` removes optional source/methodology UI while
retaining the dedicated destination, statistical states and export provenance.
`just verify` passed (130 TypeScript tests, 11 Node tests and Rust suites), as did
the credential-free build. Nine focused browser specs passed 122 development and
122 production executions on desktop/mobile with disposable PostgreSQL fixtures.
Native formation links/pagination without JavaScript, exports, selections, charts
and removed disclosures are covered. Real Chromium inspection covered both themes
at 1440×960 and 390×844, keyboard history activation and no horizontal page overflow.

Evidence, earlier failed runs and their corrections are recorded in the
[completed plan](exec-plans/completed/data-page-simplification.md) and
`.artifacts/data-pages/`. This is local validation; no remote CI or deployment
is established. API contracts, calculations, dependencies and lockfiles are unchanged.

### PR #47 merge repair (2026-10-16)

Merged `main` at `9dbdc08` into the simplification branch, preserving async table
loading, the initial 25 native formation links and the removal of optional details.
`just verify` passed (133 TypeScript cases plus Node/Rust checks). All 56 targeted
development Chromium executions passed across formations, SEO and async loading
on desktop/mobile, including keyboard scrolling and no-JavaScript navigation.
Two preliminary runs exposed scroll/hydration assumptions in inherited tests;
they now wait for the editable search field and scroll to the card sentinel.
Evidence: `.artifacts/pr47-merge/verify.log` and `browser-verified.log` in the same
directory; earlier failure traces are retained there. This repair did not rerun
the production build or establish remote CI, merge or deployment success.

## Current coverage

The current validation commands separate daily checks (`just verify`) from
production smoke (`just test-smoke`) and opt-in exhaustive verification
(`just verify-full`). Historical `just verify` results below refer to the old
exhaustive command, not the current fast command. See [CI selection](harness.md#ci-selection).

The [page-load performance plan](exec-plans/completed/page-load-performance.md)
records the current cache, streaming and lazy-loading validation. Local evidence
on 2026-10-14 includes 130 TypeScript cases, Node/Rust checks, PostgreSQL 18
contracts, 20 slow-response performance/SEO browser executions and 84 production
regression executions on desktop/mobile. PR #44 and main revision `dec5704` passed
remote verification. The main pipeline published both Workers and passed the
public data smoke; the running container was verified in `dub02/WEUR` with
unchanged capacity. Five-run warm TTFB medians improved by 65–88% across the five
measured requests. Live map/profile keyboard navigation, native no-JavaScript
navigation and true detail 404s passed. Exact timings and cold-cache/field-data
limits are recorded in the completed plan.

| Area                      | Executable evidence                                                                                                                      | Remaining limit                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Architecture              | Import graph and Cargo dependency checks in `just check`; regression cases under `scripts/tests`                                         | Does not prove all side effects or statistical semantics                                                       |
| Documentation             | Required entry points, local link targets, top-level document indexing and the 110-line AGENTS limit in `scripts/check-docs.mjs`         | No anchor, external-link, semantic freshness or full nested-index validation                                   |
| Domain and HTTP contracts | TypeScript/Rust unit tests and `just test-db` against real Drizzle migrations and the Rust binary on disposable PostgreSQL 18            | Synthetic records establish behavior, not current official source coverage                                     |
| Browser journeys          | Eight production smoke journeys on desktop/mobile in automatic CI; development/production and three failure states in `just verify-full` | Safari, Firefox and manual screen-reader coverage remain UI-001                                                |
| Search discovery          | Metadata, crawler HTML, no-JavaScript formation navigation, sitemaps and unavailable-source cases                                        | Search Console ownership, processing and search-performance evidence remain SEO-001                            |
| Cloudflare delivery       | OpenNext build, Worker dry runs and image build; main-only deployment after verification; public data smoke                              | Neither verification command runs `just cf-check` or the public smoke; publication can precede a failing smoke |
| Ingestion and provenance  | Archive/replay, source-shape, transaction and concurrency checks                                                                         | Imports are manual; live source/schema drift and remote archive backup need separate checks                    |
| UI and local preparation  | Browser tests cover navigation, hydration readiness, chart equivalents, lists, sharing and storage failures                              | Historical visual review is scoped to the recorded change, not a fresh audit of every screen                   |

See [repository workflow](harness.md) for commands and maintenance rules,
[development](development.md) for isolation, and [technical debt](exec-plans/tech-debt.md)
for follow-up triggers.

## Page-specific skeleton validation (2026-10-16)

The local diff against `9dbdc08` passed `just verify`, the production build and
all 16 smoke journeys. All 54 focused production cases passed across desktop and
mobile, including every panel, retained refresh content, delayed code, incremental
cards, error recovery, no-JavaScript navigation and detail 404s. Six additional
visual cases cover both themes and reduced-motion behavior. The corrected
apprenticeship scenarios and delayed server deep links passed 16 development
cases; the earlier broad run passed 100 cases with four test-scenario failures
and 12 opt-in latency skips. See the [completed plan](exec-plans/completed/page-skeletons.md)
for commands, failure history and screenshot evidence under `.artifacts/skeletons/`.
No remote CI, merge, deployment or physical-device result is established.

## Async table validation (2026-10-14)

The [completed async-table plan](exec-plans/completed/async-tables.md) records
local validation of this checkout's implementation: `just verify` (133
TypeScript cases plus Node/Rust checks), PostgreSQL 18 contracts, a production
build and 16 smoke executions. All 136 selected production browser executions
were validated across the broad regression run and a focused cancellation rerun.
Desktop/mobile inspection covered both themes, reduced motion and keyboard
scrolling. Native no-JavaScript pagination, complete sharing/import/printing,
source-version rejection, retries and preserved workspace rows were checked.

These are local results, not remote CI, merge or deployment evidence. No schema,
public Rust contract or dependency change was required.

## Lean verification validation (2026-10-11)

On the local diff against `bc4da92`, `just verify` passed checks, 115 TypeScript
cases, 11 Node cases and the Rust suites. `just test-smoke` passed all eight
selected journeys on desktop/mobile (16 executions in 18.0 seconds, excluding
build time). An intentional unavailable-server run of the existing landing smoke
failed with exit code 1, confirming that the selection does not hide failures.

`CI=true E2E_PORT=3592 mise exec -- just verify-full` passed the checks/unit suites,
PostgreSQL 18 contracts and 366 browser executions: 175 development, 173 production,
and six for each of unconfigured, empty and unavailable. Eight existing exclusions
remain intentional. The development/production browser passes took 2.7/1.7 minutes
on this machine. `just check-docs`, selector/CLI checks and `git diff --check` passed.
The installed actionlint passes after excluding its unsupported pre-existing
`concurrency.queue` diagnostic, also reproduced on the unchanged baseline workflow.

Evidence: `.artifacts/lean-verification/` and the [completed plan](exec-plans/completed/lean-verification.md).
The reference GitHub verification took 17 minutes; local timings do not establish
CI speed. No remote run or deployment was performed. The target of under five
minutes for ordinary frontend CI remains unmeasured.

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

## Native copy-button restoration (2026-10-12)

The local diff against `0ac4ec4` restores beUI sharing buttons, their copy/check
icons and French feedback. The vendored copy library, registry, global foundation,
bridge tokens and license have been removed. Canonical workspace destinations,
captured source versions and note-sharing consent remain part of the clipboard
journeys. `just verify` passed (115 TypeScript cases and Node/Rust suites), as
did the credential-free `just build`. Focused Chromium journeys passed 14 cases
in development and 14 in production across desktop/mobile, including denied
clipboard access, stale completions, both-theme accessibility and reduced motion.

Real Chromium inspection covered 1440×960 and 390×844, light/dark themes and
keyboard activation with visible focus. No horizontal page overflow appeared at
390px. Evidence: `.artifacts/native-copy/` and the
[completed plan](exec-plans/completed/native-copy-buttons.md). Lockfiles are
unchanged. The exhaustive suite, remote CI, deployment and live data were not
checked for this change. Earlier integration results remain in the
[clipboard verification archive](quality/clipboard-integration-2026-10-09.md).

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

### Automatic loading audit (2026-10-14)

All 150 targeted desktop/mobile Chromium cases passed after fixing hidden virtual
tables that collapsed their spacer and lost scroll position on reactivation.
The new 14-case matrix covers three batches in specialties, inverse specialties,
territories, analysis, evolution and shared favorites, plus atlas card exhaustion.
It verifies end-of-list behavior, retained positions and absence of manual load
buttons. Existing journeys cover network failure/retry, stale responses, inactive
panels, small history/comparison/profile tables, exports, printing and no-JS URLs.
`just verify` passed. Live development-data checks loaded 100 of 14,252 formations
by scrolling tables and cards at desktop/mobile widths in light/dark themes.
Evidence: `.artifacts/auto-audit-final.log`, `.artifacts/auto-audit-verify.log`,
`.artifacts/auto-audit-live-*`. Mobile validation is emulated; physical devices
and other browser engines were not tested in this audit.

The final `just test-smoke` production build and all 16 desktop/mobile smoke
journeys passed (`.artifacts/auto-audit-smoke.log`).
