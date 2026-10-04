import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

/**
 * R0.3 — CSS px-budget ratchet
 *
 * Revision 3 §2.1 mandates "ИСКЛЮЧИТЕЛЬНО относительные единицы". The legacy
 * px values were converted in stage R0.3b, and this test now holds the tree
 * at ZERO `<digits>px` occurrences across `src/**\/*.{svelte,css}` — comments
 * included, because a comment that states a size in px is where the next px
 * value is copied from.
 *
 * The check is exact: a count above the budget fails, and so does a count
 * below it, so the constant always equals the tree. At 0 that means no px at
 * all. NEVER raise it.
 *
 * What replaced the old allowed-by-spec exceptions:
 * - hairlines (`1px` borders, dividers, rings) read `var(--ppp-border-width)`,
 *   which `tokens.css` declares as 0.0625rem (one CSS pixel at the default
 *   root); a thick stroke is `--ppp-border-width-thick` (0.125rem);
 * - `0px` is `0` (`0rem` inside `calc()`, where a unitless zero is invalid);
 * - a length measured in a script is written back through
 *   `src/ui/utils/cssLength.ts` (see the second ratchet below).
 */

const SRC_ROOT = join(__dirname, "..");
const PX_RE = /\b\d+(?:\.\d+)?px\b/g;

/** A path relative to `src/`, slash-separated on every platform. */
const rel = (file: string): string => relative(SRC_ROOT, file).split(sep).join("/");

/** Every match of `re` in `text`, as `line: match` (1-based line numbers). */
function sitesIn(text: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(re)) {
    const line = text.slice(0, m.index ?? 0).split("\n").length;
    out.push(`${line}: ${m[0]}`);
  }
  return out;
}

/** The remaining sites, one per line, for a failure message. */
function listSites(perFile: Map<string, string[]>): string {
  return [...perFile.entries()]
    .flatMap(([file, sites]) => sites.map((s) => `  ${rel(file)}:${s}`))
    .join("\n");
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "__tests__" || entry === "__mocks__") continue;
      yield* walk(full);
    } else if (entry.endsWith(".svelte") || entry.endsWith(".css")) {
      yield full;
    }
  }
}

/** `<digits>px` literals in a stylesheet or component, comments included. */
function countPx(text: string): number {
  return text.match(PX_RE)?.length ?? 0;
}

function countPxAcrossSrc(): { total: number; perFile: Map<string, string[]> } {
  const perFile = new Map<string, string[]>();
  let total = 0;
  for (const file of walk(SRC_ROOT)) {
    const text = readFileSync(file, "utf8");
    const n = countPx(text);
    if (n > 0) {
      perFile.set(file, sitesIn(text, PX_RE));
      total += n;
    }
  }
  return { total, perFile };
}

describe("R0.3 — CSS px-budget ratchet", () => {
  // Captured 2026-05-01 (Revision 3 baseline). Decrease only after real
  // conversion to relative units; never increase without CHANGELOG entry.
  // Bumps log:
  //   783 → 784 (R1.1 — VisualizerPane border-bottom 1px hairline).
  //   784 → 785 (R1.2 — VisualizerPane toolbar button 1px border).
  //   785 → 786 (R1.4 — VisualizerPane color-swatch 1px border).
  //   786 → 787 (R2.4 — VisualizerPane linked-from section 1px border-top).
  //   787 → 788 (R2.6 — VisualizerPane edit-input 1px border).
  //   788 → 791 (R2.2 — SubBaseTabs: bottom hairline + active inset shadow + edit-input border).
  //   791 → 792 (R3.1 — FormulaEditor shell textarea 1px border).
  //   792 → 793 (R-bug3 — GridCell focus-visible inset 2px ring for keyboard nav).
  //   793 → 794 (PARITY-001 — VisualizerPane link text-underline-offset 2px).
  //   794 → 715 (REFACTOR-404a — design-tokens.css + tokens.css comment-px scrub: pure documentation cleanup, zero behavioral change).
  //   715 → 640 (REFACTOR-404b — ColorFiltersTab + SortTab CSS migrated to rem under matryoshka principle; hairline 1px borders and accent 2px borders preserved per spec).
  //   640 → 432 (REFACTOR-404c — bulk pass: ViewToolbar/YearHeatmap/MultiDayEventStrip/FieldControl real conversion + var() radius/shadow fallbacks, box-shadow drop-shadow patterns, outline focus-rings 2px→0.125rem across 28 component files; comment scrub on DayPopup/InfiniteHorizontalCalendar/Day/AllDayEventStrip).
  //   432 → 355 (REFACTOR-404d — TimelineView/AgendaListEditor/CalendarView/ColorItem manual sweeps + extended bulk-pass: var(--radius-{s,m,l,xl}, Npx) extra fallbacks, var(--font-ui-smaller, 12px), var(--ppp-border-width-thick, 2px), var(--ppp-radius-full, 999px) and 9999px tokenized, text-underline-offset, comment scrub on // line comments, design-tokens shadow scale).
  //   355 → 332 (REFACTOR-404e — FilterGroupEditor 3px border-left, DatetimeInput/DateFormatSelector/AccordionItem spacing, BoardColumn 2px accent borders, CardList borderRadius+gap+margin, InfiniteHorizontalCalendar 2px axis borders, SettingsMenuPopover translateY(-4px), GridCell error border 2px, AgendaFilterEditor gap/padding, ColorFiltersTab swatch border 2px).
  //   332 → 301 (REFACTOR-404f — Onboarding/TabContainer/CardMetadata/Field/FileListInput/HorizontalGroup/DateInput/CreateProject/Inspector/ColumnHeader spacing; ErrorBoundary/ImagePreview layout dimensions; EventList/ColorPill/Day borderRadius; SubBaseTabs/TableView/ViewsTab/SettingsMenuTabs inset box-shadow+translateY+outline-offset; CurrentTimeLine glow shadow; TimelineView ghost border-left; token files keep 1px/2px/9999px as canonical definitions).
  //   301 → 191 (REFACTOR-403b — DateFormulaInput/FilterRow/AdvancedFilterEditor: bulk px→rem conversion of inline JS-built style strings + CSS style blocks; 1px hairlines preserved; UTF-8 BOM + Cyrillic comments verified intact).
  //   191 → 187 (TDT-12 — WidgetHost.svelte: 4 × border/border-bottom 1px solid → 0.0625rem solid).
  //   187 → 186 (#034.2a — net px reduction during popoverDropdown→FloatingPopup migration: archived popoverDropdown.ts (legacy .ts file did not count); new PopoverList.svelte uses 0.0625rem hairlines).
  //   186 → 177 (#077 slice 4 — DateFormulaInput retired its imperative inline-style portal (px borders/box-shadow/badge radii); now a thin FormulaConstructor wrapper with rem-only cell overrides).
  //   151 → 143 (#191 — the dashboard-template mechanism deleted:
  //     widgetTemplates.ts, dashboardTemplates.ts, TemplateConfirmDialog.svelte
  //     and the template rules in WidgetToolbar. Re-measured, not decremented —
  //     the architect estimated 149 from a reading of the diff and the tree said
  //     143, which is the whole reason this log says "re-measured" twice above.
  //   177 → 151 (#165 step 1 — src/lib/tokens/design-tokens.css deleted: the dead
  //     token file carried 3 px (--ppp-border-width 1px/2px, --ppp-radius-full 9999px),
  //     all of them re-declared live in tokens.css. Re-measured rather than decremented,
  //     because the ceiling had drifted 23 above the tree: a ratchet that is not the
  //     measurement cannot see a deletion, which is what let a dead file sit here.
  //   143 → 0 (R0.3b, units-r03b — measured 140 under the drifted 143, then all
  //     converted: hairlines to var(--ppp-border-width), the token itself to
  //     0.0625rem (host --border-width deferred to the user), 9999px pills to --ppp-radius-full (624.9375rem),
  //     0px to 0, the rest to rem; comments reworded. The check became exact.)
  const PX_BUDGET = 0;

  it("equals the agreed px-budget, which is zero", () => {
    const { total, perFile } = countPxAcrossSrc();
    if (total !== PX_BUDGET) {
      throw new Error(
        `px count is ${total}, budget is ${PX_BUDGET}. Remaining sites:\n${listSites(perFile)}\n\n` +
          `The plugin writes relative units only: a hairline is var(--ppp-border-width), ` +
          `a zero is 0, any other length is rem/em/% (or the --ppp-local-* scale inside ` +
          `a container). A comment that states a size in px counts too — reword it.`,
      );
    }
    expect(total).toBe(PX_BUDGET);
  });

  it("counts px literals and nothing else", () => {
    expect(countPx("border: 1px solid; margin: -1px 0.5px;")).toBe(3);
    expect(countPx("/* was 4px */ .a { gap: 0.25rem; }")).toBe(1);
    expect(countPx(".a { border: var(--ppp-border-width) solid; gap: 0.0625rem; }")).toBe(0);
    expect(countPx("const name = 'gapPx'; .rpx { }")).toBe(0);
  });

  it("names every remaining site in its failure message", () => {
    const text = ".a { border: 1px solid; }\n.b { margin: 0 2.5px; }";
    expect(sitesIn(text, PX_RE)).toEqual(["1: 1px", "2: 2.5px"]);
    const perFile = new Map([[join(SRC_ROOT, "ui", "x.svelte"), sitesIn(text, PX_RE)]]);
    expect(listSites(perFile)).toBe("  ui/x.svelte:1: 1px\n  ui/x.svelte:2: 2.5px");
  });
});

/**
 * R0.3 — script-built px ratchet
 *
 * The plugin principle is "ИСКЛЮЧИТЕЛЬНО относительные единицы" (Revision 3
 * §2.1). The CSS ratchet above reads `<digits>px` literals, so it cannot see a
 * length a script assembles at runtime: `${Math.floor(room)}px` written into a
 * custom property or an inline style is a px value all the same. ios-u1 found
 * exactly that (App.svelte's `--ppp-below-nav-h`, now rem) and added this
 * second ratchet.
 *
 * Counted, in `.ts` files and the non-`<style>` part of `.svelte` files under
 * `src` (`__tests__` and `__mocks__` skipped):
 * - every `}px` — an interpolation followed by the unit, so a template literal
 *   `translate(${x}px, ${y}px)` counts 2;
 * - a quoted `px` string literal — `'px'`, `"px"` or the same in backticks (a
 *   unit glued on by concatenation).
 * Block comments, HTML comments and `//` line comments are stripped first;
 * `://` (a URL) is not a comment.
 *
 * The legacy occurrences were converted in stage R0.3b, together with the CSS
 * literals above, and the budget is 0. A measured length (a pointer
 * coordinate, a bounding rectangle, a stored column width) is written back
 * through `src/ui/utils/cssLength.ts`: divided by the root font size of the
 * element's own document and written in rem, unrounded. SVG geometry and APIs
 * that take plain numbers keep plain numbers. The check is exact — a count
 * below the budget fails too — so the constant always equals the tree.
 */

const SCRIPT_TEMPLATE_PX_RE = /\}px\b/g;
const SCRIPT_QUOTED_PX_RE = /(['"`])px\1/g;

/**
 * Remove `/* … *\/` and `//` comments, keeping newlines. String literals are
 * tracked only so that a `//` or `/*` inside one (a URL, a `**\/*.md` glob)
 * does not start a comment; a quote left open at the end of a line (an
 * apostrophe in markup text) is closed there, so a stray one cannot swallow
 * the rest of the file.
 */
function stripScriptComments(src: string): string {
  let out = "";
  let quote: string | null = null;
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (quote !== null) {
      out += c;
      if (c === "\\" && i + 1 < src.length) {
        out += src[i + 1]!;
        i += 2;
        continue;
      }
      if (c === quote || (c === "\n" && quote !== "`")) quote = null;
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, "");
      i = stop;
      continue;
    }
    if (c === "/" && src[i + 1] === "/" && src[i - 1] !== ":") {
      const end = src.indexOf("\n", i);
      i = end === -1 ? src.length : end;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") quote = c;
    out += c;
    i++;
  }
  return out;
}

/** `match` with everything but its newlines removed, so line numbers survive. */
const blankKeepingLines = (match: string): string => match.replace(/[^\n]/g, "");

/**
 * The scanned code of one file: `.svelte` loses its `<style>` blocks and HTML
 * comments. Removed regions keep their newlines, so a reported line number is
 * the line in the file.
 */
function scriptCode(text: string, isSvelte: boolean): string {
  const body = isSvelte
    ? text
        .replace(/<style[\s>][\s\S]*?<\/style>/g, blankKeepingLines)
        .replace(/<!--[\s\S]*?-->/g, blankKeepingLines)
    : text;
  return stripScriptComments(body);
}

/** Every script-built px site in a file, as `line: match`. */
function scriptPxSites(text: string, isSvelte: boolean): string[] {
  const code = scriptCode(text, isSvelte);
  return [...sitesIn(code, SCRIPT_TEMPLATE_PX_RE), ...sitesIn(code, SCRIPT_QUOTED_PX_RE)];
}

function countScriptPx(text: string, isSvelte: boolean): number {
  return scriptPxSites(text, isSvelte).length;
}

function* walkScripts(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "__tests__" || entry === "__mocks__") continue;
      yield* walkScripts(full);
    } else if (entry.endsWith(".ts") || entry.endsWith(".svelte")) {
      yield full;
    }
  }
}

function countScriptPxAcrossSrc(): { total: number; perFile: Map<string, string[]> } {
  const perFile = new Map<string, string[]>();
  let total = 0;
  for (const file of walkScripts(SRC_ROOT)) {
    const sites = scriptPxSites(readFileSync(file, "utf8"), file.endsWith(".svelte"));
    if (sites.length > 0) {
      perFile.set(file, sites);
      total += sites.length;
    }
  }
  return { total, perFile };
}

describe("R0.3 — script-built px ratchet", () => {
  // Measured 2026-10-03 (ios-u1): 53 in 15 files, minus App.svelte's
  // `--ppp-below-nav-h`, converted to rem in the same change.
  //   52 → 0 (R0.3b, units-r03b — every site written back through
  //     src/ui/utils/cssLength.ts; Day.svelte's IntersectionObserver band became
  //     viewport percentages, the one API here that takes no rem.)
  const SCRIPT_PX_BUDGET = 0;

  it("equals the agreed script-built px budget, which is zero", () => {
    const { total, perFile } = countScriptPxAcrossSrc();
    if (total !== SCRIPT_PX_BUDGET) {
      throw new Error(
        `script-built px count is ${total}, budget is ${SCRIPT_PX_BUDGET}. Remaining sites:\n` +
          `${listSites(perFile)}\n\n` +
          "A length assembled in a script is still a px length. Write it back with " +
          "toRem/remAt from src/ui/utils/cssLength.ts (root font size of the element's " +
          "own document), or as em/% where the length is relative by nature.",
      );
    }
    expect(total).toBe(SCRIPT_PX_BUDGET);
  });

  it("names every remaining script site with its real line", () => {
    const svelte = [
      "<script>",
      "  const a = `${x}px`;",
      "</script>",
      "<style>",
      "  .a { content: 'px'; }",
      "</style>",
      "<!-- `${y}px`",
      "-->",
      "<div style:top={`${z}px`} />",
    ].join("\n");
    expect(scriptPxSites(svelte, true)).toEqual(["2: }px", "9: }px"]);
  });

  it("counts every }px, two in one translate()", () => {
    expect(countScriptPx("el.style.transform = `translate(${x}px, ${y}px)`;", false)).toBe(2);
  });

  it("counts a planted template literal ending in }px", () => {
    expect(countScriptPx("el.style.top = `${x}px`;", false)).toBe(1);
    expect(countScriptPx("<script>\n  $: h = `${x}px`;\n</script>\n<div style:height={h} />", true)).toBe(1);
  });

  it("counts a quoted px unit glued on by concatenation", () => {
    expect(countScriptPx("const a = n + 'px'; const b = n + \"px\"; const c = n + `px`;", false)).toBe(3);
  });

  it("does not count px inside a comment", () => {
    const text = [
      "// was `${x}px` before R0.3b",
      "/* el.style.top = `${y}px`; */",
      "/**",
      " * n + 'px'",
      " */",
      "const ok = 1;",
    ].join("\n");
    expect(countScriptPx(text, false)).toBe(0);
    expect(countScriptPx("<!-- `${x}px` -->\n<div />", true)).toBe(0);
  });

  it("does not count a rem unit", () => {
    expect(countScriptPx("const a = `${x}rem`; const b = n + 'rem';", false)).toBe(0);
  });

  it("does not treat a URL or a glob string as a comment", () => {
    expect(countScriptPx("const u = 'https://example.com'; el.style.top = `${x}px`;", false)).toBe(1);
    expect(countScriptPx("const g = '**/*.md'; el.style.top = `${x}px`;", false)).toBe(1);
  });

  it("does not read a <style> block as script", () => {
    expect(countScriptPx("<div />\n<style>\n  .a { content: 'px'; }\n</style>", true)).toBe(0);
  });
});
