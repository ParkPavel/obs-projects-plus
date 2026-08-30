import { createRelationSetupController } from "../relationSetupController";

jest.mock("src/ui/modals/relationSetupModal", () => ({
  RelationSetupModal: jest.fn().mockImplementation(() => ({
    open: jest.fn(),
    close: jest.fn(),
    setSummary: jest.fn(),
    $on: jest.fn(),
  })),
}));
jest.mock("src/lib/stores/settings", () => ({
  settings: { updateFieldConfig: jest.fn() },
}));

import { RelationSetupModal } from "src/ui/modals/relationSetupModal";

const mockApi = {
  // #144/#150 — addField reports a per-note outcome; the controller reads it to
  // decide whether the wizard may claim success. A stub returning undefined was
  // describing an API that no longer exists.
  addField: jest.fn().mockResolvedValue({ written: 1, failed: [], missing: [] }),
  resolveExternalFrame: jest.fn(),
};

function makeDeps(overrides?: Record<string, unknown>) {
  return {
    app: {} as never,
    api: mockApi as never,
    projectId: "proj-1",
    getFrame: () => ({
      fields: [{ name: "client", type: "relation" as never, repeated: true, identifier: false, derived: false }],
      records: [],
    }),
    getProjects: () => [],
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createRelationSetupController", () => {
  test("open() creates and opens the modal immediately", async () => {
    const { open } = createRelationSetupController(makeDeps());
    const draft = { fieldName: "client", targetProjectId: "", createSourceField: false };
    await open(draft);
    expect(RelationSetupModal).toHaveBeenCalledTimes(1);
    const instance = (RelationSetupModal as jest.Mock).mock.results[0]?.value;
    expect(instance.open).toHaveBeenCalledTimes(1);
  });

  test("save() throws on invalid draft (empty fieldName)", async () => {
    const { save } = createRelationSetupController(makeDeps());
    await expect(save({ fieldName: "", targetProjectId: "t", createSourceField: false }))
      .rejects.toThrow();
  });

  test("save() throws on invalid draft (empty targetProjectId)", async () => {
    const { save } = createRelationSetupController(makeDeps());
    await expect(save({ fieldName: "client", targetProjectId: "", createSourceField: false }))
      .rejects.toThrow();
  });

  test("save() calls api.addField when createSourceField is true", async () => {
    const { save } = createRelationSetupController(makeDeps({ getFrame: () => ({ fields: [], records: [] }) }));
    await save({ fieldName: "newField", targetProjectId: "proj-2", createSourceField: true });
    expect(mockApi.addField).toHaveBeenCalledTimes(1);
    const firstCall = mockApi.addField.mock.calls[0];
    expect(firstCall?.[0]).toMatchObject({ name: "newField" });
  });

  test("save() skips api.addField when createSourceField is false (field exists)", async () => {
    const { save } = createRelationSetupController(makeDeps());
    await save({ fieldName: "client", targetProjectId: "proj-2", createSourceField: false });
    expect(mockApi.addField).not.toHaveBeenCalled();
  });

  test("refreshPreview skips setSummary when targetProjectId is empty", async () => {
    mockApi.resolveExternalFrame = jest.fn().mockResolvedValue(null);
    const { open } = createRelationSetupController(makeDeps());
    await open({ fieldName: "client", targetProjectId: "", createSourceField: false });
    const instance = (RelationSetupModal as jest.Mock).mock.results[0]?.value;
    expect(instance.setSummary).toHaveBeenCalledWith(undefined);
  });

  test("refreshPreview calls setSummary when targetProjectId is set and frame resolves", async () => {
    const targetFrame = { fields: [], records: [{ id: "clients/Ada.md", values: { name: "Ada" } }] };
    mockApi.resolveExternalFrame = jest.fn().mockResolvedValue(targetFrame);
    const { open } = createRelationSetupController(makeDeps({
      getFrame: () => ({
        fields: [],
        records: [{ id: "sessions/s1.md", values: { client: "[[Ada]]" } }],
      }),
    }));
    await open({ fieldName: "client", targetProjectId: "clients", createSourceField: false });
    const instance = (RelationSetupModal as jest.Mock).mock.results[0]?.value;
    expect(instance.setSummary).toHaveBeenCalledWith(
      expect.objectContaining({ resolved: expect.any(Number) })
    );
  });
});
