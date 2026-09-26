/**
 * Live batch check 2026-09-26: the record panel grouped its fields under
 * English titles and descriptions («Date & Time», «Schedule and timing
 * information», «Note Fields»…) in every locale. They are translation keys
 * now; R0.28 did not see them because they were script literals.
 */

import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(path.join(__dirname, "..", "EditNote.svelte"), "utf8");
const locales = ["en", "ru", "uk", "zh-CN"].map((l) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "../../../../lib/stores/translations", `${l}.json`), "utf8").replace(String.fromCharCode(0xfeff), ""))
);

test("no field group keeps an English literal title or description", () => {
  expect(source).not.toMatch(/(title|description):\s*'[A-Z][^']*'/);
});

test.each(["datetime", "basic", "color", "image", "other-note", "other-project"])("%s has a title and description in every locale", (k) => {
  expect(source).toContain(`modals.note.edit.groups.${k}.title`);
  for (const l of locales) {
    const g = l.translation.modals.note.edit.groups[k];
    expect(g.title).toBeTruthy();
    expect(g.description).toBeTruthy();
  }
});
