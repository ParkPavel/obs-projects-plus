/**
 * S7 — ExportService: export a DataFrame to text formats.
 *
 * All functions are pure (no Obsidian deps) so they can be called from
 * any view. The caller is responsible for writing the file or showing a
 * download dialog.
 */

import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";

export type ExportFormat = "csv" | "tsv" | "json" | "markdown";

// ── Helpers ────────────────────────────────────────────────────

function cellStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(cellStr).join(", ");
  return String(value);
}

function escapeCsv(s: string, sep: string): string {
  if (s.includes(sep) || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ── CSV / TSV ──────────────────────────────────────────────────

function toDelimited(
  records: DataRecord[],
  fields: DataField[],
  sep: string
): string {
  const header = fields.map((f) => escapeCsv(f.name, sep)).join(sep);
  const rows = records.map((r) =>
    fields.map((f) => escapeCsv(cellStr(r.values[f.name]), sep)).join(sep)
  );
  return [header, ...rows].join("\n");
}

export function exportToCsv(records: DataRecord[], fields: DataField[]): string {
  return toDelimited(records, fields, ",");
}

export function exportToTsv(records: DataRecord[], fields: DataField[]): string {
  return toDelimited(records, fields, "\t");
}

// ── JSON ───────────────────────────────────────────────────────

export function exportToJson(records: DataRecord[], fields: DataField[]): string {
  const fieldNames = fields.map((f) => f.name);
  const rows = records.map((r) => {
    const obj: Record<string, unknown> = { _id: r.id };
    for (const name of fieldNames) {
      obj[name] = r.values[name] ?? null;
    }
    return obj;
  });
  return JSON.stringify(rows, null, 2);
}

// ── Markdown table ─────────────────────────────────────────────

export function exportToMarkdown(records: DataRecord[], fields: DataField[]): string {
  const names = fields.map((f) => f.name);
  const mdCell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const header = `| ${names.map(mdCell).join(" | ")} |`;
  const separator = `| ${names.map(() => "---").join(" | ")} |`;
  const rows = records.map(
    (r) => `| ${names.map((n) => mdCell(cellStr(r.values[n]))).join(" | ")} |`
  );
  return [header, separator, ...rows].join("\n");
}

// ── Unified entry point ────────────────────────────────────────

export function exportRecords(
  records: DataRecord[],
  fields: DataField[],
  format: ExportFormat
): string {
  switch (format) {
    case "csv": return exportToCsv(records, fields);
    case "tsv": return exportToTsv(records, fields);
    case "json": return exportToJson(records, fields);
    case "markdown": return exportToMarkdown(records, fields);
  }
}

export function exportMimeType(format: ExportFormat): string {
  switch (format) {
    case "csv": return "text/csv";
    case "tsv": return "text/tab-separated-values";
    case "json": return "application/json";
    case "markdown": return "text/markdown";
  }
}

export function exportFileExtension(format: ExportFormat): string {
  switch (format) {
    case "csv": return ".csv";
    case "tsv": return ".tsv";
    case "json": return ".json";
    case "markdown": return ".md";
  }
}
