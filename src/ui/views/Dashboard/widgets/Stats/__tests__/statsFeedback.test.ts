import { render } from "@testing-library/svelte";
import { tick } from "svelte";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }) };
});
const StatsWidget = require("../StatsWidget.svelte").default;
const StatsCard = require("../StatsCard.svelte").default;
const { getConfigPanel } = require("../../configPanelRegistry");
const source = { fields: [{ name: "amount", type: "number", identifier: false, repeated: false, derived: false }], records: [{ id: "a", values: { amount: 10 } }, { id: "b", values: { amount: 30 } }] };

it("explicitly removing all cards does not bring back an unsolicited total/sum/average", () => {
  const { container } = render(StatsWidget, { props: { config: { cards: [], columns: 2 }, source } });
  expect(container.querySelectorAll(".ppp-stats-card")).toHaveLength(0);
  expect(container.textContent).toContain("Add a card");
});

it("the settings' initial cards are the same cards the widget displays", () => {
  const config = getConfigPanel("stats").initDefaults(source.fields);
  const { container } = render(StatsWidget, { props: { config, source } });
  const labels = Array.from(container.querySelectorAll(".ppp-stats-label")).map(el => el.textContent?.trim());
  expect(config.cards.length).toBeGreaterThan(0);
  expect(labels).toEqual(config.cards.map((card: { label: string }) => card.label));
  expect(container.textContent).toContain("Numeric summary");
});

it("column count is reflected by the grid and stored custom cards remain untouched", async () => {
  const config = { columns: 3, cards: [{ id: "custom", label: "Costs", field: "amount", aggregation: "sum" }] };
  const { container, component } = render(StatsWidget, { props: { config, source } });
  const grid = container.querySelector<HTMLElement>(".ppp-stats-widget");
  expect(grid?.style.getPropertyValue("--ppp-stats-columns")).toBe("3");
  expect(container.querySelector(".ppp-stats-value")?.textContent).toBe("40");
  expect(container.querySelector(".ppp-stats-label")?.textContent?.trim()).toBe("Costs");
  component.$set({ config: { ...config, columns: 4 } }); await tick();
  expect(grid?.style.getPropertyValue("--ppp-stats-columns")).toBe("4");
  expect(config.cards[0]?.label).toBe("Costs");
});

it("a sparkline from 200000 values does not overflow the call stack or create an unbounded SVG", () => {
  const values = Array.from({ length: 200000 }, (_, i) => i % 100);
  const { container } = render(StatsCard, { props: { config: { id: "large", label: "Large", field: "amount", aggregation: "count_numeric", sparkline: true }, values } });
  const path = container.querySelector("path")?.getAttribute("d") ?? "";
  expect(path).not.toBe("");
  expect(path.match(/[ML]/g)!.length).toBeLessThanOrEqual(200);
  expect(container.querySelector(".ppp-stats-value")?.textContent).toBe((200000).toLocaleString());
  expect(path).not.toMatch(/NaN|Infinity/);
});
