<script lang="ts">
  import { GridCell } from "../GridCell";
  import { dndzone } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import type { GridColDef } from "../dataGrid";
  import Resizer from "../GridCell/Resizer.svelte";
  import GridColumnHeader from "./GridColumnHeader.svelte";

  type GridColDefWithId = GridColDef & { readonly id: string };

  export let columns: GridColDefWithId[];
  export let onResize: (name: string, width: number) => void;
  export let onFinalizeResize: (name: string, width: number) => void;
  export let onColumnMenu: (column: GridColDef, event: MouseEvent) => void;
  export let onColumnOrder: (columns: GridColDefWithId[]) => void;
  /** When provided, shows an inline "+" button at the end of headers. */
  export let onAddColumn: (() => void) | undefined = undefined;
  /** When provided, double-clicking a header enters inline rename mode. */
  export let onColumnRename: ((field: string, newName: string) => void) | undefined = undefined;

  const flipDurationMs = 150;

  function handleDndConsider(e: CustomEvent<DndEvent<GridColDefWithId>>) {
    columns = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<DndEvent<GridColDefWithId>>) {
    columns = e.detail.items;
    onColumnOrder(columns);
  }
</script>

<div class="flex container">
  <GridCell
    colindex={1}
    rowindex={1}
    column={{ field: "", width: 60, header: true, editable: false }}
    columnHeader
    rowHeader
  />
  <div
    class="flex"
    use:dndzone={{
      items: columns,
      flipDurationMs,
      morphDisabled: true,
      dropTargetStyle: {
        outline: "none",
        background: "hsla(var(--interactive-accent-hsl), 0.3)",
      },
    }}
    on:consider={handleDndConsider}
    on:finalize={handleDndFinalize}
  >
    {#each columns as column, columnIdx (column.id)}
      <div
        class={`flex relative`}
        animate:flip={{ duration: flipDurationMs }}
        class:pinned={column.pinned}
      >
        <GridColumnHeader {column} {onColumnMenu} {onColumnRename} colindex={columnIdx} />
        <Resizer
          width={column.width ?? 180}
          min={100}
          onChange={(width) => {
            onResize(column.field, width);
          }}
          onFinalize={(width) => {
            onFinalizeResize(column.field, width);
          }}
        />
      </div>
    {/each}
  </div>
  {#if onAddColumn}
    <button
      class="ppp-add-column-btn clickable-icon"
      type="button"
      on:click={onAddColumn}
      aria-label="Add column"
      title="Add column"
    >+</button>
  {/if}
</div>

<style>
  div.container {
    position: sticky;
    top: 0;
    z-index: 6;
  }

  div.flex {
    display: flex;
  }

  div.relative {
    position: relative;
  }

  div.pinned {
    left: var(--ppp-row-header-width, 3.75rem);
    z-index: 7;
    position: sticky;
  }

  .ppp-add-column-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 100%;
    min-height: 1.75rem;
    border: none;
    background: transparent;
    color: var(--text-faint);
    font-size: 1rem;
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease, color 120ms ease, background 120ms ease;
    flex-shrink: 0;
    border-left: 0.0625rem solid var(--background-modifier-border);
    border-radius: 0;
  }

  div.container:hover .ppp-add-column-btn,
  .ppp-add-column-btn:focus-visible {
    opacity: 1;
  }

  .ppp-add-column-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }
</style>
