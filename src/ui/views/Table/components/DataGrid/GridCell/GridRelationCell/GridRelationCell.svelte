<script lang="ts">
  import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { GridCell } from "..";
  import type { GridColDef } from "../../dataGrid";
  import RelationListView from "src/ui/views/YamlVisualizer/RelationListView.svelte";

  export let value: Optional<DataValue>;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;
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

  $: links = parseLinks(value);
  $: items = links.map<string | { label: string; link: string }>((link) => {
    const label = resolvedLabels?.get(link);
    return label ? { label, link } : link;
  });

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

<GridCell {selected} {rowindex} {colindex} {column} on:mousedown on:navigate>
  <span slot="read" class="ppp-relation-cell">
    <RelationListView {items} maxVisible={3} />
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
</style>
