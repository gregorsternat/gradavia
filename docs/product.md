# Product

Gradavia helps students, families, educators and journalists explore French public
higher-education admissions data. It is a public French-language application
with no account requirement, a restrained monochrome interface and useful
interactive visualizations. The source and meaning of every number matter more
than producing a ranking or predicting an individual's admission.

## Supported journeys

| Surface              | User job                                                                  | Scope                                                              |
| -------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Landing              | Discover Gradavia and start exploring without an account                  | `/`, with source-backed preview when data is available             |
| Overview             | Understand national offer and admission volumes, distribution and history | Published Parcoursup campaign, outside apprenticeship              |
| Formations           | Search, filter, sort, inspect, save and select records                    | Eight registered admissions sources, one campaign at a time        |
| Formation detail     | Read published metrics, profiles, definitions and qualified history       | One immutable formation/establishment/campaign source row          |
| Comparison           | See up to four formations together across exact metrics and profiles      | Same campaign required; different populations remain labelled      |
| Favorites            | Retain a shortlist and return to source records                           | Browser-local, no account, bounded to 100 selections               |
| Territories          | Compare regional formation, capacity, application and admission counts    | One campaign; missing values and coverage preserved                |
| Specialties          | Explore destinations for a general-baccalaureate specialty pair           | Reviewed 2025 national/group/formation scopes kept separate        |
| Sources              | Inspect imports, campaigns, freshness and definitions                     | All 14 registered source datasets, including separate APB archives |
| Map                  | Explore geography, interests, numeric criteria and a straight-line radius | One source/campaign, published coordinates only, synchronized list |
| Apprenticeship / APB | Explore independently defined populations                                 | Distinct adapters and explicit unavailable indicators              |
| Modalities           | Choose and compare two records from the same campaign                     | No inferred equivalence between curricula or procedures            |
| Preparation          | Organize named lists, notes, statuses and personal checklists             | Browser-local, deliberate annotation sharing, printable dossier    |
| Budget               | Compare user-entered cost scenarios over a study duration                 | No inferred rent, salary, scholarship or city-cost estimate        |
| Analysis workshop    | Build linked charts, cohorts, cross-tabs and exports                      | One retained snapshot with per-indicator missingness               |
| Evolutions           | Compare counts in two captured campaigns                                  | Unique unchanged source identities, paired coverage and exclusions |
| Discovery            | Estimate and reveal documented source proportions                         | Three deterministic questions, without response tracking           |
| Public datasets      | Download versioned CSV/JSON and reproduce calculations                    | Fixed public read contract and Python/R notebook downloads         |

The landing uses a compact header, direct search, feature entry points and
source/methodology questions. Its content works independently of API availability;
it never substitutes invented metrics. The existing overview lives at
`/observatoire`, including campaign links and command-palette navigation.

The application shell provides a responsive beUI navigation panel, a Cmd/Ctrl+K palette,
keyboard-accessible theme choices and a skip link. Mobile search defaults to
cards; desktop defaults to a table. Explicit view choice is retained in the URL.
Tables, chart details and CSV exports provide exact values alongside graphics.

## Formation search

Search ignores case and French accents and matches all entered words across
formation titles, establishments and locations. Filters cover formation type,
region, department, establishment status and selectivity when published. Sorting
supports source title, capacity, candidatures, accepted offers and official
access rate, with stable tie-breaking and unavailable metrics ordered last.
Pagination is fixed at 25 source records. The newest published campaign is the
default; URL state can be shared.

Changing campaign resets incompatible search/filter/page state. Applying filters
resets pagination. Unsupported historical filters are disabled and removed from
incoming queries with a notice. Unknown values produce a legitimate empty result.
Cities are unavailable before 2021, establishment status in 2018 and selectivity
before 2020. Historical source strings, including DUT/BUT, are not harmonized.

Formation links preserve the immutable release and row. Favorites keep those
identities, so a later import does not silently change the saved record. The
comparison selection rejects a fifth record and mixed campaigns with an
explanation. Local storage failure is explicit; transient memory still works.

## Data and UX principles

- A count of formation applications is not a count of unique applicants.
- Missing, suppressed and invalid values are distinct from an observed zero.
- Published rates retain source definitions and population denominators.
- Historical rates are not an individual's probability of admission.
- National changes also reflect coverage changes; individual history qualifies
  identity and label continuity and breaks lines for changed/ambiguous records.
- APB is archived separately and never stitched into a continuous Parcoursup line.
- Specialty groups overlap: national figures come from national source rows,
  not from adding groups or aggregation levels.
- The default view is useful without hover. Every graph has a table or equivalent
  labelled values; keyboard and reduced-motion users can complete each journey.
- Definitions are available at the relevant number or source disclosure; avoid
  repeated explanatory paragraphs, decorative filler and redundant separators.

No connection, no published campaign, no matching results and unavailable
individual records are distinct states. Product routes never show synthetic
fallbacks. The development gallery and test fixtures remain explicitly synthetic.

The [data contract](data-contract.md) governs statistical semantics and the
[quality log](quality.md) records observed verification. The
[coverage register](feature-coverage.md) evaluates each requested feature, while
[enrichment feasibility](enrichment-feasibility.md) records why external course,
career, transport and cost data require further integration. Hosting is already
live; monitoring, remote archival and refresh scheduling remain separate work.
Authentication and personal admission prediction are not features.
