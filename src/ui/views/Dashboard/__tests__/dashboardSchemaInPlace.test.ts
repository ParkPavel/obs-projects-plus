/**
 * i3-final — the schema dialog edits in place: it is not closed for a
 * configure / delete / add, its list refreshes after the write (and when the
 * canvas frame catches up), and focus goes back to the edited row.
 */
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { createSchemaController } from "../dashboardSchema";

// Declared here, not imported: esbuild-jest runs babel hoisting on files with
// jest.mock, and babel refuses an imported binding used as a type.
type DataField = { name: string; type: string; repeated: boolean; identifier: boolean; derived: boolean };

type SchemaArgs = [unknown, string, DataField[], unknown, string, (f: DataField) => void, (f: DataField) => void, () => void, (f: DataField) => void];

const mockSchemas: Array<{
  args: SchemaArgs;
  isOpen: boolean;
  close: jest.Mock;
  setFields: jest.Mock;
}> = [];
let mockConfigureSave: ((next: DataField) => Promise<void>) | undefined;
let mockConfirm: (() => Promise<void>) | undefined;
let mockCreate: ((field: DataField, value: unknown) => Promise<boolean>) | undefined;

jest.mock("src/ui/modals/schemaModal", () => ({
  SchemaModal: class {
    isOpen = false;
    close = jest.fn(() => {
      this.isOpen = false;
    });
    setFields = jest.fn();
    args: unknown[];
    constructor(...args: unknown[]) {
      this.args = args;
      mockSchemas.push(this as never);
    }
    open() {
      this.isOpen = true;
    }
  },
}));
jest.mock("src/ui/modals/configureField", () => ({
  ConfigureFieldModal: class {
    constructor(...args: unknown[]) {
      mockConfigureSave = args[5] as typeof mockConfigureSave;
    }
    open() {}
    close() {}
  },
}));
jest.mock("src/ui/modals/confirmDialog", () => ({
  ConfirmDialogModal: class {
    constructor(...args: unknown[]) {
      mockConfirm = args[4] as typeof mockConfirm;
    }
    open() {}
    close() {}
  },
}));
jest.mock("src/ui/modals/createFieldModal", () => ({
  CreateFieldModal: class {
    constructor(...args: unknown[]) {
      mockCreate = args[2] as typeof mockCreate;
    }
    open() {}
    close() {}
  },
}));
jest.mock("src/ui/modals/relationSetupModal", () => ({
  RelationSetupModal: class { open() {} close() {} setSummary() {} },
}));
jest.mock("src/lib/stores/settings", () => ({
  settings: { updateFieldConfig: jest.fn(), deleteFieldConfig: jest.fn() },
}));

const field = (name: string): DataField => ({ name, type: DataFieldType.String, repeated: false, identifier: false, derived: false });

async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

function setup(initial: DataField[]) {
  let fields = initial;
  const api = {
    updateField: jest.fn().mockResolvedValue(undefined),
    deleteField: jest.fn().mockResolvedValue(undefined),
    addField: jest.fn().mockResolvedValue({ written: 1, failed: [], missing: [] }),
    fieldWriteTargets: () => ["a.md"],
  };
  const controller = createSchemaController({
    app: {} as never,
    api: api as never,
    getProjectId: () => "p",
    getFields: () => fields as never,
    getRecords: () => [],
    getProjects: () => [],
    t: (key, opts) => opts?.defaultValue ?? key,
  });
  return { controller, api, setFields: (next: DataField[]) => (fields = next) };
}

beforeEach(() => {
  mockSchemas.length = 0;
  mockConfigureSave = undefined;
  mockConfirm = undefined;
  mockCreate = undefined;
});

describe("i3-final schema dialog edits in place", () => {
  it("a rename keeps the dialog open, refreshes the list and focuses the renamed row", async () => {
    const { controller, setFields } = setup([field("a"), field("b")]);
    controller.openSchema();
    const schema = mockSchemas[0]!;
    schema.args[5](field("a"));
    expect(schema.close).not.toHaveBeenCalled();
    setFields([field("a2"), field("b")]);
    await mockConfigureSave?.(field("a2"));
    await flush();
    expect(mockSchemas).toHaveLength(1);
    expect(schema.close).not.toHaveBeenCalled();
    expect(schema.setFields).toHaveBeenLastCalledWith([field("a2"), field("b")], { name: "a2", index: 0 });
  });

  it("waits for the frame when the write lands before it, then focuses", async () => {
    const { controller, setFields } = setup([field("a"), field("b")]);
    controller.openSchema();
    const schema = mockSchemas[0]!;
    schema.args[5](field("a"));
    await mockConfigureSave?.(field("a2"));
    await flush();
    // The frame still lists the old name: shown, no focus yet.
    expect(schema.setFields).toHaveBeenLastCalledWith([field("a"), field("b")]);
    setFields([field("a2"), field("b")]);
    controller.refresh();
    expect(schema.setFields).toHaveBeenLastCalledWith([field("a2"), field("b")], { name: "a2", index: -1 });
    controller.refresh();
    expect(schema.setFields).toHaveBeenLastCalledWith([field("a2"), field("b")]);
  });

  it("a delete focuses the row that takes the deleted one's place", async () => {
    const { controller, api, setFields } = setup([field("a"), field("b"), field("c")]);
    controller.openSchema();
    const schema = mockSchemas[0]!;
    schema.args[8](field("b"));
    expect(schema.close).not.toHaveBeenCalled();
    setFields([field("a"), field("c")]);
    await mockConfirm?.();
    await flush();
    expect(api.deleteField).toHaveBeenCalledWith("b");
    expect(schema.setFields).toHaveBeenLastCalledWith([field("a"), field("c")], { name: "b", index: 1 });
    expect(mockSchemas).toHaveLength(1);
  });

  it("an add from the open dialog refreshes it; reopening an open dialog does not stack a second", async () => {
    const { controller, setFields } = setup([field("a")]);
    controller.openSchema();
    const schema = mockSchemas[0]!;
    schema.args[7]();
    setFields([field("a"), field("n")]);
    await expect(mockCreate?.(field("n"), "x")).resolves.toBe(true);
    await flush();
    expect(schema.setFields).toHaveBeenLastCalledWith([field("a"), field("n")], { name: "n", index: 1 });
    controller.openSchema();
    expect(mockSchemas).toHaveLength(1);
  });

  it("nothing refreshes once the dialog is closed or the view is gone", async () => {
    const { controller } = setup([field("a")]);
    controller.openSchema();
    const schema = mockSchemas[0]!;
    schema.close();
    controller.refresh();
    expect(schema.setFields).not.toHaveBeenCalled();
    controller.dispose();
    controller.openSchema();
    expect(mockSchemas).toHaveLength(1);
  });
});
