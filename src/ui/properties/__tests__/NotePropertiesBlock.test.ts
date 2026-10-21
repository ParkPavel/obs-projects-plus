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
jest.mock("src/lib/contextMenu", () => ({
  openContextMenu: (items: Array<{ title?: string; onClick?: () => void }>) => {
    mockMenus.push(items);
  },
}));

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
// Required, not imported: esbuild-jest runs babel hoisting on files with
// jest.mock, and babel refuses an imported binding also used as a type.
const { TFile } = require("obsidian");
type TFile = { path: string };

const NotePropertiesBlock = require("../NotePropertiesBlock.svelte").default;

function setup(fm: Record<string, unknown>) {
  const file = new TFile("Notes/a.md");
  const listeners: Array<(f: TFile) => void> = [];
  const processFrontMatter = jest.fn(async (_f: unknown, fn: (f: Record<string, unknown>) => void) => {
    fn(fm);
    listeners.forEach((cb) => cb(file));
  });
  const app = {
    metadataCache: {
      getFileCache: () => ({ frontmatter: { ...fm } }),
      on: (_name: string, cb: (f: TFile) => void) => {
        listeners.push(cb);
        return {};
      },
      offref: () => undefined,
    },
    fileManager: { processFrontMatter },
    vault: { getMarkdownFiles: () => [], getAbstractFileByPath: () => null },
    workspace: { openLinkText: jest.fn(), getLeaf: jest.fn() },
  };
  const result = render(NotePropertiesBlock, { props: { app, file } });
  return { ...result, processFrontMatter };
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
