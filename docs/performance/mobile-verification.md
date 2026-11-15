# Mobile and performance verification (KAN-52)

Checked 2026-11-15 on the production build (`npm run build`, served by
`vite preview`). Spec §3.4 Performance, Responsiveness.

## Summary

| Criterion                         | Result                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Interaction to next paint < 200ms | **Pass** in emulation: worst 64ms for single-scenario use, 144ms in one A/B edge case at 6× CPU slowdown. **Real hardware not yet tested.** |
| No horizontal scroll at 360px     | **Pass** in all 8 page states                                                                                                               |
| Lighthouse report recorded        | **Done**: `lighthouse-mobile.report.html`, 100 in all four categories                                                                       |

## Lighthouse (mobile)

Lighthouse 13.6.0, default mobile profile: emulated mid-range phone, 4× CPU
slowdown, 150ms RTT, 1.6 Mbps. Page state: HDB loan with a scenario B, the
heaviest page.

| Category       | Score |     | Metric                   | Value |
| -------------- | ----- | --- | ------------------------ | ----- |
| Performance    | 100   |     | First Contentful Paint   | 0.8 s |
| Accessibility  | 100   |     | Largest Contentful Paint | 0.8 s |
| Best Practices | 100   |     | Total Blocking Time      | 60 ms |
| SEO            | 100   |     | Cumulative Layout Shift  | 0     |
|                |       |     | Speed Index              | 0.9 s |

Before the fixes below, Best Practices was 96 and SEO 91.

Not acted on: Lighthouse estimates 109 KiB of unused JavaScript, mostly the
charting library (Recharts) and Framer Motion, which ship whole modules. It
costs no score at present; lazy-loading the chart is the option if the budget
tightens.

## Interaction to next paint

INP needs real input, so it is not part of a Lighthouse load test. Measured
with Chrome driven by puppeteer-core, Android user agent at 412×823, and
Chrome's CPU throttling at 1×, 4× (mid-range phone) and 6× (low-end). Each
interaction's latency is the longest Event Timing entry for it: input delay,
handlers and render, through the next paint. That is the measurement INP
uses. Each rate was run twice.

Worst latency per interaction, after the fixes, at 6× slowdown:

| Interaction                               | Latency                                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Type a salary, each keystroke re-projects | 32–48 ms                                                                                                                |
| Choose HDB loan (housing fields appear)   | 48–56 ms                                                                                                                |
| Switch chart to Table tab and back        | 32–64 ms                                                                                                                |
| Timeline arrow keys                       | 48–56 ms                                                                                                                |
| Add scenario B                            | 32 ms                                                                                                                   |
| Type in scenario B (two projections)      | 24–40 ms per key; 144 ms when the click into the field lands within 0.6 s of adding B, while the comparison first draws |

## Findings and fixes

| #   | Finding                                                                                                                                                                      | Fix                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Every keystroke re-rendered the whole page synchronously: chart, tables, assumptions. 50–100 ms of render per key at 6×, so fast typing queued keys behind it: up to 192 ms. | The projection and results render from `useDeferredValue`, so a keystroke updates the field at once and the results follow at lower priority, interruptible by the next key. `ResultsRegion`, `HeadlineRow` and `ComparisonView` are memoised so the urgent render skips them. Render per key fell to 5–18 ms. |
| 2   | While editing one scenario, the other was re-projected on every keystroke although its inputs had not changed.                                                               | That projection is cached on its own inputs.                                                                                                                                                                                                                                                                   |
| 3   | `/favicon.ico` returned 404, logged as a console error (Best Practices).                                                                                                     | `public/favicon.svg`, the header's logo mark, linked from `index.html`.                                                                                                                                                                                                                                        |
| 4   | No `robots.txt`; the server returned the app's HTML in its place (SEO).                                                                                                      | `public/robots.txt` allowing all crawlers.                                                                                                                                                                                                                                                                     |

## 360px

Each state loaded in a 360px-wide frame on the production build, checking
the document's scroll width and any element past the right edge: default,
HDB loan, bank loan, the Table tab, scenario A and B (viewing each), inputs
that cannot be projected, and a link notice. Scroll width was 360px in every
case. The comparison table is wider than the screen by design and scrolls
inside its own keyboard-focusable region, not the page.

## Still to do

**A pass on real mid-range hardware** (KAN-76). CPU throttling on a desktop is a
stand-in: it slows JavaScript but not the GPU, memory or thermal limits of a
phone. Suggested device: a 2–3 year old mid-range Android (e.g. a Samsung
Galaxy A-series), Chrome, the production build over Wi-Fi. Use Chrome DevTools
remote debugging (Performance panel, "Interactions" track), or the Web Vitals
extension, with the interactions in the table above.
