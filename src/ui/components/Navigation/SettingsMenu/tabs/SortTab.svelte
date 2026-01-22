<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type {
    SortDefinition,
    SortingCriteria,
    SortOrder,
  } from "../../../../../settings/base/settings";

  export let value: SortDefinition | undefined;
  export let fields: Array<{ name: string; type: string }> = [];

  const dispatch = createEventDispatcher<{ update: SortDefinition }>();

  function toLocal(def?: SortDefinition): SortDefinition {
    return {
      criteria: def?.criteria ? def.criteria.map(c => ({...c})) : []
    };
  }

  // Use local state only - no reactive sync from parent
  let local: SortDefinition = toLocal(value);

  function updateCriteria(index: number, patch: Partial<SortingCriteria>) {
    const newCriteria = local.criteria.map((c, i) => 
      i === index ? { ...c, ...patch } : c
    );
    local = { ...local, criteria: newCriteria };
    dispatch("update", local);
  }

  function addCriteria() {
    const newCriterion: SortingCriteria = { field: "", order: "asc", enabled: true };
    local = {
      ...local,
      criteria: [...local.criteria, newCriterion],
    };
    dispatch("update", local);
  }

  function removeCriteria(index: number) {
    local = {
      ...local,
      criteria: local.criteria.filter((_, i) => i !== index),
    };
    dispatch("update", local);
  }

  function handleFieldChange(index: number, event: Event) {
    const target = event.target as HTMLSelectElement;
    updateCriteria(index, { field: target.value });
  }

  function handleOrderChange(index: number, event: Event) {
    const target = event.target as HTMLSelectElement;
    updateCriteria(index, { order: target.value as SortOrder });
  }
</script>

<div class="section">
  <div class="header">Сортировка</div>
  <p class="muted">Укажите поле, порядок и включённость.</p>

  {#if local.criteria.length === 0}
    <p class="muted">Критерии не заданы.</p>
  {:else}
    <div class="list" role="list">
      {#each local.criteria as criterion, index}
        <div class="row" role="listitem">
          <div class="field">
            <label for={`sort-field-${index}`}>Поле</label>
            <select
              id={`sort-field-${index}`}
              value={criterion.field}
              on:change={(e) => handleFieldChange(index, e)}
            >
              <option value="">— Выберите поле —</option>
              {#each fields as f}
                <option value={f.name}>{f.name}</option>
              {/each}
            </select>
          </div>

          <div class="field">
            <label for={`sort-order-${index}`}>Порядок</label>
            <select
              id={`sort-order-${index}`}
              value={criterion.order}
              on:change={(e) => handleOrderChange(index, e)}
            >
              <option value="asc">asc</option>
              <option value="desc">desc</option>
            </select>
          </div>

          <div class="toggles">
            <button 
              type="button"
              class="toggle" 
              class:active={criterion.enabled}
              title="Включить/выключить"
              on:click={() => updateCriteria(index, { enabled: !criterion.enabled })}
            ></button>
            <button class="ghost danger" on:click={() => removeCriteria(index)} type="button">×</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <button class="primary" type="button" on:click={addCriteria}>+ Добавить критерий</button>
</div>

<style>
  .section { display: flex; flex-direction: column; gap: 0.625rem; }
  .header { font-weight: 600; }
  .muted { opacity: 0.7; font-size: 0.8125rem; margin: 0; }
  .list { display: flex; flex-direction: column; gap: 0.5rem; }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.625rem;
    background: var(--background-secondary);
    align-items: flex-end;
  }
  .field { 
    display: flex; 
    flex-direction: column; 
    gap: 0.25rem;
    flex: 1 1 auto;
    min-width: 6rem;
  }
  .field label { font-size: 0.75rem; opacity: 0.8; }
  select {
    padding: 0.5rem 0.625rem;
    border-radius: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: inherit;
    width: 100%;
    box-sizing: border-box;
    min-height: 2.25rem;
  }
  .primary {
    padding: 0.5rem 0.625rem;
    border-radius: 0.625rem;
    border: 1px solid var(--interactive-accent);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    min-height: 2.75rem;
    width: 100%;
    margin-top: 0.25rem;
  }
  .ghost {
    border: 1px solid var(--background-modifier-border);
    background: transparent;
    color: inherit;
    padding: 0.375rem 0.5rem;
    border-radius: 0.5rem;
    cursor: pointer;
    min-height: 2.25rem;
    min-width: 2.25rem;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ghost.danger {
    color: var(--text-error, #e74c3c);
  }
  .ghost.danger:hover {
    background: rgba(231, 76, 60, 0.15);
  }
  .toggle { 
    position: relative;
    width: 2.5rem;
    height: 1.375rem;
    background: var(--background-modifier-border);
    border-radius: 1rem;
    cursor: pointer;
    transition: background 0.2s ease;
    flex-shrink: 0;
  }
  .toggle.active {
    background: var(--interactive-accent, #7b68ee);
  }
  .toggle::after {
    content: '';
    position: absolute;
    top: 0.125rem;
    left: 0.125rem;
    width: 1.125rem;
    height: 1.125rem;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s ease;
    box-shadow: 0 0.0625rem 0.1875rem rgba(0,0,0,0.3);
  }
  .toggle.active::after {
    transform: translateX(1.125rem);
  }
  .toggles { 
    display: flex; 
    align-items: center; 
    gap: 0.375rem; 
    justify-content: flex-end;
    flex-shrink: 0;
  }
</style>
