import { App, Modal } from "obsidian";
import type { ProjectDefinition } from "src/settings/settings";
import type { RelationPreviewSummary, RelationSetupDraft } from "src/lib/relations/relationSetup";
import RelationSetup from "./components/RelationSetup.svelte";

export class RelationSetupModal extends Modal {
  component?: RelationSetup;
  private readonly restoreFocus: HTMLElement | null;
  constructor(app: App, readonly projects: readonly ProjectDefinition[], readonly draft: RelationSetupDraft, readonly summary: RelationPreviewSummary | undefined, readonly onSave: (draft: RelationSetupDraft) => void, readonly onPreview: (draft: RelationSetupDraft) => void, readonly error = "") {
    super(app); this.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  onOpen() { this.component = new RelationSetup({ target: this.contentEl, props: { projects: this.projects, draft: this.draft, summary: this.summary, error: this.error } }); this.component.$on("save", (event: CustomEvent<RelationSetupDraft>) => this.onSave(event.detail)); this.component.$on("preview", (event: CustomEvent<RelationSetupDraft>) => this.onPreview(event.detail)); this.component.$on("cancel", () => this.close()); }
  onClose() { this.component?.$destroy(); this.restoreFocus?.focus(); }
  setSummary(summary: RelationPreviewSummary | undefined) { this.component?.$set({ summary }); }
}
