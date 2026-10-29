import dayjs from "dayjs";
import { operandNumber } from "./computedFunctions";

function dateTime(value: unknown): number | undefined {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.valueOf() : undefined;
  }
  if (value !== null && typeof value === "object") {
    // Native Date brand checking also accepts dates from another window.
    try { return Date.prototype.getTime.call(value); } catch { return undefined; }
  }
  return undefined;
}

type Comparable = { kind: "number"; left: number; right: number } | { kind: "text"; left: string; right: string };

function comparisonNumber(value: unknown, booleanText: boolean): number | null {
  if (booleanText && typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (text === "true") return 1;
    if (text === "false") return 0;
  }
  return operandNumber(value);
}

/** Equality and order consume exactly the same normalized scalar operands. */
function comparable(left: unknown, right: unknown): Comparable | null {
  if (left == null || right == null) return null;
  const leftDate = dateTime(left), rightDate = dateTime(right);
  if (leftDate !== undefined && rightDate !== undefined) {
    return Number.isFinite(leftDate) && Number.isFinite(rightDate) ? { kind: "number", left: leftDate, right: rightDate } : null;
  }
  if ((typeof left === "object" && leftDate !== undefined) || (typeof right === "object" && rightDate !== undefined)) return null;
  const boolean = typeof left === "boolean" || typeof right === "boolean";
  if (boolean || typeof left === "number" || typeof right === "number") {
    const a = comparisonNumber(left, boolean), b = comparisonNumber(right, boolean);
    return a !== null && b !== null ? { kind: "number", left: a, right: b } : null;
  }
  if (typeof left === "string" && typeof right === "string") {
    return { kind: "text", left: left.trim().toLowerCase(), right: right.trim().toLowerCase() };
  }
  return null;
}

export function sharedEquals(left: unknown, right: unknown): boolean {
  if (left == null || right == null) return left == null && right == null;
  const pair = comparable(left, right);
  if (pair) return pair.left === pair.right;
  // Invalid numbers/Dates are not values; other objects retain identity equality.
  return left === right && typeof left !== "number" && dateTime(left) === undefined;
}

/** Missing/incompatible values have no order; text order is deterministic. */
export function sharedCompare(left: unknown, right: unknown): number | null {
  const pair = comparable(left, right);
  if (!pair) return null;
  if (pair.kind === "number") return pair.left - pair.right;
  return pair.left === pair.right ? 0 : pair.left < pair.right ? -1 : 1;
}
