# CX-ADV-166-step2 — adversarial-reviewer on #166 step 2 (feat/166-step2-chart-width @ b2e0d00 vs 6c6a82f)

Run 2026-09-02 through `.codex/run-role.mjs --role adversarial-reviewer`, Codex session 01a06206-ada5-7780-a877-495943396c8b. Disposition in `BACKLOG.md` #166 (step 2).

## Merge verdict: hold

Two P1s block #166 Step 2’s stated narrow-chart outcome.

- **P1 — Scatter (and likely Progress) violate the decision’s label-density premise at 160px.**  
  **Observed:** Bar/Line route their X labels through `axisLabels`; Scatter instead always renders every grid label ([ScatterChart.svelte](src/ui/views/Dashboard/widgets/Chart/ScatterChart.svelte:34), [labels](src/ui/views/Dashboard/widgets/Chart/ScatterChart.svelte:142)). At 160 user units, Scatter’s plot width is 90 after its fixed side padding ([line 13](src/ui/views/Dashboard/widgets/Chart/ScatterChart.svelte:13)). Progress similarly renders its label unconditionally, with no truncate/cull path ([ProgressChart.svelte](src/ui/views/Dashboard/widgets/Chart/ProgressChart.svelte:24)).  
  **Inferred:** once labels stop shrinking geometrically, ordinary scatter tick text will overlap in a narrow widget; long Progress labels can clip. This defeats the stated “label density changes” contract for these chart types.  
  **Confidence:** high for missing handling; medium for the exact visual failure.  
  **Falsified by:** a vault screenshot at 160px using long/numeric Scatter ticks and a long Progress label, showing no overlap or clipping—or implementation of density handling for them.

- **P1 — the probe does not establish the actual chart sizing contract.**  
  **Observed:** the probe’s `.chart` only sets `overflow` ([probe](docs/internal/probes/166-chart-viewbox-scale.html:18)); its SVG roots have no explicit sizing ([line 30](docs/internal/probes/166-chart-viewbox-scale.html:30)). Bar and Line likewise have no root SVG sizing rule, while Pie and Scatter do ([Pie](src/ui/views/Dashboard/widgets/Chart/PieChart.svelte:173), [Scatter](src/ui/views/Dashboard/widgets/Chart/ScatterChart.svelte:212)). Yet `chartWidth.ts` claims every root fills its container ([line 4](src/ui/views/Dashboard/widgets/Chart/chartWidth.ts:4)). The recorded probe summary omits its own `svgClientWidth` readings.  
  **Inferred:** the reported text-scale values may not represent the real dashboard’s SVG viewport, especially across the inconsistent root styles. Progress’s claimed fixed CSS height is also **UNKNOWN**: its viewBox is 52 user units, but the component supplies no CSS height/width rule.  
  **Confidence:** high that the evidence is incomplete; medium that runtime sizing differs.  
  **Falsified by:** recording each root SVG’s `getBoundingClientRect()` in the actual vault at 160, 480, and 1600px, alongside rendered text size and height.

The documented state itself says the vault run has not occurred ([CONTEXT.md](docs/internal/CONTEXT.md:28)); that is required acceptance evidence for this user-visible change.

Non-findings:

- The viewBox route is the better choice than CSS-only label scaling for Bar/Line: their geometry model uses the same numeric font sizes ([axisLabels.ts](src/ui/views/Dashboard/widgets/Chart/axisLabels.ts:76)). CSS scaling without threading that scale into the model would diverge.
- No direct resize feedback loop is apparent. `contentRect` compiles to a content-box ResizeObserver, not Svelte’s iframe listener; the widget host has inline-size containment ([WidgetShell.svelte](src/ui/views/Dashboard/widgets/WidgetShell.svelte:156)). This is reasoning, not profiling.
- The zero-width guard is appropriate for a live zero measurement. Collapse unmounts the content ([WidgetShell.svelte](src/ui/views/Dashboard/widgets/WidgetShell.svelte:136)), so it does not retain width across collapse; lazy mounting also delays chart creation until the host intersects ([line 56](src/ui/views/Dashboard/widgets/WidgetShell.svelte:56)). Hidden-tab and print behavior remain **UNKNOWN** without a live run.
- Pie’s fix is complete for width-derived geometry ([PieChart.svelte](src/ui/views/Dashboard/widgets/Chart/PieChart.svelte:25)). Bar, Line, and Scatter already derive width geometry reactively.

I performed read-only diff/code inspection only; I did not run project gates.

