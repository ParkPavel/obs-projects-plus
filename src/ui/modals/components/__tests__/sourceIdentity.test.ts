/**
 * #170 — the identity a source gets when it is created, and keeps when it
 * changes kind.
 *
 * Step 1 added `id?` and `name?` to the stored source variants and nothing
 * filled them, so "a block addresses one source instead of the merge" was
 * unreachable: there was no id to address. This pins the two rules that make
 * it reachable, on the source text of the editor, because the alternative is
 * mounting a modal with a fake vault to observe a uuid.
 */

import * as fs from "fs";
import * as path from "path";

const EDITOR = fs.readFileSync(
  path.join(__dirname, "..", "CreateProject.svelte"),
  "utf8"
);

describe("#170 — a source is addressable from the moment it exists", () => {
  it("a new source is created with an id", () => {
    // Without this the field stays undefined forever and nothing can point at
    // it, which is what made step 1 storage-only.
    expect(EDITOR).toMatch(/sources\.push\(\{ id: uuidv4\(\)/);
  });

  it("the id survives a change of kind", () => {
    // A block pointing here means "the second source of this project". The
    // user swapping a folder for a tag has not made it a different source, and
    // minting a new id would silently break every block that named it.
    expect(EDITOR).toMatch(/id: previous\?\.id \?\? uuidv4\(\)/);
  });

  it("the name is editable and separate from the id", () => {
    // The id is what a block stores and is never shown; the name is the user's
    // and may change freely. Renaming must not break a reference.
    expect(EDITOR).toMatch(/renameAdditionalSource/);
    expect(EDITOR).toMatch(/value=\{src\.name \?\? ""\}/);
  });

  it("an empty name removes the key rather than storing a blank", () => {
    // `name: ""` would make `sourceLabel` fall back through a value that is
    // present but says nothing; absent is the honest state, and it is what
    // every source stored before #170 already has.
    expect(EDITOR).toMatch(/trimmed \? \{ \.\.\.current, name: trimmed \}/);
  });
});
