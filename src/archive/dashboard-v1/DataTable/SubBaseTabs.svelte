<script lang="ts">
  /**
   * R2.2 — Sub-base tab strip
   *
   * Pure presentational component: renders a horizontal scrollable
   * tab list with one tab per `SubBaseDefinition` plus a "+ Add"
   * affordance. Emits `select` / `add` / `rename` / `remove` events;
   * persistence and sub-base creation policy live in the host widget.
   *
   * No Obsidian dependencies — safe to mount in jsdom.
   */
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { SubBaseDefinition } from "src/lib/database/subBase";

  export let subBases: readonly SubBaseDefinition[] = [];
  export let activeId: string | null = null;
  export let readonly = false;

  const dispatch = createEventDispatcher<{
    select: { id: string };
    add: void;
    rename: { id: string; name: string };
    remove: { id: string };
  }>();

  let editingId: string | null = null;
  let editingDraft = "";

  $: t = $i18n.t.bind($i18n);

  function startRename(sb: SubBaseDefinition): void {
    if (readonly) return;
    editingId = sb.id;
    editingDraft = sb.name;
  }

  function commitRename(sb: SubBaseDefinition): void {
    const name = editingDraft.trim();
    if (name.length > 0 && name !== sb.name) {
      dispatch("rename", { id: sb.id, name });
    }
    editingId = null;
    editingDraft = "";
  }

  function cancelRename(): void {
    editingId = null;
    editingDraft = "";
  }

  function handleKeydown(event: KeyboardEvent, sb: SubBaseDefinition): void {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename(sb);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  }
</script>

<div
  class="ppp-subbase-tabs"
  role="tablist"
  aria-label={t("views.dashboard.sub-bases.tablist", { defaultValue: "Sub-bases" })}
>
  {#each subBases as sb (sb.id)}
    <div class="ppp-subbase-tab" class:is-active={sb.id === activeId}>
      {#if editingId === sb.id}
        <input
          class="ppp-subbase-tab-input"
          value={editingDraft}
          on:input={(e) => (editingDraft = e.currentTarget.value)}
          on:keydown={(e) => handleKeydown(e, sb)}
          on:blur={() => commitRename(sb)}
        />
      {:else}
        <button
          type="button"
          class="ppp-subbase-tab-button"
          role="tab"
          aria-selected={sb.id === activeId}
          on:click={() => dispatch("select", { id: sb.id })}
          on:dblclick={() => startRename(sb)}
          title={sb.name}
        >{sb.name}</button>
        {#if !readonly}
          <button
            type="button"
            class="ppp-subbase-tab-remove"
            on:click={() => dispatch("remove", { id: sb.id })}
            title={t("views.dashboard.sub-bases.remove", { defaultValue: "Remove sub-base" })}
            aria-label={t("views.dashboard.sub-bases.remove", { defaultValue: "Remove sub-base" })}
          >×</button>
        {/if}
      {/if}
    </div>
  {/each}
  {#if !readonly}
    <button
      type="button"
      class="ppp-subbase-tab-add"
      on:click={() => dispatch("add")}
      title={t("views.dashboard.sub-bases.add", { defaultValue: "Add sub-base" })}
      aria-label={t("views.dashboard.sub-bases.add", { defaultValue: "Add sub-base" })}
    >+</button>
  {/if}
</div>

<style>
  .ppp-subbase-tabs {
    display: flex;
    align-items: stretch;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem 0;
    overflow-x: auto;
    border-bottom: 1px solid var(--background-modifier-border);
  }
  .ppp-subbase-tab {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    border-radius: 0.25rem 0.25rem 0 0;
    padding: 0 0.25rem;
    transition: background 0.15s ease;
  }
  .ppp-subbase-tab:hover {
    background: var(--background-modifier-hover);
  }
  .ppp-subbase-tab.is-active {
    background: var(--background-secondary);
    box-shadow: inset 0 -0.125rem 0 var(--interactive-accent);
  }
  .ppp-subbase-tab-button {
    background: transparent;
    border: none;
    padding: 0.25rem 0.5rem;
    color: var(--text-normal);
    cursor: pointer;
    font: inherit;
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ppp-subbase-tab-button[aria-selected="true"] {
    color: var(--interactive-accent);
    font-weight: 600;
  }
  .ppp-subbase-tab-remove,
  .ppp-subbase-tab-add {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font: inherit;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    line-height: 1;
  }
  .ppp-subbase-tab-remove:hover,
  .ppp-subbase-tab-add:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  .ppp-subbase-tab-input {
    background: var(--background-primary);
    color: var(--text-normal);
    border: 1px solid var(--interactive-accent);
    border-radius: 0.25rem;
    padding: 0.125rem 0.375rem;
    font: inherit;
    width: 8rem;
  }
</style>
