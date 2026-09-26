// ============================================================
// Demo shared helpers — used by the three demo projects (3.6.0).
// ============================================================

import dayjs from "dayjs";
import type { FilterDefinition } from "src/settings/base/settings";

export const DEMO_FOLDER = "Projects Plus - Демо";
export const CABINET_FOLDER = `${DEMO_FOLDER}/Кабинет`;
export const FINANCE_FOLDER = `${DEMO_FOLDER}/Финансы`;

/** The three demo projects, found again by name on a repair run. */
export const DEMO_NAMES = {
  studio: "Демо-проект",
  cabinet: "Демо: Кабинет",
  finance: "Демо: Финансы",
} as const;

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
 * name new the next day and a repair run wrote the whole series again
 * (review of 08eda4e).
 */
export const seq = (n: number) => String(n).padStart(2, "0");
export const widgetId = (() => {
  let n = Date.now();
  return () => `w-${n++}`;
})();

/**
 * #164 — narrowing a demo block to one record type is axis A (scope), so it
 * belongs in `config.subFilter`, NOT in a leading `filter` step of
 * `widget.transform`.
 */
export const typeScope = (value: string): FilterDefinition => ({
  conjunction: "and",
  conditions: [{ field: "type", operator: "is", value, enabled: true }],
});

/** Records that have a date: keeps undated notes (clients) out of a time axis. */
export const datedScope = (): FilterDefinition => ({
  conjunction: "and",
  conditions: [{ field: "date", operator: "is-not-empty", enabled: true }],
});
