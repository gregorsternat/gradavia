# Design system

## Foundation

French product copy, monochrome light and dark themes, system preference by
default, and an explicit system/light/dark selector. System fonts keep the shell
independent of network font downloads.

Shared CSS tokens in `apps/web/src/app/globals.css` define background,
foreground, surface, muted text, borders, subtle backgrounds, and chart colors.
Tailwind's spacing scale and type utilities provide consistent layout. Prefer
generous whitespace, readable content widths, and clear headings over decoration.

- beUI supplies source-owned interaction primitives from its shadcn registry.
- Tremor Raw supplies source-owned charts compatible with Tailwind 4.
- Motion supplies interaction transitions with `MotionConfig reducedMotion="user"`.
- Dashboardcn can be considered when a concrete missing component warrants it.

Install only what is used. See [third-party sources](third-party.md).

## Accessibility

Use semantic elements, visible keyboard focus, explicit labels, and sufficient
contrast in both themes. Preserve the skip link and keyboard theme controls.
Reduced motion must leave every action usable.

Charts must state units, population, campaign, source, and definitions. Provide
an accessible table or equivalent text. Do not use color as the only distinction
between series. Never replace missing or suppressed values with zero.

## Development gallery

`/dev/ui` demonstrates the current button primitives, themes, and one chart.
Its six values are clearly labeled as synthetic. A visible table provides the
same values. The route returns 404 in production.

The gallery is a technical verification surface, not a preview of real
Parcoursup indicators. Playwright checks mobile/desktop, keyboard use, theme
persistence, accessibility rules, and the production restriction. Visual review
and real screen-reader testing remain separate from automated checks.
