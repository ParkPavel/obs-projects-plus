<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "../../../../../lib/stores/i18n";
  import OptionField from "src/ui/components/fields/OptionField.svelte";
  import type {
    SortDefinition,
    SortingCriteria,
  } from "../../../../../settings/base/settings";
  import { getSortOrderLabel, getFieldChoices } from "./filterHelpers";

  export let value: SortDefinition | undefined;
  export let fields: Array<{ name: string; type: string }> = [];

  const dispatch = createEventDispatcher<{ update: SortDefinition }>();

  function toLocal(def?: SortDefinition): SortDefinition {
    return {
      criteria: def?.criteria ? def.criteria.map(c => ({...c})) : []
    };
  }

  let local: SortDefinition = toLocal(value);
  $: fieldChoices = getFieldChoices(fields);
  const orderChoices = ["asc", "desc"].map(order => ({ id: order, label: getSortOrderLabel(order) }));

  function updateCriteria(index: number, patch: Partial<SortingCriteria>) {
    const newCriteria = local.criteria.map((c, i) =>
      i === index ? { ...c, ...patch } : c
    );
    local = { ...local, criteria: newCriteria };
    dispatch("update", local);
  }
  function setOrder(index: number, code: string): void {
    if (code === "asc" || code === "desc") updateCriteria(index, { order: code });
  }

  function addCriteria() {
    const firstField = fields[0];
    const newCriterion: SortingCriteria = {
      field: firstField?.name ?? "",
      order: "asc",
      enabled: true,
    };
    local = { ...local, criteria: [...local.criteria, newCriterion] };
    dispatch("update", local);
  }

  function removeCriteria(index: number) {
    local = { ...local, criteria: local.criteria.filter((_, i) => i !== index) };
    dispatch("update", local);
  }

  // DG-3: drag-to-reorder sort criteria
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
    const arr = [...local.criteria];
    const [moved] = arr.splice(dragIndex, 1);
    arr.splice(index, 0, moved!);
    dragIndex = null;
    dragOverIndex = null;
    local = { ...local, criteria: arr };
    dispatch("update", local);
  }

  function onDragEnd() {
    dragIndex = null;
    dragOverIndex = null;
  }

</script>

<div class="section">
  <div class="section-header">
    <span class="section-title">{$i18n.t('components.sort.label')}</span>
  </div>

  {#if local.criteria.length === 0}
    <p class="empty-hint">{$i18n.t('components.sort.empty-hint')}</p>
  {:else}
    <div class="list">
      {#each local.criteria as criterion, index}
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <div class="sort-row"
          class:sort-row--disabled={!criterion.enabled}
          class:sort-row--drag-over={dragOverIndex === index && dragIndex !== null && dragIndex !== index}
          draggable="true"
          on:dragstart={(e) => onDragStart(index, e)}
          on:dragover={(e) => onDragOver(index, e)}
          on:drop={(e) => onDrop(index, e)}
          on:dragend={onDragEnd}
        >
          <button class="row-btn row-drag" type="button" aria-label={$i18n.t("common.drag-to-reorder")} tabindex="-1">
            <Icon name="grip-vertical" size="sm" />
          </button>
          <!-- Toggle -->
          <button
            class="row-btn row-toggle"
            class:row-toggle--off={!criterion.enabled}
            type="button"
            on:click|stopPropagation={() => updateCriteria(index, { enabled: !criterion.enabled })}
            title={criterion.enabled ? $i18n.t('common.disable') : $i18n.t('common.enable')}
          >
            <Icon name={criterion.enabled ? 'eye' : 'eye-off'} size="sm" />
          </button>

          <!-- Field chip -->
          <div class="chip chip--field">
            <OptionField value={criterion.field} options={fieldChoices} ariaLabel={$i18n.t('common.field-placeholder')}
              disabled={!criterion.enabled} on:change={(e) => updateCriteria(index, { field: e.detail })} />
          </div>

          <!-- Order chip -->
          <div class="chip chip--order">
            <OptionField value={criterion.order} options={orderChoices} displayLabel={getSortOrderLabel(criterion.order)}
              disabled={!criterion.enabled} on:change={(e) => setOrder(index, e.detail)} />
          </div>

          <span class="row-space"></span>

          <!-- Delete -->
          <button class="row-btn row-delete" type="button"
            on:click|stopPropagation={() => removeCriteria(index)} title={$i18n.t('common.delete')}>
            <Icon name="trash-2" size="sm" />
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <button class="add-btn" type="button" on:click={addCriteria}>
    <Icon name="plus" size="sm" />
    <span>{$i18n.t('common.add-criterion')}</span>
  </button>
</div>

<style>
  /* px→rem migration (REFACTOR-404). Hairline 1 borders kept verbatim;
     transition timings are durations, not sizes. */
  .section { display: flex; flex-direction: column; gap: 0.5rem; }
  .section-header { display: flex; align-items: center; justify-content: space-between; }
  .section-title { font-weight: 600; font-size: 0.875rem; }
  .empty-hint { color: var(--text-faint); font-size: 0.8125rem; margin: 0.25rem 0; }

  .list { display: flex; flex-direction: column; gap: 0.25rem; max-height: 20rem; overflow-y: auto; }

  .sort-row {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; min-width: 0;
    padding: 0.1875rem 0.125rem; min-height: 2rem; border-radius: 0.375rem;
    transition: background 100ms ease;
  }
  .sort-row:hover { background: var(--background-secondary); }
  .sort-row:hover .row-delete,
  .sort-row:hover .row-toggle { opacity: 1; }
  .sort-row--disabled { opacity: 0.5; }
  .sort-row--disabled .chip { pointer-events: none; }

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
  .row-space { flex: 1; }

  .row-btn {
    flex-shrink: 0; color: var(--text-faint); border-radius: 0.25rem;
    padding: 0.25rem; border: none; background: transparent;
    cursor: pointer; opacity: 0; transition: opacity 100ms ease, color 100ms ease;
  }
  .row-toggle:hover { color: var(--interactive-accent); }
  .row-toggle--off { opacity: 1; color: var(--text-faint); }
  .row-delete:hover { color: var(--text-error); background: rgba(var(--color-red-rgb, 255, 0, 0), 0.06); }
  .row-drag { cursor: grab; }
  .row-drag:active { cursor: grabbing; }
  .sort-row:hover .row-drag { opacity: 0.5; }
  .sort-row--drag-over {
    border-top: 0.125rem solid var(--interactive-accent);
    background: rgba(var(--interactive-accent-rgb, 72, 54, 153), 0.04);
  }

  .add-btn {
    display: flex; align-items: center; justify-content: center;
    gap: 0.375rem; padding: 0.375rem 0.75rem; border-radius: 0.375rem;
    border: var(--ppp-border-width) dashed var(--background-modifier-border);
    background: transparent; color: var(--text-muted);
    cursor: pointer; font-size: 0.8125rem; width: 100%;
    transition: border-color 100ms ease, color 100ms ease;
  }
  .add-btn:hover { border-color: var(--interactive-accent); color: var(--text-normal); }

  @media (pointer: coarse) {
    .sort-row { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr) auto; gap: 0.1875rem; min-height: var(--ppp-touch-target-min); }
    .row-drag, .row-space { display: none; }
    .chip { height: var(--ppp-touch-target-min); padding: 0 0.625rem; font-size: 0.875rem; }
    .row-btn { opacity: 1; width: var(--ppp-touch-target-min); height: var(--ppp-touch-target-min); padding: 0; }
    .add-btn { min-height: 2.5rem; font-size: 0.875rem; }
  }
</style>
