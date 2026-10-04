# Landing page

## Objective

Make `/` a complete French landing page that introduces Orvio through useful
product entry points and a source-backed preview. Preserve the existing
observatory at `/observatoire` and all other exploration journeys.

## Scope and decisions

- Reuse the existing monochrome tokens, wordmark, system type, beUI controls,
  Tremor charts and Motion. No additional design system or remote fonts.
- Give the landing its own compact navigation and spacious editorial layout.
  Keep the application shell on exploration and error routes.
- Render the core content and navigation independently of data availability.
  A streamed preview may use the existing Rust overview contract; never use
  invented metrics or synthetic chart fallbacks.
- Keep source provenance, campaign, aggregate coverage and history limits near
  any preview metrics. Avoid personal admission predictions and unverifiable
  marketing claims.
- Make every CTA useful, with direct formation search, overview, specialty,
  territory and methodology destinations. Preserve keyboard and theme access.

## Implementation

1. Relocate overview routing and update navigation/campaign links and tests.
2. Build the landing composition and responsive source-backed product preview.
3. Review in the real browser at desktop/mobile sizes, both themes, keyboard
   and reduced motion; refine hierarchy, spacing, loading and fallback states.
4. Run `just verify`, inspect the diff and record the observed evidence.

## Verification

- Complete: public landing, dedicated overview route, legacy campaign redirects,
  direct search, source-backed preview, responsive sections and shared themes.
- `CI=true E2E_PORT=3250 mise exec -- just verify` passed on 2026-10-05:
  static checks, unit tests, PostgreSQL 18 contracts, credential-free builds,
  70 development browser tests, 68 production browser tests and 12 production
  data-state tests. Two development-gallery cases are intentionally skipped in
  production, where its HTTP 404 is tested instead.
- Landing/specialty journeys passed 44 focused repetitions. Theme contrast was
  verified in ten repetitions after waiting for the visible tooltip's completed
  entrance, rather than sampling transient opacity during its animation.
- Real-browser review covered desktop/mobile light and dark themes, source
  preview, keyboard metric/FAQ controls, and direct exploration links. Exact
  values render without a count-up; long questions wrap at phone widths.
- Evidence is retained under `.artifacts/landing/`, including initial failures
  and the successful `verify-final.log`. See the [quality log](../../quality.md).

## Scroll entrance follow-up

The first version's 16px translations were too subtle. The follow-up separates
the hero lines, copy/actions, search columns, utility links, entry cards, source
columns and closing CTA into once-only fade-and-rise entrances. Short stagger
delays create a reading sequence without scroll interception. The source-backed
preview moves as a whole and retains exact numeric values. Reduced motion,
keyboard focus and JavaScript-disabled browsing keep content immediately visible.

Verification passed 74 development, 72 production and 12 production-state browser
cases, plus the static, unit, database and build checks. Focused regression tests
caught and fixed pointer displacement during focus/blur; static contrast scans
use reduced motion instead of sampling transient fade opacity. See the quality
log for the full run and focused state-rerun evidence.

## Remaining limits

Hosting and the existing data coverage limits remain separate milestones.
The enhanced preview and accordion interactions require JavaScript; the core
copy, links and native search are server-rendered. Automated accessibility checks
do not prove full screen-reader or cross-browser support. No remote CI, merge or
deployment was performed for this work.
