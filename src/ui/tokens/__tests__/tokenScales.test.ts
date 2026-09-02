/**
 * Token scales, read from the CSS that actually ships (#165).
 *
 * This suite replaces `Dashboard/__tests__/designTokens.test.ts`, which asserted
 * the same values against a TypeScript module whose output was injected onto
 * `.ppp-database-root` as a `style=` attribute. That module is gone: an injected
 * attribute reaches only one subtree, so Calendar, Board, Gallery and every
 * modal could never share it, and it was the mechanism that let a second
 * `--ppp-radius-*` scale exist at shifted values with no file appearing to
 * conflict with any other.
 *
 * The assertions are therefore made against `tokens.css` itself. The values are
 * the ones the dashboard rendered before the move, and that is the point: #165
 * is a structural change whose contract is that nothing on screen moves.
 */

import * as fs from "fs";
import * as path from "path";

const TOKENS_CSS = path.resolve(__dirname, "..", "tokens.css");
const SRC_ROOT = path.resolve(__dirname, "..", "..", "..");

const css = fs.readFileSync(TOKENS_CSS, "utf8");

/** Declarations of the FIRST rule block whose selector is exactly `selector`. */
function declarations(selector: string): Record<string, string> {
  const start = new RegExp(`(?:^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "m");
  const at = css.search(start);
  if (at < 0) throw new Error(`no rule block for ${selector}`);
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  const body = css.slice(open + 1, close);
  const out: Record<string, string> = {};
  for (const match of body.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g)) {
    out[match[1] as string] = (match[2] as string).replace(/\/\*[\s\S]*?\*\//g, "").trim();
  }
  return out;
}

/** Every `.svelte` file's text, keyed by path relative to `src/`. */
function components(dir: string, out: Record<string, string> = {}): Record<string, string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
      components(full, out);
    } else if (entry.name.endsWith(".svelte")) {
      out[path.relative(SRC_ROOT, full).replace(/\\/g, "/")] = fs.readFileSync(full, "utf8");
    }
  }
  return out;
}

const root = declarations(":root");
const canvas = declarations(".ppp-database-root");

/**
 * The rungs of the injected space scale that a component actually reads, at the
 * values `designTokens.ts` injected them.
 */
const INJECTED_SPACE = {
  "--ppp-space-sm": "0.375rem",
  "--ppp-space-md": "0.5rem",
  "--ppp-space-lg": "0.75rem",
  "--ppp-space-xl": "1rem",
};

/** Injected rungs that no component read. Dropped with the injection. */
const UNCONSUMED_SPACE = [
  "--ppp-space-xxs",
  "--ppp-space-xs",
  "--ppp-space-2xl",
  "--ppp-space-3xl",
];

const INJECTED_RADIUS = {
  "--ppp-radius-xs": "0.125rem",
  "--ppp-radius-sm": "0.25rem",
  "--ppp-radius-md": "0.375rem",
  "--ppp-radius-lg": "0.5rem",
  "--ppp-radius-xl": "0.75rem",
  "--ppp-radius-pill": "62.5rem",
};

describe("named spacing scale, promoted from the injection (#165)", () => {
  test("every injected space token is declared at :root, unchanged", () => {
    for (const [name, value] of Object.entries(INJECTED_SPACE)) {
      expect([name, root[name]]).toEqual([name, value]);
    }
  });

  test("the named scale is the numeric ladder under a second vocabulary", () => {
    // Recorded rather than fixed: two names for one ladder is #166's to merge.
    // If they ever diverge, that is a decision, and this test makes it visible.
    expect(root["--ppp-space-sm"]).toBe(root["--ppp-space-3"]);
    expect(root["--ppp-space-md"]).toBe(root["--ppp-space-4"]);
    expect(root["--ppp-space-lg"]).toBe(root["--ppp-space-5"]);
    expect(root["--ppp-space-xl"]).toBe(root["--ppp-space-6"]);
  });

  test("the rungs nothing read did not come along either", () => {
    // Same standard as `--ppp-bp-*` below, applied inside the scale itself.
    for (const name of UNCONSUMED_SPACE) expect(root[name]).toBeUndefined();
  });

  test("every named space token has at least one component consumer", () => {
    // The failure #165 exists for, one level down: a declared scale nobody uses.
    const all = Object.values(components(SRC_ROOT)).join("\n");
    const orphans = Object.keys(INJECTED_SPACE).filter((n) => !all.includes(`var(${n}`));
    expect(orphans).toEqual([]);
  });

  test("the scales that had no consumer did not come along", () => {
    // `--ppp-bp-*`, `--ppp-touch-coarse/fine` and `--ppp-row-*` were injected and
    // referenced by nothing but their own test. Declaring them again would be
    // the dead file reborn, so they were dropped with the injection.
    const declared = Object.keys(root);
    expect(declared.filter((n) => n.startsWith("--ppp-bp-"))).toEqual([]);
    expect(declared.filter((n) => /^--ppp-touch-(coarse|fine)$/.test(n))).toEqual([]);
    expect(declared.filter((n) => /^--ppp-row-(compact|default|expanded)$/.test(n))).toEqual([]);
  });
});

describe("radius scales, and the shadow between them (#165)", () => {
  test("the two radius keys the global scale lacked are now declared", () => {
    expect(root["--ppp-radius-xs"]).toBe(INJECTED_RADIUS["--ppp-radius-xs"]);
    expect(root["--ppp-radius-pill"]).toBe(INJECTED_RADIUS["--ppp-radius-pill"]);
  });

  test("the global radius scale is untouched", () => {
    expect(root["--ppp-radius-none"]).toBe("0");
    expect(root["--ppp-radius-sm"]).toBe("0.125rem");
    expect(root["--ppp-radius-md"]).toBe("0.25rem");
    expect(root["--ppp-radius-lg"]).toBe("0.375rem");
    expect(root["--ppp-radius-xl"]).toBe("0.5rem");
    expect(root["--ppp-radius-2xl"]).toBe("0.75rem");
    expect(root["--ppp-radius-full"]).toBe("9999px");
  });

  test("the canvas shim redeclares exactly the four radii that differed", () => {
    expect(Object.keys(canvas).sort()).toEqual([
      "--ppp-radius-lg",
      "--ppp-radius-md",
      "--ppp-radius-sm",
      "--ppp-radius-xl",
    ]);
  });

  test("the shim reproduces the dashboard's values, not the global ones", () => {
    for (const name of ["--ppp-radius-sm", "--ppp-radius-md", "--ppp-radius-lg", "--ppp-radius-xl"]) {
      expect([name, canvas[name]]).toEqual([name, INJECTED_RADIUS[name as keyof typeof INJECTED_RADIUS]]);
      expect(canvas[name]).not.toBe(root[name]);
    }
  });

  test("radius xs and pill needed no shim — both scales agreed on them", () => {
    expect(canvas["--ppp-radius-xs"]).toBeUndefined();
    expect(canvas["--ppp-radius-pill"]).toBeUndefined();
    expect(root["--ppp-radius-xs"]).toBe(INJECTED_RADIUS["--ppp-radius-xs"]);
    expect(root["--ppp-radius-pill"]).toBe(INJECTED_RADIUS["--ppp-radius-pill"]);
  });

  test("the shim is scoped to the canvas and not to the document root", () => {
    expect(css).toMatch(/\.ppp-database-root\s*\{/);
    expect(root["--ppp-radius-sm"]).not.toBe(canvas["--ppp-radius-sm"]);
  });
});

describe("the injection is gone (#165)", () => {
  test("the canvas no longer carries an injected style attribute", () => {
    const canvasSvelte = fs.readFileSync(
      path.join(SRC_ROOT, "ui", "views", "Dashboard", "DashboardCanvas.svelte"),
      "utf8"
    );
    expect(canvasSvelte).toContain('class="ppp-database-root"');
    expect(canvasSvelte).not.toContain("tokenCSS");
    expect(canvasSvelte).not.toContain("getDesignTokenCSS");
  });

  test("Schema is pinned to the numeric scale it actually rendered", () => {
    // It is a modal, so it never sat under `.ppp-database-root` and resolved its
    // inline fallbacks. Its `--ppp-space-md` fallback was 0.75rem while the named
    // token is 0.5rem, so promoting the scale would have silently shrunk it.
    const schema = fs.readFileSync(
      path.join(SRC_ROOT, "ui", "modals", "components", "Schema.svelte"),
      "utf8"
    );
    expect(schema).not.toMatch(/var\(--ppp-space-(xxs|xs|sm|md|lg|xl|2xl|3xl)\b/);
    expect(root["--ppp-space-5"]).toBe("0.75rem");
    expect(root["--ppp-space-3"]).toBe("0.375rem");
    expect(root["--ppp-space-2"]).toBe("0.25rem");
  });

  test("no component still reads a token the injection alone provided", () => {
    const all = Object.values(components(SRC_ROOT)).join("\n");
    expect(all).not.toMatch(/var\(--ppp-bp-/);
    expect(all).not.toMatch(/var\(--ppp-touch-(coarse|fine)\b/);
    expect(all).not.toMatch(/var\(--ppp-row-(compact|default|expanded)\b/);
    for (const name of UNCONSUMED_SPACE) expect(all).not.toContain(`var(${name}`);
  });
});
