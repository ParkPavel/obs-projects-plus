import type { ViewInspectionTools } from "./projectViewCheck";

export type SchemaLocation = readonly (string | number)[];
export interface ProjectShapeRule {
  readonly required?: boolean;
  readonly inspect: (value: unknown, at: SchemaLocation) => void;
}

/** Trusted schema definitions only. Input remains JSON data, never executable rules. */
export function projectShapeChecks(tools: ViewInspectionTools) {
  const rule = (inspect: ProjectShapeRule["inspect"]): ProjectShapeRule => ({ inspect });
  const scalar = (kind: "string" | "boolean" | "number") => rule((value, at) => { tools.scalar(value, at, kind); });
  const string = scalar("string"), number = scalar("number"), boolean = scalar("boolean");
  const required = (entry: ProjectShapeRule): ProjectShapeRule => ({ ...entry, required: true });
  const enumeration = (values: readonly string[]) => rule((value, at) => tools.enumeration(value, at, new Set(values)));
  const shape = (fields: Readonly<Record<string, ProjectShapeRule>>) => rule((value, at) => {
    const cfg = tools.object(value, at, Object.keys(fields)); if (!cfg) return;
    for (const [key, entry] of Object.entries(fields)) {
      if (Object.prototype.hasOwnProperty.call(cfg, key)) entry.inspect(cfg[key], [...at, key]);
      else if (entry.required) tools.issue([...at, key], "missing-field");
    }
  });
  const array = (entry: ProjectShapeRule, uniqueId?: string) => rule((value, at) => {
    const ids = new Set<string>();
    tools.list(value, at)?.forEach((item, index) => {
      const location = [...at, index]; entry.inspect(item, location);
      if (uniqueId && item && typeof item === "object" && !Array.isArray(item)) {
        const id = (item as Record<string, unknown>)[uniqueId];
        if (typeof id === "string") { if (ids.has(id)) tools.issue([...location, uniqueId], "duplicate-id"); ids.add(id); }
      }
    });
  });
  const dictionary = (entry: ProjectShapeRule) => rule((value, at) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) { tools.issue(at, "invalid-type"); return; }
    for (const [key, item] of Object.entries(value)) entry.inspect(item, [...at, key]);
  });
  const id = rule((value, at) => {
    if (tools.scalar(value, at, "string") && (!(value as string).length || (value as string).length > 512)) tools.issue(at, "invalid-type");
  });
  const objectValue = rule((value, at) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) tools.issue(at, "invalid-type");
  });
  return { rule, string, number, boolean, required, enumeration, shape, array, dictionary, id, objectValue };
}
