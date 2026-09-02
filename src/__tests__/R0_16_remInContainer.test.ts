/**
 * R0.16 — `rem` inside a container (#167, M-MATRYOSHKA).
 *
 * R0.3 guards the letter of the principle ("few raw px") and cannot see the
 * meaning of it. `rem` is anchored to the document ROOT, so a component sized
 * in `rem` renders identically whether it sits in a narrow widget or across
 * the full canvas — every matryoshka the same size regardless of nesting.
 * A tree can pass R0.3 with a perfect score while the principle it exists to
 * protect is entirely absent, and that is what happened: #165 measured zero
 * container-relative length units anywhere in `src/`.
 *
 * **This cannot be an absolute rule today.** #167 measured roughly two orders
 * of magnitude more `rem` than `em` across the tree; a test asserting "no
 * `rem` inside a container" would fail on the first run and be deleted or
 * neutered by the second. So it is a RATCHET, in the R0.3 shape this repo
 * already trusts: a count that may only fall, fixed by removing code and never
 * by raising the constant.
 *
 * What is new here, and what R0.3 does not have:
 *
 *   - **Scope is a rule over the tree, not a list.** A component is in scope
 *     because it renders inside a declared container root, and the two clauses
 *     below are asserted against the tree in both directions, so the scope
 *     cannot be quietly narrowed to make a failure go away.
 *   - **The allowlist is part of the test.** The ADR records that top-level
 *     popups and modals stay window-anchored on purpose; `rem` is correct
 *     there. Each exemption must be a real file AND exhibit the mechanism it
 *     claims — its own `position: fixed`, or a portal out of the tree — so it
 *     is an argument on the record rather than a convention nobody can audit.
 *   - **Comments do not count, fallbacks do.** See `remOccurrences`.
 *
 * **What it still cannot do**, stated rather than implied: containment here is
 * inferred from a directory and a declared query, not from runtime ancestry.
 * No static analysis can prove a Svelte component's ancestor chain — the ADR
 * says so, and that is precisely why #166 put the guarantee in the CASCADE and
 * left this file to measure the direction of travel.
 */

import { existsSync } from "fs";
import { join } from "path";

import {
  SRC_ROOT,
  collectSourceFiles,
  readText,
  relToSrc,
  stripCssComments,
  svelteStyleBindings,
  svelteStyles,
} from "./support/cssScan";

/**
 * Clause 1 of the scope: everything under the Dashboard view.
 *
 * Every component here renders inside one of the three container roots that
 * R0.13's `CONTAINER_ROOTS` declares — `.ppp-database-root` (`DashboardCanvas`),
 * `.ppp-database-canvas` (`WidgetGrid`) and `.ppp-widget-host` (`WidgetShell`).
 * The chain is stated by name in `ADR_MATRYOSHKA_SIZING_2026-09-02.md` §Q3 and
 * asserted to exist by R0.13, so this prefix is a consequence of the tree's
 * structure rather than a hand-picked set of files.
 */
const CONTAINER_SCOPE_PREFIX = "ui/views/Dashboard/";

/**
 * Clause 2: any component that writes an `@container` query in its own styles.
 *
 * Such a component has already declared that its layout is decided by the box
 * that holds it. Letting it then take its SIZE from the document root is the
 * exact half-implementation #165 measured: the container decides breakpoints
 * and nothing else. This clause is what pulls the three Calendar components
 * into scope, and it is why the rule is not simply "the Dashboard directory".
 */
const CONTAINER_QUERY = /@container\b/;

/**
 * Surfaces where `rem` is correct, because they are anchored to the WINDOW and
 * not to any container — the kinship break the ADR records as load-bearing
 * (`ADR_MATRYOSHKA_SIZING_2026-09-02.md`, "Explicitly not guaranteed").
 *
 * - `TemplateConfirmDialog` is rendered by `DashboardCanvas` OUTSIDE
 *   `.ppp-database-root` on purpose, so its `position: fixed` scrim resolves
 *   against the viewport rather than against the scrollable dashboard. Its own
 *   style block says so. It matches the prefix above, so without this entry it
 *   would be counted; the test below asserts exactly that, which is what keeps
 *   this list from being decorative.
 * - `FloatingPopup` portals its desktop branch to `<body>`, which is why it has
 *   no container ancestor at all. It is out of scope today by both clauses;
 *   naming it here means it stays exempt if it ever gains an `@container`
 *   query, instead of arriving in the budget as a mysterious jump.
 *
 * Known and deliberately NOT exempted: `DashboardBlockPalette`, `WidgetToolbar`
 * and `BlockFilterBar` each render an in-container trigger AND a portalled
 * `FloatingPopup` body from one file. Exempting a whole file for the sake of
 * its popup half would exempt the half that really is inside a widget. They
 * stay counted, and the way to reduce them is to split the portalled content
 * into its own component — which is work, which is what a ratchet is for.
 */
const WINDOW_ANCHORED = [
  "ui/views/Dashboard/TemplateConfirmDialog.svelte",
  "ui/components/FloatingPopup/FloatingPopup.svelte",
] as const;

/**
 * Measured on the tree at `09fef14`, not chosen. A ratchet whose ceiling was
 * picked above the measurement cannot see a deletion — R0.3 drifted 23 above
 * its own tree that way and a dead token file sat under the gap unnoticed
 * until #165. Lower this only by removing `rem` from a component that lives
 * inside a container; never raise it.
 *
 * Bumps log:
 *   806 — initial measurement, #167, 2026-09-02 (56 files in scope).
 *   806 → 807 (#167, Codex audit, 2026-09-02) — NOT new code and NOT a
 *     relaxation: the first reader saw only quoted `style="…"`, so
 *     `StatsCard.svelte:68` had been shipping `0.1875rem` through `style={…}`
 *     the whole time. Re-measured with the reader fixed rather than
 *     incremented, for the same reason #165 re-measured R0.3: a ceiling that
 *     is not the measurement cannot see what it never read.
 */
const REM_IN_CONTAINER_BUDGET = 807;

/** A length in `rem`. `0.5rem`, `.5rem` and `1.5rem` all count once. */
const REM_LENGTH = /\b\d*\.?\d+rem\b/g;

/** A read of the level-2, container-derived scale. */
const LOCAL_SCALE_READ = /var\(\s*--ppp-local-[a-zA-Z0-9_-]*/g;

/**
 * The CSS a component ships: its `<style>` blocks with comments removed, plus
 * every inline style binding in all four of its forms.
 *
 * Comments are stripped because this repo documents sizes in prose beside the
 * rules that use them ("was 4px, now 0.25rem"), and a note about a size is not
 * a size. R0.3 counts them and pays for it — four separate "comment scrub"
 * entries in its bumps log are conversions that moved no pixel on screen.
 *
 * Inline styles are included because they are CSS that ships. Counting only
 * `<style>` would let a unit be relocated into the markup, dropping the budget
 * while changing nothing — a ratchet defeated by moving code rather than by
 * removing it. Reading only ONE of the four inline forms was the same hole one
 * layer down, and the Codex audit of #167 found two live components in it.
 */
function shippedCss(componentText: string): string {
  return `${stripCssComments(svelteStyles(componentText))}\n${svelteStyleBindings(componentText)}`;
}

/**
 * How many `rem` lengths `css` contains.
 *
 * A fallback COUNTS: `var(--ppp-space-sm, 0.375rem)` renders at `0.375rem`
 * whenever the token is absent, so it is a root-anchored size like any other.
 * This is the strict reading on purpose — the lenient one would let the whole
 * budget be paid off by wrapping each literal in a `var()` that resolves to
 * the same number.
 */
function remOccurrences(css: string): number {
  return (css.match(REM_LENGTH) ?? []).length;
}

type ScopedComponent = { file: string; css: string };

/** Every `.svelte` under `src/`, as `{ file, text }` relative to `src/`. */
function allComponents(): { file: string; text: string }[] {
  return collectSourceFiles(SRC_ROOT, [".svelte"]).map((full) => ({
    file: relToSrc(full),
    text: readText(full),
  }));
}

/** Whether a component is in scope by clause 1 or clause 2. */
function isContainerScoped(file: string, text: string): boolean {
  if (file.startsWith(CONTAINER_SCOPE_PREFIX)) return true;
  return CONTAINER_QUERY.test(stripCssComments(svelteStyles(text)));
}

/** The components this ratchet counts: in scope by either clause, minus the allowlist. */
function containerScopedComponents(): ScopedComponent[] {
  return allComponents()
    .filter(({ file, text }) => isContainerScoped(file, text))
    .filter(
      ({ file }) => !(WINDOW_ANCHORED as readonly string[]).includes(file)
    )
    .map(({ file, text }) => ({ file, css: shippedCss(text) }));
}

/** `[file, count]` for every component carrying at least one `rem`, worst first. */
function offenders(components: readonly ScopedComponent[]): [string, number][] {
  return components
    .map(({ file, css }): [string, number] => [file, remOccurrences(css)])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
}

const total = (components: readonly ScopedComponent[]): number =>
  components.reduce((sum, { css }) => sum + remOccurrences(css), 0);

describe("R0.16 — rem inside a container (#167)", () => {
  it("counts sizes, not prose, and counts a fallback as a size", () => {
    // Synthetic, because the tree-wide number below is a single integer and a
    // wrong matcher would produce a plausible one. Both directions are proven
    // here or the count means nothing.
    expect(remOccurrences("padding: 0.5rem;")).toBe(1);
    expect(remOccurrences("margin: .5rem 1.5rem;")).toBe(2);
    // A fallback is a size: this is the strict reading, stated in the docstring.
    expect(remOccurrences("gap: var(--ppp-space-sm, 0.375rem);")).toBe(1);
    // Words are not units.
    expect(remOccurrences("/* remove this */ transform: translateX(0);")).toBe(
      0
    );
    // …and `em`, `%` and container units are exactly what this rule wants.
    expect(remOccurrences("padding: 0.5em; width: 50%; font-size: 2cqi;")).toBe(
      0
    );
  });

  it("does not count a size that only appears in a comment", () => {
    // The trap R0.3 walks into: its bumps log carries four "comment scrub"
    // entries, each a conversion that moved nothing on screen. A ratchet that
    // can be paid down by editing prose is measuring the prose.
    const documented =
      "<style>/* was 4px, i.e. 0.25rem */\n.x { padding: 0.5em; }</style>";
    expect(remOccurrences(shippedCss(documented))).toBe(0);
    const real =
      "<style>/* was 4px, i.e. 0.25rem */\n.x { padding: 0.25rem; }</style>";
    expect(remOccurrences(shippedCss(real))).toBe(1);
  });

  it("counts all four inline style forms as shipped CSS", () => {
    // Otherwise the budget falls by relocation. `HeaderStripsSection.svelte`
    // sizes a drag preview entirely in a quoted attribute — and the first
    // version of this reader saw ONLY that one form, which is how two live
    // components sat outside the count (Codex audit of #167).
    const inline =
      '<div style="top: 1rem; border-radius: 0.25rem;"></div><style>.x { gap: 0; }</style>';
    expect(remOccurrences(shippedCss(inline))).toBe(2);
    expect(
      remOccurrences(shippedCss("<div style='padding: 0.5em'></div>"))
    ).toBe(0);
    // Braced expression, including a template literal carrying its own `{}`.
    expect(
      remOccurrences(shippedCss('<div style={ok ? "gap: 0.75rem" : ""}></div>'))
    ).toBe(1);
    expect(
      remOccurrences(
        shippedCss("<div style={`border-left: 0.1875rem solid ${c}`}></div>")
      )
    ).toBe(1);
    // Directive form, quoted and braced.
    expect(remOccurrences(shippedCss('<div style:top="1.5rem"></div>'))).toBe(
      1
    );
    expect(remOccurrences(shippedCss("<div style:gap={'2rem'}></div>"))).toBe(
      1
    );
    // The stated boundary: an interpolated NUMBER carries no literal digits, so
    // the counter cannot see it. It IS read — the limit belongs to the regex,
    // not to the reader's coverage — and this records which of the two it is.
    expect(
      svelteStyleBindings('<div style:top="{topPosition}rem"></div>')
    ).toContain("{topPosition}rem");
    expect(
      remOccurrences(shippedCss('<div style:top="{topPosition}rem"></div>'))
    ).toBe(0);
  });

  it("reads the two components the first version of this reader missed", () => {
    // Tree-based regression for the audit finding, not a synthetic restatement.
    // If either shipped form stops being read these go to zero and say so,
    // which is what "the budget cannot be paid by relocation" means in practice
    // rather than in a docstring.
    const braced = readText(
      join(SRC_ROOT, "ui/views/Dashboard/widgets/Stats/StatsCard.svelte")
    );
    expect(remOccurrences(svelteStyleBindings(braced))).toBeGreaterThan(0);

    const directives = readText(
      join(
        SRC_ROOT,
        "ui/views/Calendar/components/Calendar/AllDayEventStrip.svelte"
      )
    );
    expect(svelteStyleBindings(directives)).toMatch(/\{STRIP_HEIGHT_REM\}rem/);
  });

  it("no stylesheet or script module hides a size inside the container scope", () => {
    // The other half of the audit's coverage question. `shippedCss` reads
    // `.svelte` only, which is sound just while nothing else under the scope
    // can carry a size — so assert that instead of assuming it.
    const stylesheets = collectSourceFiles(SRC_ROOT, [".css"])
      .map(relToSrc)
      .filter((file) => file.startsWith(CONTAINER_SCOPE_PREFIX));
    expect(stylesheets).toEqual([]);

    // `ui/tokens/tokens.css` is the one stylesheet in the tree (R0.13 asserts
    // exactly that) and it carries the LEVEL-1 scale at `:root` — root-anchored
    // on purpose, and correctly outside this scope.
    expect(collectSourceFiles(SRC_ROOT, [".css"]).map(relToSrc)).toEqual([
      "ui/tokens/tokens.css",
    ]);

    const scripted = collectSourceFiles(SRC_ROOT, [".ts"])
      .map((full) => ({ file: relToSrc(full), text: readText(full) }))
      .filter(({ file }) => file.startsWith(CONTAINER_SCOPE_PREFIX))
      .map(
        ({ file, text }) =>
          `${file} → ${remOccurrences(stripCssComments(text))}`
      )
      .filter((entry) => !entry.endsWith(" → 0"));
    expect(scripted).toEqual([]);
  });

  it("scopes itself by a rule over the tree, in both directions", () => {
    // The scope is the rule. If it were a hand-maintained file list, a failing
    // component could be removed from the list instead of from the budget —
    // the shape of a ratchet that passes by matching nothing (R0.4's lesson).
    const scoped = new Set(containerScopedComponents().map(({ file }) => file));
    const exempt = new Set<string>(WINDOW_ANCHORED);

    const missedByPrefix = allComponents()
      .filter(({ file }) => file.startsWith(CONTAINER_SCOPE_PREFIX))
      .filter(({ file }) => !scoped.has(file) && !exempt.has(file))
      .map(({ file }) => file);
    expect(missedByPrefix).toEqual([]);

    const missedByQuery = allComponents()
      .filter(({ text }) =>
        CONTAINER_QUERY.test(stripCssComments(svelteStyles(text)))
      )
      .filter(({ file }) => !scoped.has(file) && !exempt.has(file))
      .map(({ file }) => file);
    expect(missedByQuery).toEqual([]);

    // Both clauses have to be doing work, or one of them is dead weight that
    // could be deleted without any test noticing.
    const byQueryOnly = allComponents()
      .filter(
        ({ file, text }) =>
          !file.startsWith(CONTAINER_SCOPE_PREFIX) &&
          isContainerScoped(file, text)
      )
      .map(({ file }) => file);
    expect(byQueryOnly.length).toBeGreaterThan(0);
    expect(scoped.size).toBeGreaterThan(byQueryOnly.length);
  });

  it("every window-anchored exemption is a real file, and the list is load-bearing", () => {
    // An allowlist entry that matches nothing is an exemption nobody can audit
    // and a typo nobody can see.
    const missing = WINDOW_ANCHORED.filter(
      (file) => !existsSync(join(SRC_ROOT, file))
    );
    expect(missing).toEqual([]);

    // Existence alone is a weak bar, and the Codex audit of #167 said so: a
    // busy in-container component could be parked here and the budget
    // rebaselined lower with nothing to object. So an exemption must EXHIBIT
    // the mechanism it claims — its own styles detach it from the flow
    // (`position: fixed`), or it portals itself out of the tree. That is as far
    // as a static check can go: the ADR is explicit that no static analysis can
    // prove a Svelte component's runtime ancestry, which is exactly why #166
    // put the guarantee in the cascade instead. This narrows the hole; it does
    // not close it, and the honest place to say so is here.
    const unproven = WINDOW_ANCHORED.filter((file) => {
      const text = readText(join(SRC_ROOT, file));
      const detached = /position:\s*fixed/.test(
        stripCssComments(svelteStyles(text))
      );
      const portalled = /\buse:portal\b|FloatingPopup/.test(text);
      return !detached && !portalled;
    });
    expect(unproven).toEqual([]);

    // And it stays short. A list that grows is the shape this failure takes.
    expect(WINDOW_ANCHORED.length).toBeLessThanOrEqual(2);

    // `TemplateConfirmDialog` is inside the prefix, so the allowlist is what
    // keeps it out. If it ever stopped being window-anchored, this assertion
    // is where the exemption would have to be re-argued.
    const dialog = "ui/views/Dashboard/TemplateConfirmDialog.svelte";
    expect(WINDOW_ANCHORED).toContain(dialog);
    expect(dialog.startsWith(CONTAINER_SCOPE_PREFIX)).toBe(true);
    expect(containerScopedComponents().map(({ file }) => file)).not.toContain(
      dialog
    );
    // …and it really does carry the units this exempts, so the entry is not free.
    expect(
      remOccurrences(shippedCss(readText(join(SRC_ROOT, dialog))))
    ).toBeGreaterThan(0);
  });

  it("the container-derived scale is read somewhere inside the scope", () => {
    // Direction, not just level. The budget above says how much root-anchored
    // sizing is left; this says the replacement exists and is in use. Zero here
    // would mean the tree is being asked to lower a number with nothing to
    // lower it toward — the rejected option (D) in the ADR.
    const reads = containerScopedComponents().reduce(
      (sum, { css }) => sum + (css.match(LOCAL_SCALE_READ) ?? []).length,
      0
    );
    expect(reads).toBeGreaterThan(0);
  });

  it("stays within the rem-in-container budget", () => {
    const components = containerScopedComponents();
    const count = total(components);
    if (count > REM_IN_CONTAINER_BUDGET) {
      const reads = components.reduce(
        (sum, { css }) => sum + (css.match(LOCAL_SCALE_READ) ?? []).length,
        0
      );
      const top = offenders(components)
        .slice(0, 10)
        .map(([file, n]) => `  ${n.toString().padStart(4)}  ${file}`)
        .join("\n");
      throw new Error(
        `rem-in-container budget exceeded: ${count} > ${REM_IN_CONTAINER_BUDGET} ` +
          `(${reads} container-scale reads)\nTop offenders:\n${top}\n\n` +
          `Inside a declared container a size must come from the container: use ` +
          `em / % / cq* units or the --ppp-local-* scale. If this is a deliberate ` +
          `conversion that REDUCES the count, lower REM_IN_CONTAINER_BUDGET. ` +
          `If the surface is genuinely window-anchored (a modal or a portalled ` +
          `popup), add it to WINDOW_ANCHORED with the reason.`
      );
    }
    expect(count).toBeLessThanOrEqual(REM_IN_CONTAINER_BUDGET);
  });

  it("fails on a single rem planted in a real Dashboard widget", () => {
    // Tree-based regression proof: the shipped text of a component that really
    // is inside `.ppp-widget-host`, with one declaration appended. An all-clear
    // scan is otherwise indistinguishable from a broken one.
    const components = containerScopedComponents();
    const baseline = total(components);
    const target = "ui/views/Dashboard/widgets/WidgetShell.svelte";
    const found = components.find(({ file }) => file === target);
    expect(found).toBeDefined();

    const planted = components.map((c) =>
      c.file === target
        ? { ...c, css: `${c.css}\n.ppp-planted { gap: 0.75rem; }` }
        : c
    );
    expect(total(planted)).toBe(baseline + 1);
    // One added declaration must break the budget. Together with the `<=`
    // assertion above this pins the ceiling TO the measurement, which is the
    // one thing R0.3 lacks: its budget drifted 23 above its own tree, and a
    // dead token file sat inside the gap until #165 found it by hand. Here a
    // real removal has to be banked by lowering the constant in the same
    // commit, or this assertion says so.
    expect(baseline + 1).toBeGreaterThan(REM_IN_CONTAINER_BUDGET);

    // The failure has to name the file, or the next lowering has nowhere to start.
    const plantedCount = offenders(planted).find(
      ([file]) => file === target
    )?.[1];
    expect(plantedCount).toBe(remOccurrences(found?.css ?? "") + 1);
  });
});
