/**
 * R0.34 — no two-way binding to a reactive declaration (settings-binds).
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
 * The fix pattern is one-way: `value={x}` / `checked={x}` and a handler that
 * reads the control from the event. This ratchet holds the tree at ZERO such
 * bindings — an exact budget, so it cannot creep back one component at a time.
 *
 * ## What counts
 *
 * In every `src/**\/*.svelte` outside `__tests__` / `__mocks__`:
 *
 * - a reactive declaration is `$: name = …` or a destructuring
 *   `$: ({ a, b: c } = …)` / `$: [a, b] = …` in a `<script>` block;
 * - an offender is `bind:value`, `bind:checked` or `bind:group` in the markup
 *   whose target is one of those names — written out (`bind:value={name}`),
 *   as the root of a member path (`bind:value={name.prop}`), or as the
 *   shorthand (`bind:value` binds a variable called `value`).
 *
 * Comments do not count, in the script or the markup.
 *
 * ## Where it is blind
 *
 * It reads text. It does not see a variable that is assigned only inside a
 * `$: if (…) x = …` block, a binding to a store (`bind:value={$store}`), or a
 * reactive value handed to a child as a prop and bound there under another
 * name. The real-timing tests in `SettingsMenu/tabs/__tests__` are the
 * behavioural evidence; this is the tripwire.
 */

import { join } from "path";

import {
  SRC_ROOT,
  collectSourceFiles,
  readText,
  relToSrc,
  stripComponentComments,
} from "./support/cssScan";

/** Bindings to a `$:` declaration left in the tree. Exact; it starts and stays at 0. */
const REACTIVE_BIND_BUDGET = 0;

const REASON =
  'is declared with "$:" — in Svelte 3 the binding re-runs that declaration on the next flush, ' +
  "which writes the derived value back over the user's edit. Bind one-way (value={…} / checked={…}) " +
  "and read the control in the handler.";

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** The text with each match of `re` replaced by spaces, newlines kept, so offsets still map to lines. */
function blank(text: string, re: RegExp): string {
  return text.replace(re, (m) => m.replace(/[^\n]/g, " "));
}

const SCRIPT_BLOCK = /<script[^>]*>[\s\S]*?<\/script>/g;
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

/** Every name a component's scripts declare with `$:`. */
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

export type ReactiveBind = { line: number; kind: string; name: string };

/** `bind:value|checked|group` sites in the markup whose target is a `$:` declaration. */
export function reactiveBinds(text: string): ReactiveBind[] {
  const declared = reactiveDeclarations(text);
  const markup = blank(blank(blank(text, SCRIPT_BLOCK), STYLE_BLOCK), /<!--[\s\S]*?-->/g);
  const hits: ReactiveBind[] = [];
  const site = /\bbind:(value|checked|group)(?:\s*=\s*\{\s*([A-Za-z_$][\w$]*)[^}]*\}|(?![\w:=-]))/g;
  for (const m of markup.matchAll(site)) {
    const kind = m[1] ?? "";
    const name = m[2] ?? kind;
    if (!declared.has(name)) continue;
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
      `  let draft = "";\n  $: cover = view.cover ?? "";\n  $: draft === cover && log();`,
      [
        `<input value={cover} on:change={(e) => emit(e.currentTarget.value)} />`,
        `<input bind:value={draft} />`,
        `<input bind:this={cover} />`,
        `<div bind:clientWidth={cover} />`,
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
});

describe("R0.34 — the tree", () => {
  const files = collectSourceFiles(SRC_ROOT, [".svelte"]);

  it("scans the components it claims to scan", () => {
    expect(files.length).toBeGreaterThan(100);
    const declarations = files.reduce((n, full) => n + reactiveDeclarations(readText(full)).size, 0);
    // Hundreds of `$:` declarations exist; an empty count would make the gate vacuous.
    expect(declarations).toBeGreaterThan(100);
  });

  it(`binds to a $: declaration exactly ${REACTIVE_BIND_BUDGET} times`, () => {
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
});
