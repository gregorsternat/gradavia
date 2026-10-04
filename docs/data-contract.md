# Data contract

The [raw ingestion implementation](ingestion.md) enforces collection, identity,
representation and publication rules. The formation explorer implements the
read contracts below, including source indicators, within-campaign comparisons,
and explicitly qualified historical observations. APB/Parcoursup harmonization
remains deferred.

## Source and coverage

Primary source: [Parcoursup public dataset](https://data.enseignementsup-recherche.gouv.fr/explore/dataset/fr-esr-parcoursup/).
Its [catalog API](https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/fr-esr-parcoursup)
and field definitions were reviewed on 2026-10-04.

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
suppressed values. Ingestion rejects invalid representations. Semantically invalid
indicators remain in the raw data and the API exposes them as `state: "invalid"`
with a null value; overview coverage counts them explicitly.

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

## Formation explorer read contract

The Rust [HTTP API](api.md) owns this contract. Next.js validates its serialized
response and presents it; no web module reads PostgreSQL directly.

Only the eight registered `parcoursup` admissions sources are read. APB,
apprenticeship, formation mapping and specialty aggregates are not combined with
them. Campaigns come from the published release's retained coverage, rather than
the dataset name or current date. If the mutable alias and a year-specific source
cover the same campaign, the year-specific source takes precedence.

Read rows by captured `release_id` and `campaign`, preserving `(release_id,
row_number)` identity and duplicate multiplicity. Counts are source records for
the selected campaign, never unique people or cross-year formation counts.
Pagination, counts and campaign-wide filter options share that release. A later
request observes a newly published current pointer.

The displayed fields are `lib_for_voe_ins`, `g_ea_lib_vx`, `ville_etab`, `dep_lib`,
`region_etab_aff`, `fili`, `contrat_etab`, `select_form` and `lien_form_psup`.
When the full title is absent, join distinct nonempty `form_lib_voe_acc`,
`fil_lib_voe_acc` and `detail_forma` values in source order. No city or identifier is
inferred. Normalize only the documented 2020/current selectivity spellings for
presentation; other source vocabularies, including DUT and BUT, remain distinct.

Search matches literal words with AND across title, establishment, city,
department and region. Case, combining accents and the French ligatures `œ` and
`æ` are folded for search, without altering displayed source strings. SQL LIKE
wildcards in user input remain literal. Filters use exact source values except
for the documented selectivity labels. Rows sort by name or descending observed capacity, applications, admitted count
or official access rate. Missing and invalid values sort last. Folded title,
establishment and row number break ties; the page size is fixed at 25.

Absent descriptive fields are explicitly unavailable. Source URLs must be valid
HTTPS links on Parcoursup hosts without embedded credentials; unavailable links
are not reconstructed. Dataset links, producer, license, campaign, collection
date and source modification date accompany the results. The reviewed source indicators below accompany each record. No admission
probability or personalized score is calculated.

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

## Published indicators

The API exposes ten source fields. It never derives the official access rate or
averages percentages across formations. Raw archives retain the original source
representation. API numbers use double precision; presentation may round
percentages to one decimal and counts to whole numbers.
Every detail carries its campaign, retained metadata label, field, unit and
population/phase explanation. Source metadata descriptions are retained when
published.

| API key              | Source field     | Unit and population                                   | Phase / denominator                                                                                                 |
| -------------------- | ---------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `capacity`           | `capa_fin`       | Published places for one formation                    | Campaign capacity; not currently vacant places                                                                      |
| `applications`       | `voe_tot`        | Candidates to one formation                           | All campaign phases; sums count formation candidatures, not people                                                  |
| `offers`             | `prop_tot`       | Candidates receiving a proposition from one formation | All campaign phases                                                                                                 |
| `admitted`           | `acc_tot`        | Candidates accepting a proposition from one formation | All campaign phases                                                                                                 |
| `accessRate`         | `taux_acces_ens` | Source percentage                                     | Main phase; candidates whose rank is at most the last called rank of their group / candidates with a validated wish |
| `femaleShare`        | `pct_f`          | Published female share                                | Women admitted / all admitted                                                                                       |
| `scholarshipShare`   | `pct_bours`      | Published scholarship share                           | Scholarship neo-baccalaureate admitted / neo-baccalaureate admitted                                                 |
| `generalBacShare`    | `pct_bg`         | Published general baccalaureate share                 | General neo-baccalaureate admitted / neo-baccalaureate admitted                                                     |
| `technologyBacShare` | `pct_bt`         | Published technological baccalaureate share           | Technological neo-baccalaureate admitted / neo-baccalaureate admitted                                               |
| `vocationalBacShare` | `pct_bp`         | Published vocational baccalaureate share              | Vocational neo-baccalaureate admitted / neo-baccalaureate admitted                                                  |

The three baccalaureate shares refer to neo-baccalaureate admissions, so they must
not be combined with an all-admitted denominator. Independently rounded source
percentages need not sum to exactly 100. An absent field, including the access
rate in 2018, stays unavailable.

`MetricValue` distinguishes `observed`, `missing`, `suppressed` and `invalid`.
Only observed values have a number. Counts must be nonnegative safe integers;
percentages must lie in [0, 100]. Empty/null, `na`, `n/a`, `nd` and textual `null`
are unavailable. `ns`, `n.s.`, `s`, `ss`, `secret`, `*`, `<5` and `< 5` are
suppressed. Other malformed markers remain explicitly invalid. Marker parsing
is case-insensitive and trims surrounding whitespace; immutable raw records
retain the original representation. No value is imputed.

## Overview aggregates and coverage

Each overview uses exactly one captured Parcoursup admissions release/campaign.
Types and regions are source labels; absent labels form an explicit “Non
renseigné” group. The formation count is a source row count, retaining duplicates.
The establishment count is distinct nonempty `cod_uai`, never inferred names.

Capacity, candidature and admitted totals sum only observed source values. Every
sum includes `observed` and `total` row counts. If no value is observed, its sum is
null; a fully observed zero remains zero. Partial sums are not estimates of the
missing population. Per-indicator coverage separately counts missing, suppressed
and invalid values. Type and region row counts reconcile to the overview total.

The access histogram counts source records with an observed official rate in
[0,20), [20,40), [40,60), [60,80), [80,100]. It is not a national access rate or
candidate-weighted distribution. No arithmetic or weighted mean access rate is
published.

Aggregate history consists of one independent campaign observation, with its own
captured release and coverage. Changing formation supply, classifications and
source definitions can change totals. No APB values are stitched into Parcoursup
series, no synthetic missing campaign is filled and no growth claim assumes a
constant population. The source inventory reports all 14 registered sources,
including unimported sources, and preserves their distinct grains.

## Formation identity and comparison

Detail URLs retain `(release_id, row_number)` snapshot identity. They remain
readable after later publication while the archive is retained. Historical
candidate matching requires the same nonempty opaque `cod_aff_form` **and**
`cod_uai`. One match exposes the source observation; description, type or
establishment-name changes are marked `changed-description`. Multiple matches
are `ambiguous` with no historical metrics; zero matches are `missing`. Even
`same-source-identity` is evidence of shared source identifiers, not a guarantee
of unchanged formation content. Historical charts must preserve these gaps and
explain continuity, never silently present the matching as a stable cohort.

Formation comparisons use the same campaign and indicator definitions. A
comparison containing different snapshots must retain each source, and differences
between types/selectivity/populations must be visible. No ranking is labelled
quality, chance of admission, or an applicant recommendation.

## Specialty pairs: 2025 scope

The specialty explorer uses the retained
[2025 general baccalaureate specialty dataset](https://data.enseignementsup-recherche.gouv.fr/explore/dataset/fr-esr-parcoursup-enseignements-de-specialite-bacheliers-generaux-3/).
It does not infer causal effects of taking a specialty pair, school-level
selection, individual admission chances or cross-year equivalence.

The grain is `(campaign, doublette, niveau_d_agregation,
regroupement_de_formations, formation)`. `doublette` is the published two-item
specialty array, preserved in source order. The three published counts are:

| API key        | Source field                | Population                                                                                                     |
| -------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `applications` | `voeux`                     | General baccalaureate graduates of this specialty pair with at least one confirmed wish within the row's scope |
| `offers`       | `propositions_d_admissions` | Those graduates receiving at least one offer within the row's scope                                            |
| `accepted`     | `acceptations`              | Those graduates accepting an offer within the row's scope                                                      |

Counts use the source's 2025 campaign scope, not the main-phase rank-based access
rate. Their units are people **within one row's scope**. The same person may
appear in multiple formation groups or formation labels, so neither rows nor
aggregation levels may be summed into a population. National totals must be read
from level 0, groups from level 1, and group drilldowns from level 2. Suppressed,
missing and invalid counts retain the same explicit `MetricValue` states.

On 2026-10-04, read-only profiling of the retained release found 75 specialty
pairs, 75 level-0 rows, 5,475 level-1 rows (73 groups) and 11,661 level-2 rows
(313 formation labels), with zero duplicate keys at the stated grain. This is
snapshot evidence, not a hard-coded expectation for future releases. The API
refuses to aggregate duplicate national keys. The older 2021–2024 specialty
sources remain visible in the inventory but require a separate methodology
review before longitudinal display.

Inverse specialty exploration uses the same level-2 observations and selects
the exact published `(regroupement_de_formations, formation)` tuple. Its catalog
and observations describe **national labels**, not a campus or establishment.
An admissions detail link leads to explicit label selection; it does not infer
an exact match from a similar title. All published pairs remain available in the
table/export, with suppressed and missing counts preserved. The chart's leading
12 pairs are a labelled preview, never a replacement for the complete rows.
The inverse view does not sum counts across overlapping national formation
scopes, infer an admission chance or identify an effect of taking a specialty.

## Atlas family projections

The atlas exposes three independent populations with an immutable source version
per snapshot. It retains every source row, its formation and establishment
identifiers when published, coordinates, explicit missingness and coverage. Its
30,000-row limit fails explicitly; it never samples an apparently complete map
or analysis. Stored analysis URLs can pin a retained release. A different
publication does not rewrite those observations.

The regular Parcoursup projection adds `localShare` from `pct_aca_orig`: the
published percentage of admitted neo-baccalaureate candidates from the same
academy. The separate `pct_aca_orig_idf` field combines Paris, Créteil and
Versailles and is available only in enriched detail. Neither percentage supplies
origin-destination flows. The regular source publishes a geo object; apprenticeship publishes text
`latitude, longitude`. Both are range-validated without geocoding. Source
coordinates locate formations; distance is
straight-line distance and never transport time or accessibility.

The apprenticeship adapter reads only `fr-esr-parcoursup-apprentissage`, preserving
its own campaign coverage. It exposes the source capacity, candidatures and
propositions. Its source does not publish accepted admissions or the ordinary
Parcoursup access rate; these remain missing. `nb_rech_con`, `nb_ref_classe` and
`nb_ref_place` describe wishes placed in contract search, refused after dossier
review, and refused for capacity respectively. Contract-search status is not an
admission. Its candidate baccalaureate categories use `nb_voe_ap_bg`,
`nb_voe_ap_bt`, `nb_voe_ap_bp` and `nb_voe_ap_at`, not main-phase fields from the
regular source.

The APB adapter reads only `fr-esr-apb_voeux-et-admissions`. It preserves textual
source numbers with the same observed/missing/suppressed/invalid parser. Source
fields `lib_dep`/`lib_reg`, `p_acc_boursier` and `p_acc_academies` provide territory,
scholarship and local-recruitment values. APB scholarship percentages concern the
published APB admitted population, unlike the Parcoursup neo-baccalaureate
percentage. Absent city, coordinates, formation identifiers and access rates stay
missing. APB's hierarchical wishes, indicators and 2016–2017 coverage remain
separate from Parcoursup; no cross-system time series or identity match is made.

### Enriched formation observations

The retained source field labels and representations were reviewed in the
committed official metadata fixtures on 2026-10-05. These projections do not add
external datasets or claim newer source publication. The detailed contract
exposes these additional source fields without imputing values:

- Candidate/admitted profiles: `voe_tot_f`, `acc_tot_f`, `acc_neobac`, `acc_bg`,
  `acc_bt`, `acc_bp`, `acc_at`, `acc_brs`; APB uses `acc_boursier` for scholarships.
- Main-phase candidate profiles: `nb_voe_pp`, `nb_voe_pp_bg`, `nb_voe_pp_bt`,
  `nb_voe_pp_bp`, `nb_voe_pp_at`. Source offer profiles `prop_tot_bg`,
  `prop_tot_bt`, `prop_tot_bp`, `prop_tot_at` and admissions cover the campaign's
  published phases. These must not be presented as a single-cohort conversion
  funnel. Each column keeps its phase and population label.
- Mentions: `acc_mention_nonrenseignee`, `acc_sansmention`, `acc_ab`, `acc_b`,
  `acc_tb`, `acc_tbf`; these describe admitted neo-baccalaureate candidates.
  Missing historical categories remain missing rather than zero. APB uses
  `acc_passable`, `acc_assez_bien`, `acc_bien`, `acc_tres_bien` with its own scope.
- Origin: `acc_aca_orig`, `pct_aca_orig_idf`, `pct_etab_orig`; APB uses
  `acc_academies` and `p_acc_term`. Published count and percentage labels can refer
  to different scopes; the API does not reconstruct one from the other.
- Offer-receipt milestones among ultimately admitted candidates:
  `acc_debutpp`, `acc_datebac`, `acc_finpp`. These report the final admitted
  population's offer timing at published milestones, not daily admissions or a
  live waiting-list curve. Cumulative milestones must not be added.
- Last-called ranks: paired `lib_grp1`/`ran_grp1` through
  `lib_grp3`/`ran_grp3`. Each rank remains attached to its source group. Historical
  `rang_der_max` is labelled as a published maximum without a detailed group.
  No rank predicts future admission and ranks from different groups are not
  interchangeable.

Enriched history applies the existing formation+establishment identity rules
within one family. Changed descriptions remain explicit; ambiguous and missing
matches have no values. APB lacks a formation-level identifier in this source,
so its individual records do not receive invented longitudinal matches.
