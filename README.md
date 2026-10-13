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
| `npm run bench` | Engine benchmarks (timings only; the budget is asserted by `npm test`) |

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
    ProjectionPage     The landing view: headline, inputs, results
    projection/        The input panel, its form state and defaults, and the form-to-draft conversion
    DesignSystemPage   Live preview of every component (placeholder data), development only
  routes.ts            Projection on every path; /design-system in development builds only
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
    MediSave overflow routing; the age-55 transition; the housing loan
    (HDB concessionary and bank) with its monthly instalments; housing
    withdrawals from the Ordinary Account, with the retention option and
    shortfalls falling to cash; accrued interest on CPF used for housing, and
    the refund due on sale at every age.
  - Input validation (`validate.ts`): `projectDraft` takes the form's draft,
    returns typed field errors instead of throwing, and projects only what
    passes (see below).
  - Property and invariant tests (`invariants.test.ts`, fast-check): see
    "Engine invariants" below.
  - Performance budget: a full recomputation under 50ms, asserted in the test
    suite (see "Performance" below).
  - The v1 engine tickets are complete.
- Projection page: the default view. It opens on a projection of the default
  inputs (age 30, $5,000 a month, 0% salary growth, no housing), with no
  account or input needed. Layout and mobile order are in
  `docs/design-system.md`.
  - Input panel (`pages/projection/InputPanel.tsx`): every §3.1 input. Salary
    growth defaults to 0%, a stated assumption that the salary stays as it is
    today, shown in the hint. Housing fields appear only once a housing plan
    is selected. Validation errors from the engine guards show beside their
    field: a wrong value at once, a missing one once the field has been
    visited. While the inputs cannot be projected, the last complete
    projection stays on screen under a notice listing what to resolve.
  - Shareable state: every input, the start month and the pinned rule set
    live in the URL (see "Shareable links" below). No storage, cookies or
    server calls.
  - The headline tiles and balances table are first cuts; the headline row,
    balance chart, timeline and assumptions panel each have their own ticket.
- Design system preview: `npm run dev`, then `/design-system`. Development
  builds only; the production build does not contain it.

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
| Housing loan | Drawn in the month the member reaches the purchase age; `tenureYears x 12` level monthly instalments from the month after. Monthly rest: each month's interest is a twelfth of the annual rate on the opening balance, rounded to the nearest cent; the instalment is rounded up to the cent and the last one clears the balance exactly (provisional: no published rule). HDB concessionary rate = the rule set's OA rate + the 0.1-point peg, resolved each month, with the instalment recomputed if the rate changes; a bank loan uses its own rate for the whole tenure. A "loan cleared" event marks the last instalment. |
| Housing withdrawals | In the purchase month the member's chosen OA share of the downpayment comes from the OA and the rest is paid in cash; each later month the instalment comes from the OA or cash, as chosen. Payments draw on the OA after this month's contribution lands, never take it below the retained amount (up to $20,000 for an HDB loan, any amount for a bank loan) or below zero, and whatever the OA cannot cover is paid in cash and recorded as a shortfall. Withdrawals stop earning interest from the month they leave. Every OA withdrawal adds to the CPF principal used for housing. The loan is not resized to use all OA above the retention, as HDB does for its own loans; the OA share and the loan are inputs. |
| Accrued housing interest | The CPF principal used for housing earns what it would have in the OA: a twelfth of the rule set's `housing.accruedInterestRate` each month on the cumulative principal plus interest credited in earlier years, credited each December, so it compounds annually. A withdrawal accrues from the month it is made, the month it stops earning OA interest. It keeps accruing after the loan is repaid. Each month records the accrued interest to date, including the year so far, and the refund due on a sale that month (principal plus accrued interest). Rounded to the cent once a year, on crediting (provisional). |

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

Source for accrued housing interest: CPF Board, [Why do I need to refund the
accrued interest on the amount of CPF savings used for my property?](https://www.cpf.gov.sg/service/article/why-do-i-need-to-refund-the-accrued-interest-on-the-amount-of-cpf-savings-used-for-my-property)
Source for the OA retention: CPF Board, [Retain $20,000 in your Ordinary
Account if you are taking a housing loan](https://www.cpf.gov.sg/member/home-ownership/using-your-cpf-to-buy-a-home/retain-20000-in-your-oa-if-you-are-taking-a-housing-loan).
Source for the HDB rate peg: CPF Board, [CPF interest rates from 1 January to
31 March 2026 and Basic Healthcare Sum for 2026](https://www.cpf.gov.sg/member/infohub/news/news-releases/cpf-interest-rates-from-1-january-to-31-march-2026-and-basic-healthcare-sum-for-2026):
the HDB concessionary rate "is pegged at 0.1% above the OA interest rate".

The $5,000 kept back in OA at 55 is this project's reading: CPF Board's pages
on forming the RA do not say whether any OA savings are kept back, but its
withdrawal page lets a member short of the FRS withdraw $5,000 from OA, and
its worked example has exactly $5,000 left there.

Why the $20,000 sub-cap matters: drawing the Ordinary Account below $20,000
takes those dollars out of the extra-interest tier as well as out of OA, so
each one forfeits the extra-interest rate on it (1% a year below 55, up to 2%
from 55, credited to SA or RA) unless other savings are available to refill
the tier.

## Shareable links

A projection is shared by its URL, with no account, storage, cookie or server
call. `src/pages/projection/urlState.ts` encodes the state into the query
string and decodes it; the page rewrites the URL with `history.replaceState`
on every change, so the address bar is always a complete link and Back leaves
the page rather than stepping through keystrokes.

Schema version 1. Values are in the form's units, dollars and percentage
points; empty fields are left out, and housing keys appear only with a plan.

| Key | Value | Key | Value |
|---|---|---|---|
| `v` | schema version, `1` | `h` | housing plan: `n`, `hdb`, `bank` |
| `r` | rule set id, e.g. `sg-cpf-2026-01` | `p` | property price ($) |
| `m` | start month, `YYYY-MM` | `pa` | age at purchase |
| `a` | current age | `d` | downpayment ($) |
| `s` | monthly salary ($) | `os` | OA share of the downpayment (%) |
| `g` | salary growth (%) | `t` | loan tenure (years) |
| `ob` `sb` `mb` | OA, SA, MA balances ($) | `br` | bank loan rate (%) |

A link renders the same figures whenever it is opened:

- **Start month.** The link keeps its own, so its timeline does not shift with
  the calendar.
- **Pinned rules.** `r` pins the rule set. The engine takes it as `rulesAsAt`
  and considers only the rule sets up to that one, treating it as still in
  force, so a link made today keeps today's rules after later sets are added.
  The rules stamps in the page, header and footer show the pinned set.

Malformed or old links degrade, never fail. An unknown schema version opens
on the defaults; an unknown rule set uses the current rules; an unreadable
start month starts this month; a value that is not a number, or that the
engine would reject, takes its default; and unusable property details drop
the property as a whole rather than leave half a purchase. Each fallback is
listed in a dismissible notice above the figures, and every link opens on a
projection.

## Input validation

The interface never calls the engine directly. `projectDraft(draft)` in
`src/engine/project.ts` validates a draft shaped like the spec's §3.1 inputs
and returns either `{ ok: true, result, adjustments }` or
`{ ok: false, errors }`. Each error names its field, a code, a plain-language
message and, where there is one, the bound that was crossed, so the form can
show it in place. Nothing throws.

| Check | Rule |
|---|---|
| Current age | Whole number, 16 to 70. The projection runs to 65, or from the current age if older. |
| Monthly salary | Required, not negative, and above the rule set's graduated-rate threshold ($750): the engine does not model graduated rates. |
| Salary growth | Required, -10% to 20% a year. Raise month 1 to 12, January by default. Rejected if a pay cut each year would take the salary down to the graduated-rate threshold before the projection ends (checked on the engine's own wage path in `salary.ts`). |
| Opening balances | Optional, zero by default, never negative. |
| Housing fields | Read only when a housing plan is selected, so leftovers in hidden fields never block a projection. Price, purchase age, downpayment and OA share are then required; tenure only if there is a loan; a rate only for a bank loan. |
| Purchase age | Not before the current age, not after the projection ends. |
| Downpayment | Not above the price; the loan is the price less the downpayment. OA share 0 to 100%. |
| Loan tenure | 1 to 25 years for an HDB loan, 1 to 35 for a bank loan. Not yet verified against a primary source; the "source housing loan parameters" ticket should verify and move these into the rule set. |
| OA retention | An HDB-loan figure above the rule set's $20,000 cap is clamped to it, with a notice returned as an adjustment. |

The other bounds (age 16 to 70, growth, bank rate up to 20%) are this tool's
limits, not CPF rules, and live in `INPUT_LIMITS` so the form can use the same
ones.

## Engine invariants

Alongside the worked-example fixtures, `src/engine/invariants.test.ts` uses
[fast-check](https://fast-check.dev) to generate inputs across the whole range
the validator accepts (ages 16 to 70, salaries above and below the wage ceiling,
opening balances, no housing, HDB and bank loans, retention, instalments from
OA or cash, start years 2026 to 2030) and checks, for every month of every
projection:

| Invariant | What is checked |
|---|---|
| Conservation | Per account: opening + contributions + interest - housing withdrawals, plus the recorded moves between accounts (MediSave overflow, age-55 transfers), = closing. Across all accounts the moves cancel out. Each month opens where the last closed. Loans repay exactly what was drawn; refundable = principal + accrued interest. |
| No negative balances | No account, contribution, interest, loan or housing figure below zero; balances are whole cents; housing withdrawals never go below the retained amount. |
| Determinism | Repeated runs of the same input are identical, and the input is never changed. |
| Allocation | Every contribution is allocated in full, with no negative share, at any age, amount and Retirement Account position. Employee and employer shares add up to whole-dollar totals within the wage ceiling. |
| Rules | MediSave never closes above the BHS; no Special Account balance from the 55th birthday month; interest credited in December only; principal used for housing never falls; every month names a listed rule set. |

On a failure, fast-check shrinks the input to the smallest failing case and
prints it with a seed to replay. Its first run found a real gap: a pay cut each
year could take a low salary down to the graduated-rate threshold partway
through a projection, where the engine throws. Validation now rejects that.

## Performance

Spec §3.4: a full recomputation, age 22 to 65, monthly, two scenarios, must
finish under 50ms so the timeline scrub feels continuous. The representative
input (`src/engine/__fixtures__/scenarios.ts`) is the heaviest realistic
comparison: a 22-year-old buying at 30, one scenario on an HDB loan paid from
OA and one on a bank loan paid in cash, both validated and projected through
`projectDraft` exactly as the interface will.

- `src/engine/performance.test.ts` asserts the budget with the rest of the
  suite, so CI fails if it is missed. It warms up first, then asserts on the
  median of 25 runs, so a single slow run on a busy machine cannot fail it.
- `src/engine/project.bench.ts` (`npm run bench`) reports timings for the full
  recomputation and its parts.

Measured on 12 October 2026 on the development machine (Windows, Node 22):

| Measurement | Result |
|---|---|
| Full recomputation, benchmark | mean 7.6ms, p99 17.5ms |
| One projection, already validated | mean 2.6ms |
| Validation of one scenario | mean 0.3ms |
| Full recomputation, median in the test suite (other test files running in parallel) | 15 to 21ms |

The budget is met with headroom, so no profiling was needed. The margin to
watch is mobile: a mid-range phone can run JavaScript several times slower
than a desktop, so the on-device check in the mobile verification ticket
should confirm the scrub still holds. If it does not, the places to look first
are per-month object allocation in the loop and the escalation series, which
is recomputed from its last published year on each call.

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
