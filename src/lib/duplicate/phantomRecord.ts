import dayjs from "dayjs";
import { formatDateForInternal } from "src/lib/helpers";
import type { ProcessedRecord } from "../../ui/views/Calendar/types";

/**
 * Создаёт "фантомную" запись для предпросмотра дубликата
 * Phantom record не сохраняется — только для визуализации
 */
export function createPhantomRecord(
  source: ProcessedRecord,
  targetDate: dayjs.Dayjs,
  editedTime?: { startTime: dayjs.Dayjs; endTime: dayjs.Dayjs } | null
): ProcessedRecord {
  const phantom: ProcessedRecord = {
    ...source,
    record: {
      ...source.record,
      id: `phantom_${source.record.id}_${formatDateForInternal(targetDate)}`,
    },
    
    // Пересчитать даты
    startDate: recalculateStartDate(source, targetDate),
    endDate: recalculateEndDate(source, targetDate),
    
    // Пересчитать время (если есть)
    timeInfo: source.timeInfo ? {
      ...source.timeInfo,
      startTime: editedTime 
        ? setTimeOnDate(targetDate, editedTime.startTime)
        : recalculateTime(source.timeInfo.startTime, targetDate),
      endTime: editedTime
        ? (source.spanInfo 
          ? setTimeOnDate(targetDate.add(source.spanInfo.spanDays - 1, 'day'), editedTime.endTime)
          : setTimeOnDate(targetDate, editedTime.endTime))
        : (source.spanInfo
          ? recalculateTime(source.timeInfo.endTime, targetDate.add(source.spanInfo.spanDays - 1, 'day'))
          : recalculateTime(source.timeInfo.endTime, targetDate)),
      durationMinutes: editedTime
        ? editedTime.endTime.diff(editedTime.startTime, 'minute')
        : source.timeInfo.durationMinutes,
    } : null,
    
    // Пересчитать span (если multi-day)
    spanInfo: source.spanInfo ? {
      startDate: targetDate,
      endDate: targetDate.add(source.spanInfo.spanDays - 1, 'day'),
      spanDays: source.spanInfo.spanDays,
    } : null,
    
    // Lane будет назначена отдельно при рендеринге
    lane: source.lane,
  };
  
  // Добавляем кастомное свойство для идентификации phantom
  (phantom as any).isPhantom = true;
  
  return phantom;
}

/**
 * Пересчитывает start date для дубликата
 */
function recalculateStartDate(
  source: ProcessedRecord,
  targetDate: dayjs.Dayjs
): dayjs.Dayjs {
  return targetDate;
}

/**
 * Пересчитывает end date для дубликата
 */
function recalculateEndDate(
  source: ProcessedRecord,
  targetDate: dayjs.Dayjs
): dayjs.Dayjs | null {
  if (!source.spanInfo) {
    return targetDate;
  }
  return targetDate.add(source.spanInfo.spanDays - 1, 'day');
}

/**
 * Пересчитывает время на новую дату (сохраняя часы:минуты)
 */
function recalculateTime(
  sourceTime: dayjs.Dayjs,
  targetDate: dayjs.Dayjs
): dayjs.Dayjs {
  return targetDate
    .hour(sourceTime.hour())
    .minute(sourceTime.minute())
    .second(sourceTime.second());
}

/**
 * Устанавливает время из одной даты на другую дату
 */
function setTimeOnDate(
  date: dayjs.Dayjs,
  time: dayjs.Dayjs
): dayjs.Dayjs {
  return date
    .hour(time.hour())
    .minute(time.minute())
    .second(time.second());
}

/**
 * Проверяет, является ли запись phantom
 */
export function isPhantomRecord(record: ProcessedRecord): boolean {
  return (record as any).isPhantom === true;
}

/**
 * Создаёт несколько phantom records для выбранных дат
 */
export function createPhantomRecordsForDates(
  source: ProcessedRecord,
  dates: Set<string>,
  editedTime?: { startTime: dayjs.Dayjs; endTime: dayjs.Dayjs } | null
): Map<string, ProcessedRecord> {
  const phantoms = new Map<string, ProcessedRecord>();
  
  dates.forEach(dateStr => {
    const targetDate = dayjs(dateStr);
    const phantom = createPhantomRecord(source, targetDate, editedTime);
    phantoms.set(dateStr, phantom);
  });
  
  return phantoms;
}
