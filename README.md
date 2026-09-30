# CPF Projection Tool

A browser-based tool that projects how Singapore CPF balances evolve over a
working lifetime, and shows what a housing decision costs in retirement terms.

Illustrative projections only. Not financial advice.

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Recharts. No backend;
all computation runs client-side.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Type-check and production build |
| `npm run preview` | Serve the production build |
| `npm test` | Run the test suite once |
| `npm run typecheck` | Type-check only |

## Layout

```
src/
  index.css            Design tokens (light + dark) and base styles
  theme/               ThemeProvider, motion tokens, data-series registry
  rules/               Dated CPF rule sets, source registry, effective-date resolver
  engine/              Pure projection engine: monthly loop, contributions, allocation, interest
    __fixtures__/      CPF Board worked examples and derived fixtures the engine is tested against
  lib/                 Formatting and small utilities
  components/
    ui/                Shared primitives (inputs, cards, tables, tooltips, stat tiles…)
    chart/             ChartFrame, legend, tooltip, textures, Recharts styling
    layout/            AppShell, header/footer, rules-as-at stamp, theme toggle
  pages/
    DesignSystemPage   Live preview of every component (placeholder data)
docs/
  design-system.md     Token, colour, accessibility and component reference
```

## Status

- Design system and app shell: in place.
- Rule set for 1 January 2026: every figure verified against CPF Board sources
  on 14 September 2026, with contribution rates for every age band read on
  19 September 2026. Escalation of the Basic Healthcare Sum and retirement sums
  is not yet encoded.
- Projection engine (`src/engine`): a pure, monthly-step loop from the current
  age to the end age, resolving the rule set per month.
  - Done: contributions with the wage ceilings and Annual Limit; allocation
    across accounts by age band; base interest by account.
  - Not yet: extra interest, the Basic Healthcare Sum cap, housing, and the
    age-55 transition. Their parts of each month's record are zero until then.
- Projection page: not started. The app still renders the design system preview.

## Engine conventions

Money is in whole cents. Every rate and threshold is read from the dated rule
set in force for the month being computed; nothing in `src/engine` reads the
clock.

| Rule | How the engine applies it |
|---|---|
| Age bands | A new band's contribution rates and allocation ratios apply from the month after the birthday month. |
| Contributions | Total rounded to the nearest dollar (50 cents up), employee share down to the dollar, employer pays the difference. |
| Allocation | MediSave first, then Special (Retirement from 55, up to the FRS), remainder to Ordinary. Shares rounded to the nearest cent, half up (provisional: no published rule). |
| Base interest | Computed monthly on the month's opening balance less that month's withdrawals, so money received earns from the next month. Credited at the end of December and compounded annually. Kept exact through the year and rounded to the cent once, on crediting (provisional: no published rule). A year the projection ends partway through is not credited. |

Source for the interest convention: CPF Board, [How is my CPF interest computed
and credited into my accounts?](https://www.cpf.gov.sg/service/article/how-is-my-cpf-interest-computed-and-credited-into-my-accounts)
