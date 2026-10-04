# Development

## Prerequisites and setup

Install mise, rustup, Git, and a running Docker engine. The repository pins
Node 24, pnpm, just, and Rust in `.mise.toml`, `.node-version`,
`package.json`, and `rust-toolchain.toml`. Commit both package lockfiles.

Follow the [README](../README.md). On Linux, also run
`pnpm exec playwright install-deps chromium` after setup. CI does this itself.

`just` loads the root `.env.local`. Database Node scripts load that same file.
`just dev` builds the Rust API and supervises it alongside Next.js. Only the API
receives database credentials; the web process gets its HTTP origin. Both builds
and the website shell work without an API or database. The explorer shows a retry
state if the API is unconfigured or unavailable. Use `just api` and `just dev-web`
to run the processes independently; see the [API contract](api.md).

## Environment

| Variable                | Use                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `DATABASE_URL`          | Neon development pooled URL, Rust API and connectivity diagnostic                          |
| `DATABASE_URL_UNPOOLED` | Direct development URL, migrations and SQLx                                                |
| `PORT`                  | Development server port, default 3000                                                      |
| `API_BIND`              | Rust listener, default `127.0.0.1:3002`; choose a distinct worktree port                   |
| `ORVIO_DATA_ENV_FILE`   | Optional explicit environment file for development API reads only; preserves root settings |
| `ORVIO_API_URL`         | Trusted API origin for independent Next.js runs; derived by `just dev`                     |
| `E2E_PORT`              | Dedicated browser-test server port; defaults 3100/3101 for dev/production                  |
| `ARTIFACTS_DIR`         | Checkout-local diagnostics directory, default `.artifacts`                                 |
| `RAW_DATA_DIR`          | Retained raw exports and manifests, default `.data/raw`                                    |
| `TEST_DATABASE_URL`     | Optional local PostgreSQL 18 database named `orvio_test`                                   |

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

The imported datasets live on `development-raw-ingestion-cc59`
(`br-wild-surf-b13o7v3x`). The formation explorer worktree uses
`development-formation-explorer-fdf3` (`br-square-pine-b1qud6l4`), copied from that
populated branch. The original `development` branch does not contain the import. A successful
`db-check` confirms connectivity, not schema or data availability. To preview
against an existing populated development configuration without replacing the
root environment, run `ORVIO_DATA_ENV_FILE=/absolute/path/to/.env.local just dev`.
The supervisor reads only its `DATABASE_URL` for the API child and removes both
connection strings and the selection path from the web environment. Missing or
unreadable explicit files fail safely instead of falling back to another DB.
This setting does not affect migrations, ingestion or `db-check`.

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
applied migration files. The committed migrations define the raw ingestion tables. Migration rollback tests demonstrate
transactional failure behavior, not a general production rollback strategy.

## Local tests and isolation

`just test-db` starts a uniquely named PostgreSQL 18 container on a random
loopback port, or uses an explicitly provided local `TEST_DATABASE_URL`.
The shared harness creates a unique `orvio_ingest_<uuid>` database so generated
public-schema foreign keys are tested without rewriting migrations or touching
another invocation. Cleanup removes only that database and its owned container.

Database tests apply real Drizzle migrations, seed synthetic source releases,
start the real Rust API and assert its HTTP contract through the same response
validator as the web client. They verify search, filters, historical gaps,
duplicate identity, stable pagination and a concurrent source publication while
the API's rows query waits on a table lock. No production test hook is needed.
Existing Rust ingestion and migration rollback tests still run afterwards.

Browser tests also start the actual Rust binary and an isolated PostgreSQL 18
database through `scripts/e2e-server.ts`. Synthetic records are labeled through
source producer/license metadata. There is no application fixture reader,
fixture environment switch or fallback. `just test-e2e` covers development and
production interaction, plus production empty, unconfigured and unavailable
API scenarios. No Neon credentials or public source downloads are used.

Every worktree has its own `.env.local`, `node_modules`, `target`, `.next`,
and `.artifacts`. Install and configure each checkout independently:

```sh
PORT=3200 API_BIND=127.0.0.1:3202 mise exec -- just dev
E2E_PORT=3210 mise exec -- just test-e2e
```

Use different ports for concurrent test invocations. Tests reject reuse of an
existing server. Their API uses a random loopback port and disposable database;
their Next.js process has no database credentials.
Stop the dev server in the same checkout before browser tests: Next.js locks its
development output directory even when ports differ. Separate worktrees can run
their dev servers and checks independently.

## Diagnostics

Raw source archives use `RAW_DATA_DIR` (default `.data/raw`) and have no automatic
cleanup. See [ingestion](ingestion.md) for imports, backup and replay.

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
