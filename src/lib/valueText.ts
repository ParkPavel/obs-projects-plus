/**
 * A value as text, the way `String(v)` gives it for primitives, dates and
 * lists. A plain object reads as JSON rather than "[object Object]" — which,
 * as a key or a cell, would make every object the same.
 */
export function valueText(v: unknown): string {
  if (v === null || v === undefined || Array.isArray(v) || v instanceof Date) return String(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v as string | number | boolean | bigint | symbol);
}
