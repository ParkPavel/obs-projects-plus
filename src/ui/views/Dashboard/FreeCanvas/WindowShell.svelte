<script lang="ts">
  /**
   * WindowShell.svelte — pointer-driven drag/resize wrapper for one Free Canvas window.
   *
   * Spec: .ai_internal/New-specification/FREE_CANVAS_SPEC.md §6, §6.x, §7.x.
   * Ticket: #032.3 (Phase 3 sub-PR 3).
   *
   * Wiring contract:
   *   - Drag handler on the header bar updates `store.moveWindow(id, target)`,
   *     which routes through the resolver in `push` mode (#032.1).
   *   - 8 resize handles update `store.resizeWindow(id, target)` in `clamp` mode.
   *   - `pointerdown` anywhere on the shell calls `store.bringToFront(id)`
   *     (idempotent: no-op if already top per store contract).
   *
   * Out of scope (deferred):
   *   - rAF throttle / overlay state during drag (#032.4 lives in FreeCanvas).
   *   - Snap-to-grid (caller pre-snaps; or #032.4 handles it).
   *   - Mobile long-press activation, touch-action policy beyond `touch-action:none`
   *     on handles (#036).
   *   - ToolbarGhost and window state machine (#034).
   *
   * All canvas coordinates are rem. Pointer events arrive in px; conversion runs
   * through helpers in `windowShellGeometry.ts`. Root font-size is read once on
   * mount via `readRootFontSizePx()` (jsdom-safe fallback).
   */

  import { onMount } from "svelte";

  import type { FreeCanvasStore, WindowState } from "./freeCanvasStore";
  import {
    computeAnchor,
    computeDragTarget,
    computeResizeTarget,
    DEFAULT_ROOT_FONT_SIZE_PX,
    pxToRem,
    readRootFontSizePx,
    type Point,
    type ResizeHandle,
  } from "./windowShellGeometry";

  /** State of the window this shell renders. Reactively reflects store. */
  export let window: WindowState;

  /** Canvas store this shell mutates. */
  export let store: FreeCanvasStore;

  /**
   * Optional minimum size (rem) for resize clamp. Defaults are deliberately
   * small; real callers pass per-widget-kind minimums via the spec
   * (`--ppp-window-min-w-database` etc.) in #032.4.
   */
  export let minSize: { w: number; h: number } = { w: 4, h: 3 };

  /**
   * Whether this window is the activeWindowId on the canvas. Owned by FreeCanvas
   * (#032.4); passed in so the shell can apply the `--active` modifier and the
   * correct z-index without owning that state.
   */
  export let isActive: boolean = false;

  let rootFontSizePx: number = DEFAULT_ROOT_FONT_SIZE_PX;

  // Per-gesture transient state. Captured at pointerdown, cleared at pointerup.
  let isDragging = false;
  let dragOffsetRem: Point = { x: 0, y: 0 };
  let dragRectAtStart = window.rect;

  let isResizing = false;
  let resizeHandle: ResizeHandle | null = null;
  let resizeAnchorRem: Point = { x: 0, y: 0 };
  let resizeRectAtStart = window.rect;

  onMount(() => {
    rootFontSizePx = readRootFontSizePx();
  });

  // The shell renders absolute-positioned in rem; FreeCanvas owns the
  // positioning container, so we only emit class/z-index here.
  $: zIndex = isActive
    ? "var(--ppp-z-window-active)"
    : window.pinned
      ? "var(--ppp-z-window-pinned)"
      : "var(--ppp-z-window-base)";

  function pointerToCanvasRem(e: PointerEvent): Point {
    // `currentTarget` is the shell element; its offsetParent is the canvas.
    // We convert clientX/Y to canvas-local rem via the canvas bounding rect.
    const shellEl = e.currentTarget as HTMLElement | null;
    const canvasEl = shellEl?.parentElement ?? null;
    if (!canvasEl) {
      return { x: pxToRem(e.clientX, rootFontSizePx), y: pxToRem(e.clientY, rootFontSizePx) };
    }
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: pxToRem(e.clientX - rect.left, rootFontSizePx),
      y: pxToRem(e.clientY - rect.top, rootFontSizePx),
    };
  }

  function onShellPointerDown(e: PointerEvent): void {
    // Activation. Store no-ops if already top, so safe to call always.
    store.bringToFront(window.id);
  }

  function onHeaderPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return; // primary button only
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    isDragging = true;
    dragRectAtStart = window.rect;
    const pointer = pointerToCanvasRem(e);
    dragOffsetRem = {
      x: pointer.x - window.rect.x,
      y: pointer.y - window.rect.y,
    };
  }

  function onHeaderPointerMove(e: PointerEvent): void {
    if (!isDragging) return;
    const pointer = pointerToCanvasRem(e);
    const target = computeDragTarget(pointer, dragOffsetRem, dragRectAtStart);
    store.moveWindow(window.id, { x: target.x, y: target.y });
  }

  function onHeaderPointerUp(e: PointerEvent): void {
    if (!isDragging) return;
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    isDragging = false;
  }

  function makeResizeDown(handle: ResizeHandle) {
    return (e: PointerEvent): void => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation(); // don't trigger drag on header underneath
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      isResizing = true;
      resizeHandle = handle;
      resizeRectAtStart = window.rect;
      resizeAnchorRem = computeAnchor(window.rect, handle);
    };
  }

  function onResizePointerMove(e: PointerEvent): void {
    if (!isResizing || !resizeHandle) return;
    const pointer = pointerToCanvasRem(e);
    const target = computeResizeTarget(
      pointer,
      resizeAnchorRem,
      resizeRectAtStart,
      resizeHandle,
      minSize,
    );
    // Drag-from-top-or-left handles also move the top-left corner — those
    // changes must be applied via moveWindow first so the resolver sees a
    // consistent origin, then resize the dimensions.
    const originChanged =
      target.x !== window.rect.x || target.y !== window.rect.y;
    if (originChanged) {
      store.moveWindow(window.id, { x: target.x, y: target.y });
    }
    store.resizeWindow(window.id, { w: target.w, h: target.h });
  }

  function onResizePointerUp(e: PointerEvent): void {
    if (!isResizing) return;
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    isResizing = false;
    resizeHandle = null;
  }

  const HANDLES: ReadonlyArray<ResizeHandle> = [
    "N",
    "S",
    "E",
    "W",
    "NE",
    "NW",
    "SE",
    "SW",
  ];
</script>

<div
  class="ppp-window"
  class:is-active={isActive}
  class:is-pinned={window.pinned}
  data-window-id={window.id}
  data-testid="ppp-window-shell"
  style="
    left: {window.rect.x}rem;
    top: {window.rect.y}rem;
    width: {window.rect.w}rem;
    height: {window.rect.h}rem;
    z-index: {zIndex};
  "
  on:pointerdown={onShellPointerDown}
>
  <div
    class="ppp-window__header ppp-drag-handle"
    data-testid="ppp-window-header"
    on:pointerdown={onHeaderPointerDown}
    on:pointermove={onHeaderPointerMove}
    on:pointerup={onHeaderPointerUp}
    on:pointercancel={onHeaderPointerUp}
  >
    <!--
      `badges` slot (#040): inline-badge buttons (data-source, aggregation,
      etc.) rendered in the window header. Consumer must keep the slot
      content compact and pointer-event-safe (uses .ppp-window__badges
      wrapper which stops pointerdown bubbling so badge clicks don't
      initiate window dragging).
    -->
    <div class="ppp-window__badges" on:pointerdown|stopPropagation>
      <slot name="badges" />
    </div>
  </div>

  <div class="ppp-window__content">
    <slot />
  </div>

  {#each HANDLES as h (h)}
    <div
      class="ppp-resize-handle ppp-resize-handle--{h.toLowerCase()}"
      data-resize-handle={h}
      data-testid="ppp-resize-handle-{h}"
      on:pointerdown={makeResizeDown(h)}
      on:pointermove={onResizePointerMove}
      on:pointerup={onResizePointerUp}
      on:pointercancel={onResizePointerUp}
    ></div>
  {/each}
</div>

<style>
  .ppp-window {
    position: absolute;
    box-sizing: border-box;
    border: var(--ppp-border-subtle);
    border-radius: var(--ppp-radius-xl);
    background: var(--ppp-db-block-bg);
    box-shadow: none;
    will-change: transform;
  }

  .ppp-window.is-active {
    box-shadow: var(--ppp-shadow-float);
  }

  .ppp-window__header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2rem;
    cursor: move;
    touch-action: none;
    user-select: none;
  }

  .ppp-window__header:active {
    cursor: grabbing;
  }

  /* #040 — inline badge buttons rendered into the header via `badges` slot. */
  .ppp-window__badges {
    position: absolute;
    top: 0;
    right: 0.5rem;
    height: 2rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    cursor: default;
    pointer-events: auto;
  }

  .ppp-window__content {
    position: absolute;
    top: 2rem;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
  }

  /* 8 resize handles. Hit area is generous; visual is invisible until hover. */
  .ppp-resize-handle {
    position: absolute;
    touch-action: none;
  }

  .ppp-resize-handle--n,
  .ppp-resize-handle--s {
    left: 0.5rem;
    right: 0.5rem;
    height: 0.5rem;
    cursor: ns-resize;
  }
  .ppp-resize-handle--n {
    top: -0.25rem;
  }
  .ppp-resize-handle--s {
    bottom: -0.25rem;
  }

  .ppp-resize-handle--e,
  .ppp-resize-handle--w {
    top: 0.5rem;
    bottom: 0.5rem;
    width: 0.5rem;
    cursor: ew-resize;
  }
  .ppp-resize-handle--e {
    right: -0.25rem;
  }
  .ppp-resize-handle--w {
    left: -0.25rem;
  }

  .ppp-resize-handle--ne,
  .ppp-resize-handle--nw,
  .ppp-resize-handle--se,
  .ppp-resize-handle--sw {
    width: 0.75rem;
    height: 0.75rem;
  }
  .ppp-resize-handle--ne {
    top: -0.25rem;
    right: -0.25rem;
    cursor: nesw-resize;
  }
  .ppp-resize-handle--nw {
    top: -0.25rem;
    left: -0.25rem;
    cursor: nwse-resize;
  }
  .ppp-resize-handle--se {
    bottom: -0.25rem;
    right: -0.25rem;
    cursor: nwse-resize;
  }
  .ppp-resize-handle--sw {
    bottom: -0.25rem;
    left: -0.25rem;
    cursor: nesw-resize;
  }
</style>
