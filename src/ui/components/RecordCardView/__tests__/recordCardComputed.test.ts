import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { app } from "src/lib/stores/obsidian";
const mockPropertyLocks: boolean[] = [];

jest.mock("src/ui/modals/components/EditNote.svelte", () => {
  class Noop {
    constructor() {
      Object.assign(this, { $$: { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] } });
    }
    $set() {}
    $on() { return () => {}; }
    $destroy() {}
  }
  return { __esModule: true, default: Noop };
});

jest.mock("src/ui/properties/NotePropertiesBlock.svelte", () => {
  class Noop {
    constructor(options: { props: { readonly: boolean } }) {
      mockPropertyLocks.push(options.props.readonly);
      Object.assign(this, { $$: { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] } });
    }
    $set() {}
    $on() { return () => {}; }
    $destroy() {}
  }
  return { __esModule: true, default: Noop };
});

type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;
const { TFile } = require("obsidian");
const RecordCardView = require("../RecordCardView.svelte").default;

const field = (name: string, type: DataField["type"]): DataField => ({
  name,
  type,
  repeated: false,
  identifier: false,
  derived: true,
});

describe("RecordCardView computed values", () => {
  beforeEach(() => {
    mockPropertyLocks.length = 0;
    const file = new TFile("Notes/example.md");
    app.set({ vault: { getAbstractFileByPath: () => file } } as never);
  });

  afterEach(() => app.set(undefined as never));

  it.each([false, true])("passes the panel's readonly=%s to its note properties", readonly => {
    const view = render(RecordCardView, { props: { record: { id: "Notes/example.md", values: { title: "Original" } }, fields: [], readonly } });
    try { expect(mockPropertyLocks.at(-1)).toBe(readonly); }
    finally { view.unmount(); }
  });

  it("shows computed values in an initially expanded, read-only disclosure", () => {
    const record: DataRecord = {
      id: "Notes/example.md",
      values: {
        Total: "a result that remains readable when it wraps",
        Count: 0,
      },
    };
    const { container } = render(RecordCardView, {
      props: {
        open: true,
        fields: [
          field("Total", DataFieldType.Formula),
          field("Count", DataFieldType.Rollup),
        ],
        record,
      },
    });

    const disclosure = container.querySelector<HTMLDetailsElement>("details.ppp-rcv-computed");
    expect(disclosure).not.toBeNull();
    expect(disclosure?.open).toBe(true);
    expect(disclosure?.querySelector("summary")?.textContent).toContain("Computed properties");
    expect(disclosure?.querySelector("dl dt")?.textContent).toBe("Total");
    expect(disclosure?.querySelector("dl dd")?.textContent).toBe("a result that remains readable when it wraps");
    expect(disclosure?.querySelectorAll("input, textarea, select, button")).toHaveLength(0);
    expect(disclosure?.querySelectorAll("dt")).toHaveLength(2);
  });
});
