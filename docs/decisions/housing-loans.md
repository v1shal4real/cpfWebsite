# Housing loan parameters (KAN-19)

Decided 2026-11-09. Spec §2.6, §3.1.

## 1. Bank loan rate: a user input

Bank loan rates have no published figure, vary by bank and package, and float
over a loan's life. A stated assumption would put a number on screen that no
source supports, so the rate is **entered by the user**, from 0% to 20%, and
held for the whole tenure.

The HDB concessionary loan rate is **not** an input. It comes from the rule
set, pegged at 0.1% above the Ordinary Account rate (2.6% in the 2026 rules).

In code: `LoanTerms` in `src/engine/types.ts` requires `interestRate` on a bank
loan and forbids it on an HDB loan.

## 2. Monthly instalments: from the OA or in cash, chosen by the user

The user chooses one source for every instalment: the **Ordinary Account** or
**cash**. There is no split.

A split would add an input that few users can estimate. Paying from the OA
already covers the common mixed case: when the OA cannot cover an instalment,
the engine pays the rest in cash and records the shortfall.

In code: `HousingPlan.instalmentsPaidFrom: 'ordinary-account' | 'cash'`.

## 3. Loan limits, sourced into the rule set

|                                    | HDB loan | Bank loan | Reduced bank limits                                   |
| ---------------------------------- | -------- | --------- | ----------------------------------------------------- |
| Maximum loan-to-value              | 75%      | 75%       | 55%                                                   |
| Minimum cash downpayment, of price | none     | 5%        | 10%                                                   |
| Maximum tenure                     | 25 years | 35 years  | —                                                     |
| Reduced limits apply when          | never    | —         | tenure is over 30 years, or the loan runs past age 65 |

Sources, as listed in `src/rules/sources.ts`:

- `hdbLoanToValue`: HDB, Annex B to the November 2026 BTO exercise. It states the HDB loan LTV is 75% from the October 2024 exercise.
- `bankLoanLimits`: MAS, _Loan Tenure and Loan-to-Value Limits_. It gives the 75%/55% LTV limits, the 5%/10% minimum cash, the tenure caps, and the conditions for the reduced limits.
- `housingLoanComparison`: CPF Board, _HDB loan or bank loan? 3 differences you should know_. It says an HDB loan downpayment may be paid wholly from CPF, and a bank loan needs 5% in cash.

Known simplifications:

- The tool does not ask the property type. Bank loans use MAS's figures for
  non-HDB property: a 35-year cap, with reduced limits above 30 years. For an
  HDB flat bought with a bank loan, MAS sets 30 and 25 years.
- The 25-year HDB loan tenure is not yet tied to an HDB page in the source
  registry. MAS's 25-year threshold for HDB flats matches it.
- Only first housing loans are modelled. MAS sets lower LTV limits for second
  and later loans.
- LTV is applied to the price. Lenders use the lower of price and valuation.
