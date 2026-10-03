set dotenv-load := true
set dotenv-filename := ".env.local"

default:
    @just --list

# Install the locked dependencies and browser used by this checkout.
setup:
    pnpm install --frozen-lockfile
    cargo fetch --locked
    pnpm exec playwright install chromium

# Inspect prerequisites without connecting to external services.
doctor:
    node scripts/doctor.mjs
    cargo run --locked -q -p orvio-aggregator -- doctor

# Manual raw ingestion; run sources, sync, status, or replay --manifest <path>.
[positional-arguments]
ingest *args:
    cargo run --release --locked -q -p orvio-aggregator -- "$@"

# Refresh Rust resolution after an intentional dependency change.
lock-rust:
    cargo generate-lockfile

# Focused Rust checks, including HTTP/archive tests without live services.
check-ingest:
    cargo fmt --all -- --check
    cargo clippy --workspace --all-targets --locked -- -D warnings
    cargo test --workspace --locked

[positional-arguments]
test-ingest *args:
    cargo test --locked -p orvio-aggregator "$@"

# Start one local web instance; PORT can be set per checkout.
dev:
    pnpm dev

# Fast checks; these are the same commands used in CI.
check:
    pnpm format:check
    pnpm lint
    pnpm typecheck
    pnpm check:architecture
    pnpm check:docs
    cargo fmt --all -- --check
    cargo clippy --workspace --all-targets --locked -- -D warnings

test-unit:
    pnpm test:unit
    cargo test --workspace --locked

test-db:
    pnpm test:db

test-e2e: build
    pnpm test:e2e
    E2E_PRODUCTION=1 pnpm test:e2e

# Full test suite, including disposable PostgreSQL and browser tests.
test: test-unit test-db test-e2e

# Verify that build steps never need live database credentials.
build:
    env -u DATABASE_URL -u DATABASE_URL_UNPOOLED pnpm build
    cargo build --workspace --locked

# Read-only checks against the explicitly configured development database.
db-check:
    pnpm db:check
    cargo run --locked -q -p orvio-aggregator -- doctor --database

db-generate:
    pnpm db:generate

db-migrate:
    pnpm db:migrate

format:
    pnpm format
    cargo fmt --all

verify: check test
