/**
 * R1.3 — Relation picker modal
 *
 * Lightweight FuzzySuggestModal listing all Markdown files except the
 * current one. On choice, invokes a callback with the basename + path.
 *
 * The modal itself contains no business logic — persistence is the
 * caller's responsibility (see `relationsWriter`).
 */

import { FuzzySuggestModal, type App, type TFile } from "obsidian";

export type RelationPickHandler = (file: TFile) => void;

export class RelationPickerModal extends FuzzySuggestModal<TFile> {
  private readonly excludePath: string | undefined;
  private readonly onPick: RelationPickHandler;
  private readonly placeholder: string;

  constructor(
    app: App,
    onPick: RelationPickHandler,
    options: { excludePath?: string; placeholder?: string } = {},
  ) {
    super(app);
    this.onPick = onPick;
    this.excludePath = options.excludePath;
    this.placeholder = options.placeholder ?? "Pick a note…";
    this.setPlaceholder(this.placeholder);
  }

  override getItems(): TFile[] {
    const files = this.app.vault.getMarkdownFiles();
    if (!this.excludePath) return files;
    return files.filter((f) => f.path !== this.excludePath);
  }

  override getItemText(file: TFile): string {
    return file.path;
  }

  override onChooseItem(file: TFile): void {
    this.onPick(file);
  }
}

/**
 * Build the relation target from a vault file: strip the `.md` extension.
 * Exposed for unit-testing without instantiating the modal.
 */
export function pathFromFile(file: TFile): string {
  if (file.extension === "md") {
    return file.path.replace(/\.md$/i, "");
  }
  return file.path;
}
