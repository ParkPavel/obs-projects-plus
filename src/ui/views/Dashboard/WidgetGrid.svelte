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
  import type { ExternalSourceState } from "./dashboardPreload";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
  import type { WidgetDefinition, DatabaseViewConfig, WidgetType } from "./types";

  import { i18n } from "src/lib/stores/i18n";
  import { createEventDispatcher } from "svelte";
  import { dragHandleZone, SOURCES, TRIGGERS, type DndEvent } from "svelte-dnd-action";
  import { Icon } from "obsidian-svelte";
  import { ignoreHostSwipe } from "src/ui/actions/ignoreHostSwipe";

  import WidgetHost from "./widgets/WidgetHost.svelte";
  import DashboardBlockPalette from "./widgets/DashboardBlockPalette.svelte";
  import EmptyState from "src/ui/components/EmptyState/EmptyState.svelte";

  const dispatch = createEventDispatcher<{
    showToolbar: void;
    addWidget: WidgetType;
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
  /** #136: per-source state, so a block can tell "loading" from "gone". */
  export let sourceStates: ReadonlyMap<string, ExternalSourceState> = new Map();
  export let project: ProjectDefinition;

  // ── ios-g1 G1: widgets drag from the grip only ──
  //
  // `dragHandleZone` keeps every item drag-disabled until a `dragHandle` (the
  // grip WidgetShell renders) is pressed, so a pan or long press on the widget
  // body scrolls. The library re-disables the items only on a POINTER
  // `finalize` or a KEYBOARD `dragStopped` `consider`. A press on the grip that
  // never moves far enough to start a drag (a tap) produces neither, and leaves
  // every item armed: the next pan anywhere on a widget would start a drag —
  // exactly the accident this change removes. So on release after a grip press
  // that started no drag, this disarms the zone through the one public route
  // the library listens to: a `consider` it reads as "keyboard drag stopped".
  // That event is ours, never a reorder, and the forwarding handlers drop it.
  const GRIP_SELECTOR = ".ppp-widget-grip";
  const disarmEvents = new WeakSet<Event>();

  function disarmAfterGripTap(node: HTMLElement) {
    let pressed = false;
    let dragStarted = false;

    function onPress(e: Event) {
      if (!(e.target instanceof Element) || !e.target.closest(GRIP_SELECTOR)) return;
      pressed = true;
      dragStarted = false;
    }
    function onConsider(e: Event) {
      // A real `consider` means a drag is under way; the library itself
      // disarms the zone when that drag finalizes.
      if (!disarmEvents.has(e)) dragStarted = true;
    }
    function onRelease() {
      if (!pressed) return;
      pressed = false;
      if (dragStarted) return;
      const detail: DndEvent<WidgetDefinition> = {
        items: dndWidgets,
        info: { trigger: TRIGGERS.DRAG_STOPPED, id: "", source: SOURCES.KEYBOARD },
      };
      const disarm = new CustomEvent("consider", { detail });
      disarmEvents.add(disarm);
      node.dispatchEvent(disarm);
    }

    // Capture on the zone: runs before the grip's own handler, whatever it does.
    node.addEventListener("mousedown", onPress, true);
    node.addEventListener("touchstart", onPress, { capture: true, passive: true });
    node.addEventListener("consider", onConsider);
    window.addEventListener("mouseup", onRelease);
    window.addEventListener("touchend", onRelease);
    window.addEventListener("touchcancel", onRelease);
    return {
      destroy() {
        node.removeEventListener("mousedown", onPress, true);
        node.removeEventListener("touchstart", onPress, true);
        node.removeEventListener("consider", onConsider);
        window.removeEventListener("mouseup", onRelease);
        window.removeEventListener("touchend", onRelease);
        window.removeEventListener("touchcancel", onRelease);
      },
    };
  }

  function forwardConsider(e: CustomEvent<DndEvent<WidgetDefinition>>) {
    if (disarmEvents.has(e)) return;
    dispatch("consider", e.detail);
  }
</script>

{#if widgets.length === 0}
  <EmptyState
    icon="layout-grid"
    title={$i18n.t("views.dashboard.canvas.empty-title", { defaultValue: "Empty canvas" })}
    hint={readonly
      ? ""
      : $i18n.t("views.dashboard.canvas.empty-hint", { defaultValue: "Start with a data block" })}
  >
    <svelte:fragment slot="actions">
      {#if !readonly}
        <button on:click={() => dispatch("addWidget", "database-call")}>
          <Icon name="database" />
          {$i18n.t("views.dashboard.canvas.empty-add-block", { defaultValue: "Add data block" })}
        </button>
      {/if}
    </svelte:fragment>
  </EmptyState>
{:else if canDnd}
  <!-- ios-g1: G1 grip-only drag (see the script), G2 interior swipes stay in
       the dashboard instead of opening Obsidian's drawers. -->
  <div
    class="ppp-database-canvas ppp-database-canvas--stack"
    use:dragHandleZone={{ items: dndWidgets, flipDurationMs: 200, type: "widgets" }}
    use:disarmAfterGripTap
    use:ignoreHostSwipe
    on:consider={forwardConsider}
    on:finalize={(e) => dispatch("finalize", e.detail)}
  >
    {#each dndWidgets as widget (widget.id)}
      <WidgetHost
        reorderable
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
        {sourceStates}
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
  <div class="ppp-database-canvas ppp-database-canvas--stack" use:ignoreHostSwipe>
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
        {sourceStates}
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
  /* Matryoshka rung (#166): the canvas is a query container between the
     dashboard root and the widgets. `width: 100%` here too, so inline-size
     containment removes nothing this box depended on. */
  .ppp-database-canvas {
    width: 100%;
    min-height: 100%;
    container-type: inline-size;
    container-name: dashboard-canvas;
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
