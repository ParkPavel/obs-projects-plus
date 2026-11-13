import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";

type ChoiceField = Pick<DataField, "type" | "typeConfig">;

/** null is unconfigured. An explicit empty schema must stay empty. Filter
 * suggestions deliberately keep their wider historical/observed value pool. */
export function configuredChoiceOptions(field: ChoiceField): string[] | null {
  if (field.type !== DataFieldType.Select && field.type !== DataFieldType.Status) return null;
  const config = field.typeConfig as Record<string, unknown> | undefined;
  if (!config || typeof config !== "object" || Array.isArray(config)) return config ? [] : null;
  let raw: unknown;
  if ("options" in config) raw = config["options"];
  else if (field.type === DataFieldType.Status && "groups" in config) raw = config["groups"];
  else if (field.type === DataFieldType.Status && config["statusGroups"] && typeof config["statusGroups"] === "object") {
    const groups = config["statusGroups"] as Record<string, unknown>;
    raw = ["todo", "inProgress", "complete"].flatMap((key): unknown[] => Array.isArray(groups[key]) ? groups[key] as unknown[] : []);
  } else return null;
  if (!Array.isArray(raw)) return [];
  const names = raw.flatMap((option: unknown): string[] => {
    if (typeof option === "string") return [option];
    // Older database color options used {name,color}; retain their exact name.
    if (option && typeof option === "object" && "name" in option && typeof option.name === "string") return [option.name];
    return [];
  });
  return [...new Set(names)];
}

/** Unchanged legacy values are handled before validation by the owning editor. */
export function choiceValueAllowed(field: ChoiceField, value: unknown): boolean {
  const choices = configuredChoiceOptions(field);
  return choices === null || value == null || value === "" || typeof value === "string" && choices.includes(value);
}
