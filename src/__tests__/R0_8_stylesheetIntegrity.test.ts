import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * R0.8 — the shipped stylesheet keeps its hand-written half
 *
 * Root `styles.css` is the ONLY stylesheet Obsidian loads, and it has two
 * halves: the plugin's hand-written rules, then a generated design-token block
 * appended by `mergeCSS()` in `esbuild.config.mjs` behind a marker line.
 *
 * On 2026-08-28 the file went missing from the working tree (the same event
 * that removed `manifest.json` — see CONTEXT.md). `mergeCSS` reads a missing
 * file as the empty string, so the next production build recreated it as
 * `"\n\n" + marker + tokens`: 685 lines of layout gone, tokens intact. It was
 * committed in `2597c9f`, merged, and pushed. Nothing caught it, because none
 * of the four gates looks at the repo root — R0.3 walks `src/` only — and the
 * loss is invisible in a build log and in every Jest run.
 *
 * What it cost: `Grid.svelte` carries no `<style>` block at all and renders
 * `.projects--gallery--grid`; `BoardColumn.svelte` styles only its `-footer`
 * variants; `PopoverList.svelte` defines only the `:hover` state. Those
 * components render unstyled when the hand-written half is missing.
 *
 * So this ratchet asserts the half a build cannot regenerate. The line floor
 * may only be RAISED, never lowered to accommodate a deletion — deleting CSS
 * on purpose means deleting the rule from the list below too, in the same
 * change, with the reason in the commit message.
 */

const REPO_ROOT = join(__dirname, "..", "..");
const STYLES = join(REPO_ROOT, "styles.css");
const MARKER = "/* === GENERATED: Design Tokens (do not edit below) === */";

/** Lines of hand-written CSS before the marker. Raise only. */
const MIN_HAND_WRITTEN_LINES = 680;

/**
 * Selectors rendered by components that define NO local rule for them, so the
 * root stylesheet is their only source. Each one was verified against the
 * component's own `<style>` block when this list was written.
 */
const ORPHAN_SELECTORS: ReadonlyArray<string> = [
  ".projects--gallery--grid",
  ".projects--board--column",
  ".ppp-pop-item",
];

function readStyles(): string {
  return readFileSync(STYLES, "utf-8");
}

function handWrittenHalf(css: string): string {
  const at = css.indexOf(MARKER);
  return at === -1 ? css : css.slice(0, at);
}

describe("R0.8 — shipped stylesheet integrity", () => {
  it("styles.css exists and carries the generated marker", () => {
    expect(statSync(STYLES).isFile()).toBe(true);
    expect(readStyles()).toContain(MARKER);
  });

  it("the hand-written half survives the generated block", () => {
    const lines = handWrittenHalf(readStyles()).trimEnd().split("\n").length;
    expect(lines).toBeGreaterThanOrEqual(MIN_HAND_WRITTEN_LINES);
  });

  it("the generated block is the tail, not the whole file", () => {
    // The 2026-08-28 shape was exactly `"\n\n" + marker + tokens`. A marker
    // sitting at the top means the hand-written half is already gone, and every
    // later build will keep it gone.
    expect(readStyles().indexOf(MARKER)).toBeGreaterThan(1000);
  });

  it("every orphan selector still has a rule in the stylesheet", () => {
    const hand = handWrittenHalf(readStyles());
    const missing = ORPHAN_SELECTORS.filter((s) => !hand.includes(s));
    expect(missing).toEqual([]);
  });

  it("the orphan list is honest — those components really define no rule", () => {
    // Guards the list itself: if a component grows its own `<style>` for one of
    // these, the entry belongs in the component, not here.
    const rendered = new Map<string, string>([
      [".projects--gallery--grid", "Grid.svelte"],
      [".projects--board--column", "BoardColumn.svelte"],
      [".ppp-pop-item", "PopoverList.svelte"],
    ]);
    for (const [selector, file] of rendered) {
      const path = findComponent(file);
      expect(path).not.toBeNull();
      const source = readFileSync(path as string, "utf-8");
      const styleBlock = source.slice(source.indexOf("<style"));
      // The class may be applied in markup; what must NOT exist is a local rule
      // declaring it, which would make the root stylesheet redundant for it.
      expect(styleBlock.includes(`${selector} {`) || styleBlock.includes(`${selector}{`)).toBe(
        false
      );
    }
  });
});

function findComponent(name: string): string | null {
  const stack = [join(REPO_ROOT, "src")];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (entry === name) return full;
    }
  }
  return null;
}
