/**
 * 3.7.2 B2 — mounts the plugin's properties block in the header of every open
 * Markdown note, in both modes, and hides Obsidian's own block while the
 * setting is on.
 *
 * Obsidian has no API to replace its Properties block, so the block is placed
 * next to it in the DOM Obsidian renders:
 *  - Live Preview / Source: `.cm-sizer` (inline title, `.metadata-container`)
 *  - Reading: `.markdown-preview-sizer > .mod-header`
 * Our host goes right before `.metadata-container` (or after the inline
 * title, or first in the sizer when neither exists). Obsidian's block is
 * hidden with a class on the view, never removed, so turning the setting off
 * (or disabling the plugin) brings it back untouched.
 *
 * Re-renders: a MutationObserver per sizer re-places the host when Obsidian
 * rebuilds the header; workspace events (layout-change, file-open,
 * active-leaf-change) cover new leaves, splits, popout windows and mode
 * switches. Everything is undone by `dispose()`.
 */

import type { App, EventRef, TFile } from "obsidian";

export const HOST_CLASS = "ppp-note-props-host";
export const NATIVE_HIDDEN_CLASS = "ppp-note-props-replace-native";

const SIZER_SELECTOR = ".cm-sizer, .markdown-preview-sizer";

export interface PropertiesMount {
  setFile(file: TFile): void;
  destroy(): void;
}

export type PropertiesMountFactory = (target: HTMLElement, file: TFile) => PropertiesMount;

interface MarkdownLikeView {
  getViewType(): string;
  containerEl: HTMLElement;
  file: TFile | null;
}

interface Record_ {
  sizer: HTMLElement;
  viewEl: HTMLElement;
  host: HTMLElement;
  mount: PropertiesMount;
  observer: MutationObserver | null;
}

function markdownViewOf(leaf: unknown): MarkdownLikeView | null {
  const view = (leaf as { view?: Partial<MarkdownLikeView> } | null)?.view;
  if (!view || typeof view.getViewType !== "function") return null;
  if (view.getViewType() !== "markdown") return null;
  if (!view.containerEl) return null;
  return view as MarkdownLikeView;
}

export class NotePropertiesManager {
  private readonly records = new Map<HTMLElement, Record_>();
  private readonly styledViews = new Set<HTMLElement>();
  private refs: EventRef[] = [];
  private started = false;
  private disposed = false;
  private pending: number | null = null;

  constructor(
    private readonly app: App,
    private readonly isEnabled: () => boolean,
    private readonly createMount: PropertiesMountFactory,
  ) {}

  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    const ws = this.app.workspace;
    const resync = () => this.sync();
    this.refs.push(ws.on("layout-change", resync));
    this.refs.push(ws.on("file-open", resync));
    this.refs.push(ws.on("active-leaf-change", resync));
    this.sync();
  }

  /** Coalesce a sync to the next macrotask (post-processor / re-render hooks). */
  schedule(): void {
    if (this.disposed || this.pending !== null) return;
    this.pending = window.setTimeout(() => {
      this.pending = null;
      this.sync();
    }, 0);
  }

  sync(): void {
    if (this.disposed) return;
    const enabled = this.isEnabled();
    const liveSizers = new Set<HTMLElement>();
    const liveViews = new Set<HTMLElement>();

    if (enabled) {
      this.app.workspace.iterateAllLeaves((leaf) => {
        const view = markdownViewOf(leaf);
        if (!view) return;
        const file = view.file;
        if (!file || file.extension !== "md") return;
        liveViews.add(view.containerEl);
        if (!this.styledViews.has(view.containerEl)) {
          view.containerEl.classList.add(NATIVE_HIDDEN_CLASS);
          this.styledViews.add(view.containerEl);
        }
        view.containerEl.querySelectorAll<HTMLElement>(SIZER_SELECTOR).forEach((sizer) => {
          liveSizers.add(sizer);
          this.ensure(sizer, view.containerEl, file);
        });
      });
    }

    for (const [sizer, rec] of Array.from(this.records)) {
      if (!liveSizers.has(sizer) || !sizer.isConnected) this.drop(rec);
    }
    for (const viewEl of Array.from(this.styledViews)) {
      if (!liveViews.has(viewEl)) {
        viewEl.classList.remove(NATIVE_HIDDEN_CLASS);
        this.styledViews.delete(viewEl);
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    for (const ref of this.refs) this.app.workspace.offref(ref);
    this.refs = [];
    if (this.pending !== null) window.clearTimeout(this.pending);
    this.pending = null;
    for (const rec of Array.from(this.records.values())) this.drop(rec);
    for (const viewEl of this.styledViews) viewEl.classList.remove(NATIVE_HIDDEN_CLASS);
    this.styledViews.clear();
    this.disposed = true;
  }

  private ensure(sizer: HTMLElement, viewEl: HTMLElement, file: TFile): void {
    const existing = this.records.get(sizer);
    if (existing) {
      existing.mount.setFile(file);
      this.place(existing);
      return;
    }
    const host = sizer.createDiv({ cls: HOST_CLASS });
    const rec: Record_ = {
      sizer,
      viewEl,
      host,
      mount: { setFile: () => undefined, destroy: () => undefined },
      observer: null,
    };
    this.place(rec);
    rec.mount = this.createMount(host, file);
    const Observer = sizer.ownerDocument.defaultView?.MutationObserver ?? window.MutationObserver;
    rec.observer = new Observer(() => {
      if (!this.disposed && this.records.get(sizer) === rec) this.place(rec);
    });
    rec.observer.observe(sizer, { childList: true });
    const header = sizer.querySelector(":scope > .mod-header");
    if (header) rec.observer.observe(header, { childList: true });
    this.records.set(sizer, rec);
  }

  /** Put the host before Obsidian's block; no DOM write when already there. */
  private place(rec: Record_): void {
    const { sizer, host } = rec;
    const meta = sizer.querySelector<HTMLElement>(".metadata-container");
    if (meta && meta.parentElement) {
      if (host.nextElementSibling !== meta) meta.parentElement.insertBefore(host, meta);
    } else {
      const title = sizer.querySelector<HTMLElement>(".inline-title");
      if (title && title.parentElement) {
        if (title.nextElementSibling !== host) title.after(host);
      } else if (sizer.firstElementChild !== host) {
        sizer.prepend(host);
      }
    }
    // A rebuilt reading-mode header is a new node: watch it too.
    const header = sizer.querySelector(":scope > .mod-header");
    if (header && rec.observer) rec.observer.observe(header, { childList: true });
  }

  private drop(rec: Record_): void {
    rec.observer?.disconnect();
    rec.mount.destroy();
    rec.host.remove();
    this.records.delete(rec.sizer);
  }
}
