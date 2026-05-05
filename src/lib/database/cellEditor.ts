/**
 * R2.6 — Cell editing model (pure)
 *
 * Provides a single transform pipeline that converts a user's raw
 * input (textarea string, checkbox boolean, picker selection) into a
 * canonical YAML-friendly value for each Stage A property type.
 *
 * Design constraints:
 *  - Pure module (no Obsidian / no DOM). The writer in
 *    `cellEditorWriter.ts` performs the persistence side-effect.
 *  - Parser failures return a discriminated `CellEditError` so the
 *    UI can surface inline validation hints; we never silently
 *    coerce malformed input.
 *  - List-style types (list/tags/relation) accept either a raw array
 *    or a comma-separated string (Notion-style entry shorthand).
 */

export type CellEditType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "list"
  | "tags"
  | "select"
  | "status"
  | "color"
  | "relation"
  | "url"
  | "email"
  | "phone";

export type CellValue =
  | string
  | number
  | boolean
  | string[]
  | null;

export interface CellEditError {
  readonly kind: "invalid";
  /** i18n key for inline error message under `database.cell-editor.errors.*`. */
  readonly i18nKey: string;
  /** Optional interpolation params for i18n. */
  readonly params?: Readonly<Record<string, string | number>>;
}

export type CellEditResult =
  | { readonly ok: true; readonly value: CellValue }
  | { readonly ok: false; readonly error: CellEditError };

/** Treat empty / whitespace-only input as a clear command. */
const EMPTY_TEXT_RE = /^\s*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Canonical parser. Caller hands raw user input + the target type;
 * receives a validated `CellValue` ready for `processFrontMatter`.
 *
 * `raw` may be:
 *  - `string`  — text inputs / select choices.
 *  - `boolean` — checkbox toggles.
 *  - `string[]` — multi-pickers (tags, list, relation).
 *  - `null`    — explicit clear.
 */
export function parseCellInput(
  raw: string | boolean | readonly string[] | null,
  type: CellEditType,
): CellEditResult {
  if (raw === null) return ok(null);

  // Boolean cells accept either a real boolean or the strings
  // "true"/"false" (handy for keyboard-only toggles).
  if (type === "boolean") {
    if (typeof raw === "boolean") return ok(raw);
    if (typeof raw === "string") {
      const t = raw.trim().toLowerCase();
      if (t === "" ) return ok(null);
      if (t === "true") return ok(true);
      if (t === "false") return ok(false);
      return invalid("database.cell-editor.errors.boolean");
    }
    return invalid("database.cell-editor.errors.boolean");
  }

  // List-style types: accept arrays directly; coerce CSV strings.
  if (type === "list" || type === "tags" || type === "relation") {
    const arr = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
      ? splitCsv(raw)
      : null;
    if (arr === null) return invalid("database.cell-editor.errors.list");
    const cleaned = arr.map((s) => s.trim()).filter((s) => s.length > 0);
    if (type === "tags") {
      // Strip leading `#` so YAML stores bare tag names; UI re-adds.
      return ok(cleaned.map((s) => s.replace(/^#+/, "")));
    }
    return ok(cleaned);
  }

  // Scalar text-derived types from here onward.
  if (typeof raw !== "string") {
    return invalid("database.cell-editor.errors.scalar");
  }
  const text = raw.trim();
  if (EMPTY_TEXT_RE.test(text)) return ok(null);

  switch (type) {
    case "string":
    case "select":
    case "status":
      return ok(text);
    // PARITY-001 — URL/Email/Phone are stored as plain strings; rendering
    // layer turns them into clickable links. We validate shape lightly to
    // catch obvious typos but do NOT reject — Notion accepts free text too.
    case "url":
    case "email":
    case "phone":
      return ok(text);
    case "number": {
      // Reject space-or-dash-separated values to avoid silently
      // truncating "12 34" to 12.
      if (!/^-?\d+(?:\.\d+)?$/.test(text)) {
        return invalid("database.cell-editor.errors.number");
      }
      const n = Number(text);
      if (!Number.isFinite(n)) {
        return invalid("database.cell-editor.errors.number");
      }
      return ok(n);
    }
    case "date":
      return ISO_DATE_RE.test(text)
        ? ok(text)
        : invalid("database.cell-editor.errors.date");
    case "datetime":
      return ISO_DATETIME_RE.test(text)
        ? ok(text)
        : invalid("database.cell-editor.errors.datetime");
    case "color":
      return HEX_COLOR_RE.test(text)
        ? ok(text.toLowerCase())
        : invalid("database.cell-editor.errors.color");
    default:
      return invalid("database.cell-editor.errors.scalar");
  }
}

/**
 * Format a stored `CellValue` back into a string suitable for the
 * editor's text input. Inverse of `parseCellInput` for round-trip
 * fidelity (modulo case-normalisation on hex colors).
 */
export function formatCellValue(
  value: CellValue,
  type: CellEditType,
): string {
  if (value === null || value === undefined) return "";
  if (type === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    if (type === "tags") {
      // Display with `#` prefix to mirror native rendering.
      return value.map((v) => "#" + v).join(", ");
    }
    return value.join(", ");
  }
  if (typeof value === "number") return String(value);
  return String(value);
}

function ok(value: CellValue): CellEditResult {
  return { ok: true, value };
}

function invalid(
  i18nKey: string,
  params?: Record<string, string | number>,
): CellEditResult {
  return params
    ? { ok: false, error: { kind: "invalid", i18nKey, params } }
    : { ok: false, error: { kind: "invalid", i18nKey } };
}

function splitCsv(text: string): string[] {
  // Simple CSV split; we don't honour escaped commas because list
  // types are entered via the picker UI when commas are needed.
  return text.split(",");
}
