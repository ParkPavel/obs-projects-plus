<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { Icon } from "obsidian-svelte";
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

  // ── Imperative dropdown ──
  let popoverEl: HTMLDivElement | null = null;

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

  // ═══════════════════════════════
  // IMPERATIVE DOM DROPDOWNS
  // ═══════════════════════════════

  const POP = {
    box: 'position:fixed;z-index:10001;min-width:180px;max-width:320px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.25);overflow:hidden;',
    list: 'overflow-y:auto;padding:4px 0;',
    item: 'display:flex;align-items:center;gap:8px;width:100%;padding:6px 12px;border:none;background:transparent;color:var(--text-normal);cursor:pointer;font-size:13px;font-family:var(--font-interface);text-align:left;',
    sel: 'font-weight:600;color:var(--interactive-accent);',
    muted: 'display:inline-flex;align-items:center;color:var(--text-muted);flex-shrink:0;',
  };

  const CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  const ICON_SVG: Record<string, string> = {
    'type':         '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    'hash':         '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
    'check-square': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    'calendar':     '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    'list':         '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    'file-text':    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  };

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
    const box = document.createElement('div');
    box.setAttribute('style', POP.box);
    box.setAttribute('data-settings-dropdown', '');
    const maxH = Math.min(items.length * 34 + 8, 280);
    box.style.maxHeight = `${maxH}px`;
    positionPop(box, anchor, maxH);

    const list = document.createElement('div');
    list.setAttribute('style', POP.list);
    list.style.maxHeight = `${maxH - 8}px`;

    for (const it of items) {
      const btn = document.createElement('button');
      let s = POP.item;
      if (it.selected) s += POP.sel;
      btn.setAttribute('style', s);
      btn.type = 'button';
      btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--background-modifier-hover)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
      btn.addEventListener('mousedown', (e) => { e.preventDefault(); it.handler(); destroyPopover(); });

      if (it.icon) {
        const ic = document.createElement('span');
        ic.setAttribute('style', POP.muted);
        // /skip innerHTML: static SVG constants only, no user input — safe from XSS
        ic.innerHTML = ICON_SVG[it.icon] ?? ICON_SVG['file-text']!;
        btn.appendChild(ic);
      }

      const lbl = document.createElement('span');
      lbl.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      lbl.textContent = it.label;
      btn.appendChild(lbl);

      if (it.selected) {
        const chk = document.createElement('span');
        chk.setAttribute('style', POP.muted);
        chk.style.color = 'var(--interactive-accent)';
        // /skip innerHTML: static SVG constant, no user input
        chk.innerHTML = CHECK_SVG;
        btn.appendChild(chk);
      }

      list.appendChild(btn);
    }

    box.appendChild(list);
    document.body.appendChild(box);
    popoverEl = box;
  }

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
    if (popoverEl && !popoverEl.contains(e.target as Node)) destroyPopover();
  }

  onDestroy(() => { destroyPopover(); });
</script>

<svelte:window on:mousedown={handleWindowMousedown} />

<div class="section">
  <div class="section-header">
    <span class="section-title">Сортировка</span>
  </div>

  {#if local.criteria.length === 0}
    <p class="empty-hint">Критерии не заданы</p>
  {:else}
    <div class="list">
      {#each local.criteria as criterion, index}
        {@const fieldType = getFieldType(criterion.field)}
        <div class="sort-row" class:sort-row--disabled={!criterion.enabled}>
          <!-- Toggle -->
          <button
            class="row-btn row-toggle"
            class:row-toggle--off={!criterion.enabled}
            type="button"
            on:click|stopPropagation={() => updateCriteria(index, { enabled: !criterion.enabled })}
            title={criterion.enabled ? 'Отключить' : 'Включить'}
          >
            <Icon name={criterion.enabled ? 'eye' : 'eye-off'} size="sm" />
          </button>

          <!-- Field chip -->
          <button class="chip chip--field" type="button"
            on:click={(e) => openFieldPop(index, e.currentTarget)}>
            <span class="chip-icon"><Icon name={getFieldIcon(fieldType)} size="sm" /></span>
            <span class="chip-label">{criterion.field || 'Поле'}</span>
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
            on:click|stopPropagation={() => removeCriteria(index)} title="Удалить">
            <Icon name="trash-2" size="sm" />
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <button class="add-btn" type="button" on:click={addCriteria}>
    <Icon name="plus" size="sm" />
    <span>Добавить критерий</span>
  </button>
</div>

<style>
  .section { display: flex; flex-direction: column; gap: 8px; }
  .section-header { display: flex; align-items: center; justify-content: space-between; }
  .section-title { font-weight: 600; font-size: 14px; }
  .empty-hint { color: var(--text-faint); font-size: 13px; margin: 4px 0; }

  .list { display: flex; flex-direction: column; gap: 4px; max-height: 20rem; overflow-y: auto; }

  .sort-row {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 2px; min-height: 32px; border-radius: 6px;
    transition: background 100ms ease;
  }
  .sort-row:hover { background: var(--background-secondary); }
  .sort-row:hover .row-delete,
  .sort-row:hover .row-toggle { opacity: 1; }
  .sort-row--disabled { opacity: 0.5; }
  .sort-row--disabled .chip { pointer-events: none; }

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

  .row-btn {
    flex-shrink: 0; color: var(--text-faint); border-radius: 4px;
    padding: 4px; border: none; background: transparent;
    cursor: pointer; opacity: 0; transition: opacity 100ms ease, color 100ms ease;
  }
  .row-toggle:hover { color: var(--interactive-accent); }
  .row-toggle--off { opacity: 1; color: var(--text-faint); }
  .row-delete:hover { color: var(--text-error); background: rgba(255,0,0,0.06); }

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
    .sort-row { gap: 3px; min-height: 38px; }
    .chip { height: 32px; padding: 0 10px; font-size: 14px; }
    .row-btn { opacity: 1; padding: 6px; }
    .add-btn { min-height: 40px; font-size: 14px; }
  }
</style>
