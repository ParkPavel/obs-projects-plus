/**
 * B5 (3.7.2) — "project from scratch": Visits and Clients, no relation
 * anywhere. On Clients the person makes the rollup "Сумма оплат клиента" in
 * the create dialog alone, the relation included, in five actions:
 *   1 type the name · 2 tap «Rollup» · 3 pick «New relation to Визиты» ·
 *   4 pick «Оплата» (the calculation becomes Sum by itself) · 5 Create.
 * (Opening «+ Property» is the sixth.) The relation is written first; the
 * stored formats are the existing ones (typeConfig.relation / .rollup).
 */

const mockNoop = class {
  constructor() { (this as any).$$ = { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] }; }
  $set() {}
  $on() { return () => {}; }
  $destroy() {}
};

jest.mock("obsidian-svelte", () => ({
  Button: require("./mocks/Button.mock.svelte").default,
  ModalButtonGroup: require("./mocks/ModalButtonGroup.mock.svelte").default,
  ModalContent: require("./mocks/Passthrough.mock.svelte").default,
  ModalLayout: require("./mocks/Passthrough.mock.svelte").default,
  SettingItem: require("./mocks/NamedSettingItem.mock.svelte").default,
  TextInput: require("./mocks/KeyTextInput.mock.svelte").default,
  Select: require("./mocks/Select.mock.svelte").default,
  NumberInput: require("./mocks/EchoNumberInput.mock.svelte").default,
  Switch: mockNoop,
  Icon: mockNoop,
}), { virtual: true });
jest.mock("src/ui/components/TagsInput", () => ({ TagsInput: mockNoop }), { virtual: true });
jest.mock("src/ui/components/MultiTextInput/MultiTextInput.svelte", () => ({ __esModule: true, default: mockNoop }), { virtual: true });
jest.mock("src/ui/components/DateInput.svelte", () => ({ __esModule: true, default: mockNoop }), { virtual: true });
jest.mock("src/ui/components/DatetimeInput.svelte", () => ({ __esModule: true, default: mockNoop }), { virtual: true });

import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataFrame = import("src/lib/dataframe/dataframe").DataFrame;
const CreateField = require("../CreateField.svelte").default;
const ConfigureField = require("../ConfigureField.svelte").default;

const f = (name: string, type: DataField["type"]): DataField => ({ name, type, repeated: false, identifier: false, derived: false });
const visits: DataFrame = {
  fields: [f("Дата", DataFieldType.Date), f("Оплата", DataFieldType.Number)],
  records: [
    { id: "v1.md", values: { Дата: "2026-10-01", Оплата: 100 } },
    { id: "v2.md", values: { Дата: "2026-10-02", Оплата: 250 } },
    { id: "v3.md", values: { Дата: "2026-10-03", Оплата: 50 } },
    { id: "v4.md", values: { Дата: "2026-10-04", Оплата: 999 } },
  ],
};
const projects = [
  { id: "clients", name: "Клиенты", fieldConfig: {} },
  { id: "visits", name: "Визиты", fieldConfig: {} },
] as never[];

async function settle() { for (let i = 0; i < 4; i++) { await Promise.resolve(); await tick(); } }
function change(el: HTMLSelectElement, value: string) { el.value = value; el.dispatchEvent(new Event("change")); }

describe("formula property mode persistence through real field components", () => {
  it.each(["default", "modern", "return", "leave"])("creates a field with explicit mode choice %s", async choice => {
    const target = document.createElement("div"); document.body.appendChild(target);
    const onCreate = jest.fn().mockResolvedValue(true);
    const component = new CreateField({ target, props: { existingFields: [f("qty", DataFieldType.Number)], defaultName: "Answer", onCreate } });
    try {
      target.querySelector<HTMLButtonElement>(`button[data-type='${DataFieldType.Formula}']`)!.click(); await settle();
      const textarea = target.querySelector("textarea")!;
      textarea.value = "qty + 1"; textarea.dispatchEvent(new Event("input", { bubbles: true })); await settle();
      if (choice !== "default") { target.querySelectorAll<HTMLButtonElement>(".ppp-formula-mode button")[1]!.click(); await settle(); }
      if (choice === "return") { target.querySelectorAll<HTMLButtonElement>(".ppp-formula-mode button")[0]!.click(); await settle(); }
      if (choice === "leave") { target.querySelector<HTMLButtonElement>(`button[data-type='${DataFieldType.Number}']`)!.click(); await settle(); }
      target.querySelector<HTMLButtonElement>("[data-testid='modal-button-group'] button[data-variant='primary']")!.click(); await settle();
      expect(onCreate).toHaveBeenCalledTimes(1);
      const saved = onCreate.mock.calls[0]![0] as DataField;
      if (choice === "leave") { expect(saved.typeConfig?.formula).toBeUndefined(); expect(saved.typeConfig?.formulaVersion).toBeUndefined(); }
      else {
        expect(saved.typeConfig?.formula).toBe("qty + 1");
        expect(saved.typeConfig?.formulaVersion).toBe(choice === "modern" ? "unified-v1" : undefined);
        if (choice !== "modern") expect(Object.prototype.hasOwnProperty.call(saved.typeConfig, "formulaVersion")).toBe(false);
      }
    } finally { component.$destroy(); target.remove(); }
  });

  it.each([false, true])("preserves a future version on ordinary save; explicit replacement=%s", async replace => {
    const target = document.createElement("div"); document.body.appendChild(target);
    const field = Object.freeze({ ...f("Answer", DataFieldType.Formula), typeConfig: Object.freeze({ formula: "qty + 1", formulaVersion: "future-v9" }) });
    const onSave = jest.fn();
    const component = new ConfigureField({ target, props: { title: "Answer", field, editable: true, existingFields: [f("qty", DataFieldType.Number)], onSave } });
    try {
      expect(target.querySelector<HTMLTextAreaElement>("textarea")!.readOnly).toBe(true);
      if (replace) { target.querySelectorAll<HTMLButtonElement>(".ppp-formula-mode button")[1]!.click(); await settle(); }
      target.querySelector<HTMLButtonElement>("[data-testid='modal-button-group'] button[data-variant='primary']")!.click(); await settle();
      expect(onSave.mock.calls[0]![0].typeConfig).toEqual({ formula: "qty + 1", formulaVersion: replace ? "unified-v1" : "future-v9" });
      expect(field.typeConfig.formulaVersion).toBe("future-v9");
    } finally { component.$destroy(); target.remove(); }
  });
});

describe("B5 scenario — rollup from scratch in one dialog", () => {
  it("relation + rollup «Сумма оплат клиента» in 5 actions inside the dialog, example on 3 records", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const onCreate = jest.fn().mockResolvedValue(true);
    const onCreateRelation = jest.fn().mockResolvedValue(true);
    const resolveFrame = jest.fn(async (id: string) => (id === "visits" ? visits : null));
    const component = new CreateField({
      target,
      props: {
        existingFields: [f("Имя", DataFieldType.String)], defaultName: "Новое поле",
        availableProjects: projects, currentProjectId: "clients",
        onCreate, onCreateRelation, resolveFrame, recordCount: 2,
      },
    });
    const selects = () => Array.from(target.querySelectorAll<HTMLSelectElement>("[data-testid='select']"));

    // 1 — name
    const name = target.querySelector<HTMLInputElement>("[data-testid='text-input']")!;
    name.value = "Сумма оплат клиента";
    name.dispatchEvent(new Event("input"));
    // 2 — type tile
    target.querySelector<HTMLButtonElement>(`button[data-type='${DataFieldType.Rollup}']`)!.click();
    await settle();
    // 3 — no relation yet: the source picker offers to create one here
    const source = selects()[0]!;
    expect(Array.from(source.options).map((o) => o.value)).toContain("create:visits");
    change(source, "create:visits");
    await settle();
    expect(target.querySelector("[data-testid='pending-relation']")).not.toBeNull();
    expect(resolveFrame).toHaveBeenCalledWith("visits");
    // 4 — the target project's real properties; Number → Sum chosen for the person
    const targetField = selects()[1]!;
    expect(Array.from(targetField.options).map((o) => o.value)).toEqual(["", "Дата", "Оплата"]);
    change(targetField, "Оплата");
    await settle();
    expect(selects()[2]!.value).toBe("sum");
    expect(target.querySelector("[data-testid='rollup-example']")?.getAttribute("data-result")).toBe("400");
    // 5 — Create
    target.querySelector<HTMLButtonElement>("[data-testid='modal-button-group'] button[data-variant='primary']")!.click();
    await settle();

    expect(onCreateRelation).toHaveBeenCalledTimes(1);
    const relation = onCreateRelation.mock.calls[0][0] as DataField;
    expect(relation).toMatchObject({ name: "Визиты", type: DataFieldType.Relation, typeConfig: { relation: { targetProjectId: "visits" } } });
    expect(onCreate).toHaveBeenCalledTimes(1);
    const [rollup, value] = onCreate.mock.calls[0];
    expect(value).toBeNull();
    expect(rollup).toMatchObject({
      name: "Сумма оплат клиента",
      type: DataFieldType.Rollup,
      typeConfig: { rollup: { relationField: "Визиты", targetField: "Оплата", function: "sum" } },
    });
    expect(onCreateRelation.mock.invocationCallOrder[0]!).toBeLessThan(onCreate.mock.invocationCallOrder[0]!);
    component.$destroy();
    target.remove();
  });

  it("a failed relation write stops the rollup and keeps the draft", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const onCreate = jest.fn().mockResolvedValue(true);
    const onCreateRelation = jest.fn().mockResolvedValue(false);
    const component = new CreateField({
      target,
      props: { existingFields: [], defaultName: "R", availableProjects: projects, currentProjectId: "clients", onCreate, onCreateRelation, resolveFrame: async () => visits },
    });
    target.querySelector<HTMLButtonElement>(`button[data-type='${DataFieldType.Rollup}']`)!.click();
    await settle();
    change(target.querySelector<HTMLSelectElement>("[data-testid='select']")!, "create:visits");
    await settle();
    target.querySelector<HTMLButtonElement>("[data-testid='modal-button-group'] button[data-variant='primary']")!.click();
    await settle();
    expect(onCreate).not.toHaveBeenCalled();
    expect(target.querySelector("[role='alert']")).not.toBeNull();
    component.$destroy();
    target.remove();
  });
});
