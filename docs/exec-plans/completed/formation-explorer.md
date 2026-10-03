# Formation explorer

This records the initial explorer implementation. The read path and browser
harness are subsequently replaced by the [Rust API](../../api.md); descriptive
semantics and product behavior are preserved.

## Objective and scope

Deliver `/formations`, a French, accessible explorer of published Parcoursup
admissions campaigns, using the current immutable raw releases. Show descriptive
formation information, search, source links, filters and stable 25-row pagination.
The latest available campaign is selected by default. All eight currently stored
campaigns (2018–2025) are supported, separately and excluding apprenticeship.

Indicators, formation detail pages, comparisons, APB and deployment are deferred.

## Decisions

- Next.js server components read through Drizzle/Neon HTTP; no schema migration,
  public API or ingestion change is needed.
- Capture release IDs before reading rows, counts and facets; identify records by
  release and row number, including source duplicates.
- GET parameters persist campaign, search, filters and pagination. Search ignores
  French accents and case; pagination sorts by title, establishment and identity.
- Historical labels are composed from source fields. Missing city, status,
  selectivity or links are explicit, never invented.
- Browser tests use an explicitly injected fixture reader with no credentials;
  PostgreSQL 18 integration tests independently exercise the real SQL reader.
- Live checks use a feature Neon branch copied from the populated ingestion branch.

## Implementation and verification

1. Add pure filter/mapping contracts and the server reader.
2. Add responsive list, filters, provenance, loading and failure states.
3. Add unit, database and browser coverage, then run `just verify`.
4. Compare live results with SQL; inspect desktop/mobile and keyboard behavior.
5. Update documentation and verification evidence; inspect the final diff.

## Evidence

Completed locally on 2026-10-04 (Asia/Shanghai), starting at `f280ffe`.

- `just verify` passed: 13 TypeScript unit cases, four architecture regression
  cases, existing Rust checks, PostgreSQL 18 integration, credential-free builds,
  22 development browser cases, 20 production cases with two expected skips,
  and four production empty/unconfigured cases.
- Real reads on feature branch `development-formation-explorer-fdf3`
  (`br-square-pine-b1qud6l4`) matched independent SQL counts for 2018–2025, totaling
  104,274 source rows. The latest campaign has 14,252 rows; `ecole paris` returns
  209 matches in 2025. The feature branch inherits the ingestion snapshots.
- Reviewed real desktop (1440px) and mobile (390px) Chromium screenshots, including
  mobile light/dark, keyboard search submission and filter disclosure.
- Artifacts: `.artifacts/verify.log`, `.artifacts/database/`,
  `.artifacts/formations-live.json`, browser reports and
  `.artifacts/output/playwright/`. Secrets remain in the ignored worktree env.
- Updated product, architecture, data definitions, development and quality docs.

The existing index and schema suffice for this bounded read; no migration or
dependency changes were needed. No remote CI, merge or deployment was performed.
Remaining product and hosting work stays on the roadmap and existing debt list.
