<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { DataField } from 'src/lib/dataframe/dataframe';
  import type { DataRecord } from 'src/lib/dataframe/dataframe';
  import type { AgendaFilterGroup } from 'src/settings/v3/settings';
  import FilterGroupEditor from './FilterGroupEditor.svelte';
  
  const dispatch = createEventDispatcher<{
    change: AgendaFilterGroup;
  }>();
  
  export let filterGroup: AgendaFilterGroup;
  export let fields: DataField[] = [];
  export let records: DataRecord[] = [];
  
  function handleUpdate(event: CustomEvent<AgendaFilterGroup>) {
    filterGroup = event.detail;
    dispatch('change', filterGroup);
  }
</script>

<div class="agenda-filter-editor">
  <FilterGroupEditor
    group={filterGroup}
    {fields}
    {records}
    depth={0}
    isRoot={true}
    on:update={handleUpdate}
  />
</div>

<style>
  .agenda-filter-editor {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 4px;
  }
</style>

