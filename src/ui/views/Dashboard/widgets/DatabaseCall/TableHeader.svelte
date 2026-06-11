<script lang="ts">
  /**
   * TableHeader — F2.1 (TABLE_V2_CANON §1/§2). Sticky header row: type icon +
   * name (regular weight, muted — Notion DNA) + sort indicator. Column menu
   * arrives in F2.4; the tooltip already carries the frontmatter key (#060
   * field transparency).
   */
  import { Icon } from "obsidian-svelte";
  import { getFieldIcon } from "src/ui/components/Navigation/SettingsMenu/tabs/filterHelpers";
  import type { TableColumn } from "./tableCanon";
  import type { DataTableSortCriteria } from "../../types";

  export let columns: TableColumn[];
  export let sortCriteria: DataTableSortCriteria[] = [];

  function sortOf(name: string): "asc" | "desc" | null {
    return sortCriteria.find((c) => c.field === name)?.order ?? null;
  }
</script>

<div class="ppp-t2-header" role="row">
  {#each columns as col (col.field.name)}
    {@const sort = sortOf(col.field.name)}
    <div
      class="ppp-t2-header-cell"
      class:ppp-t2-header-cell--primary={col.isPrimary}
      role="columnheader"
      aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : "none"}
      title={`${col.field.name} · ${col.field.type}`}
    >
      <span class="ppp-t2-header-icon"><Icon name={getFieldIcon(col.field.type)} size="sm" /></span>
      <span class="ppp-t2-header-name">{col.field.name}</span>
      {#if sort}
        <span class="ppp-t2-header-sort"><Icon name={sort === "asc" ? "arrow-up" : "arrow-down"} size="sm" /></span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .ppp-t2-header {
    display: grid;
    grid-template-columns: var(--ppp-dt-columns);
    position: sticky;
    top: 0;
    z-index: var(--ppp-z-float, 10);
    background: var(--background-secondary);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
  }

  .ppp-t2-header-cell {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    height: 2rem;
    padding: 0 0.5rem;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    user-select: none;
  }

  .ppp-t2-header-cell:hover {
    background: var(--ppp-db-surface-hover, var(--background-modifier-hover));
  }

  .ppp-t2-header-icon {
    flex-shrink: 0;
    display: inline-flex;
    color: var(--text-faint);
  }

  .ppp-t2-header-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-t2-header-sort {
    flex-shrink: 0;
    display: inline-flex;
    color: var(--text-accent);
  }
</style>
