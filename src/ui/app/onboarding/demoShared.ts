// ============================================================
// Demo shared helpers — the three linked demo projects (3.6.1).
// ============================================================

import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_VIEW, type FilterDefinition, type ViewDefinition } from "src/settings/base/settings";

export const DEMO_FOLDER = "Projects Plus - Демо";
export const CABINET_FOLDER = `${DEMO_FOLDER}/Кабинет`;
export const TRACKER_FOLDER = `${DEMO_FOLDER}/Трекер`;
export const FINANCE_FOLDER = `${DEMO_FOLDER}/Финансы`;

/** The three demo projects, found again by name on a repair run. */
export const DEMO_NAMES = {
  cabinet: "Демо: Кабинет",
  tracker: "Демо: Трекер",
  finance: "Демо: Финансы",
} as const;

export interface DemoIds {
  readonly cabinetId: string;
  readonly trackerId: string;
  readonly financeId: string;
}

export type FrontMatter = Record<string, unknown>;
export interface DemoFile {
  readonly frontmatter: FrontMatter;
  readonly content: string;
}

export const today = () => dayjs();
export const dayOf = (offset: number) => today().add(offset, "day").format("YYYY-MM-DD");
export const wikilink = (name: string) => `[[${name}]]`;
/**
 * A seed note's number in its series. Dated notes are named by it, not by
 * their date: dates are relative to today, so a date in the name made every
 * name new the next day and a repair run wrote the whole series again.
 */
export const seq = (n: number, width = 3) => String(n).padStart(width, "0");
export const widgetId = (() => {
  let n = Date.now();
  return () => `w-${n++}`;
})();

/**
 * A deterministic pseudo-random sequence (mulberry32). The demo's numbers
 * must be the same on every run and in every test, so nothing here reads
 * Math.random: a seed gives the same series of values in [0, 1).
 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Evenly from `a` to `b` over `n` steps, rounded to `digits`. */
export const ramp = (a: number, b: number, i: number, n: number, digits = 0) => {
  const scale = 10 ** digits;
  return Math.round((a + ((b - a) * i) / Math.max(n - 1, 1)) * scale) / scale;
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * #164 — narrowing a demo block to one record type is axis A (scope), so it
 * belongs in `config.subFilter`, NOT in a leading `filter` step of
 * `widget.transform`.
 */
export const typeScope = (value: string): FilterDefinition => ({
  conjunction: "and",
  conditions: [{ field: "type", operator: "is", value, enabled: true }],
});

/** Records of one type that also have `field`. */
export const typeWith = (value: string, field: string): FilterDefinition => ({
  conjunction: "and",
  conditions: [
    { field: "type", operator: "is", value, enabled: true },
    { field, operator: "is-not-empty", enabled: true },
  ],
});

export const CHART_STYLE = {
  colorScheme: "categorical",
  height: "medium",
  showGrid: true,
  showLabels: true,
  showLegend: true,
  showValues: false,
} as const;

export const RUB = { format: "currency", currencySymbol: "₽" } as const;

/** One view of a demo project, with the plumbing every view needs. */
export function demoView(
  name: string,
  type: ViewDefinition["type"],
  config: Record<string, unknown>,
  filter: FilterDefinition = { conjunction: "and", conditions: [] },
  sort: ViewDefinition["sort"] = { criteria: [] }
): ViewDefinition {
  return Object.assign({}, DEFAULT_VIEW, {
    name,
    id: uuidv4(),
    type,
    config,
    filter,
    colors: { conditions: [] },
    sort,
  }) as ViewDefinition;
}

/**
 * The table config of a block that shows one note type: only `keep` in that
 * order, every other known field hidden (the frame is the whole project, so
 * each block hides the other types' fields).
 */
export function tableOf(
  keep: readonly string[],
  hide: readonly string[],
  widths: Record<string, number> = {},
  aggregations: Record<string, string> = {}
): Record<string, unknown> {
  const fieldConfig: Record<string, unknown> = {};
  for (const f of [...hide, "path", "tags", "type", "pp_created_time", "pp_last_edited_time"]) {
    if (!keep.includes(f)) fieldConfig[f] = { hide: true };
  }
  for (const [f, w] of Object.entries(widths)) fieldConfig[f] = { width: w };
  return {
    fieldConfig,
    orderFields: [...keep],
    aggregations,
    showAggregationRow: Object.keys(aggregations).length > 0,
    rowHeight: "default",
    wrapText: false,
  };
}
