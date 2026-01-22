import type dayjs from "dayjs";
import type { ProcessedRecord } from "../../ui/views/Calendar/types";

/**
 * Состояние DuplicatePopup
 */
export interface DuplicateState {
  // === Источник ===
  sourceRecord: ProcessedRecord | null;
  sourceDate: dayjs.Dayjs | null;
  
  // === Редактирование времени (TIMED события) ===
  editedTime: {
    startTime: dayjs.Dayjs;
    endTime: dayjs.Dayjs;
  } | null;
  
  // === Выбор ===
  selectedDates: Set<string>;       // YYYY-MM-DD формат
  hoveredDate: dayjs.Dayjs | null;  // Дата под курсором
  
  // === Phantom records (preview) ===
  phantomRecords: Map<string, ProcessedRecord>;  // date → phantom
  
  // === Коллизии ===
  collisions: Map<string, CollisionInfo>; // date → collision details
}

/**
 * Информация о коллизии (наложении событий)
 */
export interface CollisionInfo {
  date: string;
  overlapType: 'time' | 'allday' | 'none';
  overlappingRecords: ProcessedRecord[];
}

/**
 * Опции дублирования
 */
export interface DuplicateOptions {
  copyFrontmatter: boolean;       // Копировать все поля frontmatter
  updateDateFields: boolean;      // Обновить date/time поля
  customTime: {                   // Кастомное время (если редактировалось)
    startTime: dayjs.Dayjs;
    endTime: dayjs.Dayjs;
  } | null;
}

/**
 * Результат подтверждения дублирования
 */
export interface DuplicateConfirmResult {
  sourceRecord: ProcessedRecord;
  targetDates: dayjs.Dayjs[];
  options: DuplicateOptions;
}
