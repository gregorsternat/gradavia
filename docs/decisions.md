# Technical decisions

## 001 — A small monorepo

pnpm workspaces for TypeScript, Cargo workspaces for Rust, and just for shared
commands. No additional task graph service is needed for three JS packages and
three crates. Versions and lockfiles make local and CI behavior reproducible.

## 002 — Next.js reads, Rust ingests (superseded by 010)

The initial explorer used server-only Next.js database reads. Decision 010 moves
those reads into a standalone Rust API at the user's request. Next.js retains
rendering and URL state; Rust owns ingestion and the application read path.

## 003 — One schema owner, separate connection roles

Drizzle owns schema and SQL migrations. SQLx consumes the resulting schema
without maintaining its own migration history. The API uses pooled PostgreSQL
connections; the collector and migrations use direct connections. `pg` serves
local tooling/tests, and Neon HTTP remains a connectivity diagnostic only.

Development uses Neon branches; local tests and GitHub Actions use disposable
PostgreSQL 18. CI requires no Neon secrets. The dedicated production reader is
documented in [deployment](deployment.md); separating migration and ingestion
roles remains DB-001 before those operations are automated.

## 004 — Source-owned visual components

beUI and Tremor Raw are installed/copied as local components with license and
source provenance. This allows small compatibility and accessibility fixes.
Tailwind 4 tokens unify their appearance. Motion respects reduced motion.
The gallery makes integration observable without inventing product metrics.

## 005 — Defer the Workers adapter (superseded by 016)

At the foundation milestone, adapter selection was deferred until official
Next.js compatibility, database transport, caching and browser behavior could be
verified. Decision 016 resolved that deferral: the current deployment uses
OpenNext for Next.js and a private Cloudflare Container for the Rust API.
The original deferral is retained as history, not a pending hosting decision.

## 006 — Repository knowledge and executable feedback

Following [Harness engineering](https://openai.com/index/harness-engineering/),
AGENTS.md is a short map into versioned architecture, product rules, plans,
decisions, quality evidence, and debt. Stable commands and CI enforce testable
boundaries; browser and database artifacts support diagnosis.

Checks enforce import direction, pure-domain dependencies, documentation links,
types, formatting, and behavior. They cannot prove statistical validity,
documentation truth, or full accessibility. Reviews remain necessary.
No automatic merge or recurring agent workflow is introduced.
See [repository workflow](harness.md) for the current guardrail inventory and
documentation upkeep rules. [Quality](quality.md) summarizes current coverage;
its linked archive preserves historical verification without implying freshness.

## 007 — Compatible ESLint major

ESLint 9 is pinned because the React/import/accessibility plugins in the chosen
Next.js configuration do not yet declare ESLint 10 compatibility. The v9
deprecation is tracked in technical debt; upgrade when the complete toolchain
supports the next major, with no peer-dependency overrides.

## 008 — Raw snapshots before analytics

Collect the 14 explicitly registered MESR datasets, including the superseded
specialties archive, with separate source namespaces. JSONB retains all source
values; a small set of indexed columns supports provenance and retrieval. Raw
exports, catalog metadata and method attachments remain in local gzip archives.

A release identifies a complete dataset, including every campaign it contains.
Canonical row multisets preserve duplicate source rows while ignoring export
order. Metadata definitions and method-file checksums participate in identity;
volatile collection/processing timestamps do not. Retain all versions and imports.

One direct PostgreSQL session holds a dataset lock. COPY and current-pointer
publication share a transaction. Replay verifies local archives and cannot replace
a different current release. Drizzle remains the only migration owner.

Use SQLx 0.9 or newer: the previous 0.8.6 TLS transport can deadlock when a socket
is blocked in both directions during a bulk transfer. This was observed during
the first Neon load; the [upstream fix](https://github.com/transact-rs/sqlx/pull/4251)
is included in 0.9. Local tests without TLS do not cover that transport behavior.

No individual-level data, source harmonization, cross-campaign matching, frontend
reads, business calculations or scheduled service is part of this milestone.
See [ingestion](ingestion.md) for operating limits and backup obligations.

## 009 — Descriptive exploration of immutable releases

The first product read uses retained JSONB records and the existing release/campaign
index. A published release is captured before bounded SQL search, filtering,
counting and pagination. A read projection table and search service remain
unnecessary for the current scope. Decision 010 relocates these queries from
Next.js into Rust without changing their source semantics.

GET forms make searches shareable and keyboard accessible. Historical gaps remain
visible, source rows retain their release/position identity, and the display never
merges campaigns or deduplicates source records. No derived indicators are added.
Browser fixtures are seeded only by the disposable database harness and labeled
in source metadata; neither runtime contains a synthetic fallback.

## 010 — Standalone Rust application reads

The user chose an explicit HTTP boundary so application data access and source
semantics can evolve independently of the UI framework, even with one consumer.
Use one Axum/SQLx service with `GET /v1/formations`, liveness and database
readiness. Next.js calls the API from server-only code and validates the payload
before rendering. It has no database dependency or runtime database credentials.

Keep SQLx queries parameterized and read-only, and preserve captured-release
consistency. Bound connection acquisition, SQL execution, HTTP deadlines and
response size. API logs record route categories/status/duration without user queries,
source records, secrets or raw driver errors. Drizzle remains the migration owner.

The cost is a second runtime, deployment and network boundary. Both processes
are supervised locally, while integration/browser tests run the actual API over
HTTP against disposable PostgreSQL 18. No public deployment, authentication,
new data model or unrelated endpoint is included. The [API contract](api.md)
documents the wire format and operational behavior.

## 011 — A source-aware admissions observatory

Expand the descriptive explorer into overview, detail, comparison, favorites,
territories and specialty destinations. Reuse immutable raw releases rather than
introducing speculative materialized tables or another ingestion model. The API
validates source fields into observed, missing, suppressed and invalid metric
states; `gradavia-core` owns their pure representation. Official rates retain their
published definitions. Aggregated applications are never unique people.

Bounded overview and historical-summary caches use captured release/provenance
records as keys and revalidate current pointers on every request. This reduces
repeated wide JSONB aggregation while preserving publication visibility. Formation
history resolves the source identifier but separately qualifies changed labels,
missing and ambiguous matches; it is not a guarantee of cohort comparability.
APB remains a separate archive.

Specialty exploration uses the reviewed 2025 general-baccalaureate dataset. Its
national, group and formation aggregation levels stay separate because people
can occur in several groups. No candidate probability or recommendation engine
is inferred from descriptive source counts. Older specialty sources and
apprenticeship remain discoverable in the inventory but are not silently merged.

## 012 — Browser-local selection and a shared visual language

Favorites and comparisons require no backend account. Store a bounded, validated,
versioned list of immutable source identities with display labels in local
storage. Resolve metrics again from the API, synchronize tabs and explain storage
failure. Comparing at most four records from one campaign keeps the result
readable and avoids accidental cross-campaign comparisons. Exports retain source,
campaign, metric state and spreadsheet-safe text.

Use beUI for default controls, Tremor for charts and Motion for animation, as
explicitly requested. Source ownership permits focused accessibility and
framework-compatibility repairs. A shared shell, monochrome tokens, local theme
selection and responsive density replace the previous sparse home page. Every
visualization has an exact-value alternative. Do not add decorative copy or
animation that delays access to data.

## 013 — Explicit development data selection

`GRADAVIA_DATA_ENV_FILE` optionally selects a populated development environment for
`just dev`. Only the API receives its database URL; Next.js receives neither the
URL nor the path. An unreadable or incomplete selection fails explicitly. Existing
environment files, migration targets and ingestion commands remain independent.
This supports review against an existing populated development branch without
copying secrets or silently mutating the checkout's database configuration.

## 014 — A public homepage and a dedicated observatory route

Use `/` for a distinct landing page and `/observatoire` for the existing national
overview. Preserve valid legacy `/?campagne=YYYY` links with a redirect and keep
campaign navigation explicitly scoped to each exploration route. The home
wordmark remains the route back to the landing.

The landing's content, native search and navigation render independently of data
availability. Only the streamed preview consumes the existing Rust overview
contract. It retains exact values, source, campaign and coverage; unavailable or
empty data yields useful search and navigation without invented statistics.
Inert loading placeholders cannot accept input that would disappear when the
preview resolves. Reuse the existing visual system and libraries; no second UI
system, analytics endpoint or marketing data snapshot is introduced.

## 015 — Gradavia project identity

Gradavia is the product, repository, package and binary name. The runtime uses
`GRADAVIA_*` configuration, and downloads and UI labels use the same identity.
The rename preserves the schema, source dataset identifiers, version-one archive
fingerprint and advisory-lock namespaces. Existing browser selections are read
from the historical key until the next write uses the new key. Existing empty
selections take precedence over that fallback. See the
[execution plan](exec-plans/completed/rename-gradavia.md) for verification and delivery.

## 016 — Preserve both runtimes on Cloudflare

Adapt official Next.js build output with OpenNext and run the existing Rust read
API in a Cloudflare Container. Although Cloudflare recommends vinext for new
projects, adopting its beta reimplementation would broaden this deployment into
a framework migration. The adapter retains the version of Next.js exercised by
the existing browser suite.

Use a private Worker service binding for web-to-API calls. Only the API container
receives the dedicated read-only Neon credential at runtime. Keep manual ingestion,
schema migrations, source release identity and missing-value semantics unchanged.
Bound the initial container count and allow idle shutdown. A cold container and
suspended Neon compute can delay the first request; verify that complete path
before claiming production readiness. Account activation and deployment are
separate from the checked-in configuration; see [deployment](deployment.md).

## 017 — One retained atlas per analytical population

The Rust API publishes a bounded, validated projection of one immutable source
release and campaign, with explicit Parcoursup, apprenticeship and APB adapters.
The existing paginated formation API remains available for lightweight search.
Maps and linked analytical views need the complete selected population; silently
sampling a page would change totals, distributions and geographic coverage.
The atlas rejects campaigns larger than 30,000 rows rather than truncating them.

Next.js consumes validated JSON, never SQL or database clients. Two-campaign
views resolve identity and exclusions on the server and send compact paired
values instead of two complete snapshots. The public dataset endpoint exposes
fixed selectors and formats through this boundary, with full provenance and
formula-safe CSV; arbitrary SQL and new personal-data storage are out of scope.

## 018 — Local preparation and explicit assumptions

Named lists, notes, checklists, saved analyses and budget scenarios remain in the
browser with versioned validation, bounded storage and explicit failure states.
Selection sharing includes immutable IDs by default; including personal notes or
checklists is a separate choice. Budget values are entered by the user and totals
require every input, including explicit zeros. No city cost, career outcome,
individual admission score or official deadline is manufactured from admissions
counts. External enrichments require documented source and join review first.

## 019 — Discover published records without an independent SEO database

Canonical page identity and indexation rules belong to the web application's
pure SEO feature. Formation metadata uses the same validated, request-cached Rust
response as the visible detail. Sitemaps consume complete, bounded atlas snapshots
and expose actual immutable record IDs; they do not create new database tables,
derive sequential IDs or couple builds to production data. Separate family files
keep the current 30,000-record contract below sitemap protocol limits.

Publish the latest campaign of each family initially, preserving historical
campaign navigation and detail identity. Native result links and pagination make
discovery independent of virtualized tables and browser JavaScript. Exclude
arbitrary filtered states and local preparation tools from indexing, while keeping
robots access available for crawlers to observe that policy. Sitemap publication,
Google indexing and ranking changes are distinct states; see [search discovery](seo.md).
