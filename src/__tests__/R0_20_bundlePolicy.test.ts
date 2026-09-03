/**
 * R0.20 — the built bundle is tracked deliberately, and never merged (#171).
 *
 * `.gitignore` excludes `main.js` and then re-includes `releases/<version>/main.js`,
 * which reads like a contradiction and is not: the root bundle is what lets a
 * user install the plugin straight from the repository, and the per-release
 * copies are the same capability for older versions. #171 measured the price of
 * that decision — 2.8 MB at the root, 13 MB under `releases/` — and the price
 * that actually hurt: an unresolvable conflict in minified output between any
 * two branches that both built.
 *
 * The fix was not to untrack anything. It was to stop git from trying to merge
 * a file nobody wrote. This pins that, because a `.gitattributes` deleted by
 * accident would restore the daily pain silently — the conflict would simply
 * come back, and nothing would say why.
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..", "..");

/** Attribute lines, comments and blanks removed. */
export function attributeRules(text: string): Array<{ pattern: string; attrs: string[] }> {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((l) => {
      const [pattern, ...attrs] = l.split(/\s+/);
      return { pattern: pattern as string, attrs };
    });
}

describe("R0.20 — the scan itself (synthetic, proves BOTH states)", () => {
  it("reads a rule and skips the prose around it", () => {
    const rules = attributeRules("# why\n\nmain.js -diff -merge\n");
    expect(rules).toEqual([{ pattern: "main.js", attrs: ["-diff", "-merge"] }]);
  });
});

describe("R0.20 — the tree", () => {
  const file = path.join(ROOT, ".gitattributes");

  it(".gitattributes exists — the fix for #171 is a file, and files get deleted", () => {
    expect(fs.existsSync(file)).toBe(true);
  });

  it("every tracked bundle is excluded from merging", () => {
    const rules = attributeRules(fs.readFileSync(file, "utf8"));
    for (const pattern of ["main.js", "styles.css", "releases/*/main.js"]) {
      const rule = rules.find((r) => r.pattern === pattern);
      expect({ pattern, found: rule !== undefined }).toEqual({ pattern, found: true });
      expect({ pattern, merge: rule?.attrs.includes("-merge") }).toEqual({ pattern, merge: true });
    }
  });

  it("the .gitignore contradiction is the deliberate one, and still reads that way", () => {
    // If the re-include disappears, older releases stop being installable from
    // the repository — which is the capability the whole arrangement exists for.
    const ignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    expect(ignore).toMatch(/^main\.js$/m);
    expect(ignore).toMatch(/^!releases\/\*\/main\.js$/m);
  });

  it("neither workflow reads the committed bundle — both build their own", () => {
    // The bundle is tracked for a human installing from the repo, not for CI.
    // If a workflow ever started depending on the committed file, a stale
    // commit would ship as a release.
    for (const wf of ["ci.yml", "release.yml"]) {
      const text = fs.readFileSync(path.join(ROOT, ".github", "workflows", wf), "utf8");
      expect({ wf, builds: /npm run build/.test(text) }).toEqual({ wf, builds: true });
    }
  });
});
