<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";

  const dispatch = createEventDispatcher<{
    select: { id: string; label: string };
  }>();

  // In runtime, this would pull available views from Obsidian workspace.
  // For now, emit placeholder entries the user can configure.
  const presetViews = [
    { id: "table", labelKey: "views.database.viewport.table" },
    { id: "board", labelKey: "views.database.viewport.board" },
    { id: "calendar", labelKey: "views.database.viewport.calendar" },
    { id: "gallery", labelKey: "views.database.viewport.gallery" },
  ];
</script>

<div class="ppp-viewport-selector">
  <div class="ppp-viewport-selector-title">{$i18n.t("views.database.viewport.embed")}</div>
  <ul class="ppp-viewport-selector-list" role="listbox">
    {#each presetViews as view}
      <li>
        <button
          class="ppp-viewport-selector-item"
          role="option"
          aria-selected="false"
          on:click={() => dispatch("select", { id: view.id, label: $i18n.t(view.labelKey) })}
        >
          {$i18n.t(view.labelKey)}
        </button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .ppp-viewport-selector {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 10;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    box-shadow: var(--shadow-s);
    padding: 0.25rem;
  }

  .ppp-viewport-selector-title {
    padding: 0.375rem 0.5rem;
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .ppp-viewport-selector-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .ppp-viewport-selector-item {
    display: block;
    width: 100%;
    padding: 0.375rem 0.5rem;
    border: none;
    background: transparent;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    cursor: pointer;
    text-align: left;
    border-radius: var(--radius-s, 0.25rem);
  }

  .ppp-viewport-selector-item:hover {
    background: var(--background-modifier-hover);
  }
</style>
