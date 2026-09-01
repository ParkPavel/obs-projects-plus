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
 * `src/` and slash-separated. #165 collapsed four sources into this one. Adding
 * an entry here is allowed — it just has to be deliberate, and it has to be
 * imported by the entry point on the same commit.
 */
const LIVE_TOKEN_SOURCES = ["ui/tokens/tokens.css"] as const;

/**
 * The `--ppp-db-*` layer that `Dashboard/tokens/dashboardTokens.css` carried
 * before #165 merged it. This map IS the contract: `--ppp-db-z-dropdown`
 * going missing means floating pickers render under sticky headers, which no
 * gate can see and no type can catch. `--ppp-db-row-hover` is in the older
 * palette section of tokens.css at the same value, so the merge dropped the
 * duplicate rather than the key.
 *
 * **Values, not just names** (Codex audit of #165, 2026-09-01). A key-presence
 * check passes while a key carries the wrong value, and a wrong value is
 * exactly what a merge gets wrong — the names are copied mechanically, the
 * values by hand. Every value below was read from the deleted file at its last
 * commit on `main` (`git show main:src/ui/views/Dashboard/tokens/dashboardTokens.css`),
 * not from the merged file, so this asserts the merge rather than describing it.
 */
const MERGED_DASHBOARD_TOKENS: ReadonlyArray<readonly [string, string]> = [
  ["--ppp-db-z-raised", "var(--ppp-z-raised, 1)"],
  ["--ppp-db-z-bar", "2"],
  ["--ppp-db-z-sticky", "var(--ppp-z-sticky, 20)"],
  ["--ppp-db-z-dropdown", "100"],
  ["--ppp-db-z-overlay", "200"],
  ["--ppp-db-row-compact", "1.75rem"],
  ["--ppp-db-row-default", "2.25rem"],
  ["--ppp-db-row-expanded", "3rem"],
  ["--ppp-db-toolbar-height", "2rem"],
  ["--ppp-db-col-width-default", "10rem"],
  ["--ppp-db-col-width-min", "4rem"],
  ["--ppp-dt-columns", "auto"],
  ["--ppp-db-surface", "var(--background-primary)"],
  ["--ppp-db-surface-raised", "var(--background-secondary)"],
  ["--ppp-db-border", "var(--background-modifier-border)"],
  ["--ppp-db-border-strong", "var(--background-modifier-border-hover)"],
  ["--ppp-db-text-primary", "var(--text-normal)"],
  ["--ppp-db-text-secondary", "var(--text-muted)"],
  ["--ppp-db-text-faint", "var(--text-faint)"],
  ["--ppp-db-row-hover", "var(--background-modifier-hover)"],
];

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

/**
 * `--ppp-*` custom properties DECLARED in `css`, name → value. Line-anchored,
 * which is safe for the token stylesheet: every declaration there sits on its
 * own line, and a `var(--ppp-x, 1)` READ inside a value never starts one.
 */
function declaredTokens(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/^[ \t]*(--ppp-[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/gm)) {
    out.set(m[1] as string, (m[2] as string).trim());
  }
  return out;
}

/**
 * `--ppp-*` names declared anywhere in `text`, including inside a generated
 * string — a declaration is `name:`, a read is `var(name`. The lookbehind is
 * what separates the two, and it is why this is a pure function with a
 * synthetic proof rather than a grep.
 */
function declaredTokenNames(text: string): string[] {
  return [...text.matchAll(/(?<!var\(\s*)(--ppp-[a-zA-Z0-9_-]+)\s*:/g)].map((m) => m[1] as string);
}

/** Every `.ts` / `.svelte` module under `src/`, excluding tests, as `[path, text]`. */
function collectModules(dir: string, out: { file: string; text: string }[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
      collectModules(full, out);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".svelte")) {
      out.push({ file: path.relative(SRC_ROOT, full).replace(/\\/g, "/"), text: content(full) });
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

  it("every merged Dashboard key survived the merge at its own value", () => {
    const css = content(path.join(SRC_ROOT, "ui", "tokens", "tokens.css"));
    const declared = declaredTokens(css);
    const wrong = MERGED_DASHBOARD_TOKENS
      .filter(([key, value]) => declared.get(key) !== value)
      .map(([key, value]) => `${key}: expected ${value}, found ${declared.get(key) ?? "nothing"}`);
    expect(wrong).toEqual([]);
  });

  it("declares both levels of the scale", () => {
    const tokens = content(path.join(SRC_ROOT, "ui", "tokens", "tokens.css"));
    expect(tokens).toMatch(/:root\s*\{/);
    // Level 2 needs both of its mechanisms present: `em` spacing that follows
    // the element's own font-size, and a clamp whose middle term is in `cqi`.
    expect(tokens).toMatch(/--ppp-local-[a-z-]*pad[a-z-]*\s*:\s*[\d.]+em\s*;/);
    expect(tokens).toMatch(/--ppp-local-[a-z-]+\s*:\s*clamp\([^;]*cqi[^;]*\)\s*;/);
  });

  it("the container-derived scale has at least one shipped consumer", () => {
    // The assertion that stops #165 from recreating its own subject. A level-2
    // section nothing reads is a document, not a scale — see the ADR's rejected
    // option (D). One pilot rule is the difference between the two.
    const consumers = collectStyled(SRC_ROOT)
      .filter(({ file, css }) => file.endsWith(".svelte") && /var\(\s*--ppp-local-/.test(css))
      .map(({ file }) => file);
    expect(consumers.length).toBeGreaterThan(0);
  });

  it("no element in the tree sizes itself in its own container units", () => {
    const offenders = collectStyled(SRC_ROOT)
      .flatMap(({ file, css }) => selfQueryOffenders(css).map((s) => `${file} → ${s}`));
    expect(offenders).toEqual([]);
  });

  it("tells a token declaration from a token read", () => {
    // Synthetic, because both scans below are expected to find nothing and an
    // all-clear is otherwise indistinguishable from a broken matcher.
    expect(declaredTokenNames("--ppp-radius-md: 0.375rem;")).toEqual(["--ppp-radius-md"]);
    expect(declaredTokenNames("border-radius: var(--ppp-radius-md);")).toEqual([]);
    expect(declaredTokenNames("z-index: var( --ppp-db-z-dropdown , 100);")).toEqual([]);
    // The shape the deleted designTokens.ts had: a scale assembled in a string.
    expect(declaredTokenNames('const css = `--ppp-radius-md: ${R.md}; --ppp-space-lg: ${S.lg};`'))
      .toEqual(["--ppp-radius-md", "--ppp-space-lg"]);
  });

  it("no TypeScript module declares a design token", () => {
    // The mechanism #165 removed, closed rather than merely undone. The fourth
    // source was not a stylesheet — it was `designTokens.ts` building a string
    // that redefined `:root` names on the canvas, so nothing in the CSS
    // appeared to conflict with anything and `--ppp-radius-md` quietly meant
    // two different sizes. An inventory of `.css` files cannot see that
    // coming back (Codex audit of #165, 2026-09-01).
    const offenders = collectModules(SRC_ROOT)
      .filter(({ file }) => file.endsWith(".ts"))
      .flatMap(({ file, text }) => declaredTokenNames(text).map((n) => `${file} → ${n}`));
    expect(offenders).toEqual([]);
  });

  it("nothing outside the token stylesheet redeclares a name from the scale", () => {
    // A component may invent its own per-instance variable — PageIcon's
    // `--ppp-icon-size` is a size passed down a prop, not a scale. What it may
    // not do is REDECLARE a name the scale already owns: that is the radius
    // shadow, and it is invisible in review because both declarations look
    // local and correct where they stand.
    const scale = new Set(declaredTokens(content(path.join(SRC_ROOT, "ui", "tokens", "tokens.css"))).keys());
    expect(scale.size).toBeGreaterThan(0); // a vacuous scan would otherwise pass
    const offenders = collectModules(SRC_ROOT)
      .flatMap(({ file, text }) =>
        declaredTokenNames(text).filter((n) => scale.has(n)).map((n) => `${file} → ${n}`)
      );
    expect(offenders).toEqual([]);
  });
});
