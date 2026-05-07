/**
 * useView — ProjectView lifecycle tests (R5-014).
 *
 * Validates the action contract:
 *   - initial setup: onOpen + onData called once
 *   - same view, config changed: updateProps + onData called
 *   - same view, nothing changed: only onData called
 *   - view switch: onClose on old, onOpen + onData on new
 *   - destroy: onClose called
 *   - view type is looked up directly (no runtime remapping — R5-008 migration handles it)
 */

import { describe, expect, it, jest, beforeEach } from "@jest/globals";

import { ProjectView, type DataQueryResult } from "src/customViewApi";
import { customViews } from "src/lib/stores/customViews";
import type { ViewProps } from "./useView";
import { useView } from "./useView";
import type {
  ViewDefinition,
  FilterDefinition,
  ColorFilterDefinition,
  SortDefinition,
} from "src/settings/settings";
import type { ProjectDefinition } from "src/settings/v3/settings";

// ── helpers ──────────────────────────────────────────────────────────────────

const emptyFilter: FilterDefinition = { conjunction: "and", conditions: [] };
const emptyColors: ColorFilterDefinition = { conditions: [] };
const emptySort: SortDefinition = { criteria: [] };

function makeView(id: string, type = "mock"): ViewDefinition {
  return { id, type, name: id, config: {}, filter: emptyFilter, colors: emptyColors, sort: emptySort };
}

function makeProject(id: string): ProjectDefinition<ViewDefinition> {
  return {
    id,
    name: id,
    fieldConfig: {},
    views: [],
    defaultName: "Untitled",
    templates: [],
    excludedNotes: [],
    isDefault: false,
    dataSource: { kind: "folder", config: { path: "/", recursive: false } },
    newNotesFolder: "",
  };
}

const emptyData: DataQueryResult = {
  data: { fields: [], records: [] },
  hasSort: false,
  hasFilter: false,
};

function makeProps(overrides: Partial<ViewProps> = {}): ViewProps {
  return {
    view: makeView("v1"),
    dataProps: emptyData,
    config: {},
    onConfigChange: jest.fn() as any,
    viewApi: {} as any,
    readonly: false,
    project: makeProject("p1"),
    getRecordColor: () => null,
    sortRecords: (r) => [...r],
    getRecord: () => undefined,
    ...overrides,
  };
}

/** Mock HTMLElement with Obsidian's .empty() polyfill. */
function makeNode(): HTMLElement & { empty: () => void } {
  const el = document.createElement("div") as HTMLElement & { empty: () => void };
  el.empty = jest.fn() as any;
  return el;
}

class MockProjectView extends ProjectView {
  onOpen = jest.fn();
  onData = jest.fn();
  onClose = jest.fn();
  updateProps = jest.fn();
  getViewType = () => "mock";
  getDisplayName = () => "Mock";
  getIcon = () => "file";
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("useView lifecycle", () => {
  let mockView: MockProjectView;

  beforeEach(() => {
    mockView = new MockProjectView();
    customViews.set({ mock: mockView });
  });

  it("calls onOpen and onData on initial setup", () => {
    const node = makeNode();
    const props = makeProps();

    useView(node, props);

    expect(mockView.onOpen).toHaveBeenCalledTimes(1);
    expect(mockView.onData).toHaveBeenCalledTimes(1);
    expect(mockView.onData).toHaveBeenCalledWith(emptyData);
  });

  it("calls updateProps and onData when config changes (same view)", () => {
    const node = makeNode();
    const props = makeProps();
    const action = useView(node, props);

    const newConfig = { zoom: 2 };
    action.update(makeProps({ config: newConfig }));

    expect(mockView.updateProps).toHaveBeenCalledTimes(1);
    expect(mockView.updateProps).toHaveBeenCalledWith({ config: newConfig });
    expect(mockView.onData).toHaveBeenCalledTimes(2);
    expect(mockView.onOpen).toHaveBeenCalledTimes(1); // no remount
  });

  it("does NOT call updateProps when nothing has changed", () => {
    const node = makeNode();
    const props = makeProps({ config: { zoom: 1 } });
    const action = useView(node, props);

    action.update(makeProps({ config: { zoom: 1 } }));

    expect(mockView.updateProps).not.toHaveBeenCalled();
    expect(mockView.onData).toHaveBeenCalledTimes(2);
  });

  it("calls updateProps with project when project content changes (same id)", () => {
    const node = makeNode();
    const action = useView(node, makeProps());

    const updatedProject = { ...makeProject("p1"), name: "Updated Project" };
    action.update(makeProps({ project: updatedProject, view: makeView("v1") }));

    expect(mockView.updateProps).toHaveBeenCalledWith({ project: updatedProject });
    expect(mockView.onOpen).toHaveBeenCalledTimes(1);
  });

  it("remounts on view id change: onClose → onOpen → onData", () => {
    const node = makeNode();
    const action = useView(node, makeProps({ view: makeView("v1") }));

    action.update(makeProps({ view: makeView("v2") }));

    expect(mockView.onClose).toHaveBeenCalledTimes(1);
    expect(mockView.onOpen).toHaveBeenCalledTimes(2);
    expect(mockView.onData).toHaveBeenCalledTimes(2);
  });

  it("calls onClose on destroy", () => {
    const node = makeNode();
    const action = useView(node, makeProps());

    action.destroy();

    expect(mockView.onClose).toHaveBeenCalledTimes(1);
  });

  it("remounts when project id changes even with same view id", () => {
    const node = makeNode();
    const action = useView(node, makeProps({ project: makeProject("p1"), view: makeView("v1") }));

    action.update(makeProps({ project: makeProject("p2"), view: makeView("v1") }));

    expect(mockView.onClose).toHaveBeenCalledTimes(1);
    expect(mockView.onOpen).toHaveBeenCalledTimes(2);
  });

  it("looks up view type directly from registry (no runtime remap)", () => {
    const dashView = new MockProjectView();
    customViews.set({ dashboard: dashView });

    const node = makeNode();
    useView(node, makeProps({ view: makeView("v1", "dashboard") }));

    expect(dashView.onOpen).toHaveBeenCalledTimes(1);
  });
});
