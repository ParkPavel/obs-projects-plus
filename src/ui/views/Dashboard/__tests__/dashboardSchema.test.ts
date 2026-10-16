import { DataFieldType } from "src/lib/dataframe/dataframe";
import { createSchemaController } from "../dashboardSchema";

// #158 — this pins a contract, not a reproduction. The observation that
// started it, a field configured under the previously open project, was
// traced to the test harness clicking a leftover modal and does not
// reproduce on any build. What is protected here is the property the rest of
// the interface already had: DashboardCanvas can be retargeted in place
// (useView.ts), so a controller built once must keep reading the project id
// rather than remembering the one it was built with.

let capturedOnCreate: ((field: unknown, value: unknown) => void) | undefined;
let capturedRecordCount: number | undefined;

jest.mock("src/ui/modals/createFieldModal", () => ({
  CreateFieldModal: class {
    constructor(
      _app: unknown,
      _fields: unknown,
      onCreate: (field: unknown, value: unknown) => void,
      _projects?: unknown,
      _projectId?: unknown,
      _onSetupRelation?: unknown,
      recordCount?: number
    ) {
      capturedOnCreate = onCreate;
      capturedRecordCount = recordCount;
    }
    open() {}
    close() {}
  },
}));
jest.mock("src/ui/modals/configureField", () => ({
  ConfigureFieldModal: class { open() {} close() {} },
}));
jest.mock("src/ui/modals/schemaModal", () => ({
  SchemaModal: class { open() {} close() {} },
}));
jest.mock("src/ui/modals/confirmDialog", () => ({
  ConfirmDialogModal: class { open() {} close() {} },
}));
jest.mock("src/ui/modals/relationSetupModal", () => ({
  RelationSetupModal: class { open() {} close() {} setSummary() {} },
}));

// jest refuses a mock factory that closes over anything but a `mock`-prefixed
// name, so the spy carries the prefix the runner insists on.
const mockUpdateFieldConfig = jest.fn();
jest.mock("src/lib/stores/settings", () => ({
  settings: {
    updateFieldConfig: (...args: unknown[]) => mockUpdateFieldConfig(...args),
    deleteFieldConfig: jest.fn(),
  },
}));

describe("#158 createSchemaController follows the project the canvas shows", () => {
  beforeEach(() => {
    mockUpdateFieldConfig.mockClear();
    capturedOnCreate = undefined;
  });

  test("a field created after the canvas switches projects is configured against the new project", async () => {
    let liveProjectId = "project-A";
    const api = { addField: jest.fn().mockResolvedValue({ written: 3, failed: [], missing: [] }), fieldWriteTargets: () => [] };
    const controller = createSchemaController({
      app: {} as never,
      api: api as never,
      getProjectId: () => liveProjectId,
      t: (key, opts) => opts?.defaultValue ?? key,
      getFields: () => [],
      getRecords: () => [],
      getProjects: () => [],
    });

    // The canvas retargets to a different project; this controller instance
    // is not rebuilt (DashboardCanvas.svelte keeps it alive across the switch).
    liveProjectId = "project-B";

    controller.openCreateField();
    const field = {
      name: "sessions",
      type: DataFieldType.Relation,
      repeated: true,
      identifier: false,
      derived: false,
      typeConfig: { relation: { targetProjectId: "project-B" } },
    };
    await capturedOnCreate?.(field, []);

    expect(mockUpdateFieldConfig).toHaveBeenCalledTimes(1);
    // The failing assertion under the old, captured-id controller: it would
    // receive "project-A", the project selected when the controller was built.
    expect(mockUpdateFieldConfig.mock.calls[0]?.[0]).toBe("project-B");
  });
});

describe("M03 (C13) — the create callback reports the real outcome to the modal", () => {
  const field = { name: "budget", type: DataFieldType.Number, repeated: false, identifier: false, derived: false };
  const controllerWith = (addField: jest.Mock) => createSchemaController({
    app: {} as never,
    api: { addField, fieldWriteTargets: () => ["a.md", "b.md", "c.md"] } as never,
    getProjectId: () => "p",
    t: (key, opts) => opts?.defaultValue ?? key,
    getFields: () => [],
    getRecords: () => [{ id: "a.md" }, { id: "b.md" }],
    getProjects: () => [],
  });

  beforeEach(() => { capturedOnCreate = undefined; capturedRecordCount = undefined; });

  test("the notice counts the notes the writer goes through, not the view's filtered rows", () => {
    // The view shows 2 rows (getRecords); the project frame the writer walks has 3.
    controllerWith(jest.fn()).openCreateField();
    expect(capturedRecordCount).toBe(3);
  });

  test("every note written → true", async () => {
    controllerWith(jest.fn().mockResolvedValue({ written: 2, failed: [], missing: [] })).openCreateField();
    await expect(capturedOnCreate?.(field, null)).resolves.toBe(true);
  });

  test("some notes not written → false, so the form keeps the draft for a retry", async () => {
    controllerWith(jest.fn().mockResolvedValue({ written: 1, failed: ["b.md"], missing: [] })).openCreateField();
    await expect(capturedOnCreate?.(field, null)).resolves.toBe(false);
  });

  test("the writer throws → false, not a promise that resolved inside catch", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    controllerWith(jest.fn().mockRejectedValue(new Error("disk"))).openCreateField();
    await expect(capturedOnCreate?.(field, null)).resolves.toBe(false);
    warn.mockRestore();
  });
});

describe("i2-safety — a property created without a value is declared in the base's settings", () => {
  const controller = () => createSchemaController({
    app: {} as never,
    api: { addField: jest.fn().mockResolvedValue({ written: 0, failed: [], missing: [] }), fieldWriteTargets: () => ["a.md"] } as never,
    getProjectId: () => "p",
    t: (key, opts) => opts?.defaultValue ?? key,
    getFields: () => [],
    getRecords: () => [],
    getProjects: () => [],
  });
  const f = (type: string, typeConfig?: Record<string, unknown>) =>
    ({ name: "Новое", type, repeated: false, identifier: false, derived: false, ...(typeConfig ? { typeConfig } : {}) });

  beforeEach(() => { mockUpdateFieldConfig.mockClear(); capturedOnCreate = undefined; });

  test.each([
    ["formula without an expression", f(DataFieldType.Formula), null, { type: "formula" }],
    ["formula with an expression", f(DataFieldType.Formula, { formula: "price * 2" }), null, { formula: "price * 2", type: "formula" }],
    ["text with an empty default", f(DataFieldType.String), "", { type: "string" }],
    ["number with no default", f(DataFieldType.Number), undefined, { type: "number" }],
  ])("%s → config declares its type", async (_label, field, value, expected) => {
    controller().openCreateField();
    await capturedOnCreate?.(field, value);
    expect(mockUpdateFieldConfig).toHaveBeenCalledTimes(1);
    expect(mockUpdateFieldConfig.mock.calls[0]?.[1]).toBe("Новое");
    expect(mockUpdateFieldConfig.mock.calls[0]?.[3]).toEqual(expected);
  });

  test("a property written with a real default keeps the old config (no type override)", async () => {
    controller().openCreateField();
    await capturedOnCreate?.(f(DataFieldType.String), "новый");
    expect(mockUpdateFieldConfig).not.toHaveBeenCalled();
  });
});
