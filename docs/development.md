# Development

## Prerequisites and setup

Install mise, rustup, Git, and a running Docker engine. The repository pins
Node 24, pnpm, just, and Rust in `.mise.toml`, `.node-version`,
`package.json`, and `rust-toolchain.toml`. Commit both package lockfiles.

Follow the [README](../README.md). On Linux, also run
`pnpm exec playwright install-deps chromium` after setup. CI does this itself.

`just` loads the root `.env.local`. Database Node scripts load that same file.
Next.js does not need database credentials for the current shell. Future server
reads run through `just dev`, which passes the root environment to the app.

## Environment

| Variable                | Use                                                                       |
| ----------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`          | Neon development pooled URL, HTTP reads                                   |
| `DATABASE_URL_UNPOOLED` | Direct development URL, migrations and SQLx                               |
| `PORT`                  | Development server port, default 3000                                     |
| `E2E_PORT`              | Dedicated browser-test server port; defaults 3100/3101 for dev/production |
| `ARTIFACTS_DIR`         | Checkout-local diagnostics directory, default `.artifacts`                |
| `TEST_DATABASE_URL`     | Optional local PostgreSQL 18 database named `orvio_test`                  |

Copy `.env.example` only when `.env.local` does not exist. Keep secrets ignored
and restrict local file permissions (`chmod 600 .env.local`). Never paste
connection strings into plans, screenshots, logs, issues, or PRs.

`just doctor` checks tools without contacting Neon. `just db-check` makes
read-only `SELECT 1` requests with both transports. Generic errors deliberately
omit driver messages that may contain credentials.

## Neon development

Project: [orvio, Frankfurt](https://console.neon.tech/app/projects/morning-firefly-45046041).
PostgreSQL major version: 18.

- Production: `br-tiny-leaf-b1dh585q`.
- Development: `br-hidden-grass-b1z6hk64`, created from production.
- Development compute: 0.25–1 CU, suspension after 300 seconds of inactivity.

Use the development branch for daily work. Branches contain independent data and
schema history after creation. For simultaneous schema work, use a separate
Neon branch per feature/worktree and its own local connection strings.

## Migrations

1. Edit `packages/db/src/schema.ts`.
2. Run `just db-generate`; review and commit generated SQL and journal entries.
3. Run the local integration tests and inspect the migration's actual behavior.
4. Exercise the migration on an isolated Neon development branch.
5. Apply with `just db-migrate` and a **direct** connection.

Do not use `drizzle-kit push` or SQLx migrations. Do not rewrite previously
applied migration files. Table definitions start with the first actual data
feature; the current journal is empty. Migration rollback tests demonstrate
transactional failure behavior, not a general production rollback strategy.

## Local tests and isolation

`just test-db` starts a uniquely named PostgreSQL 18 container on a random
loopback port, then removes only that container. It creates uniquely named test
schemas, verifies migrations and SQLx, and drops only those schemas afterward.

Alternatively, set `TEST_DATABASE_URL` to a disposable loopback database named
`orvio_test`. Remote hosts and other database names are rejected. CI supplies
this URL through its PostgreSQL service. Neon credentials are never needed in CI.

Every worktree has its own `.env.local`, `node_modules`, `target`, `.next`,
and `.artifacts`. Install and configure each checkout independently:

```sh
PORT=3200 mise exec -- just dev
E2E_PORT=3210 mise exec -- just test-e2e
```

Use different ports for concurrent test invocations. Tests reject reuse of an
existing server and clear database credentials before starting their own server.
Stop the dev server in the same checkout before browser tests: Next.js locks its
development output directory even when ports differ. Separate worktrees can run
their dev servers and checks independently.

## Diagnostics

Browser server logs, Playwright reports, failed-test screenshots, videos, and
traces go under `.artifacts`. Database checks retain a result summary and
container/CLI logs before container cleanup. CI uploads this directory with
`if: always()` and keeps it for seven days.

Open a trace with `pnpm exec playwright show-trace <trace.zip>`. Retained
artifacts are local or CI evidence; do not include credentials or private data
in test fixtures. A passing health request does not prove dataset freshness.

## Delivery

Use scoped English Conventional Commits. Include behavior, checks, and limits
in the PR template. Review the diff and CI result before describing work as
verified; merging and deployment are separate actions.
