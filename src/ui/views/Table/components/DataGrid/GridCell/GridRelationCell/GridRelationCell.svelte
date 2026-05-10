<script lang="ts">
  import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { GridCell } from "..";
  import type { GridColDef } from "../../dataGrid";
  import RelationListView from "src/ui/views/YamlVisualizer/RelationListView.svelte";
  import RelationPopover from "src/ui/components/RelationPicker/RelationPicker.svelte";
  import { getContext } from "svelte";
  import type { Readable } from "svelte/store";

  export let value: Optional<DataValue>;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;
  /** When provided, cell becomes editable and opens inline popover on click. */
  export let onChange: ((value: string[]) => void) | undefined = undefined;
  /**
   * Optional resolved label per link body. When present (Stage A enrichment
   * surfaced `__resolved__<field>` and the consumer extracted the
   * `displayField` value into a string map), labels override the raw link
   * body for visible text. Click target stays the link body so navigation
   * uses the canonical wiki-link path.
   *
   * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.5b.
   */
  export let resolvedLabels: ReadonlyMap<string, string> | undefined = undefined;

  // NPLAN-S4.1: relation options provided via Svelte context from DataTableWidget
  const relationOptionsStore = getContext<Readable<Map<string, string[]>> | undefined>("ppp-relationOptions");

  $: options = ($relationOptionsStore ?? new Map<string, string[]>()).get(column.field) ?? [];

  $: links = parseLinks(value);
  $: items = links.map<string | { label: string; link: string }>((link) => {
    const label = resolvedLabels?.get(link);
    return label ? { label, link } : link;
  });

  let popoverOpen = false;

  function handleCellClick(e: MouseEvent) {
    if (onChange && e.button === 0) {
      e.stopPropagation();
      popoverOpen = !popoverOpen;
    }
  }

  function handleAdd(name: string) {
    if (!onChange) return;
    const bare = name.replace(/^\[\[(.+?)(?:\|.+?)?\]\]$/, "$1");
    if (!links.includes(bare)) {
      onChange([...links, bare].map((l) => `[[${l}]]`));
    }
  }

  function handleRemove(name: string) {
    if (!onChange) return;
    onChange(links.filter((l) => l !== name).map((l) => `[[${l}]]`));
  }

  function parseLinks(val: Optional<DataValue>): string[] {
    if (val == null) return [];
    if (Array.isArray(val)) return val.map(String);
    const str = String(val);
    if (!str) return [];
    const matches = str.match(/\[\[([^\]]+)\]\]/g);
    if (matches) {
      return matches.map((m) => m.slice(2, -2));
    }
    return str.split(",").map((s) => s.trim()).filter(Boolean);
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="ppp-relation-cell-wrap">
  <GridCell {selected} {rowindex} {colindex} {column} on:mousedown on:navigate>
    <span slot="read" class="ppp-relation-cell" on:click={handleCellClick}>
      <RelationListView {items} maxVisible={3} />
      {#if onChange && links.length === 0}
        <span class="ppp-relation-placeholder">Select…</span>
      {/if}
    </span>
  </GridCell>

  {#if popoverOpen && onChange}
    <RelationPopover
      {options}
      selected={links}
      onAdd={handleAdd}
      onRemove={handleRemove}
      onClose={() => (popoverOpen = false)}
    />
  {/if}
</div>

<style>
  .ppp-relation-cell-wrap {
    position: relative;
    display: contents;
  }

  .ppp-relation-cell {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
    padding: 0 0.25rem;
    cursor: pointer;
    width: 100%;
    min-height: 1.5rem;
  }

  .ppp-relation-placeholder {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    font-style: italic;
  }
</style>
