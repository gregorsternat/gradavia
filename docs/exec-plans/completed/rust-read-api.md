# Rust read API

## Objective

Move the formation explorer's read path into a standalone Rust HTTP service.
Next.js owns rendering and URL navigation; the API owns source selection, SQL,
descriptive mapping and the response contract. Preserve the eight campaigns,
historical gaps, provenance, duplicate identity and stable pagination.

## Decisions

- Add one Axum/SQLx service in `crates/api`, with transport, pure formation
  rules and repository modules. Keep `gradavia-core` free of I/O.
- Expose `GET /v1/formations`, liveness and database readiness. Use bounded
  connection/request timeouts, read-only transactions, sanitized diagnostics
  and graceful shutdown. Do not add schema changes or authentication.
- Keep Drizzle as the sole migration owner. Reuse the worktree's populated
  Neon branch; only the Rust API receives application database credentials.
- Replace the Next.js SQL reader with a server-only HTTP client that validates
  responses and maps failures to the existing retry state. Remove the web
  database dependency and enforce the new boundary in architecture checks.
- Exercise the actual Rust HTTP service against seeded disposable PostgreSQL 18
  in database and browser tests. Synthetic source metadata identifies fixtures;
  no production fixture switch or fallback remains.

## Steps

- [x] Implement and document the Rust endpoint and HTTP contract.
- [x] Replace the web reader and enforce dependency boundaries.
- [x] Wire local process lifecycle and isolated database/browser harnesses.
- [x] Verify unit, SQL/HTTP, publication-race and browser behavior.
- [x] Check all eight real campaigns and desktop/mobile views.
- [x] Run `just verify`, inspect the diff and update quality/architecture docs.

## Evidence and limits

Completed locally on 2026-10-04 (Asia/Shanghai). `just verify` passed: 11 Vitest
cases, six boundary/environment cases, 23 Rust cases, PostgreSQL 18 integration,
credential-free builds and 48 browser cases, with two expected gallery skips.
The HTTP integration test freezes row reads during publication and proves that
the captured release remains consistent. The next request observes the new release.

All eight live campaign counts match independent SQL; desktop/mobile light/dark,
keyboard search and mobile filters were reviewed through the real API. Final
review preserved whitespace-only source descriptions as null. Reproduced browser
retry and loading/focus races were fixed in their assertions, with failure
artifacts retained and focused checks passing before the final full run.

The diff contains no schema or migration changes. Architecture, product,
development, [HTTP contract](../../api.md) and [quality evidence](../../quality.md)
describe the new boundary. Logs and visual evidence remain under `.artifacts`.
No remote CI, merge or deployment is implied. Hosting and least-privilege
production roles remain separate deployment work.
