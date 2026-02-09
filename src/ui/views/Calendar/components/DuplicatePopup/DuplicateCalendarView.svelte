<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import dayjs from "dayjs";
  import { duplicateStore } from "src/lib/stores/duplicateStore";
  import DuplicateMonthBlock from "./DuplicateMonthBlock.svelte";
  
  export let firstDayOfWeek: number = 1;
  export let sourceDate: dayjs.Dayjs;
  export let displayMode: 'list' | 'bars' = 'bars';
  export let startHour: number = 7;
  export let endHour: number = 21;
  
  let container: HTMLDivElement;
  let scrollableParent: HTMLElement | null = null;
  let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Месяцы для отображения (начинаем с месяца source date)
  let months: dayjs.Dayjs[] = [];
  
  // Maximum months to prevent excessive DOM elements
  const MAX_MONTHS = 24;
  
  // Subscribe to store state
  $: storeState = $duplicateStore;
  
  // Recompute merged data whenever store state changes
  $: mergedData = (() => {
    // This will reactively update when storeState changes
    const data = duplicateStore.getMergedData();
    if (data) {
      console.debug('[DuplicateCalendarView] Merged data updated:', {
        totalProcessed: data.processed.length,
        phantomCount: Array.from(storeState.phantomRecords.values()).length,
        selectedDates: storeState.selectedDates.size,
      });
    }
    return data;
  })();
  
  // Инициализация месяцев - увеличено с 3 до 6 для лучшей работы scroll
  function initializeMonths() {
    const startMonth = sourceDate.startOf('month');
    months = [
      startMonth.subtract(2, 'month'),
      startMonth.subtract(1, 'month'),
      startMonth,
      startMonth.add(1, 'month'),
      startMonth.add(2, 'month'),
      startMonth.add(3, 'month'),
    ];
    console.debug('[DuplicateCalendarView] Initialized with 6 months');
  }
  
  // Проверка и подгрузка дополнительных месяцев при скролле
  function checkAndLoadMore() {
    if (!scrollableParent || !container) return;
    
    const scrollTop = scrollableParent.scrollTop;
    const scrollHeight = scrollableParent.scrollHeight;
    const clientHeight = scrollableParent.clientHeight;
    
    // Увеличен threshold для уменьшения частоты срабатывания (было 200px)
    const threshold = 600;
    
    // Ограничение максимального количества месяцев в DOM
    if (months.length >= MAX_MONTHS) return;
    
    // Подгрузить прошлые месяцы
    if (scrollTop < threshold && months.length < MAX_MONTHS) {
      const firstMonth = months[0];
      if (firstMonth) {
        const newMonth = firstMonth.subtract(1, 'month');
        const newMonthKey = newMonth.format('YYYY-MM');
        // Guard: проверяем что месяц ещё не добавлен
        const exists = months.some(m => m.format('YYYY-MM') === newMonthKey);
        
        if (!exists) {
          months = [newMonth, ...months];
        }
      }
    }
    
    // Подгрузить будущие месяцы
    if (scrollTop + clientHeight > scrollHeight - threshold && months.length < MAX_MONTHS) {
      const lastMonth = months[months.length - 1];
      if (lastMonth) {
        const newMonth = lastMonth.add(1, 'month');
        const newMonthKey = newMonth.format('YYYY-MM');
        // Guard: проверяем что месяц ещё не добавлен
        const exists = months.some(m => m.format('YYYY-MM') === newMonthKey);
        
        if (!exists) {
          months = [...months, newMonth];
        }
      }
    }
  }
  
  function handleScroll() {
    // Debounce для предотвращения чрезмерной частоты вызовов на mobile
    if (scrollDebounceTimer) {
      clearTimeout(scrollDebounceTimer);
    }
    
    scrollDebounceTimer = setTimeout(() => {
      checkAndLoadMore();
    }, 150); // 150ms debounce
  }
  
  function findScrollableParent(): HTMLElement | null {
    if (!container) return null;
    
    // Для modal ищем .calendar-container
    let element: HTMLElement | null = container.parentElement;
    
    while (element) {
      // Проверяем класс
      if (element.classList.contains('calendar-container')) {
        console.debug('[DuplicateCalendarView] Found .calendar-container as scrollable parent');
        return element;
      }
      
      const style = window.getComputedStyle(element);
      const overflow = style.overflow + style.overflowY;
      
      if (overflow.includes('scroll') || overflow.includes('auto')) {
        console.debug('[DuplicateCalendarView] Found scrollable parent:', element.className || element.tagName);
        return element;
      }
      
      element = element.parentElement;
    }
    
    console.warn('[DuplicateCalendarView] No scrollable parent found, using container.parentElement');
    return container.parentElement || container;
  }
  
  // Export method для программного скролла
  export async function scrollToDate(targetDate: dayjs.Dayjs) {
    const targetMonth = targetDate.startOf('month');
    const targetDay = targetDate.date(); // День месяца (1-31)
    
    console.debug('[scrollToDate] Target:', {
      date: targetDate.format('YYYY-MM-DD'),
      month: targetMonth.format('YYYY-MM'),
      day: targetDay
    });
    
    // Проверяем есть ли месяц уже в списке
    let monthIndex = months.findIndex(m => m.isSame(targetMonth, 'month'));
    
    // Если нет - добавляем
    if (monthIndex === -1) {
      // Вставляем в правильную позицию
      const insertIndex = months.findIndex(m => m.isAfter(targetMonth));
      if (insertIndex === -1) {
        months = [...months, targetMonth];
        monthIndex = months.length - 1;
      } else {
        months = [
          ...months.slice(0, insertIndex),
          targetMonth,
          ...months.slice(insertIndex)
        ];
        monthIndex = insertIndex;
      }
      
      console.debug('[scrollToDate] Added month:', targetMonth.format('YYYY-MM'), 'at index:', monthIndex);
      
      // Ждем рендер
      await tick();
      // Дополнительная задержка для mobile
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    // Manual scroll для надежности
    if (!scrollableParent || !container) {
      console.warn('[scrollToDate] No scrollable parent or container');
      return;
    }
    
    // Ищем блок месяца по data-month атрибуту (надежнее чем по индексу)
    const targetMonthKey = targetMonth.format('YYYY-MM');
    const targetMonthBlock = container.querySelector(`[data-month="${targetMonthKey}"]`) as HTMLElement;
    
    if (!targetMonthBlock) {
      console.warn('[scrollToDate] Target month block not found for:', targetMonthKey);
      return;
    }
    
    // Ищем конкретный день внутри месяца по data-date атрибуту
    const daySelector = `[data-date="${targetDate.format('YYYY-MM-DD')}"]`;
    let targetDayElement = targetMonthBlock.querySelector(daySelector) as HTMLElement;
    
    // Fallback: ищем по классу .duplicate-day и содержимому даты
    if (!targetDayElement) {
      const dayElements = Array.from(targetMonthBlock.querySelectorAll('.duplicate-day:not(.duplicate-day-outside-month)'));
      // Находим день по числу (ищем в .calendar-date)
      for (let i = 0; i < dayElements.length; i++) {
        const el = dayElements[i] as HTMLElement;
        const dateEl = el.querySelector('.calendar-date');
        const dayNum = dateEl?.textContent?.trim();
        if (dayNum === String(targetDay)) {
          targetDayElement = el;
          break;
        }
      }
    }
    
    // Fallback 2: ищем напрямую в data-date атрибутах всего контейнера
    if (!targetDayElement && container) {
      targetDayElement = container.querySelector(`[data-date="${targetDate.format('YYYY-MM-DD')}"]`) as HTMLElement;
    }
    
    // Вычисляем offset относительно scrollable parent
    const parentRect = scrollableParent.getBoundingClientRect();
    const targetElement = targetDayElement || targetMonthBlock;
    const targetRect = targetElement.getBoundingClientRect();
    
    const currentScroll = scrollableParent.scrollTop;
    // Центрируем элемент в viewport
    const parentHeight = scrollableParent.clientHeight;
    const targetHeight = targetRect.height;
    const centerOffset = (parentHeight - targetHeight) / 2;
    const targetScroll = currentScroll + (targetRect.top - parentRect.top) - Math.max(centerOffset, 50);
    
    console.debug('[scrollToDate] Scrolling to:', {
      monthIndex,
      monthKey: targetMonth.format('YYYY-MM'),
      dayFound: !!targetDayElement,
      currentScroll,
      targetScroll,
      centerOffset
    });
    
    scrollableParent.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: 'smooth'
    });
  }
  
  onMount(() => {
    initializeMonths();
    
    // Найти scrollable parent
    setTimeout(() => {
      scrollableParent = findScrollableParent();
      if (scrollableParent) {
        scrollableParent.addEventListener('scroll', handleScroll, { passive: true });
        
        // Скроллим к source месяцу
        const sourceMonthIndex = months.findIndex(m => m.isSame(sourceDate, 'month'));
        if (sourceMonthIndex !== -1 && container) {
          const monthBlocks = container.querySelectorAll('.duplicate-month-block');
          const targetBlock = monthBlocks[sourceMonthIndex] as HTMLElement;
          if (targetBlock) {
            targetBlock.scrollIntoView({ block: 'start' });
          }
        }
      }
    }, 100);
  });
  
  onDestroy(() => {
    if (scrollableParent) {
      scrollableParent.removeEventListener('scroll', handleScroll);
    }
    
    // Cleanup debounce timer
    if (scrollDebounceTimer) {
      clearTimeout(scrollDebounceTimer);
    }
  });
</script>

<div class="duplicate-calendar-view" bind:this={container}>
  {#each months as month (month.format('YYYY-MM'))}
    <div class="duplicate-month-block">
      <DuplicateMonthBlock
        {month}
        {firstDayOfWeek}
        processedData={mergedData}
        {displayMode}
        {startHour}
        {endHour}
      />
    </div>
  {/each}
</div>

<style>
  .duplicate-calendar-view {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: min-content;
  }
  
  .duplicate-month-block {
    flex-shrink: 0;
  }
</style>
