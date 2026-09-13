# Design system

The rules the components encode, and the reasoning behind the ones that are not
obvious from the code. Read this before adding a component or a colour.

## Principles

1. **The interface is neutral; colour belongs to data.** Buttons, links, focus
   rings and chrome use ink and line tokens. A saturated primary button would
   compete with the chart in every screenshot of the tool.
2. **Projection language sits with the figure.** The framing constraint is not
   a footer disclaimer. `Callout`, `StatTile` context lines and the
   `RulesStamp` exist so that qualifying text lives next to the number it
   qualifies.
3. **Every figure is traceable.** Rule parameters render with a `SourceLink`.
   Every view carries a `RulesStamp`. Nothing renders a rule value that did not
   come through `src/rules`.
4. **Every chart has a table.** `ChartFrame` renders the table for screen
   readers while the chart is showing, and as a visible view on request.
5. **Motion carries comparison, not decoration.** Short, interruptible,
   unidirectional. `MotionConfig reducedMotion="user"` is set at the root.

## Tokens

Defined in `src/index.css` as raw variables under `:root` and `.dark`, then
mapped into Tailwind with `@theme inline` so utilities resolve at runtime.

| Group | Utilities | Use |
|---|---|---|
| Surfaces | `bg-canvas` `bg-surface` `bg-surface-2` `bg-surface-3` `bg-surface-inverse` | Page, cards, insets, pressed states, primary button |
| Ink | `text-ink` `text-ink-muted` `text-ink-subtle` `text-ink-inverse` | Primary, secondary, caption/tick text |
| Lines | `border-line` `border-line-strong` | Dividers; input and raised-card borders |
| Accent | `text-accent` `bg-accent-soft` `outline-focus` | Links, info callouts, focus ring |
| Status | `good` `warning` `serious` `critical` and `*-ink` | State only. Always with a glyph or label |
| Series | `oa` `sa` `ma` `ra` `accrued` and `*-soft` | Data only |

In SVG and Recharts props, use the raw variables (`var(--series-oa)`) via
`src/theme/series.ts` — never a hex value, never an index into an array.

## Data colour

The five series hues are categorical slots 1, 2, 3, 7 and 8 of the reference
data-viz palette, in that order, validated as a set against both surfaces with
the palette validator (adjacent pairs, which is the correct pairlist for line
and stacked-area charts).

| Series | Slot | Light | Dark |
|---|---|---|---|
| Ordinary Account | 1 blue | `#2a78d6` | `#3987e5` |
| Special Account | 2 orange | `#eb6834` | `#d95926` |
| MediSave Account | 3 aqua | `#1baf7a` | `#199e70` |
| Retirement Account | 7 violet | `#4a3aa7` | `#9085e9` |
| Accrued interest | 8 red | `#e34948` | `#e66767` |

Validator result (September 2026):

- **Light:** all checks pass. Worst adjacent CVD ΔE 9.2 (aqua ↔ orange,
  deuteranopia); worst normal-vision ΔE 27.6. Contrast **warn** on aqua
  (2.74:1) — relief is the table view and the legend, both always present.
- **Dark:** all checks pass. Worst adjacent CVD ΔE 9.4; worst normal-vision
  ΔE 22.5; every hue ≥ 3:1 on the dark surface.

An earlier candidate using slot 4 (yellow) for the Retirement Account failed
the dark-mode normal-vision floor against accrued-interest red (ΔE 13.0), which
is why the Retirement Account is violet.

The Special and Retirement accounts never appear at the same age — SA closes as
RA opens — so their adjacency in the draw order never puts both on screen.

**Changing a series colour means re-running the validator for both modes and
updating this table.**

## Accessibility contract

- WCAG 2.2 AA. One focus treatment (`:focus-visible`, 2px `--focus`), never
  removed.
- Controls: real `button`, `input`, `select`. Radio groups and tabs implement
  roving tabindex with arrow, Home and End keys.
- Every form control goes through `Field`, which owns the label, hint and error
  ids and the `aria-describedby` chain.
- Tooltips meet 1.4.13: dismissible with Escape, hoverable, persistent. They hold
  supplementary explanation only.
- Icon-only buttons require a `label` prop; it is not optional in the type.
- Abbreviated figures (`$1.2M`) carry their full value in `aria-label`.
- Scrollable tables are focusable, labelled regions.
- Status is never colour alone: `Badge` and `Callout` render a glyph.

## Responsiveness

Designed at 360px first. The header moves the rules stamp to its own row below
`md` rather than hiding it. Tables scroll horizontally inside their own
container with a sticky first column; the page body never scrolls sideways.

## Component inventory

| Component | File | Notes |
|---|---|---|
| `Button`, `IconButton` | `ui/Button.tsx` | primary / secondary / ghost / link |
| `Field`, `useFieldControl` | `ui/Field.tsx` | Label, hint, error wiring |
| `TextInput`, `NumericInput`, `MoneyInput`, `PercentInput` | `ui/Input.tsx` | Format on blur, clamp on blur |
| `Select` | `ui/Select.tsx` | Native select |
| `SegmentedControl` | `ui/SegmentedControl.tsx` | Radio group with sliding indicator |
| `Slider` | `ui/Slider.tsx` | Native range; basis for the timeline scrub |
| `Switch`, `Checkbox` | `ui/Toggle.tsx` | |
| `Card`, `CardHeader`, `CardBody`, `CardFooter`, `Section`, `Divider` | `ui/Card.tsx` | |
| `Badge`, `Swatch` | `ui/Badge.tsx` | |
| `Callout` | `ui/Callout.tsx` | note / info / caution / critical |
| `Tooltip`, `InfoTip` | `ui/Tooltip.tsx` | |
| `Disclosure` | `ui/Disclosure.tsx` | For derivations, not for hiding assumptions |
| `Tabs`, `TabList`, `Tab`, `TabPanel` | `ui/Tabs.tsx` | |
| `Table`, `THead`, `TBody`, `TFoot`, `Tr`, `Th`, `Td` | `ui/Table.tsx` | |
| `Money`, `MoneyDelta`, `Percent` | `ui/Value.tsx` | All figures render through these |
| `StatTile` | `ui/StatTile.tsx` | Headline numbers |
| `SourceLink` | `ui/SourceLink.tsx` | Per-figure attribution |
| `VisuallyHidden`, `LiveRegion`, `Skeleton`, `DefinitionList`, `Kbd` | `ui/Misc.tsx` | |
| `ChartFrame` | `chart/ChartFrame.tsx` | Title, summary, legend, chart/table views |
| `Legend`, `ChartTooltip`, `ChartTextures`, chart theme | `chart/` | |
| `AppShell`, `Container` | `layout/AppShell.tsx` | Skip link, header, footer |
| `RulesStamp`, `ThemeToggle` | `layout/` | |
