# Third-party source components

## beUI

Source: [beUI](https://beui.dev/) and
[starc007/ui-components](https://github.com/starc007/ui-components).
License: [MIT](licenses/beui.txt).

### Expanded exploration (2026-10-05)

The live registry and `range-slider-inline` item were read from
[beUI](https://beui.dev/r/range-slider-inline.json). The complete
`components/motion/range-slider-inline.tsx` and `lib/hooks/use-slider.ts` files
were installed; existing ease, touch and utility helpers were preserved.
Local changes add strict indexed-access guards, replace `findLast` with an
ES2022-compatible reverse/find and apply repository formatting. The source's
keyboard, pointer and reduced-motion behavior is retained.

Leaflet 1.9.4 ([BSD-2-Clause](https://github.com/Leaflet/Leaflet/blob/v1.9.4/LICENSE))
provides the interactive geographic map. It is imported only in the browser,
uses canvas for source points and keeps an equivalent accessible result list.
OpenStreetMap tiles retain visible [attribution](https://www.openstreetmap.org/copyright)
and ordinary browser caching, with no prefetch/bulk download/offline tile cache.
The source records and test assertions never depend on the tile service; browser
tests replace only the basemap images with a local one-pixel response.

The live shadcn registry was inspected before installing the initial button
component:

```sh
pnpm dlx shadcn@4.21.1 view @beui/button-base
pnpm dlx shadcn@4.21.1 add @beui/button-base --yes
```

Commands ran inside `apps/web`, using the registry in `components.json`.
Installed files: `components/motion/button/base.tsx`, `lib/ease.ts`,
`lib/hooks/use-hover-capable.ts`, and `lib/utils.ts`.

Local integration: shared theme tokens, formatting, Motion reduced-motion
provider. Explicit focus indices and a stable ripple wrapper prevent server/client
markup differences when reduced motion is enabled. Disabled buttons do not
animate on press. No separate beUI runtime package.

### Observatory expansion (2026-10-04)

The public MCP `list_components` catalogue and `get_component` source responses
for the sidebar and command palette were inspected. The install slugs were
checked against [the live registry](https://beui.dev/r/registry.json). Complete
source files and their bundled helpers were then copied from the public
`https://beui.dev/r/<slug>.json` endpoints into `apps/web/src`, preserving the
existing button, ease constants, hover hook and class-name helper.

| Registry item      | Local entry point under `apps/web/src`   |
| ------------------ | ---------------------------------------- |
| `animated-sidebar` | `components/motion/animated-sidebar.tsx` |
| `command-palette`  | `components/motion/command-palette.tsx`  |
| `combobox`         | `components/motion/combobox.tsx`         |
| `input`            | `components/motion/input.tsx`            |
| `select`           | `components/motion/select.tsx`           |
| `tabs`             | `components/motion/tabs.tsx`             |
| `tooltip`          | `components/motion/tooltip.tsx`          |
| `number-ticker`    | `components/motion/number-ticker.tsx`    |
| `bouncy-accordion` | `components/motion/bouncy-accordion.tsx` |
| `table`            | `components/motion/table/index.tsx`      |
| `checkbox`         | `components/motion/checkbox.tsx`         |
| `radio`            | `components/motion/radio.tsx`            |

The sidebar's `shared-layout-bg` and the tooltip/table subcomponents remain
source-owned. Helpers include command search, pointer gestures, touch handling,
row cursor management and presence gates. The table adds the exact
`@tanstack/react-virtual` dependency; the tooltip adds `@floating-ui/dom`.
Motion, Lucide, clsx and tailwind-merge were already installed. Versions are
pinned in `apps/web/package.json` and `pnpm-lock.yaml`.

Local integration patches:

- Strict indexed-access guards cover empty virtual rows, column snapshots,
  keyboard cursors and sidebar focus boundaries.
  Mobile sidebar focus boundaries include only visible, non-inert tab stops,
  so inactive theme radios cannot let Tab escape the dialog.
  Its deferred initial focus respects focus already moved inside the panel.
  The trigger stays disabled until hydration; activation reads the current
  viewport so an early mobile click cannot toggle the server's desktop state.
  A production probe at `a9dd950` subsequently observed an initial `focus()`
  call on a connected, non-inert dialog while its computed CSS visibility was
  still hidden. Focus stayed on the trigger and was not attempted again when
  the dialog became visible; Escape worked after focus was placed inside it.
  Initial focus now waits for the panel to have a rendered box and visible CSS.
  The pending frame is cancelled on close/unmount and respects a control already
  focused inside the panel, without a fixed delay. Causal traces and regression
  evidence are recorded in [quality](quality.md).
- A local `useClientReady` external-store snapshot keeps DOM portal markup out
  of server rendering and initial hydration. Number ticker arming derives from
  the existing one-shot intersection state. Existing helpers are not replaced.
- The local reduced-motion hook uses an external-store snapshot to keep initial
  HTML identical on server and client, then observes preference changes. This
  prevents Motion's gesture-generated tab stops and conditional variants from
  producing hydration errors when the OS requests reduced motion. Sidebar links
  also declare their native tab stops explicitly.
- Combobox sources support the specialties selector with an accent-folding
  search filter, labelled input and a bounded portal list. Strict cursor guards,
  direct ref aliases, derived placement and the existing client-ready snapshot
  preserve the upstream keyboard/pointer model under React lint rules.
  The input stays disabled during server rendering and initial hydration so
  early text entry cannot race the selected-label registration or query handlers.
  The atlas supplies a literal, accent-insensitive city/department filter so
  scattered letters in unrelated city labels do not match the typed place.
- Selects support labelled triggers, Arrow/Home/End navigation, selected-option
  focus, bounded scrollable option lists, and Escape/selection focus restoration.
  Radio groups and tabs have
  roving keyboard focus; tabs identify their associated panels. Radio items offer
  an optional segment presentation for the theme and metric selectors, retaining
  the source component's shared indicator and keyboard model. Number ticker
  precision is explicit for fractional published rates.
  Tab panels can omit inactive viewport-dependent children while retaining their
  semantic panel IDs, avoiding zero-size measurements from hidden charts.
  Their text remains opaque during entrance motion. Disabled tabs expose native
  disabled semantics and are excluded from keyboard navigation.
  Tab triggers use the existing client-ready guard to remain disabled during
  server rendering and initial hydration. This prevents the first pointer
  activation from racing the tab list's initial overflow measurement and
  selected-tab reveal. A delayed-JavaScript browser regression covers that
  first activation; verification status is recorded in [quality](quality.md).
  Input placeholders use the full muted text token to remain readable in both
  themes instead of attenuating it to 60% opacity.
- The command palette restores the opener's focus and contains Tab navigation;
  its default product labels are French. Navigation, checkbox, table and tabs'
  accessibility labels are French.
  Opening the palette by button or shortcut closes the mobile navigation first.
- Virtual tables expose their accessible name, total row count and row indices,
  and their scroll region is keyboard focusable. TanStack Virtual explicitly
  opts out of React Compiler memoization at its call site.
- Accordion controlled `null` values stay collapsed; its group corners are
  reduced to 14px. Tooltip ref aliases preserve the upstream positioning model
  under the React lint rules, and stale asynchronous placement results remain
  invalidated during cleanup.
  Portalled tooltips retain their trigger description and expose a named
  complementary landmark around the surface, keeping visible overlay content
  reachable through landmark navigation.
- Formatting follows the repository. Shared semantic colors inherit Gradavia's
  theme. Components retain their upstream reduced-motion handling.

### Global page states (2026-10-04)

The live `not-found-glitch`, `not-found-magnetic`, `not-found-spotlight`,
`not-found-stacked` and `not-found-terminal` registry items were inspected.
Only `not-found-magnetic` and `loader` were installed, with their bundled
helpers. The magnetic variant keeps the page monochrome and has no continuous
animation. Its pointer strength is reduced, the decorative code is hidden from
assistive technology, the French title is the sole `h1`, and its navigation
uses the already-patched beUI ButtonLink. Optional empty description copy is
omitted. Loading pages use the spinner at 14px with French status labels and
retain inert visual placeholders. Loading boundaries are attached to data routes
instead of the root layout so the production gallery returns an HTTP 404 before
any streaming fallback. The Loader's morph sequence has a strict
indexed-access fallback and derives its reduced-motion text without effect-state
updates; unused variants remain in the single upstream source
file rather than adding separate components.

## Tremor Raw

Source: [tremorlabs/tremor](https://github.com/tremorlabs/tremor).
Documentation: [Tailwind 4 installation](https://www.tremor.so/docs/getting-started/installation).
License: [Apache-2.0](../apps/web/src/components/charts/tremor/LICENSE), including
the upstream notices for separately licensed subcomponents.

The LineChart v1.0.0 and its local helpers were copied from these Git blobs into
`apps/web/src/components/charts/tremor`:

| Source                | Blob                                       |
| --------------------- | ------------------------------------------ |
| LineChart             | `6165d30d4ec48180c46d6bff004f641f0a0697cc` |
| useOnWindowResize     | `dba330369fb053816dc4cb84138d207a6204b0b9` |
| chartColors           | `c8b0e911d32779698a1de8c86260f0e6b0773a48` |
| cx                    | `215d9f5f4854bac0efdb8e8e90b0f6a6bd3ce35b` |
| getYAxisDomain        | `0b25c0a46df9d1486a96b055564ff8dc0bbbc3f3` |
| hasOnlyOneValueForKey | `a60a92752c428c1f639e76ef9cfea913ea45329f` |
| LICENSE               | `72bd6f8e43508d4c324a29063b9b0ef3f70133cd` |

Local changes: formatting and scroll-button interval cleanup compatible with
React's effect lint rule. The interval respects the disabled state and releases
on mouse leave/blur. Empty data/palette guards satisfy strict indexed access;
tooltip labels normalize Recharts 3's string/number/undefined union. The gallery
uses one monochrome series, disables interactive
legend/tooltips, and exposes an accessible data table. Its scoped CSS maps axis
text and grid strokes to theme tokens, including Recharts 3 tick text.

### Additional charts (2026-10-04)

AreaChart, BarChart and DonutChart v1.0.0 were copied from the official repository
at commit `ca4d588f47820ff3d514d37fa4ee08a4222dec11`, sharing the retained Tremor
helpers and Apache-2.0 license.

| Source     | Blob                                       |
| ---------- | ------------------------------------------ |
| AreaChart  | `b5e82207968211b8425038b1cca5beedaf99e90a` |
| BarChart   | `c0967d2d2c452cc8fe76338fb5845534b1e73dcf` |
| DonutChart | `4ef0d347f73acb6290cb83a775ebb78c0af62827` |

Local changes apply the existing LineChart legend-scroll cleanup to AreaChart
and BarChart, guard empty arrays and palettes, give AreaChart gradient/area/
interaction nodes distinct React keys (also for LineChart interaction lines),
and normalize Recharts 3 tooltip
labels. Bar click events receive their category from the series closure because
Recharts 3 no longer supplies `tooltipPayload` on each bar. DonutChart uses
Recharts 3's `shape` callback to preserve selected-sector
opacity instead of the removed `activeIndex` prop. The shared palette includes
`charcoal`, `silver`, `steel`, `mist` and `pale` for theme-aware monochrome composition. No Tremor
runtime package or separately licensed premium blocks are used. The analysis
workbench fixes BarChart legend list semantics: its scrolling `<ol>` directly
owns `<li>` entries inside a separate layout container. Desktop/mobile axe checks
cover the multi-series legend.
BarChart axis labels carry a local `gradavia-axis-label` class so scoped theme
styles preserve readable contrast in both themes; current Recharts no longer
adds its former label class when a custom class is supplied.
All four chart tooltips use semantic surface, border, foreground and muted text
tokens. This prevents the scoped gray palette's surface override from also
coloring dark-mode tooltip titles and values with their background color.

## Landing page reuse (2026-10-05)

The landing composes existing beUI buttons, input, accordion, radio controls,
tooltips and loader with the existing Tremor AreaChart.
No additional registry source, asset, dependency or license was introduced.
The homepage's layout, source-backed preview and Motion reveals are local
feature compositions; upstream primitive implementations are unchanged.

## Updating

Inspect upstream changes, preserve licenses, document local patches, and rerun
type checks, browser tests, and visual review. Do not overwrite these files
blindly with a registry update.
