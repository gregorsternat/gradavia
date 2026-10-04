# Cloudflare deployment

## Objective

Publish the existing Gradavia website and Rust read API on Cloudflare and serve
the complete product at `gradavia.com`, preserving the Neon data contract.

## Scope and decisions

- Keep official Next.js and adapt its production output with OpenNext. A migration
  to the beta vinext implementation is outside this hosting change.
- Run the existing Axum/SQLx binary in a Cloudflare Container behind a private
  Worker service binding. Do not expose the API directly to the Internet.
- Keep database credentials out of Next.js and image/build inputs. Give the API
  a dedicated read-only database role through a Cloudflare secret.
- Bound the initial container count and allow idle shutdown.
- Route the apex domain to the web Worker and redirect `www` to the apex.
- Preserve manual ingestion and Drizzle-owned migrations.

## Steps

1. Inspect Cloudflare account/domain, current source, and available database data.
2. Add pinned adapters, Worker/container configuration, build/deployment commands,
   and operational documentation.
3. Run focused runtime checks, container build/health checks, and `just verify`.
4. Activate required account capabilities, provision the read credential, deploy
   both services, and attach custom domains.
5. Verify HTTPS, real published data, desktop/mobile and keyboard journeys.

## Completion evidence (2026-10-05)

- The owner activated Workers Paid and renewed Wrangler OAuth. The API and web
  Workers were deployed, with `gradavia.com` and `www.gradavia.com` attached to
  the web Worker. HTTPS and canonical redirects preserve encoded queries.
- The Rust API has no public route, workers.dev or preview URL. The website
  reaches it through a private service binding. The container is limited to one
  basic instance, with a ten-minute idle shutdown setting.
- The empty default Neon production root was preserved. An independent
  `gradavia-production` branch was copied from populated development; all release
  pointers, fingerprints, campaigns and counts matched. It contains 13 published
  releases and 199,655 raw records. The dedicated reader's real pooled login and
  rejection of writes were verified. Temporary administrator credentials were
  removed after provisioning.
- The first live web release exposed an unsupported Workers Request redirect
  mode. Actual workerd reproduction isolated the failure before the API call.
  Service-binding requests now use manual redirects and explicitly reject 3xx;
  regression tests and the corrected public release passed.
- Final `just verify` passed: static checks, Rust/TypeScript suites, PostgreSQL 18
  contracts, credential-free builds, 76 development browser cases, 74 production
  cases and 12 state cases. Two development-gallery cases were intended skips.
  Cloudflare builds, dry runs and the Linux/amd64 image had also passed.
- Public Chromium checks covered real overview aggregates, 14,252 formations,
  accented search, a formation detail, keyboard specialty selection and reload,
  CPGE group drilldown, mobile rendering and theme persistence. Console checks
  found no errors or warnings; mobile pages had no horizontal overflow.

See [deployment](../../deployment.md) for resource IDs and operations, and
[quality evidence](../../quality.md) for logs, versions and verification limits.

## Remaining limits

Data refresh and migrations remain manual. Cartography has no published release;
this deployment did not run an importer. Development imports do not update the
independent production branch. Monitoring, scheduled refresh and archive backup
remain in [technical debt](../tech-debt.md). Idle shutdown is configured but was
not timed in production. This release does not establish remote CI or a merge.
