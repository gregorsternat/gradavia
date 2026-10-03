# Source fixtures

The dataset directories contain two public export records and catalog metadata
per source, retrieved from the MESR/SIES Explore v2.1 API on 2026-10-03.
Each directory name is the official dataset identifier. These records are
published aggregates, not individual applicant records.

Source: https://data.enseignementsup-recherche.gouv.fr/

License: Licence Ouverte v2.0 (Etalab), as retained in every metadata fixture.
https://www.etalab.gouv.fr/licence-ouverte-open-licence/

Tests change counts and transport URLs in memory to serve these small samples
locally. Production schema contracts are in `../../sources/registry.json`.
Complete exports and method documents belong in ignored local archives.
