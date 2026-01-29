import { formatDateForInternal } from "src/lib/helpers";
import type { ProcessedRecord, TimeInfo } from "../../ui/views/Calendar/types";
import { EventRenderType } from "../../ui/views/Calendar/types";
import type { CollisionInfo } from "./types";

/**
 * Детектирует коллизии между phantom и существующими событиями
 */
export function detectCollision(
  phantom: ProcessedRecord,
  existingRecords: ProcessedRecord[]
): CollisionInfo {
  const overlapping: ProcessedRecord[] = [];
  let overlapType: 'time' | 'allday' | 'none' = 'none';
  
  for (const existing of existingRecords) {
    // Проверка временного наложения (для TIMED событий)
    if (phantom.timeInfo && existing.timeInfo) {
      if (timeRangesOverlap(phantom.timeInfo, existing.timeInfo)) {
        overlapping.push(existing);
        overlapType = 'time';
      }
    }
    
    // Проверка all-day наложения (просто в тот же день)
    else if (
      phantom.renderType === EventRenderType.ALL_DAY ||
      existing.renderType === EventRenderType.ALL_DAY
    ) {
      overlapping.push(existing);
      if (overlapType !== 'time') overlapType = 'allday';
    }
  }
  
  return {
    date: formatDateForInternal(phantom.startDate) ?? (phantom.startDate ? phantom.startDate.format('YYYY-MM-DD') : ''),
    overlapType,
    overlappingRecords: overlapping,
  };
}

/**
 * Проверяет, пересекаются ли два временных диапазона
 */
function timeRangesOverlap(time1: TimeInfo, time2: TimeInfo): boolean {
  const start1 = time1.startTime.unix();
  const end1 = time1.endTime.unix();
  const start2 = time2.startTime.unix();
  const end2 = time2.endTime.unix();
  
  // Два диапазона пересекаются, если:
  // start1 < end2 AND start2 < end1
  return start1 < end2 && start2 < end1;
}

/**
 * Детектирует коллизии для набора phantom records
 */
export function detectCollisionsForPhantoms(
  phantoms: Map<string, ProcessedRecord>,
  groupedExistingData: Record<string, ProcessedRecord[]>
): Map<string, CollisionInfo> {
  const collisions = new Map<string, CollisionInfo>();
  
  phantoms.forEach((phantom, dateStr) => {
    const existingOnDate = groupedExistingData[dateStr] || [];
    const collision = detectCollision(phantom, existingOnDate);
    
    // Сохраняем только если есть реальные наложения
    if (collision.overlappingRecords.length > 0) {
      collisions.set(dateStr, collision);
    }
  });
  
  return collisions;
}

/**
 * Проверяет, есть ли критические коллизии (time overlap)
 */
export function hasCriticalCollisions(collisions: Map<string, CollisionInfo>): boolean {
  for (const collision of collisions.values()) {
    if (collision.overlapType === 'time') {
      return true;
    }
  }
  return false;
}
