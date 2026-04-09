<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Icon } from 'obsidian-svelte';
  import { i18n } from 'src/lib/stores/i18n';
  import type { DataField, DataRecord } from 'src/lib/dataframe/dataframe';
  import type { AgendaFilterGroup, AgendaFilter } from 'src/settings/v3/settings';
  import FilterRow from './FilterRow.svelte';
  
  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  const dispatch = createEventDispatcher<{
    update: AgendaFilterGroup;
    remove: void;
  }>();
  
  export let group: AgendaFilterGroup;
  export let fields: DataField[] = [];
  export let records: DataRecord[] = [];
  export let depth: number = 0;
  export let isRoot: boolean = false;
  
  const t = (key: string) => $i18n.t(`views.calendar.agenda.custom.filter-editor.${key}`);
  
  $: hasContent = group.filters.length > 0 || group.groups.length > 0;
  $: totalItems = group.filters.length + group.groups.length;
  
  function handleConjunctionChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    dispatch('update', { ...group, conjunction: target.value as 'AND' | 'OR' });
  }
  
  function addFilter() {
    const newFilter: AgendaFilter = {
      id: generateId(),
      field: fields[0]?.name ?? '',
      operator: 'is',
      value: '',
    };
    dispatch('update', { ...group, filters: [...group.filters, newFilter] });
  }
  
  function addGroup() {
    const newGroup: AgendaFilterGroup = {
      id: generateId(),
      conjunction: 'AND',
      filters: [],
      groups: [],
    };
    dispatch('update', { ...group, groups: [...group.groups, newGroup] });
  }
  
  function updateFilter(index: number, updatedFilter: AgendaFilter) {
    const newFilters = [...group.filters];
    newFilters[index] = updatedFilter;
    dispatch('update', { ...group, filters: newFilters });
  }
  
  function removeFilter(index: number) {
    dispatch('update', { ...group, filters: group.filters.filter((_, i) => i !== index) });
  }
  
  function updateNestedGroup(index: number, updatedGroup: AgendaFilterGroup) {
    const newGroups = [...group.groups];
    newGroups[index] = updatedGroup;
    dispatch('update', { ...group, groups: newGroups });
  }
  
  function removeNestedGroup(index: number) {
    dispatch('update', { ...group, groups: group.groups.filter((_, i) => i !== index) });
  }
  
  /** Get the row prefix — "Где" for first item overall, "и" otherwise */
  function getPrefix(itemIndex: number): string {
    if (itemIndex === 0) return t('where-prefix') || 'Где';
    return t('and-prefix') || 'и';
  }
</script>

<div class="fg" class:fg--root={isRoot} class:fg--nested={!isRoot && depth > 0}>
  <!-- ═══ Conjunction header ═══ -->
  {#if hasContent || (!isRoot && depth > 0)}
    <div class="fg-header">
      {#if !isRoot && depth > 0}
        <button
          class="fg-delete clickable-icon"
          type="button"
          on:click={() => dispatch('remove')}
          title={t('remove-group')}
        >
          <Icon name="x" size="sm" />
        </button>
      {/if}
      
      <select
        class="fg-conjunction"
        value={group.conjunction}
        on:change={handleConjunctionChange}
      >
        <option value="AND">{t('match-all') || 'All of the following'}</option>
        <option value="OR">{t('match-any') || 'Any of the following'}</option>
      </select>
    </div>
  {/if}
  
  <!-- ═══ Filter rows ═══ -->
  {#if hasContent}
    <div class="fg-rows">
      {#each group.filters as filter, index (filter.id)}
        <FilterRow
          {filter}
          {fields}
          {records}
          prefix={getPrefix(index)}
          on:update={(e) => updateFilter(index, e.detail)}
          on:remove={() => removeFilter(index)}
        />
      {/each}
      
      {#each group.groups as nestedGroup, gIndex (nestedGroup.id)}
        <div class="fg-nested-row">
          <span class="fg-nested-prefix">
            {getPrefix(group.filters.length + gIndex)}
          </span>
          <div class="fg-nested-box">
            <svelte:self
              group={nestedGroup}
              {fields}
              {records}
              depth={depth + 1}
              on:update={(e) => updateNestedGroup(gIndex, e.detail)}
              on:remove={() => removeNestedGroup(gIndex)}
            />
          </div>
        </div>
      {/each}
    </div>
  {:else if isRoot}
    <p class="fg-empty">{t('empty') || 'No filters — all records will be shown'}</p>
  {/if}
  
  <!-- ═══ Add buttons ═══ -->
  <div class="fg-actions">
    <button class="fg-add" type="button" on:click={addFilter}>
      <Icon name="plus" size="xs" />
      <span>{t('add-filter') || 'Add filter'}</span>
    </button>
    {#if depth < 3}
      <span class="fg-actions-sep"></span>
      <button class="fg-add" type="button" on:click={addGroup}>
        <Icon name="plus" size="xs" />
        <span>{t('add-group') || 'Add filter group'}</span>
      </button>
    {/if}
  </div>
</div>

<style>
  /* ═══════════════════════════════════════
     GROUP CONTAINER
     ═══════════════════════════════════════ */
  .fg {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  
  .fg--root {
    padding: 0;
  }
  
  .fg--nested {
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--background-modifier-border);
    border-left: 3px solid var(--interactive-accent);
    border-radius: 0.5rem;
    background: var(--background-secondary);
  }
  
  /* ═══════════════════════════════════════
     HEADER — conjunction + delete
     ═══════════════════════════════════════ */
  .fg-header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.25rem;
  }
  
  .fg-delete {
    flex-shrink: 0;
    color: var(--text-faint);
    border-radius: 0.25rem;
    padding: 0.1875rem;
    transition: color 100ms ease;
  }
  
  .fg-delete:hover {
    color: var(--text-error);
    background: rgba(var(--color-red-rgb, 255, 0, 0), 0.06);
  }
  
  .fg-conjunction {
    height: 1.625rem;
    padding: 0 1.5rem 0 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.375rem;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.75rem;
    font-family: var(--font-interface);
    cursor: pointer;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.375rem center;
    transition: border-color 100ms ease;
  }
  
  .fg-conjunction:hover {
    border-color: var(--interactive-accent);
  }
  
  .fg-conjunction:focus {
    border-color: var(--interactive-accent);
  }
  
  .fg-conjunction option {
    background: var(--background-primary);
    color: var(--text-normal);
  }
  
  /* ═══════════════════════════════════════
     ROWS LIST
     ═══════════════════════════════════════ */
  .fg-rows {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  
  /* ═══════════════════════════════════════
     NESTED GROUP ROW
     ═══════════════════════════════════════ */
  .fg-nested-row {
    display: flex;
    align-items: flex-start;
    gap: 0.375rem;
    padding: 0.25rem 0;
  }
  
  .fg-nested-prefix {
    flex-shrink: 0;
    width: 2rem;
    text-align: right;
    color: var(--text-muted);
    font-size: 0.75rem;
    padding-top: 0.625rem;
    padding-right: 0.125rem;
    user-select: none;
  }
  
  .fg-nested-box {
    flex: 1;
    min-width: 0;
  }
  
  /* ═══════════════════════════════════════
     EMPTY STATE
     ═══════════════════════════════════════ */
  .fg-empty {
    padding: 0.75rem 0.5rem;
    text-align: center;
    color: var(--text-faint);
    font-size: 0.75rem;
    font-style: italic;
    margin: 0;
  }
  
  /* ═══════════════════════════════════════
     ADD BUTTONS — subtle text links
     ═══════════════════════════════════════ */
  .fg-actions {
    display: flex;
    align-items: center;
    gap: 0;
    padding-left: 2.375rem;
    margin-top: 0.25rem;
  }
  
  .fg-add {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border: none;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    font-size: 0.75rem;
    font-family: var(--font-interface);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    transition: color 100ms ease, background 100ms ease;
    white-space: nowrap;
  }
  
  .fg-add:hover {
    color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }
  
  .fg-actions-sep {
    width: 1px;
    height: 0.875rem;
    background: var(--background-modifier-border);
    flex-shrink: 0;
    margin: 0 0.125rem;
  }
  
  /* ═══════════════════════════════════════
     TOUCH DEVICES
     ═══════════════════════════════════════ */
  @media (pointer: coarse) {
    .fg--nested {
      padding: 0.625rem 0.75rem;
    }
    
    .fg-actions {
      padding-left: 0;
      flex-wrap: wrap;
    }
    
    .fg-add {
      min-height: 2.25rem;
      font-size: 0.8125rem;
      padding: 0.375rem 0.625rem;
    }
    
    .fg-delete {
      min-width: 2.25rem;
      min-height: 2.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .fg-conjunction {
      height: 2.125rem;
      font-size: 0.8125rem;
    }
  }
</style>
