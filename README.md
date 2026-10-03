# Orvio

A French platform for exploring and comparing public higher education admissions data, starting with Parcoursup.

Orvio includes a Next.js formation explorer, a standalone Rust read API, a development component gallery, and a Rust CLI that collects 14 public APB/Parcoursup datasets into PostgreSQL with immutable local source archives. The explorer browses published Parcoursup admissions campaigns with descriptive information, search, filters, pagination and source provenance. Indicators and comparisons remain future work.

## Start locally

Install [mise](https://mise.jdx.dev/getting-started.html) and [rustup](https://rustup.rs/), then:

```sh
mise trust
mise install
mise exec -- just setup
test -f .env.local || cp .env.example .env.local
mise exec -- just doctor
mise exec -- just dev
```

Open [localhost:3000](http://localhost:3000). The home page and [component gallery](http://localhost:3000/dev/ui) work without database credentials. The gallery is unavailable in production.

The [formation explorer](http://localhost:3000/formations) reads imported data
through the Rust API and configured Neon branch. `just dev` supervises both
services and only passes database credentials to Rust. Without configuration it shows an explicit
unavailable state, never synthetic results. A reachable database without published
campaigns shows an empty state. The latest published campaign is selected by default.

Use the Neon **development** branch credentials in the ignored root `.env.local` for database work. Never replace an existing local environment file. See [development](docs/development.md) for connection settings, independent worktrees, and diagnostics.

## Verify

```sh
mise exec -- just verify
mise exec -- just db-check
```

`verify` runs offline checks, unit tests, a production build, browser tests, and PostgreSQL 18 integration tests. A running Docker engine is needed for the disposable test database; CI provides its own PostgreSQL service. `db-check` separately checks the configured Neon branch using both TypeScript and Rust.

| Command            | Purpose                                                    |
| ------------------ | ---------------------------------------------------------- |
| `just setup`       | Install locked JS/Rust dependencies and Chromium           |
| `just doctor`      | Check local tools and CLI configuration                    |
| `just dev`         | Start the API and website                                  |
| `just check`       | Formatting, lint, types, architecture, docs, Clippy        |
| `just test`        | Unit, PostgreSQL, development and production browser tests |
| `just build`       | Build website, API and CLI without live credentials        |
| `just db-check`    | Read-only Neon HTTP and direct PostgreSQL diagnostics      |
| `just db-generate` | Generate a Drizzle migration from schema changes           |
| `just db-migrate`  | Apply committed migrations using a direct connection       |
| `just format`      | Format TypeScript, documentation, and Rust                 |

Raw ingestion commands and archive recovery are documented in [ingestion](docs/ingestion.md).

```sh
mise exec -- just db-migrate
mise exec -- just ingest sources
mise exec -- just ingest sync
mise exec -- just ingest status
```

`sync` writes to the explicitly configured database. Use an isolated development branch.
Run commands through `mise exec --` if mise is not activated in your shell.

## Repository

| Path                | Responsibility                                                     |
| ------------------- | ------------------------------------------------------------------ |
| `apps/web`          | Next.js App Router, French UI, server-side HTTP client             |
| `packages/db`       | Drizzle schema, SQL migrations, database adapters                  |
| `crates/api`        | Standalone Axum/SQLx read service; see [API contract](docs/api.md) |
| `crates/core`       | Pure Rust domain                                                   |
| `crates/aggregator` | Ingestion CLI and I/O adapters                                     |
| `scripts`, `tests`  | Diagnostics and executable guardrails                              |
| `docs`              | Product, data contract, decisions, plans, verification evidence    |

Start with [architecture](ARCHITECTURE.md), the [documentation index](docs/index.md), and [AGENTS.md](AGENTS.md). Website hosting on Cloudflare Workers and separate Rust service hosting remain a deployment milestone.
