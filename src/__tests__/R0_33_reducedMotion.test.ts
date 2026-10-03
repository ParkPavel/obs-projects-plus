/**
 * R0.33 — reduced motion reaches every plugin surface (ios-r1).
 *
 * Before ios-r1 the only `prefers-reduced-motion: reduce` rule in the token
 * stylesheet zeroed the five `--ppp-duration-*` tokens. That reached the rules
 * that read a token and nothing else: the audit behind ios-r1 counted about two
 * hundred transition and animation declarations in the components with their
 * own literal durations, and six reduced-motion references in total. A user
 * who asked the system for less motion still got slide-ins, pulses and spinners.
 *
 * The fix is one rule in `ui/tokens/tokens.css`, inside that media block,
 * over every plugin root and everything below it, setting the durations to
 * (near) zero and the iteration count to one. This file pins it, because a rule
 * like that is invisible on a desktop that does not ask for reduced motion —
 * deleting it, or narrowing its selector, would pass every other gate.
 *
 * ## What is pinned
 *
 * - The block exists at the top level of the stylesheet (not nested in a
 *   pointer or width query that would quietly narrow it).
 * - A rule in it covers each root in `ROOTS` as the element itself and as the
 *   ancestor of every descendant, including pseudo-elements.
 * - The rule sets `animation-duration` and `transition-duration` to under one
 *   millisecond and `animation-iteration-count` to 1, each `!important` (a
 *   scoped component rule out-specifies anything written here).
 * - Each root is real: its owner file still carries the class name. A root the
 *   tree no longer renders is a selector that matches nothing.
 * - Every node a component portals to `<body>` with `use:portal` carries one of
 *   the roots, so a new portalled surface cannot escape the rule unnoticed.
 *
 * ## Where it is blind
 *
 * It reads text. It cannot prove that a root is an ancestor at runtime, or that
 * a node appended to `<body>` by hand (not through `use:portal`) carries a root
 * — `ROOTS` names the hand-appended ones that exist today. The computed-style
 * check under emulated reduced motion is the live evidence; this is the
 * tripwire that keeps it from being undone silently.
 */

import { existsSync } from "fs";
import { join } from "path";

import {
  SRC_ROOT,
  collectSourceFiles,
  readText,
  relToSrc,
  stripComponentComments,
  stripCssComments,
} from "./support/cssScan";

const TOKENS = "ui/tokens/tokens.css";

/**
 * Every plugin root the rule must cover, with the file that renders it. The
 * owner is where the class name is written; if it moves, this entry moves.
 */
const ROOTS: ReadonlyArray<{ root: string; owner: string }> = [
  // The view root of every leaf: views, navbar, settings panel, filter sheet.
  { root: ".projects-container", owner: "ui/app/App.svelte" },
  // EditNote (and CreateNote) modal containers.
  { root: ".projects-modal", owner: "ui/modals/editNoteModal.ts" },
  { root: ".ppp-add-view-modal", owner: "ui/modals/addViewModal.ts" },
  // FloatingPopup: the desktop branch is portalled to <body>.
  { root: ".ppp-popup", owner: "ui/components/FloatingPopup/FloatingPopup.svelte" },
  // Hand-appended to <body>.
  { root: ".ppp-popover-container", owner: "ui/views/Calendar/agenda/FilterRow.svelte" },
  { root: ".ppp-list-editor-overlay", owner: "ui/views/Calendar/components/Timeline/AgendaSidebar.svelte" },
  { root: ".obsidian-projects-popup-portal", owner: "ui/views/Calendar/components/DayPopup/DayPopup.svelte" },
  // Drag ghosts portalled to <body>.
  { root: ".ppp-strip-ghost-portal", owner: "ui/views/Calendar/components/Calendar/TimelineView.svelte" },
  { root: ".ppp-timed-ghost-portal", owner: "ui/views/Calendar/components/Calendar/TimelineView.svelte" },
  { root: ".ppp-timed-ghost-snapline", owner: "ui/views/Calendar/components/Calendar/TimelineView.svelte" },
  { root: ".ppp-drag-feedback", owner: "ui/views/Calendar/agenda/TouchDndCoordinator.ts" },
];

/** The forms each root must appear in: itself, its pseudo-elements, every descendant. */
const COVERAGE = ["", "::before", "::after", " *", " *::before", " *::after"] as const;

type Rule = { selector: string; body: string; enclosing: string[] };

const normalize = (text: string): string => text.trim().replace(/\s+/g, " ");

/**
 * Every rule in `css` with the at-rule preludes around it, outermost first.
 * A brace walk, so nesting is read rather than guessed (the R0.32 shape).
 */
export function readRules(css: string): Rule[] {
  const rules: Rule[] = [];
  const stack: { head: string; body: string }[] = [];
  let buffer = "";
  for (const ch of stripCssComments(css)) {
    if (ch === "{") {
      stack.push({ head: normalize(buffer), body: "" });
      buffer = "";
    } else if (ch === "}") {
      const closed = stack.pop();
      if (closed && !closed.head.startsWith("@")) {
        rules.push({
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
  return rules;
}

/** Split on commas outside parentheses. */
function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim() !== "") parts.push(current.trim());
  return parts;
}

/**
 * The plain selectors a selector list stands for, with one leading `:is(…)`
 * expanded: `:is(.a, .b) *` → `.a *`, `.b *`.
 */
export function expandSelectors(list: string): string[] {
  return splitTopLevel(list).flatMap((part) => {
    const lead = /^:is\(([^()]*)\)(.*)$/.exec(part);
    if (!lead) return [normalize(part)];
    const rest = lead[2] ?? "";
    return splitTopLevel(lead[1] ?? "").map((inner) => normalize(inner + rest));
  });
}

/** `name: value` pairs of a declaration body, names lower-cased. */
function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const decl of body.split(";")) {
    const at = decl.indexOf(":");
    if (at === -1) continue;
    out.set(decl.slice(0, at).trim().toLowerCase(), normalize(decl.slice(at + 1)));
  }
  return out;
}

/** Under one millisecond, `!important`. Written as text, not parsed as a number. */
export function isNearZeroImportant(value: string | undefined): boolean {
  if (value === undefined) return false;
  const m = /^(.*?)\s*!important$/.exec(value);
  if (!m) return false;
  const length = (m[1] ?? "").trim();
  return /^0(?:\.\d+)?ms$/.test(length) || length === "0s";
}

const REDUCE = /^@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)$/;

/** Rules directly inside a top-level reduced-motion block that switch motion off. */
export function motionOffRules(css: string): Rule[] {
  return readRules(css).filter((rule) => {
    if (rule.enclosing.length !== 1 || !REDUCE.test(rule.enclosing[0] ?? "")) return false;
    const decls = declarations(rule.body);
    return (
      isNearZeroImportant(decls.get("animation-duration")) &&
      isNearZeroImportant(decls.get("transition-duration")) &&
      decls.get("animation-iteration-count") === "1 !important"
    );
  });
}

/** The `ROOTS` × `COVERAGE` forms that no motion-off rule names. */
export function uncovered(css: string, roots: readonly string[]): string[] {
  const named = new Set(motionOffRules(css).flatMap((r) => expandSelectors(r.selector)));
  return roots.flatMap((root) =>
    COVERAGE.map((form) => root + form).filter((sel) => !named.has(sel))
  );
}

/**
 * The class attribute of every element carrying `use:portal={{ to: "document-body" }}`,
 * as `[file, classes]`. The tag is read to its closing `>` with quotes and braces
 * tracked, so a `>` inside an attribute value does not end it.
 */
export function bodyPortalClasses(text: string): string[][] {
  const out: string[][] = [];
  const site = /use:portal=\{\{\s*to:\s*["']document-body["']\s*\}\}/g;
  for (const m of text.matchAll(site)) {
    const start = text.lastIndexOf("<", m.index ?? 0);
    let depth = 0;
    let quote: string | null = null;
    let end = start + 1;
    for (; end < text.length; end++) {
      const ch = text[end]!;
      if (quote !== null) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) break;
    }
    const tag = text.slice(start, end);
    const cls = /\sclass="([^"]*)"/.exec(tag)?.[1] ?? "";
    out.push(cls.split(/\s+/).filter((c) => c !== ""));
  }
  return out;
}

const ALL_FORMS = (root: string): string[] => COVERAGE.map((form) => root + form);

describe("R0.33 — the reader (synthetic, proves both states)", () => {
  const list = ":is(.a, .b)";
  const covering = [
    `@media (prefers-reduced-motion: reduce) {`,
    `  ${COVERAGE.map((f) => list + f).join(",\n  ")} {`,
    `    animation-duration: 0.01ms !important;`,
    `    animation-iteration-count: 1 !important;`,
    `    transition-duration: 0.01ms !important;`,
    `  }`,
    `}`,
  ].join("\n");

  it("accepts a rule that covers the roots and switches motion off", () => {
    expect(uncovered(covering, [".a", ".b"])).toEqual([]);
    expect(expandSelectors(":is(.a, .b) *::after, .c")).toEqual([".a *::after", ".b *::after", ".c"]);
  });

  it("names a root the rule does not cover", () => {
    expect(uncovered(covering, [".a", ".z"])).toEqual(ALL_FORMS(".z"));
  });

  it("does not count self-only coverage as reaching descendants", () => {
    const selfOnly = covering.replace(/,\n\s*:is\(\.a, \.b\) \*(::before|::after)?/g, "");
    expect(uncovered(selfOnly, [".a"])).toEqual([".a *", ".a *::before", ".a *::after"]);
  });

  it("rejects durations that are not near zero, or not important", () => {
    expect(uncovered(covering.replace(/0\.01ms !important;\n {4}animation-iteration/, "0.2s !important;\n    animation-iteration"), [".a"])).toEqual(ALL_FORMS(".a"));
    expect(uncovered(covering.replace("transition-duration: 0.01ms !important", "transition-duration: 0.01ms"), [".a"])).toEqual(ALL_FORMS(".a"));
    expect(uncovered(covering.replace("1 !important", "infinite !important"), [".a"])).toEqual(ALL_FORMS(".a"));
    expect(isNearZeroImportant("0s !important")).toBe(true);
    expect(isNearZeroImportant("0.5ms !important")).toBe(true);
    expect(isNearZeroImportant("1ms !important")).toBe(false);
    expect(isNearZeroImportant("0.05s !important")).toBe(false);
  });

  it("rejects the rule when another query narrows it or the query is not reduce", () => {
    const nested = covering.replace("@media (prefers-reduced-motion: reduce) {", "@media (pointer: coarse) { @media (prefers-reduced-motion: reduce) {") + "}";
    expect(uncovered(nested, [".a"])).toEqual(ALL_FORMS(".a"));
    const other = covering.replace(": reduce)", ": no-preference)");
    expect(other).not.toBe(covering);
    expect(uncovered(other, [".a"])).toEqual(ALL_FORMS(".a"));
  });

  it("does not read a commented-out rule", () => {
    expect(uncovered(`/* ${covering} */`, [".a"])).toEqual(ALL_FORMS(".a"));
  });

  it("reads the class of a body-portalled element, whatever the attribute order", () => {
    const markup = [
      `<div use:portal={{ to: "document-body" }} class="x y" style="top:{a > b ? 1 : 0}rem"></div>`,
      `<div\n  class="z"\n  use:portal={{ to: "document-body" }}\n></div>`,
      `<div use:portal={{ to: "document-body" }} style="top:0"></div>`,
      `<div use:portal={{ to: "leaf-overlay" }} class="w"></div>`,
    ].join("\n");
    expect(bodyPortalClasses(markup)).toEqual([["x", "y"], ["z"], []]);
  });
});

describe("R0.33 — the tree", () => {
  const tokens = readText(join(SRC_ROOT, TOKENS));

  it("reads the stylesheet it claims to read", () => {
    expect(tokens.length).toBeGreaterThan(1000);
    expect(readRules(tokens).length).toBeGreaterThan(10);
  });

  it("a top-level reduced-motion rule switches motion off on every plugin root", () => {
    expect(motionOffRules(tokens).length).toBeGreaterThan(0);
    expect(uncovered(tokens, ROOTS.map((r) => r.root))).toEqual([]);
  });

  it("still zeroes the duration tokens in the same block", () => {
    const tokenRule = readRules(tokens).find(
      (r) => r.selector === ":root" && r.enclosing.length === 1 && REDUCE.test(r.enclosing[0] ?? "")
    );
    expect(tokenRule).toBeDefined();
    const decls = declarations(tokenRule?.body ?? "");
    for (const name of ["fast", "normal", "slow", "slower"]) {
      expect(decls.get(`--ppp-duration-${name}`)).toBe("0ms");
    }
  });

  it("every root is rendered by its owner file", () => {
    const missing = ROOTS.filter(({ owner }) => !existsSync(join(SRC_ROOT, owner))).map((r) => r.owner);
    expect(missing).toEqual([]);
    const stale = ROOTS.filter(
      ({ root, owner }) => !stripComponentComments(readText(join(SRC_ROOT, owner))).includes(root.slice(1))
    ).map(({ root, owner }) => `${owner} → ${root}`);
    expect(stale).toEqual([]);
  });

  it("every node portalled to <body> carries a plugin root", () => {
    const roots = new Set(ROOTS.map((r) => r.root.slice(1)));
    const sites = collectSourceFiles(SRC_ROOT, [".svelte"]).flatMap((full) =>
      bodyPortalClasses(stripComponentComments(readText(full))).map((classes) => ({
        file: relToSrc(full),
        classes,
      }))
    );
    // FloatingPopup, the TimelineView ghosts and the HeaderStripsSection ghost
    // at least; an empty scan would make the assertion below vacuous.
    expect(sites.length).toBeGreaterThanOrEqual(5);
    const escaped = sites
      .filter(({ classes }) => !classes.some((c) => roots.has(c)))
      .map(({ file, classes }) => `${file} → [${classes.join(" ")}]`);
    expect(escaped).toEqual([]);
  });

  it("one root removed from the real rule is reported", () => {
    const planted = tokens.split(".ppp-timed-ghost-snapline, ").join("");
    expect(uncovered(planted, ROOTS.map((r) => r.root))).toEqual(ALL_FORMS(".ppp-timed-ghost-snapline"));
  });
});
