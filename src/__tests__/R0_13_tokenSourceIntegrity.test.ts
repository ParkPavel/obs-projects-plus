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

/**
 * `stripComments` matters here for a reason specific to this file:
 * `RULE_BLOCK`'s selector group is "everything since the last brace", so a
 * comment standing above a rule is captured as part of its selector. Every
 * documented rule in this tree has one, which silently made those selectors
 * unmatchable — the shape of a ratchet that passes by matching nothing, which
 * is the failure R0.4 records and this file was built to avoid.
 *
 * The three helpers moved to `support/cssScan.ts` when R0.16 (#167) needed the
 * same reading of "the CSS of this component"; two definitions of that would
 * have let the two ratchets disagree about what they guard.
 */
import { SRC_ROOT, collectStyled, stripCssComments as stripComments } from "./support/cssScan";

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

/** A selector as written, with runs of whitespace collapsed to one space. */
function normalizeSelector(selector: string): string {
  return selector.trim().replace(/\s+/g, " ");
}

/**
 * The selectors allowed to carry the `cqi` form of the level-2 scale (#166,
 * ADR_MATRYOSHKA_SIZING_2026-09-02 Q4). Each one declares `container-type`
 * in its own component; the rule below asserts that in both directions, so
 * this list cannot drift from the tree in either direction.
 *
 * `.ppp-dt-content` declares `container-type` and is deliberately absent: it
 * is a container nothing queries, and the ADR's Step 3 default is to delete
 * the declaration rather than give it a consumer. Absence from this list is
 * allowed; presence without a `container-type` in the tree is not.
 */
const CONTAINER_ROOTS = [
  ".ppp-widget-host",
  ".ppp-database-root",
  ".ppp-database-canvas",
] as const;

/**
 * A declaration body with its custom-property declarations removed, leaving
 * only what actually sizes the element.
 *
 * A `cq` unit inside `--ppp-local-*: …` is a value handed DOWN: custom
 * properties are substituted at the use site, so it measures each
 * descendant's nearest container, not this element's own ancestor. A `cq`
 * unit in `padding`/`width`/`font-size` on a container's own rule is the
 * self-query trap. Without this split the #166 container-roots rule would
 * read as an offender the moment the token and the `container-type` shared
 * a file, and the honest fix would look like weakening the rule.
 */
function sizingDeclarations(body: string): string {
  return body.replace(/(^|;)\s*--[a-zA-Z0-9_-]+\s*:[^;]*/g, "$1");
}

/**
 * Selectors that both declare `container-type` and size themselves in `cq`
 * units — the self-query trap. Reported as the offending selector text.
 */
function selfQueryOffenders(css: string): string[] {
  const containerSelectors = new Set<string>();
  const bodies = new Map<string, string[]>();
  for (const match of stripComments(css).matchAll(RULE_BLOCK)) {
    const selector = normalizeSelector(match[1] ?? "");
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
      if (CQ_UNIT.test(sizingDeclarations(body))) offenders.push(selector);
    }
  }
  return offenders;
}

/** Individual (comma-split) selectors of every rule declaring `container-type`. */
function containerTypeSelectors(css: string): string[] {
  const out: string[] = [];
  for (const match of stripComments(css).matchAll(RULE_BLOCK)) {
    const selector = normalizeSelector(match[1] ?? "");
    const body = match[2] ?? "";
    if (selector === "" || selector.startsWith("@")) continue;
    if (!/\bcontainer-type\s*:/.test(body) && !/\bcontainer\s*:/.test(body)) continue;
    for (const part of selector.split(",")) {
      const trimmed = part.trim();
      if (trimmed !== "") out.push(trimmed);
    }
  }
  return out;
}

/**
 * Every site where a `--ppp-local-*` name is declared with a `cq` unit in its
 * value, as `selector → name`. The selector is reported verbatim so a failure
 * names the place to look.
 */
function cqScaleDeclarationSites(css: string): { selector: string; name: string; value: string }[] {
  const sites: { selector: string; name: string; value: string }[] = [];
  for (const match of stripComments(css).matchAll(RULE_BLOCK)) {
    const selector = normalizeSelector(match[1] ?? "");
    const body = match[2] ?? "";
    if (selector === "" || selector.startsWith("@")) continue;
    for (const decl of body.matchAll(/(--ppp-local-[a-zA-Z0-9_-]*)\s*:\s*([^;]+)/g)) {
      const value = (decl[2] as string).trim();
      if (CQ_UNIT.test(value)) sites.push({ selector, name: decl[1] as string, value });
    }
  }
  return sites;
}

/** Whether every comma-separated part of `selector` is a declared container root. */
function isContainerRootSelector(selector: string, roots: readonly string[]): boolean {
  const parts = selector.split(",").map((p) => p.trim()).filter((p) => p !== "");
  return parts.length > 0 && parts.every((p) => roots.includes(p));
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

/**
 * `--ppp-*` names a module ASSIGNS at runtime through the CSSOM. A template
 * string was the first form of a second scale (`designTokens.ts`); a
 * `setProperty` call is the second, and a declaration scan cannot see it
 * because nothing in the text reads `name:`. Only a literal name is visible
 * here — a name assembled at runtime, or split across strings, is the stated
 * boundary of this ratchet (Codex adversarial review of #165, 2026-09-02).
 */
function assignedTokenNames(text: string): string[] {
  return [...text.matchAll(/setProperty\(\s*["'`](--ppp-[a-zA-Z0-9_-]+)["'`]/g)].map(
    (m) => m[1] as string
  );
}

/** The names `tokens.css` owns — the scale a component may read but not redeclare. */
function ownedScale(): Set<string> {
  return new Set(declaredTokens(content(path.join(SRC_ROOT, "ui", "tokens", "tokens.css"))).keys());
}

/**
 * Every `.ts` / `.js` / `.svelte` module under `src/`, excluding tests and
 * mocks, as `[path, text]`. `.js` is in the set because esbuild bundles it
 * exactly like `.ts`, so a scale hidden there would ship the same way.
 */
function collectModules(dir: string, out: { file: string; text: string }[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
      collectModules(full, out);
    } else if (/\.(ts|js|svelte)$/.test(entry.name)) {
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
    // #166: a `cq` unit inside a custom property is handed DOWN and resolves at
    // each descendant's use site. That is the container-roots mechanism, not the
    // trap, and the rule has to tell them apart rather than be relaxed.
    expect(
      selfQueryOffenders(".w { container-type: inline-size; --ppp-local-text-sm: clamp(1em, 0.85em + 0.6cqi, 1.25em); }")
    ).toEqual([]);
    // …and it must still catch real sizing standing next to one.
    expect(selfQueryOffenders(".w { container-type: inline-size; --ppp-local-text-sm: 1cqi; padding: 2cqi; }")).toEqual([
      ".w",
    ]);
  });

  it("the cqi form of the scale is declared only in container-root rules", () => {
    // #166 Q4. The hazard #165 measured and could not check: a level-2 token
    // declared at `:root` resolves `cqi` against the small viewport wherever no
    // container ancestor exists, landing on the clamp CEILING — a silent size
    // jump exactly where the principle does not apply. Confining the `cqi` form
    // to container roots makes the no-container case the clamp FLOOR, which is
    // today's render, and makes the whole thing statically checkable.
    const offenders = collectStyled(SRC_ROOT)
      .flatMap(({ file, css }) =>
        cqScaleDeclarationSites(css)
          .filter(({ selector }) => !isContainerRootSelector(selector, CONTAINER_ROOTS))
          .map(({ selector, name }) => `${file} → ${selector} → ${name}`)
      );
    expect(offenders).toEqual([]);
    // A vacuous pass would otherwise be indistinguishable: the mechanism has to
    // exist somewhere, or there is nothing being confined.
    const sites = collectStyled(SRC_ROOT).flatMap(({ css }) => cqScaleDeclarationSites(css));
    expect(sites.length).toBeGreaterThan(0);
  });

  it("fails when the cqi form is planted at :root on the real tree", () => {
    // Tree-based regression proof, run against the shipped stylesheet text with
    // the #165 form appended, so it proves the rule on the file it guards
    // without breaking the file.
    const tokens = content(path.join(SRC_ROOT, "ui", "tokens", "tokens.css"));
    const planted = `${tokens}\n:root { --ppp-local-text-sm: clamp(1em, 0.85em + 0.6cqi, 1.25em); }\n`;
    const offenders = cqScaleDeclarationSites(planted)
      .filter(({ selector }) => !isContainerRootSelector(selector, CONTAINER_ROOTS))
      .map(({ selector }) => selector);
    expect(offenders).toEqual([":root"]);
    // The same declaration moved under a container root is clean.
    const moved = `${tokens}\n.ppp-widget-host { --ppp-local-text-sm: clamp(1em, 0.85em + 0.6cqi, 1.25em); }\n`;
    expect(
      cqScaleDeclarationSites(moved).filter(({ selector }) => !isContainerRootSelector(selector, CONTAINER_ROOTS))
    ).toEqual([]);
  });

  it("every declared container root is made a container somewhere in src", () => {
    // The other direction. A root listed here but never given `container-type`
    // hands the `cqi` form to descendants of a plain box, where it resolves
    // against whatever ancestor happens to be a container — the nearest-ancestor
    // re-pointing risk, arriving through the guard itself.
    const declared = new Set(collectStyled(SRC_ROOT).flatMap(({ css }) => containerTypeSelectors(css)));
    expect(declared.size).toBeGreaterThan(0);
    const missing = CONTAINER_ROOTS.filter((root) => !declared.has(root));
    expect(missing).toEqual([]);
  });

  it("fails when a declared root is a container nowhere on the real tree", () => {
    // Planted regression for the direction above, against the real tree.
    const declared = new Set(collectStyled(SRC_ROOT).flatMap(({ css }) => containerTypeSelectors(css)));
    const planted = [...CONTAINER_ROOTS, ".ppp-not-a-container"];
    expect(planted.filter((root) => !declared.has(root))).toEqual([".ppp-not-a-container"]);
    // And `.ppp-widget-config` is a real container, just deliberately unlisted —
    // proof the scan reads the tree rather than the list. (`.ppp-dt-content`
    // was this witness until #166 Step 3 deleted a container nobody queried;
    // the witness has to be a container that is actually still declared, or
    // this direction of the proof goes vacuous without failing.)
    expect(declared.has(".ppp-widget-config")).toBe(true);
    expect(CONTAINER_ROOTS).not.toContain(".ppp-widget-config");
  });

  it("the :root fallback for the level-2 scale is the clamp floor, with no cq unit", () => {
    // The contract of the split: no container ancestor must mean TODAY'S render.
    // If the `:root` value ever drifted away from the clamp's first argument,
    // the fallback would move something on screen and nothing else would notice.
    const tokens = content(path.join(SRC_ROOT, "ui", "tokens", "tokens.css"));
    const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(tokens)?.[1] ?? "";
    expect(rootBlock.length).toBeGreaterThan(1000);
    const fallback = declaredTokens(rootBlock).get("--ppp-local-text-sm");
    expect(fallback).toBe("1em");
    expect(CQ_UNIT.test(fallback ?? "")).toBe(false);
    const containerForm = cqScaleDeclarationSites(tokens).find((s) => s.name === "--ppp-local-text-sm");
    expect(containerForm).toBeDefined();
    const clampFloor = /^clamp\(\s*([^,]+),/.exec(containerForm?.value ?? "")?.[1];
    expect(clampFloor?.trim()).toBe(fallback);
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

  it("no script module declares a design token", () => {
    // The mechanism #165 removed, closed rather than merely undone. The fourth
    // source was not a stylesheet — it was `designTokens.ts` building a string
    // that redefined `:root` names on the canvas, so nothing in the CSS
    // appeared to conflict with anything and `--ppp-radius-md` quietly meant
    // two different sizes. An inventory of `.css` files cannot see that
    // coming back (Codex audit of #165, 2026-09-01).
    const offenders = collectModules(SRC_ROOT)
      .filter(({ file }) => /\.(ts|js)$/.test(file))
      .flatMap(({ file, text }) => declaredTokenNames(text).map((n) => `${file} → ${n}`));
    expect(offenders).toEqual([]);
  });

  it("tells a runtime token assignment from a runtime read", () => {
    expect(assignedTokenNames('el.style.setProperty("--ppp-radius-md", value);')).toEqual([
      "--ppp-radius-md",
    ]);
    expect(assignedTokenNames("root.style.setProperty( '--ppp-space-lg' , s )")).toEqual([
      "--ppp-space-lg",
    ]);
    expect(assignedTokenNames('el.style.getPropertyValue("--ppp-radius-md")')).toEqual([]);
    // A per-instance variable is reported too; ownership is the rule's job, not the matcher's.
    expect(assignedTokenNames("node.style.setProperty(`--ppp-icon-size`, size)")).toEqual([
      "--ppp-icon-size",
    ]);
  });

  it("no module assigns a name from the scale through the CSSOM", () => {
    // The second way to build `designTokens.ts` again without writing a
    // stylesheet: `setProperty` on the canvas element. The redeclaration rule
    // below cannot see it — there is no `name:` in the text — and the
    // adversarial review named it as the form R0.13 would let through.
    const scale = ownedScale();
    expect(scale.size).toBeGreaterThan(0);
    const offenders = collectModules(SRC_ROOT).flatMap(({ file, text }) =>
      assignedTokenNames(text)
        .filter((n) => scale.has(n))
        .map((n) => `${file} → ${n}`)
    );
    expect(offenders).toEqual([]);
  });

  it("nothing outside the token stylesheet redeclares a name from the scale", () => {
    // A component may invent its own per-instance variable — PageIcon's
    // `--ppp-icon-size` is a size passed down a prop, not a scale. What it may
    // not do is REDECLARE a name the scale already owns: that is the radius
    // shadow, and it is invisible in review because both declarations look
    // local and correct where they stand.
    const scale = ownedScale();
    expect(scale.size).toBeGreaterThan(0); // a vacuous scan would otherwise pass
    const offenders = collectModules(SRC_ROOT)
      .flatMap(({ file, text }) =>
        declaredTokenNames(text).filter((n) => scale.has(n)).map((n) => `${file} → ${n}`)
      );
    expect(offenders).toEqual([]);
  });
});
