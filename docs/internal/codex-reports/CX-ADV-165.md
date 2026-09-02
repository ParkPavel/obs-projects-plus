# CX-ADV-165 — adversarial review of #165 (feat/165-token-consolidation @ c24c1f8 vs main d2d7de4)

Run 2026-09-02 through `.codex/run-role.mjs --role adversarial-reviewer`, Codex session 01a060fb-1c33-73e0-bd56-a8a21824d36b. Disposition of each finding is recorded in `BACKLOG.md` #165 (2026-09-02); absolute machine paths stripped.

## Verdict: BLOCK

**P1 — the pilot does not make most chart labels container-sized.**  
Observed: [ChartWidget](/src/ui/views/Dashboard/widgets/Chart/ChartWidget.svelte:219) applies the new font-size only to its wrapper. Bar, line, scatter, pie, and progress chart labels specify their own SVG `font-size` attributes—for example [BarChart](/src/ui/views/Dashboard/widgets/Chart/BarChart.svelte:154), [LineChart](/src/ui/views/Dashboard/widgets/Chart/LineChart.svelte:172), and [ScatterChart](/src/ui/views/Dashboard/widgets/Chart/ScatterChart.svelte:143).

Inference: those explicit SVG values override inherited wrapper typography, so the pilot changes padding but not the claimed label size for those chart types. `NumberChart` is the apparent exception. Falsified only by showing computed SVG label sizes change due to this token, or by routing those label sizes through the container-derived token.

**P2 — R0.13 prevents only the old, literal TypeScript-string form of a second scale.**  
Observed: it detects `--ppp-*:` text in `.ts` files ([R0.13](/src/_/_tests__/R0_13_tokenSourceIntegrity.test.ts:183), [filter](/src/_/_tests__/R0_13_tokenSourceIntegrity.test.ts:294)). It would catch a reintroduced `getDesignTokenCSS`-style template literal.

It misses `style.setProperty("--ppp-radius-md", value)`, object-map serialization, split strings, `.js`, and new token names in Svelte scripts (the Svelte scan only rejects names already owned by `tokens.css`). Falsify by adding synthetic tests for those forms and demonstrating they fail.

**No current ceiling-path finding.**  
Static trace shows `ChartWidget` is registered through [widgetComponentRegistry](/src/ui/views/Dashboard/widgets/widgetComponentRegistry.ts:119), rendered inside [WidgetHost](/src/ui/views/Dashboard/widgets/WidgetHost.svelte:149), and therefore under `WidgetShell`’s query container ([lines 156–165](/src/ui/views/Dashboard/widgets/WidgetShell.svelte:156)). I found no present no-container consumer. The checked-in probe’s ceiling case remains a future-consumer hazard, which R0.13 does not prove structurally.

The radius shim statically preserves the four shifted dashboard values ([tokens.css](/src/ui/tokens/tokens.css:429)); however, moving them from the former inline `style` to a stylesheet changes their cascade priority against user snippets/themes. That is conditional, not a confirmed regression.

I did not run Jest: PowerShell blocked `npx`, and `npx.cmd` was denied filesystem access outside the workspace. `git diff --check` also reports generated `main.js` trailing whitespace.

Codex session ID: 01a060fb-1c33-73e0-bd56-a8a21824d36b
Resume in Codex: codex resume 01a060fb-1c33-73e0-bd56-a8a21824d36b
