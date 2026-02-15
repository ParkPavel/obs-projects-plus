<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { setIcon } from "obsidian";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "../../../../../lib/stores/i18n";
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
      conditions: def?.conditions ? def.conditions.map(c => ({...c})) : []
    };
  }

  let local: FilterDefinition = toLocal(value);

  // ── Imperative dropdown state ──
  let popoverEl: HTMLDivElement | null = null;

  // ── CRUD ──
  function updateCondition(index: number, patch: Partial<FilterCondition>) {
    const newConditions = local.conditions.map((c, i) =>
      i === index ? { ...c, ...patch } : c
    );
    local = { ...local, conditions: newConditions };
    dispatch("update", local);
  }

  function addCondition() {
    const firstField = fields[0];
    const ops = firstField ? getOperatorsForField(firstField.type) : ['is' as FilterOperator];
    const newCondition: FilterCondition = {
      field: firstField?.name ?? "",
      operator: ops[0] ?? "is",
      value: "",
      enabled: true,
    };
    local = { ...local, conditions: [...local.conditions, newCondition] };
    dispatch("update", local);
  }

  function removeCondition(index: number) {
    local = { ...local, conditions: local.conditions.filter((_, i) => i !== index) };
    dispatch("update", local);
  }

  function toggleConjunction() {
    local = { ...local, conjunction: local.conjunction === "or" ? "and" : "or" };
    dispatch("update", local);
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
  // IMPERATIVE DOM DROPDOWNS
  // ═══════════════════════════════

  /* CSS classes are defined in styles.css under .ppp-pop-* prefix */



  function destroyPopover() {
    if (popoverEl?.parentNode) popoverEl.parentNode.removeChild(popoverEl);
    popoverEl = null;
  }

  function positionPop(el: HTMLElement, anchor: HTMLElement, maxH: number) {
    const r = anchor.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    el.style.top = (below >= maxH || below > r.top - 8)
      ? `${r.bottom + 2}px`
      : `${r.top - maxH - 2}px`;
    el.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - 260))}px`;
  }

  function makePopover(anchor: HTMLElement, items: { label: string; icon?: string; selected?: boolean; handler: () => void }[]) {
    destroyPopover();
    const box = activeDocument.createElement('div');
    box.addClass('ppp-pop-box');
    box.setAttribute('data-settings-dropdown', '');
    const maxH = Math.min(items.length * 34 + 8, 280);
    box.style.maxHeight = `${maxH}px`;
    positionPop(box, anchor, maxH);

    const list = activeDocument.createElement('div');
    list.addClass('ppp-pop-list');
    list.style.maxHeight = `${maxH - 8}px`;

    for (const it of items) {
      const btn = activeDocument.createElement('button');
      btn.addClass('ppp-pop-item');
      if (it.selected) btn.addClass('ppp-pop-item--selected');
      btn.type = 'button';
      btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--background-modifier-hover)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
      btn.addEventListener('mousedown', (e) => { e.preventDefault(); it.handler(); destroyPopover(); });

      if (it.icon) {
        const ic = activeDocument.createElement('span');
        ic.addClass('ppp-pop-muted');
        setIcon(ic, it.icon ?? 'file-text');
        btn.appendChild(ic);
      }

      const lbl = activeDocument.createElement('span');
      lbl.addClass('ppp-popover-label');
      lbl.textContent = it.label;
      btn.appendChild(lbl);

      if (it.selected) {
        const chk = activeDocument.createElement('span');
        chk.addClass('ppp-pop-muted');
        chk.style.color = 'var(--interactive-accent)';
        setIcon(chk, 'check');
        btn.appendChild(chk);
      }

      list.appendChild(btn);
    }

    box.appendChild(list);
    activeDocument.body.appendChild(box);
    popoverEl = box;
  }

  function openFieldPop(index: number, anchor: HTMLElement) {
    const cond = local.conditions[index]!;
    makePopover(anchor, fields.map(f => ({
      label: f.name,
      icon: getFieldIcon(f.type),
      selected: f.name === cond.field,
      handler: () => {
        const ops = getOperatorsForField(f.type);
        const op = ops.includes(cond.operator) ? cond.operator : ops[0] ?? 'is';
        updateCondition(index, { field: f.name, operator: op as FilterOperator, value: '' });
      },
    })));
  }

  function openOpPop(index: number, anchor: HTMLElement) {
    const cond = local.conditions[index]!;
    const ops = getOperatorsForField(getFieldType(cond.field));
    makePopover(anchor, ops.map(op => ({
      label: getOperatorLabel(op),
      selected: op === cond.operator,
      handler: () => updateCondition(index, { operator: op, value: operatorNeedsValue(op) ? (cond.value ?? '') : '' }),
    })));
  }

  function openValPop(index: number, anchor: HTMLElement) {
    const cond = local.conditions[index]!;
    const all = getValueSuggestions(cond.field);
    const q = String(cond.value ?? '').toLowerCase().trim();
    const filtered = q ? all.filter(s => s.toLowerCase().includes(q)) : all;
    if (filtered.length === 0) return;
    makePopover(anchor, filtered.map(v => ({
      label: v,
      selected: v === String(cond.value ?? ''),
      handler: () => updateCondition(index, { value: v }),
    })));
  }

  function handleWindowMousedown(e: MouseEvent) {
    if (popoverEl && !popoverEl.contains(e.target as Node)) destroyPopover();
  }

  onDestroy(() => { destroyPopover(); });
</script>

<svelte:window on:mousedown={handleWindowMousedown} />

<div class="section">
  <div class="section-header">
    <span class="section-title">{$i18n.t('components.filter.label')}</span>
    {#if local.conditions.length > 0}
      <button class="conj-chip" on:click={toggleConjunction} type="button">
        {local.conjunction === "or" ? $i18n.t('components.filter.conjunction-or') : $i18n.t('components.filter.conjunction-and')}
      </button>
    {/if}
  </div>

  {#if local.conditions.length === 0}
    <p class="empty-hint">{$i18n.t('components.filter.empty-hint')}</p>
  {:else}
    <div class="list">
      {#each local.conditions as condition, index}
        {@const fieldType = getFieldType(condition.field)}
        {@const needsVal = operatorNeedsValue(condition.operator)}
        <div class="filter-row" class:filter-row--disabled={!condition.enabled}>
          <!-- Toggle -->
          <button
            class="row-btn row-toggle"
            class:row-toggle--off={!condition.enabled}
            type="button"
            on:click|stopPropagation={() => updateCondition(index, { enabled: !condition.enabled })}
            title={condition.enabled ? 'Отключить' : 'Включить'}
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
                on:input={(e) => updateCondition(index, { value: inputVal(e) })}
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
    </div>
  {/if}

  <button class="add-btn" type="button" on:click={addCondition}>
    <Icon name="plus" size="sm" />
    <span>{$i18n.t('components.filter.add-condition')}</span>
  </button>
</div>

<style>
  .section { display: flex; flex-direction: column; gap: 8px; }
  .section-header { display: flex; align-items: center; justify-content: space-between; }
  .section-title { font-weight: 600; font-size: 14px; }
  .empty-hint { color: var(--text-faint); font-size: 13px; margin: 4px 0; }

  .conj-chip {
    padding: 2px 10px; border-radius: 999px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary); color: var(--text-normal);
    cursor: pointer; font-size: 12px; font-weight: 600;
    line-height: 1.4; transition: border-color 100ms ease;
  }
  .conj-chip:hover { border-color: var(--interactive-accent); }

  .list { display: flex; flex-direction: column; gap: 4px; max-height: 20rem; overflow-y: auto; }

  .filter-row {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 2px; min-height: 32px; border-radius: 6px;
    transition: background 100ms ease;
  }
  .filter-row:hover { background: var(--background-secondary); }
  .filter-row:hover .row-delete,
  .filter-row:hover .row-toggle { opacity: 1; }
  .filter-row--disabled { opacity: 0.5; }
  .filter-row--disabled .chip,
  .filter-row--disabled .value-input { pointer-events: none; }

  .chip {
    display: inline-flex; align-items: center; gap: 4px;
    height: 26px; padding: 0 8px;
    border: 1px solid var(--background-modifier-border); border-radius: 6px;
    background: var(--background-primary); color: var(--text-normal);
    cursor: pointer; font-size: 13px; font-family: var(--font-interface);
    white-space: nowrap; line-height: 1; flex-shrink: 0;
    transition: border-color 100ms ease, background 100ms ease;
  }
  .chip:hover { border-color: var(--interactive-accent); background: var(--background-primary-alt); }
  .chip-icon { display: inline-flex; align-items: center; color: var(--text-muted); flex-shrink: 0; }
  .chip-label { max-width: 100px; overflow: hidden; text-overflow: ellipsis; }
  .chip--field .chip-label { font-weight: 500; }
  .chip-chevron { display: inline-flex; align-items: center; color: var(--text-faint); margin-left: 2px; }

  .value-area { flex: 1; min-width: 60px; }
  .value-input {
    width: 100%; height: 26px;
    border: 1px solid var(--background-modifier-border); border-radius: 6px;
    background: var(--background-primary); color: var(--text-normal);
    font-size: 13px; font-family: var(--font-interface);
    padding: 0 8px; outline: none; box-sizing: border-box;
    transition: border-color 100ms ease;
  }
  .value-input::placeholder { color: var(--text-faint); }
  .value-input:focus { border-color: var(--interactive-accent); }
  .no-value { color: var(--text-faint); font-size: 12px; font-style: italic; padding: 0 8px; }

  .row-btn {
    flex-shrink: 0; color: var(--text-faint); border-radius: 4px;
    padding: 4px; border: none; background: transparent;
    cursor: pointer; opacity: 0; transition: opacity 100ms ease, color 100ms ease;
  }
  .row-toggle:hover { color: var(--interactive-accent); }
  .row-toggle--off { opacity: 1; color: var(--text-faint); }
  .row-delete:hover { color: var(--text-error); background: rgba(var(--color-red-rgb, 255, 0, 0), 0.06); }

  .add-btn {
    display: flex; align-items: center; justify-content: center;
    gap: 6px; padding: 6px 12px; border-radius: 6px;
    border: 1px dashed var(--background-modifier-border);
    background: transparent; color: var(--text-muted);
    cursor: pointer; font-size: 13px; width: 100%;
    transition: border-color 100ms ease, color 100ms ease;
  }
  .add-btn:hover { border-color: var(--interactive-accent); color: var(--text-normal); }

  @media (pointer: coarse) {
    .filter-row { gap: 3px; min-height: 38px; }
    .chip { height: 32px; padding: 0 10px; font-size: 14px; }
    .value-input { height: 32px; font-size: 14px; }
    .row-btn { opacity: 1; padding: 6px; }
    .add-btn { min-height: 40px; font-size: 14px; }
  }
</style>
