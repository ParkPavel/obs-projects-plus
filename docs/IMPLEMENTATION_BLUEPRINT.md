# Implementation Blueprint — Engine v2 + YAML Визуализатор

> **Status**: APPROVED with material clarifications — §11 answered, §12 checklist closed except for the doc-standardization task that is now part of the plan itself.
> **Date**: 2026-04-30 (Revision 2)
> **Plugin version scope**: **3.4.2 WIP** for the entire foundation track. The current public release is `3.4.1`; bumping to `3.4.2` keeps the beta lineage clean and prevents accidentally overwriting the published snapshot. Public release stays frozen until milestone **M5**.
> **Terminology lock**: this document uses **Stage A / Stage B** as the binary delivery split, anchored to the ROADMAP milestones **M0..M5**. The previous draft used "Stage A / Stage B" — that vocabulary is retired here to stop drift across sessions. See Appendix B for the full glossary.
> **Supersedes (operationally, not formally)**: scattered M-step descriptions across `IMPLEMENTATION_PLAN_CURRENT.md`, `ROADMAP_DATABASE_2026.md`, `architecture-engine-v2.md` — all three remain the supporting specifications. This document is the **chronological execution chart** that links them.

---

## REVISION 2 — Material clarifications from user (2026-04-30)

During the §11 review the user confirmed/overrode the following. The body of this document below is updated to reflect them; this block is the audit trail.

| § | Question | User's answer | Effect on the plan |
|---|---|---|---|
| 11.1 | YAML Visualizer surface form | **Replacement for Obsidian's native Properties pane**, with full functional extension (field config, data flow, visual relation/rollup management, show/hide list, configurable filters & sorting). Works **both** at the global note level **and** inside views. | Step A.7 expanded to a Notion-parity sub-plugin specification; this is now the largest single deliverable in Stage A. |
| 11.2 | Display name | **YAML Визуализатор** (ru) / **YAML Visualizer** (en) / **Перегляд YAML** (uk) / **YAML 可视化器** (zh-CN). | i18n keys named `views.yaml-visualizer.*`. |
| 11.3 | Relation field write semantics | **Array of related items**, with an adaptive UI that shows the full list and is expandable when it does not fit the cell / property row. | Step A.5b (cell renderer) and Step A.7 row component grow an "overflow + expand" affordance. |
| 11.4 | Internal release artifact | **Bump to `3.4.2`** to avoid colliding with the published `3.4.1` beta snapshot. | All version references in this document switched to `3.4.2`. |
| 11.5 | Stub closure scope | **Phased rollout, but every "left for the future" code anchor must be tracked rigorously so context is never lost.** | New §13 "Stub & TODO discipline" + new file `.ai_internal/stubs.md` registry. |
| 11.6 | Depth of YAML Visualizer | **Much deeper.** It is essentially "a sub-plugin within our plugin". Without it and its integration into the new unified engine, proper UX is impossible. Notion screenshots provided as the parity reference (property edit menu, type editor with format options & visualisation modes, inline relation list with overflow, two-way relation, formula modal). | Step A.7 covers all six Notion-parity surfaces explicitly. |
| 11.7 | Order of execution | **Architecturally optimal order accepted.** | Order from §6 retained: A.1 → A.5a → A.2 → A.3 → A.4 → A.5b → A.7 → A.8. |
| 11.8 | Documentation pass | **YES, and broaden it.** Documentation across the whole project (not only `docs/`) does not meet industry standards — chaotic, with inherited disorder from prior agent sessions; even “wave” terminology (a now-retired synonym for `Stage`) had drifted across sessions. A professional unified standardization pass is required. | New §14 "Documentation & Terminology Standardization" — runs as a parallel work-stream alongside Stage A; verification gates extended (§10) with terminology and stubs.md checks. |

**Net effect**: Stage A grows by two work-streams (deeper YAML Visualizer + project-wide doc standardization). The technical core (M0 engine + stub closures) is unchanged. Stage B is unchanged.

---

---

## 0. Reading guide

This document answers four questions, in this order:

1. **What are we building, and what are we NOT building?** → §1 (Mission), §2 (Out-of-scope)
2. **What is the honest current state of the codebase?** → §3 (Inventory), §4 (Stub catalogue)
3. **Why do we split work into two stages, and what does each deliver?** → §5 (Two-stage model)
4. **What exactly will change, file-by-file, before any code is committed?** → §6 (Stage A blueprint), §7 (Stage B outline)

§8–§11 are the engineering protocol: tests, migration, performance, risk register, open questions for user approval.

---

## 1. Mission

Bring the plugin from a "table-with-extras" tool to a **Notion-class, fully local, YAML-first data workspace** inside Obsidian, without making the engine depend on Dataview for the core pipeline.

The plugin's value proposition once Stage B ships:

- Every Markdown note becomes a typed **record** of a project (database).
- Frontmatter fields gain **types** beyond string/number: `Relation`, `Rollup`, `Formula`, `Select`, `Status`, `Date`, `Boolean`, `List`.
- Records can **reference other records across projects** through wiki-links — and the plugin can **roll up aggregates** of those references.
- The user manipulates the data through three coordinated UI surfaces:
  1. **Database View** (existing) — table/board/gallery/calendar widgets bound to one project.
  2. **YAML Visualizer View** (new in Stage A) — typed property panel for the *focused* note, shown as either a leaf, a sidebar, or an inline strip above the editor.
  3. **Formula Editor Popup** (Stage B) — unified modal editor available in every context where a formula expression can be written.

Engine v2 (Stage A) is the foundation that makes all three surfaces possible. Stage B is the user-visible completion that closes the loop.

---

## 2. Boundaries — what we will NOT do

These boundaries are non-negotiable for Stage A + Stage B combined:

| Out of scope | Why |
|---|---|
| Inline metadata syntax `field:: value` (Dataview-only) | Pollutes Markdown body; stays opt-in via the existing `dataview` datasource only |
| Real-time collaborative sync | Requires a backend; off-product |
| Multi-level rollups (rollup of rollup) | Performance and semantics of cycle detection are a separate research item |
| Automatic backlink discovery (implicit relations) | We require **explicit** `RelationFieldConfig` and `RollupFieldConfig` — explicit > implicit |
| AI-generated formulas | Tooling concern; would couple us to an LLM provider |
| Any change to `DataSource` abstraction shape (still 3 kinds: folder/tag/dataview) | Low value, high churn |
| New chart types beyond what already ships | YAGNI |
| Calendar / Board / Gallery refactor | Already stable and out of the engine surface |
| Re-publishing the plugin | Frozen at 3.4.1 public; Stage A is internal under 3.4.2; bump to 3.5.0+ only at Stage B / M5 completion |

---

## 3. Current state — honest inventory (verified 2026-04-30)

### 3.1 Quality gate

- TypeScript: `tsc --noEmit` → 0 errors
- Tests: `npx jest` → 54 suites / 923 tests PASS
- Build: `node esbuild.config.mjs production` → success (1 third-party a11y warning, off-scope)
- Source files: 241 `.ts` + 190 `.svelte` (under `src/`)

### 3.2 What works today (verified)

- **Datasources**: folder + tag work without Dataview; dataview is opt-in.
- **DataFrame model**: `DataField`, `DataFieldType` (incl. `Relation`, `Rollup` enum entries), `DataValue`, `DataRecord` are live.
- **In-frame relations** (`src/ui/views/Database/engine/relationResolver.ts`): wiki-link extraction + resolution to records inside one DataFrame; backlink enrichment works.
- **In-frame rollups** (`src/ui/views/Database/engine/rollup.ts`): 12 aggregation functions (`count`, `count_values`, `count_unique`, `sum`, `avg`, `min`, `max`, `median`, `range`, `percent_true`, `concat`, `concat_unique`) over related records inside one DataFrame. The pure aggregation kernel is currently a **private** `aggregate(values, config)` (line ~78); it must be exported in Step A.3 to be reused by the cross-frame engine without duplication.
- **Existing Relation cell renderer** (`src/ui/views/Table/components/DataGrid/GridCell/GridRelationCell/GridRelationCell.svelte`): parses raw wiki-link strings/arrays and renders clickable tags. It currently shows the **wiki-link body verbatim** (`[[Account 1]]` → `Account 1`). It does NOT yet display a `displayField` of the resolved record. This is the real surface that Step A.5b extends.
- **Cross-project frame loader** (`src/lib/externalFrameResolver.ts`): can load any other project's DataFrame on demand, with throttled warnings, vault-event invalidation.
- **Transform pipeline** (`src/ui/views/Database/engine/transformExecutor.ts`): unnest, unpivot, compute, filter, group-by, aggregate, pivot, **join** (cross-source). Tested.
- **Formula engine**: 102 functions, AST evaluator, metadata registry, signature popover, debug panel.
- **Settings persistence** (`src/settings/`): v1 → v2 → v3 migrations, `fieldConfig` is plain `Record<string, FieldConfig>` per project, spread unchanged through every migrator.

### 3.3 What is broken or missing (the four gaps)

| # | Gap | Where it surfaces today |
|---|---|---|
| **G1** | `FieldConfig` does not encode Relation/Rollup configuration | `src/settings/base/settings.ts:188-197` — only `StringFieldConfig & DateFieldConfig` |
| **G2** | No cross-project relation resolver | `src/lib/engine/crossProjectResolver.ts` does not exist |
| **G3** | No cross-project rollup engine | `src/lib/engine/crossProjectRollup.ts` does not exist |
| **G4** | No typed property panel UI | Obsidian's native Properties pane shows YAML as plain key/value strings |

### 3.4 Latent runtime traps — type-system fall-throughs

These switches accept `DataFieldType.Relation` / `Rollup` / `Select` / `Status` / `Formula` syntactically (they are in the enum) but silently fall through to a default branch. The result is **no crash, but wrong UX**:

| Site | File:line | What falls through | Visible symptom |
|---|---|---|---|
| `parseRecords()` | `src/lib/datasources/helpers.ts` ~L31–64 | Relation/Rollup/Select/Status/Formula | Switch has no `default` and no cases for these types — raw YAML value passes through unparsed; downstream type assumptions may break. |
| `detectCellType()` | `src/lib/datasources/helpers.ts` ~L134–170 | Relation/Rollup/Select/Status/Formula | Auto-detection returns `Unknown` — schema inference fails. |
| `fieldIcon()` | `src/ui/views/helpers.ts` ~L11–32 | Relation/Rollup/Select/Status/Formula | Renders generic `file-question` icon. |
| `fieldDisplayText()` | `src/ui/views/helpers.ts` ~L34–56 | Relation/Rollup/Select/Status/Formula | Label shows `data-types.unknown`. |
| `getAggFnsForField()` | `src/ui/views/Database/widgets/DataTable/DataTableWidget.svelte` ~L312–320 | Relation/Select/Status/List/String | New types get only the default aggregation function set (count, count_values, etc.). Not a renderer; UX-low risk. |
| Relation cell display | `src/ui/views/Table/components/DataGrid/GridCell/GridRelationCell/GridRelationCell.svelte` | Cell shows raw wiki-link body, not `displayField` of the resolved record | Visible to the user as soon as Stage A ships data with `RelationFieldConfig`. |
| Agenda operator picker | `src/ui/views/Calendar/agenda/operatorHelpers.ts` ~L21–~L80 | Relation/Rollup/Select/Status/Formula | Only `is-empty`/`is-not-empty` available. |

These are **not blocking bugs today** because no project actually persists `Relation`/`Rollup` types yet (the FieldConfig is missing). But they will become user-visible defects the moment Stage A ships. They must be closed in Stage A alongside the engine work.

### 3.5 Documentation truth

- Active master: [ARCHITECTURE.md](ARCHITECTURE.md)
- Engine v2 spec (design): [architecture-engine-v2.md](architecture-engine-v2.md)
- Active plan: [IMPLEMENTATION_PLAN_CURRENT.md](IMPLEMENTATION_PLAN_CURRENT.md)
- Calendar: [ROADMAP_DATABASE_2026.md](ROADMAP_DATABASE_2026.md)
- Reference (frozen v3.3.x): [architecture-database-view.md](architecture-database-view.md), [database-view-pivot.md](database-view-pivot.md), [database-view-ui-ux.md](database-view-ui-ux.md)
- Archive: [archive/README.md](archive/README.md)

---

## 4. Stub catalogue — pre-emptive bug map

For each stub we list: **what to do**, **why now**, **risk if deferred**, **test that prevents regression**.

| ID | Site | Action | Why now (Stage A) | Test |
|---|---|---|---|---|
| S-1 | `parseRecords()` switch | Add 5 cases (Relation, Rollup, Select, Status, Formula). Relation: parse wiki-links into `string[]` of canonical link bodies; Rollup/Formula: keep raw value (computed elsewhere); Select/Status: clamp to `string`. | Prevents corrupt data the moment a user picks Relation type | `parseRecords.test.ts` — one assertion per type |
| S-2 | `detectCellType()` switch | Add inference rule: a value that is `[[..]]`-shaped string OR array of such strings → `Relation` candidate (only when no explicit FieldConfig says otherwise). | Otherwise auto-detected projects miss Relation columns | `detectCellType.test.ts` |
| S-3 | `fieldIcon()` | Map: Relation → `link`, Rollup → `sigma`, Select → `circle-dot`, Status → `flag`, Formula → `function-square`. Verify each name exists in the Lucide icon set already imported elsewhere. | UX consistency | Snapshot test on icon mapping |
| S-4 | `fieldDisplayText()` | Add i18n keys `data-types.relation/rollup/select/status/formula` in all 4 locales. | Labels and dropdowns | Component test that every enum literal has a label |
| S-5a | Relation cell display **schema-side** | In `parseRecords` (S-1) the Relation branch produces normalized `string[]` of link bodies. This is the data shape `GridRelationCell.svelte` already consumes today. **Schema-side only**, no renderer change. | Enables S-5b once derived field exists | Covered by S-1 test |
| S-5b | Relation cell display **renderer-side** | After Step A.4 ships the derived `__resolved__${fieldName}` field, extend `GridRelationCell.svelte` to prefer the resolved record's `displayField` when present, fall back to the link body otherwise. **Sequencing**: this row depends on Step A.4 — see §11 Q7. | Shipping Stage A with raw `[[Note]]` for Relation cells is unacceptable | E2E render test on a 2-project fixture |
| S-6 | Agenda operator picker | Add operators: Relation → `links-to`, `does-not-link-to`, `is-empty`, `is-not-empty`; Rollup → numeric operators (reuse Number set); Select/Status → `equals`, `in`, `not-in`. | Calendar/Agenda is a shipping view; users will expect filters | `operatorHelpers.test.ts` |

These seven items are **part of Stage A**. S-1–S-4, S-5a, S-6 land **before** Step A.4 so the engine work surfaces correctly under manual smoke. S-5b lands **after** Step A.4 because it depends on the derived field. Final order is detailed in §11 Q7.

---

## 5. The two-stage model

### Stage A — Engine v2 Foundation + UX polish (3.4.X internal, no public release)

**Outcome the user feels**: the plugin "stops feeling like a polished spreadsheet and starts feeling like an actual database tool". Concretely:

- A column in any project can be configured as **Relation** pointing to another project, and the cell shows the resolved record name, clickable, with autocomplete on edit.
- A column can be configured as **Rollup** that aggregates a numeric field of related records — the cell shows the computed value and a tooltip ("∑ from N records").
- A new view named **YAML Visualizer** (working name) shows the focused note's frontmatter as a typed property panel — with `RelationField`, `RollupField`, `FormulaField`, `DateField`, `SelectField` rendered correctly. This is the user's "visual representative of the YAML format".
- All six stub fall-throughs above are closed.

Stage A is shipped as a quality-gated internal milestone. **Not** published. The `manifest.json` stays at 3.4.1.

### Stage B — Full database completion + public release

**Outcome the user feels**: "I can now run my whole knowledge base inside this plugin without writing a single line of JSON." Concretely:

- Field-types UI in DataTable column config is complete (relation/rollup/formula/select/status all configurable through the cog).
- Formula Editor Popup is the single editor everywhere a formula is needed (DataTable computed columns, Stats card formulas, Properties Panel formula fields, FormulaBar in canvas).
- Transform pipeline editor is completable from UI alone (no JSON edit) for filter/aggregate/pivot/unpivot/unnest/join.
- Performance budget verified at 1 000 records.
- Documentation, demo vault, screenshots, CHANGELOG are all release-aligned.
- Version is bumped to 3.5.0+ and the plugin is republished — this is the **first public release with full Database**.

### Why this split (the engineering reason)

The user's intuition is correct: the engine work (M0) is what unlocks the rest. Doing M0 + the property panel (M2) + the stub closures together as Stage A yields a foundation that is **internally complete and externally testable on real vaults**, while leaving the highly-visible polish (Field Types UI, Formula Popup, Pipeline editor completion, public release) as Stage B — where polish iterations are cheap because the engine is stable.

If we did everything as one stage, two risks compound:
1. The engine could change shape during UI iteration → wasted UI work.
2. The pre-existing 923 tests could be broken silently by simultaneous engine + UI churn.

Splitting buys us a hard checkpoint: at the end of Stage A, the engine API is frozen and tests are green. Stage B then only paints the chrome.

---

## 6. Stage A — detailed blueprint

Each step is presented as: **goal → files (touched/created) → contract → test plan → mental simulation of bugs**. No code is to be written until §11 (open questions) is answered.

### Step A.1 — Extend `FieldConfig` (M0.1)

**Goal**: Add `RelationFieldConfig` and `RollupFieldConfig` as namespaced sub-objects on `FieldConfig`, additively, without breaking 923 tests.

**Files** (all edits, no new files):

| File | Change |
|---|---|
| `src/settings/base/settings.ts:188-197` | Add the two type aliases; extend `FieldConfig` intersection by `& { readonly relation?: RelationFieldConfig; readonly rollup?: RollupFieldConfig }` |
| (no other file edits) | Migration chain spreads `fieldConfig` unchanged → forward-compatible |

**Contract**:

```ts
export type RelationFieldConfig = {
  readonly targetProjectId: string;
  readonly displayField?: string;       // default: file basename
};

export type RollupFieldConfig = {
  readonly relationField: string;       // a Relation-typed field on THIS project
  readonly targetProjectId?: string;    // when omitted, inferred from relation field
  readonly targetField: string;
  readonly function: RollupFunction;    // imported from existing rollup.ts
  readonly separator?: string;          // for join-type rollups, default ", "
};

export type FieldConfig =
  StringFieldConfig
  & DateFieldConfig
  & {
      readonly relation?: RelationFieldConfig;
      readonly rollup?: RollupFieldConfig;
    };
```

**Test plan**:

- New: `src/settings/__tests__/fieldConfig.relation.test.ts` — round-trip a config through migration + serialization + resolve, both with and without the new keys.
- Existing 923 tests: must remain green (all existing `fieldConfig: {}` literals stay valid because both keys are optional).

**Pre-emptive bug check (mental simulation)**:

- `exactOptionalPropertyTypes: true` in `tsconfig.json` forbids `relation: undefined`. Mitigation: in code that builds a config object, use conditional spread — `{ ...base, ...(rel ? { relation: rel } : {}) }`. Already used elsewhere in the codebase (e.g., `useView.ts` for `saveViewFilter`), so the pattern is familiar.
- Settings store `updateFieldConfig` already accepts `FieldConfig` by parameter; TypeScript contravariance handles the wider type automatically.
- Persistence: `saveData` writes the whole `LatestProjectsPluginSettings` blob. New keys are silently preserved on read. Old plugin versions reading the new blob ignore unknown keys, which is forward-compatible.

### Step A.2 — Create `crossProjectResolver.ts` (M0.2)

**Goal**: a pure module that resolves wiki-links of a `RelationFieldConfig` field to records of an external DataFrame. No Obsidian APIs, only pure data + `externalFrameResolver` for loading.

**Files** (one new):

| File | Type |
|---|---|
| `src/lib/engine/crossProjectResolver.ts` | NEW |
| `src/lib/engine/__tests__/crossProjectResolver.test.ts` | NEW |

**Contract**:

```ts
/** Resolve all wiki-links in record[fieldName] to records of externalFrame.
 *  Returns an empty array if the field is empty or all links unresolved.
 *  Pure: no IO, no caching. Caller controls externalFrame lifetime. */
export function resolveCrossProjectRelations(
  record: DataRecord,
  fieldName: string,
  externalFrame: DataFrame,
  displayField?: string,        // canonical key for index; default: file basename
): DataRecord[];

/** Enrich every record of `frame` with a derived field whose value is the
 *  list of resolved DataRecords from `externalFrame`. The derived field is
 *  named `__resolved__${fieldName}` and is marked `derived: true` so it does
 *  not round-trip into YAML.
 *
 *  Per-call memoization: the lookup index over externalFrame is built ONCE
 *  per invocation, keyed by (externalFrame identity, displayField).
 */
export function enrichFrameWithRelations(
  frame: DataFrame,
  fieldName: string,
  config: RelationFieldConfig,
  externalFrame: DataFrame,
): DataFrame;

/** Compose multiple relation enrichments. Caller provides a map
 *  `targetProjectId → externalFrame` and the function walks `frame.fields`,
 *  applying `enrichFrameWithRelations` for every field whose typeConfig.relation
 *  is set and whose targetProjectId is present in the map. Missing target
 *  frames are skipped with a throttled warning (no exception).
 *
 *  This is the real entry point used by Step A.4. The single-target API above
 *  is the primitive it composes.
 */
export function enrichFrameWithAllRelations(
  frame: DataFrame,
  externalFrames: ReadonlyMap<string, DataFrame>,
): DataFrame;
```

**Algorithm**:

1. For each record in `frame`, read raw value of `fieldName`.
2. Normalize to `string[]` of wiki-link bodies (strip `[[ ]]`, ignore alias `|...`).
3. Look up each body in an index built once over `externalFrame.records` keyed by `config.displayField` if set, else the canonical `file.name` field surfaced by all three datasources (frontmatter / tag / dataview), with explicit fallback to `record.id` when neither is available.
4. Build the `__resolved__${fieldName}` derived value as a list of `DataRecord` references.

**Index strategy**: build the index lazily, once per `enrichFrameWithRelations` invocation, **memoized by `(externalFrame, displayField)`** so multiple enrichments against the same target project in the same datasource pass do not rebuild. Cross-call (cross-render) memoization is **out of scope** for this step (deferred to Stage B).

**Test plan** (covers PDF schema scenario "Base 1 Accounts ↔ Base 2 Journal"):

- Resolves a single `[[Account 1]]` wiki-link in journal → matched account record.
- Resolves a multi-link list `[[A]], [[B]]` → two matched records, in order.
- Unmatched link → ignored, console.warn (throttled).
- Empty/null/undefined field → empty array, no error.
- Alias syntax `[[Account 1|Custom Name]]` → resolved by the canonical body.
- `displayField` set to a non-name field → index built from that field.

**Pre-emptive bug check**:

- Path normalization: `MetadataCache.getFirstLinkpathDest` is the canonical Obsidian way. Since this module is pure, we accept the resolved name directly from the caller (datasource layer does the lookup). This separates concerns and lets Jest test the module without an Obsidian shim.
- Cycle: A → B → A relations are not a problem at this layer (we resolve one direction at a time).
- Empty `externalFrame.records`: returns `[]`, no throw.

### Step A.3 — Create `crossProjectRollup.ts` (M0.3)

**Goal**: pure module that computes a rollup value for one record (or one column for a whole frame) given a `RollupFieldConfig` and the external frame.

**Files**:

| File | Type |
|---|---|
| `src/lib/engine/crossProjectRollup.ts` | NEW |
| `src/lib/engine/__tests__/crossProjectRollup.test.ts` | NEW |

**Contract**:

```ts
// NOTE: type renamed to avoid collision with existing `RollupResult` in
// src/ui/views/Database/engine/rollup.ts (which has shape { value, formattedValue }).
export interface CrossProjectRollupResult {
  readonly value: DataValue;
  readonly sourceCount: number;        // for tooltip "from N records"
  readonly errors: readonly string[];  // schema mismatches, never throws
}

/** Compute a rollup for a single record. */
export function computeCrossProjectRollup(
  record: DataRecord,
  config: RollupFieldConfig,
  thisFrame: DataFrame,         // current project frame, used to read relation field
  externalFrame: DataFrame,     // the project being aggregated FROM
): CrossProjectRollupResult;

/** Compute the rollup column for every record. Returns a map of record.id → result. */
export function computeCrossProjectRollupColumn(
  thisFrame: DataFrame,
  config: RollupFieldConfig,
  externalFrame: DataFrame,
): Map<string, CrossProjectRollupResult>;
```

**Kernel sharing strategy** (closes R-6 properly): the existing `aggregate(values, config)` in `src/ui/views/Database/engine/rollup.ts` is a **private** function today. Step A.3 does **not** duplicate it. Instead:

1. As a one-line edit inside `rollup.ts`, mark `aggregate` as `export` (renaming if needed to a clearly-public name such as `applyAggregation`).
2. `crossProjectRollup.ts` imports it. The pure kernel is therefore singular and any future change touches one place.
3. The cross-project module owns the relation-resolution glue (Step A.2) and the `RollupFieldConfig` adaptation, but never re-implements the math.

**Algorithm**:

- For each record in `thisFrame`:
  1. Resolve its `relationField` to records of `externalFrame` (reuses Step A.2).
  2. Extract `targetField` values from those records.
  3. Apply `RollupFunction` (reusing existing `rollup.ts` aggregation kernel; the cross-project version is a wrapper, not a re-implementation).

**Test plan** (Base 1 Accounts ↔ Base 2 Journal):

- "Current balance" = `SUM(amount)` of journal entries linked to this account.
- "Last transaction date" = `MAX(date)` rollup.
- "Transaction count" = `COUNT` rollup.
- Empty relation → `{ value: 0 / null / "", sourceCount: 0 }` with function-appropriate identity.
- Type mismatch (`SUM` over a string field) → `errors: [...]` and `value: null`.

**Pre-emptive bug check**:

- Reuse, do not duplicate, the aggregation function implementations from `src/ui/views/Database/engine/rollup.ts`. Either re-export from there or import. This prevents drift between in-frame and cross-frame rollups.
- Backlinks (Base 1 sees rollup of Base 2): the contract says `relationField` is on Base 2 (the external side); the engine performs an inverse index pass over `externalFrame` to find rows that link back to the current Base 1 record. This is the design from `architecture-engine-v2.md §4.2`. Tests must cover both directions.

### Step A.4 — Datasource enrichment (M0.4)

**Goal**: when a project's `fieldConfig` declares relation/rollup fields, the resulting `DataFrame` is enriched with derived fields **before** it reaches view widgets.

**Wiring layer** (corrected after audit): the enrichment is **not** added inside `FrontmatterDataSource.queryFiles()`. The datasource has no `externalFrameResolver` in its constructor, and threading one through every datasource (frontmatter / tag / dataview) inflates the surface. Phase 5 already wired `externalFrameResolver` into `ViewApi` (the layer immediately above the datasource). Stage A places enrichment **at the same layer**: in the `useView` data path, after the datasource returns a raw frame and before the frame is handed to the view component.

**Files** (edits):

| File | Change |
|---|---|
| `src/ui/views/useView.ts` (or the closest equivalent ViewApi closure that owns the frame post-datasource) | After the raw frame is produced: scan `project.fieldConfig` for entries with `relation` or `rollup`. If any present, build `Map<targetProjectId, DataFrame>` by calling `externalFrameResolver` (already in scope) for each unique target id. Then call `enrichFrameWithAllRelations(frame, externalFrames)` followed by per-rollup-field `computeCrossProjectRollupColumn`. |
| `src/ui/views/Database/DatabaseViewCanvas.svelte` | Extend `collectReferencedSourceIds(widgets, project)` to also walk `project.fieldConfig` and union every `relation.targetProjectId` and `rollup.targetProjectId` into the pre-load set. This closes the Phase-5 `referencedSourceIds` gap so the existing pre-load + cache-invalidation infrastructure covers Stage A cross-project relations and rollups without a parallel code path. |
| `src/customViewApi.ts` | No change — `ProjectViewProps` shape stays the same; views receive the already-enriched frame transparently. |
| `src/ui/app/App.svelte` | No change. |

**Test plan**:

- Integration test (`twoProjects.integration.test.ts`): build a 2-project mock (`Accounts`, `Journal`) with `relation` and `rollup` configured; drive through the ViewApi closure; assert `__resolved__` derived field present and rollup column produced.
- `collectReferencedSourceIds` unit test: assert that adding a `relation` to `fieldConfig` causes the target project id to appear in the result, equivalently to a `transform.steps[*].type === "join"` reference.
- Performance probe (informational): measure enrichment time at 1 000 records; record baseline for Stage B budget.

**Pre-emptive bug check**:

- **Cycle handling lives in `externalFrameResolver`, not here.** See R-3 mitigation in §9.
- Cache invalidation: `externalFrameResolver` already invalidates on vault events (Phase 5 work). Enriched-frame consumers re-render via the existing reactive pipeline. Assert with an explicit step in the integration test (mock vault change → expect re-enrichment).
- Concurrent edits across projects: when target frame invalidates mid-render, `enrichFrameWithAllRelations` produces a frame with the previous target snapshot; the next reactive tick re-runs with the new snapshot. No partial-update state is exposed to the view.

### Step A.5 — Stub closures (split into A.5a and A.5b)

This is the §4 catalogue. Items are split into two sub-steps because S-5b depends on Step A.4's derived field, while everything else is dependency-free.

#### Step A.5a — Stubs that ship before Step A.4 (S-1, S-2, S-3, S-4, S-5a, S-6)

| File | Edit |
|---|---|
| `src/lib/datasources/helpers.ts` (parseRecords switch) | Add 5 case branches. Relation parses wiki-link strings to a normalized `string[]`; Select/Status pass through as string; Formula/Rollup leave the raw value alone (computed elsewhere). |
| `src/lib/datasources/helpers.ts` (detectCellType switch) | Add detection rule: arrays of `[[..]]`-shaped strings → Relation; everything else uses existing logic. |
| `src/ui/views/helpers.ts` (fieldIcon) | Add 5 icon mappings. Verify each name exists in the Lucide set already imported. |
| `src/ui/views/helpers.ts` (fieldDisplayText) | Add 5 i18n key mappings. |
| `src/ui/views/Calendar/agenda/operatorHelpers.ts` | Add Relation/Rollup/Select/Status/Formula operator sets. |
| 4 × `src/lib/stores/translations/{en,ru,uk,zh-CN}.json` | Add `data-types.relation/rollup/select/status/formula` keys + view registration labels. **All 4 locales in the same commit.** |

#### Step A.5b — Renderer-side stub closure that ships after Step A.4 (S-5b)

| File | Edit |
|---|---|
| `src/ui/views/Table/components/DataGrid/GridCell/GridRelationCell/GridRelationCell.svelte` | Extend the existing renderer: when the row's `__resolved__${fieldName}` derived field is present, prefer the resolved record's `displayField` (default: file basename) for the visible label; click still opens the linked note. Fall back to the current raw-link-body behaviour when the derived field is absent (so the renderer is also safe in any view that bypasses Step A.4 enrichment). |

**Test plan**: each helper file gets a unit test that asserts every enum literal has a defined branch (uses `Object.values(DataFieldType).forEach(...)` to make exhaustiveness automatic). Snapshot test on the cell renderer covering both states (with derived field, without).

**Pre-emptive bug check**:

- Adding default operators for new types must not break the existing operator UI in `FilterEditor`. Confirm by running the Filter Editor e2e test after the change.
- Icon names must exist in the Lucide set. Verify against the icons currently imported elsewhere.
- `getAggFnsForField` (in `DataTableWidget.svelte`) is **not** edited in Stage A: the existing default-aggregation behaviour for Relation/Select/Status is acceptable until Stage B adds full Field-Types UI.

### Step A.7 — YAML Визуализатор (M2 — Notion-parity sub-plugin)

**Anchor milestone**: M2 "Custom Properties Viewer" from `ROADMAP_DATABASE_2026.md`.

**Goal**: a new project view type `yaml-visualizer` that **replaces** Obsidian's native Properties pane within projects-plus context, and acts as a **functional extension layer** (sub-plugin) over frontmatter. It is not just a renderer — it is the integration point that makes Engine v2 (relations, rollups, formulas) visible and editable to the end user. Without it, the engine work in A.1–A.6 has no first-class user surface.

**Notion-parity reference** (user-supplied screenshots, 2026-04-30): the visualizer must reach feature parity with Notion's per-record property panel on six surfaces:

| # | Notion surface | Our equivalent in Stage A |
|---|---|---|
| 1 | Per-property hover menu (Rename / Edit property / Comment / Property visibility / Duplicate / Delete / Customize layout) | `PropertyRowMenu.svelte` — context menu opened from a row's drag handle. **Stage A**: Rename, Edit property, Property visibility (show/hide), Duplicate, Delete, Customize layout (basic: collapsed/expanded/grid). **Stage B (M1)**: Comment requires a separate notes-on-fields surface — explicit stub. |
| 2 | Type editor (Type / Number format / Decimal places / Show as: Number-Bar-Ring) | `PropertyTypeEditor.svelte` — switches `field.type` and renders a per-type sub-form. **Stage A**: type switcher + format selectors for Number (decimals, currency) and Date (format string). **Show-as-Bar/Ring** rendering for Number is registered as **Stage B (M1)** stub — schema lands in Stage A so `field.config.showAs` round-trips, renderer ships in Stage B. |
| 3 | Inline Relation cell with adaptive overflow & expand | `RelationFieldRow.svelte` + shared `RelationListView.svelte` consumed by both this row and `GridRelationCell.svelte` (Step A.5b). The list adapts to container width, shows the first N items inline, then a "+K more" affordance that expands a popover with the full list. Click on any item opens the linked note. (User's answer to Q3.) |
| 4 | Relation property config (Type=Relation, Related to=Project, Limit, Two-way relation toggle) | `RelationConfigEditor.svelte` — picker for `targetProjectId`, optional `displayField`, optional `limit` (Stage A schema only; runtime cap = Stage B), toggle `twoWay` (schema lands Stage A; auto-mirroring write-back is Stage B with explicit stub registered). |
| 5 | Formula editor modal (full-screen expression input + live preview + categorised builtin list with example copy) | `FormulaFieldRow.svelte` ships a **read-only** computed display with an "Open editor" button. The button mounts `FormulaEditorModal` — the Stage A version is a **minimum-viable wrapper** around the existing `FormulaBar` widget, preserving its 102-function metadata + signature popover; full Notion-parity polish (live preview pane, copy-example buttons, multi-line layout) is Stage B (M3). The Stage A button is **not** disabled: it opens the MVP modal so users can author formulas immediately. |
| 6 | Sort/filter inside the property panel + show/hide property visibility | `VisualizerToolbar.svelte` — same operator semantics as the existing project-wide filter editor (reused from `src/ui/views/Database/widgets/Filters/`). Sort by any property; per-property show/hide persisted in `YamlVisualizerConfig.hiddenFields: string[]`; sort/filter persisted per view. |

This is the **"sub-plugin within the plugin"** the user described: a self-contained property workspace that integrates Engine v2 outputs (resolved relations, rollup values, formula results) into a single editing surface, replacing Obsidian's native pane wherever a project file is open inside a projects-plus view tab.

**Files** (all new unless noted):

| File | Purpose |
|---|---|
| `src/ui/views/YamlVisualizer/types.ts` | `YamlVisualizerConfig { hiddenFields, sortField, sortAsc, filters, layout: "compact" \| "comfortable" \| "grid" }` |
| `src/ui/views/YamlVisualizer/yamlVisualizerView.ts` | `class YamlVisualizerView extends ProjectView<YamlVisualizerConfig>` |
| `src/ui/views/YamlVisualizer/YamlVisualizer.svelte` | Top-level component: header, toolbar, property list, empty state |
| `src/ui/views/YamlVisualizer/VisualizerToolbar.svelte` | Sort + filter + show/hide controls + layout switch |
| `src/ui/views/YamlVisualizer/PropertyRow.svelte` | Generic row chrome (drag handle, label, value slot, menu trigger) |
| `src/ui/views/YamlVisualizer/PropertyRowMenu.svelte` | Per-property context menu (rename / edit property / visibility / duplicate / delete / layout) |
| `src/ui/views/YamlVisualizer/PropertyTypeEditor.svelte` | Inline editor for `field.type` + per-type config |
| `src/ui/views/YamlVisualizer/RelationConfigEditor.svelte` | Relation-specific config UI (target project, displayField, limit-schema, twoWay-schema) |
| `src/ui/views/YamlVisualizer/FormulaEditorModal.svelte` | MVP wrapper around `FormulaBar` for the "Open editor" button |
| `src/ui/views/YamlVisualizer/RelationListView.svelte` | **Shared** with `GridRelationCell.svelte` — adaptive overflow with "+K more" expand popover |
| `src/ui/views/YamlVisualizer/fields/StringFieldRow.svelte` | String/Select/Status |
| `src/ui/views/YamlVisualizer/fields/NumberFieldRow.svelte` | Number with locale-aware formatting |
| `src/ui/views/YamlVisualizer/fields/DateFieldRow.svelte` | Date with picker |
| `src/ui/views/YamlVisualizer/fields/BooleanFieldRow.svelte` | Toggle |
| `src/ui/views/YamlVisualizer/fields/RelationFieldRow.svelte` | Uses `RelationListView` for display; autocomplete dropdown for editing |
| `src/ui/views/YamlVisualizer/fields/RollupFieldRow.svelte` | Read-only computed; localized text "Aggregated from {N} records" |
| `src/ui/views/YamlVisualizer/fields/FormulaFieldRow.svelte` | Read-only display + "Open editor" → `FormulaEditorModal` |
| `src/ui/views/YamlVisualizer/fields/ListFieldRow.svelte` | Multi-value array editing |
| `src/ui/views/YamlVisualizer/index.ts` | Re-exports |
| `src/view.ts` (edit) | Register `YamlVisualizerView` in `getProjectViews()` |
| 4 × translation files (edit) | All visualizer + menu + type-editor labels |
| `src/ui/views/YamlVisualizer/__tests__/*.test.ts` | One suite per field-row + one for `RelationListView` overflow + one integration for full panel |

**Replacement of Obsidian's native pane** (user's Q1 directive):

- Within a projects-plus view tab, when YamlVisualizer is the active view, the user manipulates frontmatter through this surface. Obsidian's native Properties pane in the same window remains read-only-effectively because all writes from YamlVisualizer go through `app.fileManager.processFrontMatter` and Obsidian's pane reflects the result automatically via `MetadataCache.on("changed")`. **No monkey-patching of Obsidian internals** — the "replacement" is contextual, not global.
- A standalone leaf-mode (sidebar following the focused note across vault) is registered as a **Stage B stub** (`stubs.md` entry `STB-VISUALIZER-LEAF`).

**Adaptive Relation overflow** (user's Q3 directive):

- `RelationListView` props: `items: RelatedRecord[]`, `maxVisible?: number = 'auto'`, `direction: 'row' | 'column'`.
- `'auto'` mode uses a `ResizeObserver` on the container; items render in a flex row with `flex-wrap: nowrap` and overflow detection. Hidden items roll into a single "+K more" pill that opens a popover with the full list.
- The same component is consumed by `GridRelationCell.svelte` (Step A.5b) so table cells and visualizer rows share one overflow algorithm.
- All items are individually keyboard-focusable; the popover is dismissible by Esc and click-outside.

**Stage A boundary for YAML Визуализатор**:

- ✅ All 9 field-type rows render correctly (8 from baseline + Status as Stage-A schema-only; rendered via StringFieldRow until M1).
- ✅ Read works for all types including Rollup and Formula.
- ✅ Edit works for: String, Number, Boolean, Date, List, Relation (single + array with overflow).
- ✅ Property menu (Rename, Visibility, Duplicate, Delete, Customize layout) functional.
- ✅ Type editor switches type + Number/Date format options + Relation config.
- ✅ Formula MVP modal opens and saves expressions (uses existing FormulaBar engine).
- ✅ Toolbar: sort by any field, filter (reuses project filter operators), show/hide.
- 🚫 **Stage B stubs** (registered in `.ai_internal/stubs.md`):
  - `STB-VISUALIZER-LEAF` — standalone workspace leaf mode.
  - `STB-VISUALIZER-COMMENT` — per-property comment thread (Notion surface 1).
  - `STB-VISUALIZER-SHOWAS` — Bar/Ring numeric visualisation modes (Notion surface 2).
  - `STB-VISUALIZER-LIMIT` — runtime cap on Relation array length (Notion surface 4).
  - `STB-VISUALIZER-TWOWAY` — auto-mirroring on two-way relations (Notion surface 4).
  - `STB-VISUALIZER-FORMULA-POLISH` — full Notion-parity formula modal (live preview, copy-example, multi-line) — completes M3.
  - `STB-VISUALIZER-DRAG-REORDER` — drag to reorder properties.
  - `STB-VISUALIZER-BULK-EDIT` — multi-select edit.

**Test plan**:

- Unit: every field-row renders + dispatches edit; `RelationListView` overflow correctness at multiple container widths (jsdom width mock).
- Integration: `processFrontMatter` is the only write path; concurrent-edit last-write-wins rule (R-4) verified.
- Snapshot: empty / single-record / all-types record / overflow-with-popover.
- E2E: visualizer appears in Add View modal (registration); Notion-parity flow `view → edit type → save` round-trips through settings.

**Pre-emptive bug check**:

- `MetadataCache.on("changed")` subscription must be torn down in `onClose` to avoid leaks; pattern already used elsewhere.
- Last-write-wins rule (R-4): if cache fires for the file currently being edited in a row, drop the in-flight visualizer edit and re-render. No merge attempted in Stage A.
- Property ordering: render order follows the project's `fields` array filtered by `hiddenFields`, not `Object.keys(record.values)`.
- Replacement boundary: do **not** patch Obsidian's internal Properties view. Replacement is contextual (active view tab) only.
- Relation array writes: always YAML array form, even for single-element lists (user's Q3).

### Step A.8 — Internal release of Stage A (no public release)

**Definition of done for Stage A**:

1. `tsc --noEmit` → 0 errors.
2. `npx jest` → ≥ 64 suites / ≥ 1 020 tests PASS (baseline 54/923 + ≥ 10 new suites covering: fieldConfig.relation, crossProjectResolver, crossProjectRollup, parseRecords switch, detectCellType, operatorHelpers, i18n parity, RelationListView overflow, YamlVisualizer integration, twoProjects integration; estimated +97 tests). Higher than the previous +77 estimate because the YAML Визуализатор sub-plugin grew per Q6.
3. `node esbuild.config.mjs production` → success.
4. `npm run svelte-check` → 0 errors / 0 warnings.
5. Manual smoke test in the demo vault: existing demo views still work; YAML Визуализатор appears in Add View and exercises all 6 Notion-parity surfaces from §A.7 on at least one project.
6. CHANGELOG: `[Unreleased — Stage A: Engine v2 + YAML Визуализатор]` section lists every closed gap, every shipped feature, and every registered stub by ID.
7. `manifest.json` and `package.json` bumped to **`3.4.2`** (was `3.4.1`).
8. `.ai_internal/context_state.md` updated.
9. `.ai_internal/stubs.md` registry contains every Stage-B-deferred item from §A.7 + any new ones discovered during implementation; each entry has `id`, `location`, `deferred-to`, `rationale`, `discovered-by`.
10. Documentation Standardization Pass §14.1 (terminology + entry-point + repo-root cleanup) is **complete and verified by auditor**.

---

## 7. Stage B — outline (planned, not yet detailed)

Stage B takes the engine that Stage A hardens and paints the user-visible chrome on top.

### W2.1 — Field Types UI in DataTable column config (M1)

The DataTable column cog gains UI for selecting Relation/Rollup configuration. Picker for target project, picker for `displayField`, picker for `targetField` and aggregation function. The cog already exists (Phase 2a `configPanelRegistry`); only the column-config editor needs the new branches.

### W2.2 — Formula Editor Popup (M3)

A unified `FormulaEditorModal` that replaces the inline FormulaBar editor and is reused by `FormulaFieldRow` (in YAML Visualizer), DataTable computed columns, and StatsCard formula KPIs. UI matches the PDF schema: input area, live preview, function categories, copy-example buttons, completion from the project's field list.

### W2.3 — YAML Visualizer polish

Wires `FormulaFieldRow.openEditor()` to the popup, adds drag-reorder of fields, optional inline grouping by category.

### W2.4 — Pipeline editor completion (M4)

Filter, aggregate, pivot, unpivot, unnest, join — all editable from UI alone. Step-by-step preview. Inline validation.

### W2.5 — Stabilization, docs, release readiness (M5)

Performance pass (1 000-record budget), accessibility pass (axe-clean modals and views), documentation refresh, screenshots, demo vault upgrade. Final user approval to bump `manifest.json` to `3.5.0`. First public release with full Database.

---

## 8. Cross-cutting concerns

### 8.1 Testing strategy

- **Unit**: every new module gets one suite. Existing modules touched by stub closures get an exhaustiveness test that iterates `Object.values(DataFieldType)` and asserts no fall-through to `default` for known types.
- **Integration**: the `Accounts ↔ Journal` two-project scenario from the engine-v2 PDF schema is the canonical integration test. It will live under `src/lib/engine/__tests__/twoProjects.integration.test.ts` and exercise resolver + rollup + datasource enrichment together.
- **Component**: each new `*FieldRow.svelte` gets a Vitest/Jest+jsdom suite asserting render + edit dispatch.
- **E2E**: the existing `databaseView.e2e.test.ts` is extended to cover Relation column rendering. A new minimal e2e for YamlVisualizer asserts registration discovery.

### 8.2 Migration safety

- `FieldConfig` extension is **purely additive**. No data migration required. `fieldConfig` blobs from older settings keep loading.
- The `__resolved__${fieldName}` derived fields are computed in-memory only and never serialized. They have `derived: true` on the `DataField`, which the existing pipeline already excludes from YAML round-trip (verified in `dataApi.ts:applyRecordToFrontmatter`).
- The new YamlVisualizer view, when added by a user, is persisted as `ViewDefinition { type: "yaml-visualizer", ... }` — older plugin versions that read this blob will silently ignore it (the `getProjectViews()` lookup returns `undefined` and `useView.ts` falls back gracefully).

### 8.3 Performance

- Stage A establishes only the *baseline* measurement. No hard budget yet.
- Stage B enforces "render under 100 ms for 1 000 records" by:
  - Memoizing relation indexes per `(projectId, externalProjectId)` pair across renders.
  - Skipping enrichment when `fieldConfig` has no relation/rollup keys.
  - Reusing `transformCache` semantics (already extended for join steps in Phase 5).

### 8.4 Internationalization

- All new user-facing strings must land in 4 locales (`en/ru/uk/zh-CN`) in the same PR that introduces them.
- The CI doesn't currently enforce key parity across locales (a known gap); we keep the existing convention of synchronizing manually.

### 8.5 Accessibility

- YamlVisualizer property rows must be keyboard-navigable (Tab through rows, Enter to edit, Esc to cancel).
- Focus rings remain `2px` per Zero Pixels exception list.
- Field-type icons use `aria-hidden`; the visible label is the source of truth for screen readers.

---

## 9. Risk register

| # | Risk | Phase | Severity | Mitigation |
|---|---|---|---|---|
| R-1 | Cross-project rollup performance degrades with many relation columns | A.4 | HIGH | Lazy enrichment + index reuse; defer hard budget to Stage B |
| R-2 | `exactOptionalPropertyTypes` + `noPropertyAccessFromIndexSignature` + `noUncheckedIndexedAccess` break naive config builders or bracket-spread literals like `{ ...field.typeConfig, relation: ... }` when relation is conditionally absent | 1.1 | MEDIUM | Conditional spread pattern, dedicated lint rule already in CODE_STANDARDS, plus targeted test that constructs a `FieldConfig` with and without `relation` to lock the contract |
| R-3 | Cycle in relation graph (A→B→A) causes infinite recursion during enrichment | A.4 | MEDIUM | Cycle detection lives **inside `externalFrameResolver`** (the only component with whole-graph visibility), not in the datasource. Resolver maintains a per-resolution-pass `Set<projectId>` and short-circuits with a logged warning + empty frame when a cycle is encountered. Stage A adds a dedicated unit test for the A→B→A scenario. |
| R-4 | YamlVisualizer concurrent-edit data loss when user edits in Obsidian's native editor at the same time | 1.6 | MEDIUM | Always `processFrontMatter`; never write file blob; subscribe to `MetadataCache.on("changed")` to refresh on external edits |
| R-5 | Stub closures change icon mapping / display text and silently break user vaults | 1.5 | LOW | New mappings only; never re-purpose an existing key. Snapshot tests catch drift. |
| R-6 | Stage A ships hidden inconsistency between in-frame `rollup.ts` and cross-frame `crossProjectRollup.ts` | 1.3 | MEDIUM | Export the existing private `aggregate(values, config)` from `rollup.ts` as a public function (one-line `export` change). `crossProjectRollup.ts` imports and reuses it; the math has a single source of truth. Type-name collisions resolved by renaming the new module's result type to `CrossProjectRollupResult`. |
| R-7 | Test count drops because we accidentally remove an old test while extending types | all | LOW | Pre-flight `git diff --stat src/.../__tests__/` audit per phase |
| R-8 | `getFirstLinkpathDest` semantics differ between platforms | 1.2 | LOW | Resolver module is pure; the lookup is done in datasource layer where Obsidian APIs are real. Tests use a controlled mock. |
| R-9 | YamlVisualizer view registration collides with future Obsidian view-type names | 1.6 | LOW | Use the namespaced ID `yaml-visualizer` (with the project-view discriminator already isolated from Obsidian's leaf view types) |
| R-10 | i18n key parity drift across `en/ru/uk/zh-CN` — Stage A adds ~15 keys per locale and CI does not enforce parity | A.5a, A.7 | MEDIUM | Add `src/lib/stores/translations/__tests__/parity.test.ts` that loads all 4 JSON files and asserts identical key sets. Test ships in Step A.5a so it gates every subsequent translation edit. |
| R-11 | `referencedSourceIds` collection in `DatabaseViewCanvas.svelte` is currently widget-scoped; Stage A needs it to also see `fieldConfig.relation/rollup.targetProjectId` | A.4 | MEDIUM | Extension is mechanical (one extra walk over `project.fieldConfig`); a unit test asserts the union behaviour to prevent regressions when the structure of `fieldConfig` evolves in Stage B. |

---

## 10. Verification gates (every phase, no exceptions)

Per director-mode protocol:

1. `npm run svelte-check` → 0 errors / 0 warnings.
2. `npx jest --no-coverage` → all suites pass; test count grows or stays equal (never drops).
3. `node esbuild.config.mjs production` → success.
4. `tsc --noEmit` → 0 errors.
5. Manual smoke in the demo vault.
6. `.ai_internal/context_state.md` updated.
7. Auditor subagent invocation with PASS verdict before declaring the phase done.

**No commit and no push without explicit user approval.** This rule is unchanged.

---

## 11. Open questions — ANSWERED 2026-04-30

All eight items are closed. The verbatim user answers and the resulting plan adjustments live in the **REVISION 2** block at the top of this document. Summary table:

| # | Topic | Resolution |
|---|---|---|
| 11.1 | Visualizer surface | Replaces native Properties pane (contextually); deep functional extension; sub-plugin scope. |
| 11.2 | Display name | YAML Визуализатор (ru) / YAML Visualizer (en) / Перегляд YAML (uk) / YAML 可视化器 (zh-CN). |
| 11.3 | Relation write | Array form always; adaptive UI with overflow + expand popover; shared `RelationListView`. |
| 11.4 | Internal release | Bump to **3.4.2** (avoid colliding with public 3.4.1). |
| 11.5 | Stubs | Phased rollout; **all** deferred items tracked rigorously in `.ai_internal/stubs.md` (§13). |
| 11.6 | Visualizer depth | Notion-parity sub-plugin (6 surfaces); see §A.7 for the full spec. |
| 11.7 | Execution order | A.1 → A.5a → A.2 → A.3 → A.4 → A.5b → A.7 → A.8 (architecturally optimal). Step numbers A.6 reserved (intentional gap to keep A.7 = M2 anchor). |
| 11.8 | Documentation | Project-wide standardization pass; not just `docs/`. See §14. |

---

---

## 12. Approval checklist — closed

This is the contract for Stage A.

- [x] Mission and boundaries (§1, §2) approved.
- [x] Two-stage model (§5) approved (terminology aligned with M0..M5).
- [x] Stage A step list (§6) approved.
- [x] Stub catalogue (§4) approved as part of Stage A.
- [x] Risk register (§9) reviewed.
- [x] Open questions §11 answered (REVISION 2 block).
- [x] Verification gates (§10) accepted.
- [x] No-commit / no-push policy reaffirmed.
- [x] Stub & TODO discipline (§13) accepted.
- [x] Documentation & terminology standardization (§14) accepted as a parallel work-stream.

**Pre-coding obligations** before Step A.1 starts:

1. Create `.ai_internal/stubs.md` with the registry skeleton (§13).
2. Execute §14.1 "Documentation Standardization Pass — phase 1" (terminology lock + repo-root entry-point fix). This produces a baseline before any code touches `src/`.
3. Create `memories/session/handoff.md` summarising the agreed plan for context transfer between sessions.

Steps 1–3 above are themselves not code edits to `src/`; they are documentation and process scaffolding. Code edits to `src/` start only at Step A.1 (FieldConfig extension).

---

## 13. Stub & TODO discipline

The user (Q5) requires that **every** "left for the future" code anchor is recorded — no implicit deferrals. This section defines the registry and the rules.

### 13.1 Registry file: `.ai_internal/stubs.md`

The single source of truth. New file, created before Step A.1. Format:

```markdown
# Stubs registry — obs-projects-plus

| ID | Status | Location | Type | Deferred to | Rationale | Discovered |
|----|--------|----------|------|-------------|-----------|------------|
| STB-VISUALIZER-LEAF | open | n/a (new file) | feature | Stage B / M3+ | Standalone leaf mode is out of Stage A scope; visualizer ships as project-view first | 2026-04-30 §A.7 |
| STB-VISUALIZER-COMMENT | open | YamlVisualizer/PropertyRowMenu.svelte | feature | Stage B / M1 | Per-property comment thread requires notes-on-fields infrastructure | 2026-04-30 §A.7 |
| STB-VISUALIZER-SHOWAS | open | YamlVisualizer/PropertyTypeEditor.svelte | feature | Stage B / M1 | Show-as Bar/Ring needs visual primitives; schema lands Stage A | 2026-04-30 §A.7 |
| STB-VISUALIZER-LIMIT | open | crossProjectResolver.ts | runtime | Stage B / M1 | Schema-only in Stage A; runtime cap requires resolver knob | 2026-04-30 §A.7 |
| STB-VISUALIZER-TWOWAY | open | RelationConfigEditor.svelte + dataApi.ts | feature | Stage B / M1 | Auto-mirroring write-back is non-trivial; schema lands Stage A | 2026-04-30 §A.7 |
| STB-VISUALIZER-FORMULA-POLISH | open | YamlVisualizer/FormulaEditorModal.svelte | feature | Stage B / M3 | Stage A ships MVP wrapper around FormulaBar; Notion-parity polish at M3 | 2026-04-30 §A.7 |
| STB-VISUALIZER-DRAG-REORDER | open | YamlVisualizer/PropertyRow.svelte | feature | Stage B | Reuse svelte-dnd-action drag handle pattern from Database widgets | 2026-04-30 §A.7 |
| STB-VISUALIZER-BULK-EDIT | open | YamlVisualizer/* | feature | Stage B | Multi-select on rows requires selection state machine | 2026-04-30 §A.7 |
```

### 13.2 Rules

1. **No silent TODO**. Every `// TODO`, `// FIXME`, `// XXX`, `throw new Error("not implemented")`, or stub function placed in `src/` during Stage A must have a corresponding `STB-*` entry in the registry. Pull-request-time auditor check.
2. **ID format**: `STB-<DOMAIN>-<SHORT>`. Domains: `ENGINE`, `VISUALIZER`, `DATATABLE`, `FORMULA`, `PIPELINE`, `I18N`, `DOCS`.
3. **Status values**: `open`, `in-progress`, `closed`. When closed, the row stays in the table for traceability with the closing commit hash appended.
4. **Code anchor**: every stub in `src/` includes a one-line comment with the registry ID, e.g.:
   ```ts
   // STB-VISUALIZER-TWOWAY — Stage B; auto-mirror writeback not implemented
   ```
   The auditor sub-agent grep-checks the registry vs. the codebase symmetry on every phase.
5. **Discovery during implementation**: if a new stub is unavoidable mid-step, the implementer must (a) add the registry entry first, (b) place the anchor comment in the code referencing the new ID, (c) link the entry from `.ai_internal/context_state.md` in the same commit.
6. **No dead anchors**: stubs that the next milestone implements are flipped to `closed` in the same PR that ships the implementation; the comment is removed. The auditor verifies.

### 13.3 Verification gate (added to §10)

- New gate **§10.8**: `.ai_internal/stubs.md` matches `grep -RnE "STB-[A-Z]+-[A-Z0-9-]+" src/` — every code anchor has a registry entry, every open registry entry has at least one code anchor (or the deferred-to milestone is the trivial creation of one).

---

## 14. Documentation & Terminology Standardization (parallel work-stream)

The user (Q8) flagged that the project-wide documentation does not meet industry standards: chaotic across `docs/`, repo root, in-code comments, and prior agent sessions; even legacy synonyms like the now-retired *Stage* alias had drifted from earlier vocabulary. This work-stream runs **in parallel with Stage A**, not after it. It does not block code edits to `src/`, but its phase-1 output is a precondition for Step A.1.

### 14.0 Scope — every document in the project, no exceptions

Per the user's explicit follow-up directive ("включи в стандартизацию документы всего проекта даже реадми"), the standardization pass covers **every** human-readable text artefact in the repository, not just `docs/`. The full inventory is fixed below; nothing in this list may be skipped.

| Surface | Files | Treatment |
|---|---|---|
| **Repo-root product docs** | `README.md`, `README-EN.md`, `RELEASES.md`, `RELEASES-EN.md`, `PROJECT-INFO.md`, `LICENSE-INFO.md` | Terminology lock; cross-link audit; bilingual EN/RU parity check; status banner if not the canonical one (e.g. `RELEASES.md` deferred to CHANGELOG-as-source-of-truth pattern). |
| **Repo-root governance** | `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `NOTICE`, `LICENSE` | Terminology lock; CHANGELOG aligned to Keep-a-Changelog; NOTICE/LICENSE left textually unchanged but verified present and referenced from README. |
| **GitHub meta** | everything under `.github/` (issue templates, PR template, workflows, FUNDING) | Terminology lock; templates reference the standardized vocabulary; CI workflow comments refer to milestones by canonical IDs (`M0..M5`). |
| **`docs/` active set** | `ARCHITECTURE.md`, `IMPLEMENTATION_BLUEPRINT.md` (this file), `IMPLEMENTATION_PLAN_CURRENT.md`, `ROADMAP_DATABASE_2026.md`, `DOCS_INDEX.md`, `DOCUMENTATION_STRUCTURE.md`, `architecture-engine-v2.md`, `architecture-agenda.md`, `architecture-database-view.md`, `architecture-drag-drop.md`, `architecture-filters.md`, `CODE_STANDARDS.md`, `CODE_STANDARDS-RU.md`, `user-guide.md`, `user-guide-EN.md`, `api.md`, `api-ru.md` | Full terminology + cross-reference + status-banner pass. Bilingual EN/RU parity for paired files. |
| **`docs/` reference & archive** | `database-view-pivot.md`, `database-view-ui-ux.md`, `database-view-v3.4.0-spec.md`, `audit-database-view-specs.md`, `refactoring-spec-v1.md`, `v3.0.9-cache.md`, `v3.3.1-modernization.md`, `database-view-pivot-spec.md` (if present), everything under `docs/archive/`, everything under `docs/debug/` | Confirm `> REFERENCE-ONLY` or `> ARCHIVED <date>` banner present. **Frozen content** — terminology not rewritten; banner is enough. Linked from `DOCS_INDEX.md` with explicit status. |
| **`memories/repo/`** | `obs-projects-plus-context.md`, `bug-tracker.md`, `chart-widget-infrastructure.md`, `database-view-inventory.md`, `strip-alignment-fix-v9.md`, plus any new files | Terminology lock; ensure each file declares its scope (what it covers, when it was last verified). |
| **`.ai_internal/`** | `context_state.md`, `stubs.md` (NEW per §13) | Terminology lock; `stubs.md` is the canonical registry referenced from §13 + §10.8. |
| **`scripts/`** READMEs and inline doc | any `README*.md` under `scripts/`, plus header comments in `.mjs`/`.ps1`/`.py` files | Header comments use canonical vocabulary; if a script implements a milestone-anchored task, it carries an `// Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.x` reference. |
| **`templates/`** | `templates/README.md` and every `.md` template (Calendar Event, Daily Note, Deadline, Habit Tracker, Meeting, Project, Projects Plus, Quick Note, Recurring Event, Sprint, Task, Weekly Review) | `README.md` updated; templates themselves left in place but the README explains them in the canonical vocabulary. The word "Sprint" inside `Sprint Template.md` is **product domain language for end users** and is explicitly **whitelisted** — Appendix B notes this exception so the auditor does not flag it. |
| **`demo-vault/`** | `demo-vault/README.md`, every `.md` under `demo-vault/{Clients,Projects,Team,…}` that contains user-facing prose (not just frontmatter) | Demo-vault `README.md` is rewritten so it is consistent with the public README's framing. Sample notes left content-as-is (they are user data examples, not project docs); only the demo-vault `README.md` is in scope. |
| **`releases/`** | `releases/v3.x.x/RELEASE_NOTES.md` for every shipped version | Each release notes file gets `> ARCHIVED <date>` banner if the version is no longer the active beta; the active release (currently 3.4.1) has a `Reference` banner. **No textual rewrites** of past release notes — they are historical record. |
| **In-code comments** | every `.ts`/`.svelte` file under `src/` | Header convention from §14.2 applied to **every new file** in Stage A; existing files get header retrofit only when they are touched by Stage A code. No bulk retrofit of untouched files (that is YAGNI churn). |

**Total active scope** (rewritten / re-banner-ed): ~80 markdown files. **Frozen** (banner-only): ~25 files. **Out of scope** (sample data, third-party bundled types under `obsidian-projects-types/`, generated `main.js` / `styles.css` / `test-results.json`): the rest.

### 14.1 Phase 1 — Terminology lock + repo-root entry point + obvious cleanup (precondition for Step A.1)

- **Terminology lock across the full §14.0 active scope**: every file in the "active" rows of the inventory must use the vocabulary defined in **Appendix B** of this document. Forbidden synonyms (the legacy *wave* alias [retired], `sprint` outside the whitelisted template name, `phase X` mixed with `M-x`, `chunk`, `iteration`) are removed. The `auditor` sub-agent runs a recursive grep across the entire repo (excluding `node_modules`, `.git`, generated artefacts, and the §14.0 frozen rows) and fails the gate if any forbidden term remains.
- **Repo-root entry point**: `README.md` becomes the *only* entry point a stranger needs to read. It links — in this order — to: `README-EN.md` (English mirror), `PROJECT-INFO.md` (what it is), `CONTRIBUTING.md` (how to contribute), `docs/ARCHITECTURE.md` (where to look in the code), `docs/IMPLEMENTATION_BLUEPRINT.md` (current execution chart), `docs/ROADMAP_DATABASE_2026.md` (where we're going), `docs/DOCS_INDEX.md` (full doc map), `demo-vault/README.md` (try it). Every link verified clickable.
- **Bilingual parity**: `README.md` ↔ `README-EN.md`, `RELEASES.md` ↔ `RELEASES-EN.md`, `docs/api.md` ↔ `docs/api-ru.md`, `docs/CODE_STANDARDS.md` ↔ `docs/CODE_STANDARDS-RU.md`, `docs/user-guide.md` ↔ `docs/user-guide-EN.md` — each pair is verified to expose the same section structure and the same terminology mapping (entries cross-translated 1:1 via Appendix B).
- **Repo-root cleanup**: every loose file at repo root that is not standard (LICENSE, NOTICE, README*, RELEASES*, CHANGELOG, CODE_OF_CONDUCT, CONTRIBUTING, PROJECT-INFO, LICENSE-INFO, manifest*, package*, tsconfig, build configs, jest config, svelte config, eslint config, prettier configs, version-bump scripts, `.gitignore`, `.prettierignore`, `versions.json`, `test-results.json`, `main.js`, `styles.css`) is moved or removed. Inventory recorded in §14.4.
- **CHANGELOG hygiene**: `[Unreleased — Stage A]` section seeded; format aligned with Keep-a-Changelog.
- **`docs/DOCS_INDEX.md`** acts as the doc-router; phase-1 verifies it is in sync with on-disk reality and that every active document has a status banner (`Active` / `Reference` / `Archived`).
- **`.github/` templates**: issue + PR templates updated to ask the contributor which milestone (`M0..M5`) and which Stage (`A`/`B`) the change belongs to. Reduces future drift at the source.

### 14.2 Phase 2 — In-code documentation pass (during Stage A, after Step A.4)

- Every public export from `src/lib/engine/`, `src/lib/datasources/`, `src/lib/dataframe/`, `src/customViewApi.ts`, `src/view.ts` carries a JSDoc block with: purpose, parameters, return shape, side-effects (or "pure"), since-version. Internal helpers exempt.
- File headers: every new file created during Stage A has a 3-line header summary + a `// Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.x` reference. Existing files receive the header **only when Stage A code touches them** (no bulk retrofit).
- Test naming: every Stage-A test file's `describe` block follows the convention `describe("<module> — <surface>", …)` to make `jest --listTests` self-documenting.
- `scripts/` headers: every Stage-A-relevant script gets a header comment block declaring its purpose, inputs, outputs, and the milestone anchor.

### 14.3 Phase 3 — Final standardization pass (Stage A close, before §14 sign-off)

- `docs/ARCHITECTURE.md` updated to incorporate Engine v2 + YAML Визуализатор as implemented surfaces.
- `docs/architecture-engine-v2.md` status banner switched from "Active design" to "Implemented in Stage A".
- `docs/IMPLEMENTATION_PLAN_CURRENT.md` marks M0 + M2 as `done` with phase-A commit references.
- `docs/user-guide.md` + `docs/user-guide-EN.md` get a YAML Визуализатор chapter (RU and EN parity enforced).
- `README.md` + `README-EN.md` updated to mention YAML Визуализатор in the feature list and roadmap section.
- `demo-vault/README.md` rewritten with a "What to try first" section that walks the new user through DataTable → Database → YAML Визуализатор flows.
- `templates/README.md` updated to canonical vocabulary; template files themselves untouched (user-facing data).
- A new doc `docs/CONTEXT_FOR_AGENTS.md` is created — a one-page "how to onboard as a coding agent on this repo" guide referencing the standardized vocabulary, the stubs registry, the verification gates. This addresses the user's specific complaint about agent disorder.
- Auditor sub-agent runs a final pass with the **doc-standardization** check protocol (full-repo terminology grep + bilingual parity check + DOCS_INDEX vs on-disk diff); PASS verdict is required for Stage A sign-off.

### 14.4 Verification gates added to §10

- **§10.9**: full-repo terminology grep is clean against Appendix B forbidden list (with template-name whitelist applied).
- **§10.10**: every new file under `src/` created in Stage A has a header + Anchored-in reference.
- **§10.11**: `docs/DOCS_INDEX.md` matches on-disk inventory; every active markdown file in the §14.0 inventory is reachable from `README.md` in ≤ 2 hops.
- **§10.12**: `docs/CONTEXT_FOR_AGENTS.md` exists and references the stubs registry.
- **§10.13**: bilingual file pairs (RU/EN) have matching section structure verified by an automated structural-diff check (a small node script, added to `scripts/jest/` or similar, that lists `^#{1,3} ` headings of each file in a pair and asserts equality after canonical-vocabulary translation).

### 14.5 Why this is in scope of Stage A, not deferred

The user explicitly framed it as a precondition for confident agent-driven work going forward ("стороннему пользователю/контрибьютеру/агенту довольно сложно разобраться в коде"). Without phase-1, the next Stage-B session would re-inherit the same vocabulary drift and re-spend effort on alignment. Locking it now is a one-time tax that pays back across all remaining milestones.

---

## Appendix B — Terminology dictionary (canonical vocabulary)

This appendix is the single source of truth for project vocabulary. New documents and new agents must use these terms; alternatives are explicitly forbidden.

| Canonical | Meaning | Forbidden alternatives |
|---|---|---|
| **Stage A** | The foundation track delivered in versions 3.4.2: M0 + M2 + Stub closures + Doc-Standardization phases 1-3. Internal-only. | Stage A, sprint 1, phase 1, iteration 1 |
| **Stage B** | The completion track: M1 + M3 + M4 + M5. First public release at end. | Stage B, sprint 2, phase 2 |
| **M0..M5** | The five named milestones from `ROADMAP_DATABASE_2026.md`. Use exactly these labels. | milestone-zero, milestone-one (use `M0`, `M1`, … in writing) |
| **Engine v2** | The data layer that adds cross-project relation resolution + cross-project rollup engine on top of the existing in-frame engine. | engine 2.0, engine2, new engine |
| **YAML Визуализатор** (ru) / **YAML Visualizer** (en) | The Notion-parity property-panel sub-plugin (M2). | properties panel, frontmatter inspector, custom properties viewer (the last is the ROADMAP M2 *internal* label; user-facing terminology is YAML Визуализатор) |
| **Stub registry** | The `.ai_internal/stubs.md` file and the `STB-*` IDs within it. | TODO list, backlog (these terms are reserved for product/feature backlog, not code-anchor stubs) |
| **Frame** / **DataFrame** | The in-memory `DataFrame` from `src/lib/dataframe/dataframe.ts`. | dataset, table (when discussing in-memory representation), frame-data |
| **Field** / **`FieldConfig`** | The per-project, per-field configuration object on `Project.fieldConfig`. | column config (use only when discussing the DataTable column UI), property config |
| **External frame** | A `DataFrame` belonging to another project, loaded via `externalFrameResolver`. | foreign frame, cross-frame, other-project frame |
| **Stub closure** | A small surgical edit that fixes a fall-through in an existing switch (e.g. `parseRecords`, `fieldIcon`). | gap closure, bug fix (these have separate semantics), micro-task |
| **Project view** | A view tab inside a project (Table / Board / Calendar / Database / YAML Визуализатор). | view (ambiguous with Obsidian's `WorkspaceLeaf`), tab (UI term only) |
| **Workspace leaf** | An Obsidian-level `WorkspaceLeaf`. Use only when contrasting with project view. | leaf-view, sidebar (UI term only) |

**Forbidden everywhere in active documents** (auditor grep-fails the gate if found, case-insensitive): `wave 1`, `wave 2`, `wave-1`, `wave-2`, `the new wave`, `next wave`, `wave-based`, `sprint 1`, `sprint 2`, `chunk 1/2`, `iteration 1/2`, and `phase 1` / `phase 2` when used as a synonym for stage. Use `Stage A` / `Stage B` instead.

**Whitelist (auditor must NOT flag)**:
- The literal filename `Sprint Template.md` and the word "Sprint" inside `templates/Sprint Template.md` — this is end-user product domain language (Agile/Scrum sprint), not internal project vocabulary.
- The string `phase 1` / `phase 2` / `phase 3` when prefixed by §14 (e.g. "§14.1 phase 1") — these are formally defined sub-phases of the Documentation Standardization work-stream, not synonyms for Stage.
- Sample data inside `demo-vault/` notes (frontmatter values, body text of demo notes) — these are user data, not project documents.
- Past release notes under `releases/v3.x.x/` — historical record, frozen at publication time.
- **Shipped CHANGELOG version sections** (versions ≤ 3.4.1 in `CHANGELOG.md`) — these document what actually shipped under the then-current internal vocabulary (e.g. "Computation Engine (Wave 2)" inside the 3.4.0 section). Historical record. Terminology lock applies only to `[Unreleased]` and future versions.
- **`docs/architecture-drag-drop.md`** — the words "Iteration 1..4" inside this file are feature-internal DnD-design work-iteration labels for the shipped v3.2.0 Timeline DnD design, not synonyms for project Stage.
- **`.ai_internal/context_state.md`** historical entries (entries above the explicit `## Historical record (pre-3.4.2 chart-engine vocabulary)` divider) — describe the shipped v3.4.0 Database Chart Engine which internally used Wave 1..5 vocabulary at ship-time. Historical record.
- **Documents that define the rule itself**: Appendix B of this blueprint, [memories/session/handoff.md](../memories/session/handoff.md), and the latest entries of [.ai_internal/context_state.md](../.ai_internal/context_state.md) may quote the forbidden terms verbatim because they document the lock policy itself. The auditor identifies these as meta-self-references and does not flag them.

**Allowed in archive/historical files**: any terminology, with a `> ARCHIVED <date>` banner at the top.

---

## Appendix A — Relationship of this blueprint to existing docs

| Blueprint section | Source document(s) | Relationship |
|---|---|---|
| §1 Mission | `architecture-engine-v2.md` §1, `ROADMAP_DATABASE_2026.md` Scope | Synthesized |
| §3 Inventory | `IMPLEMENTATION_PLAN_CURRENT.md` §2 Ground truth | Re-verified 2026-04-30 |
| §4 Stub catalogue | NEW — produced by deep code audit 2026-04-30 | Replaces ad-hoc TODO scanning |
| §5 Two-stage model | `IMPLEMENTATION_PLAN_CURRENT.md` §5 milestone table | Re-organized into user-visible deliverables |
| §6 Stage A detail | `architecture-engine-v2.md` §4 + `IMPLEMENTATION_PLAN_CURRENT.md` Appendix M0 | Made executable |
| §7 Stage B outline | `ROADMAP_DATABASE_2026.md` M1–M5 | Compressed |
| §8 Cross-cutting | `CODE_STANDARDS.md` + `architecture-engine-v2.md` | Quoted |
| §9 Risks | `IMPLEMENTATION_PLAN_CURRENT.md` §6 + new R-3, R-4, R-6 | Extended |
| §10 Gates | director-mode protocol | Unchanged |
| §11 Open questions | NEW | This document is the only place these are surfaced |

---

> End of blueprint. **No code is to be written until §11 is answered and §12 is fully checked.**
