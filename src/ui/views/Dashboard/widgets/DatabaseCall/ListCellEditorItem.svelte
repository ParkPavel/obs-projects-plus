<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import ComboField from "src/ui/components/fields/ComboField.svelte";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import type { ComboOption } from "src/ui/components/fields/comboOptions";

  export let item: { id: number; value: Optional<DataValue> };
  export let index: number;
  export let fieldName: string;
  export let options: ComboOption[] = [];
  export let saving = false;

  const dispatch = createEventDispatcher<{
    change: Optional<DataValue>;
    remove: void;
    cancel: void;
  }>();
</script>

<div class="ppp-t2-list-item">
  {#if typeof item.value === "string"}
    {#if options.length > 0}
      <ComboField
        value={item.value}
        {options}
        allowCustom
        readOnly={saving}
        ariaLabel={`${fieldName}: ${index + 1}`}
        inputClass="ppp-t2-list-input"
        on:draftChange={(event) => dispatch("change", event.detail)}
        on:commit={(event) => dispatch("change", event.detail.value)}
        on:cancel={() => dispatch("cancel")}
      />
    {:else}
      <TextField
        value={item.value}
        readOnly={saving}
        ariaLabel={`${fieldName}: ${index + 1}`}
        on:input={(event) => dispatch("change", event.detail)}
      />
    {/if}
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
