import * as fs from "fs";
import * as path from "path";

import {
  ERROR_AREAS,
  ERROR_CODES,
  type ErrorCodeEntry,
} from "src/lib/errors/errorCodes";

/**
 * R0.21 — the error-code registry and its page cannot drift apart (#202).
 *
 * The lesson `R_filterOrder.invariant.test.ts` learned the hard way is carried
 * here on purpose: **a test that forbids a document from becoming true is worse
 * than no test.** So this asserts structure and bijection and never prose. Any
 * section may be rewritten, translated or expanded freely; what it may not do
 * is describe a code that does not exist, or go missing for one that does.
 *
 * It is armed BEFORE the first code is issued, with an empty registry, so that
 * both of its states are demonstrated on synthetic input rather than believed
 * along with the first real use.
 */

const ROOT = path.join(__dirname, "..", "..");
const PAGE = path.join(ROOT, "docs", "ERROR_CODES.md");
const LOCALES = ["en", "ru", "uk", "zh-CN"];

const CODE_SHAPE = /^PPP-[1-9]\d\d$/;
/** A heading, never inside the HTML comment that documents the section form. */
const HEADING = /^## (PPP-\d{3})\s*$/gm;

function pageText(): string {
  return fs.readFileSync(PAGE, "utf8");
}

/** Headings outside HTML comments — the comment carries a worked example. */
function pageCodes(text: string): string[] {
  const withoutComments = text.replace(/<!--[\s\S]*?-->/g, "");
  return [...withoutComments.matchAll(HEADING)].map((m) => m[1] as string);
}

function sectionOf(text: string, code: string): string {
  const body = text.replace(/<!--[\s\S]*?-->/g, "");
  const start = body.indexOf(`## ${code}`);
  if (start === -1) return "";
  const next = body.indexOf("\n## ", start + 1);
  return next === -1 ? body.slice(start) : body.slice(start, next);
}

function readLocale(name: string): { raw: string; json: unknown } {
  const raw = fs.readFileSync(
    path.join(ROOT, "src", "lib", "stores", "translations", `${name}.json`),
    "utf8"
  );
  // The BOM is real and load-bearing: these files ship with it, and a tool that
  // rewrites them without it changes four large files for no reason and buries
  // the actual diff. Strip for parsing, never for writing.
  return { raw, json: JSON.parse(raw.replace(/^\uFEFF/, "")) };
}

function lookup(json: unknown, key: string): unknown {
  let node: unknown = (json as { translation?: unknown }).translation ?? json;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
    if (node === undefined) return undefined;
  }
  return node;
}

/** The codes an area is missing to run `01..n` without a hole. */
function gaps(codes: readonly string[]): string[] {
  const byArea = new Map<string, Set<number>>();
  for (const code of codes) {
    const area = code.slice(4, 5);
    const set = byArea.get(area) ?? new Set<number>();
    set.add(Number(code.slice(5)));
    byArea.set(area, set);
  }
  const missing: string[] = [];
  for (const [area, ordinals] of byArea) {
    const highest = Math.max(...ordinals);
    for (let n = 1; n <= highest; n++) {
      if (!ordinals.has(n)) {
        missing.push(`PPP-${area}${String(n).padStart(2, "0")}`);
      }
    }
  }
  return missing.sort();
}

function resolves(json: unknown, key: string): boolean {
  const value = lookup(json, key);
  return typeof value === "string" && value.length > 0;
}

describe("R0.21 — the registry and the page stay in step", () => {
  it("every code is unique and shaped like a code", () => {
    const seen = new Set<string>();
    for (const entry of ERROR_CODES) {
      expect(entry.code).toMatch(CODE_SHAPE);
      expect(seen.has(entry.code)).toBe(false);
      seen.add(entry.code);
    }
  });

  it("every code sits in a declared area", () => {
    for (const entry of ERROR_CODES) {
      const area = entry.code.slice(4, 5);
      expect(Object.keys(ERROR_AREAS)).toContain(area);
    }
  });

  it("every registry code has exactly one section on the page", () => {
    const codes = pageCodes(pageText());
    for (const entry of ERROR_CODES) {
      expect(codes.filter((c) => c === entry.code)).toHaveLength(1);
    }
  });

  it("every section on the page belongs to a code in the registry", () => {
    // This half is what reserves a retired number: the entry and its section
    // both stay, so the code can never be reissued under a new meaning.
    const known = new Set(ERROR_CODES.map((entry) => entry.code));
    for (const code of pageCodes(pageText())) {
      expect(known.has(code)).toBe(true);
    }
  });

  it("each section carries the three required parts, whatever they say", () => {
    const text = pageText();
    for (const entry of ERROR_CODES) {
      const section = sectionOf(text, entry.code);
      expect(section.length).toBeGreaterThan(0);
      // Structure only. The words are the author's business.
      expect(section).toMatch(/###\s+\S/);
      expect(section.split(/###\s+/).length - 1).toBeGreaterThanOrEqual(3);
    }
  });

  it("no code ships relying on an English defaultValue", () => {
    const { json } = readLocale("en");
    for (const entry of ERROR_CODES) {
      expect(resolves(json, entry.key)).toBe(true);
      expect(resolves(json, entry.causeKey)).toBe(true);
    }
  });

  it("every code written into src/ is a code the registry issued", () => {
    // Call sites name a code as a literal so the number a user quotes can be
    // grepped straight to the line that raised it. That only holds if a typo
    // fails a gate instead of reaching a screen — `resolveError` degrades to
    // printing the bare code, which is exactly what this stops shipping.
    const known = new Set(ERROR_CODES.map((entry) => entry.code));
    const unknown = new Set<string>();
    for (const file of walk(path.join(ROOT, "src"))) {
      if (!/\.(ts|svelte)$/.test(file)) continue;
      // Test files plant deliberately invalid codes; that is their job.
      if (/__tests__|\.test\.|\.spec\./.test(file)) continue;
      for (const [code] of fs
        .readFileSync(file, "utf8")
        .matchAll(/PPP-\d{3}/g)) {
        if (!known.has(code)) unknown.add(`${code} in ${path.basename(file)}`);
      }
    }
    expect([...unknown]).toEqual([]);
  });

  it("the modules that must stay light do not import the resolver", () => {
    // The weight edge from the plan: settings and engine modules are unit
    // tested in isolation, and naming a code must not drag four locale files
    // and i18next into those runs. Same hazard `headerChrome.ts` exists for.
    for (const dir of ["settings", "engine"]) {
      const base = path.join(ROOT, "src", "lib", dir);
      if (!fs.existsSync(base)) continue;
      for (const file of walk(base)) {
        if (!/\.(ts|svelte)$/.test(file)) continue;
        const text = fs.readFileSync(file, "utf8");
        expect(text).not.toMatch(/from\s+["'][^"']*errors\/errorText["']/);
      }
    }
  });

  it("the locale files still carry their BOM", () => {
    for (const name of LOCALES) {
      expect(readLocale(name).raw.startsWith("\uFEFF")).toBe(true);
    }
  });

  it("the registry is populated", () => {
    // Step 1 shipped this list empty so the ratchet could be proven on
    // synthetic input. Every assertion above is vacuous on an empty list, so
    // this is the one that says the codes were actually issued.
    expect(ERROR_CODES.length).toBeGreaterThan(0);
  });

  it("numbers run densely from 01 in every area that has any", () => {
    // A gap is a number nobody can look up, and the numbering is assigned by
    // hand precisely because codes are permanent. Retiring a code keeps its
    // entry, so retirement never opens a gap either.
    expect(gaps(ERROR_CODES.map((entry) => entry.code))).toEqual([]);
  });

  it("every caption is the English default for its key, verbatim", () => {
    // `errorLog.ts` prints `caption` and a Notice resolves `key`. Where the
    // Notice does resolve its key — which is all but the two settings-load
    // messages, whose pre-registry literals #202 leaves alone — this equality
    // is what makes the console line and the message on screen the same
    // sentence. Where it does not, the caption is still the one English text
    // the code is filed under, so it may not quietly become something nicer.
    const { json } = readLocale("en");
    for (const entry of ERROR_CODES) {
      expect({ code: entry.code, caption: entry.caption }).toEqual({
        code: entry.code,
        caption: lookup(json, entry.key),
      });
    }
  });

  describe("the ratchet itself fails on a planted mismatch", () => {
    const planted: ErrorCodeEntry = {
      code: "PPP-999",
      kind: "failure",
      key: "errors.planted",
      causeKey: "errors.planted-cause",
      caption: "Planted",
      cause: "Planted cause",
    };

    it("a code with no section on the page is caught", () => {
      const codes = pageCodes(pageText());
      expect(codes).not.toContain(planted.code);
    });

    it("a section with no code in the registry is caught", () => {
      const text = `${pageText()}\n\n## PPP-998\n\n### A\n\n### B\n\n### C\n`;
      const known = new Set(ERROR_CODES.map((entry) => entry.code));
      const orphans = pageCodes(text).filter((code) => !known.has(code));
      expect(orphans).toEqual(["PPP-998"]);
    });

    it("a malformed code is caught", () => {
      for (const bad of ["PPP-04", "ppp-104", "PPP-1040", "104"]) {
        expect(bad).not.toMatch(CODE_SHAPE);
      }
    });

    it("a hole in the numbering is caught", () => {
      // The live check above is vacuous on an empty registry and silent on a
      // correct one, so the detector is shown working on input that has a hole.
      expect(gaps(["PPP-101", "PPP-102", "PPP-104"])).toEqual(["PPP-103"]);
      expect(gaps(["PPP-102"])).toEqual(["PPP-101"]);
      expect(gaps(["PPP-101", "PPP-102", "PPP-201"])).toEqual([]);
    });
  });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
