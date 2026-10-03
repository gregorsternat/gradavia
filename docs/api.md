# Rust read API

The standalone `orvio-api` binary uses Axum and SQLx. Next.js calls it from a
server-only module; the browser receives rendered pages and has no database or
API credentials. The service currently exposes public descriptive formation data
only. It has no write routes, ingestion trigger, authentication or CORS layer.
Public deployment, network exposure and least-privilege database roles remain
part of the hosting milestone.

## Run

`just dev` builds and supervises both processes. Each child is stopped if the
other exits; SIGINT/SIGTERM drains requests and closes the SQLx pool. Without
database configuration the website still starts and shows its unavailable state.

For independent processes, use `just api` and `just dev-web`. The latter needs
`ORVIO_API_URL`, a trusted HTTP(S) origin with no credentials, query or path.
`API_BIND` defaults to `127.0.0.1:3002`; explicitly bind another address when
operating behind a deployment proxy. The API alone receives `DATABASE_URL` (the
pooled Neon URL). The collector and migrations retain their direct connection.
Build a standalone release binary with `cargo build --release --locked -p orvio-api`.

## Endpoints

| Method and path      | Meaning                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET /v1/formations` | One explorer response: campaigns, selected source, normalized query, rows, total, facets and notices |
| `GET /health/live`   | Process liveness; no database connection                                                             |
| `GET /health/ready`  | Database connectivity (`SELECT 1`); not freshness, completeness or schema readiness                  |

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

Repeated parameters use the first value. Unknown parameters are ignored. Query
strings exceeding 16,384 bytes return 400. Missing historical filters are cleared
with notices and reset the page. GET forms in the site reset pagination for new
searches and clear filters on campaign changes; independent API calls describe
complete desired state and do not depend on prior requests.

## Successful responses

An empty database returns `{"status":"empty"}` with HTTP 200. A published
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
  query: { campagne, q, type, region, departement, statut, selectivite, page },
  facets: { type: string[], region: string[], departement: string[],
            statut: string[], selectivite: string[] },
  formations: [{
    id: "<release UUID>:<row number>", title: string,
    establishment: string | null, city: string | null,
    department: string | null, region: string | null, type: string | null,
    status: string | null, selectivity: string | null,
    parcoursupUrl: string | null
  }],
  total: number, notices: string[]
}}
```

Pages contain at most 25 rows, sorted by folded title, establishment and source
row number. Duplicate source records retain distinct identities. Display strings
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
