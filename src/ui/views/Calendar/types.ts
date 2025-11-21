import type { CalendarInterval } from "./calendar";

export interface CalendarConfig {
  readonly interval?: CalendarInterval;
  readonly dateField?: string;
  readonly checkField?: string;
}

// Zoom functionality interfaces
export interface ZoomTarget {
  date: Date;
  interval: CalendarInterval;
}

export interface ZoomLevel {
  interval: CalendarInterval;
  order: number; // Lower number = zoomed out, higher = zoomed in
}

export const ZOOM_HIERARCHY: ZoomLevel[] = [
  { interval: "month", order: 0 },
  { interval: "2weeks", order: 1 },
  { interval: "week", order: 2 },
  { interval: "3days", order: 3 },
  { interval: "day", order: 4 }
];
