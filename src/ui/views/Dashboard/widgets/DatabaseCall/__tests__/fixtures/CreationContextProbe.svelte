<script lang="ts">
  import type { FilterCondition } from "src/settings/settings";
  export let filterConditions: FilterCondition[] = [];
  export let creationConditions: FilterCondition[] = [];
  export let frame: import("src/lib/dataframe/dataframe").DataFrame = { fields: [], records: [] };
  $: void $$restProps;
</script>
<output data-create-context>{JSON.stringify([...filterConditions, ...creationConditions])}</output>
<output data-record-ids>{JSON.stringify(frame.records.map(record => record.id))}</output>
