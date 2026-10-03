# Raw public admissions ingestion

Status: completed on 2026-10-03. Approved scope: 14 MESR datasets, manual Rust CLI, local
immutable archives, PostgreSQL storage, no frontend or derived indicators.

## Design

- A versioned registry pins dataset identifiers, source schemas and identity fields.
- Fetch complete JSONL exports, metadata and methodological attachments; retain
  compressed originals in `RAW_DATA_DIR` and sanitized diagnostics in `.artifacts`.
- Drizzle owns four tables: datasets, immutable releases, raw records and runs.
- Preserve JSON types, exact numeric values, missing values, suppression markers,
  duplicates and source namespaces. Only campaign and explicit IDs are projected.
- Stage files, validate the complete release and publish with COPY in one database
  transaction. Compare canonical row multisets and relevant metadata for replay.
- Use direct connections and one advisory lock per dataset. Retry transient HTTP
  failures at most three times. Preserve the previous valid release on failure.

## Implementation

1. Prepare the locked toolchain and pin the 14 source contracts.
2. Generate and review the Drizzle migration.
3. Implement sources, sync, status and offline replay in the Rust CLI.
4. Extend isolated PostgreSQL tests with real migrations, local HTTP fixtures and
   atomicity, identity, archive-integrity and failure regression cases.
5. Run `just verify`; import all datasets on an isolated Neon development branch,
   measure storage and duration, and repeat to prove idempotency.
6. Update architecture, data contract, operating instructions and quality evidence.

## Evidence

Implementation, local verification, the complete live collection and a full
repeat are finished.

- Locked setup, Drizzle generation, migrations and `just verify` passed. The
  complete suite includes 16 Rust tests, real PostgreSQL 18 migrations and COPY,
  six Vitest cases, four architecture regressions, 12 development browser cases
  and 10 production cases (two expected development-gallery skips).
- PostgreSQL tests cover 14 contracts, a 10,017-row complete export, exact values,
  identity/replay, concurrency, interruption, late-batch rollback and diagnostics
  disk failures. The local HTTP tests need neither Neon nor official datasets.
- Isolated Neon development branch: `development-raw-ingestion-cc59`
  (`br-wild-surf-b13o7v3x`). `just db-migrate` and both `just db-check` clients passed.
- The first remote COPY exposed the SQLx 0.8.6 TLS readiness deadlock. Inspection
  matched [upstream fix #4251](https://github.com/transact-rs/sqlx/pull/4251).
  Upgrading to SQLx 0.9 and replaying Parcoursup 2019 loaded all 11,577 rows in
  42.16 seconds. Interrupted exploratory attempts remain recorded; their
  transactions did not publish partial releases.
- COPY statements use approximately 4 MiB batches within one publication
  transaction. Terminal run timestamps use `clock_timestamp()` to include COPY
  time. Full exports have a bounded one-hour request timeout for slower links.
- A seven-minute export lost its idle Neon session before loading. Collection now
  sends a real query every 60 seconds while holding the dataset lock. A regression
  test uses a 76-second HTTP response and PostgreSQL's 70-second idle timeout.
  The retained Parcoursup 2021 archive replayed successfully in 20.92 seconds.
- All 14 datasets are published: 357,164 rows and 14 releases. Direct SQL checks
  match each release's count, first/last row positions and every campaign count
  to its manifest. There are no extra stored releases or orphaned record rows.
- The catalog review found 14 datasets and 357,164 records. Each completed
  collection verifies its count against metadata captured before and after.
- A complete second `just ingest sync` exited successfully with all 14 sources
  reporting `unchanged`. Independent SQL checks confirmed 357,164 records and
  14 releases, unchanged fingerprints, current pointers and campaign counts,
  and no remaining running attempts. No records or releases were added.

### Observed source volumes

| Dataset                                                               | Records | Campaigns                                |
| --------------------------------------------------------------------- | ------: | ---------------------------------------- |
| `fr-esr-apb_voeux-et-admissions`                                      |  17,753 | 2016, 2017                               |
| `fr-esr-cartographie_formations_parcoursup`                           | 157,509 | 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| `fr-esr-parcoursup`                                                   |  14,252 | 2025                                     |
| `fr-esr-parcoursup-2018`                                              |  10,697 | 2018                                     |
| `fr-esr-parcoursup-2019`                                              |  11,577 | 2019                                     |
| `fr-esr-parcoursup-apprentissage`                                     |  39,032 | 2022, 2023, 2024, 2025                   |
| `fr-esr-parcoursup-enseignements-de-specialite-bacheliers-generaux`   |   3,965 | 2021                                     |
| `fr-esr-parcoursup-enseignements-de-specialite-bacheliers-generaux-2` |  17,420 | 2021, 2022, 2023, 2024                   |
| `fr-esr-parcoursup-enseignements-de-specialite-bacheliers-generaux-3` |  17,211 | 2025                                     |
| `fr-esr-parcoursup_2020`                                              |  12,760 | 2020                                     |
| `fr-esr-parcoursup_2021`                                              |  13,396 | 2021                                     |
| `fr-esr-parcoursup_2022`                                              |  13,644 | 2022                                     |
| `fr-esr-parcoursup_2023`                                              |  13,869 | 2023                                     |
| `fr-esr-parcoursup_2024`                                              |  14,079 | 2024                                     |

### Storage and timing

- Exact uncompressed exports: 528,401,321 bytes (503.9 MiB).
- The 14 referenced compressed archive directories, including metadata and method
  documents: 68,345,085 bytes (65.2 MiB).
- PostgreSQL raw records, indexes and auxiliary storage: 488,022,016 bytes
  (465.4 MiB), including 42,713,088 bytes of indexes. Whole database: 496,574,464
  bytes (473.6 MiB), including catalog/system storage.
- All retained archives before the repeat: 78,126,753 bytes, including earlier
  attempts. Unchanged recollections also retain their newly fetched files.
- Initial collection was completed across runs while transport failures were
  investigated. The last eight datasets took 895.79 seconds (14 min 56 s), with
  40,763,392 bytes peak resident memory (38.9 MiB). Network throughput varied.
  The exploratory APB run predates the terminal-timestamp correction; its stored
  duration excludes COPY and is not used as a performance measurement.
- The full repeat took 312.25 seconds (5 min 12 s), with 30,687,232 bytes peak
  resident memory (29.3 MiB), including downloads and archive validation.
- After the repeat, all retained archives occupied 142,583,493 bytes (136.0 MiB).
  The whole database occupied 496,607,232 bytes; the raw record count and
  referenced release archives were unchanged. The small database growth reflects
  run bookkeeping; unchanged collections do not insert raw records.

Evidence is retained under `.artifacts/verify.log`, `.artifacts/database/`,
`.artifacts/live-*.jsonl`, `.artifacts/live-*.log` and `.data/raw`. The direct SQL
snapshots are `.artifacts/live-first-verification.json` and
`.artifacts/live-repeat-verification.json`; their comparison is
`.artifacts/live-idempotency.json`, verified at 2026-10-03 15:34 UTC.
No remote CI run, merge or deployment is claimed for this implementation.

## Deferred

Scheduled ingestion, remote artifact storage, frontend reads, analytics,
cross-campaign formation matching and public deployment remain separate work.
