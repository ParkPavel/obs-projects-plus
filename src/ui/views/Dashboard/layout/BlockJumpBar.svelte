<script lang="ts">
  /**
   * BlockJumpBar — i3-dash: the narrow dashboard's table of contents.
   *
   * On a phone the page is one long stack, and a block below a tall table was
   * reachable only by scrolling past it. This row of block titles stays at the
   * top of the page (sticky) and moves the page to the block that is tapped.
   * It only reports the choice; the grid does the jump (blockJump.ts).
   * Scrolls sideways when the titles do not fit, never wraps into a second
   * row that would eat the screen.
   */
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { JumpItem } from "./blockJump";

  export let items: readonly JumpItem[];

  const dispatch = createEventDispatcher<{ jump: string }>();
</script>

<nav class="ppp-block-jump" aria-label={$i18n.t("views.dashboard.canvas.jump-bar", { defaultValue: "Blocks on this page" })}>
  {#each items as item, index (item.id)}
    <button
      type="button"
      class="ppp-block-jump__item"
      class:ppp-block-jump__item--collapsed={item.collapsed}
      data-jump-id={item.id}
      on:click={() => dispatch("jump", item.id)}
    >{item.title || index + 1}</button>
  {/each}
</nav>

<style>
  /* i3-dash: sized in em — the bar sits inside the dashboard container. Only
     the sideways axis is contained: a vertical swipe on the bar still scrolls
     the page. */
  .ppp-block-jump {
    position: sticky;
    top: 0;
    z-index: var(--ppp-z-sticky, 20);
    display: flex;
    gap: 0.375em;
    padding: 0.375em 0;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    background: var(--background-primary);
  }

  .ppp-block-jump__item {
    flex-shrink: 0;
    max-width: 12em;
    min-height: 1.75em;
    padding: 0.125em 0.625em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    background: var(--background-secondary);
    border: var(--ppp-border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    box-shadow: none;
    cursor: pointer;
  }

  /* A collapsed block is still a place to go; it reads quieter. */
  .ppp-block-jump__item--collapsed {
    font-style: italic;
  }

  .ppp-block-jump__item:focus-visible {
    outline: 0.125em solid var(--interactive-accent);
    outline-offset: 0.0625em;
  }

  @media (hover: hover) and (pointer: fine) {
    .ppp-block-jump__item:hover {
      color: var(--text-normal);
      border-color: var(--interactive-accent);
    }
  }

  @media (pointer: coarse) {
    .ppp-block-jump__item {
      min-height: var(--ppp-touch-target-min);
    }
  }
</style>
