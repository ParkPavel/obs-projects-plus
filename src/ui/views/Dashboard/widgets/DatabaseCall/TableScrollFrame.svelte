<script lang="ts">
  /**
   * B3 (M05): the table's ONE scroll owner for both axes inside the block —
   * bounded height, overscroll contained so a gesture never chains to the page
   * mid-scroll, header row and first column pinned, and a soft shadow on each
   * edge that hides more columns or rows (`data-more-*` from trackEdges).
   */
  import { trackViewport, type TableViewport } from "./tableWindow";
  import { trackEdges } from "./tableTouch";

  export let scroller: HTMLDivElement | null = null;
  export let onViewport: (viewport: TableViewport) => void;
  /** Width of the pinned first column, so the left cue starts after it. */
  export let firstColRem = 0;
  /** i3-table — the first column stays in place while scrolling sideways (off by default). */
  export let frozen = false;
</script>

<div class="ppp-t2-frame" style:--ppp-t2-first-col={`${firstColRem}rem`}>
  <div class="ppp-t2-scroll" class:is-frozen={frozen} bind:this={scroller} use:trackViewport={onViewport} use:trackEdges role="rowgroup">
    <slot />
  </div>
  <span class="ppp-t2-edge ppp-t2-edge--left" aria-hidden="true" />
  <span class="ppp-t2-edge ppp-t2-edge--right" aria-hidden="true" />
  <span class="ppp-t2-edge ppp-t2-edge--top" aria-hidden="true" />
  <span class="ppp-t2-edge ppp-t2-edge--bottom" aria-hidden="true" />
</div>

<style>
  .ppp-t2-frame {
    position: relative;
    display: flex;
    flex: 1;
    min-height: 0;
  }

  /* i3-table: a table never fills the screen — there is always dashboard
     above or below it to grab — and a vertical scroll that reaches the
     table's end carries on into the dashboard instead of stopping there
     (was `overscroll-behavior: contain` on both axes and 70vh). Sideways it
     stays contained, so a swipe across columns never turns the page. */
  .ppp-t2-scroll {
    flex: 1;
    min-width: 0;
    max-height: var(--ppp-t2-scroll-max, 60vh);
    overflow: auto;
    overscroll-behavior-x: contain;
    overscroll-behavior-y: auto;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x pan-y;
  }

  .ppp-t2-scroll.is-frozen :global(.ppp-t2-row > :first-child),
  .ppp-t2-scroll.is-frozen :global(.ppp-t2-header > :first-child),
  .ppp-t2-scroll.is-frozen :global(.ppp-t2-footer > :first-child) {
    position: sticky;
    left: 0;
    z-index: var(--ppp-z-raised);
    background: var(--background-primary);
    box-shadow: inset -0.0625em 0 0 var(--background-modifier-border);
  }

  .ppp-t2-scroll.is-frozen :global(.ppp-t2-header > :first-child),
  .ppp-t2-scroll.is-frozen :global(.ppp-t2-footer > :first-child) {
    background: var(--background-secondary);
  }

  .ppp-t2-scroll :global(.ppp-t2-cell:focus-visible) {
    outline: 0.125em solid var(--interactive-accent);
    outline-offset: -0.125em;
  }

  .ppp-t2-edge {
    position: absolute;
    pointer-events: none;
    opacity: 0;
    transition: opacity 120ms ease;
    z-index: var(--ppp-z-dropdown);
    --ppp-t2-shade: var(--background-modifier-box-shadow);
  }

  .ppp-t2-edge--left,
  .ppp-t2-edge--right {
    top: 0;
    bottom: 0;
    width: 0.75em;
  }

  .ppp-t2-edge--top,
  .ppp-t2-edge--bottom {
    left: 0;
    right: 0;
    height: 0.75em;
  }

  .ppp-t2-edge--left { left: var(--ppp-t2-first-col); background: linear-gradient(to right, var(--ppp-t2-shade), transparent); }
  .ppp-t2-edge--right { right: 0; background: linear-gradient(to left, var(--ppp-t2-shade), transparent); }
  .ppp-t2-edge--top { top: var(--ppp-t2-row-height); background: linear-gradient(to bottom, var(--ppp-t2-shade), transparent); }
  .ppp-t2-edge--bottom { bottom: 0; background: linear-gradient(to top, var(--ppp-t2-shade), transparent); }

  :global(.ppp-t2-frame[data-more-left]) > .ppp-t2-edge--left,
  :global(.ppp-t2-frame[data-more-right]) > .ppp-t2-edge--right,
  :global(.ppp-t2-frame[data-more-top]) > .ppp-t2-edge--top,
  :global(.ppp-t2-frame[data-more-bottom]) > .ppp-t2-edge--bottom {
    opacity: 1;
  }
</style>
