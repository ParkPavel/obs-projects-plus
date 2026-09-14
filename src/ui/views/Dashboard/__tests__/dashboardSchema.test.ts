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

jest.mock("src/ui/modals/createFieldModal", () => ({
  CreateFieldModal: class {
    constructor(
      _app: unknown,
      _fields: unknown,
      onCreate: (field: unknown, value: unknown) => void
    ) {
      capturedOnCreate = onCreate;
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
    const api = { addField: jest.fn().mockResolvedValue({ written: 3, failed: [], missing: [] }) };
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
