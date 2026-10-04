# Cloudflare continuous deployment

## Objective

Automatically publish verified commits reaching `main` to the existing Cloudflare
API and website, with no routine manual publishing step.

## Scope and decisions

- Preserve the existing full verification job for pull requests and main pushes.
- Publish only trusted main commits after verification succeeds.
- Serialize production releases and prevent stale commits from overwriting newer
  main releases. Build before publishing; publish the API before the website.
- Use a dedicated Cloudflare API token in GitHub Actions, limited to the account
  and zone used by Gradavia. Keep the database credential solely in Cloudflare.
- Check public health, canonical routing and published-data rendering after release.
- Preserve manual migrations, ingestion and independent production data.

## Steps

1. Inspect current GitHub workflow, main revision and Cloudflare credentials.
2. Implement the deployment job, appropriate smoke checks and operational docs.
3. Validate locally and configure the scoped deployment credential.
4. Publish the workflow to main and verify its actual GitHub deployment and site.

## Evidence and remaining work

- The job is implemented with main-only gating, verification per main SHA,
  queued non-cancelling production releases, and a stale-main check immediately
  before API and prebuilt-web publication.
- The public smoke passed against the live site: 14,252 formations, a formation
  detail and provenance, health, canonical query preservation and gallery 404.
- The owner added `CLOUDFLARE_API_TOKEN` to GitHub; only its name and presence
  were read. Its effective permissions still need a successful CI deployment.
- Two existing main CI failures were traced to browser actions before hydration.
  Those tests now await the existing rendered charts before interacting, without
  fixed sleeps, retries or product changes.
- Independent static review found no blocker. Prettier, ESLint and the compatible
  actionlint checks pass. Local actionlint 1.7.12 predates the documented `queue`
  syntax; only that exact schema diagnostic is ignored. GitHub must validate and
  execute the actual workflow before remote success is claimed.
- Full local `just verify` passed: static checks, unit/database contracts, builds,
  76 development, 74 production and 12 state browser cases (two intended skips).
- PR #14 passed GitHub verification in run `37225275669`; the deploy job was
  skipped for the pull-request event as intended. The PR was merged into main
  as `5135f08438d70f8de7e60cf289cc401ec5edd618`.
- Main push [run 37226070152](https://github.com/gregorsternat/gradavia/actions/runs/37226070152)
  passed full verification, published the API and web, and passed the public smoke
  on its first attempt with 14,252 formations and a real detail/provenance check.
  The dedicated GitHub token was accepted by Cloudflare without local OAuth.
- First automatic versions: API `fc158431-75d6-4077-a462-d399342e0fea`,
  web `44ea6de0-a158-4bbe-be26-d3865f27da67`. A separate public health request
  returned 200 after the run. Evidence is retained in
  `.artifacts/cloudflare-ci/main-result.json`, `deploy-job.log` and
  `first-production-smoke/result.json`.

## Remaining operational limits

Migrations and ingestion remain manual. A failed post-publication smoke requires
inspection and, when appropriate, a manual rollback; it does not silently revert
production. The latest release and any later failures are recorded in GitHub
Actions. This completed plan records the initial activation, not an ongoing
monitoring service.
