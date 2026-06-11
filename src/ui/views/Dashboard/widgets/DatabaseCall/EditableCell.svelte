<script lang="ts">
  /**
   * EditableCell — F2.2 (TABLE_V2_CANON §2/§3). Cell = typed property edited
   * in place. Display and editor live together so a cell has exactly one
   * source of truth. Editor dispatch is STRICTLY by DataFieldType
   * (invariant #1). Commit on blur/Enter/option-click, revert on Esc.
   * Boolean toggles instantly. Relation editing is #081
   * (RelationPickerPopover); derived types are read-only by contract.
   */
  import { createEventDispatcher, tick } from "svelte";
  import {
    DataFieldType,
    type DataField,
    type DataValue,
    type Optional,
  } from "src/lib/dataframe/dataframe";
  import { cellDisplay } from "./tableCanon";
  import CellChoiceDropdown from "./CellChoiceDropdown.svelte";

  export let field: DataField;
  export let value: Optional<DataValue>;
  export let readonly: boolean;
  export let editing: boolean;
  /** Unique existing values for Select/Status dropdowns (parent-computed). */
  export let options: string[] = [];

  const dispatch = createEventDispatcher<{
    startEdit: void;
    commit: Optional<DataValue>;
    cancel: void;
  }>();

  $: cell = cellDisplay(field, value);
  $: editable = !readonly && !field.derived &&
    field.type !== DataFieldType.Relation &&
    field.type !== DataFieldType.Formula &&
    field.type !== DataFieldType.Rollup;
  $: isChoice = field.type === DataFieldType.Select || field.type === DataFieldType.Status;

  let draft = "";
  let inputEl: HTMLInputElement | null = null;
  let committed = false;

  $: if (editing) {
    draft = value === null || value === undefined ? "" : String(value);
    committed = false;
    void tick().then(() => inputEl?.focus());
  }

  function handleCellClick() {
    if (!editable || editing) return;
    if (field.type === DataFieldType.Boolean) {
      dispatch("commit", value !== true);
      return;
    }
    dispatch("startEdit");
  }

  function commitDraft(raw: string) {
    if (committed) return;
    committed = true;
    if (field.type === DataFieldType.Number) {
      const n = Number(raw);
      dispatch("commit", raw.trim() === "" || Number.isNaN(n) ? null : n);
      return;
    }
    dispatch("commit", raw);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraft(draft);
    } else if (e.key === "Escape") {
      e.preventDefault();
      committed = true;
      dispatch("cancel");
    }
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="ppp-t2-cell"
  class:ppp-t2-cell--number={cell.kind === "number"}
  class:ppp-t2-cell--editable={editable}
  class:ppp-t2-cell--editing={editing}
  role="gridcell"
  tabindex={editable ? 0 : -1}
  on:click={handleCellClick}
  on:keydown={(e) => { if (e.key === "Enter" && !editing) { e.preventDefault(); handleCellClick(); } }}
>
  {#if editing && field.type === DataFieldType.Date}
    <input bind:this={inputEl} class="ppp-t2-editor" type="date" bind:value={draft}
      on:keydown={handleKeydown} on:blur={() => commitDraft(draft)} />
  {:else if editing && field.type === DataFieldType.Number}
    <input bind:this={inputEl} class="ppp-t2-editor ppp-t2-editor--number" type="text" inputmode="decimal"
      bind:value={draft} on:keydown={handleKeydown} on:blur={() => commitDraft(draft)} />
  {:else if editing && isChoice}
    <CellChoiceDropdown bind:draft {options}
      on:commit={(e) => commitDraft(e.detail)}
      on:cancel={() => { committed = true; dispatch("cancel"); }} />
  {:else if editing}
    <input bind:this={inputEl} class="ppp-t2-editor" type="text" bind:value={draft}
      on:keydown={handleKeydown} on:blur={() => commitDraft(draft)} />
  {:else if cell.kind === "empty"}
    <span class="ppp-t2-empty" aria-hidden="true">—</span>
  {:else if cell.kind === "check"}
    <input type="checkbox" checked={cell.checked} disabled={!editable} class="ppp-t2-check"
      on:click|stopPropagation={() => { if (editable) dispatch("commit", value !== true); }} />
  {:else if cell.kind === "pills"}
    <span class="ppp-t2-pills">
      {#each cell.pills as pill (pill.label)}
        <span class="ppp-t2-pill" style:background-color={pill.color ?? ""}>
          {#if cell.status}<span class="ppp-t2-pill-dot" aria-hidden="true">●</span>{/if}{pill.label}
        </span>
      {/each}
      {#if cell.overflow > 0}<span class="ppp-t2-pill ppp-t2-pill--more">+{cell.overflow}</span>{/if}
    </span>
  {:else if cell.kind === "number"}
    {cell.text}
  {:else}
    <span class="ppp-t2-text">{cell.text}</span>
  {/if}
</div>

<style>
  .ppp-t2-cell {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    padding: 0 0.5rem;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
  }

  .ppp-t2-cell--editable {
    cursor: text;
  }

  .ppp-t2-cell--number {
    justify-content: flex-end;
    font-variant-numeric: tabular-nums;
  }

  /* Canon §2: the editing cell becomes a popover — ring + shadow */
  .ppp-t2-cell--editing {
    background: var(--background-primary);
    box-shadow: 0 0 0 0.125rem var(--interactive-accent), var(--ppp-shadow-md, 0 4px 12px rgba(15, 15, 15, 0.1));
    border-radius: var(--radius-s, 0.25rem);
    z-index: 2;
  }

  .ppp-t2-editor {
    width: 100%;
    min-width: 0;
    border: none;
    background: transparent;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    outline: none;
    padding: 0;
    height: 100%;
  }

  .ppp-t2-editor--number {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .ppp-t2-empty {
    color: transparent;
  }

  .ppp-t2-cell:hover .ppp-t2-empty {
    color: var(--text-faint);
  }

  .ppp-t2-check {
    margin: 0;
  }

  .ppp-t2-pills {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    overflow: hidden;
  }

  .ppp-t2-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.1875rem;
    height: 1.25rem;
    padding: 0 0.375rem;
    border-radius: 0.25rem;
    background: var(--background-secondary);
    font-size: var(--font-ui-smaller);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ppp-t2-pill-dot {
    font-size: 0.5rem;
    line-height: 1;
  }

  .ppp-t2-pill--more {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .ppp-t2-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
