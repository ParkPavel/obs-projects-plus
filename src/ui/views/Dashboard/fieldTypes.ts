// src/ui/views/Dashboard/fieldTypes.ts
// Extended field type configurations for Database View (Select, Status)

export interface SelectOption {
  readonly name: string;
  readonly color: string;
}

export interface SelectFieldTypeConfig {
  readonly type: "select";
  readonly options: SelectOption[];
}

export interface StatusGroup {
  readonly name: string;
  readonly color: string;
}

export interface StatusFieldTypeConfig {
  readonly type: "status";
  readonly groups: StatusGroup[];
}

export interface FormulaFieldTypeConfig {
  readonly type: "formula";
  readonly expression: string;
  readonly resultType: "string" | "number" | "date" | "boolean";
  readonly format?: string;
}

export type ExtendedFieldTypeConfig =
  | SelectFieldTypeConfig
  | StatusFieldTypeConfig
  | FormulaFieldTypeConfig;

// ── Default configurations ───────────────────────────────────

export const DEFAULT_STATUS_GROUPS: StatusGroup[] = [
  { name: "To-do", color: "#e74c3c" },
  { name: "In Progress", color: "#3498db" },
  { name: "Done", color: "#2ecc71" },
];

export const DEFAULT_SELECT_COLORS = [
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71",
  "#1abc9c", "#3498db", "#9b59b6", "#95a5a6",
];

// ── Helpers ──────────────────────────────────────────────────

function coloredOptions(value: unknown): value is SelectOption[] {
  if (!Array.isArray(value)) return false;
  for (const option of value as unknown[]) {
    if (!option || typeof option !== "object" || !("name" in option) || !("color" in option) ||
      typeof option.name !== "string" || typeof option.color !== "string") return false;
  }
  return true;
}

export function isSelectConfig(
  config: unknown
): config is SelectFieldTypeConfig {
  return (
    typeof config === "object" &&
    config !== null &&
    "type" in config &&
    (config as Record<string, unknown>)["type"] === "select" &&
    coloredOptions((config as Record<string, unknown>)["options"])
  );
}

export function isStatusConfig(
  config: unknown
): config is StatusFieldTypeConfig {
  return (
    typeof config === "object" &&
    config !== null &&
    "type" in config &&
    (config as Record<string, unknown>)["type"] === "status" &&
    coloredOptions((config as Record<string, unknown>)["groups"])
  );
}

export function isFormulaConfig(
  config: unknown
): config is FormulaFieldTypeConfig {
  return (
    typeof config === "object" &&
    config !== null &&
    "type" in config &&
    (config as Record<string, unknown>)["type"] === "formula"
  );
}

/**
 * Get the color for a Select/Status value.
 * Returns null if no matching option found.
 */
export function getOptionColor(
  config: unknown,
  value: string
): string | null {
  if (isSelectConfig(config)) {
    return config.options.find((o) => o.name === value)?.color ?? null;
  }
  if (isStatusConfig(config)) {
    return config.groups.find((g) => g.name === value)?.color ?? null;
  }
  return null;
}
