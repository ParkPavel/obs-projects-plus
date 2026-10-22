import { App, Modal } from "obsidian";

import type { DataField } from "src/lib/dataframe/dataframe";
import type { ProjectDefinition } from "src/settings/settings";

import Schema from "./components/Schema.svelte";

/**
 * SchemaModal — project-wide field editor (Stage A.9).
 *
 * Single canonical entry point users hit from the Database / Table
 * toolbar. Lists every field of the project and exposes Configure /
 * Delete / Add affordances. The modal itself is presentational; the
 * caller wires the row callbacks to the existing CreateFieldModal /
 * ConfigureFieldModal infrastructure and to the view's data API so we
 * never duplicate field-mutation logic.
 */
export class SchemaModal extends Modal {
  component?: Schema;
  /** i3-final: true from open to close — the controller edits in place while it is. */
  isOpen = false;
  private current: DataField[];

  constructor(
    app: App,
    readonly title: string,
    readonly fields: DataField[],
    readonly availableProjects: ProjectDefinition[],
    readonly currentProjectId: string,
    readonly onConfigure: (field: DataField) => void,
    readonly onSetupRelation: (field: DataField) => void,
    readonly onAdd: () => void,
    readonly onDelete: (field: DataField) => void
  ) {
    super(app);
    this.current = fields;
    // Shared plugin modal root: phone input size, reduced motion (tokens.css).
    this.containerEl.addClass("ppp-modal");
  }

  /**
   * i3-final: show `fields` without closing — an edit made from this dialog
   * refreshes the list in place. `focus.name` is the row that takes focus
   * (the edited field, under its new name after a rename); when that row is
   * gone (a delete) the row now at `focus.index` takes it.
   */
  setFields(fields: DataField[], focus?: { name: string; index: number }): void {
    this.current = fields;
    if (!this.component) return;
    this.component.$set({ fields });
    // The component's exported function, typed here: lint reads a .svelte import as `any`.
    const view = this.component as unknown as { focusField(name: string, index: number): Promise<void> };
    if (focus) void view.focusField(focus.name, focus.index);
  }

  onOpen() {
    this.isOpen = true;
    this.component = new Schema({
      target: this.contentEl,
      props: {
        title: this.title,
        fields: this.current,
        availableProjects: this.availableProjects,
        currentProjectId: this.currentProjectId,
        onConfigure: (field: DataField) => {
          this.onConfigure(field);
        },
        onSetupRelation: (field: DataField) => this.onSetupRelation(field),
        onAdd: () => {
          this.onAdd();
        },
        onDelete: (field: DataField) => {
          this.onDelete(field);
        },
        onClose: () => this.close(),
      },
    });
  }

  onClose() {
    this.isOpen = false;
    if (this.component) {
      this.component.$destroy();
      delete this.component;
    }
  }
}
