<script lang="ts">
  /**
   * w4-p10a (N15) — "Blocks · N ▾": the dashboard's table of contents, one
   * button instead of the row of titles. It opens the blocks in page order —
   * a sheet on a phone, a list on a computer (the shared popup) — with the
   * current block marked and a collapsed one shown as such; a pick moves the
   * page to the block (a collapsed one stays collapsed).
   */
  import { i18n } from "src/lib/stores/i18n";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import PopoverList, { type PopoverItem } from "src/ui/components/FloatingPopup/PopoverList.svelte";
  import type { BlockOutline } from "./blockOutline";

  export let outline: BlockOutline;

  let open = false;
  let triggerEl: HTMLButtonElement | null = null;
  let currentId: string | null = null;

  function toggle(): void {
    if (!open) currentId = outline.current();
    open = !open;
  }

  $: label = $i18n.t("views.dashboard.canvas.jump-bar", { defaultValue: "Blocks on this page" });
  $: items = outline.items.map((item, index): PopoverItem => ({
    label: `${item.title || index + 1}${item.collapsed ? ` · ${$i18n.t("views.dashboard.canvas.collapsed-block", { defaultValue: "collapsed" })}` : ""}`,
    selected: item.id === currentId,
    handler: () => outline.jump(item.id),
  }));
</script>

<button
  bind:this={triggerEl}
  type="button"
  class="ppp-block-outline clickable-icon"
  aria-haspopup="menu"
  aria-expanded={open}
  aria-label={label}
  title={label}
  on:click={toggle}
>
  <span class="ppp-block-outline__label">{$i18n.t("views.dashboard.canvas.blocks", { defaultValue: "Blocks" })}</span>
  <span class="ppp-block-outline__count">{outline.items.length}</span>
  <span aria-hidden="true">▾</span>
</button>
<FloatingPopup {triggerEl} bind:open placement="bottom-start" role="menu" ariaLabel={label} closeOnInnerClick>
  <PopoverList {items} />
</FloatingPopup>

<style>
  .ppp-block-outline {
    display: inline-flex;
    align-items: center;
    gap: 0.375em;
    min-height: var(--ppp-touch-target-min);
    padding: 0 0.5em;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    white-space: nowrap;
  }
  .ppp-block-outline__count {
    min-width: 1.25em;
    padding: 0 0.3em;
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
</style>
