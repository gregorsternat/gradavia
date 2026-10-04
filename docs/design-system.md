# Design system

## Visual foundation

Gradavia is a French-language data application with a restrained monochrome shell,
compact navigation, generous breathing room and clear numeric hierarchy. System
fonts keep the application independent of network font downloads. Light and dark
themes share semantic tokens; the default follows the system preference.

`apps/web/src/app/globals.css` defines background, foreground, surface, subtle
background, border, muted text and chart colors. Panels use quiet borders and
rounded corners; avoid stacked separators, decorative headings and repeated
explanatory copy. A page title describes the task. Definitions belong beside
metrics or in a disclosure, rather than in repeated introductory paragraphs.

The desktop sidebar collapses to icons. On mobile it becomes a focus-managed
sheet with an explicit close button. The Cmd/Ctrl+K palette, navigation and theme
selector use the same shared primitives. Formation search defaults to cards on
mobile and a table on desktop; an explicit URL view overrides that default.

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
