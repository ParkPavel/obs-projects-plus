/**
 * R1.5 — Property type registry
 *
 * The Visualizer pane (and, in R2, the Database canvas) lets the user
 * declare an explicit type for each frontmatter key, overriding the
 * inferred one. The override is persisted in a sibling frontmatter
 * key — `pp_types` — so it travels with the note.
 *
 * Types here intentionally mirror the existing `data-types` i18n
 * namespace (see translations/*.json) so the popup labels are reused
 * verbatim.
 *
 * Pure module — no I/O.
 */

export const PROPERTY_TYPES = [
  "string",
  "number",
  "boolean",
  "date",
  "datetime",
  "list",
  "tags",
  "select",
  "status",
  "color",
  "relation",
  "formula",
  "rollup",
  "url",
  "email",
  "phone",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const TYPES_KEY = "pp_types";

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
// REFACTOR-105: wikilink detection delegated to engine kernel.
import { isWikilink } from "src/lib/engine/wikilink";

// PARITY-001 — best-effort autodetect for URL/Email/Phone strings so that
// existing notes light up new renderers without manual type override.
// Conservative regexes: false negatives are preferable to false positives
// (which would convert legitimate text into clickable links).
const URL_RE = /^https?:\/\/[^\s<>"]{2,}$/i;
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const PHONE_RE = /^[+]?[\d\s().-]{7,}$/;

/**
 * Best-effort type inference from a single value. Falls back to `"string"`
 * for any value that doesn't match a more specific shape.
 */
export function inferType(value: unknown): PropertyType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) {
    if (value.every((x) => typeof x === "string" && isWikilink(x))) {
      return "relation";
    }
    return "list";
  }
  if (typeof value === "string") {
    if (HEX_COLOR_RE.test(value)) return "color";
    if (ISO_DATETIME_RE.test(value)) return "datetime";
    if (ISO_DATE_RE.test(value)) return "date";
    if (isWikilink(value)) return "relation";
    // PARITY-001: URL must precede phone (urls can contain digits/dots).
    if (URL_RE.test(value)) return "url";
    if (EMAIL_RE.test(value)) return "email";
    // Phone last — most permissive pattern, easy to false-positive on
    // freeform numbers. Only matches when value is "phone-shaped".
    if (PHONE_RE.test(value) && /\d{7,}/.test(value.replace(/\D/g, ""))) {
      return "phone";
    }
  }
  return "string";
}

/** Read the `pp_types` map from frontmatter, dropping non-string entries. */
export function readPropertyTypes(
  frontmatter: Record<string, unknown> | null | undefined,
): Record<string, PropertyType> {
  if (!frontmatter) return {};
  const raw = frontmatter[TYPES_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: Record<string, PropertyType> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value !== "string") continue;
    if ((PROPERTY_TYPES as readonly string[]).includes(value)) {
      out[key] = value as PropertyType;
    }
  }
  return out;
}

/**
 * Resolve the effective type for a key: explicit override wins, otherwise
 * fall back to inference on the live value.
 */
export function resolveType(
  key: string,
  value: unknown,
  overrides: Record<string, PropertyType>,
): PropertyType {
  return overrides[key] ?? inferType(value);
}
