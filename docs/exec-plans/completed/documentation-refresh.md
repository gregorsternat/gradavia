# Current project documentation

## Objective

Refresh the repository's entry points against the implementation at `9f99df9`
on 2026-10-07 (Asia/Shanghai). Keep the short-map approach described in
[Harness engineering](https://openai.com/index/harness-engineering/) and make
current contracts, historical evidence and deferred work easy to distinguish.

## Scope and decisions

- Documentation only; preserve runtime behavior, dependencies and data contracts.
- Keep delivered scope and existing deferrals. The owner confirmed there is no
  prioritized roadmap; future tasks are selected when working on the project.
- Retain historical verification text in a linked archive; summarize current
  coverage and limits in the quality entry point.
- Describe the checks that exist and their limits, without claiming semantic
  freshness checks, automated cleanup, monitoring or new release policy.
- Treat Neon branch inventories and past release counts as dated observations;
  never infer this checkout's data target or current production health from them.

## Steps

1. Compare entry points, product/operations docs and decisions with source,
   manifests, test harnesses, workflow configuration and recent Git history.
2. Refresh navigation, ownership, operational instructions and evidence summaries.
3. Check links/formatting, run `just verify`, inspect the final diff and record
   the outcome and any environment limitations.
4. Move this plan to completed and update the plan index.

## Progress

- Repository and article reviewed. Existing import checks, disposable database
  and browser harnesses, deployment gates and documentation checker inspected.
- Found a 950-line quality entry point, undated Neon environment assumptions and
  superseded hosting decisions still worded as pending.
- Refreshed context navigation, current routes/ownership, historical hosting and
  Neon assumptions, and on-demand product direction. Preserved the complete prior
  quality log in an archive and added a concise current coverage summary.
- Full `WRANGLER_SEND_METRICS=false CI=true E2E_PORT=3528 mise exec -- just verify`
  passed: static checks, 104 TypeScript cases, Node/Rust suites, disposable
  PostgreSQL 18 contracts, credential-free builds and 278 browser executions
  (131 development, 129 production, 18 data-state; eight intended exclusions).
- Final formatting, documentation links/fragments and diff checks passed. The
  archived quality body matches the original after relative-link relocation.
  No application, workflow or lockfile change was introduced.

## Evidence and limits

Local evidence is `.artifacts/docs-refresh/verify.log`. Read-only GitHub results
are in `main-runs.json` and `last-completed-release.json` in the same directory;
the linked [quality summary](../../quality.md) records the exact release boundary.
This work did not refresh Neon inventory, run live imports, verify Search Console,
perform new manual UI review or publish a release. Existing follow-ups remain in
[technical debt](../tech-debt.md), without a newly imposed priority order.
