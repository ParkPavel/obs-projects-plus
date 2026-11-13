import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";
import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import { aggregationLabel } from "src/lib/dashboard-engine/aggregationOptions";
import type { StatsConfig } from "../../types";

/** Seed real, editable cards once; render never resurrects a cleared config. */
export function defaultStatsConfig(fields: readonly DataField[]): StatsConfig {
  const t = (key: string, defaultValue: string) => get(i18n).t(key, { defaultValue });
  const cards: StatsConfig["cards"] = [{ id: "_count", label: aggregationLabel("count_total", t), field: "*", aggregation: "count_total" }];
  const numeric = fields.find(f => f.type === DataFieldType.Number && !f.repeated);
  if (numeric) for (const aggregation of ["sum", "avg"] as const) cards.push({
    id: `_${aggregation}`, label: `${numeric.name} · ${aggregationLabel(aggregation, t)}`,
    field: numeric.name, aggregation, format: "number",
  });
  return { cards, columns: 2 };
}
