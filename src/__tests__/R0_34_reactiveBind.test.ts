/**
 * R0.34 — no two-way binding to a variable a `$:` statement writes
 * (settings-binds, then stab-input).
 *
 * In Svelte 3, `bind:value={x}` where `x` is declared with `$: x = …` does
 * not just write `x`: the binding update invalidates the declaration's own
 * dependencies, so on the next flush the declaration runs again and writes the
 * derived value back over what the user entered. A control that commits in the
 * same task as its input event (a select, a checkbox) mostly survives; one that
 * commits later — a datalist pick, Enter, blur — loses the edit. That is the
 * 2026-10-04 report: in the view settings no field picker accepted a pick and
 * no number or text field accepted a typed value. Thirty-six bindings in
 * `ViewConfigTab.svelte` had this shape; jsdom tests dispatched `input` and
 * `change` back to back with no flush between them, so none of them saw it.
 *
 * The same compiler rule does not care whether the assignment is a
 * declaration. Svelte collects the ASSIGNEES of every `$:` statement — a block,
 * an `if`, an expression — and a binding to any of them invalidates that
 * statement's dependencies. The 3.7.0 report (2026-10-05, P0-1: "database
 * fields do not save") was that form: `EditableCell` bound its editor to
 * `draft` while `$: if (editing) { draft = value … }` seeded it, so every
 * keystroke re-ran the seed and the typed text was gone 24 ms later, measured
 * on the stand with real keys. The first version of this ratchet read only
 * `$: name =` and said so in its "blind" list; the hole was real.
 *
 * The fix patterns: bind one-way (`value={x}` and a handler that reads the
 * control), or keep the assignment out of the statement — `$: seed(editing);`
 * with the assignment inside `seed`, a function declared outside the
 * statement, whose body is not part of the statement's assignees. This ratchet
 * holds the tree at ZERO such bindings — an exact budget, so it cannot creep
 * back one component at a time.
 *
 * ## What counts
 *
 * In every `src/**\/*.svelte` outside `__tests__` / `__mocks__`:
 *
 * - a reactive target is any name a top-level `$:` statement assigns: `$: x =`,
 *   a destructuring `$: ({ a, b: c } = …)` / `$: [a, b] = …`, and any
 *   assignment (`=`, `+=`, `??=` …) or `++`/`--` anywhere inside the statement,
 *   including the root of a member path (`x.a = …` writes `x`). The statement
 *   is parsed with the TypeScript parser, so comments and strings are not code.
 *   Assignments inside a function written INSIDE the statement count too:
 *   telling them apart reliably would mean re-implementing the compiler's
 *   scope analysis, and the fix pattern never needs them;
 * - an offender is any `bind:` in the markup except `bind:this` — element and
 *   component bindings alike, `bind:clientWidth` included — whose target is one
 *   of those names: written out (`bind:value={name}`), as the root of a member
 *   path (`bind:value={name.prop}`), or as the shorthand (`bind:draft` binds a
 *   variable called `draft`).
 *
 * Comments do not count, in the script or the markup.
 *
 * ## Where it is blind
 *
 * A binding to a store (`bind:value={$store}`) whose store is set elsewhere; a
 * reactive value handed to a child as a prop and bound there under another
 * name; an assignment made by a function the statement CALLS (that is the
 * sanctioned pattern, and the compiler does not see it either). The real-timing
 * component tests (`DatabaseCall/__tests__/editableCell.test.ts`, the
 * `SettingsMenu/tabs` tests) are the behavioural evidence; this is the tripwire.
 */

import { join } from "path";
import * as ts from "typescript";

import {
  SRC_ROOT,
  collectSourceFiles,
  readText,
  relToSrc,
  stripComponentComments,
} from "./support/cssScan";

/** Bindings to a `$:` target left in the tree. Exact; it starts and stays at 0. */
const REACTIVE_BIND_BUDGET = 0;

const REASON =
  'is assigned inside a "$:" statement — in Svelte 3 the binding re-runs that statement on the next flush, ' +
  "which writes the stored value back over the user's edit. Bind one-way (value={…} / checked={…}) and read " +
  "the control in the handler, or move the assignment into a function the statement calls.";

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** The text with each match of `re` replaced by spaces, newlines kept, so offsets still map to lines. */
function blank(text: string, re: RegExp): string {
  return text.replace(re, (m) => m.replace(/[^\n]/g, " "));
}

const SCRIPT_BLOCK = /<script[^>]*>[\s\S]*?<\/script>/g;
const SCRIPT_BODY = /<script[^>]*>([\s\S]*?)<\/script>/g;
const STYLE_BLOCK = /<style[^>]*>[\s\S]*?<\/style>/g;

/** The names a destructuring pattern's body (`a, b: c, d = 1, ...rest`) declares. */
function patternNames(body: string): string[] {
  return body
    .split(",")
    .map((part) => {
      let name = part.trim().replace(/^\.\.\./, "");
      const colon = name.indexOf(":");
      if (colon !== -1) name = name.slice(colon + 1);
      const eq = name.indexOf("=");
      if (eq !== -1) name = name.slice(0, eq);
      return name.replace(/[{}[\]()]/g, "").trim();
    })
    .filter((name) => IDENT.test(name));
}

/** Every name a component's scripts declare with `$:` (the declaration form). */
export function reactiveDeclarations(text: string): Set<string> {
  const names = new Set<string>();
  const scripts = [...text.matchAll(SCRIPT_BLOCK)].map((m) => stripComponentComments(m[0]));
  for (const script of scripts) {
    for (const m of script.matchAll(/\$:\s*([A-Za-z_$][\w$]*)\s*=(?![=>])/g)) {
      names.add(m[1] ?? "");
    }
    // A destructuring pattern, defaults included; `;` bounds it so a reactive
    // block (`$: { … }`) is not read as one.
    for (const m of script.matchAll(/\$:\s*\(?\s*([{[])([^;]*?)[}\]]\s*\)?\s*=(?![=>])/g)) {
      for (const name of patternNames(m[2] ?? "")) names.add(name);
    }
  }
  names.delete("");
  return names;
}

/** The names an assignment target writes: `x`, the root of `x.a[i]`, every name in a pattern. */
function targetNames(node: ts.Expression, out: Set<string>): void {
  if (ts.isIdentifier(node)) {
    out.add(node.text);
  } else if (
    ts.isParenthesizedExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    targetNames(node.expression, out);
  } else if (ts.isObjectLiteralExpression(node)) {
    for (const p of node.properties) {
      if (ts.isShorthandPropertyAssignment(p)) out.add(p.name.text);
      else if (ts.isPropertyAssignment(p)) targetNames(p.initializer, out);
      else if (ts.isSpreadAssignment(p)) targetNames(p.expression, out);
    }
  } else if (ts.isArrayLiteralExpression(node)) {
    for (const e of node.elements) targetNames(ts.isSpreadElement(e) ? e.expression : e, out);
  } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    // A default inside a destructuring pattern: `[a = 1] = …`.
    targetNames(node.left, out);
  }
}

const isAssignment = (kind: ts.SyntaxKind): boolean =>
  kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;

/** Every name assigned or updated anywhere under `node`. */
function collectAssignees(node: ts.Node, out: Set<string>): void {
  if (ts.isBinaryExpression(node) && isAssignment(node.operatorToken.kind)) {
    targetNames(node.left, out);
  } else if (
    (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
    (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
  ) {
    targetNames(node.operand, out);
  }
  ts.forEachChild(node, (child) => collectAssignees(child, out));
}

/**
 * Every name a top-level `$:` statement of the component assigns — the
 * declaration form and the statement form alike. This is the set the Svelte 3
 * compiler calls a reactive statement's assignees.
 */
export function reactiveAssignees(text: string): Set<string> {
  const names = new Set<string>();
  for (const m of text.matchAll(SCRIPT_BODY)) {
    const source = ts.createSourceFile("component.ts", m[1] ?? "", ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    for (const statement of source.statements) {
      if (ts.isLabeledStatement(statement) && statement.label.text === "$") {
        collectAssignees(statement.statement, names);
      }
    }
  }
  return names;
}

export type ReactiveBind = { line: number; kind: string; name: string };

/**
 * `bind:` sites (any, except `bind:this`) in the markup whose target is a name a
 * `$:` statement assigns. `kind` is the bound property, `name` the variable.
 */
export function reactiveBinds(text: string): ReactiveBind[] {
  const targets = new Set([...reactiveDeclarations(text), ...reactiveAssignees(text)]);
  const markup = blank(blank(blank(text, SCRIPT_BLOCK), STYLE_BLOCK), /<!--[\s\S]*?-->/g);
  const hits: ReactiveBind[] = [];
  // `(?![\w$])` pins the whole property name, so the shorthand alternative
  // cannot match a prefix of `bind:value={…}`.
  const site = /\bbind:([A-Za-z_$][\w$]*)(?![\w$])(?:\s*=\s*\{\s*([A-Za-z_$][\w$]*)[^}]*\}|(?!\s*=))/g;
  for (const m of markup.matchAll(site)) {
    const kind = m[1] ?? "";
    if (kind === "this") continue;
    const name = m[2] ?? kind;
    if (!targets.has(name)) continue;
    const line = markup.slice(0, m.index ?? 0).split("\n").length;
    hits.push({ line, kind, name });
  }
  return hits;
}

describe("R0.34 — the reader (synthetic, proves both states)", () => {
  const component = (script: string, markup: string): string =>
    `<script lang="ts">\n${script}\n</script>\n\n${markup}\n<style>\n  .a { color: red; }\n</style>\n`;

  it("reports a binding to a plain reactive declaration, with its line", () => {
    const text = component(`  export let view;\n  $: cover = view.cover ?? "";`, `<input bind:value={cover} />`);
    expect(reactiveBinds(text)).toEqual([{ line: 6, kind: "value", name: "cover" }]);
  });

  it("reports checked and group, a member path and the shorthand", () => {
    const text = component(
      `  $: on = cfg.on;\n  $: pick = cfg.pick;\n  $: form = { name: "" };\n  $: value = cfg.v;`,
      [
        `<input type="checkbox" bind:checked={on} />`,
        `<input type="radio" bind:group={pick} value="a" />`,
        `<input bind:value={form.name} />`,
        `<input bind:value />`,
      ].join("\n")
    );
    expect(reactiveBinds(text).map((h) => `${h.kind}:${h.name}`)).toEqual([
      "checked:on",
      "group:pick",
      "value:form",
      "value:value",
    ]);
  });

  it("reads destructuring declarations, renamed and defaulted names included", () => {
    expect([...reactiveDeclarations(component(`  $: ({ a, b: c, d = 1, ...rest } = cfg);\n  $: [x, y] = pair;`, ""))].sort()).toEqual(
      ["a", "c", "d", "rest", "x", "y"]
    );
    const text = component(`  $: ({ a, b: c } = cfg);`, `<input bind:value={c} />\n<input bind:value={b} />`);
    expect(reactiveBinds(text).map((h) => h.name)).toEqual(["c"]);
  });

  it("accepts one-way bindings and binds to a plain let", () => {
    const text = component(
      `  let draft = "";\n  let width = 0;\n  $: cover = view.cover ?? "";\n  $: draft === cover && log();`,
      [
        `<input value={cover} on:change={(e) => emit(e.currentTarget.value)} />`,
        `<input bind:value={draft} />`,
        `<input bind:this={cover} />`,
        `<div bind:clientWidth={width} />`,
      ].join("\n")
    );
    expect(reactiveBinds(text)).toEqual([]);
    // A comparison statement is not a declaration.
    expect([...reactiveDeclarations(text)]).toEqual(["cover"]);
  });

  it("does not read a commented-out declaration or binding", () => {
    const text = component(
      `  let cover = "";\n  // $: cover = view.cover;\n  $: on = cfg.on;`,
      `<!-- <input type="checkbox" bind:checked={on} /> -->\n<input bind:value={cover} />`
    );
    expect(reactiveBinds(text)).toEqual([]);
  });

  // ── the statement form (stab-input) ──────────────────────────────────────

  it("reports a variable assigned inside a `$: if` block — the 3.7.0 EditableCell shape", () => {
    const text = component(
      `  export let editing;\n  export let value;\n  let draft = "";\n  let committed = false;\n` +
        `  $: if (editing) {\n    draft = value == null ? "" : String(value);\n    committed = false;\n  }`,
      `<input bind:value={draft} />\n<Dropdown bind:draft />\n<input bind:checked={committed} />`
    );
    expect(reactiveBinds(text).map((h) => `${h.kind}:${h.name}`)).toEqual([
      "value:draft",
      "draft:draft",
      "checked:committed",
    ]);
  });

  it("reads a block, an expression statement, compound and update operators, member roots", () => {
    const text = component(
      [
        `  $: { const local = 1; total += local; }`,
        `  $: open || (picked = null);`,
        `  $: count++;`,
        `  $: if (x) settings.name = x; else other ??= 1;`,
        `  $: [first, second] = pair;`,
      ].join("\n"),
      ""
    );
    expect([...reactiveAssignees(text)].sort()).toEqual(["count", "first", "other", "picked", "second", "settings", "total"]);
  });

  it("counts an assignment in a function written inside the statement, not one it only calls", () => {
    const text = component(
      `  let a = "";\n  let b = "";\n  function seed(on) { if (on) b = "x"; }\n` +
        `  $: items.forEach(() => { a = "x"; });\n  $: seed(editing);`,
      `<input bind:value={a} />\n<input bind:value={b} />`
    );
    expect(reactiveBinds(text).map((h) => h.name)).toEqual(["a"]);
  });

  it("reports any binding kind, component and dimension bindings included; never bind:this", () => {
    const text = component(
      `  let open = false;\n  let w = 0;\n  let el;\n  $: if (!visible) { open = false; w = 0; el = null; }`,
      [`<Popup bind:open />`, `<div bind:clientWidth={w} />`, `<div bind:this={el} />`].join("\n")
    );
    expect(reactiveBinds(text).map((h) => `${h.kind}:${h.name}`)).toEqual(["open:open", "clientWidth:w"]);
  });

  it("does not read comments or strings as assignments", () => {
    const text = component(
      `  let draft = "";\n  $: label = "draft = 1"; // draft = 2\n  /* $: draft = 3; */`,
      `<input bind:value={draft} />`
    );
    expect(reactiveBinds(text)).toEqual([]);
  });
});

describe("R0.34 — the tree", () => {
  const files = collectSourceFiles(SRC_ROOT, [".svelte"]);

  it("scans the components it claims to scan", () => {
    expect(files.length).toBeGreaterThan(100);
    const declarations = files.reduce((n, full) => n + reactiveDeclarations(readText(full)).size, 0);
    // Hundreds of `$:` declarations exist; an empty count would make the gate vacuous.
    expect(declarations).toBeGreaterThan(100);
    // The statement reader parses every component's scripts; an empty count
    // would mean it silently read nothing.
    const assignees = files.reduce((n, full) => n + reactiveAssignees(readText(full)).size, 0);
    expect(assignees).toBeGreaterThan(100);
  });

  it(`binds to a $: target exactly ${REACTIVE_BIND_BUDGET} times`, () => {
    const offenders = files.flatMap((full) =>
      reactiveBinds(readText(full)).map(
        ({ line, kind, name }) => `${relToSrc(full)}:${line} bind:${kind}={${name}} — "${name}" ${REASON}`
      )
    );
    expect(offenders.length).toBe(REACTIVE_BIND_BUDGET);
    expect(offenders).toEqual([]);
  });

  it("a binding planted back into the settings tab is reported", () => {
    const owner = "ui/components/Navigation/SettingsMenu/tabs/ViewConfigTab.svelte";
    const text = readText(join(SRC_ROOT, owner));
    expect(reactiveBinds(text)).toEqual([]);
    const planted = text.replace("value={coverField}", "bind:value={coverField}");
    expect(planted).not.toBe(text);
    expect(reactiveBinds(planted).map((h) => `${h.kind}:${h.name}`)).toEqual(["value:coverField"]);
  });

  it("the 3.7.0 seed planted back into EditableCell is reported at every editor", () => {
    const owner = "ui/views/Dashboard/widgets/DatabaseCall/EditableCell.svelte";
    const text = readText(join(SRC_ROOT, owner));
    expect(reactiveBinds(text)).toEqual([]);
    const planted = text.replace(
      "$: onEditing(editing);",
      "$: if (editing) { draft = value === null || value === undefined ? \"\" : String(value); }"
    );
    expect(planted).not.toBe(text);
    // Scalar inputs moved to TypedCellEditor; the choice binding stays here.
    expect(reactiveBinds(planted).map((h) => `${h.kind}:${h.name}`)).toEqual([
      "draft:draft",
    ]);
  });

  it("the old seed planted into the extracted scalar editor is still reported", () => {
    const text = readText(join(SRC_ROOT, "ui/views/Dashboard/widgets/DatabaseCall/TypedCellEditor.svelte"));
    expect(reactiveBinds(text)).toEqual([]);
    const planted = text.replace("</script>", "$: draft = value == null ? \"\" : String(value);\n</script>");
    expect(planted).not.toBe(text);
    // 3.7.2 B1: dates are typed too, so one input serves every scalar type;
    // that one binding must trip the zero budget.
    expect(reactiveBinds(planted).map((h) => `${h.kind}:${h.name}`)).toEqual(["value:draft"]);
  });
});
