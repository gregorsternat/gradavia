# Persistent workspace tabs

## Objective

Keep each primary destination mounted while switching its tools. Load only the
requested panel initially, preserve local panel state, and retain shareable URLs,
server rendering, source semantics and historical links.

## Decisions

- Six workspaces retain their existing root paths. `onglet` selects a panel;
  `famille` selects the formations population. Legacy tools redirect permanently.
- Server rendering and a bounded same-origin read facade share feature loaders.
  The browser never addresses the private Rust API directly.
- Visited panels and their latest data remain in memory until leaving the space.
  The active URL is authoritative; inactive panels cannot navigate or read it.
- Formation readers stay distinct. Only compatible filters cross representations;
  view-specific filters remain available when returning.
- Preserve indexation per tool, native links, accessible keyboard activation,
  local-storage boundaries, immutable source identities and missing-value states.

## Implementation

1. Add the URL registry, bounded panel loaders and read facade.
2. Add a persistent client workspace and scoped panel navigation.
3. Convert entry routes, legacy redirects, metadata and internal links.
4. Validate URL/state/loading behavior, browser accessibility and SEO.
5. Run `just verify`, record evidence and move this plan to completed.

## Evidence and remaining work

Implementation in progress. No validation or deployment claimed yet.
