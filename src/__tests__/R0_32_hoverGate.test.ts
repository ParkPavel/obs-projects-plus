/**
 * R0.32 — hover is gated to the pointers that have it (ios-t1).
 *
 * A phone has no hover. A rule that hides a control until `:hover` hides it
 * from a finger for good, and a rule that only decorates on `:hover` sticks
 * after a tap, because a touch browser leaves the last tapped element hovered.
 * The audit behind ios-t1 (390x844, coarse pointer) found table row actions,
 * the view-tab menu and the board column actions at opacity 0 or 0.3 for
 * exactly this reason, and counted the `:hover` rules that apply to every
 * pointer: 272 lines in 96 files.
 *
 * The fix is a gate: `@media (hover: hover) and (pointer: fine)`. Inside it a
 * hover rule reaches the mouse and nothing else, so desktop behaviour does not
 * move while touch stops inheriting it. BOTH features are required —
 * `hover: hover` alone admits a stylus or a mouse-like touch screen that reports hover,
 * and `pointer: fine` alone admits a pen without hover.
 *
 * ## Why a budget and not a ban
 *
 * Migrating every rule at once is a stacking change across ~100 components with
 * no way to check it but by looking at each surface, and most of those rules
 * decorate controls a phone user does not need. So this ratchets the count the
 * way R0.19 ratchets raw `z-index`: measured, may only fall, lowered by gating
 * a rule and never by raising the constant. The components ios-t1 migrated are
 * pinned at zero separately, so the batch cannot quietly come undone.
 *
 * ## What counts
 *
 * A `:hover` in a selector of a `<style>` block (or a stylesheet) under
 * `src/ui/`, unless one of the `@media` blocks enclosing it names both
 * `(hover: hover)` and `(pointer: fine)`. Comments do not count. Each
 * occurrence counts once, so `a:hover, b:hover` is two.
 */

import { existsSync } from "fs";
import { join } from "path";

import {
  SRC_ROOT,
  collectSourceFiles,
  readText,
  relToSrc,
  stripCssComments,
  svelteStyles,
} from "./support/cssScan";

/**
 * Ungated `:hover` selectors left under `src/ui/`.
 *
 * MEASURED, not chosen. It may only fall, and it falls by moving a rule behind
 * the gate — never by editing this number upward.
 *
 * Bumps log:
 *   270 — the tree at 04f776f before ios-t1, counted by this file's reader
 *     (the audit counted source lines: those include three `on:hover=` event
 *     directives in markup and a comment, and miss one line with two selectors).
 *   217 — ios-t1 gated every hover rule of the thirteen components it touched
 *     (see `MIGRATED`): 270 − 53.
 *   217 — unchanged when the gate test went per-branch (Codex audit of
 *     ios-t1): a media query list is a gate only if every query in it is. No
 *     gate in the tree is a list, so nothing moved; recorded because a
 *     re-measurement that returns the same value is still evidence.
 */
const UNGATED_HOVER_BUDGET = 217;

/**
 * Components ios-t1 migrated. Each must carry no ungated `:hover` at all: a
 * hover rule added to one of them later has to be written behind the gate.
 */
const MIGRATED = [
  "ui/views/Dashboard/widgets/DatabaseCall/TableRow.svelte",
  "ui/views/Dashboard/widgets/ViewTabBar.svelte",
  "ui/components/FilterPanel/FilterPanel.svelte",
  "ui/modals/components/EditNote.svelte",
  "ui/components/Navigation/SettingsMenu/SettingsMenuPopover.svelte",
  "ui/components/Navigation/SettingsMenu/SettingsMenuTabs.svelte",
  "ui/components/Navigation/SettingsMenu/tabs/ViewConfigTab.svelte",
  "ui/components/Navigation/SettingsMenu/tabs/ViewsTab.svelte",
  "ui/views/Board/components/Board/ColumnHeader.svelte",
  "ui/views/Board/components/Board/Board.svelte",
  "ui/views/Board/components/Board/CardList.svelte",
  "ui/views/Calendar/components/Calendar/HeaderStripsSection.svelte",
  "ui/views/Dashboard/widgets/WidgetShell.svelte",
] as const;

const UI_ROOT = join(SRC_ROOT, "ui");

/** `:hover` as a pseudo-class; `class:hovered` and `--hovered` are not it. */
const HOVER = /:hover(?![\w-])/g;

/** The queries of a media query list, split on commas outside parentheses. */
export function mediaQueryBranches(list: string): string[] {
  const branches: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      branches.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  branches.push(current.trim());
  return branches;
}

/**
 * Whether an at-rule prelude is the gate: a media query list in which EVERY
 * query names both features. A list matches when any one query matches, so a
 * single coarse branch
 * (`(pointer: coarse), (hover: hover) and (pointer: fine)`)
 * lets the rule reach a finger — that list is not a gate.
 */
export function isFineHoverGate(prelude: string): boolean {
  const media = /^@media\b/i.exec(prelude);
  if (!media) return false;
  const branches = mediaQueryBranches(prelude.slice(media[0].length));
  return branches.every(
    (query) =>
      query !== "" &&
      /\(\s*hover\s*:\s*hover\s*\)/i.test(query) &&
      /\(\s*pointer\s*:\s*fine\s*\)/i.test(query)
  );
}

/**
 * Every ungated `:hover` in `css`, one entry per occurrence, reported as the
 * selector it stands in.
 *
 * A brace walk rather than a regex over rules, because the gate is a property
 * of the ENCLOSING blocks: a rule is gated when any `@media` around it is the
 * gate, however deep it sits. A selector prelude is the text since the last
 * `{`, `}` or `;`, which also skips declarations that precede a nested rule.
 */
export function ungatedHovers(css: string): string[] {
  const found: string[] = [];
  const enclosing: string[] = [];
  let prelude = "";
  for (const ch of stripCssComments(css)) {
    if (ch === "{") {
      const head = prelude.trim().replace(/\s+/g, " ");
      prelude = "";
      if (!head.startsWith("@") && !enclosing.some(isFineHoverGate)) {
        const occurrences = (head.match(HOVER) ?? []).length;
        for (let i = 0; i < occurrences; i++) found.push(head);
      }
      enclosing.push(head);
    } else if (ch === "}") {
      enclosing.pop();
      prelude = "";
    } else if (ch === ";") {
      prelude = "";
    } else {
      prelude += ch;
    }
  }
  return found;
}

type Styled = { file: string; css: string };

/** Every component and stylesheet under `src/ui/`, as its CSS. */
function styledUi(): Styled[] {
  return collectSourceFiles(UI_ROOT, [".svelte", ".css"]).map((full) => ({
    file: relToSrc(full),
    css: full.endsWith(".svelte") ? svelteStyles(readText(full)) : readText(full),
  }));
}

const total = (styled: readonly Styled[]): number =>
  styled.reduce((sum, { css }) => sum + ungatedHovers(css).length, 0);

function worst(styled: readonly Styled[], n: number): string {
  return styled
    .map(({ file, css }): [string, number] => [file, ungatedHovers(css).length])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([file, count]) => `  ${count.toString().padStart(4)}  ${file}`)
    .join("\n");
}

describe("R0.32 — the reader (synthetic, proves both states)", () => {
  it("counts a hover rule that applies to every pointer", () => {
    expect(ungatedHovers(".a:hover { color: red; }")).toEqual([".a:hover"]);
    expect(ungatedHovers(".a:hover, .b:hover .c { color: red; }")).toHaveLength(2);
    expect(ungatedHovers(":global(.host:hover) .btn { opacity: 1; }")).toHaveLength(1);
  });

  it("does not count a rule behind the gate, however deep", () => {
    expect(
      ungatedHovers("@media (hover: hover) and (pointer: fine) { .a:hover { color: red; } }")
    ).toEqual([]);
    expect(
      ungatedHovers(
        "@media (pointer: fine) and (hover: hover) { @supports (display: grid) { .a:hover { x: 1; } } }"
      )
    ).toEqual([]);
    expect(ungatedHovers("@media (hover:hover) and (pointer:fine){.a:hover{x:1}}")).toEqual([]);
  });

  it("requires both features of the gate", () => {
    expect(ungatedHovers("@media (hover: hover) { .a:hover { x: 1; } }")).toHaveLength(1);
    expect(ungatedHovers("@media (pointer: fine) { .a:hover { x: 1; } }")).toHaveLength(1);
    expect(ungatedHovers("@media (any-hover: hover) and (pointer: fine) { .a:hover { x: 1; } }")).toHaveLength(1);
    expect(ungatedHovers("@media (pointer: coarse) { .a:hover .b { x: 1; } }")).toHaveLength(1);
  });

  it("treats a media query list as a gate only when every query is gated", () => {
    // A list matches when ANY of its queries matches, so one coarse branch
    // carries the rule to a finger (Codex audit of ios-t1).
    expect(
      ungatedHovers("@media (pointer: coarse), (hover: hover) and (pointer: fine) { .a:hover { x: 1; } }")
    ).toHaveLength(1);
    expect(
      ungatedHovers("@media (hover: hover) and (pointer: fine), print { .a:hover { x: 1; } }")
    ).toHaveLength(1);
    expect(
      ungatedHovers(
        "@media (hover: hover) and (pointer: fine) and (min-width: 30em), (hover: hover) and (pointer: fine) { .a:hover { x: 1; } }"
      )
    ).toEqual([]);
    expect(mediaQueryBranches(" (a), (b) and (c)")).toEqual(["(a)", "(b) and (c)"]);
  });

  it("leaves the gate when its block closes", () => {
    const css =
      "@media (hover: hover) and (pointer: fine) { .a:hover { x: 1; } }\n.b:hover { x: 1; }";
    expect(ungatedHovers(css)).toEqual([".b:hover"]);
  });

  it("does not count prose, declarations or look-alikes", () => {
    expect(ungatedHovers("/* .a:hover reveals */ .a { x: 1; }")).toEqual([]);
    expect(ungatedHovers(".a { transition: opacity 1s; } .b--hovered { x: 1; }")).toEqual([]);
    expect(ungatedHovers(".a { x: 1; .b:hover { y: 2; } }")).toEqual([".b:hover"]);
  });
});

describe("R0.32 — the tree", () => {
  const styled = styledUi();

  it("reads the tree it claims to read", () => {
    // A wrong root would make every assertion below pass on nothing.
    expect(styled.length).toBeGreaterThan(150);
    expect(styled.some(({ file }) => file === "ui/tokens/tokens.css")).toBe(true);
    expect(total(styled)).toBeGreaterThan(0);
  });

  it("every migrated component exists and carries no ungated hover", () => {
    const missing = MIGRATED.filter((file) => !existsSync(join(SRC_ROOT, file)));
    expect(missing).toEqual([]);
    const offenders = styled
      .filter(({ file }) => (MIGRATED as readonly string[]).includes(file))
      .flatMap(({ file, css }) => ungatedHovers(css).map((sel) => `${file} → ${sel}`));
    expect(offenders).toEqual([]);
  });

  it("ungated hover rules stay within the budget, which may only fall", () => {
    const count = total(styled);
    if (count > UNGATED_HOVER_BUDGET) {
      throw new Error(
        `ungated :hover budget exceeded: ${count} > ${UNGATED_HOVER_BUDGET}\n` +
          `Top offenders:\n${worst(styled, 10)}\n\n` +
          `Write a new hover rule inside @media (hover: hover) and (pointer: fine), and ` +
          `give a control it reveals an explicit (pointer: coarse) rule that keeps it visible.`
      );
    }
    expect(count).toBeLessThanOrEqual(UNGATED_HOVER_BUDGET);
  });

  it("the budget is the measurement — a gated rule has to be banked", () => {
    // R0.3's defect, avoided: a ceiling above the tree cannot see a migration.
    const count = total(styled);
    if (count < UNGATED_HOVER_BUDGET) {
      throw new Error(
        `ungated :hover count fell to ${count}; lower UNGATED_HOVER_BUDGET ` +
          `(${UNGATED_HOVER_BUDGET}) to ${count} in the same change.`
      );
    }
    expect(count).toBe(UNGATED_HOVER_BUDGET);
  });

  it("one planted hover rule in a real component breaks the budget", () => {
    const target = "ui/views/Dashboard/widgets/WidgetShell.svelte";
    expect(styled.some(({ file }) => file === target)).toBe(true);
    const planted = styled.map((s) =>
      s.file === target ? { ...s, css: `${s.css}\n.ppp-planted:hover { opacity: 1; }` } : s
    );
    expect(total(planted)).toBe(total(styled) + 1);
    expect(total(planted)).toBeGreaterThan(UNGATED_HOVER_BUDGET);
  });
});
