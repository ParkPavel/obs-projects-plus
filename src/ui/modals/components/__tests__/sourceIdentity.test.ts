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

describe("#184 — the PRIMARY source keeps its identity through every edit", () => {
  /**
   * Found by the vault run on 2026-09-04, and it is the second half of a fix
   * that only looked complete.
   *
   * The first pass gave the primary source an id when its KIND changed. Six
   * other handlers — folder path, include-subfolders, tag, hierarchy, dataview
   * query, native-query config — each rebuilt `{ kind, config }` from scratch,
   * so typing a path threw the id away again. The user created a project
   * through this modal, configured its source, and it reached `data.json` with
   * no id at all: the block's source picker was empty and nothing said why.
   *
   * Asserted on source text for the same reason as the tests above — mounting
   * this modal needs a vault — but asserted as an ABSENCE as well as a
   * presence, because a seventh handler added later would reintroduce exactly
   * this defect and a presence check alone would stay green.
   */
  it("edits go through one function that preserves it", () => {
    expect(EDITOR).toMatch(/function patchPrimaryConfig/);
    // Every config edit routes through it…
    for (const call of [
      "patchPrimaryConfig({ path })",
      "patchPrimaryConfig({ recursive })",
      "patchPrimaryConfig({ tag })",
      "patchPrimaryConfig({ hierarchy })",
      "patchPrimaryConfig({ query })",
    ]) {
      expect(EDITOR).toContain(call);
    }
  });

  it("and NOTHING rebuilds the primary source from kind and config alone", () => {
    // The shape that caused it: `dataSource: { kind: ..., config: ... }` with
    // no spread of what came before. If this matches again, an id is being
    // dropped somewhere.
    const rebuildsFromScratch = /dataSource:\s*\{\s*kind:\s*[^}]*?config:/s;
    expect(EDITOR).not.toMatch(rebuildsFromScratch);
  });

  it("an edit mints an id when the source never had one", () => {
    // A project stored before #170 becomes addressable the first time its
    // source is touched — without a migration that rewrites vaults nobody
    // asked us to touch.
    expect(EDITOR).toMatch(/id: current\.id \?\? uuidv4\(\)/);
  });

  it("the primary source also carries a name across a kind change", () => {
    expect(EDITOR).toMatch(/\.\.\.\(previous\?\.name \? \{ name: previous\.name \} : \{\}\)/);
  });
});
