// src/ui/views/Database/engine/conditionalFormat.ts
// Evaluates conditional formatting rules against records.

import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { ConditionalFormat, ConditionalFormatRule, CellStyle } from "../types";
import type { FilterCondition, FilterOperator } from "src/settings/base/settings";
import { matchesCondition } from "src/ui/app/filterFunctions";

/**
 * Computed cell style for a single field in a record.
 * Merges all matching rules (later rules override earlier).
 */
export function computeCellStyle(
  formats: ConditionalFormat[],
  fieldName: string,
  record: DataRecord
): CellStyle | null {
  let merged: CellStyle | null = null;

  for (const fmt of formats) {
    if (fmt.field !== fieldName) continue;

    for (const rule of fmt.conditions) {
      if (ruleMatches(rule, fieldName, record)) {
        merged = mergeStyles(merged, rule.style);
      }
    }
  }

  return merged;
}

/**
 * Compute styles for ALL fields in a single record.
 * Returns a map: fieldName → CellStyle (only for fields with active rules).
 */
export function computeRowStyles(
  formats: ConditionalFormat[],
  record: DataRecord
): Record<string, CellStyle> {
  const result: Record<string, CellStyle> = {};

  for (const fmt of formats) {
    for (const rule of fmt.conditions) {
      if (ruleMatches(rule, fmt.field, record)) {
        const existing = result[fmt.field];
        result[fmt.field] = mergeStyles(existing ?? null, rule.style) ?? rule.style;
      }
    }
  }

  return result;
}

/** Validate CSS color value to prevent CSS injection. */
const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)|rgba\(\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*[\d.]+\)|[a-zA-Z]{1,20})$/;

export function sanitizeColor(value: string): string | null {
  return SAFE_COLOR.test(value) ? value : null;
}

/**
 * Convert a CellStyle to a CSS style string for inline application.
 */
export function cellStyleToCSS(style: CellStyle): string {
  const parts: string[] = [];
  if (style.backgroundColor) {
    const safe = sanitizeColor(style.backgroundColor);
    if (safe) parts.push(`background-color: ${safe}`);
  }
  if (style.textColor) {
    const safe = sanitizeColor(style.textColor);
    if (safe) parts.push(`color: ${safe}`);
  }
  if (style.bold) parts.push("font-weight: 700");
  if (style.italic) parts.push("font-style: italic");
  return parts.join("; ");
}

// ── Internal ─────────────────────────────────────────────────

/** Known operators from FilterOperator. Reject unknown to prevent silent failures. */
const VALID_OPERATORS = new Set<string>([
  "is", "is-not", "contains", "not-contains",
  "starts-with", "ends-with",
  "eq", "neq", "lt", "gt", "lte", "gte",
  "is-empty", "is-not-empty",
  "is-checked", "is-not-checked",
]);

function ruleMatches(
  rule: ConditionalFormatRule,
  field: string,
  record: DataRecord
): boolean {
  if (!VALID_OPERATORS.has(rule.operator)) {
    return false;
  }

  const condition: FilterCondition = {
    field,
    operator: rule.operator as FilterOperator,
    value: rule.value ?? "",
    enabled: true,
  };

  return matchesCondition(condition, record);
}

function mergeStyles(
  base: CellStyle | null,
  overlay: CellStyle
): CellStyle {
  const result: Record<string, string | boolean> = {};
  const bg = overlay.backgroundColor ?? base?.backgroundColor;
  const tc = overlay.textColor ?? base?.textColor;
  const b = overlay.bold ?? base?.bold;
  const it = overlay.italic ?? base?.italic;
  if (bg !== undefined) result["backgroundColor"] = bg;
  if (tc !== undefined) result["textColor"] = tc;
  if (b !== undefined) result["bold"] = b;
  if (it !== undefined) result["italic"] = it;
  return result as unknown as CellStyle;
}
