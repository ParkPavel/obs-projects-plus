/**
 * w4-p05 (audit F11, P05) — one list of value suggestions for one project.
 *
 * The policy (CONSOLIDATION §7, row 10): the values the project's records hold
 * for the field, after the options its schema declares; template folders and
 * template text never count; one memo, renewed when the view's records change.
 *
 * Why these fail on the old code: there was no shared module to import (the
 * suite does not load), and each surface built its own list.
 */

import { DataFieldType, type DataRecord } from "src/lib/dataframe/dataframe";
import {
  inTemplateFolder,
  isTemplateText,
  suggestionBuilds,
  suggestionTexts,
  templateFoldersOf,
  valueSuggestions,
} from "../valueSuggestions";

const status = { name: "status", type: DataFieldType.String, typeConfig: { options: ["Planned", "Done"] } };
const records: DataRecord[] = [
  { id: "Visits/a.md", values: { status: "Done", who: "[[People/Ann|Ann]]", tags: ["x", "y"] } },
  { id: "Visits/b.md", values: { status: "Waiting", who: "[[People/Bob]]", tags: "y" } },
  { id: "Visits/c.md", values: { status: "<% tp.system.suggester(['a']) %>", who: null } },
  { id: "Visits/d.md", values: { status: "{{status}}", who: "" } },
  { id: "Templates/visit.md", values: { status: "Template only" } },
  { id: "Visits/e.md", values: { status: "  Arrived  " } },
];

describe("w4-p05 — what counts as a suggestion", () => {
  test("template text is recognised in both engines' syntax", () => {
    expect(isTemplateText("<% tp.date.now() %>")).toBe(true);
    expect(isTemplateText("Due {{date:YYYY-MM-DD}}")).toBe(true);
    expect(isTemplateText("100% done")).toBe(false);
    expect(isTemplateText("{single}")).toBe(false);
  });

  test("a stored value as texts: list items, a link's shown text, nothing empty", () => {
    expect(suggestionTexts(["x", " y ", null, ""])).toEqual(["x", "y"]);
    expect(suggestionTexts("[[People/Ann|Ann]]")).toEqual(["Ann"]);
    expect(suggestionTexts("[[People/Bob]]")).toEqual(["People/Bob"]);
    expect(suggestionTexts({ nested: 1 })).toEqual([]);
    expect(suggestionTexts(3)).toEqual(["3"]);
    expect(suggestionTexts("null")).toEqual([]);
  });

  test("a template folder holds its own path and everything under it", () => {
    expect(inTemplateFolder("Templates/visit.md", ["Templates"])).toBe(true);
    expect(inTemplateFolder("Templates/sub/visit.md", ["Templates"])).toBe(true);
    expect(inTemplateFolder("TemplatesX/visit.md", ["Templates"])).toBe(false);
    expect(inTemplateFolder("Visits/a.md", [""])).toBe(false);
  });
});

describe("w4-p05 — the list for a field", () => {
  test("declared options first, then the project's values sorted; templates left out", () => {
    const list = valueSuggestions(records, status, { templateFolders: ["Templates"] });
    expect(list).toEqual(["Planned", "Done", "Arrived", "Waiting"]);
  });

  test("a yes/no field offers true and false", () => {
    expect(valueSuggestions(records, { name: "paid", type: DataFieldType.Boolean })).toEqual(["true", "false"]);
  });

  test("links and lists give their texts", () => {
    expect(valueSuggestions(records, { name: "who", type: DataFieldType.String })).toEqual(["Ann", "People/Bob"]);
    expect(valueSuggestions(records, { name: "tags", type: DataFieldType.List })).toEqual(["x", "y"]);
  });

  test("no field, no list", () => {
    expect(valueSuggestions(records, undefined)).toEqual([]);
  });
});

describe("w4-p05 — one memo, renewed with the records", () => {
  test("the same records give the same list without building it again", () => {
    const own = [...records];
    const before = suggestionBuilds();
    const first = valueSuggestions(own, status, { templateFolders: ["Templates"] });
    const second = valueSuggestions(own, status, { templateFolders: ["Templates"] });
    expect(second).toBe(first);
    expect(suggestionBuilds() - before).toBe(1);
  });

  test("a modified, deleted or renamed note is seen in the next set of records", () => {
    const base = [...records];
    expect(valueSuggestions(base, status, { templateFolders: ["Templates"] })).toContain("Waiting");
    // modify: b changes its status
    const modified = base.map((r) => (r.id === "Visits/b.md" ? { ...r, values: { ...r.values, status: "Cancelled" } } : r));
    expect(valueSuggestions(modified, status, { templateFolders: ["Templates"] })).toEqual(["Planned", "Done", "Arrived", "Cancelled"]);
    // delete: e is gone
    const deleted = modified.filter((r) => r.id !== "Visits/e.md");
    expect(valueSuggestions(deleted, status, { templateFolders: ["Templates"] })).not.toContain("Arrived");
    // rename into the template folder: its value stops counting
    const renamed = deleted.map((r) => (r.id === "Visits/b.md" ? { ...r, id: "Templates/b.md" } : r));
    expect(valueSuggestions(renamed, status, { templateFolders: ["Templates"] })).not.toContain("Cancelled");
  });

  test("a changed schema or template folder builds a new list for the same records", () => {
    const own = [...records];
    const a = valueSuggestions(own, status, { templateFolders: [] });
    expect(a).toContain("Template only");
    const b = valueSuggestions(own, { ...status, typeConfig: { options: ["New"] } }, { templateFolders: ["Templates"] });
    expect(b[0]).toBe("New");
    expect(b).not.toContain("Template only");
  });
});

describe("w4-p05 — template folders from the app", () => {
  test("core Templates and Templater folders, trimmed; absent or off plugins add nothing", () => {
    const app = {
      internalPlugins: { getPluginById: (id: string) => (id === "templates" ? { enabled: true, instance: { options: { folder: "/Templates/" } } } : null) },
      plugins: { plugins: { "templater-obsidian": { settings: { templates_folder: "System/Templater" } } } },
    };
    expect(templateFoldersOf(app)).toEqual(["Templates", "System/Templater"]);
    const off = { internalPlugins: { getPluginById: () => ({ enabled: false, instance: { options: { folder: "Templates" } } }) } };
    expect(templateFoldersOf(off)).toEqual([]);
    expect(templateFoldersOf(undefined)).toEqual([]);
    expect(templateFoldersOf({ plugins: { plugins: {} } })).toEqual([]);
  });
});
