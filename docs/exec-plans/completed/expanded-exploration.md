# Expanded exploration and preparation

Implemented and verified locally on 2026-10-05. Remote CI, merge and production
release remain distinct delivery states, recorded on the pull request and its
workflow runs.

## Objective

Evaluate the owner's 80 requested capabilities and deliver the largest coherent,
verified expansion of the existing product in one pull request. Preserve the
French monochrome UI, beUI primitives, Tremor charts, purposeful reduced-motion
animation, Rust read boundary and immutable source provenance. The owner has
authorized creating the PR and merging it after validation.

## Architecture and delivery batches

1. Add a bounded compact campaign atlas behind the Rust API, with explicit
   Parcoursup, apprenticeship and APB adapters. Capture one immutable release;
   validate metrics, coordinates, populations and payload size. No schema change.
2. Build geographical exploration with synchronized filters/results, a radius,
   numeric criteria, transparent interest discovery and similar formations.
3. Extend local favorites into named lists with notes, preparation status,
   concentration summaries, deliberate sharing and a printable dossier.
4. Build one analysis workbench over the reviewed atlas: linked filters, scatter,
   distribution, heatmap, cross-tab, coverage, saved views and provenance exports.
5. Enrich details and comparisons with source-defined profiles and explicit peer
   groups. Add historical features only where identity and source meaning support
   them. Never substitute a national specialty family for an establishment.
6. Review all 80 dispositions, exercise desktop/mobile and keyboard journeys,
   run `just verify`, inspect the diff, obtain independent review, open the PR,
   wait for remote CI and merge. Observe the resulting deployment separately.

## Feature evaluation

The table preserves the original evaluation criteria. The final
[coverage register](../../feature-coverage.md) records every capability's actual
implementation and limits: 28 delivered, 33 bounded and 19 deferred. Related
features share a surface.

| IDs                      | Intended scope / decision criteria                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 6, 10, 19, 20         | Implement map, straight-line radius, exact numeric filters, explicit sorting priorities and widening previews using published coordinates.                                                                                            |
| 2, 12                    | Implement transparent same-campaign peer groups and alternatives; explain matching criteria and observed-value coverage.                                                                                                              |
| 3, 48                    | Evaluate inverse specialty-family lookup and mutually exclusive pair flows. No establishment-level specialty claim; no overlapping group Sankey totals.                                                                               |
| 4, 8                     | Implement editorial search entry points and neighboring subject exploration, explicitly distinguished from official qualification links.                                                                                              |
| 5                        | Defer verified occupation-to-course links until Onisep correspondence, license and join coverage are reviewed. Keyword search is not a career pathway.                                                                                |
| 7                        | Defer transport-time search: no routing timetable/feed or route engine is currently ingested. Straight-line distance remains explicit.                                                                                                |
| 9, 18, 60                | Implement separate apprenticeship/APB exploration when source field review passes; cross-family comparison must expose differing definitions.                                                                                         |
| 11                       | Implement deterministic comparison commentary for actual differences, without a quality ranking.                                                                                                                                      |
| 13–17                    | Review retained metadata for candidate/offer/admitted profiles, honors, rank groups, local recruitment and actual admission milestones. Expose only aligned definitions.                                                              |
| 21–25, 27                | Implement named lists, selection summaries/concentration, shareable immutable selections, notes/status and printable dossier. Notes stay private by default.                                                                          |
| 26, 28, 29               | Defer automated event/deadline/required-document calendars without a maintained authoritative event feed and formation mapping. Preserve official formation links.                                                                    |
| 30                       | Implement in-app source revision indicators where current versus retained releases can be checked. No background/email notification claim.                                                                                            |
| 31, 32                   | Evaluate a clearly user-entered budget scenario tool; official city cost estimates need licensed, dated data and explicit assumptions.                                                                                                |
| 33, 34                   | Defer campus-service maps and parent-trip costs without maintained POI, residence and routing data.                                                                                                                                   |
| 35–40                    | Defer course content, transfers, further study, employment, earnings and graduation claims pending reviewed Onisep/InserSup/InserJeunes mappings and population compatibility.                                                        |
| 41, 42, 46               | Implement full-population scatter, territory/type heatmap and distributions, with linked table alternatives and null coverage.                                                                                                        |
| 43                       | Evaluate whether a cartogram adds information beyond proportional geography; do not label a square grid as a geographic cartogram.                                                                                                    |
| 44, 45, 47, 50           | Evaluate multi-campaign small multiples, before/after, relative positions and manual/animated playback after payload and continuity contracts.                                                                                        |
| 49, 51                   | Defer mobility flows and education deserts: origin/destination flows and population/accessibility denominators are unavailable.                                                                                                       |
| 52–59                    | Implement concentration, pressure, composition and contextual status comparisons when metric denominators match; distinguish independent annual supply/demand totals from a stable cohort.                                            |
| 61–65, 68–71, 75, 77, 80 | Implement bounded no-code analysis, linked filters, saved cohorts/views, cross-tabs, appropriate units, outlier/quality inspection, CSV/JSON and chart exports, immutable URLs and verifiable descriptive facts. Parquet is optional. |
| 66, 67                   | Evaluate a conservative matched-source-identity cohort with explicit entries/exits and changed/ambiguous exclusions. Do not claim proven curriculum continuity.                                                                       |
| 72–74                    | Evaluate a bounded public export contract and reproducible notebook downloads; unrestricted server SQL is outside the safe public read boundary.                                                                                      |
| 76                       | Evaluate retained same-dataset release comparison; requires a trustworthy record key and at least two actual versions.                                                                                                                |
| 78, 79                   | Evaluate a small source-backed quiz/story only after the core exploration journeys are complete; no invented observations or decorative filler.                                                                                       |

## Verification

- Unit tests cover metric state preservation, coordinate validity, query bounds,
  distance, peer selection, aggregates, local storage migration and export safety.
- PostgreSQL 18 fixtures exercise all supported source families, retained versions,
  duplicates, unavailable/empty states and coverage. No live credentials in builds.
- Browser cases cover linked navigation, keyboard controls, share/reload, storage
  failure and mobile overflow in both themes, with real Rust HTTP responses.
- Record focused checks, complete `just verify`, browser inspection and remote CI
  separately in quality evidence. Keep traces and screenshots under `.artifacts`.

## Result and evidence

- Added complete, version-pinned Rust atlas adapters for Parcoursup,
  apprenticeship and APB, plus rich profiles and national inverse specialties.
  No database schema or migration was required.
- Delivered geographic exploration, numeric filters, explicit alternatives and
  priorities, regular/apprenticeship comparison, named local lists, optional
  annotated sharing, printable dossiers and user-entered budgets.
- Delivered the analysis workbench, saved cohorts, conservative two-campaign
  comparisons, a source-backed discovery quiz, public JSON/CSV/metadata reads,
  provenance-bearing SVG exports and Python/R reproduction downloads.
- One independent read-only review found URL/history state divergence in the
  map, analysis, evolution and inverse-specialty controls. Those findings were
  fixed and covered by browser regression journeys.
- Live-source browser inspection covered desktop and mobile, keyboard controls,
  both themes and complete populations. The built Worker was also exercised in
  local workerd against the real read-only API, including all three families,
  paired campaigns, interactive analysis and modality comparison.
- [Quality evidence](../../quality/history-through-2026-10-07.md#expanded-exploration-and-preparation)
  separates local checks, runtime evidence and deployment. Evidence and failure
  traces remain under the ignored `.artifacts` directory.
- Final `just verify` passed static checks, 92 TypeScript and 7 Node tests,
  32 Rust tests, PostgreSQL 18 contracts, credential-free builds, 114 development
  browser cases, 112 production cases and 12 unavailable/empty/unconfigured
  cases. Two production gallery checks are intentionally skipped.

## Remaining work

External enrichment requires source-native adapters and verified joins; transport
requires a routing contract. Revision comparisons require stable cross-release
identities. The [coverage register](../../feature-coverage.md) and
[technical debt](../tech-debt.md) record the exact remaining scope, including
large-campaign indexing, broader exports and future external datasets. The R
companion was reviewed but not executed because no R runtime is installed.
