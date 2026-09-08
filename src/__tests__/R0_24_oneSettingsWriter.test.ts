import * as fs from "fs";
import * as path from "path";

/**
 * R0.24 — one writer of `data.json`, and a shape that cannot grow back (#212).
 *
 * #185 made the writer single. #200 built reconciliation on top of it, #211
 * spent thirteen cross-model passes on the coordination between the two, and
 * six of those twenty-two findings were introduced by the fix for the pass
 * before — every one of them in the same place: permission to write, simulated
 * by booleans, released from eight call sites in a file with no unit coverage.
 *
 * #212 replaced that with a lease whose release is a `finally`. This ratchet
 * pins the two properties that make the replacement worth having, because both
 * are the kind a later change can undo without noticing:
 *
 *   - **Nothing else writes the settings file.** A second writer would not need
 *     the lease and would not be bound by it.
 *   - **The methods the lease replaced do not come back.** `hold`/`resume` were
 *     paired calls a branch could forget; `settled` invited "await, then fence"
 *     instead of "fence, then await"; `pushImmediate` was a licence to bypass
 *     the permit. Each has a finding to its name.
 *
 * Like R0.22 and R0.23 this reads source text rather than data flow, and says so
 * rather than implying more: a call assembled at runtime passes it. The defect
 * it prevents is the one that actually happened — a new path writing settings,
 * or a paired-call API reappearing because nothing said otherwise.
 */

const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(ROOT, "src");

/** Files allowed to write to the vault adapter, and what each one writes. */
const ADAPTER_WRITERS: Readonly<Record<string, string>> = {
  "src/lib/settings/brokenBackup.ts":
    "the forensic copy of unreadable settings, and the conflict copy/note — never data.json itself",
  "src/lib/settingsBackup.ts":
    "#145 restore point for the dashboard migrations — a sibling file, never data.json",
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Product source: no tests, no mocks — they plant violations on purpose. */
function productFiles(): string[] {
  return walk(SRC).filter(
    (file) =>
      /\.(ts|svelte)$/.test(file) &&
      !/__tests__|__mocks__|\.test\.|\.spec\./.test(file)
  );
}

function rel(file: string): string {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

/**
 * Comments removed before scanning. The header of `settingsWriter.ts` explains
 * what `saveData` used to do wrong, in prose, and a ratchet that counted that
 * sentence would be reporting on its own documentation.
 */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function sitesOf(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const file of productFiles()) {
    const matches = code(fs.readFileSync(file, "utf8")).match(pattern);
    if (matches) found.push(...matches.map(() => rel(file)));
  }
  return found;
}

describe("R0.24 — one writer of the settings file", () => {
  it("`saveData` is called from exactly one place", () => {
    // The host's own persistence. Handed to the writer, never called beside it:
    // a second call site is a second writer, whatever it is named.
    expect(sitesOf(/\bsaveData\(/g)).toEqual(["src/main.ts"]);
  });

  it("the writer is constructed exactly once", () => {
    // The factory's own declaration is not a construction; everything else is.
    const constructed = sitesOf(/createSettingsWriter[<(]/g).filter(
      (file) => file !== "src/lib/settings/settingsWriter.ts"
    );

    expect(constructed).toEqual(["src/main.ts"]);
  });

  it("only the recovery modules touch the vault adapter for writing", () => {
    const offenders = sitesOf(/adapter\.write\(/g).filter(
      (file) => ADAPTER_WRITERS[file] === undefined
    );

    expect(offenders).toEqual([]);
  });

  it("the file that owns the settings path does not write through the adapter", () => {
    // `main.ts` builds the `data.json` path for reading it back (#199) and for
    // naming it in a recovery note. It must reach the file for writing only
    // through the writer.
    const text = fs.readFileSync(path.join(SRC, "main.ts"), "utf8");

    expect(text).not.toMatch(/adapter\.write\(/);
  });
});

describe("R0.24 — the shape the lease replaced does not grow back", () => {
  const RETIRED = ["hold", "resume", "settled", "pushImmediate"] as const;

  function writerInterface(): string {
    const text = fs.readFileSync(
      path.join(SRC, "lib/settings/settingsWriter.ts"),
      "utf8"
    );
    const start = text.indexOf("export interface SettingsWriter<T> {");
    expect(start).toBeGreaterThan(-1);
    const end = text.indexOf("\n}", start);
    return text.slice(start, end);
  }

  it("no retired method is declared on the writer", () => {
    const declared = writerInterface();
    const back = RETIRED.filter((name) =>
      new RegExp(`^\\s*${name}\\s*\\(`, "m").test(declared)
    );

    expect(back).toEqual([]);
  });

  it("the lease is what replaced them, and it is still there", () => {
    expect(writerInterface()).toMatch(/^\s*withExclusive\(/m);
  });

  it("the detector sees a retired method when one is planted", () => {
    // Both states demonstrated on synthetic input, per the house rule: an
    // assertion that only ever passes proves nothing about what it forbids.
    const planted =
      "export interface SettingsWriter<T> {\n  resume(): void;\n}";
    const back = RETIRED.filter((name) =>
      new RegExp(`^\\s*${name}\\s*\\(`, "m").test(planted)
    );

    expect(back).toEqual(["resume"]);
  });
});

describe("R0.24 — the decision modules stay light", () => {
  it("nothing under src/lib/settings imports obsidian or i18n", () => {
    // The property that lets these modules be tested at all: `main.ts` cannot
    // be, and the decisions were moved here precisely so they could be. An
    // `obsidian` import would put them back on the wrong side of that line, and
    // an i18n import would drag four locale files into their runs.
    const offenders: string[] = [];
    for (const file of productFiles()) {
      if (!rel(file).startsWith("src/lib/settings/")) continue;
      const text = fs.readFileSync(file, "utf8");
      if (/from\s+["']obsidian["']/.test(text))
        offenders.push(`${rel(file)} — obsidian`);
      if (/from\s+["'][^"']*(?:i18n|errorText)["']/.test(text)) {
        offenders.push(`${rel(file)} — i18n`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
