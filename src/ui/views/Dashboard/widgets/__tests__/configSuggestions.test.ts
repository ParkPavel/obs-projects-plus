/**
 * stab-forms, step 4 — the widget configuration panels that offered field names
 * through a native `<datalist>` now use the shared ComboField.
 *
 * For each site: the box is a role=combobox (no datalist is left), typing
 * filters the list, a pick commits exactly once (and the blur that follows adds
 * nothing), Enter commits typed text, and Escape closes the list and then
 * restores the text the box had on entry without writing.
 *
 * Why these fail on the old code: the box was a plain `<input list="…">`, so
 * there is no `role="combobox"` to find (every `comboInputs(...)[0]` is
 * undefined and the first call throws), and the old handlers wrote on EVERY
 * `input` event, so typing two characters produced two `change` events and the
 * pipeline's step label changed while the user was still typing.
 */

import "@testing-library/jest-dom";

import { DataFieldType } from "src/lib/dataframe/dataframe";
import {
  comboInputs,
  enter,
  listbox,
  mountCollecting,
  optionLabels,
  optionRows,
  press,
  settle,
  tap,
  typeInto,
} from "src/ui/components/fields/__tests__/support/comboKit";

const ChecklistConfig = require("../Checklist/ChecklistConfig.svelte").default;
const FilterTabsConfig = require("../FilterTabs/FilterTabsConfig.svelte").default;
const StatsConfig = require("../Stats/StatsConfig.svelte").default;
const PipelineEditor = require("../PipelineEditor.svelte").default;

function fieldsOf(...names: string[]) {
  return names.map((name) => ({
    name,
    type: DataFieldType.String,
    repeated: false,
    identifier: false,
    derived: false,
  }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ChecklistConfig — field boxes", () => {
  const config = { field: "done", labelField: "name", sortField: "name" };
  const mount = () => mountCollecting<Record<string, unknown>>(ChecklistConfig, { config, fields: fieldsOf("done", "name", "due") }, "change");

  test("three comboboxes and no native datalist", () => {
    const m = mount();
    expect(comboInputs(m.target)).toHaveLength(3);
    expect(m.target.querySelector("datalist")).toBeNull();
    expect(m.target.querySelector("input[list]")).toBeNull();
    m.destroy();
  });

  test("typing filters, a pick commits once, and the blur after it adds nothing", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "du");
    await settle();
    expect(optionLabels()).toEqual(["due"]);
    expect(m.events).toEqual([]);
    tap(optionRows()[0]!);
    expect(m.events).toEqual([{ ...config, field: "due" }]);
    box.blur();
    await settle();
    expect(m.events).toHaveLength(1);
    m.destroy();
  });

  test("Enter commits typed text once, for the second box too", async () => {
    const m = mount();
    const box = comboInputs(m.target)[1]!;
    await enter(box);
    typeInto(box, "title");
    press(box, "Enter");
    box.blur();
    await settle();
    expect(m.events).toEqual([{ ...config, labelField: "title" }]);
    m.destroy();
  });

  test("Escape closes the list, then restores the entry text without writing", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "d");
    await settle();
    expect(listbox()).not.toBeNull();
    press(box, "Escape");
    await settle();
    expect(listbox()).toBeNull();
    expect(box.value).toBe("d");
    press(box, "Escape");
    await settle();
    expect(box.value).toBe("done");
    box.blur();
    await settle();
    expect(m.events).toEqual([]);
    m.destroy();
  });
});

describe("FilterTabsConfig — filter field box", () => {
  const config = { field: "status", showAll: true, tabs: [] };
  const mount = () => mountCollecting<Record<string, unknown>>(FilterTabsConfig, { config, fields: fieldsOf("status", "owner"), source: null }, "change");

  test("a combobox, no datalist; a pick commits once", async () => {
    const m = mount();
    expect(m.target.querySelector("datalist")).toBeNull();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "ow");
    await settle();
    expect(optionLabels()).toEqual(["owner"]);
    tap(optionRows()[0]!);
    box.blur();
    await settle();
    expect(m.events).toEqual([{ field: "owner", tabs: [], showAll: true }]);
    m.destroy();
  });

  test("Escape restores the entry text and writes nothing", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "o");
    await settle();
    press(box, "Escape");
    press(box, "Escape");
    await settle();
    expect(box.value).toBe("status");
    box.blur();
    await settle();
    expect(m.events).toEqual([]);
    m.destroy();
  });
});

describe("StatsConfig — card field box", () => {
  const card = { id: "c1", label: "Total", field: "amount", aggregation: "sum", format: "number" };
  const config = { cards: [card], columns: 3 };
  const mount = () => mountCollecting<{ cards: Array<{ field: string }> }>(StatsConfig, { config, fields: fieldsOf("amount", "qty") }, "change");

  test("the list offers * (count of records) ahead of the fields", async () => {
    const m = mount();
    expect(m.target.querySelector("datalist")).toBeNull();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    expect(optionLabels()).toEqual(["*", "amount", "qty"]);
    m.destroy();
  });

  test("a pick writes the card once; the blur after it adds nothing", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "qt");
    await settle();
    tap(optionRows()[0]!);
    box.blur();
    await settle();
    expect(m.events).toHaveLength(1);
    expect(m.events[0]?.cards[0]?.field).toBe("qty");
    m.destroy();
  });

  test("Escape restores the entry text and writes nothing", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "q");
    await settle();
    press(box, "Escape");
    press(box, "Escape");
    await settle();
    expect(box.value).toBe("amount");
    box.blur();
    await settle();
    expect(m.events).toEqual([]);
    m.destroy();
  });
});

describe("PipelineEditor — field, function and formula boxes", () => {
  type Pipeline = { steps: Array<Record<string, unknown>> };
  const fields = fieldsOf("status", "name", "due");

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function mount(steps: Pipeline["steps"], sourceFields = fields) {
    const m = mountCollecting<Pipeline>(
      PipelineEditor,
      { pipeline: { steps }, fields: sourceFields, source: { fields: sourceFields, records: [] }, availableSources: [] },
      "apply"
    );
    const summary = m.target.querySelector<HTMLElement>(".ppp-step-summary");
    summary!.click();
    return { ...m, label: () => m.target.querySelector(".ppp-step-label")?.textContent ?? "" };
  }

  test("no native datalist is left in the editor", async () => {
    const m = mount([{ type: "group-by", fields: ["status"] }]);
    await settle();
    expect(m.target.querySelector("datalist")).toBeNull();
    expect(m.target.querySelector("input[list]")).toBeNull();
    m.destroy();
  });

  test("group-by: typing does not change the step; a pick does, once", async () => {
    const m = mount([{ type: "group-by", fields: ["status"] }]);
    await settle();
    const box = comboInputs(m.target)[0]!;
    expect(box.value).toBe("status");
    await enter(box);
    typeInto(box, "na");
    await settle();
    expect(m.label()).toContain("status");
    expect(optionLabels()).toEqual(["name"]);
    tap(optionRows()[0]!);
    await settle();
    box.blur();
    await settle();
    expect(m.label()).toContain("name");
    jest.advanceTimersByTime(400);
    expect(m.events).toHaveLength(1);
    expect(m.events[0]?.steps[0]).toEqual({ type: "group-by", fields: ["name"] });
    m.destroy();
  });

  test("group-by: Escape restores the field and applies nothing", async () => {
    const m = mount([{ type: "group-by", fields: ["status"] }]);
    await settle();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "n");
    await settle();
    press(box, "Escape");
    press(box, "Escape");
    await settle();
    expect(box.value).toBe("status");
    box.blur();
    await settle();
    jest.advanceTimersByTime(400);
    expect(m.events).toEqual([]);
    m.destroy();
  });

  test("filter: a picked field is written once with its operator and value reset", async () => {
    const m = mount([
      {
        type: "filter",
        conditions: { conjunction: "and", conditions: [{ field: "status", operator: "is", value: "open", enabled: true }] },
      },
    ]);
    await settle();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "du");
    await settle();
    tap(optionRows()[0]!);
    box.blur();
    await settle();
    jest.advanceTimersByTime(400);
    expect(m.events).toHaveLength(1);
    const cond = (m.events[0]?.steps[0] as { conditions: { conditions: Array<{ field: string; value: string }> } }).conditions.conditions[0];
    expect(cond?.field).toBe("due");
    expect(cond?.value).toBe("");
    m.destroy();
  });

  test("aggregate: the function is chosen from its list; Enter takes the top match, junk is restored", async () => {
    const m = mount([{ type: "aggregate", columns: [{ sourceField: "status", function: "SUM", outputName: "status_sum" }] }]);
    await settle();
    const [fieldBox, fnBox] = comboInputs(m.target) as [HTMLInputElement, HTMLInputElement];
    expect(fnBox.value).toBe("SUM");
    await enter(fnBox);
    typeInto(fnBox, "zz");
    press(fnBox, "Enter");
    fnBox.blur();
    await settle();
    expect(fnBox.value).toBe("SUM");
    jest.advanceTimersByTime(400);
    expect(m.events).toEqual([]);
    await enter(fnBox);
    typeInto(fnBox, "av");
    await settle();
    expect(optionLabels()).toEqual(["AVG"]);
    press(fnBox, "Enter");
    fnBox.blur();
    await settle();
    jest.advanceTimersByTime(400);
    expect(m.events).toHaveLength(1);
    const col = (m.events[0]?.steps[0] as { columns: Array<{ sourceField: string; function: string }> }).columns[0];
    expect(col?.function).toBe("AVG");
    expect(col?.sourceField).toBe("status");
    expect(fieldBox.value).toBe("status");
    m.destroy();
  });

  test("compute: plain Enter keeps the draft; Ctrl+Enter commits the valid formula once", async () => {
    const m = mount([{ type: "compute", columns: [{ name: "total", expression: "" }] }], fieldsOf("price"));
    await settle();
    const formula = m.target.querySelector<HTMLTextAreaElement>("textarea")!;
    formula.focus();
    formula.value = "price * 2";
    formula.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    formula.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(m.events).toHaveLength(0);
    formula.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
    formula.blur();
    await settle();
    jest.advanceTimersByTime(400);
    expect(m.events).toHaveLength(1);
    const col = (m.events[0]?.steps[0] as { columns: Array<{ name: string; expression: string }> }).columns[0];
    expect(col).toEqual({ name: "total", expression: "price * 2" });
    m.destroy();
  });
});
