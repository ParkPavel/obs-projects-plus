/**
 * Shared CSS traversal for the style-layer ratchets — R0.13 and R0.16.
 *
 * R0.13 grew `svelteStyles` / `stripComments` / `collectStyled` as private
 * helpers; R0.16 (#167) needs the same three over a narrower file set. Copying
 * them would put two definitions of "the CSS of this component" in the tree,
 * and the two ratchets would then disagree about what they are guarding — the
 * defect class `configScan.ts` was extracted for (#181), one layer up.
 *
 * One thing this module deliberately does NOT decide is which files are in
 * scope. R0.13 scans everything; R0.16 scans only what lives inside a declared
 * container. The scope is the rule, so it stays in the test that states it.
 */

import { readdirSync, readFileSync } from "fs";
import { join, relative, sep } from "path";

/** `src/`, resolved from this file's location rather than from the cwd. */
export const SRC_ROOT = join(__dirname, "..", "..");

/** A path relative to `src/`, slash-separated on every platform. */
export const relToSrc = (file: string): string =>
  relative(SRC_ROOT, file).split(sep).join("/");

export const readText = (file: string): string => readFileSync(file, "utf8");

/**
 * CSS text with `/* … *\/` comments removed.
 *
 * Two ratchets need this for different reasons and both were bitten by not
 * having it. R0.13's `RULE_BLOCK` captures "everything since the last brace"
 * as a selector, so a comment above a rule made that selector unmatchable.
 * R0.16 counts units, and this repo documents sizes in prose next to the rules
 * that use them — a comment reading "was 4px, now 0.25rem" is a note about a
 * size, not a size. R0.3 has the opposite convention and pays for it: comment
 * scrubs appear four times in its own bumps log.
 */
export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** Every `<style>` block's contents in a Svelte component, concatenated. */
export function svelteStyles(content: string): string {
  return [...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1] ?? "")
    .join("\n");
}

/**
 * Every `style="…"` attribute value in a Svelte component, concatenated.
 *
 * An inline style attribute is CSS that ships, and it is where this tree keeps
 * its imperative geometry (`HeaderStripsSection.svelte:414-424` sizes a drag
 * preview entirely in one). Counting only `<style>` blocks would mean a unit
 * could be moved into the markup and the budget would fall while nothing on
 * screen changed — a ratchet defeated by relocation rather than by work.
 *
 * Values are read verbatim, interpolation and all: `top:{vr.top}px` keeps its
 * literal text, which is what a unit scan wants.
 */
export function svelteStyleAttributes(content: string): string {
  return [...content.matchAll(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/g)]
    .map((m) => m[2] ?? "")
    .join("\n");
}

/** Files under `dir` whose name ends with one of `extensions`, as absolute paths. */
export function collectSourceFiles(
  dir: string,
  extensions: readonly string[],
  out: string[] = []
): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
      collectSourceFiles(full, extensions, out);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Every `.svelte` and `.css` file under `dir` as `{ file, css }`, where `css`
 * is the component's `<style>` contents or the stylesheet's whole text.
 *
 * Comments are NOT stripped here: R0.13's selector rules strip per call, and a
 * scan that wants the comments (a documentation check) would have nothing left
 * to read. Callers decide.
 */
export function collectStyled(dir: string): { file: string; css: string }[] {
  return collectSourceFiles(dir, [".svelte", ".css"]).map((full) => ({
    file: relToSrc(full),
    css: full.endsWith(".svelte")
      ? svelteStyles(readText(full))
      : readText(full),
  }));
}
