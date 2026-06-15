<script lang="ts">
  /**
   * WidgetGrid — stack-mode renderer for the dashboard widget list.
   *
   * Owns three render branches: empty state, DnD-enabled stack and read-only
   * stack. Free-positioning is handled by `FreeCanvas` + `WindowShell` mounted
   * directly from `DashboardCanvas`; this component is invoked only when the
   * canvas is in stack mode.
   */
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
  import type { WidgetDefinition, DatabaseViewConfig, WidgetType } from "./types";

  import { i18n } from "src/lib/stores/i18n";
  import { createEventDispatcher } from "svelte";
  import { dndzone, type DndEvent } from "svelte-dnd-action";
  import { Icon } from "obsidian-svelte";

  import WidgetHost from "./widgets/WidgetHost.svelte";
  import DashboardBlockPalette from "./widgets/DashboardBlockPalette.svelte";
  import EmptyState from "src/ui/components/EmptyState/EmptyState.svelte";
  import { WIDGET_TEMPLATES } from "./widgetTemplates";

  const dispatch = createEventDispatcher<{
    showToolbar: void;
    addWidget: WidgetType;
    applyTemplate: WidgetDefinition[];
    consider: DndEvent<WidgetDefinition>;
    finalize: DndEvent<WidgetDefinition>;
  }>();

  export let widgets: WidgetDefinition[];
  export let dndWidgets: WidgetDefinition[];
  export let canDnd: boolean;
  export let frame: DataFrame;
  export let displayFrame: DataFrame;
  export let api: ViewApi;
  export let readonly: boolean;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let fields: DataField[];
  export let tableConfig: DatabaseViewConfig["table"] | undefined;
  export let primaryDataTableId: string;
  export let fieldPresets: NonNullable<DatabaseViewConfig["fieldPresets"]>;
  export let activeFieldPresetId: string | undefined;
  export let availableSources: { id: string; name: string }[];
  export let availableWidgets: Array<{ id: string; title: string }> = [];
  export let rightFrames: ReadonlyMap<string, DataFrame>;
  export let project: ProjectDefinition;
</script>

{#if widgets.length === 0}
  <EmptyState
    icon="layout-grid"
    title={$i18n.t("views.dashboard.canvas.empty-title", { defaultValue: "Empty canvas" })}
    hint={readonly
      ? ""
      : $i18n.t("views.dashboard.canvas.empty-hint", { defaultValue: "Start with a data block, or pick a ready-made template" })}
  >
    <svelte:fragment slot="actions">
      {#if !readonly}
        <button on:click={() => dispatch("addWidget", "database-call")}>
          <Icon name="database" />
          {$i18n.t("views.dashboard.canvas.empty-add-block", { defaultValue: "Add data block" })}
        </button>
        {#each WIDGET_TEMPLATES as tpl}
          <button on:click={() => dispatch("applyTemplate", tpl.widgets)} title={$i18n.t(tpl.descriptionKey)}>
            <Icon name="layout-template" />
            {$i18n.t(tpl.labelKey)}
          </button>
        {/each}
      {/if}
    </svelte:fragment>
  </EmptyState>
{:else if canDnd}
  <div
    class="ppp-database-canvas ppp-database-canvas--stack"
    use:dndzone={{ items: dndWidgets, flipDurationMs: 200, type: "widgets" }}
    on:consider={(e) => dispatch("consider", e.detail)}
    on:finalize={(e) => dispatch("finalize", e.detail)}
  >
    {#each dndWidgets as widget (widget.id)}
      <WidgetHost
        {widget}
        frame={widget.type === "filter-tabs" ? frame : displayFrame}
        {api}
        {readonly}
        {getRecordColor}
        {fields}
        {tableConfig}
        isPrimaryDataTable={widget.id === primaryDataTableId}
        {fieldPresets}
        {activeFieldPresetId}
        {availableSources}
        {availableWidgets}
        {rightFrames}
        {project}
        on:filter
        on:configChange
        on:tableConfigChange
        on:fieldPresetsChange
        on:removeWidget
      />
    {/each}
  </div>
  <div class="ppp-canvas-stack-add">
    <DashboardBlockPalette
      currentWidgets={dndWidgets}
      on:addWidget={(e) => dispatch("addWidget", e.detail)}
    />
  </div>
{:else}
  <div class="ppp-database-canvas ppp-database-canvas--stack">
    {#each widgets as widget (widget.id)}
      <WidgetHost
        {widget}
        frame={widget.type === "filter-tabs" ? frame : displayFrame}
        {api}
        {readonly}
        {getRecordColor}
        {fields}
        {tableConfig}
        isPrimaryDataTable={widget.id === primaryDataTableId}
        {fieldPresets}
        {activeFieldPresetId}
        {availableSources}
        {availableWidgets}
        {rightFrames}
        {project}
        on:filter
        on:configChange
        on:tableConfigChange
        on:fieldPresetsChange
        on:removeWidget
      />
    {/each}
  </div>
{/if}

<style>
  .ppp-database-canvas {
    width: 100%;
    min-height: 100%;
  }

  .ppp-database-canvas--stack {
    display: flex;
    flex-direction: column;
    gap: var(--ppp-space-md, 0.5rem);
  }

  /* Stack-canvas add row — always visible at list end */
  .ppp-canvas-stack-add {
    display: flex;
    justify-content: center;
    padding: var(--ppp-space-2, 0.25rem);
  }

  /* DG-8 drop target: dashed outline + subtle fill on svelte-dnd-action placeholder */
  :global(.ppp-database-canvas--stack [data-is-dnd-shadow-item-hint]) {
    border: 0.125rem dashed var(--interactive-accent);
    border-radius: 0.375rem;
    background: rgba(var(--interactive-accent-rgb, 122, 104, 238), 0.06);
    opacity: 0.6;
  }
</style>
