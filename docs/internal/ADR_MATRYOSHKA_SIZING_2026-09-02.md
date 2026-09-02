# ADR — Matryoshka sizing: the container decides the size (#166), 2026-09-02

> Architect pass (read-only) against `main` = `6290224`, after #165 merged. Three steps; Step 1
> carries no user decision and contracts to "nothing moves"; Steps 2 and 3 wait on the USER
> DECISIONS at the end, which must be recorded as `RESOLVED` in `BACKLOG.md` #166 before they are
> implemented. Line numbers marked `~` come from a `sed` window rather than a direct hit.

# CONTRACT

**#166 guarantees:** inside a declared container, a block's *size* — not only its breakpoints —
is decided by the container that holds it; and a consumer of the level-2 scale that has **no**
container ancestor degrades to *today's* rendering (the clamp floor), never to the ceiling.

To whom:
- **User** (Vision scene 7): the same chart in a narrow column and at full width looks
  proportionate; chart labels stop shrinking to illegibility in a narrow widget and stop
  ballooning in a wide one.
- **Codebase**: the level-2 scale acquires a *structural* guard, not a convention — the hazard
  #165 measured and could not check is closed by the CSS cascade plus a rule in R0.13.
- **Explicitly not guaranteed** (recorded, not silent): top-level popups and modals stay
  window-anchored. `FloatingPopup.svelte:249-256` portals the popup to `<body>` *precisely
  because* `container-type: inline-size` on `WidgetShell` made it a containing block for
  `position: fixed`. That kinship break is load-bearing; #166 must not "fix" it.

# THE FIVE QUESTIONS, SETTLED

## Q1 — SVG chart labels: route through the CSS scale, or keep geometry?

**Neither as posed. Recommendation: pin the viewBox to the measured container width so 1 user
unit = 1 CSS px, and leave the label sizes as numbers.**

The reason is in the code, and it kills the CSS-`font-size` option outright:

- `src/ui/views/Dashboard/widgets/Chart/BarChart.svelte:23` — `const LABEL_FONT = 11;`
- `:36` — the same constant is passed into the layout model as `fontSize: LABEL_FONT`
- `src/ui/views/Dashboard/widgets/Chart/axisLabels.ts:77,82,94,100,107` — `fontSize` decides
  `labelBoxWidth = renderedChars * fontSize * CHAR_WIDTH_RATIO`, `bottomPadding = fontSize + 6`,
  the rotation threshold and the cull step.

A CSS `font-size` on `text` overrides the presentation attribute **and is invisible to
`axisLabels.ts`**. The renderer would draw at one size while the geometry reserved space for
another: overlapping ticks, wrong bottom padding, wrong cull decisions. That is a worse defect
than the one being fixed, and no gate sees it (jsdom does not lay out SVG text).

The actual defect today: every chart root has `viewBox` and **no** `width`/`height` attribute
(`BarChart:107-112`, `LineChart:96-97`, `PieChart:87-88`, `ScatterChart:111-112`,
`ProgressChart:24`), so the SVG fills its parent's inline size and the fixed `width={480}`
(`ChartWidget.svelte:178,187,190,193,196,208`) only fixes the *aspect ratio*. Text therefore
scales geometrically and **unboundedly** — 11 user units render at ~5.5px in a 240px widget and
~22px in a 960px one. Pinning the viewBox width to the measured container width makes 11 units
render at ~11px at every width: labels become container-*correct* rather than
container-*proportional*, `axisLabels.ts` receives the true available width and culls honestly,
and the clamped level-2 scale keeps its job on the HTML text it already reaches.

If later we want labels to *grow* with the container, it must be done as a **number** in the
layout model (a clamped function of the measured width, mirroring the CSS clamp), passed to both
the attribute and `axisLabels`, so render and geometry never disagree. Out of scope for #166;
recorded here.

## Q2 — What replaces `width={480}` and `min-width: max-content`?

**Chart:** `bind:clientWidth` on the wrapper at `ChartWidget.svelte:137`, passed as `width` with
a first-frame fallback of the current constant. Svelte 3.59 supports `bind:clientWidth`
(ResizeObserver-backed) — no new dependency, no `Menu`, no CSSOM writes (R0.13 would catch
those). `PieChart` (`:200,203`) currently takes `width={heightPx}` and must become
`Math.min(measuredWidth, heightPx)` so a square chart cannot exceed its container. Guard
`width <= 0` (collapsed/hidden widget) by keeping the previous non-zero value — a zero viewBox
is a division-by-zero in the scale functions.

**Table:** *do not make the tracks fluid.* `tableCanon.ts:~95` carries its own history: "Tracks
are FIXED widths: the table overflows horizontally as one unit inside the shared scroll container
(UT-R2 #083 — flexible tracks made header and body disagree about column positions)". Three
separate components consume the same template (`TableHeader.svelte:109` as
`var(--ppp-dt-columns) 2rem`, `TableRow.svelte:94`, `TableFooter.svelte:29`); any
per-element-dependent unit re-opens #083. And `widthRem` is **persisted** (`types.ts:147`), so
reinterpreting it changes stored meaning.

`.ppp-t2-table { min-width: max-content }` (`DataTableContent.svelte:~269`) is a *minimum*: when
the tracks fit, the table is already container-width, and the slack simply sits unallocated at
the right. So the concrete, safe replacement is **a trailing `1fr` filler track appended in
`gridTemplate`** — one function, all three consumers get the identical string, header/body/footer
stay in one coordinate system, no saved width changes, `max-content` stays as the overflow
contract. Fluid/proportional user columns is a separate ticket with a user decision attached
(see USER DECISIONS).

## Q3 — The container chain, by name

Live today (verified by a whole-tree grep):

| Element | File:line | Name |
|---|---|---|
| `ViewContent` root `div` | `src/ui/components/Layout/ViewContent.svelte:16-17` | `view-content` |
| `.ppp-widget-host` | `src/ui/views/Dashboard/widgets/WidgetShell.svelte:164-165` | `widget` |
| `.ppp-dt-content` | `.../DatabaseCall/DataTableContent.svelte:255-256` | `db-table` — declared, **never queried** anywhere |
| `.ppp-widget-config` shell | `.../widgets/_shared/WidgetConfigShell.svelte:65-66` | `widget-config` |
| `.day` cell | `Calendar/Day.svelte:670` | unnamed |

Missing rungs, to be added **named**: `.ppp-database-root` (`DashboardCanvas.svelte:144`, styled
at `:190`) as `dashboard-root`, and `.ppp-database-canvas` (`WidgetGrid.svelte:147`) as
`dashboard-canvas`.

Two rules keep this safe:

1. **Self-query trap** — a container is not its own query container. Every element in the table
   above sizes its *own* box in `rem`/`%`/`flex` only; `cq*` units and the `--ppp-local-*` scale
   appear only in rules for its **descendants**. R0.13 already enforces this over the whole tree
   (`R0_13_tokenSourceIntegrity.test.ts:117-128`, proven both ways at `:264-269`).
2. **Nearest-ancestor shift — the risk nobody has named yet.** `cqi` inside `--ppp-local-*`
   resolves against the *nearest* ancestor container, whatever its name. Adding a rung
   **between** `WidgetShell` and widget content would silently re-point the #165 pilot from the
   widget's outer width to the inner body width and change what ships. The rungs proposed above
   are all *above* `.ppp-widget-host`, so nothing between shell and content changes. **No new
   container may be introduced inside `WidgetShell` in this ticket.**

Third hazard, worth a line here: `container-type: inline-size` implies inline-size containment —
the element's inline size stops depending on its contents. Never put it on an element that relies
on intrinsic width (anything shrink-to-fit, or a `max-content` box inside a horizontal scroller).

## Q4 — Guarding "no container ancestor → ceiling" structurally

The probe result (`UNTESTABLE_FEATURES_2026-09-01.md`, §Resolved 2026-09-02): a consumer with no
container ancestor gets `cqi` resolved against the small viewport and lands on the clamp
**ceiling** — a silent size jump exactly where the principle does not apply. R0.13 cannot see
it, and no static analysis can prove a Svelte component's runtime ancestry.

**So do not test it — make it impossible in the cascade.** Split the level-2 declaration in two:

- at `:root` (today's `tokens.css:379-382`), keep the *name* with a **cqi-free** value equal to
  the clamp floor — the level-1 fallback;
- declare the `cqi` form **only inside rules whose selector is a declared container root**
  (`.ppp-widget-host`, `.ppp-database-root`, `.ppp-database-canvas`, `.ppp-dt-content`, …).
  Custom properties inherit, `tokens.css` is a global stylesheet (`main.ts:11`) and `.ppp-*`
  class names survive Svelte scoping, so descendants of a container get the container form and
  everyone else gets the floor.

This converts the hazard from "ceiling, silently" to "today's render, silently" — the same worst
case #165 already accepted — **and it becomes statically checkable**, which convention never
was. New R0.13 rule: *every declaration of an owned `--ppp-local-*` name whose value contains a
`cq*` unit must sit in a rule whose selector is in the declared `CONTAINER_ROOTS` list, and every
selector in that list must declare `container-type` somewhere in `src/`.* Same shape as
`LIVE_TOKEN_SOURCES` (`:31-36`) and `ownedTokenNames` (`:201`): a declared list, asserted against
the tree, proven on synthetic input in both states.

A wrapper component was considered and rejected (see REJECTED).

## Q5 — Splitting L into three reviewable commits

Order is forced: the guard must land before anything new consumes the scale, and the chart's
measured width must land before minimums are expressed in `cqi`.

# THE THREE STEPS

## Step 1 — The chain declares itself, and the fallback becomes the floor
**Size S/M. `lead` can do this inline; no implementer. No user decision.**

Files:
- `src/ui/tokens/tokens.css:335-382` — split the level-2 block: `:root` keeps cqi-free floors; a
  new `CONTAINER_ROOTS` selector list carries the `cqi` forms. Extend the existing comment block;
  it already explains the trap and the fallback, and it now has to explain *why the fallback
  direction changed*.
- `src/ui/views/Dashboard/DashboardCanvas.svelte:190` — `container-type: inline-size;
  container-name: dashboard-root;` on `.ppp-database-root`.
- `src/ui/views/Dashboard/WidgetGrid.svelte:147-150` — same on `.ppp-database-canvas`, name
  `dashboard-canvas`.
- `src/__tests__/R0_13_tokenSourceIntegrity.test.ts` — add `CONTAINER_ROOTS` + the cqi-placement
  rule; keep the pure-function/synthetic-proof shape of `:117-128` and `:264-269`.

Contract: **nothing moves on screen.** The pilot (`ChartWidget.svelte:223-227`) is a descendant
of `.ppp-widget-host`, so it keeps the container form and the identical computed value; the new
rungs are above the widget and do not change the nearest ancestor.

Probe: `docs/internal/probes/166-no-container-fallback.html`, same pattern and same runner as
`165-cqi-in-custom-property.html` (command recorded at `UNTESTABLE_FEATURES_2026-09-01.md`
§Resolved). It must show three cells: consumer in a narrow container, in a wide container, and
with **no** container ancestor — the third now reporting the floor (`1em` at the host root
size), where the #165 probe reported the ceiling. Paste the numbers into this ADR.

Regression proof for the test: plant `--ppp-local-text-sm: clamp(1em, 0.85em + 0.6cqi, 1.25em)`
at `:root` → R0.13 fails naming `:root`; move it under `.ppp-widget-host` → green.

Observable: the probe's third cell changes value between `main` and the branch; the vault shows
no visible change.

### Measured 2026-09-02 — Step 1 implemented, `feat/166-step1-container-roots`

Both probes run back to back in the same headless Chrome (HeadlessChrome/151, `--window-size=1400,900`),
so the delta is measured rather than recalled. Consumer is `.chart { font-size:
var(--ppp-local-text-sm) }`, root font-size 16px, exactly the pilot's rule.

| Cell | `165-cqi-in-custom-property.html` (`:root` carries the cqi form) | `166-no-container-fallback.html` (split) |
|---|---|---|
| inside a 200px container | 16px | **16px** |
| inside an 800px container | 18.4px | **18.4px** |
| **no container ancestor** | **20px** — the clamp ceiling | **16px** — the clamp floor |

So the two container cells are byte-identical and the pilot keeps its computed value, which is the
"nothing moves" half of the contract; the no-container cell drops from the ceiling to the floor,
which is the whole point of the step. `CSS.supports("width","1cqi")` is `true` in both runs, so
neither number is an unsupported-unit artefact.

Contract note, recorded rather than fixed: Step 1 makes `.ppp-database-root` a containing block for
`position: fixed` descendants, and `TemplateConfirmDialog`'s overlay is one. See RISKS 4 below —
that risk is no longer hypothetical.

## Step 2 — The chart takes its width from the container
**Size M. Implementer, with the probe written first. Waits on USER DECISION 2.**

Files:
- `src/ui/views/Dashboard/widgets/Chart/ChartWidget.svelte:137` (`bind:clientWidth`),
  `:178,187,190,193,196,208` (`width={480}` → measured), `:200,203` (Pie/Donut →
  `min(measured, heightPx)`), `:85` (`heightPx`), and the pilot comment at `:213-222` — that
  comment currently *promises #166 will route SVG labels through the scale*; Step 2 changes the
  answer, so the comment must be rewritten, not left.
- Read only, to confirm no change is needed: `BarChart.svelte:7,23,36,107-112`,
  `LineChart.svelte:7,96-97`, `PieChart.svelte:6,87-88`, `ScatterChart.svelte:5,111-112`,
  `ProgressChart.svelte:5,24`, `axisLabels.ts:9,77-107`.

Contract: **this moves.** Chart aspect ratio and label density change at every widget width
except ≈480px. Checked by: an existing-suite run plus a new headless probe
`docs/internal/probes/166-chart-viewbox-scale.html` that renders a static SVG at the same markup
shape in a 240px and a 960px container and reports the *rendered* `text` bounding-box height —
expected ≈11px in both, versus today's ≈5.5px / ≈22px. Plus a vault run: one chart widget
resized narrow→wide, screenshot pair.

Unit test (jsdom, safe because it is arithmetic not layout): `axisLabels` given the narrow width
culls more labels than at 480 and never returns overlapping slots. Fails on a planted regression
that reverts `width` to a constant.

Watch: `ChartWidget.svelte` is 296 lines. **R0.6 was not read in the architect pass** — the
implementer must read `src/__tests__/R0_6_*` before adding lines and, if this file is capped,
extract the measurement into a small module rather than raising the ceiling.

## Step 3 — Fixed minimums become container-relative
**Size S/M. `lead` inline, after Step 1's guard exists. Waits on USER DECISIONS 1 and 3.**

Files:
- `src/ui/views/Dashboard/widgets/DatabaseCall/BlockFilterBar.svelte:83-89` — the ticket calls
  this `BlockFilterBar { min-width: 22rem }`; **the ticket is imprecise**: the rule is
  `.ppp-blockfilter-popover { min-width: 22rem; max-width: 28rem; max-height: 24rem }`. →
  `min-width: min(22rem, 100cqi)`, and only if the popover is *not* portaled to `<body>`; if it
  is, it is on the recorded window-anchored side of the boundary and must be left alone with a
  comment. Verify before editing.
- `src/ui/views/Dashboard/widgets/DatabaseCall/tableCanon.ts:~95` — append the `1fr` filler track
  in `gridTemplate` (Q2), pending USER DECISION 1.
- `.../DatabaseCall/DataTableContent.svelte:255-256` — `db-table` is declared and never queried.
  Either give it a consumer in this step (a `@container db-table` compact-row rule) or delete the
  declaration; a container nobody queries is `design-tokens.css` one level down. **Deleting is the
  recommended default** — it also removes an inline-size containment we are not using.
- Untouched by design and recorded: `FloatingPopup.svelte:249-256, ~300-310` (`position: fixed`,
  `min-width: var(--ppp-popup-min-w, 12rem)`, `max-width: 24rem`) — the window-anchored boundary;
  `PipelineEditor`'s `@media` layout switch, which is a *window* breakpoint inside a widget. That
  one is a genuine kinship break and is **not** in scope here: converting `@media` to
  `@container` changes a layout users see, and it deserves its own ticket with its own probe.

Contract: `min()` can only shrink a minimum, never grow it — a widget wider than 22rem sees no
change; a narrower one stops overflowing. Checked in the vault at two widget widths.

# STORED DATA

**None is migrated, and none is reinterpreted, in any of the three steps.**

Read-only contact points, stated explicitly:
- `DataTableConfig` column `widthRem` (`src/ui/views/Dashboard/types.ts:147`, with the deprecated
  px form at `:141` migrating lazily via `tableCanon.ts:~87-90`) — Step 3's filler track appends
  a *new* track and changes no saved number.
- Widget `widthRem` (`types.ts:621-624`) — untouched.
- `DataTableConfig.subBases` — untouched, as always: carried, never interpreted.

Anything that would make a saved width mean a different number on screen is out of scope by
construction, and that is the reason the fluid-column option is a user decision rather than a
step.

# RISKS THE FOUR GATES CANNOT SEE

1. **jsdom has no container queries and does not lay out SVG.** Every sizing claim in Steps 1–3
   is unfalsifiable by `npm test`. Acceptance = the two headless-Chrome probes + a vault run. A
   green jest run must never be quoted as evidence for a sizing claim — this repo has paid for
   that three times (`CLAUDE.md`, verification protocol).
2. **Nearest-ancestor re-pointing.** Any container added inside `WidgetShell` — now or by a later
   ticket — silently changes what the #165 pilot measures. Mitigation: the container roots are a
   *declared list* in R0.13 after Step 1, so a new one cannot appear unreviewed.
3. **Inline-size containment breaks intrinsic width.** Adding `container-type` to a
   `max-content` box or a shrink-to-fit element collapses it. `.ppp-database-canvas` is
   `width: 100%` (`WidgetGrid.svelte:147-149`) and `.ppp-database-root` is a `flex` column at
   `width: 100%` (`DashboardCanvas.svelte:190`), so both are safe — but the same edit applied one
   level lower would not be.
4. **`position: fixed` containing block.** Every new container is a new containing block for
   fixed descendants. Any popup rendered inside the dashboard root that is *not* portaled will
   start positioning against the canvas. Grep for `position: fixed` under the dashboard subtree
   during Step 1 review.

   **Grep run 2026-09-02. One hit, and it is affected.**
   `src/ui/views/Dashboard/TemplateConfirmDialog.svelte:51` — `.ppp-template-confirm-overlay
   { position: fixed; inset: 0; … }`, a centred modal scrim. It is rendered at
   `DashboardCanvas.svelte:163`, i.e. **inside** `.ppp-database-root`, and it is **not** portaled
   (`FloatingPopup` is the only thing in this tree that portals).

   Its containing block was already not the viewport: `ViewContent.svelte:16` has declared
   `container-type: inline-size` since before #166, so today `inset: 0` resolves against
   ViewContent's padding box — the visible, scrolled-to area, because ViewContent is the
   `overflow: auto` box. After Step 1 the nearest such ancestor becomes `.ppp-database-root`,
   whose height is `min-height: 100%` plus content, i.e. the **whole scrollable dashboard**. On a
   dashboard taller than the viewport the scrim then covers the full content height and
   `align-items: center` centres the dialog in that content box rather than on screen — it can
   land below the fold.

   Not fixed here: this Step 1 run was scoped to report it, not to change it, and the fix is a
   decision (portal the dialog to `<body>` as `FloatingPopup` does, or hoist it out of
   `.ppp-database-root`, or drop `align-items: center` for a top offset). **It is a merge blocker
   for the branch, not a follow-up ticket** — the step's contract is "nothing moves", and this is
   the one thing that would.
5. **Cascade priority against user CSS snippets.** #165 already recorded this for the radius
   shim; moving level-2 declarations from `:root` to class selectors raises their specificity, so
   a user snippet that overrode `:root` may stop winning. Conditional, not a regress — record it,
   no action.
6. **Chart aspect-ratio change is user-visible and not obviously "better" to everyone.** A saved
   dashboard will look different after Step 2. There is no migration to write, but there is a
   release note to write.

# REJECTED

- **CSS `font-size` on SVG `<text>`.** Overrides the presentation attribute but is invisible to
  `axisLabels.ts:77-107`, which sizes label boxes, padding, rotation and culling from the same
  number. Render and geometry would disagree. Do not re-propose without also threading the value
  into the layout model.
- **Fluid/`fr` table columns.** `tableCanon.ts:~95` records that flexible tracks made header and
  body disagree about column positions (UT-R2 #083), and three components consume the one
  template. Also reinterprets persisted `widthRem`.
- **A `<MatryoshkaScope>` wrapper component** to guarantee a container ancestor. It cannot be
  enforced (nothing stops a consumer rendering outside it), it adds a DOM node per level — each
  one a new nearest-ancestor and a new fixed-position containing block, i.e. risk 2 and risk 4
  industrialised — and the cascade split in Q4 achieves the same guarantee for zero runtime.
- **Converting `PipelineEditor`'s `@media` to `@container` inside #166.** Correct in principle,
  but it is a visible layout change in an unrelated surface and would push #166 past three
  reviewable commits. Separate ticket.
- **Keeping the level-2 tokens at `:root` and covering the ceiling hazard with a convention or a
  doc.** That is exactly the `design-tokens.css` failure mode: a rule with no enforcement drifts,
  and #165 exists because of it.

# USER DECISIONS (each with a recommended default)

1. **Should saved column widths stay literal?** *Recommended default: yes — Step 3 only appends a
   trailing filler track; proportional columns become a follow-up ticket.* Anything else changes
   what a user's saved `widthRem` means on screen.
2. **Charts will change aspect ratio and label density on existing dashboards after Step 2.
   Accept as an improvement, or gate behind a setting?** *Recommended default: accept, no
   setting* — the current behaviour is unbounded geometric scaling, i.e. the defect; a setting
   would institutionalise it.
3. **Delete the unused `db-table` container declaration (`DataTableContent.svelte:255-256`), or
   give it a consumer?** *Recommended default: delete* — an unqueried container is the same
   dead-declaration pattern #165 removed.

# Files this plan names (all opened in the architect pass)

`src/ui/tokens/tokens.css`, `src/ui/views/Dashboard/DashboardCanvas.svelte`,
`src/ui/views/Dashboard/WidgetGrid.svelte`, `src/ui/views/Dashboard/widgets/WidgetShell.svelte`,
`src/ui/views/Dashboard/widgets/Chart/ChartWidget.svelte`, `BarChart.svelte` (and `LineChart` /
`PieChart` / `ScatterChart` / `ProgressChart` in the same folder), `Chart/axisLabels.ts`,
`widgets/DatabaseCall/tableCanon.ts`, `DataTableContent.svelte`, `BlockFilterBar.svelte`,
`src/ui/components/Layout/ViewContent.svelte`, `src/ui/components/FloatingPopup/FloatingPopup.svelte`,
`src/__tests__/R0_13_tokenSourceIntegrity.test.ts`, `docs/internal/probes/165-cqi-in-custom-property.html`.

**Unread in the architect pass, and therefore an explicit gap:** `src/__tests__/R0_6_*` (LOC
ceilings — blocks Step 2's line growth) and `src/__tests__/R0_3_pxBudget.test.ts` (no px is
proposed, but Step 2 touches a file that carries `min-height: ${heightPx}px` inline at
`ChartWidget.svelte:137`). The implementer reads both before touching `ChartWidget`.
