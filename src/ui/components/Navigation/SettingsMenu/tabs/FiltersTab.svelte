<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "../../../../../lib/stores/i18n";
  import { makePopover, destroyPopover, getPopoverEl } from "../../../../components/popoverDropdown";
  import type {
    FilterCondition,
    FilterDefinition,
    FilterOperator,
  } from "../../../../../settings/base/settings";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { getOperatorsForField, operatorNeedsValue, getOperatorLabel, getFieldIcon } from "./filterHelpers";

  function inputVal(e: Event): string { return (e.target as HTMLInputElement)?.value ?? ''; }

  export let value: FilterDefinition | undefined;
  export let fields: Array<{ name: string; type: string }> = [];
  export let records: DataRecord[] = [];

  const dispatch = createEventDispatcher<{ update: FilterDefinition }>();

  function toLocal(def?: FilterDefinition): FilterDefinition {
    return {
      conjunction: def?.conjunction ?? "and",
      conditions: def?.conditions ? def.conditions.map(c => ({...c})) : [],
      groups: def?.groups ? def.groups.map(g => toLocal(g)) : [],
    };
  }

  let local: FilterDefinition = toLocal(value);

  $: hasContent = local.conditions.length > 0 || (local.groups?.length ?? 0) > 0;

  // ── Helpers for path-based updates (groups can be nested) ──
  function updateRoot(newLocal: FilterDefinition) {
    local = newLocal;
    dispatch("update", local);
  }

  function updateGroupAtPath(root: FilterDefinition, path: number[], patch: Partial<FilterDefinition>): FilterDefinition {
    if (path.length === 0) return { ...root, ...patch };
    const head = path[0]!;
    const rest = path.slice(1);
    const groups = [...(root.groups ?? [])];
    groups[head] = updateGroupAtPath(groups[head]!, rest, patch);
    return { ...root, groups };
  }

  function removeGroupAtPath(root: FilterDefinition, path: number[]): FilterDefinition {
    if (path.length === 1) {
      return { ...root, groups: (root.groups ?? []).filter((_, i) => i !== path[0]) };
    }
    const head = path[0]!;
    const rest = path.slice(1);
    const groups = [...(root.groups ?? [])];
    groups[head] = removeGroupAtPath(groups[head]!, rest);
    return { ...root, groups };
  }

  // ── Condition CRUD (root level) ──
  function updateCondition(index: number, patch: Partial<FilterCondition>, groupPath: number[] = []) {
    if (groupPath.length === 0) {
      const newConditions = local.conditions.map((c, i) =>
        i === index ? { ...c, ...patch } : c
      );
      updateRoot({ ...local, conditions: newConditions });
    } else {
      const group = getGroupAtPath(local, groupPath);
      const newConditions = group.conditions.map((c, i) =>
        i === index ? { ...c, ...patch } : c
      );
      updateRoot(updateGroupAtPath(local, groupPath, { conditions: newConditions }));
    }
  }

  function addCondition(groupPath: number[] = []) {
    const firstField = fields[0];
    const ops = firstField ? getOperatorsForField(firstField.type) : ['is' as FilterOperator];
    const newCond: FilterCondition = {
      field: firstField?.name ?? "",
      operator: ops[0] ?? "is",
      value: "",
      enabled: true,
    };
    if (groupPath.length === 0) {
      updateRoot({ ...local, conditions: [...local.conditions, newCond] });
    } else {
      const group = getGroupAtPath(local, groupPath);
      updateRoot(updateGroupAtPath(local, groupPath, { conditions: [...group.conditions, newCond] }));
    }
  }

  function removeCondition(index: number, groupPath: number[] = []) {
    if (groupPath.length === 0) {
      updateRoot({ ...local, conditions: local.conditions.filter((_, i) => i !== index) });
    } else {
      const group = getGroupAtPath(local, groupPath);
      updateRoot(updateGroupAtPath(local, groupPath, { conditions: group.conditions.filter((_, i) => i !== index) }));
    }
  }

  function addGroup(parentPath: number[] = []) {
    const newGroup: FilterDefinition = { conjunction: "and", conditions: [], groups: [] };
    if (parentPath.length === 0) {
      updateRoot({ ...local, groups: [...(local.groups ?? []), newGroup] });
    } else {
      const parent = getGroupAtPath(local, parentPath);
      updateRoot(updateGroupAtPath(local, parentPath, { groups: [...(parent.groups ?? []), newGroup] }));
    }
  }

  function removeGroup(path: number[]) {
    updateRoot(removeGroupAtPath(local, path));
  }

  function getGroupAtPath(root: FilterDefinition, path: number[]): FilterDefinition {
    let node: FilterDefinition = root;
    for (const idx of path) {
      const next = (node.groups ?? [])[idx];
      if (!next) return node;
      node = next;
    }
    return node;
  }

  function getFieldType(fieldName: string): string {
    return fields.find(f => f.name === fieldName)?.type ?? 'string';
  }

  // ── Value suggestions ──
  function getValueSuggestions(fieldName: string): string[] {
    if (!fieldName || records.length === 0) return [];
    const vals = new Set<string>();
    for (const record of records) {
      const raw = record.values[fieldName];
      if (raw == null) continue;
      if (Array.isArray(raw)) {
        raw.forEach(v => { const s = String(v).trim(); if (s) vals.add(s); });
      } else {
        let s = String(raw);
        const m = s.match(/^\[\[([^\]]+)\]\]$/);
        if (m?.[1]) { const inner = m[1]; const pipe = inner.indexOf('|'); s = pipe >= 0 ? inner.substring(pipe + 1) : inner; }
        s = s.trim();
        if (s && s !== 'undefined' && s !== 'null') vals.add(s);
      }
    }
    return [...vals].sort();
  }

  // ═══════════════════════════════
  // IMPERATIVE DOM DROPDOWNS (shared via popoverDropdown.ts)
  // ═══════════════════════════════

  function openFieldPop(index: number, anchor: HTMLElement, groupPath: number[] = []) {
    const group = groupPath.length === 0 ? local : getGroupAtPath(local, groupPath);
    const cond = group.conditions[index]!;
    makePopover(anchor, fields.map(f => ({
      label: f.name,
      icon: getFieldIcon(f.type),
      selected: f.name === cond.field,
      handler: () => {
        const ops = getOperatorsForField(f.type);
        const op = ops.includes(cond.operator) ? cond.operator : ops[0] ?? 'is';
        updateCondition(index, { field: f.name, operator: op as FilterOperator, value: '' }, groupPath);
      },
    })), true);
  }

  function openOpPop(index: number, anchor: HTMLElement, groupPath: number[] = []) {
    const group = groupPath.length === 0 ? local : getGroupAtPath(local, groupPath);
    const cond = group.conditions[index]!;
    const ops = getOperatorsForField(getFieldType(cond.field));
    makePopover(anchor, ops.map(op => ({
      label: getOperatorLabel(op),
      selected: op === cond.operator,
      handler: () => updateCondition(index, { operator: op, value: operatorNeedsValue(op) ? (cond.value ?? '') : '' }, groupPath),
    })));
  }

  function openValPop(index: number, anchor: HTMLElement, groupPath: number[] = []) {
    const group = groupPath.length === 0 ? local : getGroupAtPath(local, groupPath);
    const cond = group.conditions[index]!;
    const all = getValueSuggestions(cond.field);
    const q = String(cond.value ?? '').toLowerCase().trim();
    const filtered = q ? all.filter(s => s.toLowerCase().includes(q)) : all;
    if (filtered.length === 0) return;
    makePopover(anchor, filtered.map(v => ({
      label: v,
      selected: v === String(cond.value ?? ''),
      handler: () => updateCondition(index, { value: v }, groupPath),
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
  <!-- ═══ Conjunction header ═══ -->
  <div class="section-header">
    <span class="section-title">{$i18n.t('components.filter.label')}</span>
    {#if hasContent}
      <select
        class="conj-select"
        value={local.conjunction}
        on:change={(e) => {
          const val = e.currentTarget.value;
          updateRoot({ ...local, conjunction: val === 'or' ? 'or' : 'and' });
        }}
      >
        <option value="and">{$i18n.t('components.filter.match-all')}</option>
        <option value="or">{$i18n.t('components.filter.match-any')}</option>
      </select>
    {/if}
  </div>

  {#if !hasContent}
    <p class="empty-hint">{$i18n.t('components.filter.empty-hint')}</p>
  {:else}
    <div class="list">
      <!-- Root conditions -->
      {#each local.conditions as condition, index}
        {@const fieldType = getFieldType(condition.field)}
        {@const needsVal = operatorNeedsValue(condition.operator)}
        <div class="filter-row" class:filter-row--disabled={!condition.enabled}>
          <!-- Row prefix: "Где" for first, "и"/"или" for rest -->
          <span class="row-prefix">
            {#if index === 0 && (local.groups?.length ?? 0) === 0}
              {$i18n.t('components.filter.where')}
            {:else if index === 0}
              {$i18n.t('components.filter.where')}
            {:else}
              {local.conjunction === 'or' ? $i18n.t('components.filter.or') : $i18n.t('components.filter.and')}
            {/if}
          </span>

          <!-- Toggle -->
          <button
            class="row-btn row-toggle"
            class:row-toggle--off={!condition.enabled}
            type="button"
            on:click|stopPropagation={() => updateCondition(index, { enabled: !condition.enabled })}
          >
            <Icon name={condition.enabled ? 'eye' : 'eye-off'} size="sm" />
          </button>

          <!-- Field chip -->
          <button class="chip chip--field" type="button"
            on:click={(e) => openFieldPop(index, e.currentTarget)}>
            <span class="chip-icon"><Icon name={getFieldIcon(fieldType)} size="sm" /></span>
            <span class="chip-label">{condition.field || $i18n.t('common.field')}</span>
            <span class="chip-chevron"><Icon name="chevron-down" size="xs" /></span>
          </button>

          <!-- Operator chip -->
          <button class="chip chip--op" type="button"
            on:click={(e) => openOpPop(index, e.currentTarget)}>
            <span class="chip-label">{getOperatorLabel(condition.operator)}</span>
            <span class="chip-chevron"><Icon name="chevron-down" size="xs" /></span>
          </button>

          <!-- Value -->
          <div class="value-area">
            {#if needsVal}
              <input class="value-input" type="text"
                value={condition.value ?? ''}
                on:input={(e) => { updateCondition(index, { value: inputVal(e) }); openValPop(index, e.currentTarget); }}
                on:focus={(e) => openValPop(index, e.currentTarget)}
                on:blur={() => setTimeout(destroyPopover, 150)}
                placeholder={$i18n.t('common.value-placeholder')} />
            {:else}
              <span class="no-value">—</span>
            {/if}
          </div>

          <!-- Delete -->
          <button class="row-btn row-delete" type="button"
            on:click|stopPropagation={() => removeCondition(index)} title={$i18n.t('common.delete')}>
            <Icon name="trash-2" size="sm" />
          </button>
        </div>
      {/each}

      <!-- Nested groups -->
      {#each (local.groups ?? []) as group, gIndex}
        {@const totalItemsBefore = local.conditions.length + gIndex}
        <div class="filter-group-wrapper">
          <!-- Prefix before group card -->
          <span class="row-prefix">
            {#if totalItemsBefore === 0}
              {$i18n.t('components.filter.where')}
            {:else}
              {local.conjunction === 'or' ? $i18n.t('components.filter.or') : $i18n.t('components.filter.and')}
            {/if}
          </span>

          <div class="filter-group">
            <div class="filter-group-header">
              <select
                class="conj-select conj-select--group"
                value={group.conjunction}
                on:change={(e) => {
                  const val = e.currentTarget.value;
                  updateRoot(updateGroupAtPath(local, [gIndex], { conjunction: val === 'or' ? 'or' : 'and' }));
                }}
              >
                <option value="and">{$i18n.t('components.filter.match-all')}</option>
                <option value="or">{$i18n.t('components.filter.match-any')}</option>
              </select>
              <button class="row-btn row-delete" style="opacity:1" type="button"
                on:click|stopPropagation={() => removeGroup([gIndex])} title={$i18n.t('common.delete')}>
                <Icon name="x" size="sm" />
              </button>
            </div>

            {#each group.conditions as gCond, cIdx}
              {@const gFieldType = getFieldType(gCond.field)}
              {@const gNeedsVal = operatorNeedsValue(gCond.operator)}
              <div class="filter-row" class:filter-row--disabled={!gCond.enabled}>
                <!-- Group row prefix -->
                <span class="row-prefix">
                  {#if cIdx === 0}
                    {$i18n.t('components.filter.where')}
                  {:else}
                    {group.conjunction === 'or' ? $i18n.t('components.filter.or') : $i18n.t('components.filter.and')}
                  {/if}
                </span>

                <button
                  class="row-btn row-toggle"
                  class:row-toggle--off={!gCond.enabled}
                  type="button"
                  on:click|stopPropagation={() => updateCondition(cIdx, { enabled: !gCond.enabled }, [gIndex])}
                >
                  <Icon name={gCond.enabled ? 'eye' : 'eye-off'} size="sm" />
                </button>

                <button class="chip chip--field" type="button"
                  on:click={(e) => openFieldPop(cIdx, e.currentTarget, [gIndex])}>
                  <span class="chip-icon"><Icon name={getFieldIcon(gFieldType)} size="sm" /></span>
                  <span class="chip-label">{gCond.field || $i18n.t('common.field')}</span>
                  <span class="chip-chevron"><Icon name="chevron-down" size="xs" /></span>
                </button>

                <button class="chip chip--op" type="button"
                  on:click={(e) => openOpPop(cIdx, e.currentTarget, [gIndex])}>
                  <span class="chip-label">{getOperatorLabel(gCond.operator)}</span>
                  <span class="chip-chevron"><Icon name="chevron-down" size="xs" /></span>
                </button>

                <div class="value-area">
                  {#if gNeedsVal}
                    <input class="value-input" type="text"
                      value={gCond.value ?? ''}
                      on:input={(e) => { updateCondition(cIdx, { value: inputVal(e) }, [gIndex]); openValPop(cIdx, e.currentTarget, [gIndex]); }}
                      on:focus={(e) => openValPop(cIdx, e.currentTarget, [gIndex])}
                      on:blur={() => setTimeout(destroyPopover, 150)}
                      placeholder={$i18n.t('common.value-placeholder')} />
                  {:else}
                    <span class="no-value">—</span>
                  {/if}
                </div>

                <button class="row-btn row-delete" type="button"
                  on:click|stopPropagation={() => removeCondition(cIdx, [gIndex])} title={$i18n.t('common.delete')}>
                  <Icon name="trash-2" size="sm" />
                </button>
              </div>
            {/each}

            <button class="add-btn add-btn--nested" type="button" on:click={() => addCondition([gIndex])}>
              <Icon name="plus" size="xs" />
              <span>{$i18n.t('components.filter.add-condition')}</span>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- ═══ Add buttons ═══ -->
  <div class="add-actions">
    <button class="add-btn" type="button" on:click={() => addCondition()}>
      <Icon name="plus" size="sm" />
      <span>{$i18n.t('components.filter.add-condition')}</span>
    </button>
    <button class="add-btn" type="button" on:click={() => addGroup()}>
      <Icon name="plus" size="sm" />
      <span>{$i18n.t('components.filter.add-group')}</span>
    </button>
  </div>
</div>

<style>
  .section { display: flex; flex-direction: column; gap: 0.5rem; }
  .section-header { display: flex; align-items: center; justify-content: space-between; }
  .section-title { font-weight: 600; font-size: 0.875rem; }
  .empty-hint { color: var(--text-faint); font-size: 0.8125rem; margin: 0.25rem 0; }

  /* ── Conjunction select dropdown (like agenda) ── */
  .conj-select {
    padding: 0.1875rem 0.5rem; border-radius: 0.375rem;
    border: 1px solid var(--interactive-accent);
    background: rgba(var(--interactive-accent-rgb, 72, 54, 153), 0.08);
    color: var(--interactive-accent);
    cursor: pointer; font-size: 0.75rem; font-weight: 600;
    font-family: var(--font-interface);
    line-height: 1.4; outline: none;
    transition: border-color 100ms ease, background 100ms ease;
    -webkit-appearance: none; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%237c3aed' fill='none' stroke-width='1.5'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.375rem center;
    padding-right: 1.25rem;
  }
  .conj-select:hover {
    border-color: var(--interactive-accent);
    background-color: rgba(var(--interactive-accent-rgb, 72, 54, 153), 0.15);
  }
  .conj-select:focus {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 0.125rem rgba(var(--interactive-accent-rgb, 72, 54, 153), 0.2);
  }
  .conj-select--group { font-size: 0.6875rem; padding: 0.125rem 0.375rem; padding-right: 1.125rem; }

  /* ── Row prefix labels (Где / и / или) ── */
  .row-prefix {
    min-width: 2rem; flex-shrink: 0;
    font-size: 0.75rem; color: var(--text-muted);
    text-align: right; padding-right: 0.25rem;
    user-select: none;
  }

  .list { display: flex; flex-direction: column; gap: 0.25rem; max-height: 20rem; overflow-y: auto; }

  .filter-row {
    display: flex; align-items: center; gap: 0.25rem;
    padding: 0.1875rem 0.125rem; min-height: 2rem; border-radius: 0.375rem;
    transition: background 100ms ease;
  }
  .filter-row:hover { background: var(--background-secondary); }
  .filter-row:hover .row-delete,
  .filter-row:hover .row-toggle { opacity: 1; }
  .filter-row--disabled { opacity: 0.5; }
  .filter-row--disabled .chip,
  .filter-row--disabled .value-input { pointer-events: none; }

  /* ── Group card ── */
  .filter-group-wrapper {
    display: flex; align-items: flex-start; gap: 0.25rem;
    margin-top: 0.125rem;
  }
  .filter-group-wrapper > .row-prefix {
    padding-top: 0.5rem;
  }
  .filter-group {
    display: flex; flex-direction: column; gap: 0.25rem;
    padding: 0.375rem 0.5rem; flex: 1;
    border: 1px solid var(--background-modifier-border);
    border-radius: 0.5rem;
    background: var(--background-secondary);
  }
  .filter-group-header {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--background-modifier-border-hover);
    margin-bottom: 0.125rem;
  }

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

  .value-area { flex: 1; min-width: 3.75rem; }
  .value-input {
    width: 100%; height: 1.625rem;
    border: 1px solid var(--background-modifier-border); border-radius: 0.375rem;
    background: var(--background-primary); color: var(--text-normal);
    font-size: 0.8125rem; font-family: var(--font-interface);
    padding: 0 0.5rem; outline: none; box-sizing: border-box;
    transition: border-color 100ms ease;
  }
  .value-input::placeholder { color: var(--text-faint); }
  .value-input:focus { border-color: var(--interactive-accent); }
  .no-value { color: var(--text-faint); font-size: 0.75rem; font-style: italic; padding: 0 0.5rem; }

  .row-btn {
    flex-shrink: 0; color: var(--text-faint); border-radius: 0.25rem;
    padding: 0.25rem; border: none; background: transparent;
    cursor: pointer; opacity: 0; transition: opacity 100ms ease, color 100ms ease, background 100ms ease;
  }
  .row-toggle { color: var(--interactive-accent); opacity: 0.8; }
  .row-toggle:hover { color: var(--interactive-accent); opacity: 1; background: rgba(var(--interactive-accent-rgb, 72, 54, 153), 0.08); }
  .row-toggle--off { opacity: 1; color: var(--text-faint); }
  .row-delete:hover { color: var(--text-error); background: rgba(var(--color-red-rgb, 255, 0, 0), 0.06); }

  .add-actions { display: flex; gap: 0.375rem; }

  .add-btn {
    display: flex; align-items: center; justify-content: center;
    gap: 0.375rem; padding: 0.375rem 0.75rem; border-radius: 0.375rem;
    border: 1px dashed var(--background-modifier-border);
    background: transparent; color: var(--text-muted);
    cursor: pointer; font-size: 0.8125rem; flex: 1;
    transition: border-color 100ms ease, color 100ms ease;
  }
  .add-btn:hover { border-color: var(--interactive-accent); color: var(--text-normal); }
  .add-btn--nested {
    font-size: 0.75rem; padding: 0.25rem 0.5rem;
    border-style: dashed; margin-top: 0.125rem;
  }

  @media (pointer: coarse) {
    .filter-row { gap: 0.1875rem; min-height: 2.375rem; }
    .chip { height: 2rem; padding: 0 0.625rem; font-size: 0.875rem; }
    .value-input { height: 2rem; font-size: 0.875rem; }
    .row-btn { opacity: 1; padding: 0.375rem; }
    .add-btn { min-height: 2.5rem; font-size: 0.875rem; }
    .row-prefix { min-width: 2.25rem; font-size: 0.8125rem; }
    .conj-select { font-size: 0.8125rem; padding: 0.25rem 0.625rem; padding-right: 1.5rem; }
  }

  /* v3.2.1: Mobile keyboard — reverse column so list scrolls upward.
     Shared by FiltersTab, SortTab, ColorFiltersTab (all use .ppp-pop-box).
     Applied via JS classList.add(), so :global() required.
     Compiled into main.css → auto-merged into styles.css by mergeCSS(). */
  :global(.ppp-pop-box--mobile-kbd) {
    display: flex;
    flex-direction: column-reverse;
  }
  :global(.ppp-pop-box--mobile-kbd) :global(.ppp-pop-search) {
    border-bottom: none;
    border-top: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
  }
</style>
