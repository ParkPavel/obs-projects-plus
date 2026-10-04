/**
 * chrome-filters — a filter condition row wraps inside a narrow settings panel
 * for every pointer.
 *
 * jsdom does no layout, so the evidence here is the stylesheet itself: the
 * wrapping and the shrink permissions must sit in rules that no pointer query
 * encloses (before this only the `(pointer: coarse)` grid wrapped, and a narrow
 * desktop panel scrolled sideways). The real overflow check is the live stand.
 */

import { readFileSync } from "fs";
import { join } from "path";

const SOURCE = readFileSync(join(__dirname, "..", "FilterPanel.svelte"), "utf8");

type Rule = { selector: string; body: string; enclosing: string[] };

/** The `<style>` block, comments removed. */
function styleOf(source: string): string {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(source);
  return (m?.[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every rule with the at-rule preludes around it, outermost first. */
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  const stack: { head: string; body: string }[] = [];
  let buffer = "";
  for (const ch of css) {
    if (ch === "{") {
      stack.push({ head: buffer.trim().replace(/\s+/g, " "), body: "" });
      buffer = "";
    } else if (ch === "}") {
      const closed = stack.pop();
      if (closed && !closed.head.startsWith("@")) {
        out.push({
          selector: closed.head,
          body: closed.body + buffer,
          enclosing: stack.map((s) => s.head).filter((h) => h.startsWith("@")),
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
  return out;
}

const ALL = rules(styleOf(SOURCE));

/** Declarations of the un-nested rules whose selector list names `selector` exactly. */
function baseDeclarations(selector: string): Map<string, string> {
  const decls = new Map<string, string>();
  for (const rule of ALL) {
    if (rule.enclosing.length > 0) continue;
    const names = rule.selector.split(",").map((s) => s.trim());
    if (!names.includes(selector)) continue;
    for (const part of rule.body.split(";")) {
      const at = part.indexOf(":");
      if (at === -1) continue;
      decls.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
    }
  }
  return decls;
}

describe("chrome-filters — the reader", () => {
  it("tells a base rule from one inside a media query", () => {
    const css = ".a { x: 1; } @media (pointer: coarse) { .a { y: 2; } }";
    const read = rules(css);
    expect(read).toHaveLength(2);
    expect(read[0]).toMatchObject({ selector: ".a", enclosing: [] });
    expect(read[1]).toMatchObject({ selector: ".a", enclosing: ["@media (pointer: coarse)"] });
  });

  it("read the real stylesheet", () => {
    expect(ALL.length).toBeGreaterThan(30);
  });
});

describe("chrome-filters — condition rows wrap for every pointer", () => {
  it("the base condition row wraps, outside any pointer query", () => {
    const row = baseDeclarations(".filter-row");
    expect(row.get("display")).toBe("flex");
    expect(row.get("flex-wrap")).toBe("wrap");
    expect(row.get("min-width")).toBe("0");
  });

  it("the value field asks for a relative basis and may shrink to nothing", () => {
    const value = baseDeclarations(".value-area");
    expect(value.get("flex")).toMatch(/^1 1 \d+(?:\.\d+)?(em|%)$/);
    expect(value.get("min-width")).toBe("0");
  });

  it("chips and their labels may shrink below their content and never past the row", () => {
    const chip = baseDeclarations(".chip");
    expect(chip.get("min-width")).toBe("0");
    expect(chip.get("max-width")).toBe("100%");
    expect(chip.get("flex")).toBe("0 1 auto");
    expect(chip.has("flex-shrink")).toBe(false);
    expect(baseDeclarations(".chip-label").get("min-width")).toBe("0");
  });

  it("nested group cards and their wrappers shrink with the panel", () => {
    expect(baseDeclarations(".filter-group").get("min-width")).toBe("0");
    expect(baseDeclarations(".filter-group-wrapper").get("min-width")).toBe("0");
  });

  it("no wrapping rule depends on a pointer query", () => {
    const wrapping = ALL.filter((r) => /flex-wrap:\s*wrap/.test(r.body) && r.selector.split(",").map((s) => s.trim()).includes(".filter-row"));
    expect(wrapping.length).toBeGreaterThan(0);
    expect(wrapping.every((r) => r.enclosing.every((at) => !/pointer|hover/.test(at)))).toBe(true);
  });

  it("is intrinsic, not a container query: the panel stays out of R0.16's rem scope", () => {
    // A `@container` here would pull every `rem` in this file into the
    // rem-in-container ratchet; wrapping by flex basis needs no query at all.
    expect(styleOf(SOURCE)).not.toMatch(/@container\b/);
  });

  it("the coarse two-line grid is still there for a finger", () => {
    const coarse = ALL.filter((r) => r.selector === ".filter-row" && r.enclosing.includes("@media (pointer: coarse)"));
    expect(coarse).toHaveLength(1);
    expect(coarse[0]?.body).toMatch(/display:\s*grid/);
  });
});
