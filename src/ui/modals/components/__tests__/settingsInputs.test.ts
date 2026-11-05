import "@testing-library/jest-dom";
import { enter, optionRows, settle, tap, typeInto, press } from "src/ui/components/fields/__tests__/support/comboKit";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";
type DataField = import("src/lib/dataframe/dataframe").DataField;
jest.mock("dayjs", () => ({ __esModule: true, default: jest.requireActual("dayjs") }));

const mockNoop = class {
  constructor() { (this as any).$$ = { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] }; }
  $set() {} $on() { return () => {}; } $destroy() {}
};
// Only host chrome is replaced. All field/select/draft components below are real.
jest.mock("obsidian-svelte", () => ({
  Button: require("./mocks/Button.mock.svelte").default,
  ModalButtonGroup: require("./mocks/ModalButtonGroup.mock.svelte").default,
  ModalContent: require("./mocks/Passthrough.mock.svelte").default,
  ModalLayout: require("./mocks/Passthrough.mock.svelte").default,
  SettingItem: require("./mocks/NamedSettingItem.mock.svelte").default,
  Switch: mockNoop, Icon: mockNoop,
}));
const CreateField = require("../CreateField.svelte").default;
const ConfigureField = require("../ConfigureField.svelte").default;
const base = (type: DataField["type"]): DataField => ({ name: "new", type, repeated: false, derived: false, identifier: false });
function mount(Component: typeof CreateField, props: Record<string, unknown>) {
  const target = document.createElement("div"); document.body.appendChild(target);
  const component = new Component({ target, props });
  return { target, component, destroy() { component.$destroy(); target.remove(); } };
}
afterEach(() => { document.body.innerHTML = ""; });

test("field settings choose a translated type in the original row and save its type code", async () => {
  const onSave = jest.fn();
  const m = mount(ConfigureField, { title: "Настройки поля", field: base(DataFieldType.String), editable: true, existingFields: [], onSave });
  try {
    const input = m.target.querySelector<HTMLInputElement>(".ppp-option-field input")!;
    await enter(input); await settle();
    const numeric = optionRows().find(row => row.textContent === get(i18n).t("data-types.number"));
    expect(numeric).toBeDefined(); tap(numeric!); await settle();
    expect(m.target.querySelector(".ppp-option-field input")).toBe(input);
    expect(document.activeElement).toBe(input);
    m.target.querySelector<HTMLButtonElement>("[data-variant='primary']")!.click(); await settle();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ type: DataFieldType.Number }));
    expect(document.querySelector(".ppp-popup input")).toBeNull();
  } finally { m.destroy(); }
});

test("invalid numeric default stays visible after blur and blocks a bulk create until corrected", async () => {
  const onCreate = jest.fn().mockResolvedValue(true);
  const m = mount(CreateField, { existingFields: [], defaultName: "new", field: base(DataFieldType.Number), onCreate });
  try {
    await settle(); const input = m.target.querySelector<HTMLInputElement>(".ppp-number-field")!;
    await enter(input); typeInto(input, "12"); typeInto(input, "12bad"); input.blur(); await settle();
    const button = m.target.querySelector<HTMLButtonElement>("[data-variant='primary']")!;
    button.click(); await settle();
    expect(onCreate).not.toHaveBeenCalled(); expect(input.value).toBe("12bad"); expect(input).toHaveAttribute("aria-invalid", "true");
    await enter(input); typeInto(input, "0"); await settle(); button.click(); await settle();
    expect(onCreate).toHaveBeenCalledTimes(1); expect(onCreate.mock.calls[0][1]).toBe(0);
    expect(m.target.querySelector(".ppp-number-field")).toBe(input);
  } finally { m.destroy(); }
});

test.each(["name", "default"])("IME confirmation in the %s field cannot create a property", async part => {
  const onCreate = jest.fn(); const m = mount(CreateField, { existingFields: [], defaultName: "new", onCreate });
  try {
    await settle(); const inputs = m.target.querySelectorAll<HTMLInputElement>(".ppp-value-field input");
    const input = inputs[part === "name" ? 0 : 1]!;
    await enter(input); input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    press(input, "Enter"); await settle(); expect(onCreate).not.toHaveBeenCalled();
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    press(input, "Enter", { isComposing: true }); await settle(); expect(onCreate).not.toHaveBeenCalled();
  } finally { m.destroy(); }
});

test.each(["create", "configure"])("%s cannot save a formula during composition or with an invalid expression", async kind => {
  const save = jest.fn().mockResolvedValue(true), field = { ...base(DataFieldType.Formula), typeConfig: { formula: "1" } };
  const m = kind === "create" ? mount(CreateField, { existingFields: [], field, defaultName: "new", onCreate: save }) :
    mount(ConfigureField, { title: "Formula", existingFields: [], field, editable: true, onSave: save });
  try {
    await settle(); const input = m.target.querySelector<HTMLTextAreaElement>(".ppp-fc-textarea")!;
    const button = m.target.querySelector<HTMLButtonElement>("[data-variant='primary']")!;
    input.focus(); input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.value = "1 + 2"; input.dispatchEvent(new Event("input", { bubbles: true })); await settle();
    button.click(); await settle(); expect(save).not.toHaveBeenCalled();
    input.value = "1 + 3"; input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })); await settle();
    input.value = "1 +"; input.dispatchEvent(new Event("input", { bubbles: true })); await settle();
    button.click(); await settle(); expect(save).not.toHaveBeenCalled(); expect(input.value).toBe("1 +");
    input.value = "1 + 4"; input.dispatchEvent(new Event("input", { bubbles: true })); await settle();
    button.click(); await settle(); expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].typeConfig.formula).toBe("1 + 4");
    expect(save.mock.calls[0][0].typeConfig.formulaVersion).toBeUndefined();
  } finally { m.destroy(); }
});

test("Create validates the original date draft before writing a default into every note", async () => {
  const onCreate = jest.fn(), m = mount(CreateField, { existingFields: [], defaultName: "new", field: base(DataFieldType.Date), onCreate });
  try {
    await settle(); const input = m.target.querySelector<HTMLInputElement>(".ppp-date-field__text")!;
    const button = m.target.querySelector<HTMLButtonElement>("[data-variant='primary']")!;
    await enter(input); typeInto(input, "32.11.2026"); await settle(); button.click(); await settle();
    expect(onCreate).not.toHaveBeenCalled(); expect(input.value).toBe("32.11.2026");
    typeInto(input, "07.11.2026"); await settle(); button.click(); await settle();
    expect(onCreate).toHaveBeenCalledTimes(1); expect(onCreate.mock.calls[0][1]).toBe("2026-11-07");
  } finally { m.destroy(); }
});

test("Configure does not save another field while its name composition is unfinished", async () => {
  const onSave = jest.fn(), m = mount(ConfigureField, { title: "Field", field: base(DataFieldType.String), editable: true, existingFields: [], onSave });
  try {
    await settle(); const input = m.target.querySelector<HTMLInputElement>(".ppp-value-field input")!;
    await enter(input); input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })); typeInto(input, "途中"); await settle();
    m.target.querySelector<HTMLButtonElement>("[data-variant='primary']")!.click(); await settle(); expect(onSave).not.toHaveBeenCalled();
  } finally { m.destroy(); }
});

test("form composition guards are scoped and a retired editor cannot block another form or the new type", async () => {
  const firstSave = jest.fn(), secondSave = jest.fn();
  const first = mount(CreateField, { existingFields: [], defaultName: "first", onCreate: firstSave });
  const second = mount(CreateField, { existingFields: [], defaultName: "second", onCreate: secondSave });
  try {
    await settle(); const draft = first.target.querySelectorAll<HTMLInputElement>(".ppp-value-field input")[1]!;
    await enter(draft); draft.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    second.target.querySelector<HTMLButtonElement>("[data-variant='primary']")!.click(); await settle();
    expect(secondSave).toHaveBeenCalledTimes(1); expect(firstSave).not.toHaveBeenCalled();
    first.target.querySelector<HTMLButtonElement>('[data-type="boolean"]')!.click(); await settle();
    expect(draft.isConnected).toBe(false); first.target.querySelector<HTMLButtonElement>("[data-variant='primary']")!.click(); await settle();
    expect(firstSave).toHaveBeenCalledTimes(1); expect(firstSave.mock.calls[0][0].type).toBe(DataFieldType.Boolean);
  } finally { first.destroy(); second.destroy(); }
});
