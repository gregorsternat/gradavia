# Third-party source components

## beUI

Source: [beUI](https://beui.dev/) and
[starc007/ui-components](https://github.com/starc007/ui-components).
License: [MIT](licenses/beui.txt).

The current live shadcn registry was inspected before installing only the
button component:

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

## Updating

Inspect upstream changes, preserve licenses, document local patches, and rerun
type checks, browser tests, and visual review. Do not overwrite these files
blindly with a registry update.
