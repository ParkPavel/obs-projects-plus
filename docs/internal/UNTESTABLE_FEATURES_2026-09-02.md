# Untestable features — deploy + manual/API pipeline run, 2026-09-02

TEST PACKET run: deploy `main` (verified `git rev-parse main` = `d2f2bbd5ff63b01254d0ea7d13a0c5d8e8ae312e`,
matches the packet's stated `d2f2bbd`) into the OBStests vault and drive
`docs/internal/MANUAL_TESTING_PIPELINE.md` §1–§4a for #166 steps 1–2 (`010a59d`, `42e897d`) and
#178 (`448847d`). Authority for this run: read-only on the repository working tree, write-only to
the OBStests vault plugin folder and to the scratchpad. No file under
`C:\Users\Park\OBSv1.0\obs-projects-plus` was edited; no branch was switched; no `npm run build`
was run there — the three artifacts were taken with `git show main:<file>`, not from the working
tree (which is on `feat/165-token-consolidation` for other work).

## Artifacts deployed

`git show main:main.js`, `main:styles.css`, `main:manifest.json` → scratchpad → copied into
`C:\Users\Park\OBSv1.0\OBStests\.obsidian\plugins\obs-projects-plus\`. MD5 of each deployed file
matched the git-extracted copy exactly (verified with `md5sum` on both paths). The vault's
pre-existing three files were copied to the scratchpad
(`backup_before_deploy/{main.js,styles.css,manifest.json}`) before overwrite. Plugin id, from
`manifest.json`: `obs-projects-plus`, version `3.6.0-alpha`.

## Observed live

| Check | Result |
|---|---|
| REST API reachable | `GET http://127.0.0.1:27123/` → HTTP 200, `Local REST API` v3.6.2, Obsidian 1.9.12 |
| `app:reload` after deploy | HTTP 204, then 9s wait per pipeline troubleshooting table (REST server restarts) |
| Plugin command count | **exactly 10** `obs-projects-plus:*` commands via `GET /commands/`: `show-projects`, `create-project`, `create-note`, `open-schema`, `add-field`, `toggle-visualizer-pane`, `open-visualizer-for-file`, `add-relation`, `open-formula-editor`, `create-demo-project` — the exact expected set, `add-sub-base` absent (consistent with #160) |
| `show-projects` execution | `POST /commands/obs-projects-plus:show-projects/` → HTTP 204; re-queried `/commands/` immediately after — still 10 registered, no crash-and-unregister |
| **#166 step 1 — `:root` token** | Deployed `styles.css` line 689: `:root{...--ppp-local-text-sm: 1em;...}` present verbatim |
| **#166 step 1 — container-roots rule** | Deployed `styles.css` line 689: `.ppp-widget-host,.ppp-database-root,.ppp-database-canvas{--ppp-local-text-sm: clamp(1em, .85em + .6cqi, 1.25em)}` present verbatim, matches the exact selector/value quoted in the packet |
| **#166 step 1 — pie `max-width`** | Deployed `main.js` contains `.ppp-chart-pie.svelte-1vdke2t{display:block;max-width:100%;height:auto;margin:0 auto}` — component CSS riding in `main.js` as expected |
| **#166 step 1 — container names** | `container-name:dashboard-root` present in `main.js`; `container-type:inline-size;container-name:dashboard-canvas` present in `main.js` (on `.ppp-database-canvas--stack...`) |
| **#166 step 2 — `ResizeObserver`** | Present, 3 occurrences in `main.js` — one is a shared observer with an `entries` map (`new ResizeObserver(n=>{...t.entries.set(i.target,i)...})`), the other two are per-component observe/disconnect wiring |
| **#166 step 2 — `contentRect`** | Present, 1 occurrence: `I=(x=Df.entries.get(this))==null?void 0:x.contentRect,n(1,I)` — a component reading its rect off the shared observer's entries map by keying on `this`, consistent with a `resolveChartWidth`-style mechanism (names are minified; cannot confirm the identifier itself is `resolveChartWidth`/`tickCountFor`) |
| **#166 step 2 — literal `480` occurrences** | 4 total in `main.js`: (1) `case"medium":return 320;case"large":return 480` — a size-name→px lookup unrelated to chart width; (2) `qo={xs:480,sm:768,md:1024,lg:12...}` — a breakpoint table, unrelated; (3) `let I,j=480,P={labels:[]...` — a component-local width variable defaulting to 480; (4) `{width:I=480}=e,{height:j=320}=e` — a component prop destructure defaulting `width` to 480. Occurrences (3) and (4) are both plausible `CHART_WIDTH_FALLBACK` sites. **I cannot establish from grep alone whether these are one constant reused as two compiled prop defaults (expected/legitimate, matching the doc's "present once" framing at the source level) or two independently hardcoded 480s** — the minified bundle does not preserve which source line each came from, and static string search cannot resolve identity. Reporting both occurrences rather than asserting either interpretation. |
| **#178 — deleted type-only symbols absent from bundle** | `grep -c` on deployed `main.js`: `getDesignTokenCSS` = 0, `DataEngineRequest` = 0, `TransformStepIR` = 0, `PaletteStore` = 0, `RelationIndexableRecord` = 0 — all five absent, as expected for type-only deletions |
| **Item 5 — dashboard with 2+ chart widgets of different widths + a pie** | Did not pre-exist: the demo "Обзор" view had exactly one chart widget (`chartType: "donut"`, `w: 6`). Seeded two more via REST `PUT` to `.obsidian/plugins/obs-projects-plus/data.json` (this file is inside the vault plugin folder, in this run's write scope): `w-qa-pie-166` (`chartType: "pie"`, `w: 4`, `x: 0, y: 14`) and `w-qa-bar-166` (`chartType: "bar"`, `w: 8`, `x: 4, y: 14`), cloned from the existing donut widget's `subFilter`/`xAxis`/`yAxis`/`style`. Pre-seed `data.json` backed up to scratchpad (`data.json.backup_before_seed`) before the write. `PUT` → HTTP 204. After `app:reload`, re-`GET` of the same path confirmed both widgets persisted with their ids/widths/chartTypes; plugin still registered exactly 10 commands and `show-projects` still returned 204 |

## NOT observed — and not claimable

1. **Whether any of this actually renders, at any size.** REST returns commands and file/JSON
   content, never a computed layout. Nothing here confirms a chart draws, that widths differ
   visually, that the pie is capped, or that label text scales — only that the strings and
   structures a human would need for those effects are present in the deployed bundle and vault
   config.
2. **#166's mechanism itself** — whether `cqi` inside the `--ppp-local-text-sm` custom property
   resolves per-container rather than per-viewport. `docs/internal/UNTESTABLE_FEATURES_2026-09-01.md`
   records this as closed by a **separate headless-Chrome probe**, not by this pipeline; this run
   re-confirms only that the same CSS text is now the one shipped in the deployed `main:` build,
   not that the mechanism holds inside the actual Obsidian/Electron host.
3. **Scatter tick count, Progress truncation, label size at 160/480/1600px widget widths, pie
   capping on screen, `TemplateConfirmDialog` scrim position on a tall dashboard.** None of these
   are observable through the vault/commands REST surface at all — no endpoint returns rendered
   geometry, computed style, or DOM state.
4. **Whether occurrence (3) or (4) above is the intended single `CHART_WIDTH_FALLBACK` constant, a
   duplicate of it, or two unrelated hardcoded values.** Flagged above; genuinely unresolved by
   this method, not withheld.
5. **M1–M5 (config-migration + restore-point pipeline, §4a)** — out of scope for this packet (not
   requested), not run. No `migration-backup-*.json` files were found in the plugin folder, which
   is expected since no legacy `widget.transform` was seeded this run.
6. **Roundtrip (§4, PUT/GET/DELETE on a scratch note)** — not run this packet; not requested.

## The checks that close them — for a human at the screen

| Feature | Steps | Expected observation |
|---|---|---|
| Chart width scaling (#166 step 2) | Open OBStests vault, run `obs-projects-plus:show-projects`, open the "Обзор" dashboard of the demo project, scroll to the bottom row (two new widgets: "QA #166 pie width probe (narrow)" and "QA #166 chart width probe (wide)") | The wide (w=8) chart renders visibly wider than the narrow (w=4) one, with proportionally different tick/label density if it is a bar/line chart with axis ticks |
| Pie capping (#166 step 1) | Look at the existing "Проекты по статусу" donut chart and the new pie widget | Pie/donut does not overflow its widget card at any width; `max-width:100%` holds it inside the container |
| Label size scaling at 160/480/1600px | Resize the Obsidian pane (or drag the dashboard's own pane divider) so a chart widget's rendered width crosses those approximate breakpoints | Label text and padding grow smoothly with the container per the #166 clamp — per the corrected reading in `UNTESTABLE_FEATURES_2026-09-01.md`, this applies to `NumberChart`/wrapper padding, not SVG chart labels (which use fixed `font-size="11"` viewBox units and scale with the SVG's own `viewBox`, not the token) |
| Scatter tick count | Open a chart widget with `chartType: "scatter"` (none seeded this run — would need a widget added) at multiple widths | Tick count adapts to available width rather than being fixed |
| Progress truncation | Open a Progress-type widget at a narrow width | Long labels truncate/ellipsize rather than overflowing |
| `TemplateConfirmDialog` scrim position | Trigger the template-confirm dialog on a dashboard tall enough to require scrolling | Scrim covers the full viewport/dashboard height, not just the visible scroll window |

## UNKNOWN

- Whether the two literal `480` sites found in `main.js` (component prop default and local
  variable default) both trace back to the same `CHART_WIDTH_FALLBACK` source constant, or whether
  one is a separate, unintended hardcode. Needs a source-level check (`grep CHART_WIDTH_FALLBACK`
  in the actual `main` source tree, which this run's read-only authority did not permit touching
  beyond the git-extracted artifacts already used) rather than bundle inspection.
- Whether `contentRect`'s single occurrence is the entire `resolveChartWidth` mechanism or one
  piece of it — minification removed the name, and only one call site was found, which is
  consistent with a single shared width-resolution helper but not proven to be it.

## Restore note

Pre-deploy plugin files are in the scratchpad at `backup_before_deploy/` (main.js, styles.css,
manifest.json) and the pre-seed vault config at `data.json.backup_before_seed`, in case either
needs to be reverted.

## Addendum, main session, 2026-09-02 — the two `480` literals

The tester could not tell from the minified bundle whether the two chart-width-shaped `480`s trace to
one constant. From source they do not need to: `src/ui/views/Dashboard/widgets/Chart/chartWidth.ts:19`
is `CHART_WIDTH_FALLBACK`, and `ScatterChart.svelte:6` is the prop default `width: number = 480`, which
never applies because `ChartWidget` always passes the measured width. The other two hits are
`chartDataPipeline.ts:219` (a height) and `stores/ui.ts:25` (a breakpoint). No duplicate hard-code.

Deployed before step 3 merged (`main` = `d2f2bbd`); step 3 (`1fr` filler track, `db-table` removed)
is NOT in the vault yet and needs the same deploy before its on-screen checks.
