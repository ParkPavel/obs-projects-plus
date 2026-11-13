import "@testing-library/jest-dom";
import { tick } from "svelte";
import { enter, mountCollecting, optionRows, settle, tap, typeInto } from "src/ui/components/fields/__tests__/support/comboKit";

const FilterPanel = require("../FilterPanel.svelte").default;
const DateFormulaInput = require("src/ui/views/Calendar/agenda/DateFormulaInput.svelte").default;
afterEach(() => { document.body.innerHTML = ""; });

test.each(["", "zavtra", "pfdnhf"])("Agenda date hints open at the original input and choose stored syntax (%s)", async query => {
  const m = mountCollecting<string>(DateFormulaInput, { value: "", placeholder: "Дата" }, "input");
  try {
    const input = m.target.querySelector("input")!;
    await enter(input); await tick();
    expect(optionRows().length).toBeGreaterThan(0);
    if (query) { typeInto(input, query); await settle(); }
    const tomorrow = optionRows().find(row => row.textContent?.includes("Завтра"));
    expect(tomorrow).toBeDefined(); tap(tomorrow!); await settle();
    expect(m.events[m.events.length - 1]).toBe("today+1");
    if (!query) expect(m.events).toEqual(["today+1"]);
    expect(input.value).toBe("today+1");
    expect(m.target.querySelector("input")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(document.querySelector("[role='listbox'] input")).toBeNull();
  } finally { m.destroy(); }
});

test("the actual filter propagates a date suggestion to its condition, preserving the other row", async () => {
  const other = { field: "title", operator: "is", value: "Keep", enabled: true };
  const m = mountCollecting<{ conditions: Array<{ value: string }> }>(FilterPanel, {
    value: { conjunction: "and", conditions: [{ field: "due", operator: "is-before", value: "", enabled: true }, other], groups: [] },
    fields: [{ name: "due", type: "date" }, { name: "title", type: "string" }], records: [],
  }, "update");
  try {
    const input = m.target.querySelector<HTMLInputElement>(".date-formula-input input")!;
    await enter(input); await tick();
    tap(optionRows().find(row => row.textContent?.includes("Завтра"))!); await settle();
    expect(m.events).toHaveLength(1);
    expect(m.events[0]?.conditions[0]?.value).toBe("today+1");
    expect(m.events[0]?.conditions[1]).toEqual(other);
    expect(m.target.querySelector(".date-formula-input input")).toBe(input);
  } finally { m.destroy(); }
});
