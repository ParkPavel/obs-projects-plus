import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, DEFAULT_VIEW } from "src/settings/settings";
import { checkProjectCoreJson } from "../projectCoreCheck";

const savedEncoder = window.TextEncoder;
beforeAll(() => Object.defineProperty(window, "TextEncoder", { configurable: true, value: TextEncoder }));
afterAll(() => Object.defineProperty(window, "TextEncoder", { configurable: true, value: savedEncoder }));
const inspect = (type: unknown, config: unknown) => checkProjectCoreJson(JSON.stringify({ ...DEFAULT_PROJECT, id: "p", name: "P", views: [{ ...DEFAULT_VIEW, id: "v", name: "V", type, config }] }));
const at = (...location: (string | number)[]) => ["views", 0, "config", ...location];

test.each(["board", "gallery", "calendar"])("empty %s config preserves inheritance without claiming full-project readiness", type => {
  expect(inspect(type, {})).toMatchObject({ complete: false, issues: [] });
});

test("board settings keep runtime-compatible numeric values, legacy freeze key and named column maps", () => {
  const config = { groupByField: "Status", checkField: "", freezeColumns: true, freezeAll: false, columnWidth: 85.5, boardZoom: 5, thumbnailLayout: "left", groupMode: "semantic", includeFields: [], persistedStatuses: [""], columns: { "": { weight: -1.5, records: ["a.md", "b.md"], collapse: false, pinned: true } }, cardFrame: { heightRem: 2.5 }, cardFramesByRecord: { "a.md": { gridSpan: 1.5 } } };
  expect(inspect("board", config).issues).toEqual([]);
  expect(config.boardZoom).toBe(5); expect(config.columns[""].weight).toBe(-1.5);
});

test("gallery preserves explicit no-cover and legacy fill without clamping stored width or frames", () => {
  const config = { coverField: null, fitStyle: "fill", cardWidth: 900.5, layout: "masonry", coverAspectRatio: "none", showFieldLabels: false, groupByField: "", collapsedGroups: [""], cardPreview: "content", compact: false, cardFrame: {}, cardFramesByRecord: { "note.md": { gridSpan: 5, heightRem: 50 } } };
  expect(inspect("gallery", config).issues).toEqual([]);
  expect(config.cardWidth).toBe(900.5); expect(config.coverField).toBeNull();
});

test("calendar preserves null center and structural numbers, with local Agenda checked separately", () => {
  const config = { interval: "2weeks", displayMode: "bars", startDateField: "", endDateField: "end", startTimeField: "start", endTimeField: "end", eventColorField: "", creationDuration: 45, startHour: 5.5, endHour: 23, dateField: "date", checkField: "Done", statusField: "Status", iconField: "", centerOn: null, agendaOpen: false, localAgenda: { mode: "custom", custom: { lists: [] } }, timezone: "local", timeFormat: "24h" };
  expect(inspect("calendar", config).issues).toEqual([]);
});

test.each([
  ["board", { freezeColumns: "false" }, ["freezeColumns"], "invalid-type"],
  ["board", { columns: [] }, ["columns"], "invalid-type"],
  ["board", { columns: { Todo: { records: [1] } } }, ["columns", "Todo", "records", 0], "invalid-type"],
  ["board", { columns: { Todo: { weight: "2" } } }, ["columns", "Todo", "weight"], "invalid-type"],
  ["board", { columns: { Todo: { future: true } } }, ["columns", "Todo", "future"], "unknown-field"],
  ["board", { groupMode: "future" }, ["groupMode"], "unknown-kind"],
  ["gallery", { coverField: false }, ["coverField"], "invalid-type"],
  ["gallery", { cardWidth: "300" }, ["cardWidth"], "invalid-type"],
  ["gallery", { cardFramesByRecord: { "note.md": null } }, ["cardFramesByRecord", "note.md"], "invalid-type"],
  ["gallery", { cardFrame: { gridSpan: "2" } }, ["cardFrame", "gridSpan"], "invalid-type"],
  ["gallery", { layout: "extension" }, ["layout"], "unknown-kind"],
  ["calendar", { centerOn: 1 }, ["centerOn"], "invalid-type"],
  ["calendar", { interval: ["day"] }, ["interval"], "invalid-type"],
  ["calendar", { startHour: "6" }, ["startHour"], "invalid-type"],
  ["calendar", { localAgenda: null }, ["localAgenda"], "invalid-type"],
] as const)("%s nested present value is diagnosed at its typed location %#", (type, config, suffix, code) => {
  expect(inspect(type, config).issues).toContainEqual({ location: at(...suffix), code });
});

test("dynamic record/column keys are inspected safely even when they resemble prototypes", () => {
  const columns = JSON.parse('{"__proto__":{"pinned":true},"constructor":{"collapse":false}}');
  expect(inspect("board", { columns }).issues).toEqual([]);
  expect(inspect("gallery", { cardFramesByRecord: JSON.parse('{"__proto__":{"heightRem":2}}') }).issues).toEqual([]);
});

test("unknown view configs remain opaque, while legacy tables diagnose unknown keys without interpreting their contents", () => {
  const config = { cardFramesByRecord: false, localAgenda: null, columns: "opaque" };
  expect(inspect("custom", config).issues.filter(issue => issue.location[2] === "config")).toEqual([{ location: at(), code: "section-unchecked" }]);
  expect(inspect("table", config).issues).toEqual(Object.keys(config).map(key => ({ location: at(key), code: "unknown-field" })));
});

test("malformed view discriminators cannot invoke a JSON object's toString member", () => {
  const result = inspect({ toString: null }, {});
  expect(result.issues).toContainEqual({ location: ["views", 0, "type"], code: "invalid-type" });
});

test("typed database-call tabs inspect their local views while custom widgets stay opaque", () => {
  const tab = { id: "t", label: "Tab", viewType: "board", config: { columns: { Todo: { records: [4] } } } };
  const common = { title: "W", layout: { x: 0, y: 0, w: 12, h: 8 } };
  const config = { widgets: [{ ...common, id: "w", type: "database-call", config: { viewTabs: [tab] } }, { ...common, id: "other", type: "custom", config: { viewTabs: [tab] } }] };
  expect(inspect("dashboard", config).issues).toEqual([
    { location: at("widgets", 0, "config", "viewTabs", 0, "config", "columns", "Todo", "records", 0), code: "invalid-type" },
    { location: at("widgets", 1, "type"), code: "unknown-kind" },
  ]);
});
