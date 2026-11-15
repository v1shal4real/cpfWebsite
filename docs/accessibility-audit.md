# Accessibility audit: WCAG 2.2 AA (KAN-51)

Audited 2026-11-15 on the projection page, the only product view.
Spec §3.4 Accessibility, §4.3 Dark mode.

## Summary

| Check                            | Result                                                                      |
| -------------------------------- | --------------------------------------------------------------------------- |
| axe, light and dark              | **Pass.** 0 violations in 6 page states × 2 themes, after 4 fixes below     |
| Contrast, light and dark         | **Pass**, via axe in a real browser. One light token was below 4.5:1, fixed |
| Keyboard, including timeline     | **Pass**, after removing one meaningless tab stop                           |
| Screen readers (NVDA, VoiceOver) | **Not yet run.** Needs a person; checklist below                            |
| Automated regression check       | Added: `src/accessibility.test.tsx` runs axe on every push in CI            |

## Method

**axe-core 4.14** with the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`
and `best-practice` rules, run in Chromium on the dev server at 1280px. The
theme was set through the app's own stored preference before load, and
animations were allowed to settle before each run. Page states:

1. Default projection (no property)
2. HDB loan, with OA retention and its explainer
3. Bank loan, with the bank rate field
4. Scenario A and B side by side, with the chart overlay
5. Inputs that cannot be projected (empty salary), showing the stale notice
6. The chart's Table tab open

**Keyboard**: Tab through the whole page in the A/B comparison state, recording
every focus stop and whether it shows a focus indicator; then every timeline key.

## Findings and fixes

| #   | Finding                                                                                                                                                         | WCAG                          | Fix                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Light theme `--ink-subtle` (`#78766f`) used for hints, captions, units and unselected segment labels: 4.16:1 on the canvas, 3.95:1 on `surface-2`. 14 elements. | 1.4.3 Contrast (Minimum)      | Darkened to `#6e6c65`: 4.57:1 on `surface-2`, its darkest background, 5.12:1 on `surface`. Dark theme already passed. |
| 2   | The "Assumptions" group heading was an `h5` straight under the card's `h3`.                                                                                     | 1.3.1 Info and Relationships  | It is now an `h4`; rule-set groups stay `h5` under each rule set's `h4`.                                              |
| 3   | The screen-reader copy of the chart's table sat in a scrollable box that cannot take focus.                                                                     | 2.1.1 Keyboard                | `Table` only makes its container scroll when it is focusable. The visible table is unchanged.                         |
| 4   | Recharts made the chart SVG a focusable `role="application"` named only by its run-together tick text ("3035404550…$0$150k…").                                  | 2.4.3 Focus Order, 4.1.2 Name | `accessibilityLayer={false}`. The timeline slider drives the same crosshair, and the table holds every figure.        |

## Keyboard pass

Focus order follows the visual order: skip link → theme control → copy link →
scenario switcher → every input in panel order → chart/table tabs → timeline →
source links → footer. Every stop shows a focus indicator. The hidden table
copy takes no focus.

Timeline (`Age on the timeline`), from age 55:

| Key                 | Result      |
| ------------------- | ----------- |
| Home                | 30y (start) |
| Arrow right         | +1 year     |
| Shift + arrow right | +1 month    |
| Page Up / Page Down | ±5 years    |
| End                 | 65y (end)   |

Each move updates `aria-valuetext` (e.g. "Age 31y 1m, 2027-12") and the
polite live region ("Age 65y. Total balances $1,428,882. Contribution rate 25%.").

## Open items

1. **Screen reader pass with NVDA and VoiceOver** (KAN-74). Not run: it needs a person
   using the real software. Checklist below.
2. **Repeated link text.** About 30 source links read "CPF Board, opens in a
   new tab". Their purpose is clear from the row beside each, which meets
   2.4.4 (AA). Naming the figure in each link, such as "Source for the Annual
   Limit: CPF Board", would help screen reader users who list links out of
   context. Ticketed as KAN-75.

## Screen reader checklist

Run with **NVDA + Firefox or Chrome** on Windows and **VoiceOver + Safari** on
macOS and iOS. Record pass/fail per row.

| #   | Do                                           | Expect to hear                                                                                      |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Load the page, read from the top             | Page title; h1 "Your CPF balances, projected to 65"; headline figures with their labels             |
| 2   | Tab to "Gross monthly salary"                | Name, "required", value, hint "Ordinary Wages only…", unit "in Singapore dollars"                   |
| 3   | Clear the salary                             | The stale notice and its list of problems; the field reads as invalid with its error                |
| 4   | Arrow through the housing plan               | "radio button, n of 3, checked" for each option                                                     |
| 5   | Choose HDB loan, reach the retention note    | The "Why $20,000?" note is read in order after its field                                            |
| 6   | Reach the chart                              | Figure title and one-sentence summary; the data table, with "Age" row headers                       |
| 7   | Switch to the Table tab                      | "tab, selected"; the table caption and headers                                                      |
| 8   | Move the timeline with arrow keys            | Age and month on each step; after a pause, the live summary of total and contribution rate          |
| 9   | Add scenario B, change the salary            | "1 field differs from scenario A"; the changed field's "Changed from A" mark                        |
| 10  | Read the comparison                          | The single difference sentence first, then Scenario A and B columns, each with its rules-as-at date |
| 11  | Press "Copy link to this projection"         | "Link copied to clipboard."                                                                         |
| 12  | List links (NVDA Insert+F7, VoiceOver rotor) | Each source link says it opens in a new tab                                                         |
