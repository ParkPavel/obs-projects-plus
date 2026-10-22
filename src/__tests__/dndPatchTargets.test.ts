/**
 * i3 — the svelte-dnd-action patches in esbuild.config.mjs are plain string
 * replacements. If an upgrade changes the library's text, a replacement stops
 * matching and the build quietly ships the old behaviour — for `dragHandle`,
 * the subscriber leak that hung iPhone and PC on repeated column drags. Every
 * patch target must still appear, once, in the file the bundler reads.
 */
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..", "..");
const config = readFileSync(join(ROOT, "esbuild.config.mjs"), "utf8");
const library = readFileSync(join(ROOT, "node_modules", "svelte-dnd-action", "dist", "index.mjs"), "utf8");

/** The keys of the replace plugin's `values` for svelte-dnd-action. */
function patchTargets(): string[] {
  const block = /include:\s*\/svelte-dnd-action[\s\S]*?values:\s*\{([\s\S]*?)\n\s{6}\},/.exec(config)?.[1] ?? "";
  const keys: string[] = [];
  for (const m of block.matchAll(/^\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'):/gm)) {
    keys.push(m[1]!.startsWith('"') ? JSON.parse(m[1]!) as string : m[1]!.slice(1, -1).replace(/\\'/g, "'"));
  }
  return keys;
}

describe("svelte-dnd-action bundle patches", () => {
  const targets = patchTargets();

  it("finds the patches, the dragHandle leak fix among them", () => {
    expect(targets).toEqual(expect.arrayContaining([
      "isItemsDragDisabled.subscribe(function (disabled) {",
      'handle.removeEventListener("keydown", handleKeyDown);',
    ]));
  });

  it.each(targets.filter((t) => !t.endsWith(".")))("the library still contains %s", (target) => {
    expect(library.includes(target)).toBe(true);
  });

  it("the leak-fix targets occur exactly once, so the fix lands where it is meant to", () => {
    for (const t of ["isItemsDragDisabled.subscribe(function (disabled) {", 'handle.removeEventListener("keydown", handleKeyDown);']) {
      expect(library.split(t).length - 1).toBe(1);
    }
  });
});
