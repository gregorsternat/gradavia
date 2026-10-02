# Bootstrap Orvio

## Objective

Deliver the user-approved repository foundation as a dedicated PR, ready for
incremental feature work. UI is French; code and technical docs are English.

## Scope

Next.js/pnpm, Rust/Cargo, just, Neon development, Drizzle tooling, beUI/Tremor/
Motion, monochrome themes, a development-only gallery, tests, CI, and the
repository harness. No business imports or tables, comparison features, or
hosting deployment.

## Steps

- [x] Inspect the empty repository and verify sources/tool compatibility.
- [x] Create a development Neon branch and ignored local environment.
- [x] Set up workspaces, schema ownership, CLI, and diagnostics.
- [x] Add the web shell, themes, source components, and synthetic gallery.
- [x] Add architecture/documentation checks, tests, and CI artifacts.
- [x] Run the complete local verification loop and live Neon diagnostics.
- [x] Inspect the browser and prove failure artifacts are retained.
- [ ] Review the diff, commit, open the dedicated PR, and inspect CI.

## Evidence

Record final results in [quality status](../../quality.md). Local and remote
verification are separate. Move this plan to completed when the PR is delivered
and remaining limits are documented.

## Deferred

See [technical debt](../tech-debt.md) and the [feature order](../../product.md).
