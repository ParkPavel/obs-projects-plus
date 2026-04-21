<script lang="ts">
  import type {
    DataFrame,
    DataRecord,
  } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { DatabaseViewConfig } from "./types";

  import { ViewContent, ViewLayout } from "src/ui/components/Layout";
  import { setContext } from "svelte";
  import { writable, type Writable } from "svelte/store";
  import { dndzone, SHADOW_PLACEHOLDER_ITEM_ID } from "svelte-dnd-action";

  import WidgetHost from "./widgets/WidgetHost.svelte";
  import WidgetToolbar from "./widgets/WidgetToolbar.svelte";
  import FormulaBar from "./widgets/FormulaBar.svelte";
  import { getWidgetMeta } from "./widgets/widgetRegistry";
  import { get } from "svelte/store";
  import { getDesignTokenCSS } from "./designTokens";
  import { isMobile } from "src/lib/stores/ui";
  import { i18n } from "src/lib/stores/i18n";
  import type { WidgetType, WidgetDefinition } from "./types";

  // ── Props ──────────────────────────────────────────────────
  export let project: ProjectDefinition;
  export let frame: DataFrame;
  export let readonly: boolean;
  export let api: ViewApi;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let config: DatabaseViewConfig | undefined;
  export let onConfigChange: (cfg: DatabaseViewConfig) => void;

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

  function toggleToolbar() {
    if (!config) return;
    saveConfig({ ...config, showWidgetToolbar: !showToolbar });
  }

  function toggleLayout() {
    if (!config) return;
    const next = layoutMode === "stack" ? "free" : "stack";
    saveConfig({ ...config, layoutMode: next });
  }

  // ── Formula bar state ──────────────────────────────────────
  let showFormulaBar = false;
  $: fieldNames = frame.fields.map((f) => f.name);
  $: previewRecord = frame.records[0];

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
</script>

<ViewLayout>
  <ViewContent>
    <div class="ppp-database-root" style={tokenCSS} role="region" aria-label={$i18n.t("views.database.name")}>
    <!-- Toolbar row -->
    <div class="ppp-database-toolbar">
      <button
        class="ppp-toolbar-btn clickable-icon"
        on:click={toggleToolbar}
        aria-label={showToolbar ? $i18n.t("views.database.canvas.hide-toolbar") : $i18n.t("views.database.canvas.show-toolbar")}
      >
        {showToolbar ? "−" : "+"} {$i18n.t("views.database.canvas.widgets")}
      </button>
      <button
        class="ppp-toolbar-btn clickable-icon"
        on:click={toggleLayout}
        aria-label={$i18n.t("views.database.canvas.toggle-layout")}
        disabled={$isMobile}
      >
        {layoutMode === "stack" ? `⊞ ${$i18n.t("views.database.canvas.layout-grid")}` : `≡ ${$i18n.t("views.database.canvas.layout-stack")}`}
      </button>
      {#if !readonly}
        <button
          class="ppp-toolbar-btn clickable-icon"
          on:click={() => (showFormulaBar = !showFormulaBar)}
          aria-label={showFormulaBar ? $i18n.t("views.database.canvas.hide-formula-bar") : $i18n.t("views.database.canvas.show-formula-bar")}
        >
          ƒx
        </button>
      {/if}
      {#if showToolbar && !readonly}
        <WidgetToolbar
          currentWidgets={widgets}
          on:addWidget={(e) => addWidget(e.detail)}
          on:applyTemplate={(e) => {
            if (!config) return;
            saveConfig({ ...config, widgets: e.detail });
          }}
        />
      {/if}
    </div>

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

    <!-- Widget grid -->
    {#if widgets.length === 0}
      <div class="ppp-database-empty">
        <div class="ppp-database-empty-icon">⊞</div>
        <span class="ppp-database-empty-title">{$i18n.t("views.database.canvas.empty-title", { defaultValue: "No widgets yet" })}</span>
        <span class="ppp-database-empty-hint">{$i18n.t("views.database.canvas.empty-hint", { defaultValue: "Click \"+\" in the toolbar to add your first widget" })}</span>
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
            {frame}
            {api}
            {readonly}
            {getRecordColor}
            fields={frame.fields}
            tableConfig={config?.table}
            on:configChange={(e) => {
              if (!config) return;
              const updated = config.widgets.map((w) =>
                w.id === e.detail.id ? { ...w, ...e.detail.changes } : w
              );
              saveConfig({ ...config, widgets: updated });
            }}
            on:tableConfigChange={(e) => {
              if (!config) return;
              saveConfig({ ...config, table: e.detail });
            }}
            on:removeWidget={(e) => removeWidget(e.detail)}
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
            {frame}
            {api}
            {readonly}
            {getRecordColor}
            fields={frame.fields}
            tableConfig={config?.table}
            on:configChange={(e) => {
              if (!config) return;
              const updated = config.widgets.map((w) =>
                w.id === e.detail.id ? { ...w, ...e.detail.changes } : w
              );
              saveConfig({ ...config, widgets: updated });
            }}
            on:tableConfigChange={(e) => {
              if (!config) return;
              saveConfig({ ...config, table: e.detail });
            }}
            on:removeWidget={(e) => removeWidget(e.detail)}
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
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
  }

  .ppp-toolbar-btn:hover {
    color: var(--text-normal);
    border-color: var(--interactive-accent);
    background: var(--background-secondary);
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
</style>
