# Technical decisions

## 001 — A small monorepo

pnpm workspaces for TypeScript, Cargo workspaces for Rust, and just for shared
commands. No additional task graph service is needed for two JS packages and
two crates. Versions and lockfiles make local and CI behavior reproducible.

## 002 — Next.js reads, Rust ingests

Next.js App Router owns the French product and server-side read paths. Rust
owns future source ingestion and batch calculations. The aggregator is a CLI;
a separate Rust HTTP service has no current requirement.

Pure domain code is isolated from persistence and transport. Add abstractions
when a real feature needs them, rather than creating empty services.

## 003 — One schema owner, two connection transports

Drizzle owns schema and SQL migrations. SQLx consumes the resulting schema
without maintaining its own migration history. Neon HTTP supports website reads;
`pg` provides direct migration/local-test connections; SQLx connects directly.

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
