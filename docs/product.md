# Product

Orvio helps students, families, educators, and journalists understand public
higher education admissions data. The first source is Parcoursup.

The interface is French, with a clean monochrome light/dark design. It should
make useful facts easy to compare and support expressive visual storytelling
without hiding definitions, missing data, or uncertainty. Public exploration
does not require an account.

## Current milestone

Browse formations in the published Parcoursup admissions campaigns through
`/formations`, using the 14-dataset raw collection already retained by the manual
Rust CLI. The explorer covers the eight admissions sources (currently 2018–2025),
one campaign at a time and excluding apprenticeship. A standalone Rust API owns
reads and source rules; Next.js renders the responses. This separation preserves
the same user-facing behavior.

Search ignores case and French accents and matches all entered words across
formation titles, establishments and locations. Filters cover formation type,
region, department, establishment status and selectivity when published. Results
show descriptive fields, source links and provenance, with 25 rows per page.
The newest available campaign is the default; URL state can be shared. Changing
campaign resets the search, filters and page. Submitting a new search or filters
resets the page; an out-of-range page resolves to the final available page.

Older labels are composed from published fields. Cities are not published before
2021, status is absent in 2018, and selectivity is absent before 2020. Unsupported
filters are disabled and incoming unsupported filters are removed with an
explanation. Unknown filter values produce no results. Source links can point to
current Parcoursup pages; they are not archived formation detail pages.

No connection, no published campaign and no matching result are distinct states.
The gallery and browser-test fixtures remain explicitly synthetic. Formation
detail pages, indicators and comparisons are the next product milestones.

## Suggested feature order

1. Collect the selected public datasets with provenance, raw retention,
   validation, replay without duplicates, and atomic publication. See [ingestion](ingestion.md).
2. Browse formations within one campaign, with useful filters and source links.
3. Show a formation detail page with indicator definitions and completeness.
4. Compare formations within compatible populations and campaigns.
5. Build editorial visualizations and longitudinal views after reviewing
   continuity, definitions, and source coverage.
6. Review APB methodology before longitudinal comparison; raw collection already
   retains it in a separate source namespace.

Each feature should include its data definition, user behavior, focused
verification, and known limits. Hosting is its own milestone and can proceed
alongside the first import.

## Product constraints

- A count of formation applications is not a count of unique applicants.
- Missing and suppressed values are never silently displayed as zero.
- Historical statistics are not an individual's probability of admission.
- Comparisons explain cohort, phase, campaign, denominator, and coverage changes.
- Charts expose values and source context without requiring color perception.

The [data contract](data-contract.md) is authoritative for statistical semantics.
