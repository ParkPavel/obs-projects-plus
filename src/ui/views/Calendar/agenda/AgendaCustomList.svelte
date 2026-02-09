<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { Icon } from 'obsidian-svelte';
  import { Menu } from 'obsidian';
  import dayjs, { Dayjs } from 'dayjs';
  import { i18n } from 'src/lib/stores/i18n';
  import { isMobileDevice } from 'src/lib/stores/ui';
  import type { DataRecord } from 'src/lib/dataframe/dataframe';
  import type { AgendaCustomList } from 'src/settings/v3/settings';
  import { filterRecordsForList } from './filterEngine';
  
  const dispatch = createEventDispatcher<{
    recordClick: string;
    edit: void;
    delete: void;
    toggle: void;
  }>();
  
  // i18n helper
  const t = (key: string) => $i18n.t(`views.calendar.agenda.custom.${key}`);
  
  export let list: AgendaCustomList;
  export let records: DataRecord[] = [];
  export let titleField: string | undefined;
  export let onRecordClick: ((id: string) => void) | undefined;
  export let selectedDate: Dayjs = dayjs(); // Reference date for formula evaluation
  
  // Filter records using the selected date as base for formulas
  // New unified API supports both visual and advanced modes
  $: filteredRecords = filterRecordsForList(records, list, selectedDate, []);
  $: isCollapsed = list.collapsed ?? false;
  $: isMobile = $isMobileDevice;
  
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  
  function handleRecordClick(id: string) {
    if (onRecordClick) {
      onRecordClick(id);
    }
    dispatch('recordClick', id);
  }
  
  /**
   * Strip wikilink syntax from a string:
   *   [[path|display]] → display
   *   [[path]]         → basename of path (without .md)
   *   plain text       → unchanged
   */
  function stripWikilinks(text: string): string {
    return text.replace(/\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
      // [[path|display]] → display
      const pipeIdx = inner.indexOf('|');
      if (pipeIdx !== -1) return inner.slice(pipeIdx + 1).trim();
      // [[path]] → basename
      const parts = inner.split(/[\\/]/);
      const last = parts[parts.length - 1] ?? inner;
      return last.replace(/\.md$/i, '').trim();
    });
  }

  /**
   * Get record title - prioritize title field, then extract from path
   */
  function getRecordTitle(record: DataRecord): string {
    // First try the explicit title field
    if (titleField && record.values[titleField]) {
      const val = record.values[titleField];
      if (val && String(val).trim()) {
        return stripWikilinks(String(val));
      }
    }
    // Try common title field names (case-insensitive search)
    const titleFields = ['name', 'title', 'Name', 'Title', 'NAME', 'TITLE', 'заголовок', 'название', 'Название', 'Заголовок'];
    for (const field of titleFields) {
      const val = record.values[field];
      if (val && String(val).trim()) {
        return stripWikilinks(String(val));
      }
    }
    // Try to find any string field that looks like a title
    for (const [key, val] of Object.entries(record.values)) {
      if (val && typeof val === 'string' && val.trim() && !key.startsWith('_')) {
        // Skip likely non-title fields
        const skipFields = ['date', 'time', 'path', 'file', 'status', 'color', 'tags'];
        if (!skipFields.some(skip => key.toLowerCase().includes(skip))) {
          return stripWikilinks(val);
        }
      }
    }
    // Fallback: extract ONLY filename from full path (no directory)
    const path = record.id;
    // Split by both forward slash and backslash, get last part
    const parts = path.split(/[\\\\/]/);
    const filename = parts[parts.length - 1] ?? path;
    // Remove .md extension and return clean basename
    return filename.replace(/\.md$/i, '');
  }
  
  /**
   * Show context menu with edit/delete options
   */
  function showContextMenu(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    const menu = new Menu();
    
    menu.addItem((item) => {
      item
        .setTitle($i18n.t('views.calendar.agenda.custom.edit-list') || 'Edit list')
        .setIcon('pencil')
        .onClick(() => dispatch('edit'));
    });
    
    menu.addSeparator();
    
    menu.addItem((item) => {
      item
        .setTitle($i18n.t('views.calendar.agenda.custom.delete-list') || 'Delete list')
        .setIcon('trash-2')
        .onClick(() => dispatch('delete'));
    });
    
    if (e instanceof MouseEvent) {
      menu.showAtMouseEvent(e);
    } else if (e instanceof TouchEvent && e.changedTouches[0]) {
      const touch = e.changedTouches[0];
      menu.showAtPosition({ x: touch.clientX, y: touch.clientY });
    }
  }
  
  /**
   * Handle right-click on desktop
   */
  function handleContextMenu(e: MouseEvent) {
    showContextMenu(e);
  }
  
  /**
   * Handle touch start for long press on mobile
   */
  function handleTouchStart(e: TouchEvent) {
    if (!isMobile) return;
    
    longPressTimer = setTimeout(() => {
      showContextMenu(e);
    }, 500); // 500ms long press
  }
  
  /**
   * Handle touch end - cancel long press timer
   */
  function handleTouchEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }
  
  /**
   * Handle touch move - cancel long press if moved
   */
  function handleTouchMove() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }
  
  onDestroy(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
  });
</script>

<div class="agenda-custom-list" style:--list-accent={list.color}>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="list-header"
    on:contextmenu={handleContextMenu}
    on:touchstart={handleTouchStart}
    on:touchend={handleTouchEnd}
    on:touchmove={handleTouchMove}
  >
    <button 
      class="list-header-btn" 
      on:click={() => dispatch('toggle')}
      aria-label={isCollapsed ? 'Expand' : 'Collapse'}
      aria-expanded={!isCollapsed}
    >
      <span class="list-chevron">
        <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size="xs" />
      </span>
      {#if list.icon.type === 'emoji'}
        <span class="list-icon-emoji">{list.icon.value}</span>
      {:else}
        <span class="list-icon"><Icon name={list.icon.value} size="sm" /></span>
      {/if}
      <span class="list-title">{list.name}</span>
      <span class="list-count">{filteredRecords.length}</span>
    </button>
  </div>
  
  {#if !isCollapsed}
    <div class="list-items">
      {#if filteredRecords.length === 0}
        <div class="list-empty">{t('empty-list')}</div>
      {:else}
        {#each filteredRecords as record (record.id)}
          <button
            class="list-item"
            on:click={() => handleRecordClick(record.id)}
          >
            <span class="item-title">{getRecordTitle(record)}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .agenda-custom-list {
    --accent: var(--list-accent, var(--interactive-accent));
    margin-bottom: 0.5rem;
    border-radius: var(--radius-s);
    background: var(--background-secondary);
    overflow: hidden;
  }
  
  .list-header {
    border-left: 0.1875rem solid var(--accent);
  }
  
  .list-header-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: none;
    background: transparent;
    color: var(--text-normal);
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  
  .list-header-btn:hover {
    background: var(--background-modifier-hover);
  }
  
  .list-header-btn:active {
    background: var(--background-modifier-active-hover);
  }
  
  .list-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    flex-shrink: 0;
    color: var(--text-muted);
  }
  
  .list-icon,
  .list-icon-emoji {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--accent);
  }
  
  .list-icon-emoji {
    font-size: 1rem;
    line-height: 1;
  }
  
  .list-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .list-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.25rem;
    padding: 0 0.375rem;
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    font-size: 0.6875rem;
    font-weight: 600;
    flex-shrink: 0;
  }
  
  .list-items {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0.25rem 0.5rem 0.5rem;
    border-left: 0.1875rem solid var(--accent);
    margin-left: 0;
  }
  
  .list-empty {
    padding: 0.75rem 0.5rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.8125rem;
    font-style: italic;
  }
  
  .list-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    border: none;
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.8125rem;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }
  
  .list-item:hover {
    background: var(--background-modifier-hover);
  }
  
  .list-item:active {
    background: var(--background-modifier-active-hover);
  }
  
  .item-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  /* Mobile touch targets */
  @media (pointer: coarse) {
    .list-header-btn {
      min-height: 2.75rem;
      padding: 0.75rem;
    }
    
    .list-item {
      min-height: 2.75rem;
      padding: 0.625rem 0.75rem;
    }
  }
</style>
