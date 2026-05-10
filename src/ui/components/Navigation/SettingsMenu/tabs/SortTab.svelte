<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "../../../../../lib/stores/i18n";
  import { makePopover, destroyPopover, getPopoverEl } from "../../../../components/popoverDropdown";
  import type {
    SortDefinition,
    SortingCriteria,
    SortOrder,
  } from "../../../../../settings/base/settings";
  import { getSortOrderLabel, getFieldIcon } from "./filterHelpers";

  export let value: SortDefinition | undefined;
  export let fields: Array<{ name: string; type: string }> = [];

  const dispatch = createEventDispatcher<{ update: SortDefinition }>();

  function toLocal(def?: SortDefinition): SortDefinition {
    return {
      criteria: def?.criteria ? def.criteria.map(c => ({...c})) : []
    };
  }

  let local: SortDefinition = toLocal(value);

  function updateCriteria(index: number, patch: Partial<SortingCriteria>) {
    const newCriteria = local.criteria.map((c, i) =>
      i === index ? { ...c, ...patch } : c
    );
    local = { ...local, criteria: newCriteria };
    dispatch("update", local);
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

  function getFieldType(fieldName: string): string {
    return fields.find(f => f.name === fieldName)?.type ?? 'string';
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

  // ═══════════════════════════════
  // IMPERATIVE DOM DROPDOWNS (shared via popoverDropdown.ts)
  // ═══════════════════════════════

  function openFieldPop(index: number, anchor: HTMLElement) {
    const crit = local.criteria[index]!;
    makePopover(anchor, fields.map(f => ({
      label: f.name,
      icon: getFieldIcon(f.type),
      selected: f.name === crit.field,
      handler: () => updateCriteria(index, { field: f.name }),
    })));
  }

  function openOrderPop(index: number, anchor: HTMLElement) {
    const crit = local.criteria[index]!;
    const orders: SortOrder[] = ['asc', 'desc'];
    makePopover(anchor, orders.map(o => ({
      label: getSortOrderLabel(o),
      selected: o === crit.order,
      handler: () => updateCriteria(index, { order: o }),
    })));
  }

  function handleWindowMousedown(e: MouseEvent) {
    const el = getPopoverEl();
    if (el && !el.contains(e.target as Node)) destroyPopover();
  }

  onDestroy(() => { destroyPopover(); });
</script>

<svelte:window on:mousedown={handleWindowMousedown} />

<div class="section">
  <div class="section-header">
    <span class="section-title">{$i18n.t('components.sort.label')}</span>
  </div>

  {#if local.criteria.length === 0}
    <p class="empty-hint">{$i18n.t('components.sort.empty-hint')}</p>
  {:else}
    <div class="list">
      {#each local.criteria as criterion, index}
        {@const fieldType = getFieldType(criterion.field)}
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
          <button class="row-btn row-drag" type="button" aria-label="Drag to reorder" tabindex="-1">
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
          <button class="chip chip--field" type="button"
            on:click={(e) => openFieldPop(index, e.currentTarget)}>
            <span class="chip-icon"><Icon name={getFieldIcon(fieldType)} size="sm" /></span>
            <span class="chip-label">{criterion.field || $i18n.t('common.field-placeholder')}</span>
            <span class="chip-chevron"><Icon name="chevron-down" size="xs" /></span>
          </button>

          <!-- Order chip -->
          <button class="chip chip--order" type="button"
            on:click={(e) => openOrderPop(index, e.currentTarget)}>
            <span class="chip-label">{getSortOrderLabel(criterion.order)}</span>
            <span class="chip-chevron"><Icon name="chevron-down" size="xs" /></span>
          </button>

          <span style="flex:1"></span>

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
    display: flex; align-items: center; gap: 0.25rem;
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
    border: 1px solid var(--background-modifier-border); border-radius: 0.375rem;
    background: var(--background-primary); color: var(--text-normal);
    cursor: pointer; font-size: 0.8125rem; font-family: var(--font-interface);
    white-space: nowrap; line-height: 1; flex-shrink: 0;
    transition: border-color 100ms ease, background 100ms ease;
  }
  .chip:hover { border-color: var(--interactive-accent); background: var(--background-primary-alt); }
  .chip-icon { display: inline-flex; align-items: center; color: var(--text-muted); flex-shrink: 0; }
  .chip-label { max-width: 6.25rem; overflow: hidden; text-overflow: ellipsis; }
  .chip--field .chip-label { font-weight: 500; }
  .chip-chevron { display: inline-flex; align-items: center; color: var(--text-faint); margin-left: 0.125rem; }

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
    border: 1px dashed var(--background-modifier-border);
    background: transparent; color: var(--text-muted);
    cursor: pointer; font-size: 0.8125rem; width: 100%;
    transition: border-color 100ms ease, color 100ms ease;
  }
  .add-btn:hover { border-color: var(--interactive-accent); color: var(--text-normal); }

  @media (pointer: coarse) {
    .sort-row { gap: 0.1875rem; min-height: 2.375rem; }
    .chip { height: 2rem; padding: 0 0.625rem; font-size: 0.875rem; }
    .row-btn { opacity: 1; padding: 0.375rem; }
    .add-btn { min-height: 2.5rem; font-size: 0.875rem; }
  }
</style>
