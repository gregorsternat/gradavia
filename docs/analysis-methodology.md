# Analysis workbench

`/analyses` explores one immutable atlas release and admissions campaign. The
source family is explicit: Parcoursup admissions, apprenticeship, or APB. The
workbench never joins those populations or constructs a longitudinal cohort.
See the [data contract](data-contract.md) and [read API](api.md).

## Population and controls

Each point and table row is a source formation record. Source duplicates remain
distinct. Region, formation type and establishment status use exact published
labels. The region filter accepts multiple regions. Search folds accents and
ligatures and matches all words against formation, establishment and geography.
Optional inclusive bounds filter the selected indicator and exclude unavailable
values. All views, statistics, tables and exports use this same selected cohort.
Selecting a region, type or status in the matrix or concentration chart updates
the shared filter. Missing labels are shown explicitly and remain in totals.

Demographic shares describe the source's specified population: female admissions,
scholarship neo-baccalaureate admissions, baccalaureate groups or source-defined
local recruitment. They must not be compared as if their denominators were equal.
Definitions are shown with the source field beside the analysis.

## Calculations

- Counts are sums of observed values, accompanied by contributing and total row
  counts. No observations yield null; observed zeros stay zero. Candidature sums
  count formation candidatures, never unique people.
- Published percentages are summarized by an **unweighted median of formation
  records**. This is not an aggregate population percentage or an admission
  probability. Neither arithmetic means nor inferred weighted rates are used.
- Candidatures per place use the same rows for numerator and denominator. Only
  rows with observed applications and strictly positive observed capacity enter
  `sum(applications) / sum(capacity)`. A row with zero capacity has no ratio; a
  positive-capacity row with zero applications contributes an observed zero.
- Group shares divide observed additive group sums by the selected cohort's
  observed total. Missing sums remain null. A zero total has no defined share.
  Shares are unavailable for percentage medians or ratios.
- Quartiles use linear interpolation at `(n - 1) * p` on sorted observed values.
  Histograms use up to 12 equally wide bins. Their upper bound is excluded except
  in the last bin, which includes the maximum. A constant distribution has one
  bin. Every observed value appears exactly once.
- Descriptive outliers fall below `Q1 - 1.5 * IQR` or above `Q3 + 1.5 * IQR`.
  The workbench reports the fences and source records. These flags are not data
  errors, causal findings, formation quality or changes over time.
- Concentration reports the sum of the five largest observed additive groups as
  a share of the observed selected total. The chart shows the first 12 groups;
  its table and exports retain every group/record. Percentage summaries have no
  concentration share.

The quality view separately counts observed, missing, suppressed and invalid
states on the selected cohort. Filtering on a value can improve apparent
coverage by removing missing records; clearing the filters restores the source
coverage. Absence may mean a field is outside this source's scope.

## Representation and accessibility

Tremor source components render distributions, concentration and quality. The
full-snapshot scatter uses a canvas to keep up to 30,000 points interactive; it
uses zero-based linear axes with per-axis source maxima. Bubble radius is a fixed
minimum plus the square root of the normalized size indicator. Missing sizes use
the minimum radius and never remove otherwise valid points. No points are
sampled. The virtualized beUI table exposes every point, value state and record
link through keyboard controls. The heatmap is a beUI table with numeric values,
coverage and up to six columns per page; no categories are discarded.

This is a product-owned scatter/heatmap composition, not a copied Tremor scatter
component. Existing beUI controls, tables and reduced-motion-aware tabs are reused.
No new runtime dependency is required.

## Persistence, sharing and exports

URLs capture the immutable release ID, family, campaign, filters, axes, measure,
dimensions, annotation and display settings. Source or campaign changes start a
fresh analysis; they do not silently transfer version or population assumptions.
Links remain reproducible while the underlying immutable release is retained.

Up to 20 named views are saved under the versioned browser key
`gradavia.analyses.v1`. Contents are validated, bounded and synchronized between
tabs. Invalid or unavailable storage produces a visible notice. Failed writes
remain in the current tab; users can copy the full version-pinned URL. There is
no account or backend personal-profile store.

JSON exports contain every selected record, full source provenance, definitions,
value states, settings, methodology and selected coverage. CSV is semicolon
delimited and formula-safe: its first data row has `row_kind=metadata` and stores
the JSON metadata in `metadata_json`; subsequent `row_kind=record` rows contain
formation values and explicit per-field states. This preserves metadata even
for an empty cohort. CSV consumers should filter on `row_kind=record`.

Standalone SVG exports embed the same complete JSON metadata and selected raw
records. Scatter exports show all points. Distribution and quality exports show
all bins/indicators; group and matrix previews show up to 18 entries, explicitly
labelled, with the full data and settings embedded for reproduction. Annotations
and source strings are XML-escaped. The SVG is a static reusable export, not a
live embed or a promise of automatic refresh.

## Deliberate limits

No national rate is inferred from formation percentages. There is no individual
admission prediction, causal explanation, browser SQL, Parquet, PNG or hosted
embed. Those need separate source, execution or export contracts.
Local concentration does not measure education deserts or travel accessibility;
those require population and transport denominators absent from this source.

## Two-campaign evolution workspace

`/evolutions` loads two individually pinned atlas releases from the same source
family. It never joins APB and Parcoursup. Identity matching runs on the complete
snapshots on the server before any display filter can remove ambiguous rows.
Only nonempty, unique `(sourceFormationId, establishmentId)` pairs qualify.
Their title, establishment name, type, city, department, region, status and
selectivity must be exactly unchanged. Missing, repeated or changed identities
remain outside the followed cohort. This is a conservative source-record match,
not proof of unchanged curricula or admission rules.

The client receives compact matched rows and precomputed source-wide diagnostic
summaries, not two full raw snapshots. The positional count arrays are documented
by `valueKeys`; identifiers, labels and provenance remain available in the JSON
export. Region and type filters operate on the already-resolved matched cohort.

Only counts (capacity, applications, offers, admitted and source records) are
available. A pair contributes only when both observations are available for the
selected metric. Its before/after difference, percentage change and competition
ranks use this identical cohort. Equal values share the rank equal to one plus
the number of strictly greater observations. Ranks do not imply quality.

The base-100 index is `after / before * 100`; a zero baseline is undefined even
when both values are zero. Group indices use paired group sums, not averaged
formation indices. All small multiples share a zero origin and a common maximum.
They connect two observations only and never fill intermediate campaigns. The
two-frame playback is paused by default, opt-in, and disabled for reduced motion.

Source-wide diagnostics separate matched, description-changed, ambiguous,
source-entering, source-exiting and unidentified records. They report observed
sums and coverage independently for each snapshot. Empty groups contribute an
empty sum of zero, while a nonempty group without observed values remains null.
Differences reconcile when all group sums are observed. A matched group's raw
sum difference can include changes in metric availability; the main charts
remove those by requiring paired observations. Source entries and exits are not
assertions that a formation opened or closed.

Tukey fences also flag unusual **paired count differences** descriptively.
Definitions, campaign IDs, both immutable release IDs, compact paired values,
source-wide contributions and all analysis controls are exported together.
There is no automatic curriculum continuity claim or cross-system harmonization.

## Source-backed discovery quiz

`/decouvrir` computes up to three deterministic questions from one Parcoursup
release: the largest published formation-type share of source records, the
largest region's share of observed capacity, and the share of records with an
observed capacity. Questions require valid nonzero denominators; missing capacity
is not imputed. Questions whose leading group has an unknown label are omitted.
Observed capacity zeros count as published values for coverage.

Only the compact question values and source metadata are sent to the client.
The user estimates a percentage using a keyboard-accessible beUI slider; reveal
shows the calculated percentage, absolute estimation error in percentage points,
the denominator explanation, a Tremor chart and an accessible table. Each answer
links to its exact immutable analysis. No individual prediction, ranking or
invented trivia is generated. The quiz does not store responses or send them to
a backend.
