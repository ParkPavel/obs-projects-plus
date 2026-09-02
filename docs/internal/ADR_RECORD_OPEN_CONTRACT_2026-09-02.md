# ADR — the record-open contract: peek instead of leaving (#168), 2026-09-02

> Architect pass (read-only, 21 tool calls) against `main` = `09fef14`. Vision scene 3. Three steps;
> step (a) is a pure refactor with no behaviour change and starts without further decisions; steps
> (b) and (c) wait on the USER DECISIONS in §11, recorded in `BACKLOG.md` #168. Line numbers were
> read on 2026-09-02.

## 0. The ticket's letter diverges from the code — read this first

The ticket says: *side peek "поверх существующего `VisualizerPane`"*. That cannot be built as
written.

`src/ui/views/VisualizerPane/VisualizerPane.svelte` takes only `app` and `inverseIndexStore`
(lines 60–61). Its `refresh()` (lines 74–85) reads `app.workspace.getActiveFile()` and it
subscribes to `active-leaf-change` (line ~89). **It has no target; it follows whatever is active.**
`main.ts:450-464` proves the consequence:

```ts
async revealVisualizerPane(filePath?: string): Promise<void> {
  if (filePath) { ... await this.app.workspace.getLeaf("tab").openFile(file); }
  const right = this.app.workspace.getRightLeaf(false);
```

To show a record in that pane you must first **open the record in a tab** — the exact navigation
#168 exists to stop. Using it as the peek requires adding a pinned-target mode, and it then contends
with `maybeReplacePropertiesPane()` (`main.ts:417-428`), which owns the same single leaf.

Meanwhile a peek-shaped surface **already exists and is dead**:
`src/ui/components/RecordCardView/RecordCardView.svelte` wraps `EditNote` inside `SlideInPanel`
(import line 23, markup line 117, `width="28rem"`). Grep for `RecordCardView` outside its own folder
returns **only** `src/ui/views/Dashboard/__tests__/recordCardView.test.ts` — no production consumer.

**Decision: the peek is the in-view `SlideInPanel` surface (`RecordCardView`), not the sidebar
leaf.** Rationale in §1. The sidebar leaf stays a later, second surface ("pin this record to the
right pane"), not the default.

## 0b. Corrections from the code-mapper trace (2026-09-03) — read before §2

`codex-reports/CX-MAP-168.md` traced what §12 left UNKNOWN. Three of its findings change this plan,
and each was re-verified in the main session rather than taken on the trace's word.

**1. There is no Table view.** `src/view.ts:14-17` registers exactly four view components — Board,
Calendar, Dashboard, Gallery. `src/ui/views/Table/` holds only `helpers.ts` and
`components/DataGrid/`, and no file outside that folder imports `DataGrid` (the three grep hits are
comments in `contextMenu.ts:10,170` and `RollupCellRenderer.svelte:10`). So the "Table gap" §2 named
as a blocker for step (a) does not exist, and neither does the path through
`GridRow.svelte:91` → `DataGrid.svelte:299-305` → `onRowEdit` that the trace mapped: it is
unreachable. **The ticket's headline "клик по строке" is the Dashboard's Table V2**
(`TableRow.svelte:60` dispatches `openRecord` → `DataTableContent.svelte:135` calls
`openLinkText(record.id, record.id, false)`), which was already class A.

*Consequence for the plan:* step (a) starts immediately, with no code-mapper prerequisite.
*Consequence beyond it:* the whole `src/ui/views/Table/components/DataGrid/**` tree is dead code of
the kind #178 removed. It is NOT in #168's scope — file it separately, and note that unlike #178's
type-only files this one is runtime code, so its deletion needs the same usage trace and a bundle
comparison, not just `tsc`.

**2. Class A is 24 sites, not 18; class B is 6, not 14.** Six sites §2 listed as class B pass a
record id, not an arbitrary wikilink: `CardList.svelte:132,134` (fed `item.id, item.id` at `:126`),
`EventList.svelte:99,101` (fed `record.id, record.id` at `:92`) and `GalleryView.svelte:194,196`
(fed `record.id, record.id` at `:188`). They reach `openLinkText` through an `InternalLink`
component whose inputs are fixed at the call site, which is why a line-local reading misclassified
them. Genuine class B is six: `CardMetadata/Text.svelte:41`, `RichTextTag.svelte:42`,
`ColumnHeader.svelte:49`, `TextLabel.svelte:44`, `GridFileCell.svelte:37` (dead with the DataGrid
tree), `RelationListView.svelte:44` — all of them rendered-Markdown anchors or parsed wikilinks.

**3. Two sites are neither, and the ratchet must say so.** `views/helpers.ts:152,156`
(`showMobileNavMenu`'s "open in tab" / "open in window") take `linkText` and `sourcePath` as
parameters. Today every caller passes a record id, but the signature permits any link. Treat the
helper as a *third* category: it takes the mode from its caller and must be migrated to accept an
`OpenRecordTarget` in step (a), not listed as an exempt class-B site.

**4. Two ADR uncertainties are closed.** `LinkBehavior` is `"open-note" | "open-editor"`
(`settings.ts:350`). `RecordCardView` is statically prop-compatible with today's `EditNote` — it
passes `fields`, a null-guarded `record`, `allRecords`, `autosave`, `onSave`, `onOpenNote`,
`onRenameNote` at `:167`. Compilation itself is unverified (no `svelte-check` was run on it), and it
declares itself reserved at `:1`.

## 1. Contract

**What it guarantees, and to whom.** Every place that opens a *record* of the current view routes
through one function. Plain activation keeps the user inside the view (peek); the existing modifier
convention keeps its existing meaning. Wikilink navigation to arbitrary notes is untouched.

New module: `src/lib/record/openRecord.ts`

```ts
export type RecordOpenMode = "peek" | "same" | "tab" | "window";

/** Reproduces the convention already shipped at EditNote.svelte:458,
 *  AllDayEventStrip.svelte:68, MultiDayEventStrip.svelte:47.
 *  shift → "window"; ctrl/meta → "tab"; plain → PLAIN_MODE. */
export function modeFromEvent(e: MouseEvent | KeyboardEvent): RecordOpenMode;

export interface OpenRecordTarget {
  readonly id: string;            // record.id — a file path, as all sites pass today
  readonly sourcePath?: string;   // defaults to id, matching current call sites
}

export interface OpenRecordDeps {
  readonly app: App;
  /** Supplied by the hosting view. Absent → openRecord falls back to "same". */
  readonly peek?: (target: OpenRecordTarget) => void;
}

export function openRecord(
  target: OpenRecordTarget,
  mode: RecordOpenMode,
  deps: OpenRecordDeps,
): Promise<void>;
```

Mapping: `"same" → openLinkText(id, sourcePath, false)`, `"tab" → "tab"`, `"window" → "window"`,
`"peek" → deps.peek?.(target) ?? openLinkText(..., false)`.

**The behaviour flip is one constant** (`PLAIN_MODE`) in one file. That is what makes step (b)
revertible without re-touching the call sites.

Why the existing convention is preserved rather than redesigned: it is already consistent across
three components read; `shift`/`ctrl` are muscle memory, and the ticket only asks that *plain* stop
leaving.

Untouched invariants: **one filter engine** and the canonical filter order are not in scope; any
new menu entry goes through `openContextMenu` (`src/lib/contextMenu.ts:130`), never `new Menu`
(invariant 4) — `showMobileNavMenu` already complies.

**Why in-view `SlideInPanel`, not a leaf (question 1 settled):**

| Option | Context kept? | Keyboard | Mobile | Verdict |
|---|---|---|---|---|
| (A) right sidebar leaf hosting `VisualizerPaneView` | Yes, but requires a target prop + pinned mode on `VisualizerPane.svelte`, and contends with `maybeReplacePropertiesPane` for the one leaf | native leaf focus | drawer | Later second surface, not the default |
| (B) `getLeaf("split")` | View stays visible, but focus lands in a Markdown editor — "full page split", not a peek. **No `getLeaf("split")` call exists in any file read** | n/a | poor | Rejected |
| (C) in-view `SlideInPanel` via `RecordCardView` | Yes — rendered over the still-mounted view | needs a focus trap it does not have (§7) | `max-width: 100vw` already set, `SlideInPanel.svelte:~55` | **Chosen** |

## 2. Affected files

**Count correction:** `grep -rn "openLinkText" src` returns **33** matches; one is a regex inside a
test (`src/ui/views/Dashboard/widgets/__tests__/linkedSourceWrites.test.ts:96`). **32 production
sites** — the ticket's number holds. They are two different jobs, and only the first is #168:

**Class A — record open (the trace makes this 24 sites; see §0b):**

| File:line | Surface |
|---|---|
| `src/ui/views/Board/BoardView.svelte:90` | `EditNoteModal` `onOpenNote` callback |
| `src/ui/views/Calendar/CalendarView.svelte:915` | direct open (`openMode = isMobile ? 'tab' : 'window'`, line 914) |
| `src/ui/views/Calendar/CalendarView.svelte:947` | `EditNoteModal` callback |
| `src/ui/views/Calendar/CalendarView.svelte:1548` | `EditNoteModal` callback |
| `src/ui/views/Calendar/CalendarView.svelte:1692` | direct open (line 1691 same pattern) |
| `src/ui/views/Calendar/components/Calendar/Day.svelte:408,411` | day-cell event |
| `src/ui/views/Calendar/components/Calendar/EventBarContainer.svelte:172,175` | event bar |
| `src/ui/views/Calendar/components/Calendar/TimelineView.svelte:233` | timeline event |
| `src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte:135` | widget table row |
| `src/ui/views/Dashboard/widgets/DatabaseCall/tableRowOps.ts:109,114` | widget row menu (open / open-in-tab) |
| `src/ui/views/Gallery/GalleryView.svelte:57,68,165,167` | card click, card menu |
| `src/ui/modals/components/Inspector.svelte:47` | inspector error → record |

**Class B — wikilink navigation to an arbitrary note (the trace makes this 6 sites; see §0b):**
`CardMetadata/Text.svelte:41`, `TagList/RichTextTag.svelte:42`,
`Board/components/Board/ColumnHeader.svelte:49`, `Board/components/Board/CardList.svelte:132,134`,
`Calendar/components/Calendar/EventList.svelte:99,101`, `Gallery/GalleryView.svelte:194,196`,
`views/helpers.ts:152,156`, `Table/.../GridFileCell/GridFileCell.svelte:37`,
`Table/.../GridTextCell/TextLabel.svelte:44`, `YamlVisualizer/RelationListView.svelte:44`. These
carry a real `sourcePath` and a target that may not be a record at all.

**Other files in scope:**
- `src/lib/record/openRecord.ts` — new, the contract
- `src/ui/components/RecordCardView/RecordCardView.svelte` — the peek body (currently dead;
  `SlideInPanel` at 117)
- `src/ui/components/SlideInPanel/SlideInPanel.svelte` — focus trap, Escape (lines 29–33 handle
  Escape only, `role="dialog" aria-modal="true"` at ~55 with no focus management)
- the `{Table,Board,Calendar,Gallery}` host components — mount one peek instance per view
- a new ratchet `R0_x_recordOpenContract.test.ts` (number assigned at implementation: R0.13–R0.16 are
  taken or in flight), built on the `R0_13` shape (pure `(text) → matches` scan, exercised on
  synthetic input in **both** states)
- `src/ui/modals/editNoteModal.ts:17,35` and `src/ui/modals/components/EditNote.svelte:36,458` —
  **read, not changed** in steps (a)/(b)

**The Table gap — must be resolved before step (a) starts.** The Table has **no** class-A site. Its
only record-open path found is `src/ui/views/Table/components/DataGrid/GridRow.svelte:91`, the mobile
long-press menu, which calls `onRowOpen(rowId, false)`. The definition of `onRowOpen` was not opened
— where a desktop row click leads is UNKNOWN. Since "клик по строке" is the ticket's headline
example, step (a) begins with a `code-mapper` trace of `onRowOpen`.

## 3. Stored data

**Steps (a) and (b): none.** No frontmatter key, no `data.json` key, no widget config change. The
peek reads `record` + `DataField[]` that the view already holds, and writes through the same
`EditNote` path that the modal uses today.

**A "default open mode" preference — recommend NOT adding one in #168.** `Preferences` in
`src/settings/base/settings.ts:355-380` is a `readonly` type, and every version restates defaults
(`replaceObsidianProperties` appears in `v1/settings.ts:51`, `v2:99,186`, `v3:378,508`,
`v4:112,211`). A new key is therefore a five-file change **and permanent**: the
`DataTableConfig.subBases` precedent means a key that ships can never be removed, only carried.
Since step (b) leaves `ctrl` → tab and `shift` → window fully reachable, nothing becomes
unavailable without a setting. Add the key only if the vault run shows people want plain-click to
keep leaving — and if so, add it once, as `defaultRecordOpenMode: "peek" | "same"` on
`Preferences`, next to the existing `linkBehavior` (line 367).

## 4. Order

**Step (a) — the contract and the migration, zero behaviour change.** `PLAIN_MODE = "same"`. All
18 class-A sites call `openRecord`. The ratchet forbids `workspace.openLinkText` outside
`src/lib/record/openRecord.ts` **and** the 14 declared class-B sites (declared as a list, R0.4/R0.13
style, so a new one cannot appear unnoticed). Reversible: pure refactor.

**Step (b) — the flip and the peek.** `PLAIN_MODE = "peek"`; each view mounts `RecordCardView` and
supplies `deps.peek`; the peek gains the **field ↔ frontmatter-key** panel. Reversible by one
constant.

**Step (c) — polish.** #151 link status inside the peek; keyboard path (focus trap, focus return)
— overlaps #169 and should be sequenced with it, not duplicated.

(b) cannot precede (a): flipping before the sites are unified means 18 independent flips. (c)
cannot precede (b): there is no frame to draw a link status in until the peek exists — which is
exactly what BACKLOG says blocks #151 today.

## 5. What the peek shows

Scene 3's readiness criterion, `PRODUCT_RESET_2026-07-18.md` §4 row 3: *"Hover/inspect показывает
frontmatter key; открытие записи ведёт к источнику"* — status **Gap**.

Neither existing surface satisfies it. `VisualizerPane` renders raw frontmatter keys
(`entries = applyOverlay(frontmatter, overlay, { showHidden })`, `VisualizerPane.svelte:103`) but
knows nothing of view fields. `EditNote` renders view fields (`export let fields: DataField[]`,
line 32) but no key display was seen. **The scene-3 content of #168 is the join**: each row shows
the view's field name and, beside it, the frontmatter key actually written — sourced from
`DataField` on one side and `metadataCache` frontmatter on the other.

**Step 1 recommendation: the peek is editable**, not read-only — it reuses `EditNote`, whose
autosave is already a project setting (`EditNote.svelte:38`, `editNoteModal.ts:20`), and a
read-only peek would need new code to *remove* capability. But see risk 4; this is a user question.

## 6. What does NOT change

`EditNoteModal` and its four opens (`BoardView.svelte:82`, `CalendarView.svelte:921,1528`,
`GalleryView.svelte:60`); full-page editing; all 14 class-B wikilink sites; `showMobileNavMenu`
(`views/helpers.ts:137-159`) other than gaining a peek entry in step (b); the filter engine and
filter order; `VisualizerPane` and its properties-replacement feature.

## 7. Risks the gates cannot see

1. **jsdom cannot see any of it.** Not leaves, not `transform`-based slide-in, not whether the panel
   has non-zero width. Four green gates prove the migration compiles, nothing more. Step (b) needs
   a vault run.
2. **Escape collision.** `SlideInPanel.svelte:29-33` calls `e.stopPropagation()` on Escape. Mounted
   inside a view, it will swallow Escape from any outer handler (cell-edit cancel, popover close).
3. **Focus is not moved into the panel.** It declares `aria-modal="true"` (~line 55) with no focus
   management — a keyboard user opening a peek is stranded behind it. This is precisely #169's
   finding (`SlideInPanel.svelte:29,51`). Ship (b) with the trap or ship (b) knowingly broken for
   keyboard; say which.
4. **Autosave writes from a surface that looks like a preview.** A peek that saves on blur will
   edit files users think they are only glancing at.
5. **Mobile.** `CalendarView.svelte:914,1691` already special-case `isMobile`. A 28rem panel on a
   phone is the whole screen — the peek stops being a peek.
6. **One peek per view instance.** With a Dashboard hosting several `DatabaseCall` widgets, two
   peeks can open at once unless ownership is decided at the view level.
7. **Ratchet blind spot.** The ratchet catches literal `workspace.openLinkText`; it cannot catch
   `const w = app.workspace; w.openLinkText(...)`. State that limit in the test header.

## 8. Observable results, per step

- **(a)** Plain click behaves exactly as before in Table, Board, Calendar, Gallery, Dashboard widget
  tables. `grep -rn "openLinkText" src --include=*.ts --include=*.svelte` returns matches only in
  `openRecord.ts`, the 14 declared class-B sites, and the test regex. The ratchet fails on a planted
  33rd site (proved on synthetic input, both states). Four gates green; the Jest baseline rises by
  the new suites.
- **(b)** In a real vault: clicking a row/card/event opens a right-edge panel **with the view still
  rendered behind it**; the panel lists each field beside the frontmatter key it writes;
  `ctrl`-click still opens a tab, `shift`-click a window; Escape closes the peek and the view is
  unchanged. Evidence = a vault run plus a flow-render delta on scene 3, not a green gate.
- **(c)** An unresolved relation shows its status inside the peek (closing the open part of #151);
  Tab from the trigger lands inside the panel and returns on close.

## 9. Size and staffing

| Step | Size | Staffing (≤3 handoffs) | Adversarial review |
|---|---|---|---|
| (a) contract + migration + ratchet | M | `implementer` → `auditor` (the code-mapper pass is DONE — `CX-MAP-168.md`) | Not required — no behaviour change |
| (b) flip + peek + field↔key panel | M | `flow-auditor` (acceptance contract on scene 3, before) → `implementer` → `tester` (vault run) | **Required** — changes shipped behaviour on every view |
| (c) #151 status + keyboard | S–M | `lead` inline, sequenced with #169 | Required if it touches focus order |

## 10. Rejected

- **Center peek (a modal) as the default.** We already have the modal — `EditNoteModal`, four
  opens. It is the surface Notion offers *in addition to* side peek, and the modal is what today's
  users dismiss to get back to the view. Rejected as the default; it stays reachable.
- **Migrating the 14 class-B wikilink sites in #168.** Their targets are arbitrary notes with real
  `sourcePath`s; peeking a non-record in a record-card panel is a different contract.
- **`getLeaf("split")` as the peek.** No code read calls it, and it opens a Markdown editor with
  focus — full page beside the view, not a peek.
- **Per-view default open mode.** Four settings versions, one permanent key, and a user who cannot
  predict what a click does.
- **Adding a target prop to `VisualizerPane` now.** It would fight `maybeReplacePropertiesPane()`
  (`main.ts:417-428`) for the single right leaf. Deferred to a later "pin to sidebar" surface.

## 11. USER decisions (recommended default in bold)

1. Peek surface — in-view slide-in panel, or the right sidebar leaf? → **in-view panel** (the
   ticket says sidebar; §0 explains why that cannot be built as written).
2. Default plain-click mode after step (b) — same for all views, or per view? → **same for all
   views**.
3. Is the peek editable in step 1, or read-only? → **editable** (reuses `EditNote`; read-only
   would be new code to remove capability).
4. Add a `defaultRecordOpenMode` preference now? → **no** (permanent key across five files;
   modifiers keep the old behaviour reachable).
5. Ship step (b) before the focus trap (#169), or block on it? → **block**: a modal-declared panel
   that does not take focus is a regression for keyboard users, and #169 already names the exact
   lines.

## 12. UNKNOWN

- `onRowOpen` in `src/ui/views/Table/components/DataGrid/GridRow.svelte:91` — definition and
  desktop behaviour not opened. The Table's record-open path is unverified, and it is the ticket's
  headline surface. (Traced by the code-mapper before step (a) — see `CX-MAP-168.md` once it lands.)
- Whether `EditNote.svelte` displays frontmatter keys anywhere below line 60 — only its props block
  was read.
- `LinkBehavior`'s member values (`src/settings/base/settings.ts:367`).
- Whether `RecordCardView` still compiles against the current `EditNote` props — it has no
  production consumer and may have drifted.
- The exact `SlideInPanel` z-index scale relative to Obsidian's leaves; the reference notes
  `FloatingPopup` and `SlideInPanel` both sit at `z-index: 50`.
- Obsidian API beyond what the code uses: only `getRightLeaf`, `setViewState`, `revealLeaf`,
  `getLeavesOfType`, `detach`, `getLeaf("tab").openFile` and `openLinkText` are attested in files
  opened.
