import { legacyEquals, legacyCompare } from "./legacyFunctions";
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

/** The new profile fixes boolean-text false positives, preserving date/numeric comparison. */
export function sharedEquals(left: unknown, right: unknown): boolean {
  const leftDate = dateTime(left), rightDate = dateTime(right);
  if (leftDate !== undefined && rightDate !== undefined) return Number.isFinite(leftDate) && Number.isFinite(rightDate) && leftDate === rightDate;
  if ((typeof left === "object" && leftDate !== undefined) || (typeof right === "object" && rightDate !== undefined)) return false;
  if (typeof left === "boolean" && typeof right === "string") {
    const value = right.trim().toLowerCase();
    return (value === "true" || value === "false") && left === (value === "true");
  }
  if (typeof right === "boolean" && typeof left === "string") return sharedEquals(right, left);
  return legacyEquals(left, right);
}

/** Missing values have no order in the new profile; an explicit IS_EMPTY tests them. */
export function sharedCompare(left: unknown, right: unknown): number | null {
  if (left == null || right == null) return null;
  const leftDate = dateTime(left), rightDate = dateTime(right);
  if (leftDate !== undefined && rightDate !== undefined) return Number.isFinite(leftDate) && Number.isFinite(rightDate) ? leftDate - rightDate : null;
  if ((typeof left === "object" && leftDate !== undefined) || (typeof right === "object" && rightDate !== undefined)) return null;
  if (typeof left === "boolean" || typeof right === "boolean") {
    const a = operandNumber(left), b = operandNumber(right);
    return a === null || b === null ? null : a - b;
  }
  return legacyCompare(left, right);
}
