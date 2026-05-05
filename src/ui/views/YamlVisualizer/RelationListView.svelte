<script lang="ts">
  /**
   * RelationListView — adaptive overflow renderer for relation values.
   *
   * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.5b / §A.7 (M2 surface 3).
   * @since 3.4.2 (Stage A)
   *
   * Shared by `GridRelationCell.svelte` (Table view) and the YAML
   * Visualizer's `RelationFieldRow.svelte`. Renders a flex row of
   * pill-shaped buttons; when items overflow the container, the tail is
   * collapsed into a "+K more" pill that opens a popover with the full list.
   *
   * Stage A simplification: a static `maxVisible` count drives overflow.
   * The blueprint's full ResizeObserver-based `'auto'` mode is registered
   * as STB-VISUALIZER-BULK-EDIT polish (Stage B) — current renderer keeps
   * the algorithm consumer-side stable so a future drop-in upgrade is
   * non-breaking.
   */
  import { app } from "src/lib/stores/obsidian";
  import { getContext, createEventDispatcher } from "svelte";

  /** Items: either string link bodies, or {label, link} pairs when a
   * displayField is in play (caller may pass either shape). */
  export let items: Array<string | { label: string; link: string }> = [];
  export let maxVisible: number = 3;
  /** When true, all items render inline (no overflow). */
  export let expanded: boolean = false;

  const sourcePath = getContext<string>("sourcePath") ?? "";
  const dispatch = createEventDispatcher<{ open: { link: string } }>();

  $: normalized = items.map((it) =>
    typeof it === "string" ? { label: it, link: it } : it
  );
  $: visible = expanded ? normalized : normalized.slice(0, maxVisible);
  $: overflowCount = expanded ? 0 : Math.max(0, normalized.length - maxVisible);

  let popoverOpen = false;

  function openLink(link: string, event: MouseEvent | KeyboardEvent) {
    event.stopPropagation();
    const newLeaf =
      "ctrlKey" in event && (event.ctrlKey || event.metaKey);
    $app.workspace.openLinkText(link, sourcePath, newLeaf);
    dispatch("open", { link });
  }

  function togglePopover(event: MouseEvent) {
    event.stopPropagation();
    popoverOpen = !popoverOpen;
  }

  function dismissOnEscape(event: KeyboardEvent) {
    if (event.key === "Escape") popoverOpen = false;
  }
</script>

<svelte:window on:keydown={dismissOnEscape} />

<span class="ppp-relation-list">
  {#each visible as item}
    <button
      class="ppp-relation-pill clickable-icon"
      on:click={(e) => openLink(item.link, e)}
      on:keydown={(e) => {
        if (e.key === "Enter" || e.key === " ") openLink(item.link, e);
      }}
      title={item.link}
    >{item.label}</button>
  {/each}
  {#if overflowCount > 0}
    <button
      class="ppp-relation-more clickable-icon"
      on:click={togglePopover}
      aria-haspopup="true"
      aria-expanded={popoverOpen}
    >+{overflowCount} more</button>
    {#if popoverOpen}
      <span class="ppp-relation-popover" role="dialog">
        {#each normalized as item}
          <button
            class="ppp-relation-pill clickable-icon"
            on:click={(e) => openLink(item.link, e)}
          >{item.label}</button>
        {/each}
      </span>
    {/if}
  {/if}
  {#if normalized.length === 0}
    <span class="ppp-relation-empty">—</span>
  {/if}
</span>

<style>
  .ppp-relation-list {
    display: inline-flex;
    flex-wrap: nowrap;
    gap: 0.25rem;
    align-items: center;
    position: relative;
  }

  .ppp-relation-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.0625rem 0.375rem;
    font-size: var(--font-ui-smaller);
    color: var(--text-accent);
    background: var(--background-secondary);
    border: none;
    border-radius: var(--radius-s, 0.25rem);
    white-space: nowrap;
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
  }

  .ppp-relation-pill:hover {
    background: var(--background-modifier-hover);
    text-decoration: underline;
  }

  .ppp-relation-more {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    background: transparent;
    border: 1px dashed var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    padding: 0.0625rem 0.375rem;
    cursor: pointer;
  }

  .ppp-relation-popover {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 50;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.375rem;
    margin-top: 0.25rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 0.375rem);
    box-shadow: var(--shadow-s);
    max-width: 24rem;
  }

  .ppp-relation-empty {
    color: var(--text-faint);
  }
</style>
