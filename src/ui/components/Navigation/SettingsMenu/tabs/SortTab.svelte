<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { setIcon } from "obsidian";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "../../../../../lib/stores/i18n";
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

  /* CSS classes are defined in styles.css under .ppp-pop-* prefix */

  function destroyPopover() {
    if (popoverEl) {
      if ((popoverEl as any).__vvCleanup) (popoverEl as any).__vvCleanup();
      popoverEl.parentNode?.removeChild(popoverEl);
    }
    popoverEl = null;
  }

  function positionPop(el: HTMLElement, anchor: HTMLElement, maxHRem: number) {
    const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const toRem = (v: number) => `${(v / fs).toFixed(2)}rem`;
    const isTouch = window.matchMedia('(pointer: coarse)').matches;

    if (isTouch) {
      const vv = window.visualViewport;
      const gap = 0.25 * fs;
      const wantH = Math.min(maxHRem, 11) * fs;

      function place() {
        const r = anchor.getBoundingClientRect();
        const visTop = vv ? vv.offsetTop : 0;
        const visH  = vv ? vv.height : window.innerHeight;
        const visBot = visTop + visH;
        const anch  = Math.min(r.top, visBot - gap);
        const avail = anch - visTop - gap * 2;
        const h   = Math.max(5 * fs, Math.min(wantH, avail));
        const top = Math.max(visTop + gap, anch - h - gap);

        el.style.top       = toRem(top);
        el.style.height    = toRem(h);
        el.style.maxHeight = toRem(h);
      }

      el.classList.add('ppp-pop-box--mobile-kbd');

      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      place();

      let revealed = false;
      function reveal() {
        if (revealed) return;
        revealed = true;
        place();
        el.style.opacity = '1';
        el.style.pointerEvents = '';
      }

      const fallbackTimer = setTimeout(reveal, 120);

      if (vv) {
        const onVV = () => {
          if (!revealed) {
            clearTimeout(fallbackTimer);
            reveal();
          } else {
            place();
          }
        };
        vv.addEventListener('resize', onVV);
        vv.addEventListener('scroll', onVV);
        (el as any).__vvCleanup = () => {
          clearTimeout(fallbackTimer);
          vv.removeEventListener('resize', onVV);
          vv.removeEventListener('scroll', onVV);
        };
      } else {
        clearTimeout(fallbackTimer);
        reveal();
      }
      return;
    }

    const r = anchor.getBoundingClientRect();
    const maxH = maxHRem * fs;
    const gap = 0.5 * fs;
    const below = window.innerHeight - r.bottom - gap;
    el.style.top = (below >= maxH || below > r.top - gap)
      ? toRem(r.bottom + 0.125 * fs)
      : toRem(r.top - maxH - 0.125 * fs);
    el.style.left = toRem(Math.max(0.25 * fs, Math.min(r.left, window.innerWidth - 16.25 * fs)));
  }

  function makePopover(anchor: HTMLElement, items: { label: string; icon?: string; selected?: boolean; handler: () => void }[]) {
    destroyPopover();
    const box = activeDocument.createElement('div');
    box.addClass('ppp-pop-box');
    box.setAttribute('data-settings-dropdown', '');
    const maxHRem = Math.min(items.length * 2.125 + 0.5, 17.5);
    box.style.maxHeight = `${maxHRem}rem`;
    positionPop(box, anchor, maxHRem);

    const list = activeDocument.createElement('div');
    list.addClass('ppp-pop-list');
    list.style.flex = '1';
    list.style.minHeight = '0';

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
    <span class="section-title">{$i18n.t('components.sort.label')}</span>
  </div>

  {#if local.criteria.length === 0}
    <p class="empty-hint">{$i18n.t('components.sort.empty-hint')}</p>
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
            on:click|stopPropagation={() => removeCriteria(index)} title={$i18n.t('common.delete')}>
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
    .sort-row { gap: 3px; min-height: 38px; }
    .chip { height: 32px; padding: 0 10px; font-size: 14px; }
    .row-btn { opacity: 1; padding: 6px; }
    .add-btn { min-height: 40px; font-size: 14px; }
  }
</style>
