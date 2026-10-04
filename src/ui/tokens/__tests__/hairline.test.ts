/**
 * thumb-hairline (user decision 2B, 2026-10-04): plugin hairlines follow the
 * host.
 *
 * Obsidian and themes set `--border-width` (half a device unit on a dense
 * screen); the plugin's `--ppp-border-width` reads it, with 0.0625rem as the
 * value outside a host, and the thick stroke is twice the hairline. Obsidian
 * declares the variable on `body`, and a `var()` inside a custom property is
 * resolved where the property is declared, so the pair must be declared on
 * `body` as well as `:root` — otherwise only the fallback is ever read.
 *
 * The shipped root `styles.css` (R0.3 walks `src/` only, so nothing else reads
 * it) writes its borders through the token, never as a fixed length.
 */

import { readFileSync } from "fs";
import { join } from "path";

import { SRC_ROOT, stripCssComments } from "src/__tests__/support/cssScan";

const TOKENS = stripCssComments(readFileSync(join(SRC_ROOT, "ui", "tokens", "tokens.css"), "utf8"));
const STYLES = stripCssComments(readFileSync(join(SRC_ROOT, "..", "styles.css"), "utf8"));
const MARKER = "/* === GENERATED: Design Tokens (do not edit below) === */";
const HAND_WRITTEN = (() => {
  const raw = readFileSync(join(SRC_ROOT, "..", "styles.css"), "utf8");
  const at = raw.indexOf(MARKER);
  return stripCssComments(at === -1 ? raw : raw.slice(0, at));
})();

/** `--name: value` pairs declared in a rule body, name → value (last wins). */
function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(m[1] as string, (m[2] as string).trim());
  return out;
}

/** The bodies of every top-level rule whose selector is exactly `selector`. */
function ruleBodies(css: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^{}]*)\\}`, "g"))].map((m) => m[1] as string);
}

/** Border-line declarations (`border`, `border-top`, `border-width`, …), as `property: value`. */
function borderDeclarations(css: string): string[] {
  return [...css.matchAll(/(?<![\w-])(border(?:-[a-z]+)*)\s*:\s*([^;{}]+)/g)]
    .filter((m) => !/radius|image|spacing|collapse|color|style/.test(m[1] as string))
    .map((m) => `${m[1]}: ${(m[2] as string).trim()}`);
}

const FIXED_LENGTH = /\b\d+(?:\.\d+)?px\b/;

describe("thumb-hairline — the token follows the host", () => {
  const HAIRLINE = "var(--border-width, 0.0625rem)";
  const THICK = /^calc\(2 \* var\(--ppp-border-width\)\)$/;

  it(":root declares the hairline from --border-width with the 0.0625rem fallback, thick as twice it", () => {
    const root = declarations(ruleBodies(TOKENS, ":root")[0] ?? "");
    expect(root.get("--ppp-border-width")).toBe(HAIRLINE);
    expect(root.get("--ppp-border-width-thick")).toMatch(THICK);
  });

  it("body declares the same pair, where Obsidian's --border-width is visible", () => {
    const body = ruleBodies(TOKENS, "body").map(declarations);
    const hairline = body.find((d) => d.has("--ppp-border-width"));
    expect(hairline?.get("--ppp-border-width")).toBe(HAIRLINE);
    expect(hairline?.get("--ppp-border-width-thick")).toMatch(THICK);
  });

  it("the reader sees a rule it is pointed at, and not one that is absent", () => {
    // Synthetic, so a broken matcher cannot pass the two checks above by
    // finding nothing.
    expect(ruleBodies("body { --a: 1; } .x body { --b: 2; }", "body")).toHaveLength(2);
    expect(ruleBodies(":root { --a: 1; }", "body")).toEqual([]);
    expect(declarations("--a: var(--b, 1rem); color: red;").get("--a")).toBe("var(--b, 1rem)");
  });
});

describe("thumb-hairline — styles.css borders read the token", () => {
  it("no border declaration in styles.css carries a fixed length", () => {
    const fixed = borderDeclarations(STYLES).filter((d) => FIXED_LENGTH.test(d));
    expect(fixed).toEqual([]);
  });

  it("the hand-written borders are written through the token", () => {
    const declared = borderDeclarations(HAND_WRITTEN);
    // Non-vacuous: the hand-written half has its borders, and they read the token.
    expect(declared.filter((d) => d.includes("var(--ppp-border-width)")).length).toBeGreaterThanOrEqual(12);
    // The high-contrast rule keeps its explicit thick stroke.
    expect(declared).toContain("border-width: var(--ppp-border-width-thick)");
  });

  it("the scan finds a fixed length and passes a token", () => {
    const planted = ".a { border: 1px solid red; } .b { border-top: var(--ppp-border-width) solid; } .c { border-radius: 2px; } .d { --border-x: 1px; }";
    expect(borderDeclarations(planted).filter((d) => FIXED_LENGTH.test(d))).toEqual(["border: 1px solid red"]);
  });
});
