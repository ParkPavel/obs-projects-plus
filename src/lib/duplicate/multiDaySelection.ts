import dayjs from "dayjs";
import { formatDateForInternal } from "src/lib/helpers";
import type { ProcessedRecord } from "../../ui/views/Calendar/types";

/**
 * Обрабатывает выбор даты для multi-day события
 * При клике на дату:
 * 1. Если событие занимает N дней, автоматически выбираем N дней начиная с clicked date
 *    (создавая новый span того же размера, что и оригинал)
 * 2. При повторном клике на любой день из span — снимаем выбор со всех дней span
 * 3. Это предотвращает создание нескольких событий при дублировании одного multi-day
 * 
 * ВАЖНО: Логика намеренно создаёт НОВЫЕ spans начиная с clicked date,
 * а не выбирает оригинальные даты. Это позволяет дублировать multi-day
 * события на любую дату, сохраняя их длительность.
 */
export function handleMultiDaySelection(
  clickedDate: dayjs.Dayjs,
  source: ProcessedRecord,
  selectedDates: Set<string>
): Set<string> {
  const spanDays = source.spanInfo?.spanDays ?? 1;
  
  // Генерируем все даты span начиная с clickedDate
  const spanDates: string[] = [];
  for (let i = 0; i < spanDays; i++) {
    spanDates.push(formatDateForInternal(clickedDate.add(i, 'day')) ?? clickedDate.add(i, 'day').format('YYYY-MM-DD'));
  }
  
  // Проверяем, является ли clicked date частью уже выбранного span
  // Для этого проверяем не только саму дату, но и потенциальные spans,
  // которые могут включать эту дату
  let existingSpanDates: string[] | null = null;
  
  if (spanDays > 1) {
    // Проверяем все возможные начала span, которые могут включать clicked date
    for (let offset = 0; offset < spanDays; offset++) {
      const potentialStart = clickedDate.subtract(offset, 'day');
      const testSpan: string[] = [];
      
      for (let i = 0; i < spanDays; i++) {
        testSpan.push(formatDateForInternal(potentialStart.add(i, 'day')) ?? potentialStart.add(i, 'day').format('YYYY-MM-DD'));
      }
      
      // Если все даты этого span выбраны, значит это existing span
      if (testSpan.every(d => selectedDates.has(d))) {
        existingSpanDates = testSpan;
        break;
      }
    }
  } else {
    // Для single-day просто проверяем эту дату
    const clickedDateKey = formatDateForInternal(clickedDate) ?? clickedDate.format('YYYY-MM-DD');
    if (selectedDates.has(clickedDateKey)) {
      existingSpanDates = [clickedDateKey];
    }
  }
  
  const newSelected = new Set(selectedDates);
  
  if (existingSpanDates) {
    // Убираем существующий span
    existingSpanDates.forEach(d => newSelected.delete(d));
  } else {
    // Добавляем новый span начиная с clicked date
    spanDates.forEach(d => newSelected.add(d));
  }
  
  return newSelected;
}

/**
 * Группирует выбранные даты в spans для создания дубликатов
 * Возвращает массив start dates (не все даты, а только начала spans)
 */
export function getSpanStartDates(
  selectedDates: Set<string>,
  spanDays: number
): dayjs.Dayjs[] {
  if (spanDays <= 1) {
    // Для обычных событий возвращаем все даты
    return Array.from(selectedDates).map(d => dayjs(d));
  }
  
  // Для multi-day сортируем даты и группируем в spans
  const sorted = Array.from(selectedDates)
    .map(d => dayjs(d))
    .sort((a, b) => a.unix() - b.unix());
  
  const startDates: dayjs.Dayjs[] = [];
  let i = 0;
  
  while (i < sorted.length) {
    const currentStart = sorted[i];
    if (!currentStart) break;
    
    startDates.push(currentStart);
    
    // Проверяем, есть ли последовательные даты для span
    let consecutiveCount = 1;
    for (let j = i + 1; j < sorted.length && consecutiveCount < spanDays; j++) {
      const expectedNext = currentStart.add(consecutiveCount, 'day');
      const nextDate = sorted[j];
      if (nextDate && nextDate.isSame(expectedNext, 'day')) {
        consecutiveCount++;
      } else {
        break;
      }
    }
    
    // Пропускаем дни, которые входят в этот span
    i += consecutiveCount;
  }
  
  return startDates;
}

/**
 * Проверяет, является ли дата частью уже выбранного span
 */
export function isDateInSelectedSpan(
  date: dayjs.Dayjs,
  selectedDates: Set<string>,
  spanDays: number
): boolean {
  const dateKey = formatDateForInternal(date) ?? date.format('YYYY-MM-DD');
  if (spanDays <= 1) return selectedDates.has(dateKey);
  
  if (selectedDates.has(dateKey)) return true;
  
  // Проверяем, не является ли эта дата частью span, который начинается раньше
  for (let i = 1; i < spanDays; i++) {
    const potentialStart = formatDateForInternal(date.subtract(i, 'day')) ?? date.subtract(i, 'day').format('YYYY-MM-DD');
    if (selectedDates.has(potentialStart)) {
      // Проверяем, что весь span выбран
      let isFullSpan = true;
      for (let j = 0; j < spanDays; j++) {
        const spanDate = formatDateForInternal(date.subtract(i - j, 'day')) ?? date.subtract(i - j, 'day').format('YYYY-MM-DD');
        if (!selectedDates.has(spanDate)) {
          isFullSpan = false;
          break;
        }
      }
      if (isFullSpan) return true;
    }
  }
  
  return false;
}
