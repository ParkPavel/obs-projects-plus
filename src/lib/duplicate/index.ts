export { createPhantomRecord, isPhantomRecord, createPhantomRecordsForDates } from './phantomRecord';
export { detectCollision, detectCollisionsForPhantoms, hasCriticalCollisions } from './collisionDetector';
export { handleMultiDaySelection, getSpanStartDates, isDateInSelectedSpan } from './multiDaySelection';
export type { DuplicateState, CollisionInfo, DuplicateOptions, DuplicateConfirmResult } from './types';
