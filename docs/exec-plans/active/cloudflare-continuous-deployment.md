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
- Remote activation remains to be verified after publishing the workflow to main.
  A working script or stored secret does not prove a GitHub production deployment.
