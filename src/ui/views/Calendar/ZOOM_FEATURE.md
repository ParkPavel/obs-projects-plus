# Zoom Feature Documentation

## Overview

The zoom functionality in the OBS Projects Plus Calendar view provides progressive view switching through mouse wheel, keyboard shortcuts, and touch gestures. This feature allows users to smoothly transition between different time scales (Month → Week → Day) with cursor-based date targeting.

## Features

### 🎯 Progressive View Hierarchy
The zoom system operates through 5 distinct zoom levels:

1. **Month View** - Overview of entire month with infinite scroll
2. **2-Week View** - Bi-weekly overview with traditional calendar layout
3. **Week View** - Traditional weekly view (7 days)
4. **3-Day View** - Compact 3-day overview
5. **Day View** - Detailed single-day view

### 🖱️ Mouse & Keyboard Controls

#### Mouse Wheel Zoom (Ctrl + Wheel)
- **Scroll Up (Ctrl + ⬆️)** → Zoom In (Month → Week → Day)
- **Scroll Down (Ctrl + ⬇️)** → Zoom Out (Day → Week → Month)
- **Cursor Position Tracking** → Automatically centers on date under cursor
- **Smart Throttling** → Prevents rapid zooming (150ms intervals)
- **Interactive Element Protection** → Won't interfere with form inputs

#### Keyboard Shortcuts (Ctrl/⌘ + Keys)
- **Ctrl/⌘ + '='** or **Ctrl/⌘ + '+'** → Zoom In
- **Ctrl/⌘ + '-'** or **Ctrl/⌘ + '_'** → Zoom Out
- **Form Protection** → Won't interfere with form inputs or buttons

### 👆 Touch Gesture Support

#### Pinch-to-Zoom
- **Two-Finger Pinch Out** → Zoom In (increase detail level)
- **Two-Finger Pinch In** → Zoom Out (decrease detail level)
- **Threshold-Based** → Requires 50px distance change to trigger
- **Smooth Transitions** → Maintains gesture state during zoom

## Technical Implementation

### Core Components

#### 1. Zoom Utilities (`calendar.ts`)
```typescript
// Zoom hierarchy definition
export const ZOOM_HIERARCHY: ZoomLevel[] = [
  { interval: "month", order: 0 },
  { interval: "2weeks", order: 1 },
  { interval: "week", order: 2 },
  { interval: "3days", order: 3 },
  { interval: "day", order: 4 }
];

// Core zoom functions
export function getNextZoomLevel(current: CalendarInterval): CalendarInterval
export function getPreviousZoomLevel(current: CalendarInterval): CalendarInterval
export function getZoomLevelFromWheel(current: CalendarInterval, deltaY: number): CalendarInterval
```

#### 2. Cursor-Based Date Detection
```typescript
export function getDateFromMousePosition(
  mouseX: number,
  mouseY: number,
  calendarElement: HTMLElement,
  interval: CalendarInterval,
  anchorDate: dayjs.Dayjs,
  firstDayOfWeek: number
): dayjs.Dayjs
```

#### 3. Zoom Event Handlers (`CalendarView.svelte`)
- `handleWheelZoom()` - Mouse wheel event processing
- `handleKeyboardZoom()` - Keyboard shortcut processing  
- `handleTouchStart/Move/End()` - Touch gesture processing

### Event Flow

1. **User Input** → Wheel, keyboard, or touch gesture
2. **Validation** → Check if zoom should apply (Ctrl key, not on interactive elements)
3. **Cursor Analysis** → Determine date under cursor position
4. **Zoom Calculation** → Get next/previous zoom level from hierarchy
5. **State Update** → Update interval and anchor date
6. **UI Refresh** → Trigger re-render with new view configuration

### Integration Points

#### With Existing Navigation
- **Complementary Design** → Works alongside traditional navigation buttons
- **State Preservation** → Maintains current anchor date during transitions
- **Configuration Sync** → Updates interval in view configuration
- **Infinite Grid Support** → Special handling for month view's infinite scroll

#### With Settings System
- **Configuration Storage** → Interval changes saved to user preferences
- **First Day of Week** → Respects user's locale settings
- **Field Dependencies** → Maintains date field selection across zoom levels

## User Experience

### Smooth Transitions
- **No "сквозного пролистывания"** → Avoids jarring page transitions
- **Throttled Events** → Prevents rapid, unintended zooming
- **Visual Feedback** → Focus indicators and smooth animations
- **Context Preservation** → Maintains cursor position and selection

### Accessibility
- **Keyboard Support** → Full zoom functionality via shortcuts
- **Focus Management** → Proper focus handling for screen readers
- **Touch Optimization** → Intuitive pinch gestures for touch devices
- **Error Prevention** → Guards against zooming beyond limits

### Performance
- **Event Throttling** → 150ms minimum between zoom events
- **Efficient Calculation** → Optimized date arithmetic using dayjs
- **Memory Management** → Proper cleanup of touch gesture state
- **Reactive Updates** → Leverages Svelte's reactivity for smooth UI updates

## Usage Examples

### Basic Zoom Operations
```javascript
// Zoom from month to week view
currentInterval: "month" → scroll up → "week"

// Zoom from day to month view  
currentInterval: "day" → scroll down → "month" → "week" → "month"

// Keyboard zoom
currentInterval: "week" → Ctrl + "+" → "3days"
```

### Cursor-Based Targeting
```javascript
// When zooming from month view:
// - User hovers cursor over "March 15th"
// - Zoom triggers zoom-in to week view
// - Anchor date automatically sets to March 15th
// - Week view centers on that date
```

### Touch Gestures
```javascript
// Two-finger pinch on tablet:
// - Start: month view
// - Pinch out → week view  
// - Pinch out again → 3days view
// - Pinch in → week view
```

## Error Handling

### Edge Cases
- **Reached Limits** → No zoom beyond first/last levels
- **Invalid Dates** → Graceful handling of edge dates
- **Gesture Conflicts** → Proper cleanup when gestures end unexpectedly
- **Event Prevention** → Correct preventDefault/stopPropagation usage

### State Management
- **Zoom State** → Proper cleanup of throttle timers
- **Touch State** → Reset touch distances and intervals
- **Configuration** → Synchronized interval updates
- **Calendar State** → Maintains anchor date integrity

## Future Enhancements

### Planned Improvements
- **Hour View** → Add hourly breakdown as final zoom level
- **Custom Zoom Levels** → Allow user-defined zoom sequences
- **Zoom History** → Remember zoom states for quick navigation
- **Visual Indicators** → Show current zoom level with breadcrumbs

### Advanced Features
- **Zoom Constraints** → Limit zoom levels per project type
- **Gesture Customization** → Allow users to adjust thresholds
- **Keyboard Shortcuts** → Add more zoom-related shortcuts
- **Animation Options** → Customizable zoom transition effects

## Configuration

### Zoom Settings
```typescript
interface ZoomConfig {
  throttleMs: number;        // Event throttling interval
  touchThreshold: number;     // Minimum pinch distance
  preserveDate: boolean;      // Maintain cursor date during zoom
  keyboardEnabled: boolean;   // Enable keyboard shortcuts
  touchEnabled: boolean;      // Enable touch gestures
}
```

### Default Values
```typescript
ZOOM_CONFIG = {
  throttleMs: 150,
  touchThreshold: 50,
  preserveDate: true,
  keyboardEnabled: true,
  touchEnabled: true
}
```

## Troubleshooting

### Common Issues
1. **Zoom Not Triggering** → Check Ctrl key requirement
2. **Touch Gestures Not Working** → Verify two-finger detection
3. **Date Jumping** → Check cursor position detection
4. **Rapid Zooming** → Verify throttle settings

### Debug Tools
```typescript
// Console logging for zoom debugging
console.log('Zoom:', currentInterval, '→', newInterval);
console.log('Target Date:', targetDate.format('YYYY-MM-DD'));
console.log('Event:', event.type, event.deltaY);
```

## API Reference

### Public Functions
- `getZoomLevelFromWheel(interval, deltaY)` → Calculate zoom level from wheel event
- `getDateFromMousePosition(x, y, element, interval, anchor, firstDay)` → Extract date from cursor
- `shouldApplyZoom(event, target)` → Check if zoom should apply

### Event Handlers
- `handleWheelZoom(event)` → Process mouse wheel zoom events
- `handleKeyboardZoom(event)` → Process keyboard zoom shortcuts
- `handleTouchStart/Move/End(event)` → Process touch gesture events

---

**Last Updated:** November 16, 2025  
**Version:** 1.0.0  
**Author:** OBS Projects Plus Development Team