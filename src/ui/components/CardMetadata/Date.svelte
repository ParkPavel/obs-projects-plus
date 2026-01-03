<script lang="ts">
  import {
    DataFieldType,
    type DataField,
    type DataValue,
    type Optional,
  } from "src/lib/dataframe/dataframe";
  import { settings } from "src/lib/stores/settings";
  import { formatDate } from "src/lib/helpers";

  export let value: Optional<DataValue>;
  export let field: DataField;

  $: preferences = $settings.preferences;
</script>

{#if field.type === DataFieldType.Date && !field.repeated && value instanceof Date}
  {formatDate(value, preferences)}
{/if}
