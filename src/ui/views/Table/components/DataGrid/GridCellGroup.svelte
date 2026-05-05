<script lang="ts">
  export let index: number;
  export let header: boolean = false;
  export let footer: boolean = false;
</script>

<div role="row" aria-rowindex={index} class:header class:footer>
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
