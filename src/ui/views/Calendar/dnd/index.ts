/**
 * DnD Module — Timeline Drag & Drop v3.2.0
 *
 * Barrel export for all DnD-related types, classes, and utilities.
 *
 * @module dnd
 */

export * from './types';
export * from './SnapEngine';
export * from './HapticManager';
export { TimelineDragManager } from './TimelineDragManager';
export type { OnDragCommit, TimelineConfig, DayColumnRef } from './TimelineDragManager';
