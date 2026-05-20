<script lang="ts">
  export let index: number;
  export let header: boolean = false;
  export let footer: boolean = false;
  /** S8 — row is checked for bulk actions; provides accent-tint background. */
  export let selected: boolean = false;
  /**
   * #044.3a — row matches the canvas selection emitted by another widget.
   * Adds the `ppp-data-table-row--highlighted` class (spec §5.2). Default
   * `false` so standalone Table rows render unchanged.
   */
  export let highlighted: boolean = false;
  /**
   * #044.3a — row does NOT match an active external selection. Adds the
   * `ppp-data-table-row--dimmed` class so the row fades out while preserving
   * table geometry (spec §5.2). Default `false`.
   */
  export let dimmed: boolean = false;
</script>

<div
  role="row"
  aria-rowindex={index}
  aria-selected={selected || undefined}
  class:header
  class:footer
  class:selected
  class:ppp-data-table-row--highlighted={highlighted}
  class:ppp-data-table-row--dimmed={dimmed}
>
  <slot />
</div>

<style>
  div {
    display: flex;
    /*
     * R-phase Bug #3 — body-row hover highlight. Each `<GridCell>` reads
     * `--ppp-row-hover-bg` from its parent so the entire row tints in
     * sync without per-cell `mouseenter` bookkeeping. Headers and footers
     * opt out so sticky chrome stays calm.
     */
    --ppp-row-hover-bg: transparent;
    transition: background-color 120ms ease;
  }

  div:hover:not(.header):not(.footer) {
    --ppp-row-hover-bg: var(--background-modifier-hover);
  }

  /* R5-020: selected row — accent-tinted background so checked rows stand out */
  div.selected:not(.header):not(.footer) {
    --ppp-row-hover-bg: color-mix(in srgb, var(--interactive-accent) 10%, transparent);
  }

  div.selected:hover:not(.header):not(.footer) {
    --ppp-row-hover-bg: color-mix(in srgb, var(--interactive-accent) 16%, transparent);
  }

  /*
   * #044.3a cross-widget receiver decoration. The DataTableWidget sets these
   * classes when another widget (e.g. a Chart segment) drives a selection on
   * the same canvas. Hidden rows are NOT removed — geometry is preserved so
   * users see the cohort in situ (spec §5.2).
   */
  div.ppp-data-table-row--highlighted:not(.header):not(.footer) {
    --ppp-row-hover-bg: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
    box-shadow: inset 0.1875rem 0 0 0 var(--interactive-accent);
  }

  div.ppp-data-table-row--dimmed:not(.header):not(.footer) {
    opacity: 0.35;
  }

  div.ppp-data-table-row--dimmed:not(.header):not(.footer):hover {
    /* Keep dimmed rows interactive — hover lifts the veil so users can still
       inspect / edit non-matching rows without clearing the selection. */
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    div { transition: none; }
  }

  .header {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .footer {
    position: sticky;
    bottom: 0;
    z-index: 10;

    background-color: var(--background-primary-alt);
    border-bottom: 1px solid var(--background-modifier-border);
  }
</style>
