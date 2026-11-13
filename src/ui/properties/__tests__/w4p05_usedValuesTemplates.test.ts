/**
 * w4-p05 (audit F11, P05) — the note header's value lists leave templates out:
 * a note in a template folder, and template text in any note.
 *
 * Why these fail on the old code: the cache read every note of the project's
 * folder, so a project kept at the vault root offered the template's values,
 * and `<% %>` / `{{ }}` text was offered as a value.
 */

import { createUsedValuesCache } from "../usedValuesCache";

const notes: Record<string, Record<string, unknown>> = {
  "visit-1.md": { status: "Alpha" },
  "visit-2.md": { status: "{{status}}" },
  "Templates/visit.md": { status: "Template only" },
  "Templates/deep/visit.md": { status: "<% tp.file.title %>" },
  "Archive/visit.md": { status: "Beta" },
};

const source = (folders: string[]) => ({
  files: () => Object.keys(notes).map((path) => ({ path })),
  frontmatterOf: (f: { path: string }) => notes[f.path],
  templateFolders: () => folders,
});

describe("w4-p05 — note header suggestions without templates", () => {
  test("a template folder's notes and template text are not offered", () => {
    const cache = createUsedValuesCache(source(["Templates"]));
    const values = cache.get("visit-1.md", notes["visit-1.md"], "status", { folder: "", recursive: true });
    expect(values).toEqual(["Alpha", "Beta"]);
    cache.dispose();
  });

  test("the note's own template text is not offered either", () => {
    const cache = createUsedValuesCache(source([]));
    const values = cache.get("visit-2.md", notes["visit-2.md"], "status", { folder: "", recursive: false });
    expect(values).toEqual(["Alpha"]);
    cache.dispose();
  });
});
