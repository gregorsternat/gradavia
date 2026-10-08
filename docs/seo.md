# Search discovery and indexation

## Page identity

`features/seo/domain` owns the canonical production origin, French page titles,
descriptions, indexation policy, sitemap serialization and structured data.
Routes compose that policy with validated data. The origin is always
`https://gradavia.com`; request hosts, local ports and upstream URLs cannot change
canonical or social URLs. The existing permanent `www` redirect remains in place.

Public landing pages each have a distinct title and description. Formation
details use the actual formation, establishment, published location, family and
campaign. Missing locations and statistics are never invented. Request-scoped
React caching shares the formation result between metadata and page rendering,
including Cloudflare's service-binding transport, without caching stale errors
across requests. The generic social PNG is generated locally at build time;
it requires neither a remote image service nor live data.

WebSite and formation WebPage/BreadcrumbList JSON-LD describe visible content.
Breadcrumb labels and paths come from the same helper as the displayed navigation.
Source text is escaped against script termination. There are no invented ratings,
admission predictions or Course rich-result promises.

## Workspace addresses

Tool identity now uses a workspace root and `onglet`, for example
`/observatoire?onglet=territoires` and `/favoris?onglet=budget`. Historical tool
paths permanently redirect before rendering a loading boundary. Tool metadata,
canonical links and the public-page sitemap use the registry's destination.
The selected tool is rendered on the server and its tabs have native anchors.

Indexation still belongs to the tool: Budget remains public even though Favoris
is private, and the analysis/quiz panels remain noindex under the public
observatory. Semantic panel selectors are retained in canonical addresses;
filters retain their previous noindex rules. The browser updates metadata when
switching panels without a server navigation. Formation detail identities and
ordinary indexable pagination are unchanged.

## Indexation policy

| Content                                                                 | Policy                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Homepage and public tool introductions                                  | Indexable, canonical production URL                                      |
| Formation details, including retained historical records                | Indexable, immutable campaign-specific canonical                         |
| Ordinary formation pagination                                           | Indexable, each page has its own canonical and native next/previous link |
| Explicit latest formation campaign                                      | Consolidated with the default campaign URL                               |
| Historical formation campaign                                           | Distinct canonical campaign URL                                          |
| Search, sorting and filtered formation results                          | `noindex, follow`, normalized query identity                             |
| Query-specific states of other exploration tools                        | `noindex, follow`; tracking/view-only parameters are removed             |
| Favorites, comparisons, analysis workspace, modality selection and quiz | `noindex, follow`, absent from sitemaps                                  |
| Missing formations                                                      | Next.js not-found handling and `noindex`                                 |
| Unavailable/empty formation explorer and unavailable details            | `noindex, follow`, no fabricated descriptive content                     |

The root layout deliberately does not set a homepage canonical that unrelated
routes could inherit. `/atlas/[id]` for regular Parcoursup advertises the existing
`/formations/[id]` canonical; apprenticeship and APB retain `/atlas/[id]`.
Robots allows ordinary navigation so crawlers can read `noindex`; it excludes only
technical `/api/` and `/dev/` paths. `noindex` is not an access control mechanism.
Formation routes wait for their server content instead of streaming a loading
boundary that requires JavaScript to reveal the completed page. Existing in-page
transition feedback remains. Other data routes can still stream HTTP 200 before
a missing record is known; noindex is checked independently of transport status.

The default virtualized formation table is accompanied by an expandable, ordinary
HTML directory containing every record on that page. It stays useful without
JavaScript. Pagination anchors preserve filters and explicit display preferences,
while ordinary clicks retain the existing client navigation behavior.
The added directory, campaign and breadcrumb links disable speculative prefetch:
they remain ordinary crawlable anchors without loading every linked campaign or
detail merely because the directory enters the viewport.

Run focused browser regressions with `just test-browser tests/browser/seo.spec.ts`
after a build; `just verify` runs them with the entire development and production
suite. `E2E_PRODUCTION=1` selects the production server.
For manual inspection, `E2E_PORT=3199 just test-browser-server` starts the same
disposable fixture environment; stopping it removes its test database.

## Sitemap contract

`/robots.txt` advertises `/sitemap.xml`, a root sitemap index with four children:

- `/sitemap-pages.xml`: canonical public entry pages, independent of the API.
- `/sitemap-formations.xml`: latest published regular Parcoursup campaign.
- `/sitemap-apprentissage.xml`: latest published apprenticeship campaign.
- `/sitemap-apb.xml`: latest published APB campaign, kept separate from Parcoursup.

Each formation sitemap loads one complete validated atlas through the existing
server-only Rust API client. The atlas contract bounds a family snapshot to 30,000
records, below the sitemap limit of 50,000 URLs and 50 MB. The serializer uses
actual retained row identities, preserves source duplicates and never constructs
assumed consecutive IDs. XML escaping is applied after URL encoding.

An empty published inventory returns an empty sitemap. An unavailable source or
wrong family returns HTTP 503, `Retry-After: 300` and `Cache-Control: no-store`;
an outage must never masquerade as successful removal of all URLs. Successful XML
responses permit shared caching for one hour. This is an HTTP cache policy, not
proof of an edge-cache hit. No timestamp is fabricated from request/build time:
source collection time does not establish the last significant page update.

Historical Parcoursup formations remain discoverable through native campaign
links and pagination; detail history also links related retained records.
Sitemaps initially advertise the latest published campaign per family,
not every retained release. All sitemap files live at the root to avoid path-scope
ambiguity. Builds and the static index require no live credentials or dataset.

## Production rollout and measurement

1. Publish through the existing verified release pipeline. Check HTTP 200 and XML
   content for all four sitemap children, the actual robots response (including
   Cloudflare's managed preamble), and a real formation from each family.
2. Create or verify the `gradavia.com` Domain property in Google Search Console
   using the owner's DNS verification. Ownership/access is not established by
   this code change. Submit `https://gradavia.com/sitemap.xml` in its Sitemaps report.
3. Inspect the homepage, formation directory and a few formation URLs. Check the
   fetched/rendered content, user-declared and Google-selected canonical, indexing
   eligibility and structured-data parsing. Request indexing for representative
   pages; sitemap submission does not guarantee indexing or position.
4. Record a dated baseline of indexed pages, exclusion reasons, sitemap processing
   and Googlebot server errors. Then compare impressions, clicks, CTR and queries
   over comparable periods, distinguishing branded and non-branded searches.
5. Use observed queries to choose future substantive guides and curated city or
   subject pages. Do not generate thin keyword permutations. Evaluate field Core
   Web Vitals and API cold-start latency separately from local functional tests.

## References

Primary documentation reviewed on 2026-10-05:

- [Google sitemap rules and submission](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google canonical URL guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Crawlable link requirements](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- [Noindex and crawler access](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- [Descriptive page titles](https://developers.google.com/search/docs/appearance/title-link)

The pinned Next.js package's metadata, robots, Open Graph and JSON-LD guides were
also checked locally before implementation. Actual indexing and ranking evidence
belongs in Search Console; [quality status](quality.md) records local verification.

Legacy workspace redirects run before rendering in `src/proxy.ts`, so nested
loading boundaries cannot turn a permanent redirect into a streamed 200 response.
Workspace entry pages wait for their requested initial panel rather than hiding
its HTML behind a JavaScript-dependent loading boundary. In-panel loading applies
to subsequent client reads only.
