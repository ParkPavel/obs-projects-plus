/**
 * #188 — a message that was right and still read as broken.
 *
 * The user hit a settings panel where "filter by field" was empty, next to a
 * correct explanation: no Relation field points at the linked block's project.
 * They wrote «не даёт выбрать» — they read it as a fault, not as an
 * instruction. Two things made that easy:
 *
 *   1. it named an action ("add a Relation field in the schema editor") and
 *      then left them to go find the editor themselves;
 *   2. above the table, a second warning said the same thing in other words —
 *      `Relation '' is broken (missing-relation)` — with an empty field name, a
 *      technical reason and the word "broken" for something never set up.
 *
 * These are asserted on source text because the panel and the block are Svelte
 * components in a tree that cannot be mounted here (`DatabaseCallBlock` closes
 * a require cycle through `BoardView`). Named as such rather than dressed up.
 */

import * as fs from "fs";
import * as path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

const SETTINGS = read("DatabaseCallSettings.svelte");
const BLOCK = read("DatabaseCallBlock.svelte");

const SRC = path.resolve(__dirname, "..", "..", "..", "..", "..", "..");

const locale = (name: string) =>
  JSON.parse(
    fs
      .readFileSync(path.join(SRC, "lib", "stores", "translations", `${name}.json`), "utf8")
      .replace(/^\uFEFF/, "")
  ).translation.views.dashboard["database-call"];

describe("#188 — the hint ends where the work is done", () => {
  it("offers a way to open the schema editor, not just its name", () => {
    expect(SETTINGS).toContain("relation-open-schema");
    expect(SETTINGS).toMatch(/emitCommand\("open-schema"\)/);
  });

  it("goes through the command bus rather than a second opener", () => {
    // There is one way to open the schema editor — the palette and this button
    // reach the same handler. A direct call here would be a parallel path that
    // drifts the first time the real one changes.
    expect(SETTINGS).toContain('from "src/lib/stores/commandBus"');
    expect(SETTINGS).not.toMatch(/new\s+SchemaModal|openSchema\s*\(/);
  });
});

describe("#188 — not configured is not the same as broken", () => {
  it("says so in its own branch, before the broken wording is reached", () => {
    // `Relation '' is broken (missing-relation)` was what a user saw for a
    // relation they had never set up. The unset branch has to come FIRST or the
    // broken sentence swallows it again.
    const unset = BLOCK.indexOf('filterLabel === "broken" && !linkedSelection?.relationField');
    const broken = BLOCK.indexOf('{:else if filterLabel === "broken"}');
    expect(unset).toBeGreaterThan(-1);
    expect(broken).toBeGreaterThan(unset);
  });

  it("and the unset copy carries neither a quoted empty name nor a reason code", () => {
    // The two things that made the old sentence read as a fault report.
    const start = BLOCK.indexOf("relation-unset");
    const copy = BLOCK.slice(start, start + 200);
    expect(copy).not.toContain("{{reason}}");
    expect(copy).not.toContain("'{{field}}'");
  });
});

describe("#188 — the strings exist in the locales that carry this panel", () => {
  it("English and Russian both have the hint and the action", () => {
    for (const name of ["en", "ru"]) {
      const dc = locale(name);
      expect({ name, hint: !!dc.settings["relation-missing-hint"] }).toEqual({ name, hint: true });
      expect({ name, action: !!dc.settings["relation-open-schema"] }).toEqual({ name, action: true });
    }
  });

  it("records that Russian has no filter-label block at all", () => {
    // Not an oversight of this ticket and not fixed by it: the whole
    // `filter-label` group is untranslated in ru and runs on defaultValue, like
    // several others. Pinned so the gap is visible to #140 rather than
    // rediscovered, and so that adding the block later trips this and gets read.
    expect(locale("en")["filter-label"]).toBeDefined();
    expect(locale("ru")["filter-label"]).toBeUndefined();
  });
});
