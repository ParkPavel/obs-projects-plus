<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { DataFieldType, type DataField, type DataValue, type Optional } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import ComboField from "src/ui/components/fields/ComboField.svelte";
  import TypedCellEditor from "./TypedCellEditor.svelte";
  import { namesToOptions } from "src/ui/components/fields/comboOptions";
  import { dateInputValue } from "src/lib/helpers/dateShape";
  import type { ComboOption } from "src/ui/components/fields/comboOptions";

  export let item: { id: number; value: Optional<DataValue> };
  export let index: number;
  export let fieldName: string;
  export let field: DataField;
  export let dateFormat: import("src/settings/v3/settings").DateFormatConfig | undefined = undefined;
  export let options: ComboOption[] = [];
  export let saving = false;
  let typed: TypedCellEditor | undefined, text: ComboField | undefined;
  export function syncForSubmit(): boolean { return typed?.syncForSubmit() ?? text?.syncForSubmit() ?? true; }
  $: typedMember = (field.type === DataFieldType.Number && (typeof item.value === "number" || item.value == null)) ||
    (field.type === DataFieldType.Date && (item.value instanceof Date || item.value == null ||
      typeof item.value === "string" && dateInputValue(item.value, dateFormat?.writeFormat) !== ""));
  $: booleanMember = field.type === DataFieldType.Boolean && (typeof item.value === "boolean" || item.value == null);

  const dispatch = createEventDispatcher<{
    change: Optional<DataValue>;
    remove: void;
    cancel: void;
  }>();
</script>

<div class="ppp-t2-list-item">
  {#if typedMember}
    <TypedCellEditor bind:this={typed} field={{...field, name: `${fieldName}: ${index + 1}`, repeated: false}}
      value={item.value} options={options.map(option => option.value ?? option.label)} {dateFormat} {saving}
      on:commit={event => dispatch("change", event.detail)} on:cancel={() => dispatch("cancel")} />
  {:else if booleanMember}
    <ComboField bind:this={text} value={item.value == null ? "" : String(item.value)}
      options={namesToOptions(["true", "false"])} allowEmpty readOnly={saving} commitOnDestroy={false}
      ariaLabel={`${fieldName}: ${index + 1}`} inputClass="ppp-t2-list-input"
      on:commit={event => dispatch("change", event.detail.value === "" ? null : event.detail.value === "true")}
      on:cancel={() => dispatch("cancel")} />
  {:else if typeof item.value === "string" && ![DataFieldType.Number, DataFieldType.Date, DataFieldType.Boolean].includes(field.type)}
      <ComboField
        bind:this={text}
        value={item.value}
        {options}
        allowCustom
        commitOnDestroy={false}
        readOnly={saving}
        ariaLabel={`${fieldName}: ${index + 1}`}
        inputClass="ppp-t2-list-input"
        on:draftChange={(event) => dispatch("change", event.detail)}
        on:commit={(event) => dispatch("change", event.detail.value)}
        on:cancel={() => dispatch("cancel")}
      />
  {:else}
    <span>{item.value == null ? "∅" : String(item.value)}</span>
  {/if}
  <button type="button" disabled={saving} on:click={() => dispatch("remove")}>
    {$i18n.t("views.dashboard.table-v2.list-remove", { defaultValue: `Remove item ${index + 1}`, index: index + 1 })}
  </button>
</div>

<style>
  .ppp-t2-list-item {
    display: flex;
    align-items: center;
    gap: var(--ppp-space-sm);
  }

  .ppp-t2-list-item :global(input) {
    min-width: 0;
    flex: 1;
  }

  .ppp-t2-list-item :global(.ppp-combo) {
    flex: 1;
    min-width: 0;
  }
</style>
