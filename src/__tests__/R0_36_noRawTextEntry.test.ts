/**
 * R0.36 — one text-entry lifecycle: no native datalist, no hand-built input
 * (stab-forms, rollout steps 4-5).
 *
 * The 3.7.0 report found suggestion lists and search strings behaving
 * differently on every surface: a native `<datalist>` that mobile webviews draw
 * as they please and that commits nothing of its own, and inputs assembled with
 * `createElement("input")` whose focus, filtering and popup were written again
 * each time (the agenda filter input that took focus but not text was one of
 * them). The shared primitives in `src/ui/components/fields/` (TextField,
 * SearchField, ComboField) own that lifecycle once; this keeps it that way.
 *
 * ## What is rejected
 *
 * In every `src/**` `.svelte` and `.ts` file that is not a test, comments
 * removed:
 *
 * 1. a `<datalist` element;
 * 2. an `<input …>` tag with a `list` attribute (`list="id"`, `list={id}`,
 *    `{list}`), read as a tag so a `>` inside a `{…}` expression does not end it;
 * 3. `createElement("input")` or `createEl("input")` with any quote style.
 *
 * ## The allowlist
 *
 * `ALLOWLIST` names a file and the reason it could not move to a primitive. It
 * is EMPTY: every site found at the start of stab-forms was migrated. An entry
 * has to be a real file that still offends (so it shrinks when the site is
 * migrated) and carry a reason. It only ever gets shorter.
 *
 * ## Where it is blind
 *
 * It reads text. An element built through a helper that takes the tag name as a
 * variable, a `list` attribute set from script (`setAttribute("list", …)` is
 * rejected, `el[attr] = …` is not) or an input made by another library is not
 * seen. Raw date, time, colour and checkbox inputs are not text entry and are
 * not the subject. Whether the primitives behave is the job of their own tests
 * and the live stand.
 */

import {
  SRC_ROOT,
  collectSourceFiles,
  readText,
  relToSrc,
  stripComponentComments,
} from "./support/cssScan";

type Kind = "datalist" | "input-list" | "create-input";

type Offence = { kind: Kind; line: number };

/** File (relative to `src/`) → why it still builds raw text entry. Empty: all migrated. */
const ALLOWLIST: Readonly<Record<string, string>> = {};

const DATALIST = /<datalist\b/g;
const CREATE_INPUT = /\bcreateEl(?:ement)?\(\s*(["'`])input\1/g;
const SET_LIST_ATTRIBUTE = /\bsetAttribute\(\s*(["'])list\1/g;

const lineOf = (text: string, at: number): number => text.slice(0, at).split("\n").length;

/**
 * The attribute text of every `<input …>` tag. Quotes and `{…}` expressions are
 * opaque, so `on:input={(e) => f(e)}` does not end the tag at its `>`.
 */
export function inputTags(text: string): { at: number; attrs: string }[] {
  const tags: { at: number; attrs: string }[] = [];
  for (const m of text.matchAll(/<input(?=[\s/>])/g)) {
    const start = m.index ?? 0;
    let depth = 0;
    let quote: string | null = null;
    let i = start + "<input".length;
    for (; i < text.length; i++) {
      const ch = text.charAt(i);
      if (quote) {
        if (ch === "\\") i++;
        else if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth = Math.max(0, depth - 1);
      } else if (ch === ">" && depth === 0) {
        break;
      }
    }
    tags.push({ at: start, attrs: text.slice(start + "<input".length, i) });
  }
  return tags;
}

/** Whether the attribute text of an input tag sets `list` (not a longer name such as `data-list`). */
export function hasListAttribute(attrs: string): boolean {
  if (/\{\s*list\s*\}/.test(attrs)) return true;
  // Opaque values out, so `placeholder="a list = b"` is not an attribute.
  const bare = attrs.replace(/"[^"]*"|'[^']*'|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '""');
  return /(?:^|\s)list(?=\s*=|\s|\/|$)/.test(bare);
}

/** Every raw text-entry construct in one file's text, comments removed. */
export function findOffences(text: string): Offence[] {
  const code = stripComponentComments(text);
  const found: Offence[] = [];
  for (const m of code.matchAll(DATALIST)) found.push({ kind: "datalist", line: lineOf(code, m.index ?? 0) });
  for (const tag of inputTags(code)) {
    if (hasListAttribute(tag.attrs)) found.push({ kind: "input-list", line: lineOf(code, tag.at) });
  }
  for (const m of code.matchAll(CREATE_INPUT)) found.push({ kind: "create-input", line: lineOf(code, m.index ?? 0) });
  for (const m of code.matchAll(SET_LIST_ATTRIBUTE)) found.push({ kind: "input-list", line: lineOf(code, m.index ?? 0) });
  return found.sort((a, b) => a.line - b.line);
}

const isTest = (file: string): boolean => /\.(?:test|spec)\.[tj]s$/.test(file);

/** Every non-test `.svelte` and `.ts` file under `src/` (the scanner skips `__tests__` and `__mocks__`). */
function sourceFiles(): { file: string; text: string }[] {
  return collectSourceFiles(SRC_ROOT, [".svelte", ".ts"])
    .filter((full) => !isTest(full))
    .map((full) => ({ file: relToSrc(full), text: readText(full) }));
}

/** `file:line kind` for every offence outside the allowlist. */
function offenders(files: readonly { file: string; text: string }[]): string[] {
  return files.flatMap(({ file, text }) =>
    file in ALLOWLIST ? [] : findOffences(text).map((o) => `${file}:${o.line} ${o.kind}`)
  );
}

describe("R0.36 — the reader (synthetic, proves both states)", () => {
  it("finds a datalist", () => {
    expect(findOffences('<input type="text" /><datalist id="x"><option value="a" /></datalist>')).toEqual([
      { kind: "datalist", line: 1 },
    ]);
  });

  it("finds an input list attribute in every form", () => {
    expect(findOffences('<input list="ids" />')).toHaveLength(1);
    expect(findOffences("<input list={id} />")).toHaveLength(1);
    expect(findOffences("<input {list} />")).toHaveLength(1);
    expect(findOffences('<input\n  type="text"\n  list="x"\n  on:input={(e) => f(e)}\n/>')).toEqual([
      { kind: "input-list", line: 1 },
    ]);
    expect(findOffences('el.setAttribute("list", "x")')).toHaveLength(1);
  });

  it("reads past a `>` inside an expression to the attribute after it", () => {
    const tag = '<input on:input={(e) => update(e.currentTarget.value)} list="ids" />';
    expect(findOffences(tag)).toHaveLength(1);
  });

  it("does not flag a component prop, another attribute or a tag without list", () => {
    expect(findOffences("<AgendaListEditor list={editingList} />")).toEqual([]);
    expect(findOffences('<input data-list="x" placeholder="a list = b" />')).toEqual([]);
    expect(findOffences('<input type="checkbox" on:change={(e) => toggle(e.currentTarget.checked)} />')).toEqual([]);
    expect(findOffences('<div list="x"><input type="text" /></div>')).toEqual([]);
  });

  it("finds an imperatively built input, in any quote style, and ignores other elements", () => {
    expect(findOffences('const a = activeDocument.createElement("input");')).toHaveLength(1);
    expect(findOffences("const a = document.createElement('input');")).toHaveLength(1);
    expect(findOffences("const a = el.createEl(`input`, { type: 'text' });")).toHaveLength(1);
    expect(findOffences('const a = document.createElement("button");')).toEqual([]);
    expect(findOffences('el.createEl("div", { text: "input" });')).toEqual([]);
  });

  it("ignores comments", () => {
    expect(findOffences('// <datalist id="x">\n/* createElement("input") */\n<!-- <input list="x"> -->')).toEqual([]);
  });
});

describe("R0.36 — the tree", () => {
  const files = sourceFiles();

  it("reads the tree it claims to read", () => {
    // A wrong root would make the assertion below pass on nothing.
    expect(files.length).toBeGreaterThan(200);
    expect(files.some((f) => f.file === "ui/components/fields/ComboField.svelte")).toBe(true);
    expect(files.some((f) => isTest(f.file))).toBe(false);
  });

  it("no native datalist, input list attribute or hand-built input outside the allowlist", () => {
    const found = offenders(files);
    if (found.length > 0) {
      throw new Error(
        `raw text entry outside the allowlist: ${found.length}\n` +
          found.map((o) => `  ${o}`).join("\n") +
          "\n\nUse ComboField (suggestions), SearchField (a search string) or TextField " +
          "(src/ui/components/fields). A site that cannot move yet goes in ALLOWLIST with its reason."
      );
    }
    expect(found).toEqual([]);
  });

  it("the allowlist is empty, or every entry is a real file that still offends and says why", () => {
    for (const [file, reason] of Object.entries(ALLOWLIST)) {
      const entry = files.find((f) => f.file === file);
      expect(entry).toBeDefined();
      expect(findOffences(entry?.text ?? "").length).toBeGreaterThan(0);
      expect(reason.trim()).not.toBe("");
    }
    expect(Object.keys(ALLOWLIST)).toEqual([]);
  });

  it("one planted datalist in a real component is reported", () => {
    const target = "ui/views/Dashboard/widgets/Stats/StatsConfig.svelte";
    expect(files.some((f) => f.file === target)).toBe(true);
    const planted = files.map((f) => (f.file === target ? { ...f, text: `${f.text}\n<datalist id="planted"></datalist>` } : f));
    const found = offenders(planted);
    expect(found).toHaveLength(1);
    expect(found[0]?.startsWith(`${target}:`)).toBe(true);
    expect(found[0]?.endsWith(" datalist")).toBe(true);
  });

  it("one planted imperative input in a real component is reported", () => {
    const target = "ui/views/Calendar/agenda/FilterRow.svelte";
    expect(files.some((f) => f.file === target)).toBe(true);
    const planted = files.map((f) =>
      f.file === target ? { ...f, text: `${f.text}\nconst x = activeDocument.createElement('input');` } : f
    );
    expect(offenders(planted).filter((o) => o.startsWith(`${target}:`))).toHaveLength(1);
    expect(offenders(planted).filter((o) => o.endsWith("create-input"))).toHaveLength(1);
  });

  it("the migrated sites are clean", () => {
    const migrated = [
      "ui/views/Dashboard/widgets/Checklist/ChecklistConfig.svelte",
      "ui/views/Dashboard/widgets/FilterTabs/FilterTabsConfig.svelte",
      "ui/views/Dashboard/widgets/Stats/StatsConfig.svelte",
      "ui/views/Dashboard/widgets/PipelineEditor.svelte",
      "ui/views/Calendar/components/Timeline/AgendaSidebar.svelte",
      "ui/views/Calendar/agenda/FilterRow.svelte",
      "ui/components/Navigation/SettingsMenu/tabs/FieldComboInput.svelte",
    ];
    for (const file of migrated) {
      const entry = files.find((f) => f.file === file);
      expect(entry).toBeDefined();
      expect(findOffences(entry?.text ?? "")).toEqual([]);
    }
  });
});
