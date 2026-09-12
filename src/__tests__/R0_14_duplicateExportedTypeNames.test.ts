/**
 * R0.14 — no two exported type names collide across `src/lib` (#179).
 *
 * `TransformStep` was exported twice: the stored, executed pipeline step in
 * `lib/dashboard-engine/transformTypes.ts` (discriminated by `type`) and the
 * unbuilt v4 engine IR (discriminated by `kind`). The two shapes overlap enough
 * that importing the wrong one COMPILED. That is the class of defect this repo
 * keeps paying for: silent, and green on all four gates, because each file is
 * individually correct. `MANUAL_TESTING_PIPELINE.md` §4a records the runtime
 * half of the same trap — a step carrying `kind` is dropped by the migrator
 * without a word, and the run "passes" testing nothing.
 *
 * **The original subject no longer exists.** #179 renamed the IR to
 * `TransformStepIR`; #178 (2026-09-02) then deleted the module that declared it,
 * along with the two dead modules that were its only importers, and preserved
 * their text at `docs/internal/archive/ENGINE_CONTRACTS_V4_DESIGN.md`. Like R0.4,
 * this ratchet now outlives its subject: it guards the NEXT collision rather
 * than the one it was written for, and nothing about that changes its logic. The
 * synthetic case below still names the pre-#179 file — that is a record of what
 * the tree was, not a reference to a file anyone can open.
 *
 * Built on the R0.4 / R0.13 shape, for the reason those two state:
 *
 *   - The name scan is a pure `(text) → names` function, proven on synthetic
 *     input in BOTH states. A planted duplicate makes it report a collision
 *     without a duplicate ever existing in the tree — the ratchet is shown to
 *     fail, not assumed to.
 *   - `KNOWN_COLLISIONS_OUTSIDE_ENGINES` DECLARES the regime the tree is in
 *     rather than pretending it is clean. #179 fixed the engine collision and
 *     #178 removed the file that held one side of it; a second one
 *     (`ValidationError`) exists elsewhere and was left alone on
 *     purpose, because widening a P1/S rename into `helpers/` and `types/` is
 *     how a small ticket becomes an unreviewable one. Declaring it means a
 *     THIRD collision fails this suite, and means fixing the declared one is a
 *     deliberate edit here rather than a silent pass.
 *
 * Boundaries, stated rather than discovered later: only `.ts` under `src/lib`,
 * only top-level `export type` / `export interface` declarations written on one
 * line. Re-exports (`export type { X } from …`) are not declarations and are
 * not counted. Two `export interface Foo` in the SAME file are legal
 * declaration merging, so collisions are counted across files only.
 */

import * as fs from "fs";
import * as path from "path";

const LIB_ROOT = path.resolve(__dirname, "..", "lib");

/**
 * The directories #179 is about. A collision between these two is the exact
 * defect the ticket names, so it is asserted to be empty with no allowance.
 */
const ENGINE_ROOTS = ["engine", "dashboard-engine"] as const;

/**
 * Collisions that exist elsewhere in `src/lib` today, deliberately not fixed by
 * #179. Read from the tree on 2026-09-02:
 *
 *   `ValidationError` — `lib/helpers/formulaParser.ts:794` carries `message`
 *   plus an optional `position` and is re-exported through
 *   `lib/formula/index.ts`; `lib/types/validation.ts:15` carries `field`,
 *   `message` and an optional `code`, and has no importer. Same collision
 *   class, different owner; filed as a note under #179 in `BACKLOG.md`.
 *
 * This list may only SHRINK. Removing a name here is how a fix is recorded.
 */
const KNOWN_COLLISIONS_OUTSIDE_ENGINES = ["ValidationError"] as const;

/**
 * Top-level exported type and interface NAMES declared in `text`, in source
 * order, deduplicated. Line-anchored: an `export type` nested inside a
 * `declare module` block is indented and is a different scope, and
 * `export type { X } from "…"` is a re-export, not a declaration — neither can
 * match, because `{` is not an identifier start.
 */
export function exportedTypeNames(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(
    /^export\s+(?:type|interface)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm
  )) {
    names.add(m[1] as string);
  }
  return [...names];
}

/** Name → the files declaring it, for every name declared in more than one file. */
export function collisions(
  files: ReadonlyArray<{ file: string; names: string[] }>
): Map<string, string[]> {
  const byName = new Map<string, string[]>();
  for (const { file, names } of files) {
    for (const name of names) {
      byName.set(name, [...(byName.get(name) ?? []), file]);
    }
  }
  return new Map([...byName].filter(([, where]) => where.length > 1));
}

/** Every `.ts` under `dir`, excluding test and mock trees, relative to `src/lib`. */
function collectModules(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
      collectModules(full, out);
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      out.push(path.relative(LIB_ROOT, full).replace(/\\/g, "/"));
    }
  }
  return out;
}

function scan(relativePaths: string[]): { file: string; names: string[] }[] {
  return relativePaths.map((file) => ({
    file,
    names: exportedTypeNames(
      fs.readFileSync(path.join(LIB_ROOT, file), "utf8")
    ),
  }));
}

describe("R0.14 — the scan itself (synthetic, proves the failing state)", () => {
  it("reads a declaration and ignores a re-export", () => {
    const text = [
      'export type TransformStepIR = { readonly kind: "filter" };',
      "export interface DataEngineRequest {",
      '  export type { Ignored } from "./elsewhere";',
      'export type { AlsoIgnored } from "./elsewhere";',
      "  export type NotTopLevel = string;",
    ].join("\n");
    expect(exportedTypeNames(text)).toEqual([
      "TransformStepIR",
      "DataEngineRequest",
    ]);
  });

  it("REPORTS a planted collision — the pre-#179 tree, reconstructed", () => {
    const before = [
      {
        file: "engine/contracts.ts",
        names: exportedTypeNames(
          'export type TransformStep =\n  | { readonly kind: "filter" };'
        ),
      },
      {
        file: "dashboard-engine/transformTypes.ts",
        names: exportedTypeNames(
          "export type TransformStep =\n  | UnnestStep;"
        ),
      },
    ];
    expect([...collisions(before).keys()]).toEqual(["TransformStep"]);
    expect(collisions(before).get("TransformStep")).toEqual([
      "engine/contracts.ts",
      "dashboard-engine/transformTypes.ts",
    ]);
  });

  it("counts declaration merging within one file as one declaration", () => {
    const merged = [
      {
        file: "a.ts",
        names: exportedTypeNames(
          "export interface Foo { a: 1 }\nexport interface Foo { b: 2 }"
        ),
      },
    ];
    expect(collisions(merged).size).toBe(0);
  });
});

describe("R0.14 — the tree", () => {
  it("declares no exported type name twice across engine/ and dashboard-engine/", () => {
    const modules = ENGINE_ROOTS.flatMap((root) =>
      collectModules(path.join(LIB_ROOT, root))
    );
    expect(modules.length).toBeGreaterThan(0);
    const found = collisions(scan(modules));
    expect(
      [...found].map(([name, where]) => `${name}: ${where.join(", ")}`)
    ).toEqual([]);
  });

  it("holds exactly the collisions declared for the rest of src/lib, and no more", () => {
    const found = [...collisions(scan(collectModules(LIB_ROOT))).keys()].sort();
    expect(found).toEqual([...KNOWN_COLLISIONS_OUTSIDE_ENGINES].sort());
  });
});
