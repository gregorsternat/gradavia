# Design system

## Visual foundation

Gradavia is a French-language data application with a restrained monochrome shell,
compact navigation, generous breathing room and clear numeric hierarchy. System
fonts keep the application independent of network font downloads. Light and dark
themes share semantic tokens; the default follows the system preference.

The brand mark is a filled G with a rounded left side and a stepped inner return,
drawn in a 24×24 viewBox. The shared `LogoMark` component supplies the wordmark,
collapsed navigation and social preview. The favicon carries the same path with
system-aware light/dark colors; keep its geometry synchronized with the component.
Interface marks inherit the foreground color. The visible name and home-link
accessible label identify the brand, so adjacent SVG marks remain decorative.

`apps/web/src/app/globals.css` defines background, foreground, surface, subtle
background, border, muted text and chart colors. Panels use quiet borders and
rounded corners; avoid stacked separators, decorative headings and repeated
explanatory copy. A page title describes the task. Definitions belong beside
metrics or in a disclosure, rather than in repeated introductory paragraphs.

The desktop sidebar collapses to icons. On mobile it becomes a focus-managed
sheet with an explicit close button. The Cmd/Ctrl+K palette, navigation and theme
selector use the same shared primitives. Formation search defaults to cards on
mobile and a table on desktop; an explicit URL view overrides that default.

A monochrome GitHub icon links to the project repository beside the appearance
selector in the homepage footer and application sidebar footer. It stays available
when the desktop sidebar collapses and inside the mobile navigation. Its accessible
name and native tooltip identify the source code and announce a new tab.

Primary navigation exposes Formations, Spécialités du bac, Comparer, Mon projet
and Observatoire; Données & méthode remains in the footer. The palette indexes
every existing tool under these same groups. Each group uses persistent tabs;
Mon projet starts with Favoris alongside Budget. Observatoire exposes its five
tools as a scrollable tab row. Tabs have native shareable destinations, manual
keyboard activation (arrows/Home/End focus, Enter/Space activate), and stable
panel containers. Only the visible panel participates in keyboard navigation.
The workspace owns one main landmark; embedded tools use uniquely named sections.

Formation search has an explicit scope selector (hors apprentissage or
apprentissage) and List/Map representation tabs. The existing table/cards
format choice remains within the regular list. Compatible filters cross the
regular list/map boundary; view-only constraints are retained separately and a notice explains that they
are inactive in the other view, including the retained-release difference. A scope change
keeps only the search text and chooses that source's latest campaign. APB is an
explicit methodology destination, not an equivalent admissions scope. The atlas
retains geographic filters in apprenticeship list mode but does not apply the
transient visible-map-bounds filter while the map is hidden.

The homepage uses the same tokens and wordmark in an independent layout with a
compact sticky header, a large two-line heading, a source-backed product preview
and widely spaced sections. Borders group actual surfaces rather than divide
every section. Native search forms and direct links make the page useful without
JavaScript; charts and theme controls enhance it after hydration. Motion entrances
progress from the two hero lines to its copy/actions, then reveal individual
sections and cards as they enter the viewport. Fade-and-rise transitions run once
for 800ms with short, local stagger delays; returning to a section does not hide
it again. Server-rendered content stays visible until hydration enables motion.
Keyboard focus and reduced motion show content immediately without a delay.
The application sidebar begins at `/observatoire` and the other product routes.

The landing has four chapters: introduction, source-backed preview, exploration
and methodology. Search and the four exploration routes share one chapter; the
final call to action is a compact panel below the methodology and questions.
The final chapter shares its screen with the page footer. Each chapter fills at
least the current viewport below the sticky header, with vertically centered
content. Taller chapters grow naturally on small screens,
after zooming or when disclosures open; they never clip content or introduce a
nested scrollbar. Native vertical scroll snapping settles on section boundaries,
and fragment links glide to their target below the header. Reduced motion disables
both smooth scrolling and snapping. These scroll styles apply only while the
landing is present, including when navigating between routes without a reload.

## Components and animation

- beUI is the default for every interactive primitive: buttons, inputs, select,
  combobox, tabs, radio controls, tooltip, accordion, table, command palette,
  sidebar, loaders and animated numbers. Components are installed as owned source.
- Tremor Raw supplies area, line, bar and donut charts. Monochrome series use the
  `charcoal`, `silver`, `mist`, `steel` and `pale` tokens. Exact values and labels
  carry meaning independently of the shade.
- Motion supplies component transitions, shared selection backgrounds, number
  changes and short content reveals. `MotionConfig reducedMotion="user"` governs
  movement; loading and every action remain understandable without animation.
- Product-specific compositions reuse these primitives and Tailwind spacing and
  typography. Do not add another design system or install unused blocks.

Source files, licenses, upstream revisions and local compatibility/accessibility
changes are recorded in [third-party sources](third-party.md). Local fixes include
Recharts 3 event payloads and keys, select listbox semantics, tab and radio roving
focus, command focus restoration and French decimal formatting.

## Charts and data

Use a chart to answer a concrete question: time series for offer/admission
history, ranked bars for regional or specialty destinations, a donut for a small
composition, and a histogram for the official access-rate distribution. Keep
baselines honest and null gaps visible. Do not interpolate unavailable records.

Charts state units, population, campaign and source. History explicitly qualifies
coverage and formation continuity. Every chart has an accessible table or
labelled value equivalent. Clickable chart destinations also have visible links.
Never represent missing, suppressed or invalid observations as zero; partial
aggregates show coverage. Specialty groups overlap and cannot be stacked into a
national total.

The atlas uses one quiet map surface next to a matching result list; exact numeric
inputs supplement proximity and priority sliders. Coordinate coverage remains
visible. Browser map controls and list links offer equivalent navigation without
requiring pointer selection. Analysis places one selected visualization above its
record table, with cohort controls shared across views. A Canvas scatter retains
all source observations without creating thousands of DOM nodes; Tremor remains
the default for supported chart types. Exports retain source and campaign context.
Selection notes and optional sharing live behind explicit actions. No decoration
or automatic motion communicates a statistical finding.

## Accessibility and states

Use semantic elements, labelled controls, visible keyboard focus and sufficient
contrast in both themes. Preserve the skip link, focus restoration for overlays,
arrow/Home/End navigation for composite controls, Escape dismissal and keyboard
activation. Respect reduced motion. Check narrow screens for page overflow,
truncated action names and unusable tables, including after real data loads.

Loading skeletons preserve the page structure. No configuration, no published
data, unavailable service, no search matches, invalid selection and missing
formation are distinct states. Recovery actions preserve useful URL context.
No production route substitutes synthetic data when the service is unavailable.

`/dev/ui` remains a technical component gallery with clearly labelled synthetic
values and a table equivalent. It returns 404 in production. Real product
screens, both themes, desktop/mobile and keyboard workflows are reviewed
separately. Automated accessibility checks do not replace screen-reader testing.
