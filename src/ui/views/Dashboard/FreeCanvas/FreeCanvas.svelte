<script lang="ts">
  /**
   * FreeCanvas.svelte — infinite virtual canvas for free-positioned widgets.
   *
   * Spec: .ai_internal/New-specification/FREE_CANVAS_SPEC.md §3, §4.
   * Ticket: #032.2 (Phase 3 sub-PR 2 — skeleton only).
   *
   * Skeleton scope:
   *   - Static render of `windows` in rem-coordinates.
   *   - Single positioned container with `overflow: hidden` (no scroll yet:
   *     pan + zoom land in #032.5; for now an infinite virtual plane is
   *     simulated by absolute positioning inside a clipped viewport).
   *   - Per-window slot ("window") with the window state exposed as a slot
   *     prop — WindowShell will mount here in #032.3.
   *
   * Out of scope (deferred):
   *   - Drag / resize handlers (#032.3 WindowShell).
   *   - DashboardCanvas integration / persistence (#032.4).
   *   - Pan + zoom viewport (#032.5).
   *   - Snap-to-grid (caller will pre-snap before calling store actions).
   */

  import type { WindowState } from "./freeCanvasStore";

  /** Windows to render, in rem-coordinates. */
  export let windows: ReadonlyArray<WindowState>;

  /**
   * Reserved for #032.3 — invoked when WindowShell finishes a drag/resize.
   * Skeleton renders are read-only; the callback is declared so the public
   * prop surface is stable for downstream consumers.
   */
  export let onLayoutChange: (next: ReadonlyArray<WindowState>) => void =
    () => {
      /* no-op until #032.3 wires WindowShell events */
    };

  // Suppress "unused prop" until WindowShell lands; keeps the public
  // surface explicit while the implementation is staged.
  $: void onLayoutChange;
</script>

<div class="ppp-free-canvas" data-testid="ppp-free-canvas">
  {#each windows as window (window.id)}
    <div
      class="ppp-free-canvas__window"
      class:is-pinned={window.pinned}
      data-window-id={window.id}
      style="
        left: {window.rect.x}rem;
        top: {window.rect.y}rem;
        width: {window.rect.w}rem;
        height: {window.rect.h}rem;
        z-index: {window.z};
      "
    >
      <slot name="window" {window} />
    </div>
  {/each}
</div>

<style>
  .ppp-free-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    /* Infinite virtual space: children are absolutely positioned in rem.
       Pan + zoom will replace this static container in #032.5. */
  }

  .ppp-free-canvas__window {
    position: absolute;
    box-sizing: border-box;
  }
</style>
