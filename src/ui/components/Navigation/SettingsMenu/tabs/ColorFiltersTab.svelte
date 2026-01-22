<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type {
    ColorFilterDefinition,
    ColorRule,
    FilterCondition,
    FilterOperator,
  } from "../../../../../settings/base/settings";
  import type { DataRecord } from "src/lib/dataframe/dataframe";

  export let value: ColorFilterDefinition | undefined;
  export let fields: Array<{ name: string; type: string }> = [];
  export let records: DataRecord[] = [];

  const dispatch = createEventDispatcher<{ update: ColorFilterDefinition }>();

  const OPERATORS: FilterOperator[] = [
    "is-empty",
    "is-not-empty",
    "is",
    "is-not",
    "contains",
    "not-contains",
    "eq",
    "neq",
    "lt",
    "gt",
    "lte",
    "gte",
    "is-checked",
    "is-not-checked",
    "is-on",
    "is-not-on",
    "is-before",
    "is-after",
    "is-on-and-before",
    "is-on-and-after",
    "has-any-of",
    "has-all-of",
    "has-none-of",
    "has-keyword",
  ];

  function toLocal(def?: ColorFilterDefinition): ColorFilterDefinition {
    return {
      conditions: def?.conditions ? def.conditions.map(c => ({...c, condition: {...c.condition}})) : []
    };
  }

  // Use local state only - no reactive sync from parent
  let local: ColorFilterDefinition = toLocal(value);

  function updateCondition(index: number, patch: Partial<ColorRule>) {
    const newConditions = local.conditions.map((c, i) =>
      i === index ? { ...c, ...patch, condition: { ...c.condition, ...(patch.condition ?? {}) } } : c
    );
    local = { ...local, conditions: newConditions };
    dispatch("update", local);
  }

  function updateNestedCondition(index: number, patch: Partial<FilterCondition>) {
    const rule = local.conditions[index];
    if (!rule) return;
    updateCondition(index, { condition: { ...rule.condition, ...patch } });
  }

  function addCondition() {
    const newRule: ColorRule = {
      color: "#8ab4f8",
      condition: { field: "", operator: "is", value: "", enabled: true },
    };
    local = {
      ...local,
      conditions: [...local.conditions, newRule],
    };
    dispatch("update", local);
  }

  function removeCondition(index: number) {
    local = {
      ...local,
      conditions: local.conditions.filter((_, i) => i !== index),
    };
    dispatch("update", local);
  }

  function handleColorChange(index: number, event: Event) {
    const target = event.target as HTMLInputElement;
    updateCondition(index, { color: target.value });
  }

  function handleFieldChange(index: number, event: Event) {
    const target = event.target as HTMLSelectElement;
    updateNestedCondition(index, { field: target.value });
  }

  function handleOperatorChange(index: number, event: Event) {
    const target = event.target as HTMLSelectElement;
    updateNestedCondition(index, { operator: target.value as FilterOperator });
  }

  function handleValueChange(index: number, event: Event) {
    const target = event.target as HTMLInputElement;
    updateNestedCondition(index, { value: target.value });
  }
  
  // Получить уникальные значения для поля
  function getFieldValues(fieldName: string): string[] {
    if (!fieldName || records.length === 0) return [];
    const valuesSet = new Set<string>();
    for (const record of records) {
      const val = record.values[fieldName];
      if (val !== undefined && val !== null) {
        if (Array.isArray(val)) {
          val.forEach(v => {
            if (v !== undefined && v !== null) valuesSet.add(String(v));
          });
        } else {
          valuesSet.add(String(val));
        }
      }
    }
    return [...valuesSet].sort();
  }
</script>

<div class="section">
  <div class="header">Цветовые правила</div>
  <p class="muted">Цвет + условие. Цвет может быть hex или именем CSS.</p>

  {#if local.conditions.length === 0}
    <p class="muted">Нет правил.</p>
  {:else}
    <div class="list" role="list">
      {#each local.conditions as rule, index}
        <div class="row" role="listitem">
          <div class="field">
            <label for={`color-rule-color-${index}`}>Цвет</label>
            <input
              id={`color-rule-color-${index}`}
              value={rule.color}
              on:input={(e) => handleColorChange(index, e)}
              placeholder="#8ab4f8"
            />
          </div>

          <div class="field">
            <label for={`color-rule-field-${index}`}>Поле</label>
            <select
              id={`color-rule-field-${index}`}
              value={rule.condition.field}
              on:change={(e) => handleFieldChange(index, e)}
            >
              <option value="">— Выберите поле —</option>
              {#each fields as f}
                <option value={f.name}>{f.name}</option>
              {/each}
            </select>
          </div>

          <div class="field">
            <label for={`color-rule-operator-${index}`}>Оператор</label>
            <select
              id={`color-rule-operator-${index}`}
              value={rule.condition.operator}
              on:change={(e) => handleOperatorChange(index, e)}
            >
              {#each OPERATORS as op}
                <option value={op}>{op}</option>
              {/each}
            </select>
          </div>

          <div class="field">
            <label for={`color-rule-value-${index}`}>Значение</label>
            <input
              id={`color-rule-value-${index}`}
              value={rule.condition.value ?? ""}
              on:input={(e) => handleValueChange(index, e)}
              placeholder="value (опционально)"
              list={`color-value-suggestions-${index}`}
            />
            <datalist id={`color-value-suggestions-${index}`}>
              {#each getFieldValues(rule.condition.field) as suggestion}
                <option value={suggestion} />
              {/each}
            </datalist>
          </div>

          <div class="toggles">
            <button 
              type="button"
              class="toggle" 
              class:active={rule.condition.enabled}
              title="Включить/выключить правило"
              on:click={() => updateNestedCondition(index, { enabled: !rule.condition.enabled })}
            ></button>
            <button class="ghost danger" on:click={() => removeCondition(index)} type="button">×</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <button class="primary" type="button" on:click={addCondition}>+ Добавить правило</button>
</div>

<style>
  .section { display: flex; flex-direction: column; gap: 0.625rem; }
  .header { font-weight: 600; }
  .muted { opacity: 0.7; font-size: 0.8125rem; margin: 0; }
  .list { 
    display: flex; 
    flex-direction: column; 
    gap: 0.5rem; 
    max-height: 20rem;
    overflow-y: auto;
    overflow-x: hidden;
  }
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
    min-width: 5rem;
  }
  .field label { font-size: 0.75rem; opacity: 0.8; }
  input, select {
    padding: 0.5rem 0.625rem;
    border-radius: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal, inherit);
    width: 100%;
    box-sizing: border-box;
    min-height: 2.25rem;
    font-size: 0.875rem;
  }
  
  /* Style for inputs with datalist (autocomplete) */
  input[list] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    padding-right: 1.75rem;
  }
  
  select {
    cursor: pointer;
  }
  
  select option {
    background: var(--background-primary);
    color: var(--text-normal);
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
