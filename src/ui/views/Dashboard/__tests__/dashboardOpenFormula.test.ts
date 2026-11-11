import { applyFormulaFields } from "src/lib/dashboard-engine/applyFormulaFields";
type DatabaseViewConfig = import("../types").DatabaseViewConfig;
const mockMounts: Array<{props: {config: DatabaseViewConfig}}> = [];
jest.mock("../DashboardCanvas.svelte", () => ({
  __esModule: true,
  default: class {
    constructor(options: {props: {config: DatabaseViewConfig}}) { mockMounts.push(options); }
    $set() {}
    $destroy() {}
  },
}));
jest.mock("src/lib/settingsBackup", () => ({writeMigrationBackup: jest.fn(async () => "backup")}));
const { DashboardView } = require("../dashboardView");

test("opening a saved dashboard preserves unversioned formula semantics and does not save a new version", () => {
  const config: DatabaseViewConfig = {
    widgets: [], layoutMode: "stack", layoutVersion: 1, table: {},
    showWidgetToolbar: true, compactMode: false,
    formulaFields: [{name: "Answer", expression: '\"2\" < \"10\"'}],
  };
  const before = JSON.stringify(config);
  const saveConfig = jest.fn();
  const view = new DashboardView();
  view.onOpen({config, saveConfig, project: {id: "p"}, viewId: "v", contentEl: document.createElement("div")});
  expect(saveConfig).not.toHaveBeenCalled();
  expect(JSON.stringify(config)).toBe(before);
  const mounted = mockMounts[mockMounts.length - 1]!.props.config;
  const result = applyFormulaFields({fields: [], records: [{id: "r", values: {}}]}, mounted.formulaFields!);
  expect(result.records[0]!.values["Answer"]).toBe(true);
  view.onClose();
});
