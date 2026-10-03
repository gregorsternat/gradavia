# Product

Orvio helps students, families, educators, and journalists understand public
higher education admissions data. The first source is Parcoursup.

The interface is French, with a clean monochrome light/dark design. It should
make useful facts easy to compare and support expressive visual storytelling
without hiding definitions, missing data, or uncertainty. Public exploration
does not require an account.

## Current milestone

Collect and retain all 14 selected public APB/Parcoursup datasets through the
manual Rust CLI, with complete raw records in PostgreSQL and local source
archives. The web gallery still contains synthetic verification values.
Frontend data browsing and all derived indicators are deferred.

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
