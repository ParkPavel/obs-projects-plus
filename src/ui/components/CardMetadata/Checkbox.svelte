<script lang="ts">
  import {
    DataFieldType,
    type DataField,
    type DataValue,
    type Optional,
  } from "src/lib/dataframe/dataframe";

  export let value: Optional<DataValue>;
  export let field: DataField;
  export let onChange: ((checked: boolean) => void) | undefined = undefined;
</script>

{#if field.type === DataFieldType.Boolean && !field.repeated && typeof value === "boolean"}
  <span class="ppp-card-meta-boolean">
    <input type="checkbox" aria-label={field.name} checked={value} disabled={!onChange}
      on:click|stopPropagation on:dblclick|stopPropagation
      on:change={(e) => onChange?.(e.currentTarget.checked)} />
  </span>
{/if}
