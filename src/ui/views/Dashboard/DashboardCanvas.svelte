<script lang="ts">
  /**
   * DashboardCanvas — top-level canvas for a single Database/Dashboard view.
   *
   * REFACTOR-301: state graph (read top-down):
   *   ┌─ props ─────────────────────────────────────────────────────────┐
   *   │ project, frame, readonly, api, config, globalFilters,          │
   *   │ getRecordColor, onConfigChange, onViewFilterChange             │
   *   └────────────────────────────────────────────────────────────────┘
   *           │
   *           ▼
   *   ┌─ derived stores (reactive) ─────────────────────────────────────┐
   *   │ widgets, layoutMode, showToolbar, quickActions, activeFilterTab,│
   *   │ activeGlobalFilters, globalFilterTooltip, rightFramesStore     │
   *   └────────────────────────────────────────────────────────────────┘
   *           │
   *           ▼
   *   ┌─ side effects (gated, idempotent) ──────────────────────────────┐
   *   │ • saveConfig()  → onConfigChange (single source of truth)      │
   *   │ • reopenSchema(), openCreateField(), openConfigureField()      │
   *   │ • requestTemplateReplace() (confirm dialog if widgets exist)   │
   *   │ • right-frame preload IIFE (generation-token guarded)          │
   *   └────────────────────────────────────────────────────────────────┘
   *
   * Async invariants (REFACTOR-301):
   *   1. Every fire-and-forget Promise has an explicit `.catch` boundary
   *      that logs to console.warn rather than letting the rejection
   *      become an unhandled error.
   *   2. The right-frame preload uses `preloadGeneration` to discard
   *      stale resolutions so a late batch can never overwrite a newer
   *      one.
   *   3. Modal callbacks own their try/catch so a failure inside the
   *      callback doesn't kill the modal lifecycle.
   *   4. `saveConfig` is the single mutator of `config` → no async
   *      mutation paths bypass it.
   */
  import type {
    DataFrame,
    DataRecord,
  } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { FilterCondition } from "src/settings/base/settings";
  import type { DatabaseViewConfig } from "./types";

  import ViewContent from "src/ui/components/Layout/ViewContent.svelte";
  import ViewLayout from "src/ui/components/Layout/ViewLayout.svelte";
  import { setContext } from "svelte";
  import { tick } from "svelte";
  import { writable, type Writable } from "svelte/store";
  import { dndzone, SHADOW_PLACEHOLDER_ITEM_ID } from "svelte-dnd-action";

  import WidgetHost from "./widgets/WidgetHost.svelte";
  import WidgetToolbar from "./widgets/WidgetToolbar.svelte";
  import FormulaBar from "./widgets/FormulaBar.svelte";
  import { getWidgetMeta } from "./widgets/widgetRegistry";
  import { applyWidgetTemplate } from "./widgetTemplates";
  import { get } from "svelte/store";
  import { getDesignTokenCSS } from "./designTokens";
  import { isMobile } from "src/lib/stores/ui";
  import { i18n } from "src/lib/stores/i18n";
  import { settings } from "src/lib/stores/settings";
  import { externalFrameInvalidation } from "src/lib/stores/externalFrameInvalidation";
  import type { WidgetType, WidgetDefinition, QuickActionConfig } from "./types";
  import { CreateFieldModal } from "src/ui/modals/createFieldModal";
  import { ConfigureFieldModal } from "src/ui/modals/configureField";
  import { SchemaModal } from "src/ui/modals/schemaModal";
  import { ConfirmDialogModal } from "src/ui/modals/confirmDialog";
  import { app } from "src/lib/stores/obsidian";
  import { commandBus } from "src/lib/stores/commandBus";
  import { onDestroy } from "svelte";
  import type { DataField } from "src/lib/dataframe/dataframe";

  // ── Props ──────────────────────────────────────────────────
  export let project: ProjectDefinition;
  export let frame: DataFrame;
  export let readonly: boolean;
  export let api: ViewApi;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let config: DatabaseViewConfig | undefined;
  export let onConfigChange: (cfg: DatabaseViewConfig) => void;
  // Global filter conditions from view.filter (applied upstream in View.svelte).
  // Database view receives them purely for the bridge indicator — data is
  // already filtered by the time it reaches this canvas.
  export let globalFilters: FilterCondition[] = [];
  // Optional callback to persist a new view.filter. When present, the filter
  // bridge exposes a "promote to global" button on the local chip.
  export let onViewFilterChange: ((filter: { conjunction: "and" | "or"; conditions: FilterCondition[] }) => void) | undefined = undefined;

  // ── Reactive context ────────────────────────────────────────
  const projectStore = writable<ProjectDefinition>(project);
  setContext<Writable<ProjectDefinition>>("project", projectStore);
  $: projectStore.set(project);

  // ── Config helpers ─────────────────────────────────────────
  function saveConfig(cfg: DatabaseViewConfig) {
    config = cfg;
    onConfigChange(cfg);
  }

  $: widgets = config?.widgets ?? [];
  $: layoutMode = $isMobile ? "stack" : (config?.layoutMode ?? "stack");
  $: showToolbar = config?.showWidgetToolbar ?? false;
  $: quickActions = config?.quickActions ?? [];

  // ── Design tokens ──────────────────────────────────────────
  const tokenCSS = getDesignTokenCSS();

  // ── Widget management ──────────────────────────────────────

  function addWidget(type: WidgetType) {
    if (!config) return;
    const meta = getWidgetMeta(type);
    if (!meta) return;

    const id = `w-${crypto.randomUUID().slice(0, 8)}`;
    const newWidget: WidgetDefinition = {
      id,
      type,
      title: get(i18n).t(meta.labelKey),
      layout: { ...meta.defaultLayout },
      config: {},
    };

    saveConfig({
      ...config,
      widgets: [...config.widgets, newWidget],
    });
  }

  function removeWidget(widgetId: string) {
    if (!config) return;
    saveConfig({
      ...config,
      widgets: config.widgets.filter((w) => w.id !== widgetId),
    });
  }

  /**
   * Phase 2b — Field preset bubble-up from DataTableWidget.
   * Conditional spread on `activeFieldPresetId` is required by
   * `exactOptionalPropertyTypes: true` when clearing to undefined.
   */
  function handleFieldPresetsChange(
    e: CustomEvent<{
      fieldPresets: import("./types").FieldPreset[];
      activeFieldPresetId: string | undefined;
    }>,
  ) {
    if (!config) return;
    const { fieldPresets, activeFieldPresetId } = e.detail;
    const base: DatabaseViewConfig = { ...config, fieldPresets };
    if (activeFieldPresetId !== undefined) {
      saveConfig({ ...base, activeFieldPresetId });
    } else {
      // Strip the key so exactOptionalPropertyTypes stays satisfied.
      const { activeFieldPresetId: _omit, ...rest } = base;
      void _omit;
      saveConfig(rest);
    }
  }

  function toggleToolbar() {
    if (!config) return;
    saveConfig({ ...config, showWidgetToolbar: !showToolbar });
  }

  function toggleLayout() {
    if (!config) return;
    const next = layoutMode === "stack" ? "free" : "stack";
    saveConfig({ ...config, layoutMode: next });
  }

  // ── Schema panel (Stage A.9) ───────────────────────────────
  // Single canonical entry point for project schema management. The Database
  // canvas can be empty (no DataTable widget) and previously had no surface
  // for editing fields — users had to drop in a Table view first. The Schema
  // button below plus the SchemaModal close that gap so Database always
  // exposes the full property universe of the current project.
  let schemaModal: SchemaModal | null = null;

  function persistFieldTypeConfig(field: DataField) {
    if (!field.typeConfig) return;
    settings.updateFieldConfig(
      project.id,
      field.name,
      frame.fields.map((f) => f.name),
      field.typeConfig
    );
  }

  function openCreateField() {
    new CreateFieldModal(
      $app,
      frame.fields,
      async (field, value) => {
        // REFACTOR-301: explicit error boundary so a failed
        // `addField` (rare — frontmatter write race) doesn't crash
        // the modal callback chain.
        try {
          await api.addField(field, value);
          persistFieldTypeConfig(field);
          reopenSchema();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[obs-projects-plus] addField failed", err);
        }
      },
      $settings.projects,
      project.id
    ).open();
  }

  function openConfigureField(field: DataField) {
    new ConfigureFieldModal(
      $app,
      $i18n.t("modals.field.configure.title"),
      field,
      frame.fields.filter((f) => f.name !== field.name),
      !field.derived && !field.identifier,
      (next) => {
        if (!field.derived && !field.identifier) {
          if (next.name !== field.name) {
            api.updateField(next, field.name);
            settings.deleteFieldConfig(project.id, field.name);
          } else {
            api.updateField(next);
          }
        }
        persistFieldTypeConfig(next);
        reopenSchema();
      },
      $settings.projects,
      project.id
    ).open();
  }

  function openDeleteField(field: DataField) {
    new ConfirmDialogModal(
      $app,
      $i18n.t("modals.schema.delete-confirm.title"),
      $i18n.t("modals.schema.delete-confirm.message", { name: field.name }),
      $i18n.t("modals.schema.delete-confirm.cta"),
      () => {
        api.deleteField(field.name);
        settings.deleteFieldConfig(project.id, field.name);
        reopenSchema();
      }
    ).open();
  }

  function openSchema() {
    schemaModal = new SchemaModal(
      $app,
      $i18n.t("modals.schema.title"),
      frame.fields,
      $settings.projects,
      project.id,
      (field) => {
        schemaModal?.close();
        openConfigureField(field);
      },
      () => {
        schemaModal?.close();
        openCreateField();
      },
      (field) => {
        schemaModal?.close();
        openDeleteField(field);
      }
    );
    schemaModal.open();
  }

  function reopenSchema() {
    // Re-open the schema panel on the next tick so the user remains anchored
    // in the schema flow after editing or adding a field. Keeps Apple-grade
    // task continuity (no jarring jumps back to an empty canvas).
    // REFACTOR-301: explicit catch — `tick()` never rejects in practice
    // but a thrown error inside `openSchema()` would otherwise become an
    // unhandled rejection.
    tick()
      .then(() => openSchema())
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[obs-projects-plus] reopenSchema failed", err);
      });
  }

  // ── Stage A.10 — command-palette bridge ─────────────────────
  // Subscribe to the global command-bus so palette entries
  // (`Open Schema`, `Add field`) reach into this view when the user
  // already has a Database view open. Each subscription gates on
  // ts changes so a repeated palette click re-opens the same modal.
  let lastCommandTs = 0;
  const unsubCommandBus = commandBus.subscribe((msg) => {
    if (!msg || msg.ts <= lastCommandTs) return;
    lastCommandTs = msg.ts;
    if (msg.action === "open-schema") {
      openSchema();
    } else if (msg.action === "add-field") {
      openCreateField();
    }
  });
  onDestroy(unsubCommandBus);

  function applyTemplateById(templateId: string) {
    if (!config) return;
    const widgetsFromTemplate = applyWidgetTemplate(templateId);
    if (!widgetsFromTemplate) return;
    requestTemplateReplace(widgetsFromTemplate).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[obs-projects-plus] applyTemplateById failed", err);
    });
  }

  let showTemplateReplaceConfirm = false;
  let pendingTemplateWidgets: WidgetDefinition[] | null = null;
  let templateConfirmCancelBtn: HTMLButtonElement | null = null;

  async function requestTemplateReplace(nextWidgets: WidgetDefinition[]) {
    if (!config) return;

    // Protect users from accidental layout overwrite when a template is applied.
    if (widgets.length > 0) {
      pendingTemplateWidgets = nextWidgets;
      showTemplateReplaceConfirm = true;
      await tick();
      templateConfirmCancelBtn?.focus();
      return;
    }

    saveConfig({ ...config, widgets: nextWidgets });
  }

  function confirmTemplateReplace() {
    if (!config || !pendingTemplateWidgets) return;
    saveConfig({ ...config, widgets: pendingTemplateWidgets });
    showTemplateReplaceConfirm = false;
    pendingTemplateWidgets = null;
  }

  function cancelTemplateReplace() {
    showTemplateReplaceConfirm = false;
    pendingTemplateWidgets = null;
  }

  function handleQuickAction(action: QuickActionConfig) {
    if (action.kind === "toggle-formula-bar") {
      showFormulaBar = !showFormulaBar;
      return;
    }

    if (action.kind === "apply-template" && action.templateId) {
      applyTemplateById(action.templateId);
    }
  }

  // ── Formula bar state ──────────────────────────────────────
  let showFormulaBar = false;
  $: fieldNames = frame.fields.map((f) => f.name);
  $: previewRecord = frame.records[0];

  // ── Filter-tabs state ──────────────────────────────────────
  // FilterTabsWidget dispatches `filter` events that must be applied to the
  // frame before it reaches other widgets. We keep a singleton active filter
  // (last clicked tab wins) and derive `displayFrame` by narrowing records.
  // Filter tabs widgets themselves still receive the full unfiltered frame so
  // their tab counts / auto-seeded values reflect the complete data set.
  let activeFilterTab: { field: string; value: string | null } | null = null;

  function handleFilterTab(e: CustomEvent<{ field: string; value: string | null }>) {
    const { field, value } = e.detail;
    // Clicking "All" (value === null) clears the filter
    activeFilterTab = value === null ? null : { field, value };
  }

  $: displayFrame = activeFilterTab
    ? {
        ...frame,
        records: frame.records.filter((r) => {
          const raw = r.values[activeFilterTab!.field];
          return raw != null && String(raw) === activeFilterTab!.value;
        }),
      }
    : frame;

  // ── Pillar 5 (Phase 5 UI): cross-source preloader ─────────
  // Scan widget configs for JoinStep.rightSourceId and scatter correlation
  // references. Preload each referenced project's DataFrame via ViewApi and
  // keep the results in a reactive Map forwarded to every WidgetHost.
  $: availableSources = ($settings.projects ?? [])
    .filter((p) => p.id !== project.id)
    .map((p) => ({ id: p.id, name: p.name }));

  function collectReferencedSourceIds(ws: WidgetDefinition[]): string[] {
    const ids = new Set<string>();
    for (const w of ws) {
      const steps = w.transform?.steps ?? [];
      for (const s of steps) {
        if (s.type === "join" && s.rightSourceId) ids.add(s.rightSourceId);
      }
      if (w.type === "chart") {
        const cfg = w.config as { correlation?: { rightSourceId?: string } };
        const id = cfg?.correlation?.rightSourceId;
        if (id) ids.add(id);
      }
    }
    // Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.4 (R-11 mitigation).
    // Stage A cross-project relations & rollups declared on `project.fieldConfig`
    // must also feed the pre-load pipeline so the existing externalFrameResolver
    // cache + invalidation infrastructure covers them without a parallel path.
    const fc = project.fieldConfig as
      | Record<
          string,
          {
            relation?: { targetProjectId?: string };
            rollup?: { targetProjectId?: string };
          }
        >
      | undefined;
    if (fc) {
      for (const cfg of Object.values(fc)) {
        const relTarget = cfg?.relation?.targetProjectId;
        if (relTarget && relTarget !== project.id) ids.add(relTarget);
        const rollTarget = cfg?.rollup?.targetProjectId;
        if (rollTarget && rollTarget !== project.id) ids.add(rollTarget);
      }
    }
    return Array.from(ids);
  }

  const rightFramesStore = writable<ReadonlyMap<string, DataFrame>>(new Map());
  let lastReferencedKey = "";
  let lastInvalidationTick = 0;
  let preloadGeneration = 0;

  $: referencedIds = collectReferencedSourceIds(widgets);
  $: {
    // Re-run the preload pass when EITHER:
    //   (a) the set of referenced ids changes, or
    //   (b) the App-level external-frame cache has been invalidated
    //       (vault modify/create/delete/rename, settings.projects mutations).
    // Tracking both guarantees correlation widgets stay in sync with the
    // underlying vault even when the referenced id set is unchanged.
    const key = referencedIds.slice().sort().join("|");
    const invalidationTick = $externalFrameInvalidation;
    const idsChanged = key !== lastReferencedKey;
    const invalidated = invalidationTick !== lastInvalidationTick;
    if (idsChanged || invalidated) {
      lastReferencedKey = key;
      lastInvalidationTick = invalidationTick;
      const token = ++preloadGeneration;
      void (async () => {
        try {
          if (!api.resolveExternalFrame || referencedIds.length === 0) {
            if (token === preloadGeneration) rightFramesStore.set(new Map());
            return;
          }
          const entries = await Promise.all(
            referencedIds.map(async (id) => {
              const df = await api.resolveExternalFrame!(id);
              return [id, df] as const;
            })
          );
          // Discard results from stale generations so a late-resolving older
          // batch cannot overwrite a newer one.
          if (token !== preloadGeneration) return;
          const next = new Map<string, DataFrame>();
          for (const [id, df] of entries) {
            if (df) next.set(id, df);
          }
          rightFramesStore.set(next);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[obs-projects-plus] right-frame preload failed", err);
          if (token === preloadGeneration) rightFramesStore.set(new Map());
        }
      })();
    }
  }

  // ── Filter-bridge indicators ──────────────────────────────
  // Surface both global (view.filter, applied upstream) and local
  // (activeFilterTab, applied in this canvas) filter state so users are not
  // confused when data appears narrowed by filters they can't see.
  $: activeGlobalFilters = globalFilters.filter((c) => c.enabled !== false);
  $: globalFilterTooltip = activeGlobalFilters
    .map((c) => `${c.field} ${c.operator}${c.value ? ` ${c.value}` : ""}`)
    .join(" · ");

  function promoteLocalToGlobal() {
    // Convert the current activeFilterTab into an additional FilterCondition
    // appended to view.filter. Existing global conditions are preserved;
    // duplicates (same field + value + `is` operator) are suppressed.
    if (!activeFilterTab || !onViewFilterChange) return;
    const { field, value } = activeFilterTab;
    if (value == null) return;
    const exists = globalFilters.some(
      (c) => c.field === field && c.operator === "is" && String(c.value ?? "") === value
    );
    const nextConditions: FilterCondition[] = exists
      ? [...globalFilters]
      : [
          ...globalFilters,
          { field, operator: "is", value, enabled: true },
        ];
    onViewFilterChange({ conjunction: "and", conditions: nextConditions });
    // Clear local filter — global now owns it.
    activeFilterTab = null;
  }

  // ── DnD reorder (stack mode) ──────────────────────────────
  // svelte-dnd-action needs mutable items with `id`
  $: dndWidgets = widgets.map((w) => ({ ...w }));
  $: canDnd = layoutMode === "stack" && !readonly;

  function handleDndConsider(e: CustomEvent) {
    dndWidgets = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent) {
    dndWidgets = e.detail.items;
    if (!config) return;
    // Persist new order (filter out DnD shadow placeholders)
    const reordered = dndWidgets.filter(
      (w) => w.id !== SHADOW_PLACEHOLDER_ITEM_ID.toString()
    );
    saveConfig({ ...config, widgets: reordered });
  }

  // ── WidgetHost event handlers (shared by both mount sites) ─
  // Extracted to keep the two `<WidgetHost>` markup blocks thin and drift-safe.
  function handleWidgetConfigChange(e: CustomEvent<{ id: string; changes: Partial<WidgetDefinition> }>) {
    if (!config) return;
    const updated = config.widgets.map((w) =>
      w.id === e.detail.id ? { ...w, ...e.detail.changes } : w
    );
    saveConfig({ ...config, widgets: updated });
  }

  function handleTableConfigChange(e: CustomEvent<any>) {
    if (!config) return;
    saveConfig({ ...config, table: e.detail });
  }

  // Primary DataTable id: the first data-table widget in document order
  // continues to own the root `config.table`; subsequent widgets carry
  // their own `widget.config.table` overlay (multi-DataTable support).
  $: primaryDataTableId =
    config?.widgets.find((w) => w.type === "data-table")?.id ?? "";

  function handleRemoveWidget(e: CustomEvent<string>) {
    removeWidget(e.detail);
  }
</script>

<ViewLayout>
  <ViewContent>
    <div class="ppp-database-root" style={tokenCSS} role="region" aria-label={$i18n.t("views.dashboard.name")}>
    <!-- Toolbar row -->
    <div class="ppp-database-toolbar">
      <button
        class="ppp-toolbar-btn clickable-icon"
        on:click={toggleToolbar}
        aria-pressed={showToolbar}
        aria-label={showToolbar ? $i18n.t("views.dashboard.canvas.hide-toolbar") : $i18n.t("views.dashboard.canvas.show-toolbar")}
      >
        {showToolbar ? "−" : "+"} {$i18n.t("views.dashboard.canvas.widgets")}
      </button>
      <button
        class="ppp-toolbar-btn clickable-icon"
        on:click={toggleLayout}
        aria-label={$i18n.t("views.dashboard.canvas.toggle-layout")}
        disabled={$isMobile}
      >
        {layoutMode === "stack" ? `⊞ ${$i18n.t("views.dashboard.canvas.layout-grid")}` : `≡ ${$i18n.t("views.dashboard.canvas.layout-stack")}`}
      </button>
      {#if !readonly}
        <button
          class="ppp-toolbar-btn clickable-icon"
          on:click={openSchema}
          aria-label={$i18n.t("views.dashboard.canvas.schema")}
          title={$i18n.t("views.dashboard.canvas.schema-tip", {
            defaultValue: "Manage project fields — types, relations, rollups",
          })}
        >
          ⚙ {$i18n.t("views.dashboard.canvas.schema")}
        </button>
        <button
          class="ppp-toolbar-btn clickable-icon"
          on:click={() => (showFormulaBar = !showFormulaBar)}
          aria-pressed={showFormulaBar}
          aria-label={showFormulaBar ? $i18n.t("views.dashboard.canvas.hide-formula-bar") : $i18n.t("views.dashboard.canvas.show-formula-bar")}
          title={showFormulaBar
            ? $i18n.t("views.dashboard.canvas.hide-formula-bar", { defaultValue: "Hide formula bar" })
            : $i18n.t("views.dashboard.canvas.show-formula-bar-tip", {
                defaultValue: "Show formula bar — IntelliSense, live preview, syntax check",
              })}
        >
          ƒx
        </button>
      {/if}
      {#if showToolbar && !readonly}
        <WidgetToolbar
          currentWidgets={widgets}
          on:addWidget={(e) => addWidget(e.detail)}
          on:applyTemplate={(e) => {
            requestTemplateReplace(e.detail).catch((err) => {
              // eslint-disable-next-line no-console
              console.warn("[obs-projects-plus] applyTemplate failed", err);
            });
          }}
        />
      {/if}
    </div>

    {#if !readonly && quickActions.length > 0}
      <div class="ppp-quick-actions" role="group" aria-label={$i18n.t("views.dashboard.quick.group", { defaultValue: "Quick actions" })}>
        {#each quickActions as action (action.id)}
          <button
            class="ppp-quick-action clickable-icon"
            on:click={() => handleQuickAction(action)}
            aria-label={action.labelKey ? $i18n.t(action.labelKey, { defaultValue: action.label }) : action.label}
          >
            {action.labelKey ? $i18n.t(action.labelKey, { defaultValue: action.label }) : action.label}
          </button>
        {/each}
      </div>
    {/if}

    {#if showTemplateReplaceConfirm}
      <div
        class="ppp-template-confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ppp-template-confirm-title"
        aria-describedby="ppp-template-confirm-desc"
        on:click|self={cancelTemplateReplace}
        on:keydown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            cancelTemplateReplace();
          }
        }}
      >
        <div class="ppp-template-confirm">
          <h3 id="ppp-template-confirm-title">{$i18n.t("views.dashboard.canvas.template-replace-title", { defaultValue: "Replace current layout?" })}</h3>
          <p id="ppp-template-confirm-desc">{$i18n.t("views.dashboard.canvas.template-replace-confirm", { defaultValue: "Applying a template will replace current widgets. Continue?" })}</p>
          <div class="ppp-template-confirm-actions">
            <button class="ppp-btn ppp-btn--secondary" bind:this={templateConfirmCancelBtn} on:click={cancelTemplateReplace}>
              {$i18n.t("views.dashboard.canvas.template-replace-cancel", { defaultValue: "Cancel" })}
            </button>
            <button class="ppp-btn ppp-btn--danger" on:click={confirmTemplateReplace}>
              {$i18n.t("views.dashboard.canvas.template-replace-apply", { defaultValue: "Apply template" })}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Formula bar -->
    {#if showFormulaBar && !readonly}
      <FormulaBar
        fields={fieldNames}
        {previewRecord}
        on:apply={(e) => {
          if (!config) return;
          const { name, expression } = e.detail;
          const existing = config.formulaFields ?? [];
          const updated = existing.some((f) => f.name === name)
            ? existing.map((f) => f.name === name ? { ...f, expression } : f)
            : [...existing, { name, expression }];
          saveConfig({ ...config, formulaFields: updated });
          showFormulaBar = false;
        }}
        on:cancel={() => (showFormulaBar = false)}
      />
    {/if}

    <!-- Local ↔ Global filter bridge -->
    {#if activeGlobalFilters.length > 0 || activeFilterTab}
      <div class="ppp-filter-bridge" role="status" aria-live="polite">
        {#if activeGlobalFilters.length > 0}
          <span class="ppp-filter-bridge-chip ppp-filter-bridge-chip--global" title={globalFilterTooltip}>
            <span class="ppp-filter-bridge-icon" aria-hidden="true">🌐</span>
            <span class="ppp-filter-bridge-label">
              {$i18n.t("views.dashboard.canvas.filter-bridge-global", {
                defaultValue: "Global filter: {{count}} condition(s)",
                count: activeGlobalFilters.length,
              })}
            </span>
          </span>
        {/if}
        {#if activeFilterTab}
          <span class="ppp-filter-bridge-chip ppp-filter-bridge-chip--local">
            <span class="ppp-filter-bridge-icon" aria-hidden="true">⎘</span>
            <span class="ppp-filter-bridge-label">
              {$i18n.t("views.dashboard.canvas.filter-bridge-local", {
                defaultValue: "Local: {{field}} = {{value}}",
                field: activeFilterTab.field,
                value: activeFilterTab.value,
              })}
            </span>
            {#if onViewFilterChange && !readonly}
              <button
                class="ppp-filter-bridge-promote"
                type="button"
                on:click={promoteLocalToGlobal}
                title={$i18n.t("views.dashboard.canvas.filter-bridge-promote", { defaultValue: "Save as global filter" })}
                aria-label={$i18n.t("views.dashboard.canvas.filter-bridge-promote", { defaultValue: "Save as global filter" })}
              >↥</button>
            {/if}
            <button
              class="ppp-filter-bridge-clear"
              type="button"
              on:click={() => (activeFilterTab = null)}
              title={$i18n.t("views.dashboard.canvas.filter-bridge-clear", { defaultValue: "Clear local filter" })}
              aria-label={$i18n.t("views.dashboard.canvas.filter-bridge-clear", { defaultValue: "Clear local filter" })}
            >×</button>
          </span>
        {/if}
      </div>
    {/if}

    <!-- Widget grid -->
    {#if widgets.length === 0}
      <div class="ppp-database-empty">
        <div class="ppp-database-empty-icon">⊞</div>
        <span class="ppp-database-empty-title">{$i18n.t("views.dashboard.canvas.empty-title", { defaultValue: "No widgets yet" })}</span>
        <span class="ppp-database-empty-hint">{$i18n.t("views.dashboard.canvas.empty-hint", { defaultValue: "Click \"+\" in the toolbar to add your first widget" })}</span>
      </div>
    {:else if canDnd}
      <div
        class="ppp-database-canvas ppp-database-canvas--stack"
        use:dndzone={{ items: dndWidgets, flipDurationMs: 200, type: "widgets" }}
        on:consider={handleDndConsider}
        on:finalize={handleDndFinalize}
      >
        {#each dndWidgets as widget (widget.id)}
          <WidgetHost
            {widget}
            frame={widget.type === "filter-tabs" ? frame : displayFrame}
            {api}
            {readonly}
            {getRecordColor}
            fields={frame.fields}
            tableConfig={config?.table}
            isPrimaryDataTable={widget.id === primaryDataTableId}
            fieldPresets={config?.fieldPresets ?? []}
            activeFieldPresetId={config?.activeFieldPresetId}
            {availableSources}
            rightFrames={$rightFramesStore}
            {project}
            on:filter={handleFilterTab}
            on:configChange={handleWidgetConfigChange}
            on:tableConfigChange={handleTableConfigChange}
            on:fieldPresetsChange={handleFieldPresetsChange}
            on:removeWidget={handleRemoveWidget}
          />
        {/each}
      </div>
    {:else}
      <div
        class="ppp-database-canvas"
        class:ppp-database-canvas--stack={layoutMode === "stack"}
        class:ppp-database-canvas--free={layoutMode === "free"}
      >
        {#each widgets as widget (widget.id)}
          <WidgetHost
            {widget}
            frame={widget.type === "filter-tabs" ? frame : displayFrame}
            {api}
            {readonly}
            {getRecordColor}
            fields={frame.fields}
            tableConfig={config?.table}
            isPrimaryDataTable={widget.id === primaryDataTableId}
            fieldPresets={config?.fieldPresets ?? []}
            activeFieldPresetId={config?.activeFieldPresetId}
            {availableSources}
            rightFrames={$rightFramesStore}
            {project}
            on:filter={handleFilterTab}
            on:configChange={handleWidgetConfigChange}
            on:tableConfigChange={handleTableConfigChange}
            on:fieldPresetsChange={handleFieldPresetsChange}
            on:removeWidget={handleRemoveWidget}
          />
        {/each}
      </div>
    {/if}
    </div>
  </ViewContent>
</ViewLayout>

<style>
  .ppp-database-root {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 100%;
    gap: var(--ppp-space-sm, 0.375rem);
  }

  .ppp-database-canvas {
    container-name: canvas;
    container-type: inline-size;
    width: 100%;
    min-height: 100%;
  }

  .ppp-database-canvas--stack {
    display: flex;
    flex-direction: column;
    gap: var(--ppp-space-md, 0.5rem);
  }

  .ppp-database-canvas--free {
    display: grid;
    gap: var(--ppp-space-md, 0.5rem);
    grid-template-columns: repeat(12, 1fr);
  }

  @container canvas (max-width: 30rem) {
    .ppp-database-canvas--free {
      grid-template-columns: 1fr;
    }
  }

  @container canvas (min-width: 30rem) and (max-width: 55rem) {
    .ppp-database-canvas--free {
      grid-template-columns: repeat(6, 1fr);
    }
  }

  .ppp-database-toolbar {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0;
    flex-wrap: wrap;
  }

  .ppp-toolbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    min-height: 2.25rem;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
  }

  .ppp-toolbar-btn:hover {
    color: var(--text-normal);
    border-color: var(--interactive-accent);
    background: var(--background-secondary);
  }

  .ppp-toolbar-btn:active {
    background: var(--background-modifier-active-hover, var(--background-secondary));
    transform: translateY(0.0625rem);
  }

  .ppp-toolbar-btn:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.0625rem;
  }

  .ppp-toolbar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ppp-toolbar-btn[aria-pressed="true"] {
    color: var(--text-on-accent, var(--text-normal));
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
  }

  .ppp-filter-bridge {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
  }
  .ppp-filter-bridge-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.1875rem 0.5rem;
    font-size: var(--font-ui-smaller);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
  }
  .ppp-filter-bridge-chip--global {
    border-color: var(--interactive-accent);
    color: var(--text-normal);
  }
  .ppp-filter-bridge-chip--local {
    border-color: var(--color-orange, var(--text-accent));
    color: var(--text-normal);
  }
  .ppp-filter-bridge-icon {
    font-size: 0.75rem;
    line-height: 1;
  }
  .ppp-filter-bridge-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    padding: 0;
    margin-left: 0.125rem;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.875rem;
    cursor: pointer;
  }
  .ppp-filter-bridge-clear:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  .ppp-filter-bridge-promote {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    padding: 0;
    margin-left: 0.125rem;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--interactive-accent);
    font-size: 0.75rem;
    line-height: 1;
    cursor: pointer;
  }
  .ppp-filter-bridge-promote:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .ppp-database-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--ppp-space-3, 0.375rem);
    padding: var(--ppp-space-8, 2rem) var(--ppp-space-4, 0.5rem);
    color: var(--text-faint);
    text-align: center;
  }

  .ppp-database-empty-icon {
    font-size: 2rem;
    opacity: 0.4;
  }

  .ppp-database-empty-title {
    font-size: var(--ppp-font-size-base, 0.875rem);
    font-weight: var(--ppp-font-weight-medium, 500);
    color: var(--text-muted);
  }

  .ppp-database-empty-hint {
    font-size: var(--ppp-font-size-sm, 0.75rem);
    color: var(--text-faint);
    max-width: 20rem;
  }

  .ppp-quick-actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .ppp-quick-action {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
  }

  .ppp-quick-action:hover {
    border-color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }

  .ppp-quick-action:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.0625rem;
  }

  .ppp-template-confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-popover, 30);
  }

  .ppp-template-confirm {
    width: min(28rem, calc(100vw - 2rem));
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 0.5rem);
    box-shadow: var(--shadow-l);
    padding: 0.875rem;
  }

  .ppp-template-confirm h3 {
    margin: 0 0 0.375rem;
    font-size: var(--font-ui-medium);
    color: var(--text-normal);
  }

  .ppp-template-confirm p {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  .ppp-template-confirm-actions {
    margin-top: 0.75rem;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
