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
  import { dndzone } from "svelte-dnd-action";

  import WidgetHost from "./widgets/WidgetHost.svelte";
  import DashboardBlockPalette from "./widgets/DashboardBlockPalette.svelte";

  const dispatch = createEventDispatcher<{ showToolbar: void; addWidget: WidgetType }>();

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
  export let rightFrames: ReadonlyMap<string, DataFrame>;
  export let project: ProjectDefinition;
</script>

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
    on:consider
    on:finalize
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
