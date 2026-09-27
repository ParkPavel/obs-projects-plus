/**
 * Codex review of e9a4329 (P1): closing the peek within the 300 ms autosave
 * debounce lost the edit. Closing made the view pass `onSave = undefined`
 * before EditNote was destroyed; EditNote flushed its pending save into the
 * panel, whose handler called the now-absent callback. The right to save a
 * record is now held across the close — and only for that record — and an
 * open read-only record revokes it.
 */

import type { DataField } from "src/lib/dataframe/dataframe";
import { mayPeekSave, nextSaveAuthority } from "../peekResolution";

const fields = [] as unknown as DataField[];

test("the full lifecycle: open writable, close, the closing flush may still save", () => {
  let auth = nextSaveAuthority(null, "a.md", true, fields);
  expect(mayPeekSave(auth, "a.md")).toBe(true);
  auth = nextSaveAuthority(auth, null, false, fields); // the peek closes
  expect(mayPeekSave(auth, "a.md")).toBe(true);        // the flush lands
  expect(mayPeekSave(auth, "b.md")).toBe(false);       // but only for that record
});

test("an open read-only record revokes the right", () => {
  let auth = nextSaveAuthority(null, "a.md", true, fields);
  auth = nextSaveAuthority(auth, "ext.md", false, fields);
  expect(mayPeekSave(auth, "a.md")).toBe(false);
  expect(mayPeekSave(auth, "ext.md")).toBe(false);
});

test("never granted for a read-only record, even across a close", () => {
  let auth = nextSaveAuthority(null, "ext.md", false, fields);
  auth = nextSaveAuthority(auth, null, false, fields);
  expect(mayPeekSave(auth, "ext.md")).toBe(false);
});

test("the view hands the panel the held authority, not the live writable flag", () => {
  const src: string = require("fs").readFileSync(require("path").join(__dirname, "../../../ui/app/View.svelte"), "utf8");
  expect(src).toMatch(/onSave=\{saveAuthority \? savePeeked : undefined\}/);
  expect(src).not.toMatch(/onSave=\{peekWritable/);
  expect(src).toMatch(/\$: updateSaveAuthority\(peeked\?\.id \?\? null, peekWritable, peekFields\);/);
});
