<script lang="ts">
  /** EditableCell — F2.2 (TABLE_V2_CANON §2/§3): typed property edited in place; editor by DataFieldType (invariant #1).
   * Commit on blur/Enter/option-click, Esc reverts, Boolean toggles. B3: a locked cell shows why; a tap edits, a drag scrolls. */
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { cellAccess } from "./tableCellAccess";
  import { cellTouch, liftOnKeyboard } from "./tableTouch";
  import type { ParsedSearch } from "./tableSearchQuery";
  import CellLockReason from "./CellLockReason.svelte";
  import HighlightText from "./HighlightText.svelte";
  import {
    DataFieldType,
    type DataField,
    type DataValue,
    type Optional,
  } from "src/lib/dataframe/dataframe";
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { ViewApi } from "src/lib/viewApi";
  import { cellDisplay } from "./tableCanon";
  import { editedCellValue } from "./editedCellValue";
  import TypedCellEditor from "./TypedCellEditor.svelte";
  import ListCellEditor from "./ListCellEditor.svelte";
  import CellChoiceDropdown from "./CellChoiceDropdown.svelte";
  import RelationPickerPopover from "./RelationPickerPopover.svelte";
  import RollupCellRenderer from "src/ui/components/RollupCellRenderer/RollupCellRenderer.svelte";

  type DateFormatConfig = import("src/settings/v3/settings").DateFormatConfig;

  export let field: DataField;
  export let value: Optional<DataValue>;
  export let readonly: boolean;
  export let editing: boolean;
  /** Unique existing values for Select/Status dropdowns (parent-computed). */
  export let options: string[] = [];
  /** #081 — the Relation picker resolves the target project's records. */
  export let api: ViewApi;
  export let frame: DataFrame;
  export let dateFormat: DateFormatConfig | undefined = undefined;
  export let highlight: ParsedSearch | null = null;

  const dispatch = createEventDispatcher<{
    startEdit: void;
    commit: Optional<DataValue>;
    cancel: void;
    setupRelation: DataField;
  }>();

  $: cell = cellDisplay(field, value, dateFormat);
  $: access = cellAccess(field, value, readonly);
  $: editable = access.editable;
  $: reason = access.editable ? "" : $i18n.t(access.reason.key, { defaultValue: access.reason.defaultValue, ...access.reason.params });
  let reasonOpen = false;
  $: isChoice = field.type === DataFieldType.Select || field.type === DataFieldType.Status;
  let draft = "";
  let committed = false, wasEditing = false, invalid = false;

  // Seeded on the turn INTO editing, inside a function: `draft` is bound, and a `$:` that assigns it re-seeds per keystroke (R0.34).
  function onEditing(on: boolean) {
    if (on && !wasEditing) {
      draft = value == null ? "" : String(value);
      committed = false;
      invalid = false;
    }
    wasEditing = on;
  }
  $: onEditing(editing);

  // The cell's Enter handler takes only its own Enter: the editor's bubbles up after the browser flushed `editing = false`, reopening the cell.
  function handleCellClick() {
    if (!editable) reasonOpen = true;
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
    dispatch("commit", editedCellValue(field, value, raw, dateFormat));
  }

</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="ppp-t2-cell"
  class:ppp-t2-cell--number={cell.kind === "number"} class:ppp-t2-cell--editable={editable}
  class:ppp-t2-cell--editing={editing} class:ppp-t2-cell--invalid={invalid}
  role="gridcell" tabindex="0" aria-readonly={editable ? undefined : "true"} title={reason || undefined}
  use:cellTouch={handleCellClick} use:liftOnKeyboard={editing}
  on:focus={() => { reasonOpen = !editable; }} on:blur={() => { reasonOpen = false; }}
  on:keydown={(e) => { if (e.target === e.currentTarget && e.key === "Enter" && !editing) { e.preventDefault(); handleCellClick(); } }}
>
  {#if editing && field.type === DataFieldType.Relation}
    <span class="ppp-t2-text">{cell.kind === "text" ? cell.text : ""}</span>
    <RelationPickerPopover {field} {value} {api} {frame}
      on:commit={(e) => { committed = true; dispatch("commit", e.detail); }}
      on:cancel={() => { committed = true; dispatch("cancel"); }}
      on:setupRelation={() => { committed = true; dispatch("setupRelation", field); }} />
  {:else if editing && (field.type === DataFieldType.List || (field.type === DataFieldType.String && (field.repeated || Array.isArray(value))))}
    <ListCellEditor {field} {value} on:commit on:cancel />
  {:else if editing && isChoice}
    <CellChoiceDropdown bind:draft {options}
      on:commit={(e) => commitDraft(e.detail)}
      on:cancel={() => { committed = true; dispatch("cancel"); }} />
  {:else if editing}
    <TypedCellEditor {field} {value} {dateFormat}
      on:commit on:cancel on:invalid={(e) => { invalid = e.detail; }} />
  {:else if field.type === DataFieldType.Rollup || field.typeConfig?.rollup}
    <!-- #045.4: shown by its mode (percent bar, show chips, plain count); read-only like every derived field.
         A rollup column keeps its detected type (a sum is a Number); its typeConfig.rollup says what it is. -->
    <RollupCellRenderer {value} fn={field.typeConfig?.rollup?.function ?? ""} modeId={field.typeConfig?.rollup?.mode ?? ""} />
  {:else if cell.kind === "empty"}
    <span class="ppp-t2-empty" aria-hidden="true">—</span>
  {:else if cell.kind === "check"}
    <input type="checkbox" checked={cell.checked} disabled={!editable} class="ppp-t2-check"
      on:click|stopPropagation={() => { if (editable) dispatch("commit", value !== true); }} />
  {:else if cell.kind === "pills"}
    <span class="ppp-t2-pills">
      {#each cell.pills as pill}
        <span class="ppp-t2-pill" style:background-color={pill.color ?? ""}>
          {#if cell.status}<span class="ppp-t2-pill-dot" aria-hidden="true">●</span>{/if}{pill.label}
        </span>
      {/each}
      {#if cell.overflow > 0}<span class="ppp-t2-pill ppp-t2-pill--more">+{cell.overflow}</span>{/if}
    </span>
  {:else if cell.kind === "number"}
    {cell.text}
  {:else}
    <span class="ppp-t2-text"><HighlightText text={cell.text} search={highlight} field={field.name} /></span>
  {/if}
  {#if reasonOpen && reason}<CellLockReason text={reason} />{/if}
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
    box-shadow: 0 0 0 0.125rem var(--ppp-t2-editor-ring, var(--interactive-accent)), var(--ppp-shadow-md);
    border-radius: var(--radius-s, 0.25rem);
    z-index: 2;
  }

  .ppp-t2-cell--invalid {
    --ppp-t2-editor-ring: var(--text-error);
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
