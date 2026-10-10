# Gradavia

A French platform for exploring and comparing public higher education admissions data, starting with Parcoursup.

Gradavia is an interactive observatory for French higher education: national
Parcoursup statistics, formation search, detailed indicators and history,
same-campaign comparisons, local favorites, regional exploration, and a
specialty-pair explorer for general baccalaureate graduates. The interface uses
source-owned beUI controls, Arc copy buttons, Tremor charts and Motion with monochrome light/dark
themes. All product data comes through a standalone Rust read API.

The expanded workspace adds a synchronized formation map, apprenticeship and APB
explorers, source-defined profile comparisons, named preparation lists, a personal
budget calculator, and an analysis workshop with reproducible exports. Two-campaign
comparisons use conservative matched records; public datasets and runnable notebooks
retain source versions and missing-value states. See the
[feature coverage](docs/feature-coverage.md) for exact scope and deferred requests.

The manual collector registers 14 official APB/Parcoursup source datasets and
retains immutable source releases when imports succeed. The UI distinguishes
published zeros, missing and suppressed values and keeps source context available beside the indicators.

Current source includes the Gradavia G identity, crawlable formation pages,
canonical metadata and source-backed sitemaps. There is no fixed feature roadmap:
work is selected by the owner as needed. See [product direction](docs/product.md)
and [quality status](docs/quality.md) for scope, verification and remaining limits.

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

Open [localhost:3000](http://localhost:3000) for the landing page, or go directly
to the [observatory](http://localhost:3000/observatoire). The landing's content
and search, shell, loading/error states and [component gallery](http://localhost:3000/dev/ui)
work without database credentials. Product charts, including the optional
homepage preview, require the configured Rust API and a published release.
The gallery is unavailable in production.

The observatory and [formation explorer](http://localhost:3000/formations) read imported data
through the Rust API and configured Neon branch. `just dev` supervises both
services and only passes database credentials to Rust. Without configuration it shows an explicit
unavailable state, never synthetic results. A migrated database without published
campaigns shows an empty state; a missing schema shows an unavailable state.
The latest published campaign is selected by default.

For a read-only preview against an already-populated development checkout while
preserving this checkout's `.env.local`, explicitly select its environment file:

```sh
GRADAVIA_DATA_ENV_FILE=/absolute/path/to/populated-checkout/.env.local mise exec -- just dev
```

This setting only supplies the development API connection. It does not change
migration or ingestion targets, and the web process never receives it.

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
| `apps/api-worker`   | Private Cloudflare Worker and Rust Container lifecycle             |
| `apps/web`          | Next.js observatory, French UI, server-side HTTP client            |
| `packages/db`       | Drizzle schema, SQL migrations, database adapters                  |
| `crates/api`        | Standalone Axum/SQLx read service; see [API contract](docs/api.md) |
| `crates/core`       | Pure Rust domain                                                   |
| `crates/aggregator` | Ingestion CLI and I/O adapters                                     |
| `scripts`, `tests`  | Diagnostics and executable guardrails                              |
| `docs`              | Product, data contract, decisions, plans, verification evidence    |

The [repository workflow](docs/harness.md) maps each concern to its authoritative
document and explains the executable guardrails.

Start with [architecture](ARCHITECTURE.md), the [documentation index](docs/index.md), and [AGENTS.md](AGENTS.md). The [deployment guide](docs/deployment.md) covers the Cloudflare website and private Rust Container. The public website is [gradavia.com](https://gradavia.com). GitHub Actions verifies main pushes before deploying the API and website; setup and release evidence are recorded in the deployment guide and [quality status](docs/quality.md).

## Cloudflare Free candidate

The immutable publication path retains Next.js and the existing product interface,
with offline HTML/RSC rendering, prepared public data and a Rust/Wasm read Worker.
See [publication operations](docs/cloudflare-publications.md) for the commands,
real workerd browser checks, quota gates and cutover steps. Implementation and
local verification do not imply production activation or cancellation of Workers
Paid. Ingestion remains explicit and independent of publication.
