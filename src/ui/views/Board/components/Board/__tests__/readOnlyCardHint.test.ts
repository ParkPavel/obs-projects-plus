/**
 * Live batch check 2026-09-26: on a source block's board (read-only, C4) a
 * card's pencil still said «Редактировать заметку» while it opens the note.
 * The column hands the list its read-only state and the pencil says «Открыть
 * заметку» then. Source-level, like linkedSourceWrites: CardList mounts
 * obsidian-svelte pieces jest stubs out.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const read = (f: string) => readFileSync(resolve(__dirname, "..", f), "utf8");

test("the column hands the card list its read-only state", () => {
  expect(read("BoardColumn.svelte")).toMatch(/<CardGroup[\s\S]*?readOnly=\{dataReadOnly\}/);
});

test("a read-only card's pencil says it opens the note", () => {
  expect(read("CardList.svelte")).toMatch(/tooltip=\{\$i18n\.t\(readOnly \? "common\.open-note" : "components\.note\.edit"\)\}/);
});
