<script lang="ts">
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  export let frame: DataFrame;
  $: void $$restProps;
</script>
<output data-selection-cohort>{JSON.stringify(frame.records.map(record => record.id))}</output>
