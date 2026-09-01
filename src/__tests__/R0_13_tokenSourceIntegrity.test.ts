/**
 * R0.13 — token source integrity (#165, ADR_TOKENS_MATRYOSHKA_2026-09-01).
 *
 * `src/lib/tokens/design-tokens.css` declared the matryoshka principle and was
 * imported by nobody. The principle therefore drifted out of the product with
 * every gate green: R0.3 guarded the letter (no raw px) and could not see that
 * the file stating the rule had no consumer.
 *
 * This ratchet is built on the R0.4 shape, because R0.4 is this repo's own
 * lesson about ratchets that pass by matching nothing:
 *
 *   - `LIVE_TOKEN_SOURCES` DECLARES which token stylesheets are expected. The
 *     tree is asserted to hold exactly those and no others, so a fifth source
 *     cannot appear unnoticed and a declared one cannot quietly vanish.
 *   - The import scan is a pure `(text) → specifiers` function, exercised on
 *     synthetic input in both states. That is how it is proven to FAIL on the
 *     broken tree without breaking the tree, exactly as `R0_4:145-153` proves
 *     containment while no archive exists.
 *   - The self-query rule is likewise a pure function over CSS text. An element
 *     that declares `container-type` is NOT its own query container: `cqi` in
 *     its own rules resolves against its ANCESTOR. That trap is invisible in
 *     review, silent at build time, and only shows up as a wrong size on screen.
 */

import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.resolve(__dirname, "..");
const ENTRY_POINT = path.join(SRC_ROOT, "main.ts");

/**
 * Every token stylesheet that is expected to exist under `src/`, relative to
 * `src/` and slash-separated. #165 collapses this to a single entry; until
 * step 2 merges it, the Dashboard layer is still its own file and is declared.
 */
const LIVE_TOKEN_SOURCES = [
  "ui/tokens/tokens.css",
  "ui/views/Dashboard/tokens/dashboardTokens.css",
] as const;

/** Module-specifier sites, borrowed verbatim from `R0_4:53-54`. */
const SPECIFIER_SITE =
  /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|\bjest\s*\.\s*mock\s*\(\s*|\bimport\s+)(["'])([^"']+)\1/g;

const content = (file: string) => fs.readFileSync(file, "utf8");

/** Every module specifier in `content`, in source order. */
function moduleSpecifiers(content: string): string[] {
  const found: string[] = [];
  for (const match of content.matchAll(SPECIFIER_SITE)) {
    const specifier = match[2];
    if (specifier !== undefined) found.push(specifier);
  }
  return found;
}

/** Whether `content` imports the module whose path ends with `suffix`. */
function importsTokenSource(content: string, suffix: string): boolean {
  return moduleSpecifiers(content).some((s) => s.replace(/\\/g, "/").endsWith(suffix));
}

/** Every `.css` file under `src/`, excluding test fixtures, relative to `src/`. */
function collectStylesheets(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
      collectStylesheets(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith(".css")) {
      out.push(path.relative(SRC_ROOT, path.join(dir, entry.name)).replace(/\\/g, "/"));
    }
  }
  return out;
}

/** A length in container-query units. `inline-size` is a keyword, not a unit. */
const CQ_UNIT = /\b\d*\.?\d+cq(?:i|b|w|h|min|max)\b/;

/** `selector { body }` pairs. Good enough for component style blocks; no nesting in this tree. */
const RULE_BLOCK = /([^{}]+)\{([^{}]*)\}/g;

/**
 * Selectors that both declare `container-type` and size themselves in `cq`
 * units — the self-query trap. Reported as the offending selector text.
 */
function selfQueryOffenders(css: string): string[] {
  const containerSelectors = new Set<string>();
  const bodies = new Map<string, string[]>();
  for (const match of css.matchAll(RULE_BLOCK)) {
    const selector = (match[1] ?? "").trim();
    const body = match[2] ?? "";
    if (selector === "" || selector.startsWith("@")) continue;
    if (/\bcontainer-type\s*:/.test(body) || /\bcontainer\s*:/.test(body)) {
      containerSelectors.add(selector);
    }
    const seen = bodies.get(selector) ?? [];
    seen.push(body);
    bodies.set(selector, seen);
  }
  const offenders: string[] = [];
  for (const selector of containerSelectors) {
    for (const body of bodies.get(selector) ?? []) {
      if (CQ_UNIT.test(body)) offenders.push(selector);
    }
  }
  return offenders;
}

/** Every `<style>` block's contents, concatenated. */
function svelteStyles(content: string): string {
  return [...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? "").join("\n");
}

function collectStyled(dir: string, out: { file: string; css: string }[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
      collectStyled(full, out);
    } else if (entry.name.endsWith(".svelte")) {
      out.push({ file: path.relative(SRC_ROOT, full).replace(/\\/g, "/"), css: svelteStyles(content(full)) });
    } else if (entry.name.endsWith(".css")) {
      out.push({ file: path.relative(SRC_ROOT, full).replace(/\\/g, "/"), css: content(full) });
    }
  }
  return out;
}

describe("R0.13 token source integrity (#165)", () => {
  it("the declared token sources are exactly the stylesheets in the tree", () => {
    // The assertion that makes a fifth token source impossible to add quietly,
    // and a deleted one impossible to forget about.
    expect(collectStylesheets(SRC_ROOT).sort()).toEqual([...LIVE_TOKEN_SOURCES].sort());
  });

  it("every declared token source is imported by the entry point", () => {
    // The assertion #165 exists for: a token file with no importer is a
    // document, not a stylesheet.
    const main = content(ENTRY_POINT);
    for (const source of LIVE_TOKEN_SOURCES) {
      expect(importsTokenSource(main, source)).toBe(true);
    }
  });

  it("notices an import that is present and one that is not", () => {
    // Proves the scan fails on the broken state without breaking the tree.
    const present = 'import "./ui/tokens/tokens.css";\nimport dayjs from "dayjs";';
    const removed = 'import dayjs from "dayjs";';
    expect(importsTokenSource(present, "ui/tokens/tokens.css")).toBe(true);
    expect(importsTokenSource(removed, "ui/tokens/tokens.css")).toBe(false);
    expect(moduleSpecifiers(present)).toEqual(["./ui/tokens/tokens.css", "dayjs"]);
  });

  it("does not mistake a quoted path for an import", () => {
    expect(moduleSpecifiers('const doc = "ui/tokens/tokens.css";')).toEqual([]);
  });

  it("reads the entry point it claims to read", () => {
    // Without this a wrong path would make the import scan vacuous — the exact
    // failure mode R0.4 records at `R0_4:162-168`.
    const main = content(ENTRY_POINT);
    expect(main.length).toBeGreaterThan(1000);
    expect(moduleSpecifiers(main)).toContain("obsidian");
  });

  it("detects a container element that sizes itself in container units", () => {
    // Synthetic proof, because the tree is expected to have zero offenders and
    // an all-clear scan is indistinguishable from a broken one.
    const trap = ".widget { container-type: inline-size; padding: 2cqi; }";
    const safe = ".widget { container-type: inline-size; } .widget > .row { padding: 2cqi; }";
    expect(selfQueryOffenders(trap)).toEqual([".widget"]);
    expect(selfQueryOffenders(safe)).toEqual([]);
    // Split across rules for the same selector — still the same element.
    expect(selfQueryOffenders(".w { container-type: inline-size; } .w { gap: 1cqi; }")).toEqual([".w"]);
  });

  it("no element in the tree sizes itself in its own container units", () => {
    const offenders = collectStyled(SRC_ROOT)
      .flatMap(({ file, css }) => selfQueryOffenders(css).map((s) => `${file} → ${s}`));
    expect(offenders).toEqual([]);
  });
});
