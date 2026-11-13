<script lang="ts">
  /**
   * WidgetGrid — the renderer of the dashboard widget list.
   *
   * Owns three render branches: empty state, DnD-enabled page and read-only
   * page. B7: the dashboard is a page — blocks in list order, whatever the
   * stored `layoutMode` says ("free" configs keep their JSON and render here
   * too). The one way in is the «+» before each block and at the end.
   *
   * i3-dash: the page has two shapes, chosen by the width of this canvas (not
   * the device; layout/measureWidth.ts):
   *  - wide → TILES: an N-column grid; a block spans its stored `layout.w`
   *    (twelfths) × `layout.h` (rows), is resized from its corner handle with
   *    snapping to cells and reordered by its grip; places follow list order
   *    (layout/tileGrid.ts). Content scrolls inside its tile.
   *  - narrow → STACK, as before, plus a sticky jump bar of block titles
   *    (layout/BlockJumpBar.svelte) so a block below a tall one is one tap away.
   */
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { ExternalSourceState } from "./dashboardPreload";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
  import type { WidgetDefinition, DatabaseViewConfig, WidgetType } from "./types";

  import { i18n } from "src/lib/stores/i18n";
  import { createEventDispatcher, onDestroy } from "svelte";
  import { dragHandleZone, SOURCES, TRIGGERS, type DndEvent } from "svelte-dnd-action";
  import { Icon } from "obsidian-svelte";
  import { Platform } from "obsidian";
  import { ignoreHostSwipe } from "src/ui/actions/ignoreHostSwipe";
  import { createReorderCollapse, type ReorderCollapse } from "./reorderCollapse";
  import { measureWidth } from "./layout/measureWidth";
  import { columnsFor, GAP_EM, nudgeSpan, packTiles, ROW_EM, rowsFor, spanFor, tileArea, tileSteps, withResized, type TileSpan } from "./layout/tileGrid";
  import { startTileResize } from "./layout/tileResize";
  import { jumpItems, jumpToBlock } from "./layout/blockJump";
  import { createBlockProperties, provideBlockProperties } from "./layout/blockProperties";
  import { insertIndexAfter, insertIndexBefore, provideBlockInsert } from "./layout/blockInsert";

  import WidgetHost from "./widgets/WidgetHost.svelte";
  import DashboardBlockPalette from "./widgets/DashboardBlockPalette.svelte";
  import EmptyState from "src/ui/components/EmptyState/EmptyState.svelte";
  import BlockOutlineButton from "./layout/BlockOutlineButton.svelte";
  import { blockOutlineStore, mostVisibleBlock } from "./layout/blockOutline";
  import { visibleViewport } from "src/ui/utils/visibleViewport";

  const dispatch = createEventDispatcher<{
    insert: { type: WidgetType; index: number };
    consider: DndEvent<WidgetDefinition>;
    finalize: DndEvent<WidgetDefinition>;
    /** i3-dash: a resize — the whole list, positions repacked; the canvas saves it as is. */
    layout: WidgetDefinition[];
    /** i3-dash: «Properties» picked in a block menu (layout/blockProperties.ts). */
    openProperties: void;
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

  provideBlockProperties(createBlockProperties(() => project.name, () => dispatch("openProperties")));

  // ── i3-close: «Insert block after» in a tile's menu (layout/blockInsert.ts) ──
  // The end palette opens at the tile with the position after it; the choice
  // goes out as the same `insert` the in-between «+» of the stack sends.
  let paletteOpen = false;
  let insertAt: { index: number; anchor: HTMLElement | null; label?: string } | null = null;
  $: if (!paletteOpen) insertAt = null;

  // ── w4-p10 (N7, Codex design C): the selected block and «+ Block» ──
  // A tap or click on a block's header (not on its buttons) selects it: a thin
  // frame marks it until another is picked, it is removed, or the view goes.
  // «+ Block» in the plugin bar inserts after the selected block, else after
  // the one most on screen; the palette names the place.
  let selectedId: string | null = null;
  $: if (selectedId && !dndWidgets.some((w) => w.id === selectedId)) selectedId = null;
  function selectFromHeader(e: Event, id: string): void {
    const target = e.target as Element | null;
    if (!target?.closest?.(".ppp-widget-header")) return;
    if (target.closest("button, input, select, textarea, a, [role='button'], [contenteditable='true']")) return;
    selectedId = id;
  }
  function openInsert(anchor: HTMLElement | null): void {
    const ids = dndWidgets.map((w) => w.id);
    const target = selectedId ?? mostVisibleBlock(canvasEl, visibleViewport(canvasEl?.ownerDocument.defaultView ?? window));
    const name = dndWidgets.find((w) => w.id === target)?.title?.trim();
    insertAt = target
      ? { index: insertIndexAfter(ids, target), anchor, label: $i18n.t("views.dashboard.insert.after", { name: name || String(ids.indexOf(target) + 1), defaultValue: "After «{{name}}»" }) }
      : { index: 0, anchor, label: $i18n.t("views.dashboard.insert.start", { defaultValue: "At the start" }) };
    paletteOpen = true;
  }
  provideBlockInsert({
    available: () => canDnd && !readonly,
    after: (id, anchor) => {
      insertAt = { index: insertIndexAfter(dndWidgets.map((w) => w.id), id), anchor };
      paletteOpen = true;
    },
    before: (id, anchor) => {
      insertAt = { index: insertIndexBefore(dndWidgets.map((w) => w.id), id), anchor };
      paletteOpen = true;
    },
  });

  // ── i3-dash: tiles or stack, from this canvas's own width ──
  let canvasEl: HTMLElement | null = null;
  let widthPx = 0;
  let fontPx = 16;
  /** 0 = stack; otherwise the grid's column count. */
  let columns = 0;
  function onMeasure(width: number, font: number) {
    widthPx = width;
    fontPx = font;
    columns = columnsFor(width / font, columns);
  }
  $: tileMode = columns > 0;
  /** A resize in progress: the one block whose span is not its stored one yet. */
  let resizing: { id: string; span: TileSpan } | null = null;
  $: tileList = canDnd ? dndWidgets : widgets;
  $: placements = tileMode ? packTiles(tileList.map((w) => spanOf(w, resizing, columns)), columns) : [];
  /** A collapsed tile is its header: one row. A tile being resized shows the span it snaps to. */
  function spanOf(w: WidgetDefinition, live: { id: string; span: TileSpan } | null, cols: number): TileSpan {
    if (live && live.id === w.id) return live.span;
    return { cols: spanFor(w.layout?.w, cols), rows: w.collapsed ? 1 : rowsFor(w.layout?.h) };
  }
  // Set as single properties (style: directives), never as a whole style
  // attribute: reorderCollapse and the drag library write inline styles too.
  $: tileColumns = tileMode ? String(columns) : undefined;
  $: tileRow = tileMode ? `${ROW_EM}em` : undefined;
  $: tileGap = tileMode ? `${GAP_EM}em` : undefined;
  $: areas = placements.map((p) => tileArea(p));
  /** Tiles get a resize handle on an editable page; pinned and collapsed ones do not (markup). */
  $: canResize = tileMode && !readonly;

  function commitSpan(id: string, from: TileSpan, to: TileSpan) {
    if (from.cols === to.cols && from.rows === to.rows) return;
    dispatch("layout", withResized(widgets, id, to, columns));
  }

  let stopResize: (() => void) | null = null;
  onDestroy(() => stopResize?.());

  function startResize(e: PointerEvent, widget: WidgetDefinition, index: number) {
    const start = placements[index];
    if (e.button !== 0 || !start || !canvasEl) return;
    e.preventDefault();
    e.stopPropagation();
    stopResize?.();
    const from: TileSpan = { cols: start.cols, rows: start.rows };
    resizing = { id: widget.id, span: from };
    stopResize = startTileResize({
      win: canvasEl.ownerDocument.defaultView ?? window,
      startX: e.clientX, startY: e.clientY, from, columns,
      steps: tileSteps(widthPx, fontPx, columns),
      onPreview: (span) => (resizing = { id: widget.id, span }),
      onEnd: (span) => {
        stopResize = null;
        resizing = null;
        if (span) commitSpan(widget.id, from, span);
      },
    });
  }

  function nudgeResize(e: KeyboardEvent, widget: WidgetDefinition, index: number) {
    const start = placements[index];
    const next = start ? nudgeSpan(start, e.key, columns) : null;
    if (!start || !next) return;
    e.preventDefault();
    commitSpan(widget.id, start, next);
  }

  // ── w4-p10a (N15): the page's table of contents ──
  // Published to the plugin bar's "Blocks · N" (blockOutline.ts) on any width;
  // without an App around this grid, the same button is drawn above the blocks.
  // The carousel row of titles is gone.
  const outlineStore = blockOutlineStore();
  $: jumpList = widgets.length > 1 ? jumpItems(widgets) : [];
  $: outline = widgets.length > 0
    ? {
        items: jumpList,
        jump: (id: string) => { jumpToBlock(canvasEl, id); },
        current: () => mostVisibleBlock(canvasEl, visibleViewport(canvasEl?.ownerDocument.defaultView ?? window)),
        insert: canDnd && !readonly ? openInsert : undefined,
      }
    : null;
  $: outlineStore?.set(outline);
  onDestroy(() => outlineStore?.set(null));

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
  //
  // The same press collapses every tile to its header (reorderCollapse.ts), so
  // a tall tile cannot block the drag. It runs in the capture phase, before the
  // library measures on the first move, and ends on `finalize` or on that same
  // tap release.
  const GRIP_SELECTOR = ".ppp-widget-grip";
  const disarmEvents = new WeakSet<Event>();
  let reordering = false;
  let collapse: ReorderCollapse | null = null;

  function disarmAfterGripTap(node: HTMLElement) {
    let pressed = false;
    let dragStarted = false;
    const tiles = createReorderCollapse(node, (on) => (reordering = on));
    collapse = tiles;

    function onPress(e: Event) {
      if (!(e.target instanceof Element) || !e.target.closest(GRIP_SELECTOR)) return;
      pressed = true;
      dragStarted = false;
      // i3-dash: tiles have a bounded height already; collapsing them to their
      // headers would only make the grid jump under the pointer.
      if (!tileMode) tiles.begin(e.target);
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
      tiles.end(false);
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
    // The canvas's own window: in a popout the release never reaches the main one.
    const win = node.ownerDocument.defaultView ?? window;
    win.addEventListener("mouseup", onRelease);
    win.addEventListener("touchend", onRelease);
    win.addEventListener("touchcancel", onRelease);
    return {
      destroy() {
        node.removeEventListener("mousedown", onPress, true);
        node.removeEventListener("touchstart", onPress, true);
        node.removeEventListener("consider", onConsider);
        win.removeEventListener("mouseup", onRelease);
        win.removeEventListener("touchend", onRelease);
        win.removeEventListener("touchcancel", onRelease);
        tiles.dispose();
        if (collapse === tiles) collapse = null;
      },
    };
  }

  function onFinalize(e: CustomEvent<DndEvent<WidgetDefinition>>) {
    dispatch("finalize", e.detail);
    collapse?.end(true);
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
        <button class="mod-cta" on:click={() => dispatch("insert", { type: "database-call", index: 0 })}>
          <Icon name="database" />
          {$i18n.t("views.dashboard.canvas.empty-add-block", { defaultValue: "Add a database" })}
        </button>
      {/if}
    </svelte:fragment>
  </EmptyState>
  <slot name="empty-extra" />
{:else}
  {#if outline && outline.items.length > 0 && !outlineStore}
    <div class="ppp-block-outline-row"><BlockOutlineButton {outline} /></div>
  {/if}
  {#if canDnd}
  <!-- ios-g1: G1 grip-only drag (see the script), G2 interior swipes stay in
       the dashboard instead of opening Obsidian's drawers. -->
  <div
    bind:this={canvasEl}
    class="ppp-database-canvas"
    class:ppp-database-canvas--stack={!tileMode}
    class:ppp-database-canvas--tiles={tileMode}
    class:ppp-database-canvas--reordering={reordering}
    style:--ppp-tile-columns={tileColumns}
    style:--ppp-tile-row={tileRow}
    style:--ppp-tile-gap={tileGap}
    use:measureWidth={onMeasure}
    use:dragHandleZone={{ items: dndWidgets, flipDurationMs: 200, type: "widgets" }}
    use:disarmAfterGripTap
    use:ignoreHostSwipe
    on:consider={forwardConsider}
    on:finalize={onFinalize}
  >
    {#each dndWidgets as widget, index (widget.id)}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <div class="ppp-block-slot" class:ppp-block-slot--selected={selectedId === widget.id}
        style:grid-column={areas[index]?.column} style:grid-row={areas[index]?.row}
        on:click={(e) => selectFromHeader(e, widget.id)}
        on:focusin={(e) => selectFromHeader(e, widget.id)}>
      <!-- i3-dash: in tiles a block is inserted with the «+» after the grid;
           a «+» inside every tile would sit on top of its content.
           i3-close: or after a given tile, from its menu (layout/blockInsert.ts). -->
      <!-- w4-p10 (N7): no «+» between blocks on a phone — «+ Block» in the bar. -->
      {#if !tileMode && !Platform.isPhone}<DashboardBlockPalette variant="between" {index} currentWidgets={dndWidgets} on:insert />{/if}
      <WidgetHost
        reorderable={!widget.layout?.locked}
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
        on:duplicateWidget
      />
      {#if canResize && !widget.layout?.locked && !widget.collapsed}
        <!-- i3-dash: drag the corner, the tile snaps to whole cells; arrow keys
             change it by one cell. Outside the host, so a reorder collapse that
             hides a tile's content leaves it alone. -->
        <button
          type="button"
          class="ppp-tile-resize clickable-icon"
          aria-label={$i18n.t("views.dashboard.widget.resize", { defaultValue: "Resize the block: drag, or use the arrow keys" })}
          title={$i18n.t("views.dashboard.widget.resize", { defaultValue: "Resize the block: drag, or use the arrow keys" })}
          on:pointerdown={(e) => startResize(e, widget, index)}
          on:keydown={(e) => nudgeResize(e, widget, index)}
        ><Icon name="move-diagonal-2" size="sm" /></button>
      {/if}
      </div>
    {/each}
  </div>
  <div class="ppp-canvas-stack-add">
    <DashboardBlockPalette
      index={insertAt?.index ?? dndWidgets.length}
      anchorEl={insertAt?.anchor ?? null}
      placeLabel={insertAt?.label ?? ""}
      bind:open={paletteOpen}
      currentWidgets={dndWidgets}
      on:insert
    />
  </div>
  {:else}
  <div
    bind:this={canvasEl}
    class="ppp-database-canvas"
    class:ppp-database-canvas--stack={!tileMode}
    class:ppp-database-canvas--tiles={tileMode}
    style:--ppp-tile-columns={tileColumns}
    style:--ppp-tile-row={tileRow}
    style:--ppp-tile-gap={tileGap}
    use:measureWidth={onMeasure}
    use:ignoreHostSwipe
  >
    {#each widgets as widget, index (widget.id)}
      <div class="ppp-block-slot" style:grid-column={areas[index]?.column} style:grid-row={areas[index]?.row}>
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
        on:duplicateWidget
      />
      </div>
    {/each}
  </div>
  {/if}
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

  /* i3-dash: the jump bar's target lands below the sticky bar, not under it. */
  .ppp-database-canvas--stack :global(.ppp-widget-host) {
    scroll-margin-top: 3em;
  }

  /* i3-dash: tiles. Columns, row and gap come from tileGrid.ts through the
     inline custom properties, so the pointer math and the drawing agree.
     A tile's height is its rows; its content scrolls inside it (the shell's
     content box is the scroller). Nothing here contains overscroll: at the end
     of a tile's content the wheel goes on to the page. */
  .ppp-database-canvas--tiles {
    display: grid;
    grid-template-columns: repeat(var(--ppp-tile-columns), minmax(0, 1fr));
    grid-auto-rows: var(--ppp-tile-row);
    gap: var(--ppp-tile-gap);
  }

  .ppp-database-canvas--tiles .ppp-block-slot {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .ppp-database-canvas--tiles .ppp-block-slot > :global(.ppp-widget-host) {
    flex: 1 1 auto;
    min-height: 0;
  }

  .ppp-database-canvas--tiles :global(.ppp-widget-content) {
    min-height: 0;
  }

  /* The corner handle: over the tile's bottom-right corner, em-sized because
     it lives inside the canvas container. `touch-action: none` gives a pen or
     finger drag to the resize instead of a pan. */
  .ppp-tile-resize {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 1.5em;
    height: 1.5em;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-radius: var(--radius-s);
    box-shadow: none;
    cursor: nwse-resize;
    touch-action: none;
  }

  .ppp-tile-resize:focus-visible {
    outline: 0.125em solid var(--interactive-accent);
    color: var(--text-normal);
  }

  @media (hover: hover) and (pointer: fine) {
    .ppp-tile-resize:hover {
      color: var(--text-normal);
      background: var(--background-modifier-hover);
    }
  }

  @media (pointer: coarse) {
    .ppp-tile-resize {
      width: var(--ppp-touch-target-min);
      height: var(--ppp-touch-target-min);
    }
  }

  /* Stack-canvas add row — always visible at list end */
  .ppp-canvas-stack-add {
    display: flex;
    justify-content: center;
    padding: var(--ppp-space-2, 0.25rem);
  }

  /* Reorder state: a held grip leaves every tile as its header, so the list
     fits the viewport. Hidden, not unmounted — nothing is rebuilt on release. */
  .ppp-database-canvas--reordering :global(.ppp-widget-host > :not(.ppp-widget-header)) {
    display: none;
  }
  /* …and the canvas keeps its height meanwhile (reorderCollapse HOLD_VAR), so
     the page does not shorten under the scroll position and the pressed tile
     stays where the finger is. */
  .ppp-database-canvas--reordering {
    min-height: var(--ppp-reorder-hold, 100%);
  }

  /* DG-8 drop target: dashed outline + subtle fill on svelte-dnd-action placeholder */
  :global(.ppp-database-canvas--stack [data-is-dnd-shadow-item-hint]),
  :global(.ppp-database-canvas--tiles [data-is-dnd-shadow-item-hint]) {
    border: 0.125rem dashed var(--interactive-accent);
    border-radius: 0.375rem;
    background: rgba(var(--interactive-accent-rgb, 122, 104, 238), 0.06);
    opacity: 0.6;
  }
  /* w4-p10a: the table of contents without an App bar around the grid. */
  .ppp-block-outline-row {
    display: flex;
    padding: 0.25em 0;
  }
  /* w4-p10 (N7): the selected block — where «+ Block» inserts after. */
  .ppp-block-slot--selected {
    outline: var(--ppp-border-width) solid var(--interactive-accent);
    outline-offset: 0.125em;
    border-radius: var(--radius-m);
  }
</style>
