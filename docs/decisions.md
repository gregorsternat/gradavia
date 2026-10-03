# Technical decisions

## 001 — A small monorepo

pnpm workspaces for TypeScript, Cargo workspaces for Rust, and just for shared
commands. No additional task graph service is needed for two JS packages and
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
PostgreSQL 18. CI requires no Neon secrets. Least-privilege deployment roles
remain tracked before hosting.

## 004 — Source-owned visual components

beUI and Tremor Raw are installed/copied as local components with license and
source provenance. This allows small compatibility and accessibility fixes.
Tailwind 4 tokens unify their appearance. Motion respects reduced motion.
The gallery makes integration observable without inventing product metrics.

## 005 — Defer the Workers adapter

Cloudflare Workers is the intended host. The
[current Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
recommends vinext for new apps and also documents OpenNext. This does not select
a replacement runtime for Orvio yet. The hosting milestone will verify official
Next.js compatibility, adapter maturity, database transport, caching, and tests
before choosing and documenting an adapter.

## 006 — Repository knowledge and executable feedback

Following [Harness engineering](https://openai.com/index/harness-engineering/),
AGENTS.md is a short map into versioned architecture, product rules, plans,
decisions, quality evidence, and debt. Stable commands and CI enforce testable
boundaries; browser and database artifacts support diagnosis.

Checks enforce import direction, pure-domain dependencies, documentation links,
types, formatting, and behavior. They cannot prove statistical validity,
documentation truth, or full accessibility. Reviews remain necessary.
No automatic merge or recurring agent workflow is introduced.

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
