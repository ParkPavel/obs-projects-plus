/**
 * R0.35 — plugin styles stay inside the plugin (theme-compat).
 *
 * The theme-compat audit (real host, default themes) found a rule in
 * `CompactNavBar.svelte` written as a bare `:global(.clickable-icon)`. Svelte
 * injects component CSS into the document when the component first mounts, so
 * from the moment a Projects view opened, every clickable icon in Obsidian —
 * the ribbon, tab headers, other plugins — took the navbar's padding and
 * radius (measured on the native `.side-dock-ribbon-action`). Nothing in the
 * plugin looked wrong; the damage was all outside it, which is why no view
 * test could see it.
 *
 * ## What is pinned
 *
 * 1. **Component globals.** In every `<style>` under `src/ui/`, a selector that
 *    contains `:global(…)` must ALSO carry either a local part (a scoped
 *    element, class or attribute outside the `:global`, which Svelte ties to
 *    the component) or a plugin-anchored class: `.projects-*`, `.projects--*`,
 *    `.ppp-*`, `.obsidian-projects-*`, `.board-*`, `.obs-projects-plus`, or
 *    `[data-type="obs-projects-plus"]`. Budget: exactly 0.
 * 2. **Root stylesheets.** Every selector in the root `styles.css` (what
 *    Obsidian loads) and in the token stylesheet under `src/ui/` (merged into
 *    it by the build) must be plugin-anchored. The one exemption is a `:root` /
 *    `body` block that declares nothing but `--ppp-*` custom properties: a
 *    plugin-owned variable cannot restyle anything that does not read it.
 *    Budget: exactly 0.
 * 3. **Generic class names.** The global class names the audit flagged as
 *    collision-prone (`calendar-fade-enter`, `drop-target-active`) exist only
 *    with the plugin prefix now; a bare one coming back is reported by name.
 * 4. **Contrast.** Count footers and empty states that a user reads use
 *    `--text-muted`, never `--text-faint` (2.30:1 light, 2.97:1 dark in the
 *    default themes, under WCAG AA) and never a lowering `opacity`.
 * 5. **Hard-coded colours.** Per component, the number of colour literals
 *    (hex, `rgb()`/`rgba()`, `hsl()`/`hsla()` with literal arguments) written
 *    in its `<style>` outside a `var()` fallback. MEASURED, exact: it may only
 *    fall, and it falls by moving a colour onto a theme variable — never by
 *    raising a number. A component not in the table must have none, and each
 *    literal that remains is listed with its reason (`JUSTIFIED_COLOURS`):
 *    today only the colour picker's own spectrum and handles.
 *
 * ## Where it is blind
 *
 * It reads text. A selector built at runtime (`classList.add` of a class no
 * stylesheet anchors) or a style string set from script is not CSS it can
 * read; colours in script and inline `style=` attributes are not counted (the
 * budget covers the `<style>` blocks). A named colour (`white`, `red`) is not
 * counted, nor is an id selector that happens to spell hex digits — none
 * exists today. The live checks are the host ones: the ribbon icon's computed
 * padding with a Projects view open, and contrast measured in the default
 * dark and light themes.
 */

import { join } from "path";

import {
  SRC_ROOT,
  collectSourceFiles,
  readText,
  relToSrc,
  stripComponentComments,
  stripCssComments,
  svelteStyles,
} from "./support/cssScan";

const REPO_ROOT = join(SRC_ROOT, "..");
const UI_ROOT = join(SRC_ROOT, "ui");

/** Unanchored `:global` selectors in components. MEASURED; stays 0. */
const UNANCHORED_GLOBAL_BUDGET = 0;
/** Unanchored selectors in the root stylesheets. MEASURED; stays 0. */
const UNANCHORED_STYLESHEET_BUDGET = 0;

/** A colour literal that stays, and why it cannot follow the theme. */
type Justified = { literal: string; why: string };

/** The colour picker's spectrum: the colours being picked, not a theme surface. */
const PICKER_SPECTRUM: readonly Justified[] = [
  { literal: "#000", why: "saturation/lightness field: the black end of the value gradient" },
  { literal: "#fff", why: "saturation/lightness field: the white end of the saturation gradient" },
  {
    literal: "rgba(0, 0, 0, 0.3)",
    why: "field handle ring: the dark half of the white-and-dark ring that stays visible over any hue",
  },
  { literal: "rgba(0, 0, 0, 0.3)", why: "field handle drop shadow, over the spectrum rather than a theme surface" },
  { literal: "hsl(0, 100%, 50%)", why: "hue strip stop: red" },
  { literal: "hsl(60, 100%, 50%)", why: "hue strip stop: yellow" },
  { literal: "hsl(120, 100%, 50%)", why: "hue strip stop: green" },
  { literal: "hsl(180, 100%, 50%)", why: "hue strip stop: cyan" },
  { literal: "hsl(240, 100%, 50%)", why: "hue strip stop: blue" },
  { literal: "hsl(300, 100%, 50%)", why: "hue strip stop: magenta" },
  { literal: "hsl(360, 100%, 50%)", why: "hue strip stop: red again, closing the wheel" },
  { literal: "rgba(0, 0, 0, 0.2)", why: "hue handle border: the dark edge of a white knob sitting on the hue strip" },
  { literal: "rgba(0, 0, 0, 0.2)", why: "hue handle drop shadow, over the hue strip rather than a theme surface" },
];

/**
 * Every colour literal still written in a component `<style>` (outside `var()`
 * fallbacks), in source order, with its reason. A literal not listed here is
 * a theme colour that has to move onto a variable: status and semantic tints
 * use `--color-red|orange|yellow|green|cyan|blue|purple|pink` (or
 * `rgba(var(--color-*-rgb), a)`), surfaces `--background-*`, dims
 * `--background-modifier-cover`, shadows `--shadow-s` / `--shadow-l` (or
 * `var(--background-modifier-box-shadow)` where the offsets have to stay).
 */
const JUSTIFIED_COLOURS: Readonly<Record<string, readonly Justified[]>> = {
  "ui/components/ColorPicker/ColorPicker.svelte": PICKER_SPECTRUM,
  // The record popup carries its own copy of the picker (same field, strip and handles).
  "ui/views/Calendar/components/DayPopup/RecordItem.svelte": PICKER_SPECTRUM,
  // Drawn over the user's image, not a theme surface: a dark scrim or chip keeps
  // light text readable over any photo in light and dark themes alike.
  "ui/views/Dashboard/widgets/CoverBanner/CoverBannerWidget.svelte": [
    { literal: "rgba(0, 0, 0, 0.55)", why: "caption scrim over the cover image" },
  ],
  "ui/components/ImagePreview/ImagePreview.svelte": [
    { literal: "rgba(0, 0, 0, 0.6)", why: "remove button chip over the previewed image" },
  ],
};

/**
 * Hard-coded colours per component (`<style>` only, outside `var()`
 * fallbacks). 85 in 31 components at theme-compat on a2cf8aba; the migration
 * to theme variables left only the picker spectrum above. Exact: lower an
 * entry in the same change that removes a colour, delete it at 0, never raise
 * it — and every entry equals the length of its `JUSTIFIED_COLOURS` list.
 */
const HARD_COLOUR_BUDGET: Readonly<Record<string, number>> = {
  "ui/components/ColorPicker/ColorPicker.svelte": 13,
  "ui/views/Calendar/components/DayPopup/RecordItem.svelte": 13,
  "ui/views/Dashboard/widgets/CoverBanner/CoverBannerWidget.svelte": 1,
  "ui/components/ImagePreview/ImagePreview.svelte": 1,
};

// ── The reader ─────────────────────────────────────────────────────────────

type Rule = {
  selector: string;
  body: string;
  /** At-rule preludes around the rule, outermost first. */
  atRules: string[];
  /** The nearest enclosing style rule's selector (CSS nesting), if any. */
  parent: string | null;
};

const normalize = (text: string): string => text.trim().replace(/\s+/g, " ");

/** Every style rule in `css`, comments removed. A brace walk (the R0.33 shape). */
export function readRules(css: string): Rule[] {
  const rules: Rule[] = [];
  const stack: { head: string; body: string }[] = [];
  let buffer = "";
  for (const ch of stripCssComments(css)) {
    if (ch === "{") {
      stack.push({ head: normalize(buffer), body: "" });
      buffer = "";
    } else if (ch === "}") {
      const closed = stack.pop();
      if (closed && !closed.head.startsWith("@")) {
        const styleParents = stack.filter((s) => !s.head.startsWith("@"));
        rules.push({
          selector: closed.head,
          body: closed.body + buffer,
          atRules: stack.filter((s) => s.head.startsWith("@")).map((s) => s.head),
          parent: styleParents.length > 0 ? styleParents[styleParents.length - 1]?.head ?? null : null,
        });
      }
      buffer = "";
    } else if (ch === ";") {
      const top = stack[stack.length - 1];
      if (top && !top.head.startsWith("@")) top.body += buffer + ";";
      buffer = "";
    } else {
      buffer += ch;
    }
  }
  return rules;
}

/** Split on commas outside parentheses and brackets. */
export function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(normalize(current));
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim() !== "") parts.push(normalize(current));
  return parts;
}

const inKeyframes = (rule: Rule): boolean =>
  rule.atRules.some((at) => /^@(?:-webkit-)?keyframes\b/i.test(at));

const GLOBAL_OPEN = ":global(";

/** A selector's `:global(…)` arguments, and what is left with them removed. */
export function splitGlobal(selector: string): { inner: string[]; rest: string } {
  const inner: string[] = [];
  let rest = "";
  let i = 0;
  while (i < selector.length) {
    if (selector.startsWith(GLOBAL_OPEN, i)) {
      let depth = 1;
      let j = i + GLOBAL_OPEN.length;
      for (; j < selector.length && depth > 0; j++) {
        if (selector.charAt(j) === "(") depth++;
        else if (selector.charAt(j) === ")") depth--;
      }
      inner.push(selector.slice(i + GLOBAL_OPEN.length, j - 1));
      rest += " ";
      i = j;
    } else {
      rest += selector.charAt(i);
      i++;
    }
  }
  return { inner, rest };
}

/** Pseudo-classes and pseudo-elements, with one level of nested arguments. */
const PSEUDO = /::?[\w-]+(?:\((?:[^()]|\([^()]*\))*\))?/g;

/**
 * Whether what is left outside `:global` names something Svelte scopes: an
 * element, class, id, attribute or `*`. Pseudo-classes alone (`:hover`) and
 * combinators do not — `:global(.a):hover` reaches every `.a` in the app.
 */
export function hasLocalPart(rest: string): boolean {
  return /[A-Za-z_.#*[]/.test(rest.replace(PSEUDO, " "));
}

const ANCHOR =
  /\.(?:projects-|ppp-|obsidian-projects-|board-)[\w-]|\.obs-projects-plus(?![\w-])|\[data-type=(["']?)obs-projects-plus\1\]/;

/** Whether a selector names a plugin-owned class or the plugin's leaf type. A `:not()` does not anchor. */
export function isPluginAnchored(selector: string): boolean {
  return ANCHOR.test(selector.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, " "));
}

/** Component selectors with a `:global(…)` that neither stay local nor name the plugin. */
export function unanchoredGlobals(css: string): string[] {
  const out: string[] = [];
  for (const rule of readRules(css)) {
    if (inKeyframes(rule)) continue;
    for (const part of splitTopLevel(rule.selector)) {
      if (!part.includes(GLOBAL_OPEN)) continue;
      if (hasLocalPart(splitGlobal(part).rest)) continue;
      if (isPluginAnchored(part)) continue;
      out.push(part);
    }
  }
  return out;
}

/** Declared property names of a rule body, in order. */
function declarationNames(body: string): string[] {
  return body
    .split(";")
    .map((decl) => {
      const at = decl.indexOf(":");
      return at === -1 ? "" : decl.slice(0, at).trim();
    })
    .filter((name) => name !== "");
}

/** `name: value` of a rule body, names lower-cased. */
function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const decl of body.split(";")) {
    const at = decl.indexOf(":");
    if (at === -1) continue;
    out.set(decl.slice(0, at).trim().toLowerCase(), normalize(decl.slice(at + 1)));
  }
  return out;
}

/** A `:root` / `body` block that declares only `--ppp-*` custom properties. */
export function isTokenBlock(rule: Rule): boolean {
  const parts = splitTopLevel(rule.selector);
  const names = declarationNames(rule.body);
  return (
    parts.length > 0 &&
    parts.every((p) => p === ":root" || p === "body") &&
    names.length > 0 &&
    names.every((n) => n.startsWith("--ppp-"))
  );
}

/** Stylesheet selectors that are not plugin-anchored (token blocks and keyframe steps aside). */
export function unanchoredStylesheetSelectors(css: string): string[] {
  const out: string[] = [];
  for (const rule of readRules(css)) {
    if (inKeyframes(rule) || isTokenBlock(rule)) continue;
    // A nested rule sits inside its parent: anchored when the parent is.
    const parentAnchored =
      rule.parent !== null && splitTopLevel(rule.parent).every(isPluginAnchored);
    for (const part of splitTopLevel(rule.selector)) {
      if (parentAnchored || isPluginAnchored(part)) continue;
      out.push(part);
    }
  }
  return out;
}

/** Index of the `)` matching the `(` at `open`, or the last index. */
function closingParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return text.length - 1;
}

const COLOUR_FN = /^(?:rgba?|hsla?)\(/i;
const HEX = /^#[0-9a-fA-F]{3,8}(?![\w-])/;

/**
 * Colour literals in `css` outside `var()` fallbacks. A colour function counts
 * when its arguments are literal; `rgba(var(--x-rgb), 0.2)` follows the theme
 * and does not count.
 */
export function hardColours(css: string): string[] {
  const text = stripCssComments(css);
  const found: string[] = [];
  // One entry per open parenthesis: true when it opened a `var(`.
  const parens: boolean[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text.charAt(i);
    if (ch === "{" || ch === "}" || ch === ";") {
      parens.length = 0;
      i++;
      continue;
    }
    const startsToken = i === 0 || !/[\w-]/.test(text.charAt(i - 1));
    if (startsToken) {
      const ahead = text.slice(i, i + 10);
      if (/^var\(/i.test(ahead)) {
        parens.push(true);
        i += 4;
        continue;
      }
      const fn = COLOUR_FN.exec(ahead);
      if (fn) {
        const open = i + fn[0].length - 1;
        const end = closingParen(text, open);
        const args = text.slice(open + 1, end);
        if (!parens.includes(true) && !/var\(/i.test(args)) {
          found.push(normalize(text.slice(i, end + 1)));
        }
        i = end + 1;
        continue;
      }
      if (ch === "#" && !parens.includes(true)) {
        const hex = HEX.exec(ahead);
        if (hex) {
          found.push(hex[0]);
          i += hex[0].length;
          continue;
        }
      }
    }
    if (ch === "(") parens.push(false);
    else if (ch === ")") parens.pop();
    i++;
  }
  return found;
}

// ── The tree ───────────────────────────────────────────────────────────────

type Styled = { file: string; css: string };

/** Every component under `src/ui/`, as its `<style>` contents. */
function styledComponents(): Styled[] {
  return collectSourceFiles(UI_ROOT, [".svelte"]).map((full) => ({
    file: relToSrc(full),
    css: svelteStyles(readText(full)),
  }));
}

/** The root `styles.css` and every stylesheet under `src/ui/`. */
function stylesheets(): Styled[] {
  return [
    { file: "styles.css", css: readText(join(REPO_ROOT, "styles.css")) },
    ...collectSourceFiles(UI_ROOT, [".css"]).map((full) => ({ file: relToSrc(full), css: readText(full) })),
  ];
}

const globalOffenders = (styled: readonly Styled[]): string[] =>
  styled.flatMap(({ file, css }) => unanchoredGlobals(css).map((sel) => `${file} → ${sel}`));

const sheetOffenders = (sheets: readonly Styled[]): string[] =>
  sheets.flatMap(({ file, css }) => unanchoredStylesheetSelectors(css).map((sel) => `${file} → ${sel}`));

function measureColours(styled: readonly Styled[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { file, css } of styled) {
    const count = hardColours(css).length;
    if (count > 0) out[file] = count;
  }
  return out;
}

const asLiteral = (measured: Record<string, number>): string =>
  Object.keys(measured)
    .sort()
    .map((file) => `  "${file}": ${measured[file] ?? 0},`)
    .join("\n");

const LEAK_HELP =
  "Anchor the selector: put a scoped local class of this component in front of the " +
  ":global(…) (`.my-root :global(.clickable-icon)`), or name a plugin class inside it " +
  "(`.ppp-*`, `.projects-*`, `.obsidian-projects-*`). A bare global restyles Obsidian itself.";

describe("R0.35 — the reader (synthetic, proves both states)", () => {
  it("flags a component global that reaches the whole app", () => {
    expect(unanchoredGlobals(":global(.clickable-icon) { padding: 1rem; }")).toEqual([":global(.clickable-icon)"]);
    expect(unanchoredGlobals(":global(.clickable-icon:focus-visible) { outline: none; }")).toHaveLength(1);
    expect(unanchoredGlobals(":global(.a):hover { x: 1; }")).toHaveLength(1);
    expect(unanchoredGlobals(":global(.a) > :global(.b) { x: 1; }")).toHaveLength(1);
    expect(unanchoredGlobals(":global(.custom-lists [data-x]) { x: 1; }")).toHaveLength(1);
    expect(unanchoredGlobals(":global(:not(.ppp-a) .b) { x: 1; }")).toHaveLength(1);
  });

  it("accepts a global with a local part or a plugin anchor", () => {
    const css = [
      ".compact-navbar :global(.clickable-icon) { x: 1; }",
      ".custom-lists :global([data-is-dnd-shadow-item-hint]) { x: 1; }",
      ":global(.theme-dark) .heat-1 { x: 1; }",
      ".zoom > :global(:first-child) { x: 1; }",
      "div :global(p:first-child) { x: 1; }",
      ":global(.ppp-drop-target-active) { x: 1; }",
      ":global(body.obsidian-projects-scroll-locked) { x: 1; }",
      ":global(.projects-container .x), :global(.board-x) { x: 1; }",
      ":global(.ppp-pop-box) :global(.ppp-pop-search) { x: 1; }",
      ".plain { x: 1; }",
    ].join("\n");
    expect(unanchoredGlobals(css)).toEqual([]);
  });

  it("reads each selector of a list, and not comments or keyframe steps", () => {
    expect(unanchoredGlobals(".a :global(.x), :global(.y) { z: 1; }")).toEqual([":global(.y)"]);
    expect(unanchoredGlobals("/* :global(.x) { a: 1; } */ .a { b: 1; }")).toEqual([]);
    expect(unanchoredGlobals("@media (hover: hover) { :global(.x) { a: 1; } }")).toHaveLength(1);
    expect(splitGlobal(":global(.a:not(.b)) .c").inner).toEqual([".a:not(.b)"]);
  });

  it("requires a plugin anchor in a stylesheet, token blocks aside", () => {
    expect(unanchoredStylesheetSelectors(".clickable-icon { padding: 1rem; }")).toEqual([".clickable-icon"]);
    expect(unanchoredStylesheetSelectors("body { color: red; }")).toEqual(["body"]);
    expect(unanchoredStylesheetSelectors(":root { --background-primary: red; }")).toEqual([":root"]);
    expect(unanchoredStylesheetSelectors(":root { --ppp-a: 1; --text-normal: red; }")).toEqual([":root"]);
    expect(unanchoredStylesheetSelectors(":not(.ppp-a) .x { y: 1; }")).toEqual([":not(.ppp-a) .x"]);
    expect(unanchoredStylesheetSelectors(".ppp-a, .menu { y: 1; }")).toEqual([".menu"]);
    const anchored = [
      ":root { --ppp-a: 1; } body { --ppp-b: 2; }",
      "@media (pointer: coarse) { :root { --ppp-c: 3; } }",
      ".obs-projects-plus select, .projects-modal select { y: 1; }",
      '.workspace-leaf-content[data-type="obs-projects-plus"] .view-content { y: 1; }',
      ".projects--board--column { y: 1; &:has(.x) { z: 2; } }",
      ":is(.projects-container, .ppp-modal) *::after { y: 1; }",
      "@keyframes ppp-fade { from { opacity: 0; } to { opacity: 1; } }",
    ].join("\n");
    expect(unanchoredStylesheetSelectors(anchored)).toEqual([]);
  });

  it("counts colour literals outside var() fallbacks", () => {
    expect(hardColours(".a { color: #fff; background: rgba(0, 0, 0, 0.2); }")).toEqual(["#fff", "rgba(0, 0, 0, 0.2)"]);
    expect(hardColours(".a { background: linear-gradient(#000, transparent), hsl(0, 100%, 50%); }")).toHaveLength(2);
    expect(hardColours(".a { border-color: #abcdef80; }")).toEqual(["#abcdef80"]);
    expect(hardColours(".a { --shadow: 0 0 1rem rgba(0,0,0,.2); }")).toHaveLength(1);
  });

  it("does not count fallbacks, theme-built colours, comments or names", () => {
    expect(hardColours(".a { color: var(--x, #fff); box-shadow: var(--s, 0 0 1rem rgba(0, 0, 0, 0.2)); }")).toEqual([]);
    expect(hardColours(".a { color: var(--x, var(--y, #abc)); }")).toEqual([]);
    expect(hardColours(".a { background: rgba(var(--x-rgb), 0.2); color: hsl(var(--hue), 100%, 50%); }")).toEqual([]);
    expect(hardColours(".a { background: rgba(var(--c-rgb, 255, 0, 0), 0.06); }")).toEqual([]);
    expect(hardColours("/* #fff rgba(0,0,0,1) */ .a { color: white; }")).toEqual([]);
    expect(hardColours(".a { color: var(--x, #fff); } .b { color: #000; }")).toEqual(["#000"]);
  });
});

describe("R0.35 — the tree", () => {
  const components = styledComponents();
  const sheets = stylesheets();

  it("reads the tree it claims to read", () => {
    // A wrong root would make every assertion below pass on nothing.
    expect(components.length).toBeGreaterThan(150);
    const globals = components.reduce(
      (n, { css }) =>
        n +
        readRules(css)
          .flatMap((r) => splitTopLevel(r.selector))
          .filter((p) => p.includes(GLOBAL_OPEN)).length,
      0
    );
    expect(globals).toBeGreaterThanOrEqual(100);
    const root = sheets.find((s) => s.file === "styles.css");
    expect(root).toBeDefined();
    expect(readRules(root?.css ?? "").length).toBeGreaterThanOrEqual(50);
    expect(sheets.some((s) => s.file === "ui/tokens/tokens.css")).toBe(true);
    expect(readRules(readText(join(UI_ROOT, "tokens", "tokens.css"))).length).toBeGreaterThanOrEqual(10);
  });

  it("no component global reaches outside the plugin (budget 0)", () => {
    const offenders = globalOffenders(components);
    if (offenders.length > UNANCHORED_GLOBAL_BUDGET) {
      throw new Error(
        `unanchored :global selectors: ${offenders.length} > ${UNANCHORED_GLOBAL_BUDGET}\n` +
          offenders.map((o) => `  ${o}`).join("\n") +
          `\n\n${LEAK_HELP}`
      );
    }
    expect(offenders).toHaveLength(UNANCHORED_GLOBAL_BUDGET);
  });

  it("every root stylesheet selector is plugin-anchored (budget 0)", () => {
    const offenders = sheetOffenders(sheets);
    if (offenders.length > UNANCHORED_STYLESHEET_BUDGET) {
      throw new Error(
        `unanchored stylesheet selectors: ${offenders.length} > ${UNANCHORED_STYLESHEET_BUDGET}\n` +
          offenders.map((o) => `  ${o}`).join("\n") +
          "\n\nObsidian loads styles.css into the whole app. Scope the rule under a plugin root " +
          '(`.workspace-leaf-content[data-type="obs-projects-plus"]`, `.projects-container`, ' +
          "a `.ppp-*` class); only a :root/body block of --ppp-* variables may stand alone."
      );
    }
    expect(offenders).toHaveLength(UNANCHORED_STYLESHEET_BUDGET);
  });

  it("the navbar's icon rules are anchored to the navbar", () => {
    const nav = components.find((c) => c.file === "ui/components/Navigation/CompactNavBar.svelte");
    expect(nav).toBeDefined();
    const selectors = readRules(nav?.css ?? "").flatMap((r) => splitTopLevel(r.selector));
    expect(selectors).toContain(".compact-navbar :global(.clickable-icon)");
    expect(selectors).toContain(".compact-navbar :global(.clickable-icon:focus-visible)");
    expect(selectors.filter((s) => s.startsWith(":global(.clickable-icon"))).toEqual([]);
  });

  it("the collision-prone class names exist only with the plugin prefix", () => {
    const bare = /(?<![\w-])(?:calendar-fade-enter|drop-target-active)(?![\w])/g;
    const found = collectSourceFiles(UI_ROOT, [".svelte", ".ts", ".css"])
      .filter((full) => !full.endsWith(".test.ts"))
      .flatMap((full) =>
        [...stripComponentComments(readText(full)).matchAll(bare)].map((m) => `${relToSrc(full)} → ${m[0]}`)
      );
    expect(found).toEqual([]);
    // The class EventList asks svelte-dnd-action to add is the one its style targets.
    const eventList = readText(join(UI_ROOT, "views", "Calendar", "components", "Calendar", "EventList.svelte"));
    expect(eventList).toContain('dropTargetClasses: ["ppp-drop-target-active"]');
    expect(eventList).toContain(":global(.ppp-drop-target-active)");
  });

  it("one planted bare global in a real component is reported", () => {
    const target = "ui/components/Navigation/CompactNavBar.svelte";
    const planted = components.map((c) =>
      c.file === target ? { ...c, css: `${c.css}\n:global(.clickable-icon) { padding: 0.625rem; }` } : c
    );
    expect(globalOffenders(planted)).toEqual([`${target} → :global(.clickable-icon)`]);
  });

  it("one planted unscoped rule in styles.css is reported", () => {
    const planted = sheets.map((s) =>
      s.file === "styles.css" ? { ...s, css: `${s.css}\n.clickable-icon { padding: 0.625rem; }` } : s
    );
    expect(sheetOffenders(planted)).toEqual(["styles.css → .clickable-icon"]);
  });
});

describe("R0.35 — readable text reaches WCAG AA in the default themes", () => {
  /** Rules of a component whose selector names `cls` as a class. */
  function rulesNaming(file: string, cls: string): Map<string, string>[] {
    const css = svelteStyles(readText(join(SRC_ROOT, file)));
    const named = new RegExp(`\\.${cls}(?![\\w-])`);
    return readRules(css)
      .filter((r) => splitTopLevel(r.selector).some((p) => named.test(p)))
      .map((r) => declarations(r.body));
  }

  const TARGETS: ReadonlyArray<{ file: string; cls: string }> = [
    { file: "ui/views/Board/components/Board/BoardColumn.svelte", cls: "projects--board--column-footer-count" },
    { file: "ui/views/Gallery/GalleryView.svelte", cls: "ppp-gallery-footer-count" },
    { file: "ui/views/Gallery/GalleryView.svelte", cls: "ppp-gallery-empty-hint" },
    { file: "ui/components/RecordCardView/RecordCardView.svelte", cls: "ppp-rcv-empty" },
  ];

  it.each(TARGETS)("$cls ($file) is --text-muted, never faint, never faded", ({ file, cls }) => {
    const rules = rulesNaming(file, cls);
    expect(rules.length).toBeGreaterThan(0);
    const colours = rules.map((d) => d.get("color")).filter((c): c is string => c !== undefined);
    expect(colours).toContain("var(--text-muted)");
    expect(colours.filter((c) => c.includes("--text-faint"))).toEqual([]);
    const opacities = rules
      .map((d) => d.get("opacity"))
      .filter((o): o is string => o !== undefined && Number(o) < 1);
    expect(opacities).toEqual([]);
  });
});

describe("R0.35 — hard-coded colours may only fall", () => {
  const components = styledComponents();

  it("reads the colours it claims to read", () => {
    // A wrong root or a blind reader would pass the budget on nothing: the
    // picker spectrum is known to be there, so it has to be found.
    const measured = measureColours(components);
    for (const file of Object.keys(JUSTIFIED_COLOURS)) {
      expect(measured[file]).toBeGreaterThan(0);
    }
  });

  it("every remaining literal is a justified one, in place", () => {
    for (const [file, justified] of Object.entries(JUSTIFIED_COLOURS)) {
      expect(HARD_COLOUR_BUDGET[file]).toBe(justified.length);
      expect(justified.filter((entry) => entry.why.trim() === "")).toEqual([]);
      const css = components.find((c) => c.file === file)?.css ?? "";
      expect(hardColours(css)).toEqual(justified.map((j) => j.literal));
    }
    expect(Object.keys(HARD_COLOUR_BUDGET).sort()).toEqual(Object.keys(JUSTIFIED_COLOURS).sort());
  });

  it("each component carries exactly its budgeted colours", () => {
    const measured = measureColours(components);
    const expected: Record<string, number> = { ...HARD_COLOUR_BUDGET };
    const keys = new Set([...Object.keys(measured), ...Object.keys(expected)]);
    const rose = [...keys].filter((k) => (measured[k] ?? 0) > (expected[k] ?? 0));
    const fell = [...keys].filter((k) => (measured[k] ?? 0) < (expected[k] ?? 0));
    if (rose.length > 0) {
      throw new Error(
        `hard-coded colours rose in: ${rose.map((k) => `${k} (${expected[k] ?? 0} → ${measured[k] ?? 0})`).join(", ")}\n` +
          "Use the theme's variable (--background-*, --text-*, --interactive-accent, " +
          "rgba(var(--…-rgb), a)) or put the literal behind one as a var() fallback."
      );
    }
    if (fell.length > 0) {
      throw new Error(
        `hard-coded colours fell in: ${fell.join(", ")} — bank it: set HARD_COLOUR_BUDGET to\n${asLiteral(measured)}`
      );
    }
    expect(measured).toEqual(expected);
  });

  it("one planted colour in a component with none is reported", () => {
    const target = "ui/views/Dashboard/widgets/WidgetShell.svelte";
    expect(components.some((c) => c.file === target)).toBe(true);
    expect(HARD_COLOUR_BUDGET[target]).toBeUndefined();
    const planted = components.map((c) =>
      c.file === target ? { ...c, css: `${c.css}\n.ppp-planted { color: #123456; }` } : c
    );
    expect(measureColours(planted)[target]).toBe(1);
  });
});
