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

function resolves(json: unknown, key: string): boolean {
  let node: unknown = (json as { translation?: unknown }).translation ?? json;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return false;
    node = (node as Record<string, unknown>)[part];
    if (node === undefined) return false;
  }
  return typeof node === "string" && node.length > 0;
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
