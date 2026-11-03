<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "../../../../../lib/stores/i18n";
  import OptionField from "src/ui/components/fields/OptionField.svelte";
  import type {
    ColorFilterDefinition,
    ColorRule,
    FilterCondition,
    FilterOperator,
  } from "../../../../../settings/base/settings";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { getOperatorsForField, getOperatorLabel, getFieldChoices, getOperatorChoices } from "./filterHelpers";
  import { operatorNeedsValue } from "src/settings/base/settings";
  import { COLOR_RULE_DEFAULT } from "src/lib/stores/palettes";
  import ConditionValue from "src/ui/components/FilterPanel/ConditionValue.svelte";
  import { app } from "src/lib/stores/obsidian";
  import { templateFoldersOf, valueSuggestions } from "src/lib/suggestions/valueSuggestions";

  function inputVal(e: Event): string { return (e.target as HTMLInputElement)?.value ?? ''; }

  export let value: ColorFilterDefinition | undefined;
  export let fields: Array<{ name: string; type: string }> = [];
  export let records: DataRecord[] = [];

  const dispatch = createEventDispatcher<{ update: ColorFilterDefinition }>();

  function toLocal(def?: ColorFilterDefinition): ColorFilterDefinition {
    return {
      conditions: def?.conditions ? def.conditions.map(c => ({...c, condition: {...c.condition}})) : []
    };
  }

  let local: ColorFilterDefinition = toLocal(value);
  $: fieldChoices = getFieldChoices(fields);

  function updateRule(index: number, patch: Partial<ColorRule>) {
    const newConditions = local.conditions.map((c, i) =>
      i === index ? { ...c, ...patch, condition: { ...c.condition, ...(patch.condition ?? {}) } } : c
    );
    local = { ...local, conditions: newConditions };
    dispatch("update", local);
  }

  function updateNestedCondition(index: number, patch: Partial<FilterCondition>) {
    const rule = local.conditions[index];
    if (!rule) return;
    updateRule(index, { condition: { ...rule.condition, ...patch } });
  }

  function addRule() {
    const firstField = fields[0];
    const ops = firstField ? getOperatorsForField(firstField.type) : ['is' as FilterOperator];
    const newRule: ColorRule = {
      color: COLOR_RULE_DEFAULT,
      condition: {
        field: firstField?.name ?? "",
        operator: ops[0] ?? "is",
        value: "",
        enabled: true,
      },
    };
    local = { ...local, conditions: [...local.conditions, newRule] };
    dispatch("update", local);
  }

  function removeRule(index: number) {
    local = { ...local, conditions: local.conditions.filter((_, i) => i !== index) };
    dispatch("update", local);
  }

  // DG-3: drag-to-reorder color rules
  let dragIndex: number | null = null;
  let dragOverIndex: number | null = null;

  function onDragStart(index: number, e: DragEvent) {
    dragIndex = index;
    e.dataTransfer!.effectAllowed = "move";
  }

  function onDragOver(index: number, e: DragEvent) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    dragOverIndex = index;
  }

  function onDrop(index: number, e: DragEvent) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) { dragIndex = null; dragOverIndex = null; return; }
    const arr = [...local.conditions];
    const [moved] = arr.splice(dragIndex, 1);
    arr.splice(index, 0, moved!);
    dragIndex = null;
    dragOverIndex = null;
    local = { ...local, conditions: arr };
    dispatch("update", local);
  }

  function onDragEnd() { dragIndex = null; dragOverIndex = null; }

  function getFieldType(fieldName: string): string {
    return fields.find(f => f.name === fieldName)?.type ?? 'string';
  }

  // ── Value suggestions: the project's values and the field's options (one shared memo) ──
  $: templateFolders = templateFoldersOf($app);
  function suggestionsFor(fieldName: string, source: DataRecord[], folders: readonly string[]): string[] {
    return valueSuggestions(source, fields.find((f) => f.name === fieldName), { templateFolders: folders });
  }

  /** The typed or picked value; the commit that follows an edit with the same text writes nothing. */
  function setRuleValue(index: number, next: string): void {
    if (local.conditions[index]?.condition.value === next) return;
    updateNestedCondition(index, { value: next });
  }

  function setField(index: number, name: string) {
    const cond = local.conditions[index]?.condition, field = fields.find(item => item.name === name);
    if (!cond || !field) return;
    const ops = getOperatorsForField(field.type);
    const operator = ops.includes(cond.operator) ? cond.operator : ops[0] ?? 'is';
    updateNestedCondition(index, { field: name, operator, value: '' });
  }
  function setOperator(index: number, code: string) {
    const cond = local.conditions[index]?.condition; if (!cond) return;
    const operator = getOperatorsForField(getFieldType(cond.field)).find(op => op === code);
    if (operator) updateNestedCondition(index, { operator, value: operatorNeedsValue(operator) ? (cond.value ?? '') : '' });
  }
</script>

<div class="section">
  <div class="section-header">
    <span class="section-title">{$i18n.t('components.color.title')}</span>
  </div>

  {#if local.conditions.length === 0}
    <p class="empty-hint">{$i18n.t('components.color.empty-hint')}</p>
  {:else}
    <div class="list">
      {#each local.conditions as rule, index}
        {@const cond = rule.condition}
        {@const fieldType = getFieldType(cond.field)}
        {@const needsVal = operatorNeedsValue(cond.operator)}
        <div
          class="color-row"
          class:color-row--disabled={!cond.enabled}
          class:color-row--drag-over={dragOverIndex === index}
          draggable="true"
          on:dragstart={(e) => onDragStart(index, e)}
          on:dragover={(e) => onDragOver(index, e)}
          on:drop={(e) => onDrop(index, e)}
          on:dragend={onDragEnd}
        >
          <!-- Drag handle -->
          <button class="row-btn row-drag" type="button" tabindex="-1" aria-hidden="true" title={$i18n.t("common.drag-to-reorder")}>
            <Icon name="grip-vertical" size="sm" />
          </button>
          <!-- Toggle -->
          <button
            class="row-btn row-toggle"
            class:row-toggle--off={!cond.enabled}
            type="button"
            on:click|stopPropagation={() => updateNestedCondition(index, { enabled: !cond.enabled })}
            title={cond.enabled ? $i18n.t('common.disable') : $i18n.t('common.enable')}
          >
            <Icon name={cond.enabled ? 'eye' : 'eye-off'} size="sm" />
          </button>

          <!-- Color swatch with picker -->
          <label class="color-swatch" style="--swatch-color: {rule.color};"
            title={$i18n.t('common.select-color')}>
            <input
              type="color"
              class="color-native"
              value={rule.color}
              on:input={(e) => updateRule(index, { color: inputVal(e) })}
            />
          </label>

          <!-- Field chip -->
          <div class="chip chip--field">
            <OptionField value={cond.field} options={fieldChoices} ariaLabel={$i18n.t('common.field')}
              disabled={!cond.enabled} on:change={(e) => setField(index, e.detail)} />
          </div>

          <!-- Operator chip -->
          <div class="chip chip--op">
            <OptionField value={cond.operator} options={getOperatorChoices(fieldType, $i18n)}
              displayLabel={getOperatorLabel(cond.operator, $i18n)} contextKey={cond.field}
              disabled={!cond.enabled} on:change={(e) => setOperator(index, e.detail)} />
          </div>

          <!-- Value -->
          <div class="value-area">
            {#if needsVal}
              <ConditionValue
                fieldType={getFieldType(cond.field)}
                operator={cond.operator}
                value={cond.value ?? ''}
                suggestions={suggestionsFor(cond.field, records, templateFolders)}
                placeholder={$i18n.t('common.value-placeholder')}
                ariaLabel={$i18n.t('common.value-placeholder')}
                on:input={(e) => setRuleValue(index, e.detail)}
                on:commit={(e) => setRuleValue(index, e.detail)} />
            {:else}
              <span class="no-value">—</span>
            {/if}
          </div>

          <!-- Delete -->
          <button class="row-btn row-delete" type="button"
            on:click|stopPropagation={() => removeRule(index)} title={$i18n.t('common.delete')}>
            <Icon name="trash-2" size="sm" />
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <button class="add-btn" type="button" on:click={addRule}>
    <Icon name="plus" size="sm" />
    <span>{$i18n.t('components.color.add-rule')}</span>
  </button>
</div>

<style>
  /* px→rem migration (REFACTOR-404 partial). Hairline 1 borders and the
     2 thick border on .color-swatch are kept verbatim per design-tokens
     spec ("Border widths — единственное место где можно px"). Transition
     timings (100ms) are durations, not sizes, so they remain. */
  .section { display: flex; flex-direction: column; gap: 0.5rem; }
  .section-header { display: flex; align-items: center; justify-content: space-between; }
  .section-title { font-weight: 600; font-size: 0.875rem; }
  .empty-hint { color: var(--text-faint); font-size: 0.8125rem; margin: 0.25rem 0; }

  .list { display: flex; flex-direction: column; gap: 0.25rem; max-height: 20rem; overflow-y: auto; }

  .color-row {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; min-width: 0;
    padding: 0.1875rem 0.125rem; min-height: 2rem; border-radius: 0.375rem;
    transition: background 100ms ease;
  }
  .color-row:hover { background: var(--background-secondary); }
  .color-row:hover .row-delete,
  .color-row:hover .row-toggle { opacity: 1; }
  .color-row--disabled { opacity: 0.5; }
  .color-row--disabled .chip,
  .color-row--disabled .value-area,
  .color-row--disabled .color-swatch { pointer-events: none; }
  .color-row--drag-over { border-top: 0.125rem solid var(--interactive-accent); border-radius: 0; }
  .row-drag { cursor: grab; opacity: 0; transition: opacity 100ms ease; }
  .color-row:hover .row-drag { opacity: 0.5; }
  .row-drag:hover { opacity: 1 !important; }

  /* ── Color swatch ── */
  .color-swatch {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.625rem; height: 1.625rem;
    border-radius: 0.375rem;
    background: var(--swatch-color, #8ab4f8);
    border: 0.125rem solid var(--background-modifier-border);
    cursor: pointer;
    flex-shrink: 0;
    transition: border-color 100ms ease, box-shadow 100ms ease;
  }
  .color-swatch:hover {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 0.125rem rgba(var(--interactive-accent-rgb, 122, 104, 238), 0.25);
  }
  .color-native {
    position: absolute;
    inset: 0;
    width: 100%; height: 100%;
    opacity: 0;
    cursor: pointer;
    border: none;
    padding: 0;
  }

  .chip {
    display: inline-flex; align-items: center; gap: 0.25rem;
    height: 1.625rem; padding: 0 0.5rem;
    border: var(--ppp-border-width) solid var(--background-modifier-border); border-radius: 0.375rem;
    background: var(--background-primary); color: var(--text-normal);
    cursor: pointer; font-size: 0.8125rem; font-family: var(--font-interface);
    white-space: nowrap; line-height: 1; flex: 0 1 auto; min-width: 0; max-width: 100%; overflow: hidden;
    transition: border-color 100ms ease, background 100ms ease;
  }
  .chip:hover { border-color: var(--interactive-accent); background: var(--background-primary-alt); }

  .value-area { flex: 1 1 10em; min-width: 0; }
  .no-value { color: var(--text-faint); font-size: 0.75rem; font-style: italic; padding: 0 0.5rem; }

  .row-btn {
    flex-shrink: 0; color: var(--text-faint); border-radius: 0.25rem;
    padding: 0.25rem; border: none; background: transparent;
    cursor: pointer; opacity: 0; transition: opacity 100ms ease, color 100ms ease;
  }
  .row-toggle:hover { color: var(--interactive-accent); }
  .row-toggle--off { opacity: 1; color: var(--text-faint); }
  .row-delete:hover { color: var(--text-error); background: rgba(var(--color-red-rgb, 255, 0, 0), 0.06); }

  .add-btn {
    display: flex; align-items: center; justify-content: center;
    gap: 0.375rem; padding: 0.375rem 0.75rem; border-radius: 0.375rem;
    border: var(--ppp-border-width) dashed var(--background-modifier-border);
    background: transparent; color: var(--text-muted);
    cursor: pointer; font-size: 0.8125rem; width: 100%;
    transition: border-color 100ms ease, color 100ms ease;
  }
  .add-btn:hover { border-color: var(--interactive-accent); color: var(--text-normal); }

  /* ios-p1: the swatch keeps its 2rem look on touch, but the transparent
     native input that takes the tap grows to a --ppp-touch-target-min square
     centred on it, so the colour picker opens from a finger-sized area.
     The input itself is enlarged rather than given `.ppp-touch-target`:
     the tap then lands on the input and not on the label that forwards it.
     The square must not reach the neighbours, so the swatch gets side margins
     that, with the row gap, put each neighbour half a target away from its
     centre, and the row is a full target tall so the square stays inside it. */
  @media (pointer: coarse) {
    .color-row { display: grid; grid-template-columns: auto auto minmax(0, 1fr) minmax(0, 1fr) auto; grid-template-areas: "toggle swatch field op delete" "value value value value value"; gap: 0.1875rem; min-height: var(--ppp-touch-target-min); }
    .row-drag { display: none; }
    .row-toggle { grid-area: toggle; }
    .color-swatch { grid-area: swatch; }
    .chip--field { grid-area: field; }
    .chip--op { grid-area: op; }
    .row-delete { grid-area: delete; }
    .value-area { grid-area: value; }
    .color-swatch {
      width: 2rem; height: 2rem;
      margin-inline: calc((var(--ppp-touch-target-min) - 2rem) / 2 - 0.1875rem);
    }
    .color-native {
      inset: auto;
      top: 50%; left: 50%;
      width: var(--ppp-touch-target-min); height: var(--ppp-touch-target-min);
      transform: translate(-50%, -50%);
    }
    .chip { height: var(--ppp-touch-target-min); padding: 0 0.625rem; font-size: 0.875rem; }
    .row-btn { opacity: 1; width: var(--ppp-touch-target-min); height: var(--ppp-touch-target-min); padding: 0; }
    .add-btn { min-height: 2.5rem; font-size: 0.875rem; }
  }
</style>
