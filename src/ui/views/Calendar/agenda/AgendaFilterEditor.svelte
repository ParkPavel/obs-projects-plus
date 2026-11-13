<script lang="ts">
  /**
   * The agenda list's conditions — w4-filters (N11): the same editor as the
   * view's filter and the colour rules (FilterPanel: one condition row, one
   * operator catalog, the project's value suggestions, date formulas). The
   * list keeps its stored AgendaFilterGroup; agendaFilterModel bridges it.
   * What is the agenda's own is around this: icon, colour, order, the
   * advanced formula mode.
   */
  import { createEventDispatcher } from 'svelte';
  import { v4 as uuidv4 } from 'uuid';
  import type { DataField, DataRecord } from 'src/lib/dataframe/dataframe';
  import type { AgendaFilterGroup } from 'src/settings/v3/settings';
  import type { FilterDefinition } from 'src/settings/base/settings';
  import FilterPanel from 'src/ui/components/FilterPanel/FilterPanel.svelte';
  import { agendaGroupToDefinition, definitionToAgendaGroup } from 'src/lib/filters/agendaFilterModel';

  const dispatch = createEventDispatcher<{
    change: AgendaFilterGroup;
  }>();

  export let filterGroup: AgendaFilterGroup;
  export let fields: DataField[] = [];
  export let records: DataRecord[] = [];

  $: definition = agendaGroupToDefinition(filterGroup);

  function handleUpdate(event: CustomEvent<FilterDefinition>) {
    filterGroup = definitionToAgendaGroup(event.detail, filterGroup, uuidv4);
    dispatch('change', filterGroup);
  }
</script>

<div class="agenda-filter-editor">
  <FilterPanel value={definition} {fields} {records} on:update={handleUpdate} />
</div>

<style>
  .agenda-filter-editor {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 0.25rem;
  }
</style>
