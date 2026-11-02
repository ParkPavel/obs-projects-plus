import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import type { ViewDefinition } from "src/settings/base/settings";
import type { CalendarConfig } from "./types";

/** An exact configured key, an unambiguous project mapping, or the documented default. */
export function resolveCalendarColorField(
  config: CalendarConfig | undefined,
  views: readonly Pick<ViewDefinition, "type" | "config">[],
  fields: readonly DataField[] = [],
): string | undefined {
  const configured = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
  let candidate = config?.eventColorField;
  if (!configured(candidate)) {
    const inherited = new Set(views.filter(view => view.type === "calendar")
      .map(view => view.config["eventColorField"]).filter(configured));
    // Different case is a different YAML property, not a tie to resolve by order.
    if (inherited.size > 1) return undefined;
    candidate = inherited.values().next().value ?? "eventColor";
  }
  const field = fields.find(field => field.name === candidate);
  if (field && (field.derived || field.identifier || (field.type !== DataFieldType.String && field.type !== DataFieldType.Unknown))) return undefined;
  return candidate;
}

/** An invalid mapping must also disappear from create defaults and readers. */
export function withColorField(config: CalendarConfig | undefined, field: string | undefined): CalendarConfig {
  const next = { ...config };
  delete next.eventColorField;
  return field ? { ...next, eventColorField: field } : next;
}
