# Product

Orvio helps students, families, educators, and journalists understand public
higher education admissions data. The first source is Parcoursup.

The interface is French, with a clean monochrome light/dark design. It should
make useful facts easy to compare and support expressive visual storytelling
without hiding definitions, missing data, or uncertainty. Public exploration
does not require an account.

## Current milestone

Ship an executable repository with a web shell, UI gallery, Rust CLI, database
tooling, tests, CI, and navigable documentation. The gallery contains synthetic
values for technical verification. It makes no claim about admissions.

## Suggested feature order

1. Import one pinned Parcoursup release with provenance, raw retention,
   validation, replay without duplicates, and atomic publication.
2. Browse formations within one campaign, with useful filters and source links.
3. Show a formation detail page with indicator definitions and completeness.
4. Compare formations within compatible populations and campaigns.
5. Build editorial visualizations and longitudinal views after reviewing
   continuity, definitions, and source coverage.
6. Evaluate APB as a separate source adapter and methodology project.

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
