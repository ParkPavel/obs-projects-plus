import type { DataRecord } from "src/lib/dataframe/dataframe";
import { mergeExternal } from "./editNoteMerge";

function rec(id: string, values: DataRecord["values"]): DataRecord {
  return { id, values };
}

describe("mergeExternal", () => {
  it("untouched field is taken from the store (last-writer-wins)", () => {
    const local = rec("a.md", { title: "local", status: "draft" });
    const store = rec("a.md", { title: "external", status: "draft" });
    const result = mergeExternal(local, store, new Set(["status"]));
    expect(result.values["title"]).toBe("external");
  });

  it("dirty field is kept from the local record", () => {
    const local = rec("a.md", { title: "local-edit", status: "draft" });
    const store = rec("a.md", { title: "external", status: "draft" });
    const result = mergeExternal(local, store, new Set(["title"]));
    expect(result.values["title"]).toBe("local-edit");
  });

  it("mixed: dirty from local, untouched from store", () => {
    const local = rec("a.md", { title: "local-edit", status: "draft", tag: "x" });
    const store = rec("a.md", { title: "external", status: "done", tag: "y" });
    const result = mergeExternal(local, store, new Set(["title"]));
    expect(result.values).toEqual({
      title: "local-edit",
      status: "done",
      tag: "y",
    });
  });

  it("key deleted in store: untouched key disappears, dirty key survives from local", () => {
    const local = rec("a.md", { title: "local-edit", status: "draft" });
    const store = rec("a.md", { title: "external" });
    const result = mergeExternal(local, store, new Set(["status"]));
    expect(result.values["status"]).toBe("draft");
    expect("title" in result.values).toBe(true);
    expect(result.values["title"]).toBe("external");
  });

  it("empty dirty == full replacement from store", () => {
    const local = rec("a.md", { title: "local", status: "draft" });
    const store = rec("a.md", { title: "external", status: "done" });
    const result = mergeExternal(local, store, new Set());
    expect(result).toBe(store);
  });

  it("id always comes from the store record", () => {
    const local = rec("local.md", { title: "x" });
    const store = rec("store.md", { title: "y" });
    const result = mergeExternal(local, store, new Set(["title"]));
    expect(result.id).toBe("store.md");
  });

  // #101.3 — models the live-modal sequence the reactive declaration drives:
  //   $: live = $dataFrame.records.find(r => r.id === recordId)
  //   $: if (live) record = mergeExternal(record, live, dirty)
  // The Svelte reactive wiring itself is not jest-mountable (see
  // editNoteMerge.untestable.md), so we verify the exact reconciliation it
  // performs against an external store update.
  describe("live-modal external update sequence", () => {
    it("external update refreshes untouched fields and preserves the field being edited", () => {
      // User opens modal, starts editing `title` (title ∈ dirty).
      const dirty = new Set<string>(["title"]);
      let record = rec("note.md", { title: "user typing…", status: "draft" });

      // External writer (api.updateRecord) changes BOTH title and status.
      const external = rec("note.md", {
        title: "renamed externally",
        status: "in-progress",
      });

      record = mergeExternal(record, external, dirty);

      // Untouched `status` adopts the external value; dirty `title` is kept.
      expect(record.values["status"]).toBe("in-progress");
      expect(record.values["title"]).toBe("user typing…");
    });

    it("after a successful save clears dirty, the next external update fully refreshes", () => {
      let dirty = new Set<string>(["title"]);
      let record = rec("note.md", { title: "local", status: "draft" });

      // performSave succeeds → dirty cleared.
      dirty = new Set<string>();

      const external = rec("note.md", { title: "external", status: "done" });
      record = mergeExternal(record, external, dirty);

      expect(record).toEqual(external);
    });
  });
});
