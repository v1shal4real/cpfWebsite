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
  19 September 2026. Retirement sums and the Basic Healthcare Sum are carried
  past their last published year by stated escalation assumptions (see below).
- Projection engine (`src/engine`): a pure, monthly-step loop from the current
  age to the end age, resolving the rule set per month.
  - Done: contributions with the wage ceilings and Annual Limit; allocation
    across accounts by age band; base interest by account; extra interest with
    the $20,000 Ordinary Account sub-cap; the Basic Healthcare Sum cap with
    MediSave overflow routing; the age-55 transition.
  - Not yet: housing. Its part of each month's record is absent until then.
- Projection page: not started. The app still renders the design system preview.

## Engine conventions

Money is in whole cents. Every rate and threshold is read from the dated rule
set in force for the month being computed; nothing in `src/engine` reads the
clock.

| Rule | How the engine applies it |
|---|---|
| Age bands | A new band's contribution rates and allocation ratios apply from the month after the birthday month. |
| Contributions | Total rounded to the nearest dollar (50 cents up), employee share down to the dollar, employer pays the difference. |
| Allocation | MediSave first, then Special (Retirement from 55, up to the cohort FRS), remainder to Ordinary. Shares rounded to the nearest cent, half up (provisional: no published rule). |
| Base interest | Computed monthly on the month's opening balance less that month's withdrawals, so money received earns from the next month. Credited at the end of December and compounded annually. Kept exact through the year and rounded to the cent once, on crediting (provisional: no published rule). A year the projection ends partway through is not credited. |
| Extra interest | Below 55: 1% on the first $60,000 of combined balances. From 55 (from the month after the 55th birthday month, as with the bands): 2% on the first $30,000 and 1% on the next $30,000. Accounts fill the tiers in the published order: RA, then OA up to $20,000, then SA, then MA; each earns on the part of itself counted. Extra interest on OA is credited to SA below 55 and to RA from 55, never to OA. Computed monthly on the same balances as base interest and credited with it in December. |
| Basic Healthcare Sum | MediSave is held to the BHS for the year (from the escalation series) until the member turns 65, then to the BHS in force in the year they turned 65. Applied at the end of each month, after contributions and any December interest credit, so MediSave never closes a month above the cap. The excess goes to SA below 55, or RA from 55 (the month after the 55th birthday month), until that account holds the FRS, then to OA. Below 55 that is the FRS in force that year; from 55, the member's cohort FRS. A "BHS reached" event is recorded the first month MediSave reaches the cap. |
| Age-55 transition | Runs once, at the end of the month the member turns 55, after that month's contribution, interest credit and MediSave cap. In order: (1) the RA is created; (2) SA savings move into it up to the cohort FRS; (3) OA savings top it up, keeping back the $5,000 a member short of the FRS may withdraw; (4) the SA closes and any remainder goes to OA; (5) the withdrawable amount is reported (all of OA with the FRS set aside, otherwise up to $5,000) and left in OA, never withdrawn; (6) the from-55 contribution rates, allocation ratios and extra-interest tiers apply from the following month. Interest the SA earned before closing is credited in December and moved on the same way. |

Sources for the interest conventions: CPF Board, [How is my CPF interest computed
and credited into my accounts?](https://www.cpf.gov.sg/service/article/how-is-my-cpf-interest-computed-and-credited-into-my-accounts)
and [How much extra interest can I earn on my CPF savings?](https://www.cpf.gov.sg/service/article/how-much-extra-interest-can-i-earn-on-my-cpf-savings).
Source for the MediSave overflow: CPF Board, [After I have met the Basic
Healthcare Sum, why do the excess MediSave Account savings overflow to my
Special Account or Retirement Account instead of my Ordinary Account?](https://www.cpf.gov.sg/member/infohub/cpf-clarifies/policy-faqs/after-i-have-met-the-basic-healthcare-sum-why-do-the-excess-medisave-account)
Sources for the age-55 transition: CPF Board, [Why are Special Account savings
transferred first to Retirement Account at 55?](https://www.cpf.gov.sg/member/infohub/cpf-clarifies/policy-faqs/why-are-special-account-savings-transferred-first-to-retirement-account-at-55),
[Closure of Special Account for members aged 55 and above](https://www.cpf.gov.sg/member/infohub/educational-resources/closure-of-special-account-for-members-aged-55-and-above-in-early-2025)
and [How much CPF savings can I withdraw from age 55 to 64?](https://www.cpf.gov.sg/service/article/how-much-cpf-savings-can-i-withdraw-from-age-55-to-64)

The $5,000 kept back in OA at 55 is this project's reading: CPF Board's pages
on forming the RA do not say whether any OA savings are kept back, but its
withdrawal page lets a member short of the FRS withdraw $5,000 from OA, and
its worked example has exactly $5,000 left there.

Why the $20,000 sub-cap matters: drawing the Ordinary Account below $20,000
takes those dollars out of the extra-interest tier as well as out of OA, so
each one forfeits the extra-interest rate on it (1% a year below 55, up to 2%
from 55, credited to SA or RA) unless other savings are available to refill
the tier.

## Escalation assumptions

A member's Full Retirement Sum is fixed in the year they turn 55, and their
Basic Healthcare Sum is revised every year until they turn 65 and then fixed
for life. A 30-year-old's sums are therefore set decades from now, so a single
2026 figure would be wrong for most users. The rule set (`escalation` in
`src/rules/ruleset-2026.ts`) holds every figure CPF Board has published, and
`src/rules/escalation.ts` carries them forward by a stated assumption after
that. Every figure is marked `published`, `assumed` or `before-published` so
the interface can say which.

| Sum | Published | Assumed after that | Basis |
|---|---|---|---|
| Basic Retirement Sum (FRS = 2 x BRS) | By cohort, 2015 to 2027 | +3.5% a year, rounded to the nearest $100, from the 2028 cohort | The rate CPF Board applied to the 2023 to 2027 cohorts. Escalating the 2022 BRS this way reproduces every published figure from 2023 to 2027 exactly. |
| Basic Healthcare Sum | By year, 2016 to 2026 | +4.7% a year, rounded to the nearest $100, from 2027 | Its average annual rise from 2016 ($49,800) to 2026 ($79,000). No rate is published in advance. |

These are assumptions for illustration, not forecasts: future sums are set by
the Government and the Ministry of Health. Sources: CPF Board, [How much is my
Basic Retirement Sum?](https://www.cpf.gov.sg/service/article/how-much-is-my-basic-retirement-sum),
[How much is my Full Retirement Sum?](https://www.cpf.gov.sg/service/article/how-much-is-my-full-retirement-sum)
and [What is the Basic Healthcare Sum?](https://www.cpf.gov.sg/service/article/what-is-the-basic-healthcare-sum)
