import { writable, get } from 'svelte/store';
import dayjs from 'dayjs';
import { formatDateForInternal } from '../helpers';
import type { ProcessedRecord, ProcessedCalendarData } from '../../ui/views/Calendar/types';
import type { DuplicateState } from '../duplicate';
import { 
  createPhantomRecordsForDates, 
  detectCollisionsForPhantoms,
  handleMultiDaySelection,
  getSpanStartDates
} from '../duplicate';

const initialState: DuplicateState = {
  sourceRecord: null,
  sourceDate: null,
  editedTime: null,
  selectedDates: new Set<string>(),
  hoveredDate: null,
  phantomRecords: new Map(),
  collisions: new Map(),
};

function createDuplicateStore() {
  const { subscribe, set, update } = writable<DuplicateState>(initialState);
  
  // Хранилище для existingData (отдельно, чтобы не вызывать лишних обновлений)
  let existingDataCache: ProcessedCalendarData | null = null;
  
  return {
    subscribe,
    
    /**
     * Инициализация store с source record
     * Автоматически выбирает исходную дату события (или весь span для multi-day)
     */
    init(source: ProcessedRecord, existingData: ProcessedCalendarData): void {
      existingDataCache = existingData;
      
      // Для multi-day автоматически выбираем весь span исходного события
      const initialSelected = new Set<string>();
      if (source.startDate) {
        const spanDays = source.spanInfo?.spanDays ?? 1;
        for (let i = 0; i < spanDays; i++) {
          const dateKey = formatDateForInternal(source.startDate.add(i, 'day')) ?? source.startDate.add(i, 'day').format('YYYY-MM-DD');
          initialSelected.add(dateKey);
        }
      }
      
      // Создаём phantom records для исходной даты
      const editedTime = source.timeInfo ? {
        startTime: source.timeInfo.startTime,
        endTime: source.timeInfo.endTime,
      } : null;
      
      const phantoms = createPhantomRecordsForDates(
        source,
        initialSelected,
        editedTime
      );
      
      // Вычисляем коллизии
      const collisions = detectCollisionsForPhantoms(phantoms, existingData.grouped);
      
      set({
        sourceRecord: source,
        sourceDate: source.startDate,
        editedTime,
        selectedDates: initialSelected,
        hoveredDate: null,
        phantomRecords: phantoms,
        collisions,
      });
    },
    
    /**
     * Установить start time
     */
    setStartTime(time: dayjs.Dayjs): void {
      update(state => {
        if (!state.editedTime) return state;
        
        const newEditedTime = {
          ...state.editedTime,
          startTime: time,
        };
        
        // Пересоздаём phantom records с новым временем
        const phantoms = createPhantomRecordsForDates(
          state.sourceRecord!,
          state.selectedDates,
          newEditedTime
        );
        
        // Пересчитываем коллизии
        const collisions = existingDataCache
          ? detectCollisionsForPhantoms(phantoms, existingDataCache.grouped)
          : new Map();
        
        return {
          ...state,
          editedTime: newEditedTime,
          phantomRecords: phantoms,
          collisions,
        };
      });
    },
    
    /**
     * Установить end time
     */
    setEndTime(time: dayjs.Dayjs): void {
      update(state => {
        if (!state.editedTime) return state;
        
        const newEditedTime = {
          ...state.editedTime,
          endTime: time,
        };
        
        // Пересоздаём phantom records с новым временем
        const phantoms = createPhantomRecordsForDates(
          state.sourceRecord!,
          state.selectedDates,
          newEditedTime
        );
        
        // Пересчитываем коллизии
        const collisions = existingDataCache
          ? detectCollisionsForPhantoms(phantoms, existingDataCache.grouped)
          : new Map();
        
        return {
          ...state,
          editedTime: newEditedTime,
          phantomRecords: phantoms,
          collisions,
        };
      });
    },
    
    /**
     * Сбросить время к оригинальному
     */
    resetTime(): void {
      update(state => {
        if (!state.sourceRecord?.timeInfo) return state;
        
        const originalTime = {
          startTime: state.sourceRecord.timeInfo.startTime,
          endTime: state.sourceRecord.timeInfo.endTime,
        };
        
        // Пересоздаём phantom records с оригинальным временем
        const phantoms = createPhantomRecordsForDates(
          state.sourceRecord,
          state.selectedDates,
          originalTime
        );
        
        // Пересчитываем коллизии
        const collisions = existingDataCache
          ? detectCollisionsForPhantoms(phantoms, existingDataCache.grouped)
          : new Map();
        
        return {
          ...state,
          editedTime: originalTime,
          phantomRecords: phantoms,
          collisions,
        };
      });
    },
    
    /**
     * Toggle выбор даты (с учётом multi-day логики)
     */
    toggleDate(date: dayjs.Dayjs): void {
      update(state => {
        if (!state.sourceRecord) return state;
        
        const newSelected = handleMultiDaySelection(
          date,
          state.sourceRecord,
          state.selectedDates
        );
        
        // Создаём phantom records для выбранных дат
        const phantoms = createPhantomRecordsForDates(
          state.sourceRecord,
          newSelected,
          state.editedTime
        );
        
        // Вычисляем коллизии
        const collisions = existingDataCache
          ? detectCollisionsForPhantoms(phantoms, existingDataCache.grouped)
          : new Map();
        
        return {
          ...state,
          selectedDates: newSelected,
          phantomRecords: phantoms,
          collisions,
        };
      });
    },
    
    /**
     * Очистить выбор
     */
    clearSelection(): void {
      update(state => ({
        ...state,
        selectedDates: new Set<string>(),
        phantomRecords: new Map(),
        collisions: new Map(),
      }));
    },
    
    /**
     * Установить hovered дату (для preview)
     */
    setHoveredDate(date: dayjs.Dayjs | null): void {
      update(state => ({
        ...state,
        hoveredDate: date,
      }));
    },
    
    /**
     * Получить массив выбранных дат для создания дубликатов
     */
    getTargetDates(): dayjs.Dayjs[] {
      const state = get({ subscribe });
      if (!state.sourceRecord) return [];
      
      const spanDays = state.sourceRecord.spanInfo?.spanDays ?? 1;
      return getSpanStartDates(state.selectedDates, spanDays);
    },
    
    /**
     * Получить merged data для отображения (existing + phantoms)
     */
    getMergedData(): ProcessedCalendarData | null {
      const state = get({ subscribe });
      if (!existingDataCache) return null;
      
      const merged: ProcessedCalendarData = {
        ...existingDataCache,
        processed: [
          ...existingDataCache.processed,
          ...Array.from(state.phantomRecords.values()),
        ],
      };
      
      // Мержим grouped данные
      merged.grouped = { ...existingDataCache.grouped };
      state.phantomRecords.forEach((phantom, dateStr) => {
        if (!merged.grouped[dateStr]) {
          merged.grouped[dateStr] = [];
        }
        merged.grouped[dateStr] = [...merged.grouped[dateStr], phantom];
      });
      
      return merged;
    },
    
    /**
     * Проверить, есть ли коллизии
     */
    hasCollisions(): boolean {
      const state = get({ subscribe });
      return state.collisions.size > 0;
    },
    
    /**
     * Сброс состояния
     */
    reset(): void {
      existingDataCache = null;
      set(initialState);
    },
  };
}

export const duplicateStore = createDuplicateStore();
