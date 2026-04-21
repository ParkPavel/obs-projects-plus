<script lang="ts">
  import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { GridCell } from "..";
  import type { GridColDef } from "../../dataGrid";
  import { app } from "src/lib/stores/obsidian";
  import { getContext } from "svelte";

  export let value: Optional<DataValue>;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  const sourcePath = getContext<string>("sourcePath") ?? "";

  // Relation values are wiki-link strings: "[[Page1]], [[Page2]]" or an array
  $: links = parseLinks(value);

  function parseLinks(val: Optional<DataValue>): string[] {
    if (val == null) return [];
    if (Array.isArray(val)) return val.map(String);
    const str = String(val);
    if (!str) return [];
    // Extract [[...]] wiki-links
    const matches = str.match(/\[\[([^\]]+)\]\]/g);
    if (matches) {
      return matches.map((m) => m.slice(2, -2));
    }
    // Fallback: comma-separated
    return str.split(",").map((s) => s.trim()).filter(Boolean);
  }

  function openLink(link: string, event: MouseEvent) {
    event.stopPropagation();
    const newLeaf = event.ctrlKey || event.metaKey;
    $app.workspace.openLinkText(link, sourcePath, newLeaf);
  }
</script>

<GridCell {selected} {rowindex} {colindex} {column} on:mousedown on:navigate>
  <span slot="read" class="ppp-relation-cell">
    {#each links as link}
      <button
        class="ppp-relation-tag clickable-icon"
        on:click={(e) => openLink(link, e)}
        title="Open {link}"
      >{link}</button>
    {/each}
    {#if links.length === 0}
      <span class="ppp-relation-empty">—</span>
    {/if}
  </span>
</GridCell>

<style>
  .ppp-relation-cell {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
    padding: 0 0.25rem;
  }

  .ppp-relation-tag {
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

  .ppp-relation-tag:hover {
    background: var(--background-modifier-hover);
    text-decoration: underline;
  }

  .ppp-relation-empty {
    color: var(--text-faint);
  }
</style>
