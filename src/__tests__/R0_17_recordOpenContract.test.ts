/**
 * R0.17 — the record-open contract (#168 step (a),
 * ADR_RECORD_OPEN_CONTRACT_2026-09-02 §4).
 *
 * Opening a RECORD of the current view goes through `lib/record/openRecord.ts`.
 * Navigating to an arbitrary note does not: those sites take a link out of
 * rendered Markdown or a parsed wikilink, their target may not be a record at
 * all, and they are declared below rather than left to be recognised by eye.
 *
 * Why a ratchet and not a convention: what a plain activation means is ONE
 * constant in the contract, and it has now been changed twice — to the peek by
 * #168 step (b), back to the note by #189. A site that calls
 * `workspace.openLinkText` directly would silently keep whichever behaviour it
 * was written with, so the change would be partial, and partial is worse than
 * either state because nothing on screen says which rule a given row follows.
 *
 * ## What #189 added, and why it belongs in a ratchet rather than a test
 *
 * The peek stopped being the default and kept two entrances: the `alt` branch
 * of `modeFromEvent`, and a labelled row-menu entry. Losing either one is
 * INVISIBLE — a plain click still opens the note, so the surface looks correct
 * while the feature has quietly become unreachable and `recordPeek` becomes a
 * live store nothing can fill. That is the same silent-drift shape the direct
 * call above has, so it is guarded the same way.
 *
 * ## Where this ratchet is BLIND — stated up front, not discovered later
 *
 *   - It matches the literal receiver `workspace.openLinkText`. A site that
 *     writes `const w = app.workspace; w.openLinkText(...)` is invisible to it,
 *     as is any call reached through a variable holding the function.
 *   - It cannot tell a record from an arbitrary note. The A/B split is a
 *     judgement made once, recorded here, and re-checked by a human reading
 *     `CX-MAP-168.md` — a trace that already corrected the first reading, which
 *     had six record sites filed as wikilinks because they reach the workspace
 *     through a component whose inputs are fixed at the call site.
 *
 * Built on the R0.13 / R0.15 shape: a pure `(text) → hits` function proven on
 * synthetic input in BOTH states, then run over the tree.
 */

import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(__dirname, "..");

/** The contract itself — the one module that may call the workspace directly. */
const CONTRACT = "lib/record/openRecord.ts";

/**
 * Sites that navigate to an arbitrary note, declared with what each one is.
 *
 * Every entry takes its link from rendered Markdown or a parsed wikilink, so
 * the target is whatever the author typed and may be no record of any project.
 * Two more entries stood here until #183 deleted the legacy Table tree they
 * lived in — the list is shorter because the surface is gone, not because the
 * rule relaxed.
 */
const WIKILINK_SITES: ReadonlyArray<readonly [string, string]> = [
  ["ui/components/CardMetadata/Text.svelte", "an anchor inside rendered Markdown"],
  ["ui/components/TagList/RichTextTag.svelte", "an anchor inside a rendered tag"],
  ["ui/views/Board/components/Board/ColumnHeader.svelte", "an anchor inside a rendered column title"],
  ["ui/views/YamlVisualizer/RelationListView.svelte", "a relation link as written in frontmatter"],
];

const CALL = /workspace\s*\.\s*openLinkText\s*\(/;

/** Lines of `text` that call the workspace directly. */
export function directOpenCalls(text: string): number[] {
  return text
    .split(/\r?\n/)
    .map((line, i) => (CALL.test(line) ? i + 1 : 0))
    .filter((n) => n > 0);
}

/** Every `.ts` / `.svelte` under `dir`, excluding test and mock trees. */
function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
      collectFiles(full, out);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".svelte")) {
      out.push(full);
    }
  }
  return out;
}

const rel = (file: string) => path.relative(SRC, file).replace(/\\/g, "/");

describe("R0.17 — the scan itself (synthetic, proves BOTH states)", () => {
  it("REPORTS a direct call", () => {
    expect(directOpenCalls("  $app.workspace.openLinkText(id, id, false);")).toEqual([1]);
  });

  it("sees the spellings a reviewer would miss", () => {
    const text = [
      "app?.workspace.openLinkText(a, b, true);",
      "app_instance.workspace .openLinkText(a, b, 'tab');",
      "void get(app).workspace.openLinkText(a, b, 'window');",
    ].join("\n");
    expect(directOpenCalls(text)).toEqual([1, 2, 3]);
  });

  it("reads a call and not a name — prose naming the method is not one", () => {
    // The `(` is what separates the two, which is why the header calls this a
    // scan for CALLS. A comment that names the method, as several migrated
    // files now do to explain themselves, must not consume an exemption.
    const text = [
      "// openRecord replaces workspace.openLinkText at every record site",
      "void openRecord({ id }, PLAIN_MODE, { app });",
    ].join("\n");
    expect(directOpenCalls(text)).toEqual([]);
  });

  it("still flags a call written inside a commented-out line", () => {
    // A text scan cannot tell live code from a commented-out call, and that is
    // the safe direction: it reports, a human deletes. Stated so the next
    // reader does not mistake the report for a false positive in the tree.
    expect(directOpenCalls("// $app.workspace.openLinkText(id, id, false);")).toEqual([1]);
  });
});

describe("R0.17 — the tree", () => {
  const files = collectFiles(SRC);

  it("scans a non-trivial number of files", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("opens records through the contract, and nowhere else", () => {
    const allowed = new Set([CONTRACT, ...WIKILINK_SITES.map(([f]) => f)]);
    const offenders = files
      .filter((f) => !allowed.has(rel(f)))
      .flatMap((f) =>
        directOpenCalls(fs.readFileSync(f, "utf8")).map((line) => `${rel(f)}:${line}`)
      );
    expect(offenders).toEqual([]);
  });

  it("every declared wikilink site still exists and still calls the workspace", () => {
    // A declared exemption that has drifted is worse than none: it silently
    // widens the allowlist. If one of these is deleted or migrated, this fails
    // and the list must be edited deliberately — the shape R0.4 and R0.13 use.
    for (const [file, what] of WIKILINK_SITES) {
      const full = path.join(SRC, file);
      expect({ file, exists: fs.existsSync(full) }).toEqual({ file, exists: true });
      expect({ file, what, calls: directOpenCalls(fs.readFileSync(full, "utf8")).length > 0 })
        .toEqual({ file, what, calls: true });
    }
  });

  it("the contract module actually calls the workspace", () => {
    // Otherwise this whole ratchet could pass over a tree where nothing opens
    // anything at all — the failure R0.4 records.
    const text = fs.readFileSync(path.join(SRC, CONTRACT), "utf8");
    expect(directOpenCalls(text).length).toBeGreaterThan(0);
  });
});

/**
 * Sites that must be able to REACH the peek, declared with what each one is.
 *
 * Two, deliberately: one fast and one discoverable. The declaration is the
 * point — if a refactor deletes an entrance, this list has to be edited on
 * purpose, the way `WIKILINK_SITES` above works.
 */
/**
 * #189 + the decision of 2026-09-05: the peek belongs to the DASHBOARD TABLE.
 *
 * Both entrances below sit on that one surface. Gallery, Board, Calendar and
 * the note editor open the note and offer no peek — they do not forward the raw
 * event, so `alt` does nothing there, and they have no row menu to carry the
 * entry. The adversarial review was right that naming that asymmetry is not
 * deciding it; the user decided, and this is where the decision is executable.
 */
const PEEK_ENTRANCES: ReadonlyArray<readonly [string, string, RegExp]> = [
  [CONTRACT, "the alt modifier, for someone who knows", /if \(e\.altKey\) return "peek";/],
  [
    "ui/views/Dashboard/widgets/DatabaseCall/tableRowOps.ts",
    "the labelled row-menu entry, for someone who does not",
    /openRecord\(\{ id: record\.id, record, fields \}, "peek"/,
  ],
];

describe("R0.17 — #189: the peek is the dashboard table's, by decision", () => {
  it("has exactly two entrances, and both are on that one surface", () => {
    // Spreading the peek to Gallery, Board or Calendar is a separate ticket
    // with its own architect pass — each has a different activation model. A
    // third entry appearing here without one would mean it was spread quietly.
    expect(PEEK_ENTRANCES).toHaveLength(2);
    const surfaces = PEEK_ENTRANCES.map(([file]) => file);
    expect(surfaces).toContain("ui/views/Dashboard/widgets/DatabaseCall/tableRowOps.ts");
    for (const file of surfaces) {
      expect({ file, elsewhere: /Gallery|Board|Calendar/.test(file) }).toEqual({ file, elsewhere: false });
    }
  });
});

describe("R0.17 — #189: the peek lost the default and kept both entrances", () => {
  const contract = () => fs.readFileSync(path.join(SRC, CONTRACT), "utf8");

  it("a plain activation opens the note", () => {
    // The behaviour the user asked for, read off the source rather than
    // imported, so this ratchet keeps working if the constant is ever inlined.
    expect(contract()).toMatch(/export const PLAIN_MODE: RecordOpenMode = "same";/);
  });

  it("the two modifiers that three shipped surfaces agree on are unchanged", () => {
    // #189 was allowed to spend a FREE modifier and nothing else. Pinned so a
    // later "tidy-up" of `modeFromEvent` cannot quietly re-map shift or ctrl.
    const s = contract();
    expect(s).toMatch(/if \(e\.shiftKey\) return "window";/);
    expect(s).toMatch(/if \(e\.ctrlKey \|\| e\.metaKey\) return "tab";/);
  });

  it("alt is tested after ctrl, so AltGr keyboards keep 'open in a tab'", () => {
    // Order, not presence — AltGr reports ctrlKey and altKey together. Reading
    // the order off the file is the only way a text ratchet can see it.
    const s = contract();
    expect(s.indexOf('if (e.ctrlKey || e.metaKey) return "tab";'))
      .toBeLessThan(s.indexOf('if (e.altKey) return "peek";'));
  });

  it.each(PEEK_ENTRANCES)("%s still offers the peek — %s", (file, _what, pattern) => {
    expect(fs.readFileSync(path.join(SRC, file), "utf8")).toMatch(pattern);
  });
});
