# #113 — Related records and rollup starter surface — Architecture

> **Status:** approved for implementation, 2026-08-22
> **Analysis session:** semantic-analyzer + backend-architect, 2026-08-22
> **Depends on:** #111 canonical Relation contract, #112 Guided setup (entry points)

---

## Decision

Surface related-record counts inside `RelationPickerPopover` (Option B) and pre-configure the
`"relation-block"` SmartSuggestion widget with `sourceConfig.projectId` + `linkedSelection`.
No derived field added to the frame; no frame pipeline changes; reactive chain already complete.

---

## Scope (what ships with #113)

- **"3 Sessions linked" badge** in `RelationPickerPopover` after candidate load — count of
  currently selected wikilinks that resolve to live records in the target project.
  Maps to PRODUCT_RESET §4 Scene 4: "связи как нервная система" — first nerve signal.
- **SmartSuggestion `"relation-block"` accept** now creates a pre-configured `database-call`
  widget: `sourceConfig.projectId` = `targetProjectId`, `linkedSelection` wired to primary
  data-table widget and the triggering relation field.
  Maps to Scene 4: "clear next action — one click creates the full linked view."
- **Reactive updates**: existing `metadataCache.changed` → `dataFrame.merge()` → frame rebuild
  chain already propagates to `RelationPickerPopover` (re-mounts each open). No new wiring.
- **Out of scope**: `linkedSelection` auto-filter, charts from relations (#114), always-visible
  count column (requires configured Rollup field).

---

## Analysis findings

### Relation resolution pipeline (crossProjectResolver.ts)
- `enrichFrameWithRelations` (line 31–62) resolves forward links and stores results under
  `__resolved__<fieldName>` — NOT called in `buildDisplayFrame` (dashboardFramePipeline.ts:6–15).
- `RelationPickerPopover.onMount` already calls `api.resolveExternalFrame` and populates
  `candidates` as file basenames. This is the correct hook for the count badge.
- `displayField` is computed in the engine but not threaded to cell renderer or picker. Separate
  concern; not in #113 scope.

### Count without pipeline (crossProjectRollup.ts / aggregate.ts)
- `count` rollup requires: `{ relationField, targetField, function }` — 3 mandatory params.
- Zero-config count for the badge = `parseRelationLinks(value).filter(label => candidates.includes(label)).length`.
  Uses already-loaded `candidates`. No engine call needed.
- Synthesised RollupConfig for the pre-configured widget: `{ relationField: fieldName, targetField: "id", function: "count_total" }`.
  `record.id` is always populated per `standardizeRecord`. NOT persisted as a Rollup field;
  used only as the initial `config` of the new `database-call` widget.

### Reactive Markdown updates (already complete)
- `vault.modify/create/delete/rename` → `invalidateExternalFrameCache()` → `bumpExternalFrameInvalidation()`
  (App.svelte:115–118) → `syncPreload` in DashboardCanvas.svelte:107 re-runs right-frame preload.
- `metadataCache.on("changed")` → `dataFrame.merge()` → `displayFrame` rebuild (events.ts:40–55).
- `RelationPickerPopover` re-mounts on each open → always reads freshest frame. No new wiring.

### SmartSuggestion / addWidget
- `SmartSuggestion` already carries `fieldName` (smartSuggest.ts:16).
- `addWidget(type: WidgetType)` only accepts `WidgetType` — no initial config path (dashboardWidgets.ts:48–64).
- `"relation-block"` suggestion fires when a Relation field exists AND no `database-call` widget
  has `linkedSelection` (smartSuggest.ts:52–65). Gate is correct.

---

## Module list and commit order

### Step 1 — `src/ui/views/Dashboard/smartSuggest.ts`
MODIFY. Extend `SmartSuggestion` interface:
```ts
export interface SmartSuggestion {
  readonly kind: SuggestionKind;
  readonly fieldName: string;
  readonly widgetType: WidgetType;
  readonly relationTargetProjectId?: string;  // NEW: defined for kind === "relation-block"
}
```
In `computeSuggestions`, update gate to also require `!!relConfig?.targetProjectId` before
emitting `"relation-block"`. Populate `relationTargetProjectId: relConfig.targetProjectId`.

### Step 2 — `src/ui/views/Dashboard/dashboardWidgets.ts`
MODIFY. Extend `WidgetController` interface and `createWidgetController` factory:
```ts
addWidget(type: WidgetType, initialConfig?: Partial<WidgetDefinition>): void
```
In the factory body, destructure to prevent `id`/`type` override:
```ts
const { id: _noId, type: _noType, ...safeInit } = initialConfig ?? {};
const newWidget: WidgetDefinition = { id, type, title, layout: { ...meta.defaultLayout }, config: {}, ...safeInit };
```
All existing single-arg call sites remain valid (second arg is optional).

### Step 3 — `src/ui/views/Dashboard/dashboardSuggest.ts`
MODIFY. Add `getPrimaryWidgetId: () => string | undefined` to opts interface.
In `accept` handler, add branch for `"relation-block"`:
```ts
if (e.detail.kind === "relation-block") {
  const primaryWidgetId = getPrimaryWidgetId() ?? "";
  opts.addWidget("database-call", {
    sourceConfig: { projectId: e.detail.relationTargetProjectId ?? "" },
    config: { linkedSelection: { sourceWidgetId: primaryWidgetId, relationField: e.detail.fieldName } },
  });
} else {
  opts.addWidget(e.detail.widgetType);
}
```

### Step 4 — `src/ui/views/Dashboard/DashboardCanvas.svelte`
MODIFY. Pass `getPrimaryWidgetId` to `createSuggestionController`:
```ts
getPrimaryWidgetId: () => effectiveConfig?.widgets.find(w => w.type === "data-table")?.id
```

### Step 5 — `src/ui/views/Dashboard/widgets/DatabaseCall/RelationCountBadge.svelte`
ADD. New display-only component. Props: `count: number`, `loading: boolean`.
- `loading` → render nothing.
- `!loading && count > 0` → `"{{count}} linked"` via i18n key `relation-count.linked`.
- `!loading && count === 0` → `"No linked records yet"` via i18n key `relation-count.empty`.
All CSS: `rem` + CSS tokens only.

i18n keys to add in all 4 locales:
```json
"relation-count": {
  "linked": "{{count}} linked",
  "empty": "No linked records yet"
}
```

### Step 6 — `src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte`
MODIFY. After `loading = false` in `onMount`:
```ts
resolvedCount = parseRelationLinks(value).filter(label => candidates.includes(label)).length;
```
Render `<RelationCountBadge count={resolvedCount} {loading} />` above the candidate list,
inside `{#if hasTargetProject}`.

---

## Interfaces

```ts
// smartSuggest.ts
interface SmartSuggestion {
  kind: SuggestionKind;
  fieldName: string;
  widgetType: WidgetType;
  relationTargetProjectId?: string;   // NEW
}

// dashboardWidgets.ts
interface WidgetController {
  addWidget(type: WidgetType, initialConfig?: Partial<WidgetDefinition>): void;
  // unchanged otherwise
}

// dashboardSuggest.ts opts
interface SuggestionControllerOpts {
  getConfig: () => DatabaseViewConfig | undefined;
  saveConfig: (cfg: DatabaseViewConfig) => void;
  addWidget: (type: WidgetType, initialConfig?: Partial<WidgetDefinition>) => void;
  getPrimaryWidgetId: () => string | undefined;   // NEW
}
```

---

## Tests

### Extend `src/ui/views/Dashboard/__tests__/smartSuggest.test.ts`
- `"populates relationTargetProjectId from field typeConfig.relation.targetProjectId"`
- `"leaves relationTargetProjectId undefined when typeConfig.relation is absent"`
- `"does not emit relation-block when targetProjectId is empty (partial wizard exit)"`

### New `src/ui/views/Dashboard/__tests__/dashboardSuggest.test.ts`
- `"accept 'relation-block' calls addWidget with pre-configured sourceConfig and linkedSelection"`
- `"accept 'relation-block' uses empty string for primaryWidgetId when getPrimaryWidgetId returns undefined"`
- `"accept other kinds calls addWidget with type only (no initialConfig)"`
- `"dismiss persists kind to dismissedSuggestions"`

---

## Risks

1. **`relationTargetProjectId` undefined on partial wizard exit**: gated — strip only fires when
   `!!relConfig?.targetProjectId`. Partial exit → no strip shown → no confusion.
2. **`getPrimaryWidgetId` returns `undefined`**: `sourceWidgetId` = `""` → widget opens without
   auto-filter; user configures manually. Acceptable for #113; #114 owns full wiring.
3. **`Partial<WidgetDefinition>` spread**: `id`/`type` keys stripped before spread — no
   duplicate-widget-id risk.
4. **Count is resolved count, not raw link count**: stale links to deleted records are excluded.
   This is the more trustworthy number. Feature, not bug.

---

## Invariants

- WikiLinks remain storage. No IDs written. No Markdown mutations.
- Single filter engine. No `new Menu(`. No `@ts-ignore`. All CSS in rem/tokens.
- `linkedSelection` auto-filter and charts out of scope (#114).
- `addWidget` second-arg extension is backward-compatible; existing call sites unchanged.
