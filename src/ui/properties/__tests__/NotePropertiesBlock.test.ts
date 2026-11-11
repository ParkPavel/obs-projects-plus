/**
 * i3-props — the note-header block on a real render: delete and rename from
 * the row menu, a nested value that stays read-only, and list chips that keep
 * a comma inside an item.
 *
 * The row menu is Obsidian's; it is replaced by a recorder so a test can pick
 * an entry by its title. Writes go through the real writers to a frontmatter
 * object, and each write announces itself the way metadataCache would.
 */

const mockMenus: Array<Array<{ title?: string; onClick?: () => void }>> = [];
const mockRelationPicks: Array<(file: { path: string }) => void> = [];
jest.mock("src/ui/views/VisualizerPane/RelationPickerModal", () => ({
  RelationPickerModal: class {
    constructor(_app: unknown, choose: (file: { path: string }) => void) { mockRelationPicks.push(choose); }
    open() {}
  },
  pathFromFile: (file: { path: string }) => file.path.replace(/\.md$/i, ""),
}));
jest.mock("src/lib/contextMenu", () => ({
  openContextMenu: (items: Array<{ title?: string; onClick?: () => void }>) => {
    mockMenus.push(items);
  },
}));

// i3-final: the barrel's re-exported default is not a constructor under the
// test transform; the component itself is.
jest.mock("src/ui/components/ColorPicker", () => ({
  ColorPicker: jest.requireActual("src/ui/components/ColorPicker/ColorPicker.svelte").default,
}));

import "@testing-library/jest-dom";
import { render, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import { get } from "svelte/store";
import { settings } from "src/lib/stores/settings";
import { DEFAULT_PROJECT } from "src/settings/settings";
// Required, not imported: esbuild-jest runs babel hoisting on files with
// jest.mock, and babel refuses an imported binding also used as a type.
const { TFile } = require("obsidian");
type TFile = { path: string };

const NotePropertiesBlock = require("../NotePropertiesBlock.svelte").default;

function setup(fm: Record<string, unknown>, other?: Record<string, unknown>) {
  const file = new TFile("Notes/a.md");
  const getMarkdownFiles = jest.fn(() => [file, new TFile("Notes/b.md")]);
  const listeners = new Set<(f: TFile) => void>();
  const processFrontMatter = jest.fn(async (target: TFile, fn: (f: Record<string, unknown>) => void) => {
    fn(target.path === file.path ? fm : other ?? fm);
    listeners.forEach((cb) => cb(target));
  });
  const app = {
    metadataCache: {
      getFileCache: (candidate: TFile) => ({ frontmatter: { ...(candidate.path === file.path ? fm : other ?? fm) } }),
      on: (_name: string, cb: (f: TFile) => void) => {
        listeners.add(cb);
        return cb;
      },
      offref: (cb: (f: TFile) => void) => { listeners.delete(cb); },
    },
    fileManager: { processFrontMatter },
    vault: { getMarkdownFiles, getAbstractFileByPath: () => null },
    workspace: { openLinkText: jest.fn(), getLeaf: jest.fn() },
  };
  const result = render(NotePropertiesBlock, { props: { app, file } });
  return { ...result, app, file, processFrontMatter, getMarkdownFiles, notifyChanged: (changed: TFile) => listeners.forEach(cb => cb(changed)) };
}

function keyWith(el: HTMLElement, k: string, mods: KeyboardEventInit): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...mods }));
}

function editorOf(key: string): HTMLInputElement | null {
  return row(key).querySelector<HTMLInputElement>("input");
}

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await tick();
  }
}

function row(key: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`li[data-row-key="${key}"]`);
  if (!el) throw new Error(`no row for ${key}`);
  return el;
}

async function menuEntry(key: string, title: string): Promise<void> {
  mockMenus.length = 0;
  const more = row(key).querySelector<HTMLButtonElement>("button.ppp-note-props__icon");
  more?.click();
  const entry = mockMenus[0]?.find((e) => e.title === title);
  if (!entry?.onClick) throw new Error(`no menu entry ${title}`);
  entry.onClick();
  await flush();
}

function key(el: HTMLElement, k: string): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
}

function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("i3-props NotePropertiesBlock", () => {
  it("adding a list item preserves primitive types, null and commas through the actual writer and YAML", async () => {
    const fm = { mixed: [0, false, null, "0", "Smith, John"] }, view = setup(fm);
    try {
      await tick(); (row("mixed").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const input = editorOf("mixed")!; type(input, "new, item"); key(input, "Enter"); await flush();
      const expected = [0, false, null, "0", "Smith, John", "new, item"];
      expect(fm.mixed).toEqual(expected);
      const yaml = jest.requireActual("../../../../node_modules/yaml/dist/index.js"); expect(yaml.parse(yaml.stringify(fm)).mixed).toEqual(expected);
      expect(view.processFrontMatter).toHaveBeenCalledTimes(1);
    } finally { view.unmount(); }
  });

  it("a list shows and removes null by position without conflating numeric zero and text zero", async () => {
    const fm = { mixed: [0, false, null, "0"] }, view = setup(fm);
    try {
      await tick(); (row("mixed").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const buttons = row("mixed").querySelectorAll<HTMLButtonElement>(".ppp-chips__remove");
      expect(buttons).toHaveLength(4); buttons[2]!.click(); await flush();
      expect(fm.mixed).toEqual([0, false, "0"]);
    } finally { view.unmount(); }
  });

  it("list suggestions use the original input and preserve a selected raw value", async () => {
    const raw = " [[People/A|A]] ", fm = { mixed: ["own"] }, view = setup(fm, { mixed: [raw] });
    try {
      await tick(); (row("mixed").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const input = editorOf("mixed")!; expect(input).toHaveAttribute("role", "combobox");
      const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(item => item.textContent === raw)!;
      expect(option).toBeDefined(); option.click(); await flush();
      expect(fm.mixed).toEqual(["own", raw]); expect(editorOf("mixed")).toBe(input);
      expect(document.activeElement).toBe(input);
    } finally { view.unmount(); }
  });

  it("leaving a composing list editor does not write or close before composition ends", async () => {
    const fm = { mixed: ["own"] }, view = setup(fm);
    try {
      await tick(); (row("mixed").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const input = editorOf("mixed")!;
      input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })); type(input, "途中");
      input.blur(); await flush();
      expect(view.processFrontMatter).not.toHaveBeenCalled(); expect(editorOf("mixed")).toBe(input);
      input.value = "最終"; input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })); await flush();
      expect(fm.mixed).toEqual(["own", "最終"]); expect(view.processFrontMatter).toHaveBeenCalledTimes(1);
      expect(editorOf("mixed")).toBeNull();
    } finally { view.unmount(); }
  });

  it("an earlier queued list acknowledgement cannot erase later accepted chips", async () => {
    const fm = { mixed: ["own"] }, view = setup(fm);
    let first = () => {}, second = () => {};
    const blockedFirst = new Promise<void>(resolve => { first = resolve; });
    const blockedSecond = new Promise<void>(resolve => { second = resolve; });
    try {
      await tick(); (row("mixed").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const write = view.processFrontMatter.getMockImplementation()!;
      view.processFrontMatter.mockImplementationOnce(async (...args) => { await blockedFirst; return write(...args); });
      view.processFrontMatter.mockImplementationOnce(async (...args) => { await blockedSecond; return write(...args); });
      const input = editorOf("mixed")!;
      type(input, "A"); key(input, "Enter"); await flush(); type(input, "B"); key(input, "Enter"); await flush();
      first(); await flush(); type(input, "C"); key(input, "Enter"); await flush(); second(); await flush();
      expect(fm.mixed).toEqual(["own", "A", "B", "C"]);
    } finally { first(); second(); await flush(); view.unmount(); }
  });

  it("removing a just-added chip queues the return to the original list", async () => {
    const fm = { mixed: ["own"] }, view = setup(fm); let release = () => {};
    const blocked = new Promise<void>(resolve => { release = resolve; });
    try {
      await tick(); (row("mixed").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const write = view.processFrontMatter.getMockImplementation()!;
      view.processFrontMatter.mockImplementationOnce(async (...args) => { await blocked; return write(...args); });
      const input = editorOf("mixed")!; type(input, "A"); key(input, "Enter"); await flush();
      row("mixed").querySelectorAll<HTMLButtonElement>(".ppp-chips__remove")[1]!.click(); await flush();
      release(); await flush(); expect(fm.mixed).toEqual(["own"]);
    } finally { release(); await flush(); view.unmount(); }
  });

  it("a successful list write retains accepted chips until the delayed metadata acknowledgement", async () => {
    const fm = { mixed: ["own"] }, view = setup(fm);
    let cached = { mixed: [...fm.mixed] };
    view.app.metadataCache.getFileCache = () => ({ frontmatter: cached });
    view.processFrontMatter.mockImplementation(async (_file, change) => { change(fm); });
    try {
      await tick(); (row("mixed").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const input = editorOf("mixed")!; type(input, "A"); key(input, "Enter"); await flush();
      expect(fm.mixed).toEqual(["own", "A"]);
      type(input, "B"); key(input, "Enter"); await flush(); expect(fm.mixed).toEqual(["own", "A", "B"]);
      cached = { mixed: ["own", "A"] }; view.notifyChanged(view.file); await flush();
      type(input, "C"); key(input, "Enter"); await flush(); expect(fm.mixed).toEqual(["own", "A", "B", "C"]);
      cached = { mixed: [...fm.mixed] }; view.notifyChanged(view.file); await flush();
      cached = { mixed: ["external"] }; view.notifyChanged(view.file); await flush();
      type(input, "D"); key(input, "Enter"); await flush(); expect(fm.mixed).toEqual(["external", "D"]);
    } finally { view.unmount(); }
  });

  it("empty-list ArrowDown then Enter adds the highlighted suggestion instead of ending the edit", async () => {
    const fm = { mixed: ["own"] }, view = setup(fm, { mixed: ["candidate"] });
    try {
      await tick(); (row("mixed").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const input = editorOf("mixed")!; key(input, "ArrowDown"); await flush(); key(input, "Enter"); await flush();
      expect(fm.mixed).toEqual(["own", "candidate"]); expect(editorOf("mixed")).toBe(input);
    } finally { view.unmount(); }
  });

  it("a pre-write metadata echo during add-remove cannot acknowledge the queued return to the original list", async () => {
    const fm = { mixed: ["own"], other: "before" }, view = setup(fm);
    let first = () => {}, second = () => {};
    const firstGate = new Promise<void>(resolve => { first = resolve; });
    const secondGate = new Promise<void>(resolve => { second = resolve; });
    try {
      await tick(); (row("mixed").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const write = view.processFrontMatter.getMockImplementation()!;
      view.processFrontMatter.mockImplementationOnce(async (...args) => { await firstGate; return write(...args); });
      view.processFrontMatter.mockImplementationOnce(async (...args) => { await secondGate; return write(...args); });
      const input = editorOf("mixed")!; type(input, "A"); key(input, "Enter"); await flush();
      row("mixed").querySelectorAll<HTMLButtonElement>(".ppp-chips__remove")[1]!.click(); await flush();
      fm.other = "external"; view.notifyChanged(view.file); await flush(); first(); await flush();
      type(input, "C"); key(input, "Enter"); await flush(); second(); await flush();
      expect(fm.mixed).toEqual(["own", "C"]); expect(fm.other).toBe("external");
    } finally { first(); second(); await flush(); view.unmount(); }
  });

  it("a list source refresh preserves its original input, private draft and caret", async () => {
    const fm = { mixed: ["own"] }, other = { mixed: ["before"] }, view = setup(fm, other);
    try {
      await tick(); (row("mixed").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const input = editorOf("mixed")!; type(input, "draft"); input.setSelectionRange(1, 3);
      other.mixed = ["draft source"]; view.notifyChanged(new TFile("Notes/b.md"));
      await waitFor(() => expect(Array.from(document.querySelectorAll('[role="option"]')).some(item => item.textContent === "draft source")).toBe(true));
      expect(editorOf("mixed")).toBe(input); expect(input.value).toBe("draft");
      expect([input.selectionStart, input.selectionEnd]).toEqual([1, 3]); expect(document.activeElement).toBe(input);
      expect(view.getMarkdownFiles).toHaveBeenCalledTimes(2); expect(view.processFrontMatter).not.toHaveBeenCalled();
    } finally { view.unmount(); }
  });
  it("leaving an untouched property after an external metadata refresh cannot restore its old value", async () => {
    const fm={value:"original"},view=setup(fm);
    try {
      await tick();(row("value").querySelector(".ppp-note-props__display") as HTMLElement).click();await flush();
      const input=editorOf("value")!;fm.value="external";view.notifyChanged(view.file);await flush();
      expect(input.value).toBe("original");input.blur();await flush();
      expect(fm.value).toBe("external");expect(view.processFrontMatter).not.toHaveBeenCalled();expect(editorOf("value")).toBeNull();
    }finally{view.unmount();}
  });

  it("finishing an accepted scalar write preserves a newer draft in the same original input", async () => {
    const fm = { value: "original" }, view = setup(fm);
    try {
      await tick(); (row("value").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const input = editorOf("value")!; let release = () => {}; const blocked = new Promise<void>(resolve => { release = resolve; });
      const write = view.processFrontMatter.getMockImplementation()!;
      view.processFrontMatter.mockImplementationOnce(async (...args) => { await blocked; return write(...args); });
      type(input, "accepted A"); key(input, "Enter"); await flush();
      type(input, "pending B"); input.setSelectionRange(1, 4); await flush(); release(); await flush();
      expect(fm.value).toBe("accepted A"); expect(editorOf("value")).toBe(input); expect(input.value).toBe("pending B");
      expect([input.selectionStart, input.selectionEnd]).toEqual([1, 4]); expect(document.activeElement).toBe(input);
      key(input, "Enter"); await flush(); expect(fm.value).toBe("pending B"); expect(view.processFrontMatter).toHaveBeenCalledTimes(2);
    } finally { view.unmount(); }
  });

  it("an open property source refresh keeps the same draft, caret and focus without a scan per keypress", async () => {
    const fm = { value: "mine" }, other = { value: "before" }, view = setup(fm, other);
    try {
      await tick(); (row("value").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const input = editorOf("value")!; type(input, "draft"); input.setSelectionRange(1, 3);
      other.value = "draft source"; view.notifyChanged(new TFile("Notes/b.md"));
      await waitFor(() => expect(Array.from(document.querySelectorAll('[role="option"]')).some(item => item.textContent === "draft source")).toBe(true));
      expect(editorOf("value")).toBe(input); expect(input.value).toBe("draft"); expect([input.selectionStart, input.selectionEnd]).toEqual([1, 3]); expect(document.activeElement).toBe(input);
      expect(view.getMarkdownFiles).toHaveBeenCalledTimes(2); expect(view.processFrontMatter).not.toHaveBeenCalled();
    } finally { view.unmount(); }
  });

  it("numeric invalid blur retains the draft and an explicit retry writes a number only once", async () => {
    const fm = { value: 1 }, view = setup(fm, { value: 2 });
    try {
      await tick(); (row("value").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const input = editorOf("value")!; type(input, "1e-"); input.blur(); await flush();
      expect(input.value).toBe("1e-"); expect(input).toHaveAttribute("aria-invalid", "true"); expect(view.processFrontMatter).not.toHaveBeenCalled();
      input.focus(); type(input, "2,5"); key(input, "Enter"); await flush();
      expect(view.processFrontMatter).not.toHaveBeenCalled(); // This writer's existing numeric grammar rejects decimal commas.
      type(input, "2.5"); key(input, "Enter"); await flush();
      expect(fm.value).toBe(2.5); expect(view.processFrontMatter).toHaveBeenCalledTimes(1);
    } finally { view.unmount(); }
  });

  it("a highlighted numeric option commits through Tab and navigation waits for the writer", async () => {
    const fm = { value: 1, after: "after" }, view = setup(fm, { value: 2.5 });
    try {
      await tick(); (row("value").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const input = editorOf("value")!; type(input, "2"); key(input, "ArrowDown"); await tick();
      let release = () => {}; const blocked = new Promise<void>(resolve => { release = resolve; }); const write = view.processFrontMatter.getMockImplementation()!;
      view.processFrontMatter.mockImplementationOnce(async (...args) => { await blocked; return write(...args); });
      key(input, "Tab"); await flush(); expect(editorOf("value")).toBe(input); expect(editorOf("after")).toBeNull();
      release(); await flush(); expect(fm.value).toBe(2.5); expect(document.activeElement).toBe(editorOf("after")); expect(view.processFrontMatter).toHaveBeenCalledTimes(1);
    } finally { view.unmount(); }
  });

  it.each([
    ["string", "mine", " [[People/A|A]] ", "text"],
    ["number", 1, 2.5, "decimal"],
    ["url", "old", "https://example.test/a?q=1", "url"],
    ["email", "old", "person@example.test", "email"],
    ["phone", "old", "+7 (900) 123-45-67", "tel"],
  ])("%s offers scoped values in its original input and writes the selected YAML type once", async (kind, own, selected, inputMode) => {
    const fm: Record<string, unknown> = { value: own, pp_types: { value: kind } };
    const view = setup(fm, { value: selected });
    try {
      await tick(); (row("value").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const input = editorOf("value")!; expect(input).toHaveAttribute("role", "combobox"); expect(input).toHaveAttribute("inputmode", inputMode as string);
      const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(item => item.textContent === String(selected));
      expect(option).toBeDefined(); expect(view.processFrontMatter).not.toHaveBeenCalled();
      expect(editorOf("value")).toBe(input); expect(document.activeElement).toBe(input);
      option!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); await flush();
      expect(fm["value"]).toBe(selected); expect(view.processFrontMatter).toHaveBeenCalledTimes(1);
      const yaml = require("yaml"); expect(yaml.parse(yaml.stringify(fm))["value"]).toBe(selected);
    } finally { view.unmount(); }
  });

  it("the ordinary property source excludes other folders, templates and invalid numeric values", async () => {
    const fm: Record<string, unknown> = { value: 1, pp_types: { value: "number" } }, view = setup(fm);
    const notes: Record<string, Record<string, unknown>> = {
      "Notes/a.md": fm, "Notes/b.md": { value: 2 }, "Elsewhere/x.md": { value: 3 },
      "Notes/template.md": { value: "{{value}}" }, "Notes/bad.md": { value: "not a number" },
    };
    view.getMarkdownFiles.mockReturnValue(Object.keys(notes).map(path => new TFile(path)));
    view.app.metadataCache.getFileCache = candidate => ({ frontmatter: notes[candidate.path]! });
    try {
      await tick(); (row("value").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      expect(editorOf("value")).toHaveAttribute("role", "combobox");
      expect(Array.from(document.querySelectorAll('[role="option"]')).map(item => item.textContent)).toEqual(["1", "2"]);
      const reads = view.getMarkdownFiles.mock.calls.length;
      type(editorOf("value")!, "2"); await flush(); type(editorOf("value")!, ""); await flush();
      expect(view.getMarkdownFiles).toHaveBeenCalledTimes(reads); expect(view.processFrontMatter).not.toHaveBeenCalled();
    } finally { view.unmount(); }
  });

  it("searches beyond the first200 observed values through the original property editor and writes the chosen value once", async () => {
    const fm: Record<string, unknown> = { status: "mine", pp_types: { status: "status" } }, view = setup(fm);
    const foreign = Array.from({ length: 600 }, (_, id) => new TFile(`Notes/${id}.md`));
    view.getMarkdownFiles.mockReturnValue([view.file, ...foreign]);
    view.app.metadataCache.getFileCache = candidate => ({ frontmatter: candidate.path === view.file.path ? fm : { status: candidate.path === "Notes/599.md" ? "Ёлка" : candidate.path } });
    try {
      await tick(); (row("status").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
      const input = editorOf("status")!; expect(input).toHaveAttribute("role", "combobox");
      expect(document.querySelectorAll('[role="option"]')).toHaveLength(50);
      type(input, "ёлк"); await flush();
      const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(item => item.textContent === "Ёлка");
      expect(option).toBeDefined(); expect(editorOf("status")).toBe(input); expect(document.activeElement).toBe(input);
      option!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); await flush();
      expect(fm["status"]).toBe("Ёлка"); expect(view.processFrontMatter).toHaveBeenCalledTimes(1);
    } finally { view.unmount(); }
  });
  it("retires an original draft when the next note has the same property key", async () => {
    const first = { title: "first" }, second = { title: "second" };
    const view = setup(first, second); await tick();
    (row("title").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
    const original = editorOf("title")!; type(original, "private first draft"); original.setSelectionRange(1, 4);
    view.component.$set({ file: new TFile("Notes/b.md") }); await flush();
    expect(editorOf("title")).toBeNull(); expect(row("title")).toHaveTextContent("second");
    key(original, "Enter"); original.dispatchEvent(new Event("blur")); await flush();
    expect(view.processFrontMatter).not.toHaveBeenCalled(); expect(second.title).toBe("second");
    (row("title").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
    const fresh = editorOf("title")!; type(fresh, "fresh edit"); key(fresh, "Enter"); await flush();
    expect(view.processFrontMatter).toHaveBeenCalledTimes(1);
    expect(view.processFrontMatter.mock.calls[0]![0].path).toBe("Notes/b.md");
    expect(second.title).toBe("fresh edit"); expect(first.title).toBe("first");
    view.unmount();
  });
  it("preserves the same draft and caret when the same note gets a fresh file prop", async () => {
    const view = setup({ title: "first" }); await tick();
    (row("title").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
    const original = editorOf("title")!; type(original, "private draft"); original.setSelectionRange(1, 4);
    view.component.$set({ file: new TFile("Notes/a.md") }); await flush();
    expect(editorOf("title")).toBe(original); expect(original.value).toBe("private draft");
    expect([original.selectionStart, original.selectionEnd]).toEqual([1, 4]); expect(view.processFrontMatter).not.toHaveBeenCalled();
    view.unmount();
  });
  it("an accepted old write drains without closing or writing the next note's fresh draft", async () => {
    const first = { title: "first" }, second = { title: "second" };
    const view = setup(first, second); await tick();
    (row("title").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
    let release = () => {}; const blocked = new Promise<void>(resolve => { release = resolve; });
    const write = view.processFrontMatter.getMockImplementation()!;
    view.processFrontMatter.mockImplementationOnce(async (...args) => { await blocked; return write(...args); });
    type(editorOf("title")!, "accepted first edit"); key(editorOf("title")!, "Enter"); await flush();
    view.component.$set({ file: new TFile("Notes/b.md") }); await flush();
    expect(editorOf("title")).toBeNull();
    (row("title").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
    const fresh = editorOf("title")!; type(fresh, "pending second edit");
    release(); await flush();
    expect(first.title).toBe("accepted first edit"); expect(second.title).toBe("second");
    expect(editorOf("title")).toBe(fresh); expect(fresh.value).toBe("pending second edit");
    expect(view.processFrontMatter).toHaveBeenCalledTimes(1);
    key(fresh, "Enter"); await flush(); expect(second.title).toBe("pending second edit");
    view.unmount();
  });
  it("drains already accepted property writes after close", async () => {
    const fm = { one: false, two: false }; const view = setup(fm); await tick();
    for (const name of ["one", "two"]) {
      const checkbox = editorOf(name)!; checkbox.checked = true; checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
    view.unmount(); await flush();
    expect(fm).toEqual({ one: true, two: true }); expect(view.processFrontMatter).toHaveBeenCalledTimes(2);
    expect(view.processFrontMatter.mock.calls.every(call => call[0].path === "Notes/a.md")).toBe(true);
  });
  it("retires an old typed draft when the property's type changes in the same note", async () => {
    const fm: Record<string, unknown> = { value: "old", pp_types: { value: "text" } };
    const view = setup(fm); await tick();
    (row("value").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
    const original = editorOf("value")!; type(original, "19");
    fm["value"] = 42; fm["pp_types"] = { value: "number" };
    view.component.$set({ file: new TFile("Notes/a.md") }); await flush();
    expect(editorOf("value")).toBeNull(); expect(row("value")).toHaveTextContent("42");
    key(original, "Enter"); original.dispatchEvent(new Event("blur")); await flush();
    expect(fm["value"]).toBe(42); expect(view.processFrontMatter).not.toHaveBeenCalled(); view.unmount();
  });
  it("does not carry a draft or metadata subscription into another app with the same path", async () => {
    const first = { title: "first app" }, second = { title: "second app" };
    const view = setup(first), other = setup(second); other.unmount(); await tick();
    (row("title").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
    type(editorOf("title")!, "private draft");
    view.component.$set({ app: other.app, file: other.file }); await flush();
    expect(editorOf("title")).toBeNull(); expect(row("title")).toHaveTextContent("second app");
    (row("title").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
    type(editorOf("title")!, "second edit"); key(editorOf("title")!, "Enter"); await flush();
    expect(other.processFrontMatter).toHaveBeenCalledTimes(1); expect(view.processFrontMatter).not.toHaveBeenCalled();
    expect(first.title).toBe("first app"); expect(second.title).toBe("second edit"); view.unmount();
  });
  it.each(["file", "destroy"])("ignores an old row menu after %s retires its owner", async change => {
    const first = { title: "first" }, second = { title: "second" };
    const view = setup(first, second); await tick(); mockMenus.length = 0;
    row("title").querySelector<HTMLButtonElement>("button.ppp-note-props__icon")!.click();
    const remove = mockMenus[0]!.find(entry => entry.title === "Delete property")!.onClick!;
    if (change === "file") view.component.$set({ file: new TFile("Notes/b.md") }); else view.unmount();
    await flush(); remove(); await flush();
    expect(view.processFrontMatter).not.toHaveBeenCalled(); expect(first.title).toBe("first"); expect(second.title).toBe("second");
    if (change === "file") view.unmount();
  });
  it.each(["file", "destroy"])("ignores an old relation picker after %s retires its owner", async change => {
    const first = { links: ["[[First]]"], pp_types: { links: "relation" } };
    const second = { links: ["[[Second]]"], pp_types: { links: "relation" } };
    const view = setup(first, second); await tick(); mockRelationPicks.length = 0;
    (row("links").querySelector(".ppp-note-props__display") as HTMLElement).click(); await flush();
    row("links").querySelector<HTMLButtonElement>("[data-chips-pick]")!.click(); await flush();
    const choose = mockRelationPicks[0]!; expect(choose).toBeDefined(); view.processFrontMatter.mockClear();
    if (change === "file") view.component.$set({ file: new TFile("Notes/b.md") }); else view.unmount();
    await flush(); choose({ path: "Notes/Picked.md" }); await flush();
    expect(view.processFrontMatter).not.toHaveBeenCalled(); expect(first.links).toEqual(["[[First]]"]); expect(second.links).toEqual(["[[Second]]"]);
    if (change === "file") view.unmount();
  });
  it("Tab waits even when the input has another window's prototype", async () => {
    const fm: Record<string, unknown> = { one: "x", two: "y" };
    const { processFrontMatter } = setup(fm);
    await tick();
    (row("one").querySelector(".ppp-note-props__display") as HTMLElement).click();
    await flush();
    const field = editorOf("one")!;
    type(field, "draft");
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    const foreignWindow = frame.contentWindow as Window & typeof globalThis;
    const original = Object.getPrototypeOf(field);
    Object.setPrototypeOf(field, foreignWindow.HTMLInputElement.prototype);
    expect(Object.getPrototypeOf(field)).not.toBe(HTMLInputElement.prototype);
    let release: () => void = () => {};
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const write = processFrontMatter.getMockImplementation()!;
    processFrontMatter.mockImplementationOnce(async (...args) => { await blocked; return write(...args); });
    try {
      key(field, "Tab");
      await flush();
      expect(editorOf("one")).toBe(field);
      expect(editorOf("two")).toBeNull();
      release();
      await flush();
      expect(fm["one"]).toBe("draft");
      expect(processFrontMatter).toHaveBeenCalledTimes(1);
    } finally { Object.setPrototypeOf(field, original); frame.remove(); }
  });

  it("an old add-property write cannot close a newer name draft", async () => {
    const fm: Record<string, unknown> = { title: "x" };
    const { processFrontMatter, container } = setup(fm);
    await tick();
    (container.querySelector("button.ppp-note-props__add") as HTMLButtonElement).click();
    await flush();
    const input = container.querySelector<HTMLInputElement>(".ppp-note-props__add-row input")!;
    let release: () => void = () => {};
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const write = processFrontMatter.getMockImplementation()!;
    processFrontMatter.mockImplementationOnce(async (...args) => { await blocked; return write(...args); });
    type(input, "first");
    key(input, "Enter");
    await flush();
    type(input, "second");
    release();
    await flush();
    expect("first" in fm).toBe(true);
    expect(container.querySelector<HTMLInputElement>(".ppp-note-props__add-row input")?.value).toBe("second");
    key(input, "Enter");
    await flush();
    expect("second" in fm).toBe(true);
  });

  it.each([
    ["text", false], ["text", true], ["status", false], ["status", true],
  ])("%s Tab (backwards=%s) waits and writes exactly once through the field", async (kind, backwards) => {
    const fm: Record<string, unknown> = { before: "x", choice: "alpha", after: "z",
      ...(kind === "status" ? { pp_types: { choice: "status" } } : {}) };
    const { processFrontMatter } = setup(fm, { choice: "beta" });
    await tick();
    (row("choice").querySelector(".ppp-note-props__display") as HTMLElement).click();
    await flush();
    const field = editorOf("choice")!;
    type(field, kind === "status" ? "be" : "draft");
    if (kind === "status") { key(field, "ArrowDown"); await tick(); }
    let release: () => void = () => {};
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const write = processFrontMatter.getMockImplementation()!;
    processFrontMatter.mockImplementationOnce(async (...args) => { await blocked; return write(...args); });
    keyWith(field, "Tab", { shiftKey: backwards === true });
    await flush();
    expect(editorOf("choice")).toBe(field);
    expect(editorOf(backwards ? "before" : "after")).toBeNull();
    expect(processFrontMatter).toHaveBeenCalledTimes(1);
    release();
    await flush();
    expect(fm["choice"]).toBe(kind === "status" ? "beta" : "draft");
    expect(document.activeElement).toBe(editorOf(backwards ? "before" : "after"));
    expect(processFrontMatter).toHaveBeenCalledTimes(1);
  });
  it("keeps a rejected value draft editable and lets the user retry", async () => {
    const fm: Record<string, unknown> = { title: "original" };
    const { processFrontMatter } = setup(fm);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await tick();
    (row("title").querySelector(".ppp-note-props__display") as HTMLElement).click();
    await flush();
    for (let i = 0; i < 4; i++) processFrontMatter.mockRejectedValueOnce(new Error("disk full") as never);
    type(editorOf("title") as HTMLInputElement, "draft");
    key(editorOf("title") as HTMLInputElement, "Enter");
    await waitFor(() => expect(row("title").querySelector('[role="alert"]')).not.toBeNull());
    expect(fm["title"]).toBe("original");
    expect(editorOf("title")?.value).toBe("draft");
    expect(row("title").querySelector('[role="alert"]')).not.toBeNull();
    key(editorOf("title") as HTMLInputElement, "Enter");
    await flush();
    expect(fm["title"]).toBe("draft");
    expect(editorOf("title")).toBeNull();
    error.mockRestore();
  });

  it("keeps the rename editor open when the file refuses a rename", async () => {
    const fm: Record<string, unknown> = { title: "A", status: "open" };
    const { processFrontMatter } = setup(fm);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await tick();
    await menuEntry("status", "Rename property");
    processFrontMatter.mockRejectedValueOnce(new Error("read only") as never);
    type(editorOf("status") as HTMLInputElement, "state");
    key(editorOf("status") as HTMLInputElement, "Enter");
    await flush();
    expect(fm).toEqual({ title: "A", status: "open" });
    expect(editorOf("status")?.value).toBe("state");
    expect(row("status").querySelector('[role="alert"]')).not.toBeNull();
    key(editorOf("status") as HTMLInputElement, "Enter");
    await flush();
    expect(fm["state"]).toBe("open");
    expect("status" in fm).toBe(false);
    error.mockRestore();
  });

  it("does not close another field when a previous save finishes", async () => {
    const fm: Record<string, unknown> = { one: "x", two: "y" };
    const { processFrontMatter } = setup(fm);
    const original = processFrontMatter.getMockImplementation();
    let release: () => void = () => undefined;
    processFrontMatter.mockImplementationOnce(async (...args) => {
      await new Promise<void>(resolve => { release = resolve; });
      await original?.(...args);
    });
    await tick();
    (row("one").querySelector(".ppp-note-props__display") as HTMLElement).click();
    await flush();type(editorOf("one") as HTMLInputElement, "saved");key(editorOf("one") as HTMLInputElement, "Enter");
    (row("two").querySelector(".ppp-note-props__display") as HTMLElement).click();
    await flush();type(editorOf("two") as HTMLInputElement, "keep typing");
    release();await flush();
    expect(fm["one"]).toBe("saved");
    expect(fm["two"]).toBe("y");
    expect(editorOf("two")?.value).toBe("keep typing");
  });

  it("Tab waits for storage and retains the draft after a persistent refusal", async () => {
    const fm: Record<string, unknown> = { one: "x", two: "y" };
    const { processFrontMatter } = setup(fm);
    const error=jest.spyOn(console,"error").mockImplementation(()=>undefined);
    for(let i=0;i<4;i++)processFrontMatter.mockRejectedValueOnce(new Error("disk full") as never);
    await tick();(row("one").querySelector(".ppp-note-props__display") as HTMLElement).click();
    await flush();type(editorOf("one") as HTMLInputElement,"draft");key(editorOf("one") as HTMLInputElement,"Tab");
    await waitFor(()=>expect(row("one").querySelector('[role="alert"]')).not.toBeNull());
    expect(fm["one"]).toBe("x");expect(editorOf("one")?.value).toBe("draft");expect(editorOf("two")).toBeNull();
    error.mockRestore();
  });

  it("deletes a property from the row menu, with its type entry", async () => {
    const fm: Record<string, unknown> = { title: "A", status: "open", pp_types: { status: "status" } };
    setup(fm);
    await tick();
    await menuEntry("status", "Delete property");
    expect(fm).toEqual({ title: "A" });
    expect(document.querySelector('li[data-row-key="status"]')).toBeNull();
  });

  it("renames a property in place from the row menu", async () => {
    const fm: Record<string, unknown> = { title: "A", status: "open", due: "x" };
    setup(fm);
    await tick();
    await menuEntry("status", "Rename property");
    const input = row("status").querySelector<HTMLInputElement>("input");
    expect(input).not.toBeNull();
    type(input as HTMLInputElement, "state");
    key(input as HTMLInputElement, "Enter");
    await flush();
    expect(Object.keys(fm)).toEqual(["title", "state", "due"]);
    expect(fm["state"]).toBe("open");
  });

  it("refuses a rename to a taken or reserved name and writes nothing", async () => {
    const fm: Record<string, unknown> = { title: "A", status: "open" };
    const { processFrontMatter } = setup(fm);
    await tick();
    await menuEntry("status", "Rename property");
    const input = row("status").querySelector<HTMLInputElement>("input") as HTMLInputElement;
    type(input, "title");
    key(input, "Enter");
    await flush();
    expect(row("status").querySelector('[role="alert"]')).not.toBeNull();
    type(input, "pp_status");
    key(input, "Enter");
    await flush();
    expect(processFrontMatter).not.toHaveBeenCalled();
    expect(fm).toEqual({ title: "A", status: "open" });
  });

  it("shows a nested object read-only and never writes it back as text", async () => {
    const nested = { owner: { name: "x" } };
    const fm: Record<string, unknown> = { meta: nested, pp_types: { meta: "string" } };
    const { processFrontMatter } = setup(fm);
    await tick();
    const display = row("meta").querySelector<HTMLElement>(".ppp-note-props__display") as HTMLElement;
    expect(display).toHaveClass("is-readonly");
    expect(display.querySelector("code")?.textContent).toBe(JSON.stringify(nested));
    display.click();
    key(display, "Enter");
    await flush();
    expect(row("meta").querySelector("input")).toBeNull();
    expect(processFrontMatter).not.toHaveBeenCalled();
    expect(fm["meta"]).toBe(nested);
  });

  it("edits a list as chips: an item with a comma stays one item", async () => {
    const fm: Record<string, unknown> = { people: ["Smith, John", "Doe"] };
    setup(fm);
    await tick();
    (row("people").querySelector(".ppp-note-props__display") as HTMLElement).click();
    await flush();
    const chips = () => Array.from(row("people").querySelectorAll(".ppp-chips__text")).map((c) => c.textContent);
    expect(chips()).toEqual(["Smith, John", "Doe"]);

    const input = row("people").querySelector<HTMLInputElement>("input") as HTMLInputElement;
    type(input, "Roe, Jane");
    key(input, "Enter");
    await flush();
    expect(fm["people"]).toEqual(["Smith, John", "Doe", "Roe, Jane"]);

    type(input, "Poe");
    key(input, ",");
    await flush();
    expect(fm["people"]).toEqual(["Smith, John", "Doe", "Roe, Jane", "Poe"]);

    type(input, "");
    key(input, "Backspace");
    await flush();
    expect(fm["people"]).toEqual(["Smith, John", "Doe", "Roe, Jane"]);
    expect(chips()).toEqual(["Smith, John", "Doe", "Roe, Jane"]);
  });

  it("queues a second write made while the first is in flight", async () => {
    const fm: Record<string, unknown> = { a: "1", b: "2" };
    setup(fm);
    await tick();
    mockMenus.length = 0;
    row("a").querySelector<HTMLButtonElement>("button.ppp-note-props__icon")?.click();
    row("b").querySelector<HTMLButtonElement>("button.ppp-note-props__icon")?.click();
    mockMenus[0]?.find((e) => e.title === "Delete property")?.onClick?.();
    mockMenus[1]?.find((e) => e.title === "Delete property")?.onClick?.();
    await flush();
    expect(fm).toEqual({});
  });
});

describe("i3-final NotePropertiesBlock", () => {
  const shownKeys = () =>
    Array.from(document.querySelectorAll<HTMLElement>("li[data-row-key]")).map((li) => li.dataset["rowKey"]);

  it("Alt+↓ on the grip writes the new order into the YAML, pp_* kept at the end", async () => {
    const nested = { deep: [1, 2] };
    const fm: Record<string, unknown> = { one: "x", two: nested, three: "z", pp_types: { one: "text" } };
    const { processFrontMatter } = setup(fm);
    await tick();
    const grip = row("one").querySelector<HTMLElement>("[data-row-grip]") as HTMLElement;
    grip.focus();
    keyWith(grip, "ArrowDown", { altKey: true });
    await flush();
    expect(Object.keys(fm)).toEqual(["two", "one", "three", "pp_types"]);
    expect(fm["two"]).toBe(nested);
    expect(processFrontMatter).toHaveBeenCalledTimes(1);
    expect(shownKeys()).toEqual(["two", "one", "three"]);
    expect(document.activeElement).toBe(row("one").querySelector("[data-row-grip]"));
  });

  it("a grip drag (pointer events) drops the row where the pointer is and clears its overlay order", async () => {
    const fm: Record<string, unknown> = {
      one: "a",
      two: "b",
      three: "c",
      four: "d",
      pp_overlay: { order: ["one", "two"] },
    };
    setup(fm);
    await tick();
    document.querySelectorAll<HTMLElement>("li[data-row-key]").forEach((li, i) => {
      li.getBoundingClientRect = () => ({ top: i * 30, height: 30, bottom: i * 30 + 30, left: 0, right: 100, width: 100, x: 0, y: i * 30, toJSON: () => ({}) });
    });
    const grip = row("one").querySelector<HTMLElement>("[data-row-grip]") as HTMLElement;
    grip.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, clientY: 10 }));
    grip.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, cancelable: true, clientY: 80 }));
    await tick();
    expect(row("one")).toHaveClass("is-dragging");
    expect(row("four")).toHaveClass("is-drop-before");
    grip.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true, clientY: 80 }));
    await flush();
    expect(Object.keys(fm)).toEqual(["two", "three", "one", "four"]);
    expect("pp_overlay" in fm).toBe(false);
    expect(row("one")).not.toHaveClass("is-dragging");
  });

  it("Tab commits the open value and opens the next one; Shift+Tab goes back; Escape cancels", async () => {
    const fm: Record<string, unknown> = { one: "x", flag: true, two: "y", meta: { a: 1 }, three: "z" };
    setup(fm);
    await tick();
    (row("one").querySelector(".ppp-note-props__display") as HTMLElement).click();
    await flush();
    const first = editorOf("one") as HTMLInputElement;
    expect(document.activeElement).toBe(first);
    type(first, "changed");
    key(first, "Tab");
    await flush();
    expect(fm["one"]).toBe("changed");
    expect(editorOf("one")).toBeNull();
    // A checkbox is focused, not opened; the nested value is skipped.
    expect(document.activeElement).toBe(row("flag").querySelector("input[type=checkbox]"));

    (row("two").querySelector(".ppp-note-props__display") as HTMLElement).click();
    await flush();
    key(editorOf("two") as HTMLInputElement, "Tab");
    await flush();
    const third = editorOf("three") as HTMLInputElement;
    expect(document.activeElement).toBe(third);

    keyWith(third, "Tab", { shiftKey: true });
    await flush();
    const back = editorOf("two") as HTMLInputElement;
    expect(document.activeElement).toBe(back);

    type(back, "never");
    key(back, "Escape");
    await flush();
    expect(editorOf("two")).toBeNull();
    expect(fm["two"]).toBe("y");
    expect(fm["three"]).toBe("z");
  });

  it("does not scan the vault for the palette: it offers the shared favorites only", async () => {
    const fm: Record<string, unknown> = { tint: "#ff0000", other: "x" };
    const { getMarkdownFiles } = setup(fm);
    await tick();
    const picker = row("tint").querySelector(".color-picker--inline");
    expect(picker).not.toBeNull();
    row("tint").querySelector<HTMLElement>(".sat-light-picker")!.click();
    await flush();
    expect(row("tint").querySelector(".color-picker--inline")).toBe(picker);
    expect(row("tint").querySelector('[role="combobox"]')).toBeNull();
    expect(getMarkdownFiles).not.toHaveBeenCalled();
  });

  it("shows one shared favorite list in both note headers and removes legacy favorites globally", async () => {
    const original = get(settings);
    const shared = [{ color: "#112233", name: "Shared" }];
    settings.set({ ...original, preferences: { ...original.preferences, colorFavorites: shared }, projects: [
      { ...DEFAULT_PROJECT, id: "one", name: "Query palette", dataSource: { kind: "dataview", config: { query: "TABLE FROM #other" } }, colorFavorites: [{ color: "#445566", name: "One" }] },
      { ...DEFAULT_PROJECT, id: "two", name: "Second palette" },
    ] });
    const fm = { tint: "#ff0000" };
    const first = setup(fm), second = setup({ ...fm });
    try {
      await tick();
      await flush();
      const favoriteTitles = (m: ReturnType<typeof setup>) => Array.from(m.container.querySelectorAll<HTMLButtonElement>(".favorites-grid .color-swatch")).map(button => button.title);
      expect(favoriteTitles(first)).toContain("Shared");
      expect(favoriteTitles(first)).toContain("One");
      expect(favoriteTitles(second)).toEqual(favoriteTitles(first));
      (first.container.querySelector("button.star-btn") as HTMLButtonElement).click();
      await flush();
      const state = get(settings);
      expect(state.projects[0]!.colorFavorites?.map(f => f.color)).toEqual(["#445566"]);
      expect(state.preferences.colorFavorites?.map(f => f.color)).toEqual(["#112233", "#ff0000"]);
      expect(first.processFrontMatter).not.toHaveBeenCalled();
      expect(fm.tint).toBe("#ff0000");
      expect(favoriteTitles(second)).toEqual(favoriteTitles(first));
      const projectSwatch = Array.from(first.container.querySelectorAll<HTMLButtonElement>(".favorites-grid .color-swatch"))
        .find(button => button.title === "One")!;
      (projectSwatch.parentElement!.querySelector(".remove-btn") as HTMLButtonElement).click();
      await flush();
      expect(get(settings).projects[0]!.colorFavorites).toEqual([]);
      expect(favoriteTitles(first)).not.toContain("One");
      expect(favoriteTitles(second)).not.toContain("One");
      // Deletion cannot leave a hidden stale target, even while the picker stays open.
      settings.set({ ...get(settings), projects: get(settings).projects.filter(p => p.id !== "two") });
      await flush();
      first.component.$set({ file: new TFile("Elsewhere/new.md") });
      await flush();
      expect(first.container.querySelector(".color-picker--inline")).not.toBeNull();
      expect(favoriteTitles(first)).toContain("Shared");
    } finally { first.component.$destroy(); second.component.$destroy(); settings.set(original); }
  });

  it("reopens the palette for the new note with the same three sections", async () => {
    const m = setup({ tint: "#ff0000" }, { shade: "#00ff00" });
    try {
      await tick();
      await flush();
      const sections = () => m.container.querySelectorAll(".color-picker > .palette-section").length;
      expect(sections()).toBe(3);
      m.component.$set({ file: new TFile("Notes/b.md") });
      await flush();
      expect(m.container.querySelector(".color-picker--inline")).not.toBeNull();
      expect(m.container.querySelector<HTMLElement>(".color-preview")?.style.backgroundColor).toBe("rgb(0, 255, 0)");
      expect(sections()).toBe(3);
    } finally { m.component.$destroy(); }
  });

  it("a color gesture started on one note cannot commit into the next note", async () => {
    const m = setup({ tint: "#ff0000" });
    try {
      await tick();
      await flush();
      const hue = m.container.querySelector<HTMLElement>(".hue-slider")!;
      jest.spyOn(hue, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 10, width: 100, height: 10, toJSON() { return {}; } });
      hue.dispatchEvent(new MouseEvent("mousedown", { clientX: 50, bubbles: true, cancelable: true }));
      await tick();
      m.component.$set({ file: new TFile("Elsewhere/next.md") });
      await flush();
      window.dispatchEvent(new MouseEvent("mouseup"));
      await flush();
      expect(m.processFrontMatter).not.toHaveBeenCalled();
    } finally { m.component.$destroy(); }
  });
});
