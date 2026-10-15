<script lang="ts">
  /**
   * DashboardBlockPalette — B7: the ONE way to put a block on the page.
   *
   * A «+» between blocks (`index` = where the new block lands) and one at the
   * end. On a phone the «+» is always visible; with a mouse it appears when
   * the gap is hovered OR when the keyboard focuses it — never only on hover.
   * The menu is `blockCatalog`, with a plain-words description per block.
   */
  import type { WidgetType } from "../types";
  import { insertChoices } from "./blockCatalog";
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { Icon } from "obsidian-svelte";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";

  export let currentWidgets: { type: WidgetType }[];
  /** Position the new block takes in the widget list. */
  export let index: number;
  /** `end` is always visible; `between` reveals on hover/focus (pointer: fine). */
  export let variant: "between" | "end" = "end";

  let open = false;
  let triggerEl: HTMLButtonElement | null = null;

  const dispatch = createEventDispatcher<{ insert: { type: WidgetType; index: number } }>();

  $: choices = insertChoices(currentWidgets);
  $: label = $i18n.t("views.dashboard.insert.here", { defaultValue: "Add a block here" });

  function handleAdd(type: WidgetType) {
    dispatch("insert", { type, index });
    open = false;
  }
</script>

<div class="ppp-block-insert ppp-block-insert--{variant}" class:ppp-block-insert--open={open} data-insert-index={index}>
  <button
    bind:this={triggerEl}
    class="ppp-block-insert__trigger"
    on:click={() => (open = !open)}
    aria-label={label}
    title={label}
    aria-expanded={open}
    aria-haspopup="menu"
  ><Icon name="plus" size="sm" />{#if variant === "end"}<span>{$i18n.t("views.dashboard.insert.add", { defaultValue: "Add block" })}</span>{/if}</button>

  <FloatingPopup {triggerEl} bind:open placement="bottom-start" role="menu" ariaLabel={label}>
    <div class="ppp-block-insert__list">
      {#each choices as choice (choice.type)}
        <button
          class="ppp-block-insert__item"
          data-block-type={choice.type}
          disabled={!choice.allowed}
          on:click={() => handleAdd(choice.type)}
          role="menuitem"
        >
          <span class="ppp-block-insert__icon"><Icon name={choice.icon} /></span>
          <span class="ppp-block-insert__text">
            <span class="ppp-block-insert__label">{$i18n.t(choice.labelKey, { defaultValue: choice.labelDefault })}</span>
            <span class="ppp-block-insert__desc">{$i18n.t(choice.descKey, { defaultValue: choice.descDefault })}</span>
          </span>
        </button>
      {/each}
    </div>
  </FloatingPopup>
</div>

<style>
  .ppp-block-insert { display: flex; justify-content: center; position: relative; }
  .ppp-block-insert--between { height: 0; }
  .ppp-block-insert__list { max-height: 60vh; overflow-y: auto; min-width: 15rem; }

  .ppp-block-insert__trigger {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.25rem;
    min-width: 1.75rem; height: 1.75rem; padding: 0 0.5rem;
    border: 0.0625rem dashed var(--background-modifier-border-hover);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary); color: var(--text-faint);
    font-size: var(--font-ui-small); cursor: pointer;
    transition: opacity 120ms ease, border-color 120ms ease, color 120ms ease;
  }
  .ppp-block-insert--between .ppp-block-insert__trigger { position: relative; transform: translateY(-50%); }

  /* Mouse: the in-between «+» shows on hover of the gap or on keyboard focus.
     `opacity`, not `visibility`: a hidden control could never receive focus. */
  @media (pointer: fine) {
    .ppp-block-insert--between .ppp-block-insert__trigger { opacity: 0; }
    .ppp-block-insert--between:hover .ppp-block-insert__trigger,
    .ppp-block-insert--open .ppp-block-insert__trigger,
    .ppp-block-insert__trigger:focus-visible { opacity: 1; }
  }

  .ppp-block-insert__trigger:hover,
  .ppp-block-insert__trigger[aria-expanded="true"] {
    border-color: var(--interactive-accent); color: var(--interactive-accent);
  }
  .ppp-block-insert__trigger:focus-visible { outline: 0.125rem solid var(--interactive-accent); outline-offset: 0.0625rem; }

  .ppp-block-insert__item {
    display: flex; align-items: flex-start; gap: 0.5rem; width: 100%;
    padding: 0.375rem 0.5rem; color: var(--text-normal);
    background: transparent; border: none; border-radius: var(--radius-s, 0.25rem);
    cursor: pointer; text-align: left; height: auto;
  }
  .ppp-block-insert__item:hover:not(:disabled) { background: var(--background-modifier-hover); }
  .ppp-block-insert__item:disabled { opacity: 0.4; cursor: not-allowed; }
  .ppp-block-insert__icon { flex-shrink: 0; color: var(--text-muted); }
  .ppp-block-insert__text { display: flex; flex-direction: column; gap: 0.125rem; }
  .ppp-block-insert__label { font-size: var(--font-ui-small); }
  .ppp-block-insert__desc { font-size: var(--font-ui-smaller); color: var(--text-muted); }
</style>
