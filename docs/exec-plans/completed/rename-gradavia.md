# Rename the project to Gradavia

## Objective and scope

Rename the product and GitHub repository to Gradavia, including the pnpm and
Cargo packages, binaries, environment variables, UI labels, downloads, test
harness and documentation. Start from the latest `main`, including the public
landing page. Keep source data, database schema and existing release identities
unchanged.

## Compatibility decisions

- Keep the version-one archive fingerprint namespace and ingestion advisory-lock
  namespace stable. Renaming either would invalidate retained archives or allow
  old and new collectors to import the same dataset concurrently.
- Read previously saved browser selections as a fallback; new writes use the
  Gradavia storage key and take precedence even when the selection is empty.
- Rename application configuration to `GRADAVIA_*` and document the local
  environment update. Do not change database connection values or dataset IDs.
- Rename the existing GitHub repository in place and update the shared `origin`.
  Existing checkout directory paths and Git history stay intact.
- Rename only the display name of the existing Neon project. Its project ID,
  branches, connection strings and data stay unchanged.

## Implementation

1. Inventory names and persisted identifiers; update source and documentation.
2. Preserve stored selections and ingestion compatibility with focused checks.
3. Validate locked dependencies, run `just verify`, and inspect desktop/mobile
   branding and keyboard navigation in a real browser.
4. Rename and verify the remote repository, inspect the diff, commit, push and
   open a pull request against `main`.

## Verification

Observed on 2026-10-05 (Asia/Shanghai):

- `just setup` accepts both locked dependency workspaces. Cargo package names
  changed; dependency versions and the path-based pnpm lockfile did not.
- `CI=true E2E_PORT=3410 mise exec -- just verify` passed: formatting, lint,
  TypeScript, architecture/docs checks, Clippy, 30 Vitest cases, seven Node
  boundary/environment cases, 28 Rust cases and PostgreSQL 18 integration.
- Browser suites passed 76 development, 74 production and 12 production-state
  cases, with two expected production gallery skips. The added regression
  covers historical favorites/comparisons, new writes and empty-state precedence.
- Archive fingerprint and advisory-lock golden values match the pre-rename
  contract. No migration, source-registry or dataset-fixture content changed.
- Real Chromium review covered the landing and app shell at 1440×1000 and
  390×844, the command palette, keyboard navigation and mobile menu.
- GitHub reports `gregorsternat/gradavia` with the same repository ID
  `1402245426`; `origin` uses its new SSH URL. The existing Neon project
  `morning-firefly-45046041` reports the name `gradavia`.

Evidence: `.artifacts/rename-gradavia/verify.log`, `.artifacts/database/result.json`,
the five browser reports, remote metadata in `.artifacts/rename-gradavia/`, and
screenshots in `.artifacts/output/playwright/rename-gradavia/`.

## Limits

This change does not migrate source data or deploy either service. Remote CI,
merge and deployment remain separate from local verification.
