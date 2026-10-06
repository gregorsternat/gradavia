# Search discovery and page identity

## Objective

Make Gradavia's public content discoverable and distinguishable by search engines,
with useful French search snippets, canonical URLs and complete formation discovery.
Ranking and actual Google indexing require post-deployment observation.

## Baseline (2026-10-05)

- Public homepage responds HTTP 200; `/sitemap.xml` responds 404.
- Cloudflare supplies a content-signal preamble at `/robots.txt`, without a sitemap.
- The application has no canonical URLs, social metadata or structured data.
- Formation details share a generic title; most pages inherit the homepage description.
- Formation pagination uses JavaScript buttons and the default results table is virtualized.

## Scope and decisions

- Centralize page identity and query indexation policy in a pure SEO domain module.
- Give public routes distinct titles/descriptions and absolute canonical/social URLs.
- Resolve formation metadata from the same request-cached, validated Rust response
  used by the page. Preserve source campaign, immutable identity and missingness.
- Publish a root sitemap index, public-page sitemap and separate bounded sitemaps
  for the latest published Parcoursup, apprenticeship and APB campaigns, through
  the existing server-only API. Fail explicitly on upstream errors.
- Add safe WebSite/WebPage/breadcrumb structured data and a local social image.
- Make formation discovery and pagination work as ordinary server-rendered links.
- Exclude private selections and arbitrary search/filter states from indexation;
  keep campaign pagination discoverable and normalize presentation/tracking variants.
- Document Search Console setup and measurement without claiming ranking gains.

## Verification

- `just verify` passed with pinned dependencies and disposable PostgreSQL 18:
  104 Vitest tests, Node/Rust checks, database integration, credential-free builds,
  131 development browser cases and 129 production cases, plus six cases each for
  unconfigured, empty and unavailable production data. Eight browser exclusions
  are intentional (mobile-only checks on desktop and the production gallery).
- Sitemap tests exercise all 30,000 permitted rows without sampling, XML escaping,
  complete immutable identities, family mismatches and explicit 503 failures.
- Browser checks verify initial crawler metadata, canonical/query policy, real PNG
  dimensions and navigation without JavaScript, including historical campaigns.
- A production campaign-title mismatch was observed while discovery links could
  prefetch other campaigns. Those links now disable speculative prefetch; twenty
  repeated production campaign checks and the subsequent full suite passed.
- The no-JavaScript check exposed formation loading boundaries that left completed
  content hidden. Formation routes now wait for their server content. The map's
  existing loading view moved into the feature UI instead of being deleted.
- Real Chromium screenshots were reviewed at 1440 and 390 pixels, including the
  directory, detail breadcrumbs, campaign links and the social preview. Keyboard
  activation opened a formation from the directory. The final production browser
  check recorded no console errors and no horizontal overflow.
- `just cf-build` passed and generated the OpenNext Worker. This is packaging
  evidence, not a deployed-runtime check.

Logs, screenshots, sitemap output and regression traces are under `.artifacts/seo`.
Architecture, decisions, indexation policy and quality evidence are updated.

## Progress

- Implementation and local verification complete on 2026-10-05.
- No dependencies, database schema or source definitions changed.
- Publication and Search Console measurement remain tracked as SEO-001.

## Limits

Search Console ownership, actual indexing, rankings, impressions, click-through
rate and field performance cannot be inferred from local checks. Historical
campaigns remain reachable through the product; the discovery sitemaps initially
advertise only the latest published campaign per family to bound crawl volume.
