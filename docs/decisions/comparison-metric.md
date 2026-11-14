# Headline comparison metric (KAN-45)

Decided 2026-11-10. Spec §1.4, §3.3.

## Decision

When two scenarios are compared, the single quantified difference shown is
**the difference in combined CPF balances at 55**: the Ordinary, Special,
MediSave and Retirement Account balances added together at the end of the
month the member turns 55, scenario B minus scenario A.

## Wording

| Case                | Sentence                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| B is higher         | Combined balances at 55: $48,200 higher in scenario B than in scenario A. |
| B is lower          | Combined balances at 55: $48,200 lower in scenario B than in scenario A.  |
| Same, to the dollar | Combined balances at 55 are the same in both scenarios.                   |

Rules:

- B is always compared with A. The sentence order is fixed, so its form never
  depends on which scenario is larger.
- "Higher" and "lower" are the only direction words. Never "better", "worse",
  "gain", "loss", "shortfall", "on track", "costs" or "saves".
- The figure is shown in ink, with no green or red. It is a difference, not a
  verdict: more in CPF at 55 can mean a smaller home or a larger cash outlay.
- Whole dollars; a difference under 50 cents is "the same".
- No comparison is shown when either projection ends before 55.

Implemented in `src/pages/projection/comparisonMetric.ts`. A test checks every
form of the sentence against the same word list the framing review (KAN-43)
uses.

## Alternatives considered

**Retirement Account against the Full Retirement Sum at 55.** Rejected as the
headline. The engine forms the Retirement Account up to the Full Retirement
Sum and leaves any surplus in the Ordinary Account, so for most inputs both
scenarios read "equal to the Full Retirement Sum" and the difference is $0,
even when the housing decision moved tens of thousands of dollars. The single
projection's headline row still shows this position for each scenario.
