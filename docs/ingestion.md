# Raw ingestion

The Rust CLI collects complete published MESR/SIES datasets. It stores source
values without statistical calculations, formation matching, or frontend reads.
The registry is versioned in `crates/aggregator/sources/registry.json`.

## Supported sources

All sources use the [MESR Explore v2.1 catalog](https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets).
Coverage was reviewed on 2026-10-03 and is not inferred from today's date.

| Family               | Dataset identifiers                                                   | Reviewed campaigns                     |
| -------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| APB                  | `fr-esr-apb_voeux-et-admissions`                                      | 2016–2017                              |
| Parcoursup           | `fr-esr-parcoursup-2018`, `fr-esr-parcoursup-2019`                    | 2018, 2019                             |
| Parcoursup           | `fr-esr-parcoursup_2020` through `fr-esr-parcoursup_2024`             | 2020–2024                              |
| Parcoursup           | `fr-esr-parcoursup`                                                   | 2025; mutable identifier               |
| Apprenticeship       | `fr-esr-parcoursup-apprentissage`                                     | 2022–2025                              |
| Formation map        | `fr-esr-cartographie_formations_parcoursup`                           | 2020–2026                              |
| Archived specialties | `fr-esr-parcoursup-enseignements-de-specialite-bacheliers-generaux`   | 2021, superseded population definition |
| Specialties          | `fr-esr-parcoursup-enseignements-de-specialite-bacheliers-generaux-2` | 2021–2024                              |
| Specialties          | `fr-esr-parcoursup-enseignements-de-specialite-bacheliers-generaux-3` | 2025                                   |

The initial catalog contained 357,164 rows across 14 datasets, including the
superseded archive. This is not a count of unique formations, wishes, or people.
Every import checks the current catalog count. The grains differ: formation
admissions, formation offers, and specialty/formation-group aggregates.

## Commands

Configure the direct URL of an isolated Neon development branch in `.env.local`
and apply committed migrations. The CLI never runs migrations implicitly.

```sh
mise exec -- just db-migrate
mise exec -- just ingest sources
mise exec -- just ingest sync
mise exec -- just ingest sync --dataset fr-esr-parcoursup
mise exec -- just ingest status
mise exec -- just ingest replay --manifest /absolute/archive/manifest.json
```

`--dataset` may be repeated. Each selected dataset is collected completely,
including all its campaigns. `sources` is offline. `sync` processes datasets
sequentially, continues after a failure, and returns nonzero if any dataset fails.
JSON results go to stdout; progress and sanitized errors go to stderr. `status`
lists every stored version and the latest run per source.

Replay verifies artifacts and the source contract without network access. It
initializes a missing current release but never replaces a different current
release. Sync publishes the currently collected source, including a previously
seen version if the publisher reverted its data.
That pointer change reports `published`; only a matching current release reports
`unchanged`.

## Database contract

Drizzle owns schema and migrations; SQLx consumes them over direct sessions.

- `source_datasets`: source namespace, family, archive flag and current release.
- `source_releases`: immutable fingerprint, provenance, full source metadata,
  license, importer/contract versions, manifest and campaign row counts.
- `raw_records`: complete JSONB payload and `(release_id, row_number)` identity;
  only campaign, establishment ID and explicit formation ID are projected.
- `ingestion_runs`: attempt identity, timing, status, counters and diagnostics.

Read current data by joining `source_datasets.current_release_id` to
`raw_records.release_id`. Records, release and current pointer commit atomically.
A composite foreign key prevents pointers to a different dataset's release.

Campaigns come from `session`, `annee` or `annee_du_bac`; the older specialties
archive explicitly supplies 2021 through its contract. New campaign values are
accepted with a compatible schema. Identifiers remain strings. APB, specialties,
and Parcoursup 2018/2019 have no explicit formation-ID column: the projected ID is
null and original URLs/labels remain in the payload. IDs do not establish
cross-year formation continuity.

JSONB preserves numeric precision, strings, arrays, objects, JSON null and absent
keys. Numeric fields are not coerced to floats; APB's textual numbers and masks
stay text. Markers already lost or collapsed to null by the publisher cannot be
reconstructed. Source definitions remain attached; indicators are not recomputed.
Repeated source rows remain repeated.

COPY loads batches of approximately 4 MiB in one transaction. A record is never
split between statements. This bounds each statement on slower remote links
without exposing a partial release. Targeted B-tree indexes support
release/campaign, establishment and formation lookups. Payloads have no broad
JSON index or partition layout.

## Archives and replay identity

`RAW_DATA_DIR` defaults to `.data/raw`, separate from diagnostic `.artifacts`.
Each run gets a new directory beneath its dataset, containing collection attempts:

- `records.jsonl.gz`: exact export response bytes, compressed locally;
- `metadata.json.gz` and `metadata-after.json.gz`: catalog responses;
- `attachment-<id>.gz`: original methodological attachments;
- `manifest.json`: source URLs, byte counts, SHA-256 checksums and identity,
  written only after complete collection and validation;
- `failure.json` and partial transfer files when collection fails.

Checksums cover uncompressed response bytes. JSONB does not retain whitespace or
object-key order; the original archive does. Files are never overwritten by the
collector. There is no automatic purge.

Release identity covers dataset, contract version, relevant metadata, attachment
checksums and a sorted multiset of canonical row hashes. Row/object-key order is
ignored; duplicate multiplicity and array order remain significant. Relevant
metadata includes field definitions, title, description, license, publisher and
references. Collection/processing timestamps remain archived and participate in
race detection, but do not create new releases by themselves.

The product rename retains the `orvio-raw-v1` fingerprint namespace and
`orvio-ingestion` advisory-lock namespace as compatibility contracts. Existing
manifests, release identities and mutual exclusion with older collectors stay
valid. These internal identifiers are independent of the `gradavia-ingest`
binary name; the rename requires no data migration or reimport.

Unchanged syncs retain newly collected files and run reports without duplicating
database rows. Archives can grow even when database contents do not change.

## Failure handling and limits

- One session advisory lock per dataset; concurrent owners get `dataset_locked`.
  A new owner marks abandoned attempts `interrupted`. Reimport starts the dataset
  again and preserves the previous valid release until success.
  During downloads, a query every 60 seconds keeps this session active. A lost
  session blocks publication; the collector finishes retaining its archive.
- Three HTTP attempts for transport failures, 408, 429 and 5xx; 1/2-second backoff.
  Honor `Retry-After`; values above 60 seconds fail for later manual retry.
- HTTP connection limit: 15 seconds. Request limits: one hour for complete
  exports, 10 minutes for metadata and attachments. Database connection and
  statement limits: 20 seconds/10 minutes.
- Compare catalog revisions, processing time, counts, schema and attachment
  metadata before/after collection; restart the collection at most three times
  if the source changes.
- Reject schema drift, malformed JSON/UTF-8, duplicate object keys, NUL strings,
  invalid representations and count mismatches. Diagnostics identify row/field
  where available without logging record values or raw driver errors. Database
  diagnostics distinguish transport failures and retain only validated SQLSTATE
  codes, never driver messages.
- Bounds: 2 GiB per export, 16 MiB metadata, 100 attachments of 128 MiB maximum,
  4 MiB per record and two million rows. Sorted hashes use at most 64 MB;
  payloads are streamed. Raising limits requires review.

Inspect `.artifacts/ingestion/<run-id>.json` and the raw attempt directory after
failure. If writing a local report fails after commit, the successful database
result remains authoritative and the CLI emits a warning. One rejected row means
validation stopped there, not that later rows
were accepted. Database errors remain generic. Lost database connections can
leave a run `running`; the next lock owner reconciles it.

## Verification and backup

`just test-ingest` runs offline archive/local HTTP tests. `just test-db` applies
real migrations to an independently created PostgreSQL 18 test database and
exercises COPY, exact round trips, replay, locks, interruption and rollback.
It also simulates an export longer than PostgreSQL's idle-session timeout; this
regression case adds about 76 seconds to the database test.
`just verify` includes the existing web checks without live sources or Neon.
Small fixtures retain provenance and license information in their README.

Back up PostgreSQL and the entire raw root together. Database backups contain
manifests but not export files. Take a consistent PostgreSQL dump, then copy the
raw root and retain the pair under the same backup identifier. Since archives
are retained and never overwritten by the collector, the copied root includes
the files referenced by the dump. Restore the database and those files together;
restoring the database also restores its current-release pointers. Verify file
checksums before relying on a restored archive.

Before removing/archiving a worktree, copy its
ignored raw directory to durable storage and update `RAW_DATA_DIR`. Manifest
artifact paths are relative, so replay works after relocation; stored database
`manifest_path` values document their original location.

Production roles, monitoring, scheduling, remote archives and purge tooling remain
deferred. See [quality](quality.md) for actual verification evidence.
