# Immutable Cloudflare publications

## Status and boundaries

The Free-compatible candidate is implemented alongside the existing production
runtime. It is not yet activated. Production still uses OpenNext and the Rust
Container described in [deployment](deployment.md). No subscription change is
implied by a build, local test, private upload or GitHub release.

Next.js remains the only page renderer. Publication runs the real production
Next server offline against a frozen public read model, captures HTML and full
RSC navigation payloads, and retains the matching JavaScript/CSS chunks. Rendering
uses a crawler user agent so metadata is complete in the document head before
hydration. Layout, product copy, themes, controls and browser storage remain the
same. Finite campaign/pagination/view routes have complete HTML; arbitrary
non-indexable filter combinations load the existing workspace after hydration.
Their initial shell does not show results for a different query. Native no-JavaScript
catalog pagination, campaign and detail links remain prerendered.
Detail asset identities ignore query parameters, matching the Next routes:
the ID determines the source and campaign, including links carrying `famille`.
Catalog and workspace queries retain their distinct page states.

No database connection or credential reaches the public runtime. Neon is used
only by ingestion and explicit publication. The standalone Axum/SQLx API remains
available for local development, contracts and the offline publisher.

## Publication format

`gradavia-publish` prepares source inventory, all admitted release identities,
all retained atlas/detail projections, campaign search indexes, overviews and
specialty combinations. The portable Rust read model shares the original query
normalization, missingness, provenance, sorting and pagination contract. Compact
search indexes borrow text from their binary buffer; public formation projections
are separate and only the result page is read. Modality comparison uses a second
compact index over its original title/establishment/city scope.

The TypeScript preparation step computes public CSV/JSON/metadata exports,
source quiz questions and each supported pair of evolution snapshots. The web
facade streams large prepared panels instead of parsing and recomputing atlases.
It retains the native composition for bounded formation searches and selections.

Each completed directory has a versioned manifest with lengths and SHA-256
checksums. A new attempt requires a new directory; a failed attempt cannot
replace a complete directory. The renderer copies a data publication into a new
site publication. A `pg_dump` of the three public source tables can freeze a
consistent read-only production snapshot, then restore it into disposable local
PostgreSQL for preparation without thousands of production round trips. Drizzle
still owns the local schema. The ordinary publisher also verifies that source
pointers did not change while exporting.

Small logical assets are packed into archives bounded at 256 KiB. Larger assets
occupy their own archive, up to 24 MiB; larger JSON/HTML streams are split into at
most four physical parts. A SHA-256 prefix lookup selects the archive and byte
span. Cloudflare asset bindings in the tested runtime ignore Range, so the
reader handles a complete response with bounded streaming slicing and cancels
the remainder. It also accepts a correctly validated 206 response. Large
standalone assets stay streamed without slicing or buffering in JavaScript.

HTML/RSC documents of at least 128 KiB also retain a Brotli representation when
it is smaller. Its archive reference shares the identity document's lookup, so
negotiation adds no lookup request. Clients accepting Brotli receive the prepared
bytes through the asset reader, page Worker and gateway without recompression;
other clients receive identity bytes. Page responses vary by RSC and
Accept-Encoding and use representation-specific ETags. Split documents keep
their streaming identity fallback. The workerd check compares both wire
representations with the publication and exercises HEAD and conditional requests.

Physical files are partitioned deterministically into at most 18,000 files per
asset Worker. The quota check reserves a previous release and entrypoints below
90 Workers; the account inventory must additionally account for unrelated work.
Packing is necessary because retaining separate files for every historical HTML,
RSC and API row would consume too many file slots. Sharding does not increase the
account's dynamic request quota. Routed page requests execute Workers; only
assets served directly by Cloudflare avoid that dynamic request allowance.

## Runtime and switching

A candidate uses immutable names derived from the site manifest, archive and
frozen executable bundles. The archive, shards and runtime checksums are verified
before every stage or activation; subsequent source edits cannot change it:

- Asset Workers contain private static archive shards.
- The publication Worker locates and streams public artifacts.
- The Rust/Wasm API Worker resolves API requests against that publication.
- The web facade serves captured Next pages/RSC, workspace reads and datasets.
- `gradavia-web` becomes a small gateway with CURRENT and PREVIOUS bindings.

A single gateway deployment switches the whole candidate. Uploading the private
services cannot switch production. The document pins workspace reads with
`X-Gradavia-Publication`; the gateway retains the previous reader and Next chunks.
An expired identity receives 409 instead of silently mixing publications. Reload
starts a document on the current publication. Keep the previous private services
until their retention window ends; do not delete unrelated Workers.

## Commands

Use the pinned `mise exec -- just` commands. All output directories below must
be new; keep artifacts under `.artifacts`.

```sh
just verify
just test-publication
just test-publication-browser

# A configured reader or an explicitly selected local data source:
just publish-data .artifacts/data
# Production alternative: requires pg_dump/pg_restore 18 and the dedicated reader:
just publication-snapshot .artifacts/data ep-soft-surf-b1o2bgoj

just build cf-wasm
just publication-render .artifacts/data .artifacts/site
just publication-preview .artifacts/site
just publication-pack .artifacts/site .artifacts/candidate
just publication-deploy check .artifacts/candidate
just publication-deploy stage .artifacts/candidate
```

The snapshot command requires `DATABASE_URL` for the `gradavia_api` role and
checks the selected endpoint. PostgreSQL credentials go through process
environment only; raw driver diagnostics are suppressed. Builds and serving
processes receive no database credentials.

`test-publication-browser` builds Wasm, seeds disposable PostgreSQL, publishes and
packs fixtures, runs actual local workerd with all private bindings, checks public
exports and runs the existing desktop/mobile browser suite. It does not measure
Cloudflare production CPU or real-user Web Vitals.

The manual `Prepare immutable Cloudflare publication` workflow accepts an
existing GitHub data release or captures a new snapshot using the production
`GRADAVIA_PUBLICATION_DATABASE_URL` secret. It verifies contracts, stores immutable
public data/site archives and checksums in a versioned release, and can upload
private candidate Workers. It never automatically activates an unmeasured
candidate. Cloudflare receives only `CLOUDFLARE_API_TOKEN` during upload.
Before rendering pages, the workflow saves a `publication-data-<run>-<attempt>`
release containing the public data archive and checksum. If rendering or staging
fails, reuse that tag as `data_release` to avoid another production snapshot.

After measuring the exact candidate on Cloudflare, provide the evidence format
in `scripts/cloudflare-publication.ts`. Activation rejects stale evidence,
insufficient cold/warm samples, p99 CPU >= 8 ms, memory >= 128 MiB, limit errors,
account invocations >= 80,000/day, insufficient Worker capacity or failed browser
parity/performance targets. Local wall time is not valid edge CPU evidence.

```sh
just publication-deploy activate .artifacts/candidate .artifacts/evidence.json .artifacts/previous/release.json
just cf-smoke
```

Keep a previously activated release directory and its `activated.json` receipt for rollback;
repoint the gateway to its immutable services, retaining the replaced publication
as PREVIOUS. Rebuilding an old source commit is not the same rollback operation.
Rollback accepts the saved successful activation receipt without requiring a new
benchmark during an incident:

```sh
just publication-deploy rollback .artifacts/previous .artifacts/previous/activated.json .artifacts/candidate/release.json
```

## Cutover and billing checklist

1. Capture the real production source and complete its entire publication. Reject
   any missing page, source, checksum or budget violation.
2. Run staging browser, HTTP, retained-identity and cold/warm Cloudflare profiling.
   Record the exact release, device/network conditions, p99 CPU/memory, request
   count and measured before/after page performance. Do not invent evidence.
3. Activate only the verified candidate and run the public production smoke.
4. Set repository variable `GRADAVIA_RUNTIME=publication` before the next main
   deployment. This prevents the legacy CI job from restoring the Container.
   Code releases use the explicit publication workflow with the retained data
   release; automated activation still requires exact-candidate measurements.
5. Remove only the obsolete Gradavia Container, Durable Object and API Worker,
   after checking rollback needs and live health. Keep unrelated account resources.
6. Audit every other account workload, then cancel Workers Paid through an
   account authorized for subscription management. Verify the effective plan,
   cancellation date and any remaining paid services separately.
7. Configure `CLOUDFLARE_ANALYTICS_TOKEN` with Account Analytics Read. The daily
   scheduled usage workflow runs only when the runtime variable is `publication`.
   A manual run also works before cutover to verify the token and account margin.
   It fails visibly at the 80% account margin and never upgrades the plan.

Free currently means a shared account allowance of 100,000 dynamic requests/day,
10 ms CPU and 128 MiB memory, with 20,000 static files per Worker and 25 MiB per
file. These are deployment gates, not a claim that real traffic has passed them.
See [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/)
and [asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).
Neon, GitHub artifact/build storage and the domain are separate costs. The first
full capture/render still needs production-scale duration, disk and egress
measurements; fixtures cannot establish those budgets.
