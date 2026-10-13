/**
 * 3.7.2 B2 — the note-header properties block: mounting into every Markdown
 * leaf (both modes), hiding Obsidian's block by setting, and full cleanup.
 */
import {
  NotePropertiesManager,
  NATIVE_HIDDEN_CLASS,
  HOST_CLASS,
} from "../notePropertiesManager";

// Obsidian's `el.createDiv()`, which jsdom lacks.
beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as {
    createDiv?: (o?: { cls?: string }) => HTMLDivElement;
  };
  if (!proto.createDiv) {
    proto.createDiv = function (this: HTMLElement, o?: { cls?: string }) {
      const div = this.ownerDocument.createElement("div");
      if (o?.cls) div.className = o.cls;
      this.appendChild(div);
      return div;
    };
  }
});

type Handler = (...args: unknown[]) => void;

const LEAF_HTML = [
  '<div class="markdown-source-view"><div class="cm-scroller"><div class="cm-sizer">',
  '<div class="inline-title">T</div><div class="metadata-container"></div><div class="cm-contentContainer"></div>',
  "</div></div></div>",
  '<div class="markdown-reading-view"><div class="markdown-preview-view"><div class="markdown-preview-sizer">',
  '<div class="mod-header"><div class="inline-title">T</div><div class="metadata-container"></div></div>',
  "</div></div></div>",
].join("");

function makeLeaf(path: string | null, ext = "md") {
  const containerEl = document.createElement("div");
  containerEl.innerHTML = LEAF_HTML;
  document.body.appendChild(containerEl);
  const file = path ? { path, extension: ext, basename: path } : null;
  return { view: { getViewType: () => (ext === "md" ? "markdown" : ext), containerEl, file } };
}

function makeApp(leaves: ReturnType<typeof makeLeaf>[]) {
  const handlers = new Map<string, Handler[]>();
  const workspace = {
    iterateAllLeaves: (cb: (l: unknown) => void) => leaves.forEach(cb),
    on: (name: string, cb: Handler) => {
      const list = handlers.get(name) ?? [];
      list.push(cb);
      handlers.set(name, list);
      return { name, cb };
    },
    offref: (ref: { name: string; cb: Handler }) => {
      const list = handlers.get(ref.name) ?? [];
      handlers.set(ref.name, list.filter((h) => h !== ref.cb));
    },
  };
  const fire = (name: string) => (handlers.get(name) ?? []).forEach((h) => h());
  const count = () => Array.from(handlers.values()).reduce((n, l) => n + l.length, 0);
  return { app: { workspace } as never, fire, count };
}

function factory() {
  const mounts: Array<{ target: HTMLElement; file: unknown; destroyed: boolean }> = [];
  const create = (target: HTMLElement, file: unknown) => {
    const m = { target, file, destroyed: false };
    mounts.push(m);
    return {
      setFile: (f: unknown) => {
        m.file = f;
      },
      destroy: () => {
        m.destroyed = true;
      },
    };
  };
  return { mounts, create };
}

const tickMacro = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("B2 NotePropertiesManager", () => {
  it("mounts one block above Obsidian's block in Live Preview and in reading mode", () => {
    const leaf = makeLeaf("a.md");
    const { app } = makeApp([leaf]);
    const f = factory();
    const m = new NotePropertiesManager(app, () => true, f.create);
    m.start();
    const hosts = leaf.view.containerEl.querySelectorAll(`.${HOST_CLASS}`);
    expect(hosts.length).toBe(2);
    hosts.forEach((h) => expect(h.nextElementSibling?.classList.contains("metadata-container")).toBe(true));
    expect(f.mounts.length).toBe(2);
    m.start(); // idempotent
    m.sync();
    expect(leaf.view.containerEl.querySelectorAll(`.${HOST_CLASS}`).length).toBe(2);
    expect(f.mounts.length).toBe(2);
    m.dispose();
  });

  it("hides Obsidian's block only while the setting is on", () => {
    const leaf = makeLeaf("a.md");
    const { app } = makeApp([leaf]);
    let on = true;
    const f = factory();
    const m = new NotePropertiesManager(app, () => on, f.create);
    m.start();
    expect(leaf.view.containerEl.classList.contains(NATIVE_HIDDEN_CLASS)).toBe(true);
    on = false;
    m.sync();
    expect(leaf.view.containerEl.classList.contains(NATIVE_HIDDEN_CLASS)).toBe(false);
    expect(leaf.view.containerEl.querySelectorAll(`.${HOST_CLASS}`).length).toBe(0);
    expect(f.mounts.every((x) => x.destroyed)).toBe(true);
    on = true;
    m.sync();
    expect(leaf.view.containerEl.classList.contains(NATIVE_HIDDEN_CLASS)).toBe(true);
    m.dispose();
  });

  it("follows the file shown in the leaf and ignores non-Markdown leaves", () => {
    const leaf = makeLeaf("a.md");
    const other = makeLeaf("b.canvas", "canvas");
    const { app, fire } = makeApp([leaf, other]);
    const f = factory();
    const m = new NotePropertiesManager(app, () => true, f.create);
    m.start();
    expect(other.view.containerEl.querySelectorAll(`.${HOST_CLASS}`).length).toBe(0);
    (leaf.view as { file: unknown }).file = { path: "c.md", extension: "md", basename: "c" };
    fire("file-open");
    expect(f.mounts.every((x) => (x.file as { path: string }).path === "c.md")).toBe(true);
    m.dispose();
  });

  it("re-attaches when Obsidian re-renders the header", async () => {
    const leaf = makeLeaf("a.md");
    const { app } = makeApp([leaf]);
    const f = factory();
    const m = new NotePropertiesManager(app, () => true, f.create);
    m.start();
    const sizer = leaf.view.containerEl.querySelector(".markdown-preview-sizer")!;
    sizer.innerHTML = '<div class="mod-header"><div class="metadata-container"></div></div>';
    await tickMacro();
    const host = sizer.querySelector(`.${HOST_CLASS}`);
    expect(host?.nextElementSibling?.classList.contains("metadata-container")).toBe(true);
    m.dispose();
  });

  it("dispose removes every listener, block, observer and class", async () => {
    const leaf = makeLeaf("a.md");
    const { app, count, fire } = makeApp([leaf]);
    const f = factory();
    const m = new NotePropertiesManager(app, () => true, f.create);
    m.start();
    expect(count()).toBeGreaterThan(0);
    m.dispose();
    expect(count()).toBe(0);
    expect(leaf.view.containerEl.querySelectorAll(`.${HOST_CLASS}`).length).toBe(0);
    expect(leaf.view.containerEl.classList.contains(NATIVE_HIDDEN_CLASS)).toBe(false);
    expect(f.mounts.every((x) => x.destroyed)).toBe(true);
    const sizer = leaf.view.containerEl.querySelector(".cm-sizer")!;
    sizer.appendChild(document.createElement("div"));
    fire("layout-change");
    m.schedule();
    await tickMacro();
    expect(leaf.view.containerEl.querySelectorAll(`.${HOST_CLASS}`).length).toBe(0);
  });

  it("drops blocks of closed leaves on the next sync", () => {
    const leaf = makeLeaf("a.md");
    const leaves = [leaf];
    const { app } = makeApp(leaves);
    const f = factory();
    const m = new NotePropertiesManager(app, () => true, f.create);
    m.start();
    leaves.length = 0;
    leaf.view.containerEl.remove();
    m.sync();
    expect(f.mounts.every((x) => x.destroyed)).toBe(true);
    m.dispose();
  });
});
