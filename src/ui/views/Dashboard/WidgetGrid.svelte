<script lang="ts">
  /**
   * WidgetGrid — extracted from DashboardCanvas.svelte (R5-013).
   *
   * Owns the three render branches (empty state, DnD-enabled stack, plain
   * grid) plus the duplicated WidgetHost mount sites. Events bubble up via
   * `on:eventname` forwarding so the parent keeps a single handler set.
   */
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
  import type { WidgetDefinition, DatabaseViewConfig } from "./types";

  import { i18n } from "src/lib/stores/i18n";
  import { createEventDispatcher } from "svelte";
  import { dndzone } from "svelte-dnd-action";

  import WidgetHost from "./widgets/WidgetHost.svelte";

  const dispatch = createEventDispatcher<{ showToolbar: void }>();

  export let widgets: WidgetDefinition[];
  export let dndWidgets: WidgetDefinition[];
  export let canDnd: boolean;
  export let layoutMode: "stack" | "free";
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

    {#if layoutMode === "free" && !readonly}
      <div class="ppp-canvas-add-affordance" role="none">
        <button
          class="ppp-canvas-add-btn"
          on:click={() => dispatch("showToolbar")}
          aria-label={$i18n.t("views.dashboard.canvas.add-widget", { defaultValue: "Add widget" })}
          title={$i18n.t("views.dashboard.canvas.add-widget", { defaultValue: "Add widget" })}
        >+</button>
      </div>
    {/if}
  </div>
{/if}

<style>
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

  /* Free-canvas `+` affordance — fades in when canvas is hovered */
  .ppp-canvas-add-affordance {
    grid-column: 1 / -1;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: var(--ppp-space-2, 0.25rem);
    opacity: 0;
    transition: opacity 180ms ease;
  }

  .ppp-database-canvas--free:hover .ppp-canvas-add-affordance {
    opacity: 1;
  }

  .ppp-canvas-add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 0.0625rem dashed var(--background-modifier-border-hover);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-faint);
    font-size: 1.125rem;
    line-height: 1;
    cursor: pointer;
    transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
  }

  .ppp-canvas-add-btn:hover {
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }

  .ppp-canvas-add-btn:hover {
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }

  .ppp-canvas-add-btn:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.0625rem;
  }

  /* DG-8 drop target: dashed outline + subtle fill on svelte-dnd-action placeholder */
  :global(.ppp-database-canvas--stack [data-is-dnd-shadow-item-hint]) {
    border: 0.125rem dashed var(--interactive-accent);
    border-radius: 0.375rem;
    background: rgba(var(--interactive-accent-rgb, 122, 104, 238), 0.06);
    opacity: 0.6;
  }
</style>
