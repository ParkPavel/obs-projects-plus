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

  /**
   * #044.5 — invoked when the user clicks the empty canvas background
   * (i.e. NOT on a child window). DashboardCanvas wires this to
   * `selectionStore.clearSelection()` per spec §7. `on:click|self` ensures
   * descendants do not trigger; widget clicks bubble normally to their own
   * handlers without reaching here.
   */
  export let onBackgroundClick: () => void = () => {
    /* no-op until DashboardCanvas wires the selection-clear behaviour */
  };
</script>

<div
  class="ppp-free-canvas"
  data-testid="ppp-free-canvas"
  on:click|self={onBackgroundClick}
  role="presentation"
>
  {#each windows as window (window.id)}
    <slot name="window" {window} />
  {/each}
</div>

<style>
  .ppp-free-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    /* Infinite virtual space: WindowShell children are absolutely positioned
       in rem against this container. Pan + zoom will replace this static
       container in #032.5. */
  }
</style>
