import "@testing-library/jest-dom";

import type { SvelteComponent } from "svelte";

// #100 — panel round-trip hardening (UT2026-D P2 + optimistic-echo, bug #071).
// Each generic config panel is P2-correct: it derives its display via `$:` from
// the `config` prop and emits a fresh object on change. This harness proves the
// round-trip end to end: edit a control -> capture the emitted detail -> feed it
// back as the `config` prop -> the control still reflects the new value (no
// snap-back to the stale prop).

const ChartConfig = require("../Chart/ChartConfig.svelte").default;
const ChecklistConfig = require("../Checklist/ChecklistConfig.svelte").default;
const StatsConfig = require("../Stats/StatsConfig.svelte").default;
const FilterTabsConfig = require("../FilterTabs/FilterTabsConfig.svelte").default;
const CoverBannerConfig = require("../CoverBanner/CoverBannerConfig.svelte").default;

type Ctor = new (opts: { target: HTMLElement; props: Record<string, unknown> }) => SvelteComponent;

interface PanelCase {
  name: string;
  Component: Ctor;
  props: Record<string, unknown>;
  /** Locate the control under test in the rendered tree. */
  locate(root: HTMLElement): HTMLInputElement | HTMLSelectElement;
  /** Apply a new value to the control and return what it should read back as. */
  mutate(el: HTMLInputElement | HTMLSelectElement): string | boolean;
  /** Read the control's current effective value (string for select, checked for checkbox). */
  read(el: HTMLInputElement | HTMLSelectElement): string | boolean;
}

function fieldsOf(...names: string[]) {
  return names.map((name) => ({
    name,
    type: "Unknown",
    repeated: false,
    identifier: false,
    derived: false,
  }));
}

function findSelectWithOptions(root: HTMLElement, ...values: string[]): HTMLSelectElement {
  const selects = Array.from(root.querySelectorAll("select")) as HTMLSelectElement[];
  const found = selects.find((s) => values.every((v) => Array.from(s.options).some((o) => o.value === v)));
  if (!found) throw new Error(`no <select> with options ${values.join(",")}`);
  return found;
}

const CASES: PanelCase[] = [
  {
    name: "Chart / ChartConfig — chartType select",
    Component: ChartConfig,
    props: {
      config: {
        chartType: "bar",
        xAxis: { property: "status", sortBy: "label", sortOrder: "asc", omitZero: false },
        yAxis: { property: "count", aggregation: "count_total" },
        style: { colorScheme: "auto", height: "medium", showGrid: true, showLabels: true, showLegend: true, showValues: false },
      },
      fields: fieldsOf("status", "amount"),
      availableSources: [],
    },
    locate: (root) => findSelectWithOptions(root, "bar", "line"),
    mutate: (el) => { (el as HTMLSelectElement).value = "line"; return "line"; },
    read: (el) => (el as HTMLSelectElement).value,
  },
  {
    name: "Checklist / ChecklistConfig — showMode select",
    Component: ChecklistConfig,
    props: { config: { field: "done", showMode: "all" }, fields: fieldsOf("done", "name") },
    locate: (root) => findSelectWithOptions(root, "all", "open", "done"),
    mutate: (el) => { (el as HTMLSelectElement).value = "open"; return "open"; },
    read: (el) => (el as HTMLSelectElement).value,
  },
  {
    name: "Stats / StatsConfig — columns select",
    Component: StatsConfig,
    props: { config: { cards: [], columns: 3 }, fields: fieldsOf("amount") },
    locate: (root) => findSelectWithOptions(root, "2", "3", "4"),
    mutate: (el) => { (el as HTMLSelectElement).value = "4"; return "4"; },
    read: (el) => (el as HTMLSelectElement).value,
  },
  {
    name: "FilterTabs / FilterTabsConfig — showAll checkbox",
    Component: FilterTabsConfig,
    props: { config: { field: "status", showAll: true, tabs: [] }, fields: fieldsOf("status"), source: null },
    locate: (root) => root.querySelector('input[type="checkbox"]') as HTMLInputElement,
    mutate: (el) => { (el as HTMLInputElement).checked = false; return false; },
    read: (el) => (el as HTMLInputElement).checked,
  },
  {
    name: "CoverBanner / CoverBannerConfig — widthMode select",
    Component: CoverBannerConfig,
    props: { config: { widthMode: "full" } },
    locate: (root) => root.querySelector("#cb-width") as HTMLSelectElement,
    mutate: (el) => { (el as HTMLSelectElement).value = "half"; return "half"; },
    read: (el) => (el as HTMLSelectElement).value,
  },
];

function mount(Component: Ctor, props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const emitted: Record<string, unknown>[] = [];
  const component = new Component({ target, props });
  component.$on("change", (e: CustomEvent<Record<string, unknown>>) => emitted.push(e.detail));
  return {
    component,
    target,
    emitted,
    destroy() { component.$destroy(); target.remove(); },
  };
}

describe("#100 — config panel round-trip (UT2026-D P2 + optimistic-echo)", () => {
  test.each(CASES)("$name survives config round-trip", async ({ Component, props, locate, mutate, read }) => {
    const m = mount(Component, props);
    try {
      const el = locate(m.target);
      const expected = mutate(el);
      el.dispatchEvent(new Event("change", { bubbles: true }));

      expect(m.emitted).toHaveLength(1);
      const detail = m.emitted[0]!;

      m.component.$set({ config: detail });
      await Promise.resolve();

      const after = locate(m.target);
      expect(read(after)).toBe(expected);
    } finally {
      m.destroy();
    }
  });

  test("#071 — cover-banner widthMode select survives config round-trip", async () => {
    const m = mount(CoverBannerConfig, { config: { widthMode: "full" } });
    try {
      const sel = m.target.querySelector("#cb-width") as HTMLSelectElement;
      expect(sel.value).toBe("full");

      sel.value = "half";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      expect(m.emitted).toHaveLength(1);
      expect((m.emitted[0] as { widthMode?: string }).widthMode).toBe("half");

      m.component.$set({ config: m.emitted[0] });
      await Promise.resolve();

      const after = m.target.querySelector("#cb-width") as HTMLSelectElement;
      expect(after.value).toBe("half");
    } finally {
      m.destroy();
    }
  });
});
