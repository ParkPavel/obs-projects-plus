/**
 * R0.4 — archive containment (UT2026-A L1, #068/#074 F3; re-armed by #176).
 *
 * The original rule: nothing outside `src/archive` may import from
 * `src/archive`. Archived V1 code was reference material, not production code,
 * and the fields/groups popover crash (#068) shipped because the archived
 * `DataTableWidget` kept executing in every dashboard. The ratchet made the
 * quarantine real.
 *
 * `src/archive/dashboard-v1` was then deleted outright in `2e886a7` (#119,
 * 5401 LOC). From that commit the ratchet guarded a directory that no longer
 * existed, and it did so silently: it walked `src/`, matched nothing, and
 * passed. A ratchet that cannot fail is worse than no ratchet — a reader cannot
 * tell it from a live one, which is exactly the confusion #176 was filed for.
 *
 * The rule is therefore HISTORICAL, not deleted, and this file states which
 * regime it is in:
 *
 *   - `ARCHIVE_PRESENT` declares whether an archive root is expected. It is
 *     `false`, and the first test fails the moment the tree disagrees. Bringing
 *     `src/archive` back is allowed — it just has to be deliberate: flip the
 *     constant, which re-arms the containment scan on the same commit.
 *   - The containment logic is a pure function over (path, content) pairs and
 *     is exercised by its own cases regardless of what is on disk, so the rule
 *     is proven to work before it is ever needed again.
 *
 * The old matcher also had a defect worth recording: it looked only for
 * `from "src/archive/…"` and `require("src/archive/…")`. The last archive
 * reference to survive into `2e886a7^` was
 * `jest.mock("src/archive/dashboard-v1/DataTable/DataTableWidget.svelte")` in
 * `dataProviderRegistration.test.ts`, which the old pattern did not match, and
 * the tree carries relative imports (`../archive/…` would have been missed too).
 * The matcher below covers `from`, bare `import`, `require`, dynamic `import()`
 * and `jest.mock`, and deliberately does NOT match a quoted path that is merely
 * data — `{ id: "archive/Sam.md" }` is a record id in `relationSetup.test.ts`,
 * not a module specifier.
 */

import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.resolve(__dirname, "..");
const ARCHIVE_DIR = path.join(SRC_ROOT, "archive");
const SCANNED = new Set([".ts", ".svelte"]);

/**
 * Whether an archive root is expected under `src/`. Deleted in #119; the tree
 * has had none since. Flip to `true` in the same change that reintroduces one.
 */
const ARCHIVE_PRESENT = false;

/** Module-specifier sites: `from "x"`, `import "x"`, `require("x")`, `import("x")`, `jest.mock("x")`. */
const SPECIFIER_SITE =
  /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|\bjest\s*\.\s*mock\s*\(\s*|\bimport\s+)(["'])([^"']+)\1/g;

/** A specifier pointing into a directory named `archive`, absolute-ish or relative. */
const ARCHIVE_SPECIFIER = /(?:^|\/)archive\//;

/** Every module specifier in `content` that resolves into an archive directory. */
function archiveSpecifiers(content: string): string[] {
  const found: string[] = [];
  for (const match of content.matchAll(SPECIFIER_SITE)) {
    const specifier = match[2];
    if (specifier !== undefined && ARCHIVE_SPECIFIER.test(specifier)) found.push(specifier);
  }
  return found;
}

interface SourceFile {
  /** Absolute path, so containment can be decided against `ARCHIVE_DIR`. */
  path: string;
  content: string;
}

const insideArchive = (file: string) =>
  file === ARCHIVE_DIR || file.startsWith(ARCHIVE_DIR + path.sep);

/**
 * This file states the rule, so it necessarily quotes violations of it. Same
 * self-exclusion R0.7 makes for the numbers it defines. Nothing else is exempt.
 */
const RULE_DEFINITION = path.join(SRC_ROOT, "__tests__", "R0_4_archiveContainment.test.ts");

/**
 * Files outside the archive that reference an archive module, reported as
 * `relative/path → specifier`. The archive may import from itself.
 */
function findOffenders(files: readonly SourceFile[]): string[] {
  const offenders: string[] = [];
  for (const file of files) {
    if (insideArchive(file.path)) continue;
    for (const specifier of archiveSpecifiers(file.content)) {
      offenders.push(`${path.relative(SRC_ROOT, file.path).replace(/\\/g, "/")} → ${specifier}`);
    }
  }
  return offenders;
}

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      collectFiles(full, out);
    } else if (SCANNED.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

describe("R0.4 archive containment (UT2026-A L1)", () => {
  it("the declared regime matches the tree", () => {
    // The assertion #176 exists for. Silence here used to mean "guarding
    // nothing"; now it means the constant and the directory agree.
    expect(fs.existsSync(ARCHIVE_DIR)).toBe(ARCHIVE_PRESENT);
  });

  it("recognises an archive specifier at every import site", () => {
    expect(archiveSpecifiers('import x from "src/archive/dashboard-v1/x";')).toEqual([
      "src/archive/dashboard-v1/x",
    ]);
    expect(archiveSpecifiers('import "../archive/side-effect";')).toEqual([
      "../archive/side-effect",
    ]);
    expect(archiveSpecifiers('const m = require("src/archive/legacy");')).toEqual([
      "src/archive/legacy",
    ]);
    expect(archiveSpecifiers('await import("./archive/lazy");')).toEqual(["./archive/lazy"]);
    // The reference the pre-#176 matcher missed, taken from `2e886a7^`.
    expect(
      archiveSpecifiers(
        'jest.mock("src/archive/dashboard-v1/DataTable/DataTableWidget.svelte", () => ({}));'
      )
    ).toEqual(["src/archive/dashboard-v1/DataTable/DataTableWidget.svelte"]);
  });

  it("does not mistake a quoted path for an import", () => {
    // `relationSetup.test.ts` really carries this record id; a matcher that
    // flagged it would be reverted on its first run, which is how ratchets die.
    expect(archiveSpecifiers('{ id: "archive/Sam.md", values: { title: "Sam" } }')).toEqual([]);
    expect(archiveSpecifiers('import { archived } from "src/lib/archiveless";')).toEqual([]);
  });

  it("reports an outside importer and spares the archive's own files", () => {
    // Proves the containment rule works while no archive exists to prove it on.
    const offenders = findOffenders([
      { path: path.join(SRC_ROOT, "ui", "Widget.svelte"), content: 'import a from "src/archive/a";' },
      { path: path.join(ARCHIVE_DIR, "a.ts"), content: 'import b from "src/archive/b";' },
      { path: path.join(SRC_ROOT, "lib", "clean.ts"), content: 'import c from "src/lib/c";' },
    ]);
    expect(offenders).toEqual(["ui/Widget.svelte → src/archive/a"]);
  });

  it("has zero imports from an archive directory outside the archive itself", () => {
    const files = collectFiles(SRC_ROOT)
      .filter((p) => p !== RULE_DEFINITION)
      .map((p) => ({ path: p, content: fs.readFileSync(p, "utf8") }));
    expect(findOffenders(files)).toEqual([]);
  });

  it("scans the tree it claims to scan", () => {
    // Without this the exclusion above could grow, or `collectFiles` could
    // start at the wrong root, and the scan would pass by looking at nothing.
    const scanned = collectFiles(SRC_ROOT).filter((p) => p !== RULE_DEFINITION);
    expect(scanned.length).toBeGreaterThan(200);
    expect(scanned).toContain(path.join(SRC_ROOT, "main.ts"));
  });
});
