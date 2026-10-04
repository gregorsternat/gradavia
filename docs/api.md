# Rust read API

The standalone `gradavia-api` binary uses Axum and SQLx. Next.js calls it from a
server-only module; the browser receives rendered pages and has no database or
API credentials. The service currently exposes public source-backed formation and aggregate admissions data. It has no write routes, ingestion trigger, authentication or CORS layer.
The Cloudflare deployment places it behind a private Worker service binding and
injects a dedicated reader credential into its container. The adapter accepts
only GET/HEAD API and health requests and sanitizes container startup failures.
See [deployment](deployment.md) for provisioning and current publication status.

## Run

`just dev` builds and supervises both processes. Each child is stopped if the
other exits; SIGINT/SIGTERM drains requests and closes the SQLx pool. Without
database configuration the website still starts and shows its unavailable state.

For independent processes, use `just api` and `just dev-web`. The latter needs
`GRADAVIA_API_URL`, a trusted HTTP(S) origin with no credentials, query or path.
`API_BIND` defaults to `127.0.0.1:3002`; explicitly bind another address when
operating behind a deployment proxy. The API alone receives `DATABASE_URL` (the
pooled Neon URL). The collector and migrations retain their direct connection.
Build a standalone release binary with `cargo build --release --locked -p gradavia-api`.

On Cloudflare, `GRADAVIA_API_TRANSPORT=service-binding` selects the private
`GRADAVIA_API` binding. A missing binding fails closed without falling back to a
public URL. Local development keeps the HTTP origin above. The container proxy
allows 17 seconds including cold start, inside the frontend's 18-second deadline;
an unavailable instance returns a sanitized 503 with a five-second retry hint.

## Endpoints

| Method and path           | Meaning                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET /v1/formations/{id}` | Detail of an immutable formation record, indicators, definitions and qualified history               |
| `GET /v1/overview`        | One campaign overview, distribution, coverage and independently sourced campaign observations        |
| `GET /v1/sources`         | Availability and provenance of all 14 registered datasets                                            |
| `GET /v1/specialties`     | 2025 specialty pairs, national observations, formation groups and formation drill-down               |
| `GET /v1/formations`      | One explorer response: campaigns, selected source, normalized query, rows, total, facets and notices |
| `GET /health/live`        | Process liveness; no database connection                                                             |
| `GET /health/ready`       | Database connectivity (`SELECT 1`); not freshness, completeness or schema readiness                  |

All responses use JSON and `Cache-Control: no-store`. Health success is
`{"status":"ok"}`. There is no persistent response cache hiding source publication.

## Query parameters

The endpoint accepts the same GET parameters as `/formations`:

| Parameter                                                | Rule                                                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `campagne`                                               | Four digits; latest published campaign by default. Unavailable campaigns select the latest with a notice.       |
| `q`                                                      | Trimmed, at most 120 Unicode characters, whitespace collapsed; literal AND word search with accent/case folding |
| `type`, `region`, `departement`, `statut`, `selectivite` | Trimmed, at most 160 characters; exact values from campaign-wide facets                                         |
| `page`                                                   | Positive integer with at most six digits; invalid input becomes 1 and excessive pages clamp to the final page   |

`tri` accepts `nom` (default), `capacite`, `candidatures`, `admis`, or `acces`.
Numerical sorts are descending, with unavailable values last; source title,
establishment and row number provide deterministic ties.

Repeated parameters use the first value. Unknown parameters are ignored. Query
strings exceeding 16,384 bytes return 400. Missing historical filters are cleared
with notices and reset the page. GET forms in the site reset pagination for new
searches and clear filters on campaign changes; independent API calls describe
complete desired state and do not depend on prior requests.

## Successful responses

A migrated database without published campaigns returns `{"status":"empty"}`
with HTTP 200. A missing schema returns HTTP 503. A published
campaign with zero matching rows returns `status: "ready"`, total 0 and an empty
formations array; its source, facets and campaigns remain available.

A ready response has this shape (types are descriptive):

```text
{ status: "ready", data: {
  source: {
    campaign: number, releaseId: UUID, datasetId: string,
    provider: string, license: string,
    collectedAt: ISO-8601 UTC string, modifiedAt: ISO-8601 UTC string | null,
    fields: string[]
  },
  campaigns: number[],                         // descending, distinct
  query: { campagne, q, type, region, departement, statut, selectivite, page, tri },
  facets: { type: string[], region: string[], departement: string[],
            statut: string[], selectivite: string[] },
  formations: [{
    id: "<release UUID>:<row number>", title: string,
    establishment: string | null, city: string | null,
    department: string | null, region: string | null, type: string | null,
    status: string | null, selectivity: string | null,
    parcoursupUrl: string | null, sourceFormationId: string | null,
    metrics: { capacity, applications, offers, admitted, accessRate,
               femaleShare, scholarshipShare, generalBacShare,
               technologyBacShare, vocationalBacShare }
  }],
  total: number, notices: string[]
}}
```

Each metric is `{value: number | null, state: "observed" | "missing" |
"suppressed" | "invalid", sourceField: string}`. Only observed metrics have a
number. Pages contain at most 25 rows, sorted by the selected metric or folded
title, establishment and source row number. Duplicate source records retain distinct identities. Display strings
and notices are French; absent source fields remain null. URL validation only
permits published HTTPS Parcoursup hosts. See the [data contract](data-contract.md)
for historical title composition, selectivity and source coverage.

Rust owns selection and source semantics. The frontend's Zod schema validates
the entire payload, row identities, campaign consistency and pagination before
rendering. PostgreSQL/HTTP integration tests pass the real Rust response through
that same schema, detecting contract drift across languages.

## Errors and resource limits

Errors have shape `{"error":{"code":"<code>"}}`. API error responses and API
request logs omit raw database errors, source payloads, connection URLs and user
queries. Successful responses include the normalized query for rendering.

| HTTP status | Code                 | Meaning                                                            |
| ----------- | -------------------- | ------------------------------------------------------------------ |
| 400         | `invalid_query`      | Query exceeds the bounded input size                               |
| 404         | `not_found`          | Unknown route                                                      |
| 405         | `method_not_allowed` | Unsupported HTTP method                                            |
| 503         | `unavailable`        | Database/read/decode failure or request deadline; `Retry-After: 5` |

The pool has at most five connections, zero minimum connections, an eight-second
acquisition timeout, 60-second idle expiry and ten-minute maximum lifetime.
Formation reads use a read-only transaction with an eight-second SQL statement
timeout and fifteen-second overall read deadline. Transaction-local settings and
nonpersistent prepared statements work through Neon transaction pooling.

Source discovery captures the published release ID; subsequent rows, totals and
facets use that immutable ID. Concurrent publication cannot mix two releases.
The next request observes the new pointer. No tables, indices or migrations are
added; Drizzle remains the sole schema owner.

The web client has an eighteen-second deadline, rejects redirects and responses
over 2 MiB, validates JSON and renders the existing unavailable/retry state for
all upstream failures. It never falls back to SQL or synthetic data.

## Overview contract

`GET /v1/overview?campagne=2025` uses the same campaign selection and source
precedence rules as the explorer. Search/filter parameters have no effect on
campaign aggregates. It returns `{status:"empty"}` when no campaign is published.
A ready response contains:

```text
{ status: "ready", data: {
  source: CampaignSource, campaigns: number[],
  totals: { formations: number, establishments: number,
            capacity: Total, applications: Total, admitted: Total },
  byType: Breakdown[], byRegion: Breakdown[],
  accessDistribution: [{label: string, min: number, max: number, count: number}],
  coverage: [{key: string, observed: number, missing: number,
              suppressed: number, invalid: number}],
  history: [{source: CampaignSource, campaign: number, formations: number,
             capacity: Total, admitted: Total}],
  notices: string[], requestNotices: string[]
}}
Total = { value: number | null, observed: number, total: number }
Breakdown = {label: string, formations: number,
             capacity: Total, applications: Total, admitted: Total}
```

Breakdowns sort by formation count descending with label ties; historical
observations sort by campaign ascending. An aggregate's `observed` field is the
number of included rows, not a share or a population estimate. `establishments`
counts distinct nonempty UAI identifiers. Numeric source projection is bounded at
250,000 records per selected campaign; an exceeded limit fails explicitly with
503 rather than silently truncating. History uses one server-side aggregate over
captured release/campaign pairs. `requestNotices` contains campaign fallback
messages; `notices` contains methodological explanations for disclosure surfaces.
An eight-entry memory cache reuses aggregate calculations only after every
request has freshly captured the complete current release/provenance set. A
publication changes the key immediately. Two additional historical snapshots
reuse the same captured source set across selected campaigns. Browser responses
remain `no-store`. See [data semantics](data-contract.md).

## Detail contract

`GET /v1/formations/{id}` takes a URL-encoded `<release UUID>:<positive row>`.
Malformed IDs, unknown records, or records outside the approved Parcoursup
admissions sources return HTTP 404 `{error:{code:"not_found"}}`. Retained releases
remain readable after a new publication. Successful responses are:

```text
{ status: "ready", data: {
  source: CampaignSource, formation: Formation,
  definitions: [{key: string, field: string, label: string,
                 unit: "count" | "percent", description: string}],
  history: [{source: CampaignSource, campaign: number,
             formationId: string | null, metrics: Metrics | null,
             continuity: "same-source-identity" | "changed-description" |
                         "ambiguous" | "missing"}],
  notices: string[]
}}
```

History is ascending and uses captured current releases, except the selected
campaign retains the requested snapshot. Matching requires both formation and
establishment identifiers. Ambiguous or absent matches have no metrics and no
record link. Description changes remain explicit. The source identifier alone is
not evidence of unchanged educational content.

## Source inventory contract

`GET /v1/sources` returns all 14 entries from the collector's committed registry,
with current publication evidence. A migrated database without published releases
returns a successful inventory of unimported datasets. Unavailable database access
or a missing schema returns HTTP 503.

```text
{ status: "ready", data: {
  datasets: [{datasetId: string, family: string, provider: string,
              title: string, sourceUrl: string,
              status: "published" | "not-imported", releaseId: string | null,
              campaigns: number[], rowCount: number | null,
              collectedAt: string | null, modifiedAt: string | null,
              license: string | null}],
  totals: {datasets: number, published: number, records: number},
  notices: string[]
}}
```

Inventory row totals measure archive volume across different grains. They must
never be labelled candidate, formation or admission totals. Campaigns are from
retained release coverage, not registry expectations. Dataset links point to the
official public source catalog; no archive filesystem paths are exposed.

## Specialty pair exploration

`GET /v1/specialties?paire=<opaque pair ID>&groupe=<source group>` reads only
`fr-esr-parcoursup-enseignements-de-specialite-bacheliers-generaux-3`, campaign 2025. Older specialty datasets have not been harmonized and do not enter this
endpoint. The query limit is 16,384 bytes; repeated values use the first.

```text
{ status: "ready", data: {
  source: CampaignSource, campaigns: [2025],
  query: {paire: string, groupe: string},
  pairs: Pair[], selectedPair: Pair,
  national: Observation | null, groups: Observation[], formations: Observation[],
  definitions: [{key: string, field: string, label: string,
                 unit: "count", description: string}],
  notices: string[], requestNotices: string[]
}}
Pair = {id: string, label: string, specialties: string[]}
Observation = {id: "release UUID:row number", group: string, formation: string,
               applications: MetricValue, offers: MetricValue, accepted: MetricValue}
```

Pair IDs serialize the source specialty array and are opaque to clients. The
default is the pair with the greatest observed national confirmed-candidate
count, with deterministic ID ties. An unknown pair falls back with an explicit
request notice; an unknown group is cleared with a notice. No group is selected
implicitly. Missing publication returns `{status:"empty"}`.

National observations come only from source aggregation level 0. Level 1 supplies
groups; level 2 supplies the selected group's formation observations. These
levels are never summed. Duplicate national observations yield null rather than
an invented total and are explained. Observation IDs and duplicate rows retain
source row identity. Pair discovery is bounded at 500 level-0 rows; a selected
pair is bounded at 5,000 source rows. Excessive or malformed source structures
fail with the ordinary sanitized 503 response.
