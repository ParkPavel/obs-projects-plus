<script lang="ts">
  import type { FilterCondition } from "src/settings/settings";
  export let filterConditions: FilterCondition[] = [];
  export let creationConditions: FilterCondition[] = [];
  $: void $$restProps;
</script>
<output data-create-context>{JSON.stringify([...filterConditions, ...creationConditions])}</output>
