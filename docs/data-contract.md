# Data contract

The [raw ingestion implementation](ingestion.md) enforces collection, identity,
representation and publication rules. Statistical harmonization, indicator
calculations and comparisons remain future work.

## Source and coverage

Primary source: [Parcoursup public dataset](https://data.enseignementsup-recherche.gouv.fr/explore/dataset/fr-esr-parcoursup/).
Its [catalog API](https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/fr-esr-parcoursup)
and field definitions were reviewed on 2026-10-03.

At review time, this mutable catalog entry describes the 2025 campaign, 14,252
formation records, an update dated 2026-03-09, and Licence Ouverte v2.0.
Apprenticeship formations are excluded and have a separate dataset. Never infer
the campaign from the catalog identifier or today's date.

The grain is a formation/establishment/campaign record, not an individual
applicant. Summing applications across formations does not count unique people.

## Provenance and identity

Every imported record must retain:

- source system and dataset/resource identifier;
- admissions campaign;
- source formation identifier when published, as an opaque string with leading zeros;
- collection time and source publication/update time when available;
- source version or revision, download URL, content checksum, and importer version;
- link to the retained immutable raw artifact and its license.

Do not assume that the same source ID means an unchanged formation across years.
Define and validate continuity separately. APB IDs live in their own source
namespace, with no automatic equivalence to Parcoursup IDs.

## Values

Represent at least three distinct states:

1. Observed value, including an observed zero.
2. Missing or unavailable value.
3. Suppressed/masked value.

Retain the original marker and parsing context in the raw data. Do not impute
suppressed values. Invalid values must fail validation or enter an explicit
quarantine report; they must not silently disappear.

Raw ingestion validates representations, field coverage, campaigns and identifiers
against a versioned source contract. It retains field definitions for later
review of units and denominator compatibility. Source schema drift produces
diagnostics before new data is published.

## Replay and publication

Retain raw artifacts outside Git; commit only small, clearly licensed fixtures.
The collector retains gzip archives in `RAW_DATA_DIR`, with manifests and
checksums, without automatic deletion. Back them up with the database.

An import must be replayable without adding duplicates. Release fingerprints
identify source snapshots; export position identifies rows within a snapshot.
Source duplicates remain distinct rows. Stage and validate a complete
release, then publish it atomically. Readers must not observe a partially loaded
campaign. Preserve the previous valid release if processing fails.

Record row counts, rejects, schema drift, checksums, run status, and timing.
Do not log individual records by default. The collector locks each dataset, runs
sources sequentially and bounds HTTP retries. Scheduling remains deferred.

## Indicators and comparisons

Each indicator needs a name, source fields, numerator, denominator, unit,
population, phase, campaign, rounding rule, and missing/suppressed-value policy.

The **official access rate** (`taux_acces_ens`) is defined by the source.
It cannot be reconstructed simply as admissions divided by applications from
the published aggregates. Preserve the official field and its definition.
Give any computed ratio its own label and formula; never present it as the
official access rate.

An application's historical ratio is not an individual's admission probability.
Do not compare different phases, cohorts, coverage, or changing definitions as
if they were equivalent. Explain denominator and coverage changes beside a
comparison, including establishment/formation restructuring.

APB collection uses its own source contract and preserves its textual values.
An explicit methodology review is still required before longitudinal comparison
with Parcoursup.

## Acceptance criteria for the first import

Use fixtures covering zero, absent, masked and malformed values; opaque IDs;
schema drift; duplicate/replayed releases; failed runs; and atomic publication.
Review results against the pinned source release and document any source
limitations. These checks run through offline fixtures and disposable PostgreSQL
integration tests. See [quality](quality.md) for observed evidence.
