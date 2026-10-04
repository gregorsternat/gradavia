# External enrichment feasibility

Reviewed on 2026-10-05 (Asia/Shanghai). This is source and contract research,
not an import or a verified join. The current admissions identity is a retained
release and row, with a source formation identifier and establishment metadata.
An establishment match alone does not identify a diploma, campus or cohort.

## Sources and implementation boundaries

| Features                                   | Verified primary source and access                                                                                                                                                                                                                                                                                                                      | Useful grain and join                                                                                                                                                                                                                         | What remains before implementation                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5, 35: careers and course content          | Onisep [occupation descriptions](https://www.data.gouv.fr/datasets/ideo-fiches-metiers), [occupation reference](https://www.data.gouv.fr/datasets/ideo-metiers-onisep), and [higher-education offerings](https://www.data.gouv.fr/datasets/ideo-actions-de-formation-initiale-univers-enseignement-superieur), under ODbL; XML/ZIP and tabular exports. | Occupation identifiers/ROME, recommended minimum formations, interests, Onisep FOR/AF identifiers, establishment UAI, location, teaching elements, duration and tuition. An AF can have several teaching locations.                           | Add versioned adapters and a reviewed FOR/AF-to-Parcoursup correspondence. UAI is a candidate restriction, not a diploma match. Current offerings exclude apprenticeship since September 2022; the catalog flags a January 2026 schema change. Do not infer a career pathway from text similarity.                                                                   |
| 26: open days                              | [Service Public links to the Onisep event search](https://www.service-public.gouv.fr/particuliers/vosdroits/R72315); the [official Parcoursup calendar](https://www.parcoursup.gouv.fr/calendrier) points to event dates and reminders on formation cards.                                                                                              | Events need an establishment/campus identifier, event date, cancellation/update state and target campaign.                                                                                                                                    | A link to the official tool is immediately useful. No machine-readable event export or exact campus join was verified here. Retaining an old event as an upcoming appointment would be incorrect. A synchronized favorites calendar needs that event contract and refresh policy.                                                                                    |
| 7, 34: travel time and returning home      | [National transport data documentation](https://doc.transport.data.gouv.fr/) and [SNCF timetable resources](https://transport.data.gouv.fr/datasets/horaires-sncf). SNCF publishes GTFS/NeTEx and real-time feeds with ODbL plus specific conditions.                                                                                                   | Dated stop/trip/service data, not admissions rows. Join through verified campus coordinates and walking access to stops.                                                                                                                      | A timetable-aware routing engine, service-day choice, transfer/walking rules, local networks and coverage reporting are required. Distance divided by an assumed speed is not a public-transport duration. No fare contract was verified; user-entered return-trip costs remain honest budget assumptions.                                                           |
| 33: student services map                   | CNOUS [restaurants and cafés](https://www.data.gouv.fr/datasets/restaurants-brasseries-et-cafeterias-des-crous), with 26 regional XML resources, and [Île-de-France residences](https://www.data.gouv.fr/datasets/residences-universitaires-des-crous-en-ile-de-france), under Open Licence.                                                            | Facility identifiers and GPS points; residence attributes include accommodation types and advertised rents. This is a spatial overlay rather than a diploma join.                                                                             | A first bounded restaurant overlay is feasible after source retention, XML/coordinate validation and regional completeness checks. The residence resource checked is regional, so it cannot establish national housing coverage or live room availability.                                                                                                           |
| 38, 39: employment and salaries            | MESR [InserSup catalog](https://data.enseignementsup-recherche.gouv.fr/explore/dataset/fr-esr-insersup/) and its [live metadata API](https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/fr-esr-insersup), Open Licence v2.0. The API returned metadata and field definitions without authentication.                      | UAI/`etablissement`, SISE `diplome`, qualification type, graduating promotion, source, gender, nationality, completion and registration regime. Observations have 6/12/18/24/30-month denominators, employment measures and salary quartiles. | Import the revised July 2026 schema and preserve all population dimensions, source, threshold flags and pooled cohorts. A reviewed Parcoursup-to-SISE qualification mapping is absent. Salary is net monthly full-time equivalent, not a job offer or all graduates' income. A separate source-native explorer is feasible before per-formation attachment.          |
| 38: apprenticeship outcomes                | DEPP [InserJeunes CFA × detailed formation](https://data.education.gouv.fr/explore/dataset/fr-en-inserjeunes-cfa-formation_fine/) and [metadata API](https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-inserjeunes-cfa-formation_fine), Open Licence v2.0; metadata retrieved without authentication.                              | CFA UAI, apprenticeship formation code, diploma, duration and two-year cohorts; CAP through BTS. Further-study and employment rates use different populations.                                                                                | Map qualification codes and the actual teaching establishment; do not attach every CFA outcome to every Parcoursup offering. Keep the threshold of 20, cohort pooling and employment scope. Public-sector employment enters from the 2022–2023 pooled cohort; foreign and self-employed work are excluded. Latest cohorts do not yet have every observation horizon. |
| 40: graduation and real study duration     | MESR [licence progression and completion, session 2024](https://www.enseignementsup-recherche.gouv.fr/fr/parcours-et-reussite-en-licence-les-resultats-de-la-session-2024-100331), with downloadable national and establishment/discipline XLSX tables.                                                                                                 | Entry cohort, discipline and institution, with defined three/four-year outcomes. This is broader than an individual admissions offering.                                                                                                      | Retain the corrected November 2025 workbook and document its tables, denominators and institution history. No direct campus-level success mapping was established. Public file availability is verified; license terms for retained workbook redistribution still need recording.                                                                                    |
| 49: mobility flows                         | INSEE [2022 residence-to-study flows](https://www.insee.fr/fr/statistiques/8582969) and [individual-file documentation](https://www.insee.fr/fr/information/2383297), with public CSV/XLSX.                                                                                                                                                             | Residence and study commune/municipal arrondissement. The aggregate covers enrolled people aged two and over, not only higher-education students.                                                                                             | A student-only definition requires a suitable detailed-file filter, survey weights and privacy/precision rules. Harmonize geographic vintages and Paris/Lyon/Marseille aggregation. These are residence-to-study journeys, not necessarily movements from a parental home to a new student city. License metadata must be recorded before retention.                 |
| 51: areas with little accessible provision | INSEE [communal population by age](https://www.insee.fr/fr/statistiques/8581810) and [2022 population indicators](https://www.insee.fr/fr/statistiques/8581696), public CSV/XLSX, plus verified formation coordinates and a travel-time contract.                                                                                                       | Age-defined population at commune/arrondissement level; geography is versioned independently of the admission campaign.                                                                                                                       | Define the population, study areas and acceptable accessibility threshold first. Validate commune correspondence and coverage. A map of few offers alone cannot establish an education desert, especially across borders or without transport information.                                                                                                           |

## Budget source: useful, but not a generic student rent

The [official 2025 rent dataset](https://www.data.gouv.fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025)
is Open Licence v2.0 and supplies commune-level modeled asking rents including
charges for unfurnished reference properties. The T1/T2 reference is 37 m²;
coverage excludes Mayotte. The source requires attribution to ANIL estimates
using SeLoger and leboncoin data. Commune boundaries are those of January 2025.

An imported rent reference can initialize an editable scenario, but should retain
the property type, observation/estimation scale and uncertainty indicators.
Small-sample communes can inherit estimates from a wider group of communes.
These values are not actual student lease prices, furnished rents or housing
availability. A city-label join is insufficient: use a verified commune code.
The [ministry's usage guide](https://www.ecologie.gouv.fr/sites/default/files/documents/guide-dutilisation-des-donnees-carte-loyers.pdf)
also warns against treating these maps as a general rent time series. Manual
budget inputs are usable now; automatic city estimates require this separate
source contract.

## Calendar decision for the current date

The [official page](https://www.parcoursup.gouv.fr/calendrier) currently describes
the **2026** procedure: applications opened on January 19, the general wish
deadline was March 12, confirmation April 1, main admissions June 2–July 11,
and complementary admissions ended September 10. It also documents exceptions,
including the extended wish deadline in La Réunion and academy assistance into
mid-October. Most campaign milestones are already past on this review date.

The page links an [official 2026 ICS file](https://www.parcoursup.gouv.fr/sites/default/files/database/documents/2025-10/parcoursup-2026-ics-826.ics).
The link was verified, but direct download returned HTTP 403 in this environment;
its event contents were not validated. A source-dated **2026 archive/reference**
and a link to the current official calendar are safe limited additions. A 2027
personal deadline tracker is not justified by this evidence. Never extrapolate
dates by changing the year, and do not substitute a generic calendar for the
deadline attached to an individual admission offer.

## Reorientation and further study

Onisep's [reorientation guidance](https://www.onisep.fr/formation/apres-le-bac-les-etudes-superieures/reorientation-quel-scenario-pour-moi)
describes possible routes, while the [BUT overview](https://www.onisep.fr/formation/apres-le-bac-les-etudes-superieures/les-principales-filieres-d-etudes-superieures/les-but-bachelors-universitaires-de-technologie)
describes further-study options. They are useful linked reading for features 36
and 37. Eligibility, accepted credits, timing and selection still depend on the
receiving institution. No versioned, nationwide graph of guaranteed transitions
was verified. A contextual official-links panel is feasible now; claiming that
a particular saved formation grants access to a particular next program is not.

## Evidence limits and next bounded imports

Official metadata for InserSup and InserJeunes was read live, including schema
and license. Onisep's current data.gouv catalogs were readable, but direct
opendata.onisep.fr requests returned errors in this environment; payload export
and XML schema compatibility remain unverified. Catalog presence is not proof
that a source has been imported or matched.

The most direct next integrations are a retained CNOUS restaurant overlay and
a commune-coded rent-reference import. Occupation/course links require the
Onisep correspondence first; employment, salary and completion should initially
be explored at their published grain. Every import needs provenance, versioned
validation, missing-value handling, coverage reconciliation and review before
being attached to admissions records.
