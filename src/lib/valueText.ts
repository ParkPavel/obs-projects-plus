/**
 * A value as text, the way `String(v)` gives it for primitives, dates and
 * lists. A plain object reads as JSON rather than "[object Object]" — which,
 * as a key or a cell, would make every object the same. An object JSON cannot
 * write (a cycle, a BigInt inside) falls back to what String() gave, so this
 * never throws.
 */
export function valueText(v: unknown): string {
  if (v === null || v === undefined || Array.isArray(v) || v instanceof Date) return String(v);
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return Object.prototype.toString.call(v);
    }
  }
  return String(v as string | number | boolean | bigint | symbol);
}
