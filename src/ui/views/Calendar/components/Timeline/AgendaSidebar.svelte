<!--
  AgendaSidebar.svelte v9.0.0 - FULL REFACTOR
  
  UNIFIED Agenda panel for viewing ALL notes by categories.
  Same functionality on PC and Mobile.
  
  KEY FEATURE: Date selector in header - defaults to today, 
  but user can pick any date to view agenda relative to that date.
-->
<script lang="ts">
  import dayjs from 'dayjs';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Icon } from 'obsidian-svelte';
  import type { DataRecord } from '../../../../../lib/dataframe/dataframe';
  import type { ProjectDefinition } from '../../../../../settings/settings';
  import { formatDateForDisplay } from '../../../../../lib/helpers';
  import { extractTimeWithPriority, parseDateInTimezone } from '../../../Calendar/calendar';
  import { isMobileDevice } from '../../../../../lib/stores/ui';
  import { app } from '../../../../../lib/stores/obsidian';
  
  const dispatch = createEventDispatcher();
  
  // PROPS
  export let project: ProjectDefinition;
  export let records: DataRecord[] = [];
  export let currentDate: dayjs.Dayjs = dayjs();
  export let titleField: string | undefined = undefined;
  export let dateField: string | undefined = undefined;
  export let timeField: string | undefined = undefined;
  export let colorField: string | undefined = undefined;
  export let checkField: string | undefined = undefined;
  export let timezone: string = 'local';
  export let onRecordClick: ((id: string) => void) | undefined = undefined;
  export let onCreateRecord: ((date: dayjs.Dayjs) => void) | undefined = undefined;
  export let visible: boolean = true;  // New: controls visibility on mobile
  export let collapsed: boolean = false;  // Desktop: collapsed sidebar
  export let width: number = 300;
  export let onWidthChange: ((w: number) => void) | undefined = undefined;
  
  const MIN_WIDTH = 240;
  const MAX_WIDTH = 400;
  
  // STATE - use global mobile detection
  $: isMobile = $isMobileDevice;
  
  let selectedDate: dayjs.Dayjs = currentDate;
  let showDatePicker = false;
  let pickerMonth: dayjs.Dayjs = currentDate.startOf('month');
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  
  let collapsedCategories: Record<AgendaCategory, boolean> = {
    'overdue': false, 'allday': false, 'today': false,
    'multiday': false, 'upcoming': true, 'undated': true,
  };
  
  // TYPES
  type AgendaCategory = 'overdue' | 'allday' | 'today' | 'multiday' | 'upcoming' | 'undated';
  
  interface AgendaEvent {
    id: string;
    title: string;
    time: string;
    timeMinutes: number;
    color: string | undefined;
    category: AgendaCategory;
    date: dayjs.Dayjs | null;
    dateStr: string | undefined;
    isMultiDay: boolean;
    isAllDay: boolean;
    spanInfo: string | undefined;
  }
  
  const CATEGORY_ORDER: AgendaCategory[] = ['overdue', 'today', 'allday', 'multiday', 'upcoming', 'undated'];
  
  // Lucide icon names for categories (consistent with plugin style)
  const CATEGORY_ICONS: Record<AgendaCategory, string> = {
    'overdue': 'alert-circle',
    'today': 'clock',
    'allday': 'sun',
    'multiday': 'calendar-range',
    'upcoming': 'calendar-clock',
    'undated': 'inbox',
  };
  
  // I18N - Fixed Russian labels (no emoji - using Icon component)
  const LABELS = {
    title: 'Повестка дня',
    overdue: 'Просрочено',
    today: 'На эту дату',
    allday: 'Весь день',
    multiday: 'Многодневные',
    upcoming: 'Предстоящие',
    undated: 'Без даты',
    empty: 'Нет заметок',
    allDayTime: 'Весь день',
    todayBtn: 'Сегодня',
    addNote: 'Добавить',
  };
  $: labels = LABELS;
  
  // LIFECYCLE
  onMount(() => {
    loadState();
    document.addEventListener('click', handleOutsideClick);
  });
  
  onDestroy(() => {
    document.removeEventListener('click', handleOutsideClick);
  });
  
  function handleOutsideClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (showDatePicker && !target.closest('.date-picker-container')) {
      showDatePicker = false;
    }
  }
  
  // PERSISTENCE
  const STORAGE_KEY = 'obs-projects-agenda-state';
  
  function loadState() {
    try {
      const appInstance = (window as any).app || $app;
      const data = appInstance?.loadLocalStorage(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.collapsed) {
          collapsedCategories = { ...collapsedCategories, ...parsed.collapsed };
        }
      }
    } catch { /* ignore */ }
  }
  
  function saveState() {
    try {
      const appInstance = (window as any).app || $app;
      appInstance?.saveLocalStorage(STORAGE_KEY, JSON.stringify({ collapsed: collapsedCategories }));
    } catch { /* ignore */ }
  }
  
  // DATE PICKER
  function toggleDatePicker(e: MouseEvent) {
    e.stopPropagation();
    showDatePicker = !showDatePicker;
    if (showDatePicker) {
      pickerMonth = selectedDate.startOf('month');
    }
  }
  
  function closePicker() {
    showDatePicker = false;
  }
  
  function goToday() {
    selectedDate = dayjs();
    pickerMonth = selectedDate.startOf('month');
    showDatePicker = false;
    dispatch('dateChange', selectedDate);
  }
  
  function selectDate(date: dayjs.Dayjs) {
    selectedDate = date;
    showDatePicker = false;
    dispatch('dateChange', selectedDate);
  }
  
  function prevMonth() {
    pickerMonth = pickerMonth.subtract(1, 'month');
  }
  
  function nextMonth() {
    pickerMonth = pickerMonth.add(1, 'month');
  }
  
  $: pickerDays = (() => {
    const start = pickerMonth.startOf('month').startOf('week');
    const days: dayjs.Dayjs[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(start.add(i, 'day'));
    }
    return days;
  })();
  
  $: weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  
  // RESIZE
  function startResize(e: MouseEvent) {
    if (isMobile) return;
    e.preventDefault();
    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartWidth = width;
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', endResize);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }
  
  function doResize(e: MouseEvent) {
    if (!isResizing) return;
    const delta = resizeStartX - e.clientX;
    width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStartWidth + delta));
    onWidthChange?.(width);
  }
  
  function endResize() {
    isResizing = false;
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', endResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
  
  // DATA PROCESSING
  function getRecordDate(record: DataRecord): dayjs.Dayjs | null {
    const fieldName = dateField ?? 'startDate';
    const value = record.values[fieldName] ?? record.values['date'] ?? record.values['deadline'];
    if (!value) return null;
    return parseDateInTimezone(value, timezone);
  }
  
  function getEndDate(record: DataRecord): dayjs.Dayjs | null {
    const value = record.values['endDate'] ?? record.values['end'];
    if (!value) return null;
    return parseDateInTimezone(value, timezone);
  }
  
  function categorize(
    date: dayjs.Dayjs | null,
    endDate: dayjs.Dayjs | null,
    isAllDay: boolean,
    baseDate: dayjs.Dayjs,
    isCompleted: boolean = false
  ): AgendaCategory {
    if (!date) return 'undated';
    
    const base = baseDate.startOf('day');
    const eventDay = date.startOf('day');
    
    // Multi-day check
    if (endDate) {
      const endDay = endDate.startOf('day');
      if (!eventDay.isSame(endDay, 'day')) {
        // Event spans multiple days
        if (!base.isBefore(eventDay) && !base.isAfter(endDay)) {
          return 'multiday';
        }
      }
    }
    
    // Before base = overdue (BUT NOT if completed!)
    if (eventDay.isBefore(base)) {
      // Если задача выполнена, не считаем её просроченной - помещаем в upcoming (прошлые)
      return isCompleted ? 'upcoming' : 'overdue';
    }
    
    // On base date
    if (eventDay.isSame(base, 'day')) {
      return isAllDay ? 'allday' : 'today';
    }
    
    // Future
    return 'upcoming';
  }
  
  function buildAgenda(recs: DataRecord[], baseDate: dayjs.Dayjs): AgendaEvent[] {
    const result: AgendaEvent[] = [];
    
    for (const record of recs) {
      const title = titleField && record.values[titleField]
        ? String(record.values[titleField])
        : record.id.split('/').pop()?.replace('.md', '') ?? record.id;
      
      const date = getRecordDate(record);
      const endDate = getEndDate(record);
      
      // Check if task is completed
      const isCompleted = checkField 
        ? record.values[checkField] === true 
        : false;
      
      let timeMinutes = -1;
      let timeDisplay = labels.allDayTime;
      let isAllDay = true;
      
      if (timeField) {
        const extracted = extractTimeWithPriority(record, timeField);
        if (extracted) {
          const parts = extracted.split(':').map(Number);
          const h = parts[0];
          const m = parts[1];
          if (h !== undefined && m !== undefined) {
            timeMinutes = h * 60 + m;
            timeDisplay = extracted;
            isAllDay = false;
          }
        }
      }
      
      const category = categorize(date, endDate, isAllDay, baseDate, isCompleted);
      const color = colorField ? record.values[colorField] as string : undefined;
      
      let spanInfo: string | undefined;
      let dateStr: string | undefined;
      
      if (date && endDate && !date.isSame(endDate, 'day')) {
        const startFormatted = formatDateForDisplay(date, project) ?? date.format('D MMM');
        const endFormatted = formatDateForDisplay(endDate, project) ?? endDate.format('D MMM');
        spanInfo = `${startFormatted} – ${endFormatted}`;
      }
      
      // Show date for overdue/upcoming (not for today/allday)
      if (date && category !== 'today' && category !== 'allday') {
        dateStr = formatDateForDisplay(date, project) ?? date.format('D MMM');
      }
      
      result.push({
        id: record.id,
        title,
        time: timeDisplay,
        timeMinutes,
        color,
        category,
        date,
        dateStr,
        isMultiDay: !!(endDate && date && !date.isSame(endDate, 'day')),
        isAllDay,
        spanInfo,
      });
    }
    
    // Sort by category order, then date, then time
    return result.sort((a, b) => {
      const catA = CATEGORY_ORDER.indexOf(a.category);
      const catB = CATEGORY_ORDER.indexOf(b.category);
      if (catA !== catB) return catA - catB;
      
      if (a.date && b.date) {
        const diff = a.date.valueOf() - b.date.valueOf();
        if (diff !== 0) return diff;
      }
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      
      return a.timeMinutes - b.timeMinutes;
    });
  }
  
  $: agenda = buildAgenda(records, selectedDate);
  
  $: grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = agenda.filter(e => e.category === cat);
    return acc;
  }, {} as Record<AgendaCategory, AgendaEvent[]>);
  
  // Show ALL categories - empty ones displayed as collapsed
  $: activeCategories = CATEGORY_ORDER;
  
  // Auto-collapse empty categories
  $: {
    CATEGORY_ORDER.forEach(cat => {
      if (grouped[cat].length === 0 && !collapsedCategories[cat]) {
        collapsedCategories[cat] = true;
      }
    });
  }
  
  $: stats = {
    total: agenda.length,
    overdue: grouped.overdue.length,
    today: grouped.today.length + grouped.allday.length,
    undated: grouped.undated.length,
  };
  
  // HANDLERS
  function toggleCategory(cat: AgendaCategory) {
    collapsedCategories[cat] = !collapsedCategories[cat];
    collapsedCategories = collapsedCategories;
    saveState();
  }
  
  function handleClick(event: MouseEvent, id: string) {
    // Ctrl+Click (Windows/Linux) or Cmd+Click (Mac) = open in new window
    if (event.ctrlKey || event.metaKey) {
      dispatch('openInNewWindow', { id });
      return;
    }
    onRecordClick?.(id);
  }
  
  function handleAdd() {
    onCreateRecord?.(selectedDate);
  }
  
  $: dateDisplay = (() => {
    const today = dayjs().startOf('day');
    const sel = selectedDate.startOf('day');
    
    if (sel.isSame(today, 'day')) return 'Сегодня';
    if (sel.isSame(today.subtract(1, 'day'), 'day')) return 'Вчера';
    if (sel.isSame(today.add(1, 'day'), 'day')) return 'Завтра';
    
    return formatDateForDisplay(selectedDate, project) ?? selectedDate.format('D MMMM YYYY');
  })();
</script>

<aside 
  class="agenda"
  class:collapsed
  class:mobile={isMobile}
  class:hidden={isMobile && !visible}
  class:resizing={isResizing}
  style:--w="{isMobile ? '100%' : `${width}px`}"
>
  {#if !collapsed && !isMobile}
    <div class="resize-handle" on:mousedown={startResize} role="separator" />
  {/if}
  
  <header class="header">
    {#if !collapsed}
      <div class="date-picker-container">
        <button class="date-btn" on:click={toggleDatePicker}>
          <span class="date-icon"><Icon name="calendar" size="sm" /></span>
          <span class="date-text">{dateDisplay}</span>
          <span class="date-arrow"><Icon name={showDatePicker ? 'chevron-up' : 'chevron-down'} size="xs" /></span>
        </button>
        
        {#if showDatePicker}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="picker-overlay" on:click={closePicker}></div>
          <div class="date-picker" on:click|stopPropagation on:keydown|stopPropagation role="dialog">
            <div class="picker-header">
              <button class="picker-nav" on:click={prevMonth}><Icon name="chevron-left" size="sm" /></button>
              <span class="picker-month">{pickerMonth.format('MMMM YYYY')}</span>
              <button class="picker-nav" on:click={nextMonth}><Icon name="chevron-right" size="sm" /></button>
            </div>
            
            <div class="picker-weekdays">
              {#each weekDays as day}
                <span class="weekday">{day}</span>
              {/each}
            </div>
            
            <div class="picker-days">
              {#each pickerDays as day}
                {@const isToday = day.isSame(dayjs(), 'day')}
                {@const isSelected = day.isSame(selectedDate, 'day')}
                {@const isOtherMonth = !day.isSame(pickerMonth, 'month')}
                <button 
                  class="picker-day"
                  class:today={isToday}
                  class:selected={isSelected}
                  class:other-month={isOtherMonth}
                  on:click={() => selectDate(day)}
                >
                  {day.date()}
                </button>
              {/each}
            </div>
            
            <button class="today-btn" on:click={goToday}>
              {labels.todayBtn}
            </button>
          </div>
        {/if}
      </div>
      
      <div class="stats">
        {#if stats.overdue > 0}
          <span class="stat stat-overdue" title="Просрочено">{stats.overdue}</span>
        {/if}
        <span class="stat stat-total" title="Всего">{stats.total}</span>
      </div>
      
      {#if onCreateRecord}
        <button class="add-btn" on:click={handleAdd} title={labels.addNote}>
          <Icon name="plus" size="md" />
        </button>
      {/if}
    {/if}
  </header>
  
  {#if !collapsed}
    <div class="content">
      <div class="categories">
        {#each activeCategories as cat (cat)}
          {@const events = grouped[cat]}
          {@const isCollapsed = collapsedCategories[cat]}
          {@const isEmpty = events.length === 0}
          
          <section 
            class="category" 
            class:cat-overdue={cat === 'overdue'} 
            class:cat-undated={cat === 'undated'}
            class:cat-empty={isEmpty}
          >
            <button class="cat-header" on:click={() => toggleCategory(cat)}>
              <span class="cat-toggle">
                <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size="xs" />
              </span>
              <span class="cat-icon">
                <Icon name={CATEGORY_ICONS[cat]} size="sm" />
              </span>
              <span class="cat-label">{labels[cat]}</span>
              <span class="cat-count" class:count-zero={isEmpty}>{events.length}</span>
            </button>
            
            {#if !isCollapsed && events.length > 0}
              <ul class="events">
                {#each events as ev (ev.id)}
                  <li>
                    <button 
                      class="event" 
                      style:--color={ev.color || 'var(--text-accent)'}
                      on:click={(e) => handleClick(e, ev.id)}
                      title="Ctrl+Click: открыть в новом окне"
                    >
                      <span class="ev-dot" />
                      {#if ev.dateStr}
                        <span class="ev-date">{ev.dateStr}</span>
                      {/if}
                      <span class="ev-time">{ev.time}</span>
                      <span class="ev-title">{ev.title}</span>
                      {#if ev.spanInfo}
                        <span class="ev-span">{ev.spanInfo}</span>
                      {/if}
                    </button>
                  </li>
                {/each}
              </ul>
            {:else if !isCollapsed && isEmpty}
              <div class="cat-empty-msg">{labels.empty}</div>
            {/if}
          </section>
        {/each}
      </div>
    </div>
  {/if}
</aside>

<style>
  /* ═══════════════════════════════════════════════════════════
     AgendaSidebar v9.1 — Fluid Architecture (tokens-based)
     All values in rem, inheriting from --ppp-* design tokens
     ═══════════════════════════════════════════════════════════ */
  
  /* Local tokens (scoped to this component) */
  .agenda {
    /* Layout tokens */
    --agenda-width: var(--ppp-sidebar-width, 15rem);
    --agenda-collapsed-width: var(--ppp-sidebar-collapsed-width, 2.5rem);
    --agenda-header-height: var(--ppp-calendar-header-height, 2.5rem);
    
    /* Spacing tokens */
    --agenda-gap-sm: var(--ppp-gap-inline-xs, 0.25rem);
    --agenda-gap-md: var(--ppp-gap-inline-sm, 0.375rem);
    --agenda-gap-lg: var(--ppp-gap-inline-md, 0.5rem);
    --agenda-padding: var(--ppp-padding-md, 0.5rem);
    
    /* Typography tokens */
    --agenda-font-xs: var(--ppp-font-size-xs, 0.6875rem);
    --agenda-font-sm: var(--ppp-font-size-sm, 0.75rem);
    --agenda-font-md: var(--ppp-font-size-md, 0.8125rem);
    
    /* Radius tokens */
    --agenda-radius-sm: var(--ppp-radius-md, 0.25rem);
    --agenda-radius-md: var(--ppp-radius-lg, 0.375rem);
    --agenda-radius-lg: var(--ppp-radius-xl, 0.5rem);
    
    /* Touch target (accessibility) */
    --agenda-touch-min: var(--ppp-touch-target-min, 2.75rem);
    
    /* Transition */
    --agenda-transition: var(--ppp-duration-normal, 150ms) var(--ppp-ease-out, ease-out);
    
    /* Z-index */
    --agenda-z-picker: var(--ppp-z-popover, 50);
    --agenda-z-overlay: var(--ppp-z-overlay, 30);
  }
  
  /* Base container */
  .agenda {
    width: var(--w, var(--agenda-width));
    min-width: var(--w, var(--agenda-width));
    max-width: var(--w, var(--agenda-width));
    background: var(--background-secondary);
    border-left: 1px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: visible;
    transition: width var(--agenda-transition);
    flex-shrink: 0;
  }
  
  .agenda.collapsed {
    width: var(--agenda-collapsed-width);
    min-width: var(--agenda-collapsed-width);
    max-width: var(--agenda-collapsed-width);
  }
  
  .agenda.resizing { transition: none; }
  
  /* Mobile: Full drawer from right (no collapsed state, just show/hide) */
  .agenda.mobile {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 85vw;
    max-width: 20rem;
    min-width: auto;
    /* CRITICAL: Lower than SettingsMenu (101) to avoid overlap */
    z-index: 50;
    border-left: var(--ppp-border-width) solid var(--background-modifier-border);
    border-top: none;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.2);
    transform: translateX(0);
    transition: transform var(--agenda-transition);
  }
  
  /* Mobile hidden state - fully off-screen */
  .agenda.mobile.hidden {
    transform: translateX(100%);
    pointer-events: none;
  }
  
  /* Landscape orientation: narrower sidebar on mobile */
  @media (max-width: 48rem) and (orientation: landscape) { /* 768px at 16px base */
    .agenda.mobile {
      width: 50vw;
      max-width: 16rem;
    }
  }
  
  /* Portrait orientation: wider sidebar for better touch targets */
  @media (max-width: 48rem) and (orientation: portrait) { /* 768px at 16px base */
    .agenda.mobile {
      width: 85vw;
      max-width: 22rem;
    }
  }
  
  /* Desktop collapsed - thin bar visible */
  .agenda:not(.mobile).collapsed {
    pointer-events: auto;
  }
  
  /* Resize handle */
  .resize-handle {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 0.25rem;
    cursor: col-resize;
    z-index: var(--ppp-z-raised, 1);
  }
  .resize-handle:hover { background: var(--interactive-accent); }
  
  /* Header */
  .header {
    display: flex;
    align-items: center;
    gap: var(--agenda-gap-lg);
    padding: var(--agenda-padding);
    border-bottom: 1px solid var(--background-modifier-border);
    min-height: var(--agenda-touch-min);
    flex-shrink: 0;
  }
  

  
  /* Date Picker */
  .date-picker-container {
    position: relative;
    flex: 1;
    min-width: 0;
    overflow: visible;
  }
  
  .date-btn {
    display: flex;
    align-items: center;
    gap: var(--agenda-gap-md);
    width: 100%;
    padding: var(--agenda-gap-md) var(--agenda-gap-lg);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--agenda-radius-md);
    cursor: pointer;
    font-size: var(--agenda-font-md);
    color: var(--text-normal);
    transition: border-color var(--agenda-transition);
  }
  .date-btn:hover { border-color: var(--interactive-accent); }
  
  .date-icon { 
    display: flex; 
    align-items: center;
    color: var(--text-muted);
  }
  .date-text { flex: 1; text-align: left; font-weight: var(--ppp-font-weight-medium, 500); }
  .date-arrow { 
    display: flex; 
    align-items: center;
    color: var(--text-muted); 
  }
  
  .picker-overlay {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: var(--agenda-z-overlay);
  }
  
  .agenda.mobile .picker-overlay {
    background: rgba(0, 0, 0, 0.3);
  }
  
  .date-picker {
    position: absolute;
    top: calc(100% + var(--agenda-gap-sm));
    left: 0;
    width: calc(var(--agenda-width) - var(--agenda-padding) * 2);
    max-width: calc(100vw - 1rem);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--agenda-radius-lg);
    box-shadow: var(--ppp-shadow-md, var(--shadow-s));
    padding: var(--agenda-padding);
    z-index: var(--agenda-z-picker);
    box-sizing: border-box;
  }
  
  /* На мобильных - по центру экрана */
  .agenda.mobile .date-picker {
    position: fixed;
    top: 50%;
    left: 50%;
    width: 18rem;
    max-width: 90vw;
    transform: translate(-50%, -50%);
  }
  
  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--agenda-gap-lg);
  }
  
  .picker-nav {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--agenda-gap-sm) var(--agenda-gap-lg);
    border-radius: var(--agenda-radius-sm);
    color: var(--text-muted);
    font-size: var(--agenda-font-sm);
  }
  .picker-nav:hover { background: var(--background-modifier-hover); }
  
  .picker-month {
    font-weight: var(--ppp-font-weight-semibold, 600);
    font-size: var(--agenda-font-md);
    text-transform: capitalize;
  }
  
  .picker-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: var(--ppp-space-1, 0.125rem);
    margin-bottom: var(--agenda-gap-sm);
  }
  
  .weekday {
    text-align: center;
    font-size: var(--agenda-font-xs);
    color: var(--text-muted);
    padding: var(--agenda-gap-sm);
  }
  
  .picker-days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: var(--ppp-space-1, 0.125rem);
  }
  
  .picker-day {
    aspect-ratio: 1;
    min-width: 1.75rem;
    min-height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: var(--ppp-radius-full, 50%);
    cursor: pointer;
    font-size: var(--agenda-font-sm);
    color: var(--text-normal);
    transition: background var(--agenda-transition);
  }
  .picker-day:hover { background: var(--background-modifier-hover); }
  .picker-day.other-month { color: var(--text-faint); }
  .picker-day.today { 
    background: var(--interactive-accent); 
    color: var(--text-on-accent); 
  }
  .picker-day.selected { 
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: -0.125rem;
  }
  
  .today-btn {
    width: 100%;
    margin-top: var(--agenda-gap-lg);
    padding: var(--agenda-gap-lg);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: var(--agenda-radius-md);
    cursor: pointer;
    font-size: var(--agenda-font-md);
    font-weight: var(--ppp-font-weight-medium, 500);
  }
  .today-btn:hover { opacity: 0.9; }
  
  /* Stats */
  .stats {
    display: flex;
    gap: var(--agenda-gap-sm);
  }
  
  .stat {
    padding: var(--ppp-space-1, 0.125rem) var(--agenda-gap-lg);
    border-radius: var(--ppp-radius-full, 999px);
    font-size: var(--agenda-font-xs);
    font-weight: var(--ppp-font-weight-medium, 500);
  }
  .stat-total { background: var(--background-modifier-border); color: var(--text-muted); }
  .stat-overdue { background: rgba(244, 67, 54, 0.15); color: var(--text-error); }
  
  /* Add button */
  .add-btn {
    width: var(--ppp-icon-size-lg, 1.5rem);
    height: var(--ppp-icon-size-lg, 1.5rem);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: var(--agenda-radius-md);
    cursor: pointer;
    font-size: var(--ppp-font-size-lg, 1rem);
    font-weight: var(--ppp-font-weight-semibold, 600);
    flex-shrink: 0;
  }
  .add-btn:hover { opacity: 0.9; transform: scale(1.05); }
  
  /* Content */
  .content {
    flex: 1;
    overflow-y: auto;
    padding: var(--agenda-padding);
  }
  
  /* Categories */
  .categories {
    display: flex;
    flex-direction: column;
    gap: var(--agenda-gap-md);
  }
  
  .category {
    background: var(--background-primary);
    border-radius: var(--agenda-radius-lg);
    border: 1px solid var(--background-modifier-border);
    overflow: hidden;
  }
  
  .cat-header {
    display: flex;
    align-items: center;
    gap: var(--agenda-gap-md);
    width: 100%;
    padding: var(--agenda-gap-lg) var(--ppp-space-5, 0.75rem);
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
  }
  .cat-header:hover { background: var(--background-modifier-hover); }
  
  .cat-toggle { 
    display: flex;
    align-items: center;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .cat-icon { 
    display: flex;
    align-items: center;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .cat-label { 
    flex: 1; 
    font-size: var(--agenda-font-sm); 
    font-weight: var(--ppp-font-weight-semibold, 600); 
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--text-muted);
  }
  .cat-count { 
    font-size: var(--agenda-font-xs); 
    color: var(--text-faint);
    background: var(--background-modifier-border);
    padding: var(--ppp-space-1, 0.125rem) var(--agenda-gap-md);
    border-radius: var(--agenda-radius-sm);
  }
  
  .cat-overdue .cat-label { color: var(--text-error); }
  .cat-overdue .cat-icon { color: var(--text-error); }
  .cat-undated .cat-label { color: var(--text-warning); }
  .cat-undated .cat-icon { color: var(--text-warning); }
  
  .cat-empty { opacity: 0.7; }
  .cat-empty .cat-header:hover { opacity: 1; }
  
  .count-zero { 
    opacity: 0.5;
    background: transparent;
  }
  
  .cat-empty-msg {
    padding: var(--agenda-gap-lg) var(--ppp-space-5, 0.75rem);
    font-size: var(--agenda-font-sm);
    color: var(--text-faint);
    font-style: italic;
    text-align: center;
    border-top: 1px solid var(--background-modifier-border);
  }
  
  /* Events list */
  .events {
    list-style: none;
    margin: 0;
    padding: var(--agenda-gap-sm);
    border-top: 1px solid var(--background-modifier-border);
    max-height: 12.5rem;
    overflow-y: auto;
  }
  
  .event {
    display: flex;
    align-items: center;
    gap: var(--agenda-gap-md);
    width: 100%;
    padding: var(--agenda-gap-lg);
    margin-bottom: var(--ppp-space-1, 0.125rem);
    background: var(--background-secondary);
    border: none;
    border-radius: var(--agenda-radius-md);
    cursor: pointer;
    text-align: left;
    transition: background var(--agenda-transition);
  }
  .event:hover { background: var(--background-modifier-hover); }
  .event:last-child { margin-bottom: 0; }
  
  .ev-dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: var(--ppp-radius-full, 50%);
    background: var(--color);
    flex-shrink: 0;
  }
  
  .ev-date {
    font-size: var(--agenda-font-xs);
    color: var(--text-faint);
    flex-shrink: 0;
  }
  
  .ev-time {
    font-size: var(--agenda-font-sm);
    color: var(--text-muted);
    flex-shrink: 0;
    min-width: 2.5rem;
    font-variant-numeric: tabular-nums;
  }
  
  .ev-title {
    flex: 1;
    font-size: var(--agenda-font-md);
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .ev-span {
    font-size: var(--agenda-font-xs);
    color: var(--text-faint);
    flex-shrink: 0;
  }
  
  /* Category-specific event styles */
  .cat-overdue .event {
    border-left: 0.1875rem solid var(--text-error);
    background: rgba(244, 67, 54, 0.05);
  }
  .cat-undated .event {
    border-left: 0.1875rem solid var(--text-warning);
    opacity: 0.9;
  }
  
  /* Scrollbar */
  .content::-webkit-scrollbar,
  .events::-webkit-scrollbar {
    width: 0.3125rem;
  }
  .content::-webkit-scrollbar-thumb,
  .events::-webkit-scrollbar-thumb {
    background: var(--background-modifier-border);
    border-radius: var(--agenda-radius-sm);
  }
  
/* Mobile — touch targets and layout */
  .agenda.mobile .header { 
    padding: var(--agenda-gap-md) var(--agenda-gap-lg); 
  }
  .agenda.mobile .content {
    overflow-y: auto;
  }
  .agenda.mobile .event { 
    padding: var(--ppp-space-5, 0.75rem) var(--agenda-gap-lg); 
    min-height: var(--agenda-touch-min); 
  }
  .agenda.mobile .cat-header { 
    padding: var(--ppp-space-5, 0.75rem); 
    min-height: var(--agenda-touch-min); 
  }
  .agenda.mobile .events { 
    max-height: 16rem; 
  }
  .agenda.mobile .add-btn {
    min-width: var(--agenda-touch-min);
    min-height: var(--agenda-touch-min);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .agenda, .event, .add-btn, .date-btn { transition: none; }
  }
</style>
