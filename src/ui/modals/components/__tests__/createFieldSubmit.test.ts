/**
 * createFieldSubmit.test.ts — M03 (C16): Enter in the name field called
 * `onCreate(field, value)` directly, while the «Create field» button normalised
 * the value per type (date formatting, list parsing, no literal for derived
 * types, de-duplicated options). Pressing Enter therefore wrote something
 * different from clicking — for a derived type, a literal into every note.
 * Both paths must hand the writer the same (field, value).
 */

jest.mock("dayjs", () => {
  const real = jest.requireActual("dayjs");
  return { __esModule: true, default: real };
});

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
  Callout: mockNoop,
  Typography: mockNoop,
  Autocomplete: mockNoop,
}), { virtual: true });

jest.mock("src/ui/components/TagsInput", () => ({ TagsInput: mockNoop }), { virtual: true });
jest.mock("src/ui/components/MultiTextInput/MultiTextInput.svelte", () => ({ __esModule: true, default: mockNoop }), { virtual: true });
jest.mock("src/ui/components/DateInput.svelte", () => ({ __esModule: true, default: mockNoop }), { virtual: true });
jest.mock("src/ui/components/DatetimeInput.svelte", () => ({ __esModule: true, default: mockNoop }), { virtual: true });

import { DataFieldType } from "src/lib/dataframe/dataframe";
type DataField = import("src/lib/dataframe/dataframe").DataField;
const CreateField = require("../CreateField.svelte").default;

const base = (over: Partial<DataField>): DataField =>
  ({ name: "planned", type: DataFieldType.String, repeated: false, identifier: false, derived: false, ...over });

function mount(field: DataField) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const onCreate = jest.fn().mockResolvedValue(true);
  const component = new CreateField({
    target,
    props: { existingFields: [], defaultName: field.name, field, onCreate, recordCount: 3 },
  });
  const nameInput = () => target.querySelector<HTMLInputElement>("[data-testid='text-input']")!;
  const createButton = () => target.querySelector<HTMLButtonElement>("[data-testid='modal-button-group'] button[data-variant='primary']")!;
  return { onCreate, nameInput, createButton, destroy: () => { component.$destroy(); target.remove(); } };
}

async function viaEnter(field: DataField) {
  const m = mount(field);
  m.nameInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  await Promise.resolve();
  const calls = m.onCreate.mock.calls.map((c) => [c[0], c[1]]);
  m.destroy();
  return calls;
}

async function viaButton(field: DataField) {
  const m = mount(field);
  m.createButton().click();
  await Promise.resolve();
  const calls = m.onCreate.mock.calls.map((c) => [c[0], c[1]]);
  m.destroy();
  return calls;
}

const cases: Array<[string, DataField]> = [
  ["text", base({})],
  ["text with repeated and empty options", base({ typeConfig: { options: ["a", "a", "", "b"] } })],
  ["date", base({ type: DataFieldType.Date })],
  ["date with time", base({ type: DataFieldType.Date, typeConfig: { time: true } })],
  ["list", base({ type: DataFieldType.List, repeated: true })],
  ["formula (derived, no literal default)", base({ type: DataFieldType.Formula })],
];

describe("CreateField — Enter and the Create button submit the same thing (M03 C7)", () => {
  it.each(cases)("%s", async (_label, field) => {
    const pressed = await viaEnter(field);
    const clicked = await viaButton(field);
    expect(clicked).toHaveLength(1);
    expect(pressed).toEqual(clicked);
  });

  it("a derived type never hands the writer a literal default", async () => {
    const calls = await viaEnter(base({ type: DataFieldType.Formula }));
    expect(calls[0]?.[1]).toBeNull();
  });
});
