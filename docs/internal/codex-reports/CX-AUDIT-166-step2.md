# CX-AUDIT-166-step2 — auditor on #166 step 2 (feat/166-step2-chart-width @ b2e0d00 vs 6c6a82f)

Run 2026-09-02 through `.codex/run-role.mjs --role auditor`, Codex session 01a06206-630d-7900-8328-4ed792c59b59. Disposition in `BACKLOG.md` #166 (step 2).

## Findings

- **P1 — Pie and donut charts still scale at wide widths.** [ChartWidget.svelte](src/ui/views/Dashboard/widgets/Chart/ChartWidget.svelte:213) passes pies a square, capped viewBox width, while [PieChart.svelte](src/ui/views/Dashboard/widgets/Chart/PieChart.svelte:173) sets the SVG to `width: 100%; height: auto`. In a container wider than the configured height, the physical SVG fills the wide container while its square viewBox remains capped. Labels therefore scale up and the SVG becomes vertically oversized—the opposite of the ticket’s fixed-label-size outcome.

  Falsified by a real wide pie/donut render showing that the SVG’s used width is constrained to its passed width (or that its rendered text stays at the intended size).

- **P3 — Generated bundle has trailing whitespace.** [main.js](main.js:167) makes `git diff --check 6c6a82f..b2e0d00` fail.

  Failure scenario: any clean-diff check rejects the PR. Falsified by a clean `git diff --check`.

## Observed checks

- No added `@ts-ignore`, `new Menu(...)`, user-input `RegExp`, or `JSON.parse`.
- No U+FFFD found under `src`.
- No `width={480}` remains in chart implementation; all chart width props derive from `chartWidth`.
- Width guard correctly retains the initialized/previous positive width for absent, non-finite, zero, and negative measurements in its actual call path.
- Pie geometry is now reactive.
- Svelte 3.59.2 compiler source confirms `contentRect` uses the content-box ResizeObserver path; dimension bindings use the iframe resize-listener path. The built bundle contains ResizeObserver references and no `iframe`.
- PX count is unchanged from base to head; `ChartWidget.svelte` is not in the R0.6 budget list. No configuration files changed.
- The branch is `feat/166-step2-chart-width`, not `main`.

I could not execute Jest or the four gates: Node is blocked by the read-only sandbox while resolving `C:\Users\Park`. Thus the planted-constant test and runtime rendering claims remain unexecuted here.

**Verdict: BLOCKED** — fix the pie/donut viewport-scale mismatch, then run the targeted suites and a narrow/wide live render.

