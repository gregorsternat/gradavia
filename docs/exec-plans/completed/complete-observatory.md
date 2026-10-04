# Complete observatory experience

## Objective

Deliver a coherent, extensively polished admissions observatory that exceeds the
original descriptive explorer milestone. The user explicitly authorizes broader
features and a complete visual redesign, using beUI by default for controls,
Tremor for charts and Motion for animation. French product copy must be concise;
source meaning, accessibility and honest unavailable states remain mandatory.

## Product and visual direction

The primary jobs are to understand the national offer, find suitable formations,
inspect their historical indicators, compare a shortlist, and retain useful
choices. A restrained Linear/ChatGPT-like application shell replaces the sparse
marketing home page. Use compact navigation, careful typography, white space,
monochrome charts, subtle surfaces, and purposeful transitions. Avoid repeated
disclaimers, unnecessary dividers, decorative filler and unsupported rankings.

## Workstreams

1. **Evidence and API**: validate official source fields, preserve observed,
   missing, suppressed and invalid states; expose aggregate overview, coverage,
   detailed source indicators, historical observations and useful sorting.
2. **Shared UI**: install live beUI sources and additional official Tremor
   charts, retain licenses and local adaptations, preserve reduced motion.
3. **Formation journeys**: URL-driven search/filters/sort, card/table views,
   detail, compatible comparison, browser-local favorites, export/share.
4. **Observatory**: national campaign overview, offer/admissions history,
   formation-family composition, regional exploration, access-rate distribution,
   data coverage and accessible source/methodology pages.
5. **Specialties**: searchable 2025 subject pairs, national indicators, group
   destinations and formation drill-down without summing overlapping populations.
6. **Polish and verification**: review real desktop/mobile/dark/light rendering,
   keyboard workflows, loading/empty/error states and accessibility; run full
   `just verify`, inspect final diff and update evidence.

## Evidence rules

- One captured immutable release per campaign response; no dataset access in
  browser/builds and no synthetic fallback in product routes.
- Summed applications are formation applications, never unique applicants.
- Official access rate uses the published field, never admissions/applications.
- APB stays separately identified; no stitched APB/Parcoursup trend.
- Historical formation identity does not prove unchanged definition. Ambiguous,
  changed and absent observations must be visible and must not imply continuity.
- Metrics and exports retain campaign, source, missingness and units. Partial
  aggregates expose coverage and are labelled rather than silently zero-filled.
- Browser-local selections do not require accounts or transmit preferences.

## Acceptance

- Every visible main action works, with URL sharing and local persistence where
  appropriate. Comparisons show multiple formations together and prevent
  misleading cross-campaign comparisons.
- The first viewport answers a useful question with real data and readable charts.
- Chart values are available in accessible tables/details; chart clicks have a
  visible keyboard-accessible equivalent.
- All default controls use the installed beUI primitives; charts use Tremor and
  animation uses Motion. Document justified gaps instead of silently replacing.
- No horizontal page overflow at mobile widths, no hydration/console errors,
  clear keyboard focus and focus-managed overlays.
- Offline fixtures meaningfully cover zero/missing/masked/invalid values,
  sort/pagination, selection limits, filters and source semantics.
- `just verify` passes, with live source checks and browser observations recorded
  separately from tests, remote CI and deployment.

## Status

Completed on 2026-10-04. The repository was clean at the start. Overview,
formation journeys, territories, specialties and source inventory use the real
API. Live read-only checks confirmed 14 published datasets and 357,164 retained
records. No database schema change or live data mutation was required.

## Delivery evidence

- `just verify` passed: all static checks, 30 Vitest cases, seven Node cases,
  28 Rust cases, PostgreSQL 18 integration and credential-free builds.
- Browser verification passed 54 development, 52 production and six production
  failure-state cases; two development-only gallery interactions are expected
  production skips. The gallery's production HTTP 404 is verified.
- Actual live data was reviewed in Chromium at 1440×1000 and 390×844, in both
  themes. Search, detail/history, comparison, favorites, specialties, territories,
  source definitions and keyboard navigation were exercised. No browser errors
  or warnings were captured during those journeys.
- Visual review improved mobile density, sorting labels, transition contrast,
  source terminology and focus behavior. New regression coverage protects
  shared comparison continuity and rapid navigation interactions.
- Evidence is recorded in `docs/quality.md` and the ignored
  `.artifacts/verify-observatory-delivery.log`, `.artifacts/data-review/` and
  `.artifacts/observatory-visual/` directories. Both lockfiles are retained.

Remaining hosting, ingestion scheduling/archive inventory, apprenticeship and
older specialty exploration, broader longitudinal methodology and additional
browser/screen-reader testing are recorded in technical debt. Remote CI, merge
and deployment were not performed as part of this local delivery.
