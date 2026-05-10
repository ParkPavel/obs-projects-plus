<script lang="ts">
  import { Icon, IconButton } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { fieldIcon, fieldDisplayText } from "src/ui/views/helpers";
  import type { GridColDef } from "../dataGrid";
  import { TextLabel } from "../GridCell";

  type GridColDefWithId = GridColDef & { readonly id: string };

  export let column: GridColDefWithId;
  export let colindex: number;
  export let onColumnMenu: (column: GridColDef, event: MouseEvent) => void;
  /** When provided, double-clicking the header enters inline rename mode. */
  export let onColumnRename: ((field: string, newName: string) => void) | undefined = undefined;

  // Inline rename state
  let editing = false;
  let editName = "";
  let inputEl: HTMLInputElement | undefined;

  function startEdit() {
    if (!onColumnRename) return;
    editName = column.field;
    editing = true;
    setTimeout(() => { inputEl?.select(); }, 0);
  }

  function commitEdit() {
    if (!editing) return;
    editing = false;
    const trimmed = editName.trim();
    if (trimmed && trimmed !== column.field) {
      onColumnRename?.(column.field, trimmed);
    }
  }

  function cancelEdit() {
    editing = false;
  }

  function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
  }

  function handleFieldClick(column: GridColDef): (event: MouseEvent) => void {
    return (event: MouseEvent) => {
      onColumnMenu(column, event);
    };
  }

  // Optional sort info if provided by upstream column
  $: sortInfo = (column as unknown as any)?.sort;
</script>

<div
  role="columnheader"
  aria-colindex={colindex}
  tabindex={onColumnRename ? 0 : -1}
  style:width={`${column.width}px`}
  class:pinned={column.pinned}
  on:dblclick={startEdit}
>
  {#if editing}
    <input
      bind:this={inputEl}
      class="ppp-col-rename-input"
      type="text"
      bind:value={editName}
      on:blur={commitEdit}
      on:keydown={handleInputKeydown}
    />
  {:else}
    <div class="left">
      <Icon name={fieldIcon(column)} tooltip={fieldDisplayText(column)} />
      <TextLabel value={column.field} />
    </div>

    <div class="right">
      {#if sortInfo}
        <Icon
          name={sortInfo?.direction === "desc" ? "arrow-down" : "arrow-up"}
          tooltip={sortInfo?.direction === "desc" ? $i18n.t('components.data-grid.sort.desc') : $i18n.t('components.data-grid.sort.asc')}
        />
      {/if}

      <IconButton
        size="sm"
        icon="vertical-three-dots"
        onClick={handleFieldClick(column)}
      />
    </div>
  {/if}
</div>

<style>
  div {
    position: sticky;

    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: center;

    background-color: var(--background-primary-alt);
    border-right: var(--ppp-border-width) solid var(--background-modifier-border);
    border-left-color: var(--background-modifier-border);
    border-bottom: var(--ppp-border-width) solid var(--background-modifier-border);

    width: 100%;
    height: var(--ppp-table-header-height);
    min-height: var(--ppp-table-header-height);
    max-height: var(--ppp-table-header-height);

    font-weight: var(--ppp-weight-medium);
    padding: 0 var(--ppp-padding-tight);

    cursor: default;
  }
  
  /* Touch devices - увеличиваем touch targets */
  @media (pointer: coarse) {
    div {
      height: var(--ppp-touch-min);
      min-height: var(--ppp-touch-min);
      max-height: var(--ppp-touch-min);
      padding: 0 var(--ppp-padding-normal);
    }
  }

  .left {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  .right {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  div.pinned {
    border-right: 1px solid var(--background-modifier-border-focus);
  }

  .ppp-col-rename-input {
    width: 100%;
    height: 1.5rem;
    padding: 0 0.375rem;
    border: 0.0625rem solid var(--interactive-accent);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    font-weight: var(--ppp-weight-medium, 500);
    outline: none;
    box-sizing: border-box;
  }
</style>
